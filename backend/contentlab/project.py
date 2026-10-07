"""Project folder workflows shared by the web UI and CLI."""

import json
import hashlib
import os
import tempfile
import threading
from pathlib import Path

from .errors import PlanValidationError
from .parser import load_edit_plan, parse_edit_plan
from .render import render_edit_plan
from .service import validate_edit_plan

_SAVE_LOCK = threading.Lock()
_MAX_PLAN_BYTES = 5 * 1024 * 1024


def project_plan_path(directory):
    if not isinstance(directory, str) or not directory.strip():
        raise PlanValidationError([{"path": "projectRoot", "message": "Informe a pasta do projeto."}])
    root = Path(directory).expanduser().resolve()
    path = root / "edit_plan.json"
    if not root.is_dir() or not path.is_file():
        raise PlanValidationError([{"path": "projectRoot", "message": "A pasta precisa conter edit_plan.json."}])
    return root, path


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
