"""The typed JSON boundary between the validated Python plan and Remotion."""

import json
import os
import shutil
import subprocess
from pathlib import Path

from .errors import RenderError
from .remotion_runtime import REMOTION_DIR, ensure_remotion
from .text import _phrase_words, transcript_words
from .typography import appearance, bundled_font_path


def _link_media(path, public, index):
    if not path:
        return None
    source = Path(path).resolve()
    name = f"media-{index}{source.suffix.lower()}"
    destination = public / name
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)
    return name


def render_remotion_scene(scene, output, project, duration, work_dir, runner=subprocess.run, transcript=None, cancel_event=None, hardware_accel=False):
    """Render one validated visual scene; the Python pipeline still owns audio and transitions."""
    if cancel_event is not None and cancel_event.is_set():
        from .errors import RenderCancelled
        raise RenderCancelled("Render cancelado pelo usuário.")
    node = ensure_remotion()
    public = Path(work_dir) / f"{output.stem}-remotion-public"
    public.mkdir()
    elements = []
    words = transcript_words(transcript)
    for index, element in enumerate(scene.elements):
        if element.type == "sfx":
            continue
        data = {key: value for key, value in element.data.items() if not key.startswith("_")}
        if element.type == "kinetic_text":
            data["phraseWords"] = _phrase_words(data.get("text"), element.start, element.end, words)
        font_path = element.data.get("_font_path") or bundled_font_path(appearance(data)["fontFamily"])
        elements.append({
            "id": element.data["id"], "type": element.type, "start": element.start,
            "end": element.end, "z": element.z, "region": list(element.region),
            "src": _link_media(element.asset_path, public, index),
            "fontSrc": _link_media(font_path, public, f"font-{index}"),
            "fontFamily": f"contentlab-font-{index}",
            "data": data,
        })
    payload = {
        "width": project.width, "height": project.height, "fps": project.fps,
        "durationInFrames": max(1, round(duration * project.fps)),
        "scene": {
            "id": scene.id, "start": scene.start, "end": scene.end,
            "background": scene.background,
            "backgroundSrc": _link_media(scene.background_path, public, len(elements) + 1),
            "camera": scene.camera, "elements": elements,
        },
        "words": words,
    }
    props = Path(work_dir) / f"{output.stem}-remotion-props.json"
    props.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    cli = REMOTION_DIR / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
    command = [str(node), str(cli), "render", str(REMOTION_DIR / "src/index.ts"), "Scene", str(output),
               "--props", str(props), "--public-dir", str(public), "--codec", "h264",
               "--log", "info", "--overwrite"]
    if hardware_accel:
        command.append("--hardware-acceleration=if-possible")
    result = runner(command, cwd=REMOTION_DIR, capture_output=True, text=True,
                    creationflags=0x08000000 if os.name == "nt" else 0)
    if result.returncode or not output.is_file():
        details = (result.stderr or result.stdout or "sem vídeo gerado").strip()
        raise RenderError(
            f"Remotion falhou (exit={result.returncode}): "
            + details[-6000:]
        )
