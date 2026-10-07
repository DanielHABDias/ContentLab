from pathlib import Path

from .errors import PlanValidationError
from .models import ResolvedElement, ResolvedScene, ResolvedTimeline
from .registry import DEFAULT_REGISTRY


def _region(cells, width, height):
    if not cells:
        return (0, 0, width, height)
    rows = [(cell - 1) // 3 for cell in cells]
    cols = [(cell - 1) % 3 for cell in cells]
    left = round(min(cols) * width / 3)
    top = round(min(rows) * height / 3)
    right = round((max(cols) + 1) * width / 3)
    bottom = round((max(rows) + 1) * height / 3)
    return (left, top, right - left, bottom - top)


def compile_timeline(plan, resolved_assets=None, registry=DEFAULT_REGISTRY):
    resolved_assets = resolved_assets or {}
    issues = []
    scenes = []
    for scene_index, scene in enumerate(plan.timeline):
        transition = scene.get("transitionOut", "cut")
        if transition not in registry.transitions:
            issues.append({"path": f"timeline.{scene_index}.transitionOut", "message": f"Transição desconhecida: {transition}"})
        layout = scene.get("layout", "fullscreen")
        layout_name = layout if isinstance(layout, str) else layout.get("preset") or layout.get("grid", "fullscreen")
        if layout_name not in registry.layouts:
            issues.append({"path": f"timeline.{scene_index}.layout", "message": f"Layout desconhecido: {layout_name}"})

        elements = []
        for element_index, element in enumerate(scene.get("elements", [])):
            prefix = f"timeline.{scene_index}.elements.{element_index}"
            element_type = element["type"]
            style = element.get("style")
            if element_type in {"text", "kinetic_text"} and style and style not in registry.text_styles:
                issues.append({"path": f"{prefix}.style", "message": f"Estilo de texto desconhecido: {style}"})
            if element_type == "caption" and style and style not in registry.caption_styles:
                issues.append({"path": f"{prefix}.style", "message": f"Estilo de legenda desconhecido: {style}"})
            if element_type == "overlay" and style and style not in registry.overlay_styles:
                issues.append({"path": f"{prefix}.style", "message": f"Estilo de overlay desconhecido: {style}"})
            for phase, motion in element.get("animation", {}).items():
                if motion not in registry.motions:
                    issues.append({"path": f"{prefix}.animation.{phase}", "message": f"Motion desconhecido: {motion}"})

            start = float(element.get("start", scene["start"]))
            end = float(element.get("end", scene["end"]))
            if element_type == "sfx":
                start = float(element.get("at", start))
                end = start
            asset_uri = element.get("asset")
            elements.append(ResolvedElement(
                type=element_type, start=start, end=end,
                z=int(element.get("z", element_index)),
                region=_region(element.get("cells"), plan.project.width, plan.project.height),
                asset_uri=asset_uri,
                asset_path=Path(resolved_assets[asset_uri]) if asset_uri in resolved_assets else None,
                data=element,
            ))
        scenes.append(ResolvedScene(
            id=scene["id"], start=float(scene["start"]), end=float(scene["end"]),
            transition_out=transition, elements=tuple(sorted(elements, key=lambda item: item.z)),
            background=scene.get("background", {}),
            background_path=(
                Path(resolved_assets[scene["background"]["asset"]])
                if scene.get("background", {}).get("asset") in resolved_assets else None
            ),
        ))
    if issues:
        raise PlanValidationError(issues)
    duration = max((scene.end for scene in scenes), default=0.0)
    return ResolvedTimeline(project=plan.project, scenes=tuple(scenes), duration=duration)
