from dataclasses import dataclass
from typing import FrozenSet


@dataclass(frozen=True)
class Registry:
    layouts: FrozenSet[str]
    transitions: FrozenSet[str]
    motions: FrozenSet[str]
    text_styles: FrozenSet[str]
    caption_styles: FrozenSet[str]
    overlay_styles: FrozenSet[str]


DEFAULT_REGISTRY = Registry(
    layouts=frozenset({"fullscreen", "left_right", "three_columns", "character_vs", "nox", "custom_grid", "3x3"}),
    transitions=frozenset({"cut", "fade", "blur_left", "blur_right", "blur_up", "zoom_blur"}),
    motions=frozenset({"cut", "none", "fade", "fade_out", "slide_up", "pop_in", "float_soft", "slow_zoom_in", "slow_zoom_out", "pan", "pulse_soft"}),
    text_styles=frozenset({"impact", "impact_yellow", "word_pop", "paper_word", "versus_big"}),
    caption_styles=frozenset({"anton_karaoke"}),
    overlay_styles=frozenset({"green_screen", "green_screen_default", "green_screen_soft"}),
)


def describe_registry(registry=DEFAULT_REGISTRY):
    return {
        "layouts": sorted(registry.layouts),
        "transitions": sorted(registry.transitions),
        "motions": sorted(registry.motions),
        "text_styles": sorted(registry.text_styles),
        "caption_styles": sorted(registry.caption_styles),
        "overlay_styles": sorted(registry.overlay_styles),
    }
