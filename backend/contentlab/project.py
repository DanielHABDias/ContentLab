"""Project folder workflows shared by the web UI and CLI."""

import json
from pathlib import Path

from .errors import PlanValidationError
from .parser import load_edit_plan
from .render import render_edit_plan
from .service import validate_edit_plan


def project_plan_path(directory):
    if not isinstance(directory, str) or not directory.strip():
        raise PlanValidationError([{"path": "projectRoot", "message": "Informe a pasta do projeto."}])
    root = Path(directory).expanduser().resolve()
    path = root / "edit_plan.json"
    if not root.is_dir() or not path.is_file():
        raise PlanValidationError([{"path": "projectRoot", "message": "A pasta precisa conter edit_plan.json."}])
    return root, path


def inspect_project(directory):
    root, path = project_plan_path(directory)
    plan = load_edit_plan(path)
    validation = validate_edit_plan(path, root)
    return {
        "projectRoot": str(root), "planPath": str(path), "name": plan.project.name,
        "scenes": [{"id": scene["id"], "start": scene["start"], "end": scene["end"], "elements": len(scene["elements"])} for scene in plan.timeline],
        "validation": validation,
    }


def _preview_data(path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    settings = load_edit_plan(path).project
    factor = min(1.0, 960 / max(settings.width, settings.height))
    width = max(2, round(settings.width * factor / 2) * 2)
    height = max(2, round(settings.height * factor / 2) * 2)
    data["project"]["resolution"] = {"width": width, "height": height}
    data["project"]["fps"] = min(settings.fps, 15)
    return data


def render_project(directory, mode="preview", progress=None, ffmpeg_dir=None, runner=None):
    if mode not in {"preview", "final"}:
        raise ValueError("Modo de projeto inválido.")
    root, path = project_plan_path(directory)
    source = _preview_data(path) if mode == "preview" else path
    options = {"output_dir": root / "output" / mode, "project_root": root, "progress": progress, "mode": mode}
    if ffmpeg_dir is not None:
        options["ffmpeg_dir"] = ffmpeg_dir
    if runner is not None:
        options["runner"] = runner
    return render_edit_plan(source, **options)
