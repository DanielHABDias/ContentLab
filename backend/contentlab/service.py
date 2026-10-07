from pathlib import Path

from .assets import AssetResolver
from .errors import ContentLabError, PlanValidationError
from .parser import load_edit_plan, parse_edit_plan
from .registry import DEFAULT_REGISTRY
from .timeline import compile_timeline


def _asset_uris(plan):
    uris = []
    for item in plan.audio.get("music", []):
        if item.get("asset"):
            uris.append(item["asset"])
    for scene in plan.timeline:
        background = scene.get("background", {})
        if background.get("asset"):
            uris.append(background["asset"])
        for element in scene.get("elements", []):
            if element.get("asset"):
                uris.append(element["asset"])
    return list(dict.fromkeys(uris))


def validate_edit_plan(source, project_root=None, builtin_root=None):
    plan = load_edit_plan(source) if isinstance(source, (str, Path)) else parse_edit_plan(source)
    project_root = Path(project_root or (plan.source_path.parent if plan.source_path else Path.cwd())).resolve()
    builtin_root = Path(builtin_root or Path(__file__).resolve().parents[2] / "builtin-assets").resolve()
    resolver = AssetResolver(project_root, builtin_root)
    resolved = {}
    missing = []
    issues = []
    for uri in _asset_uris(plan):
        try:
            path = resolver.resolve(uri)
        except ContentLabError as exc:
            issues.append({"path": "asset", "message": str(exc), "asset": uri})
            continue
        resolved[uri] = str(path)
        if not path.is_file():
            missing.append({"asset": uri, "path": str(path)})

    narration = Path(plan.audio["narration"])
    if not narration.is_absolute():
        narration = (project_root / narration).resolve()
    if narration != project_root and project_root not in narration.parents:
        issues.append({"path": "audio.narration", "message": "A narração está fora da raiz do projeto."})
    elif not narration.is_file():
        missing.append({"asset": "audio.narration", "path": str(narration)})
    if issues:
        raise PlanValidationError(issues)

    timeline = compile_timeline(plan, resolved, DEFAULT_REGISTRY)
    return {
        "valid": not missing,
        "version": plan.version,
        "project": plan.project.name,
        "duration": timeline.duration,
        "sceneCount": len(timeline.scenes),
        "elementCount": sum(len(scene.elements) for scene in timeline.scenes),
        "resolution": {"width": plan.project.width, "height": plan.project.height},
        "fps": plan.project.fps,
        "missingAssets": missing,
        "resolvedAssets": resolved,
    }
