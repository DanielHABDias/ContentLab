import json
from pathlib import Path

from jsonschema import Draft202012Validator

from .errors import PlanValidationError
from .models import EditPlan, ProjectSettings

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "contentlab.schema.v0.1.json"
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
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8-sig"))
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
