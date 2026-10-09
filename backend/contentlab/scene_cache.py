"""Persistent per-scene MP4 cache for the automatic editor.

The cache is an optimization, never the source of truth: invalid, missing or
changed entries are rendered again. Transitions/audio are composed separately.
"""
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

CACHE_VERSION = "scene-v1"


def _json_hash(value):
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def scene_filename(scene_id):
    """Opaque, traversal-safe stable filename; different IDs cannot share one slot."""
    slug = re.sub(r"[^a-zA-Z0-9_-]", "-", str(scene_id)).strip("-")[:64] or "scene"
    suffix = hashlib.sha256(str(scene_id).encode("utf-8")).hexdigest()[:16]
    return f"{slug}-{suffix}.mp4"


def _file_identity(path):
    path = Path(path).resolve()
    stat = path.stat()
    return {"path": str(path), "size": stat.st_size, "mtimeNs": stat.st_mtime_ns}


def code_identity(engine):
    """Invalidate scene caches when the renderer or its bundled fonts change."""
    base = Path(__file__).resolve().parent
    tracked = list(base.glob("*.py")) + list((base / "transition_plugins").glob("*.py"))
    if engine.startswith("remotion"):
        root = base.parent / "remotion"
        tracked += list((root / "src").glob("*.ts")) + list((root / "src").glob("*.tsx"))
        tracked.append(root / "package-lock.json")
    fonts = base.parents[1] / "builtin-assets"
    if fonts.is_dir():
        tracked += list(fonts.rglob("*.ttf")) + list(fonts.rglob("*.otf"))
    return _json_hash([_file_identity(path) for path in sorted(set(tracked)) if path.is_file()])


def scene_fingerprint(scene_data, project, resolved_assets, transcript, engine, encoder, hardware_accel, code_hash, duration):
    """Hash only dependencies that affect this silent, isolated scene segment."""
    if scene_data is None:
        selected = {"id": "__gap__", "duration": duration, "background": "#000000"}
        assets = []
        words = []
    else:
        selected = scene_data
        asset_uris = set()
        background = scene_data.get("background") or {}
        if background.get("asset"):
            asset_uris.add(background["asset"])
        for item in scene_data.get("elements", []):
            for field in ("asset", "fontAsset"):
                if item.get(field):
                    asset_uris.add(item[field])
        assets = [
            (uri, _file_identity(resolved_assets[uri]) if uri in resolved_assets else None)
            for uri in sorted(asset_uris)
        ]
        transcript_required = any(
            element.get("type") in {"caption", "kinetic_text"}
            for element in scene_data.get("elements", [])
        )
        if transcript_required and transcript:
            from .text import transcript_words
            words = [
                word for word in transcript_words(transcript)
                if word["end"] > scene_data["start"] and word["start"] < scene_data["end"]
            ]
        else:
            words = []
    return _json_hash({
        "cacheVersion": CACHE_VERSION,
        "scene": selected,
        "duration": duration,
        "renderSettings": {
            "width": project.width, "height": project.height,
            "fps": project.fps, "seed": project.seed,
        },
        "engine": engine, "encoder": encoder, "hardwareAccel": bool(hardware_accel),
        "code": code_hash, "assets": assets, "transcriptWords": words,
    })


class SceneCache:
    def __init__(self, output_dir):
        self.directory = Path(output_dir) / "scenes"
        self.manifest_path = self.directory / "manifest.json"
        self.directory.mkdir(parents=True, exist_ok=True)
        self.entries = {}
        try:
            payload = json.loads(self.manifest_path.read_text(encoding="utf-8"))
            if payload.get("version") == CACHE_VERSION and isinstance(payload.get("scenes"), dict):
                self.entries = payload["scenes"]
        except (OSError, ValueError, TypeError, AttributeError):
            pass

    def destination(self, scene_id):
        return self.directory / scene_filename(scene_id)

    def lookup(self, scene_id, fingerprint):
        entry = self.entries.get(scene_id)
        if not isinstance(entry, dict) or entry.get("fingerprint") != fingerprint:
            return None
        file = self.destination(scene_id)
        try:
            stat = file.stat()
            if file.is_file() and stat.st_size > 0 and stat.st_size == entry.get("size") and stat.st_mtime_ns == entry.get("mtimeNs"):
                return file
        except OSError:
            pass
        return None

    def save(self, scene_id, fingerprint, staged_file):
        """Publish only completed segments and atomically persist each entry."""
        target = self.destination(scene_id)
        os.replace(staged_file, target)
        stat = target.stat()
        if stat.st_size <= 0:
            raise ValueError(f"Trecho de cena vazio: {scene_id}")
        self.entries[scene_id] = {
            "fingerprint": fingerprint, "file": target.name,
            "size": stat.st_size, "mtimeNs": stat.st_mtime_ns,
        }
        self._write_manifest()
        return target

    def _write_manifest(self):
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", prefix=".manifest-",
                                             suffix=".tmp", dir=self.directory, delete=False) as output:
                temporary = Path(output.name)
                json.dump({"version": CACHE_VERSION, "scenes": self.entries}, output,
                          ensure_ascii=False, indent=2, sort_keys=True)
                output.write("\n")
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, self.manifest_path)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()
