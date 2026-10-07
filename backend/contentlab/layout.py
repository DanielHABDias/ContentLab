from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from .errors import PlanValidationError


LAYOUT_CELLS = {
    "three_columns": ((1, 4, 7), (2, 5, 8), (3, 6, 9)),
    "character_vs": ((1, 4, 7), (3, 6, 9)),
    "left_right": ((1, 4, 7), (3, 6, 9)),
    "nox": ((2, 5, 8),),
}


def cells_for_layout(layout, index):
    name = layout if isinstance(layout, str) else layout.get("preset") or layout.get("grid")
    groups = LAYOUT_CELLS.get(name, ())
    return groups[index] if index < len(groups) else None


def box_geometry(element):
    x, y, width, height = element.region
    box = element.data.get("box") or {}
    if isinstance(box, str):
        box = {"preset": box}
    if box.get("preset") == "floating_card":
        box = {"padding": 20, "radius": 28, "shadow": "soft", **box}
    padding = round(box.get("padding", 0))
    radius = round(box.get("radius", 0))
    if padding < 0 or padding * 2 >= min(width, height):
        raise PlanValidationError([{"path": "box.padding", "message": "Padding não cabe na região do elemento."}])
    content = (x + padding, y + padding, width - 2 * padding, height - 2 * padding)
    return box, content, max(0, min(radius, min(content[2:]) // 2))


def create_card_assets(element, output_dir, name):
    box, content, radius = box_geometry(element)
    if not box or not (radius or box.get("shadow") not in (None, "none") or box.get("background")):
        return None, None
    _, _, width, height = content
    output_dir = Path(output_dir)
    mask_path = output_dir / f"{name}-mask.png"
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)
    mask.save(mask_path)

    backing_path = None
    if box.get("shadow") not in (None, "none") or box.get("background"):
        padding = round(box.get("padding", 0))
        card_width, card_height = element.region[2:]
        backing = Image.new("RGBA", (card_width, card_height), (0, 0, 0, 0))
        if box.get("shadow") not in (None, "none"):
            shadow = Image.new("RGBA", backing.size, (0, 0, 0, 0))
            ImageDraw.Draw(shadow).rounded_rectangle(
                (padding + 4, padding + 8, padding + width + 3, padding + height + 7),
                radius=radius, fill=(0, 0, 0, 130),
            )
            backing.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)))
        if box.get("background"):
            ImageDraw.Draw(backing).rounded_rectangle(
                (padding, padding, padding + width - 1, padding + height - 1),
                radius=radius, fill=box["background"],
            )
        backing_path = output_dir / f"{name}-backing.png"
        backing.save(backing_path)
    return mask_path, backing_path
