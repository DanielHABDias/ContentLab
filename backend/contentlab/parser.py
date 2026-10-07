import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

from .errors import PlanValidationError
from .models import EditPlan, ProjectSettings

SCHEMA_ROOT = (Path(sys._MEIPASS) if getattr(sys, "_MEIPASS", None) else Path(__file__).resolve().parents[2]) / "schemas"
FORMAT_DEFAULTS = {
    "youtube_long": (1920, 1080, 30.0),
    "youtube_short": (1080, 1920, 30.0),
    "custom": (1920, 1080, 30.0),
}


def _path(parts):
    return ".".join(str(part) for part in parts) or "$"


def _semantic_issues(data):
    issues = []
    ids = set()
    previous_end = 0.0
    for index, scene in enumerate(data.get("timeline", [])):
        prefix = f"timeline.{index}"
        scene_id = scene.get("id")
        if scene_id in ids:
            issues.append({"path": f"{prefix}.id", "message": f"ID de cena duplicado: {scene_id}"})
        ids.add(scene_id)
        start, end = scene.get("start", 0), scene.get("end", 0)
        if end <= start:
            issues.append({"path": prefix, "message": "A cena deve terminar depois de começar."})
        if start < previous_end:
            issues.append({"path": f"{prefix}.start", "message": "Cenas não podem se sobrepor na v0.1."})
        previous_end = max(previous_end, end)
        if data.get("version") == "0.2":
            duration = end - start
            if scene.get("layout", "fullscreen") != "fullscreen":
                issues.append({"path": f"{prefix}.layout", "message": "Motion design v0.2 usa composição fullscreen; layout em grade ainda não é suportado."})
            if scene.get("background", {}).get("fit", "cover") != "cover" or scene.get("background", {}).get("loop"):
                issues.append({"path": f"{prefix}.background", "message": "O fundo v0.2 aceita apenas imagem estática em cover ou cor sólida."})
            for keyframe_path, frames in [(f"{prefix}.camera.keyframes", scene.get("camera", {}).get("keyframes", []))] + [
                (f"{prefix}.elements.{j}.keyframes", element.get("keyframes", []))
                for j, element in enumerate(scene.get("elements", []))
            ]:
                previous_t = -1.0
                for frame in frames:
                    t = frame["t"]
                    if t <= previous_t or t > duration:
                        issues.append({"path": keyframe_path, "message": "Keyframes devem ter tempos únicos, crescentes e dentro da cena."})
                    previous_t = t
            element_ids = [element.get("id") for element in scene.get("elements", []) if element.get("type") != "sfx"]
            if any(not item for item in element_ids) or len(element_ids) != len(set(element_ids)):
                issues.append({"path": f"{prefix}.elements", "message": "Elementos visuais precisam de IDs únicos."})
            for j, element in enumerate(scene.get("elements", [])):
                unsupported = set(element) & {"cells", "fit", "box", "loop", "sync", "emphasis", "range"}
                if unsupported:
                    issues.append({"path": f"{prefix}.elements.{j}", "message": f"Campos ainda não suportados em v0.2: {', '.join(sorted(unsupported))}."})
                if element.get("start", start) < start or element.get("end", end) > end:
                    issues.append({"path": f"{prefix}.elements.{j}", "message": "Elemento deve ficar dentro da cena."})
                if element["type"] in {"image", "text"} and element.get("animation"):
                    issues.append({"path": f"{prefix}.elements.{j}.animation", "message": "Use transform/keyframes no motion design v0.2."})
                if element["type"] == "sfx" and (element.get("transform") or element.get("keyframes")):
                    issues.append({"path": f"{prefix}.elements.{j}", "message": "SFX não aceita transformações visuais."})
                if element["type"] == "image" and not element.get("asset"):
                    issues.append({"path": f"{prefix}.elements.{j}.asset", "message": "Imagem requer asset."})
                if element["type"] == "image" and element.get("asset") and not element["asset"].lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp")):
                    issues.append({"path": f"{prefix}.elements.{j}.asset", "message": "Imagem v0.2 requer PNG, JPG, WebP ou BMP."})
                if element["type"] == "text" and not element.get("text"):
                    issues.append({"path": f"{prefix}.elements.{j}.text", "message": "Texto não pode estar vazio."})
            if scene.get("background", {}).get("asset") and not scene["background"]["asset"].lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp")):
                issues.append({"path": f"{prefix}.background.asset", "message": "O fundo v0.2 deve ser uma imagem estática."})
        for element_index, element in enumerate(scene.get("elements", [])):
            epath = f"{prefix}.elements.{element_index}"
            if "start" in element and "end" in element and element["end"] <= element["start"]:
                issues.append({"path": epath, "message": "O elemento deve terminar depois de começar."})
            cells = element.get("cells")
            if cells:
                rows = {(cell - 1) // 3 for cell in cells}
                cols = {(cell - 1) % 3 for cell in cells}
                rectangle = {row * 3 + col + 1 for row in rows for col in cols}
                if set(cells) != rectangle:
                    issues.append({"path": f"{epath}.cells", "message": "As células devem formar um retângulo contínuo."})
    previous_cut_end = 0.0
    for index, cut in enumerate(data.get("audio", {}).get("sourceCuts", [])):
        if cut["end"] <= cut["start"]:
            issues.append({"path": f"audio.sourceCuts.{index}", "message": "O corte deve terminar depois de começar."})
        if cut["start"] < previous_cut_end:
            issues.append({"path": f"audio.sourceCuts.{index}", "message": "Cortes da narração devem estar ordenados e não podem se sobrepor."})
        previous_cut_end = max(previous_cut_end, cut["end"])
    for index, music in enumerate(data.get("audio", {}).get("music", [])):
        if music["end"] <= music["start"]:
            issues.append({"path": f"audio.music.{index}", "message": "A música deve terminar depois de começar."})
        if music.get("fadeIn", 0) + music.get("fadeOut", 0) > music["end"] - music["start"]:
            issues.append({"path": f"audio.music.{index}", "message": "Fades excedem a duração da música."})
    for scene_index, scene in enumerate(data.get("timeline", [])):
        for element_index, element in enumerate(scene.get("elements", [])):
            if element["type"] in {"sfx", "overlay"} and not element.get("asset"):
                issues.append({"path": f"timeline.{scene_index}.elements.{element_index}.asset", "message": "Asset obrigatório para SFX/overlay."})
            if element["type"] == "overlay":
                config = element.get("config", {})
                for key in ("similarity", "blend"):
                    if key in config and (not isinstance(config[key], (int, float)) or not 0 <= config[key] <= 1):
                        issues.append({"path": f"timeline.{scene_index}.elements.{element_index}.config.{key}", "message": "Valor deve ficar entre 0 e 1."})
            if element["type"] == "sfx" and "duration" in element.get("config", {}):
                value = element["config"]["duration"]
                if not isinstance(value, (int, float)) or value <= 0:
                    issues.append({"path": f"timeline.{scene_index}.elements.{element_index}.config.duration", "message": "Duração do SFX deve ser positiva."})
            if element["type"] == "sfx":
                config = element.get("config", {})
                for key in ("fadeIn", "fadeOut"):
                    if key in config and (not isinstance(config[key], (int, float)) or config[key] < 0):
                        issues.append({"path": f"timeline.{scene_index}.elements.{element_index}.config.{key}", "message": "Fade do SFX deve ser não negativo."})
                if "trimDb" in config and not isinstance(config["trimDb"], (int, float)):
                    issues.append({"path": f"timeline.{scene_index}.elements.{element_index}.config.trimDb", "message": "trimDb deve ser numérico."})
    return issues


def parse_edit_plan(data, source_path=None):
    version = data.get("version") if isinstance(data, dict) else None
    if version not in {"0.1", "0.2"}:
        raise PlanValidationError([{"path": "version", "message": "Versão de JSON não suportada: use 0.1 ou 0.2."}])
    schema = json.loads((SCHEMA_ROOT / f"contentlab.schema.v{version}.json").read_text(encoding="utf-8-sig"))
    errors = sorted(Draft202012Validator(schema).iter_errors(data), key=lambda error: list(error.path))
    issues = [{"path": _path(error.absolute_path), "message": error.message} for error in errors]
    # A validação semântica assume a forma e os tipos garantidos pelo schema.
    if not issues:
        issues.extend(_semantic_issues(data))
    if issues:
        raise PlanValidationError(issues)

    project = data["project"]
    default_width, default_height, default_fps = FORMAT_DEFAULTS[project["format"]]
    resolution = project.get("resolution", {})
    settings = ProjectSettings(
        name=project["name"],
        format=project["format"],
        profile=project["profile"],
        width=resolution.get("width", default_width),
        height=resolution.get("height", default_height),
        fps=float(project.get("fps", default_fps)),
        seed=project.get("seed", 0),
    )
    return EditPlan(
        version=data["version"], project=settings, sources=data.get("sources", {}),
        audio=data["audio"], timeline=tuple(data["timeline"]),
        source_path=Path(source_path).resolve() if source_path else None,
    )


def load_edit_plan(path):
    path = Path(path).expanduser().resolve()
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PlanValidationError([{"path": "$", "message": str(exc)}]) from exc
    return parse_edit_plan(data, path)
