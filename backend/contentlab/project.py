"""Project folder workflows shared by the web UI and CLI."""

import json
import hashlib
import os
import shutil
import tempfile
import threading
import re
from pathlib import Path

from .errors import PlanValidationError
from .parser import load_edit_plan, parse_edit_plan
from .render import render_edit_plan
from .service import validate_edit_plan
from .service import prepare_edit_plan

_SAVE_LOCK = threading.Lock()
_MAX_PLAN_BYTES = 5 * 1024 * 1024
_CACHE_VERSION = "render-v14-scene-cache"


def project_plan_path(directory):
    if not isinstance(directory, str) or not directory.strip():
        raise PlanValidationError([{"path": "projectRoot", "message": "Informe a pasta do projeto."}])
    root = Path(directory).expanduser().resolve()
    path = root / "edit_plan.json"
    if not root.is_dir() or not path.is_file():
        raise PlanValidationError([{"path": "projectRoot", "message": "A pasta precisa conter edit_plan.json."}])
    return root, path


def create_project(parent_directory, name):
    if not isinstance(parent_directory, str) or not parent_directory.strip():
        raise PlanValidationError([{"path": "parentRoot", "message": "Informe a pasta onde criar o projeto."}])
    if not isinstance(name, str) or not re.fullmatch(r"[\w][\w .-]{0,79}", name, re.UNICODE) or name.endswith((" ", ".")):
        raise PlanValidationError([{"path": "name", "message": "Use um nome simples, sem barras, de até 80 caracteres."}])
    parent = Path(parent_directory).expanduser().resolve()
    if not parent.is_dir():
        raise PlanValidationError([{"path": "parentRoot", "message": "A pasta de destino não existe."}])
    root = parent / name
    if root.exists():
        raise PlanValidationError([{"path": "name", "message": "Já existe uma pasta com esse nome."}])
    root.mkdir()
    (root / "audio").mkdir()
    (root / "assets").mkdir()
    starter = {
        "version": "0.1", "project": {"name": name, "format": "youtube_long", "profile": "generic"},
        "sources": {"assets": "assets"}, "audio": {"narration": "audio/narration.wav"}, "timeline": [],
    }
    (root / "edit_plan.json").write_text(json.dumps(starter, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return load_project_document(str(root))


def inspect_asset_folder(directory, folder):
    root, _ = project_plan_path(directory)
    if not isinstance(folder, str) or not folder.strip():
        raise PlanValidationError([{"path": "folder", "message": "Informe uma pasta de assets."}])
    target = Path(folder).expanduser().resolve()
    if not target.is_dir() or (target != root and root not in target.parents):
        raise PlanValidationError([{"path": "folder", "message": "A pasta de assets deve estar dentro do projeto."}])
    files = sorted(path for path in target.rglob("*") if path.is_file() and root in path.resolve().parents)[:500]
    return {"folder": str(target), "relative": target.relative_to(root).as_posix(), "assets": [{"uri": "project://" + path.relative_to(root).as_posix(), "path": str(path)} for path in files], "truncated": len(files) == 500}


def import_narration(directory, upload):
    root, _ = project_plan_path(directory)
    return save_uploaded_narration(root, upload)


def save_uploaded_narration(directory, upload):
    """Save an uploaded voice in an existing folder, even before a plan exists."""
    root = Path(directory).expanduser().resolve()
    if not root.is_dir():
        raise PlanValidationError([{"path": "folder", "message": "Selecione uma pasta existente para salvar a transcrição."}])
    original = Path(upload.filename or "").suffix.lower()
    if original not in {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus"}:
        raise PlanValidationError([{"path": "file", "message": "Selecione um arquivo de áudio WAV, MP3, M4A, AAC, FLAC, OGG ou Opus."}])
    audio_dir = root / "audio"
    if audio_dir.exists() and (not audio_dir.is_dir() or audio_dir.resolve() != audio_dir):
        raise PlanValidationError([{"path": "folder", "message": "A pasta audio/ precisa ser uma pasta comum dentro do destino."}])
    audio_dir.mkdir(exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", prefix=".narration-", suffix=".tmp", dir=audio_dir, delete=False) as handle:
            temporary = Path(handle.name)
            total = 0
            while True:
                chunk = upload.stream.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > 1024 * 1024 * 1024:
                    raise PlanValidationError([{"path": "file", "message": "A narração excede 1 GB."}])
                handle.write(chunk)
        if not total:
            raise PlanValidationError([{"path": "file", "message": "O arquivo de áudio está vazio."}])
        destination = audio_dir / ("narration-" + os.urandom(6).hex() + original)
        os.replace(temporary, destination)
        return {"path": str(destination), "relative": destination.relative_to(root).as_posix()}
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def _read_plan_bytes(path):
    if path.stat().st_size > _MAX_PLAN_BYTES:
        raise PlanValidationError([{"path": "edit_plan.json", "message": "O plano excede 5 MB."}])
    return path.read_bytes()


def _revision(content):
    return hashlib.sha256(content).hexdigest()


def load_project_document(directory):
    """Load even an invalid JSON document so the user can repair it in the UI."""
    root, path = project_plan_path(directory)
    content = _read_plan_bytes(path)
    try:
        plan_text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise PlanValidationError([{"path": "edit_plan.json", "message": "Use UTF-8 no arquivo do plano."}]) from exc
    try:
        plan = json.loads(plan_text)
        parsed = parse_edit_plan(plan, path)
        validation = validate_edit_plan(plan, root)
        scenes = [{"id": scene["id"], "start": scene["start"], "end": scene["end"], "elements": len(scene["elements"])} for scene in parsed.timeline]
        name = parsed.project.name
    except (json.JSONDecodeError, PlanValidationError) as exc:
        issues = exc.issues if isinstance(exc, PlanValidationError) else [{"path": "edit_plan.json", "message": str(exc)}]
        validation = {"valid": False, "errors": issues, "missingAssets": [], "resolvedAssets": {}}
        scenes = []
        name = path.parent.name
    return {"projectRoot": str(root), "planPath": str(path), "planText": plan_text, "revision": _revision(content), "name": name, "scenes": scenes, "validation": validation}


def save_project_plan(directory, plan_text, expected_revision):
    root, path = project_plan_path(directory)
    if not isinstance(plan_text, str) or len(plan_text.encode("utf-8")) > _MAX_PLAN_BYTES:
        raise PlanValidationError([{"path": "planText", "message": "O plano deve ser texto JSON de até 5 MB."}])
    if not isinstance(expected_revision, str) or not expected_revision:
        raise PlanValidationError([{"path": "revision", "message": "Carregue o projeto novamente antes de salvar."}])
    try:
        plan = json.loads(plan_text)
    except json.JSONDecodeError as exc:
        raise PlanValidationError([{"path": "planText", "message": str(exc)}]) from exc
    parse_edit_plan(plan, path)
    validation = validate_edit_plan(plan, root)
    with _SAVE_LOCK:
        if _revision(_read_plan_bytes(path)) != expected_revision:
            raise PlanValidationError([{"path": "revision", "message": "O plano mudou no disco. Recarregue antes de salvar para não sobrescrever outra edição."}])
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="wb", prefix=".edit-plan-", suffix=".tmp", dir=root, delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(plan_text.encode("utf-8"))
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
    return load_project_document(str(root))


def inspect_project(directory):
    root, path = project_plan_path(directory)
    plan = load_edit_plan(path)
    validation = validate_edit_plan(path, root)
    return {
        "projectRoot": str(root), "planPath": str(path), "name": plan.project.name,
        "scenes": [{"id": scene["id"], "start": scene["start"], "end": scene["end"], "elements": len(scene["elements"])} for scene in plan.timeline],
        "validation": validation,
    }


def _render_fingerprint(path, root, mode, hardware_accel=False):
    plan, _, narration, validation = prepare_edit_plan(path, root)
    if not validation["valid"]:
        return None
    digest = hashlib.sha256(_CACHE_VERSION.encode())
    digest.update(mode.encode())
    digest.update(str(bool(hardware_accel)).encode())
    digest.update(os.environ.get("CONTENTLAB_MOTION_ENGINE", "remotion").encode())
    digest.update(_read_plan_bytes(path))
    dependencies = [Path(narration)] + [Path(value) for value in validation["resolvedAssets"].values()]
    if plan.sources.get("transcript"):
        transcript = Path(plan.sources["transcript"])
        dependencies.append(transcript if transcript.is_absolute() else root / transcript)
    code_root = Path(__file__).resolve().parent
    dependencies += list(code_root.glob("*.py")) + list((code_root / "transition_plugins").glob("*.py"))
    if plan.version == "0.2" and os.environ.get("CONTENTLAB_MOTION_ENGINE", "remotion") != "python":
        remotion_source = code_root.parent / "remotion"
        dependencies += list((remotion_source / "src").glob("*.ts"))
        dependencies += list((remotion_source / "src").glob("*.tsx"))
        dependencies.append(remotion_source / "package-lock.json")
    for dependency in sorted({item.resolve() for item in dependencies}):
        if not dependency.is_file():
            return None
        stat = dependency.stat()
        digest.update(f"{dependency}:{stat.st_size}:{stat.st_mtime_ns}".encode())
    return digest.hexdigest()


def render_project(directory, mode="final", progress=None, ffmpeg_dir=None, runner=None, use_cache=True, hardware_accel=False, cache_mode="reuse"):
    if mode != "final":
        raise ValueError("A geração de preview foi removida; use o render final.")
    if cache_mode not in {"reuse", "rebuild"}:
        raise ValueError("Modo de cache inválido; use reuse ou rebuild.")
    root, path = project_plan_path(directory)
    if cache_mode == "rebuild":
        # Validate before deleting anything. Only this project's exact output dir
        # can be cleaned; reject symlinks to avoid following external directories.
        validation = inspect_project(str(root))["validation"]
        if not validation["valid"]:
            raise PlanValidationError([{"path": item["asset"], "message": f"Asset ausente: {item['path']}"} for item in validation["missingAssets"]])
        output_root = root / "output"
        transcript_ref = load_edit_plan(path).sources.get("transcript")
        transcript_path = (root / transcript_ref).resolve() if transcript_ref else None
        dependencies = list(validation["resolvedAssets"].values()) + [validation["narration"]]
        if transcript_path is not None:
            dependencies.append(str(transcript_path))
        if any(Path(item).resolve() == output_root or output_root in Path(item).resolve().parents for item in dependencies):
            raise ValueError("Não é seguro limpar output: um asset, a narração ou a transcrição do plano está dentro dela.")
        if output_root.is_symlink():
            raise ValueError("A pasta output não pode ser um link simbólico.")
        if output_root.exists():
            if not output_root.is_dir():
                raise ValueError("output existe, mas não é uma pasta.")
            shutil.rmtree(output_root)
    output_dir = root / "output" / mode
    if (root / "output").is_symlink() or output_dir.is_symlink():
        raise ValueError("O diretório de saída do projeto não pode ser um link simbólico.")
    output_dir.mkdir(parents=True, exist_ok=True)
    fingerprint = _render_fingerprint(path, root, mode, hardware_accel)
    report_path = output_dir / "render_report.json"
    output_path = output_dir / "final.mp4"
    if cache_mode == "reuse" and use_cache and fingerprint and report_path.is_file() and output_path.is_file() and output_path.stat().st_size > 0:
        try:
            cached = json.loads(report_path.read_text(encoding="utf-8"))
            if cached.get("status") == "completed" and cached.get("cacheKey") == fingerprint and cached.get("outputBytes") == output_path.stat().st_size:
                # The old full-video cache cannot stand in for missing scene clips.
                from .scene_cache import SceneCache
                metadata = cached.get("sceneCache") or {}
                scene_ids = list(metadata.get("rendered") or []) + list(metadata.get("reused") or [])
                scene_store = SceneCache(output_dir)
                if scene_ids and all(
                    isinstance(scene_store.entries.get(scene_id), dict)
                    and scene_store.lookup(scene_id, scene_store.entries[scene_id].get("fingerprint"))
                    for scene_id in scene_ids
                ):
                    return {
                        **cached, "cacheHit": True,
                        "sceneCache": {
                            **metadata, "rendered": [], "renderedCount": 0,
                            "reused": scene_ids, "reusedCount": len(scene_ids),
                        },
                    }
        except (OSError, ValueError):
            pass
    source = path
    options = {"output_dir": output_dir, "project_root": root, "progress": progress, "mode": mode, "hardware_accel": hardware_accel,
               "scene_cache_enabled": True, "reuse_scenes": cache_mode == "reuse" and use_cache}
    if ffmpeg_dir is not None:
        options["ffmpeg_dir"] = ffmpeg_dir
    if runner is not None:
        options["runner"] = runner
    report = render_edit_plan(source, **options)
    report["cacheKey"] = fingerprint
    report["cacheHit"] = False
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report
