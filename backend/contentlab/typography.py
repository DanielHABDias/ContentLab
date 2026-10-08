"""Bundled display fonts and per-element text appearance."""

import sys
from pathlib import Path


FONT_FILES = {"Anton": "Anton-Regular.ttf", "Bangers": "Bangers-Regular.ttf"}


def bundled_font_path(family):
    filename = FONT_FILES.get(family)
    if not filename:
        return None
    root = Path(sys._MEIPASS) if getattr(sys, "_MEIPASS", None) else Path(__file__).resolve().parents[2]
    path = root / "builtin-assets" / "fonts" / filename
    return path if path.is_file() else None


def appearance(data):
    preset = data.get("style")
    custom = data.get("textStyle") or {}
    family = custom.get("fontFamily") or ("Anton" if preset in {"anton", "anton_white", "anton_karaoke"} else "Bangers" if preset in {"bangers", "bangers_highlight_block"} else None)
    return {
        "fontFamily": family,
        "uppercase": bool(custom.get("uppercase", preset in {"anton_white", "bangers", "bangers_highlight_block"})),
        "color": custom.get("color"),
        "outlineColor": custom.get("outlineColor"),
        "outlineWidth": custom.get("outlineWidth"),
        "shadow": custom.get("shadow"),
    }
