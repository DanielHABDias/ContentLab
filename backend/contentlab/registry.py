from dataclasses import dataclass
from typing import FrozenSet
from .transitions import discover_transitions


@dataclass(frozen=True)
class Registry:
    layouts: FrozenSet[str]
    transitions: FrozenSet[str]
    motions: FrozenSet[str]
    text_styles: FrozenSet[str]
    caption_styles: FrozenSet[str]
    overlay_styles: FrozenSet[str]
    filter_styles: FrozenSet[str]


DEFAULT_REGISTRY = Registry(
    layouts=frozenset({"fullscreen", "left_right", "three_columns", "character_vs", "nox", "custom_grid", "3x3"}),
    transitions=frozenset(discover_transitions()),
    motions=frozenset({"cut", "none", "fade", "fade_out", "slide_up", "pop_in", "float_soft", "wiggle_soft", "slow_zoom_in", "slow_zoom_out", "pan", "pulse_soft"}),
    text_styles=frozenset({"impact", "impact_yellow", "word_pop", "paper_word", "versus_big", "anton", "bangers", "word_stack_vertical"}),
    caption_styles=frozenset({"anton_karaoke", "bangers_highlight_block"}),
    overlay_styles=frozenset({"green_screen", "green_screen_default", "green_screen_soft"}),
    filter_styles=frozenset({"dim", "crt_tv"}),
)


def describe_registry(registry=DEFAULT_REGISTRY):
    return {
        "edit_plan_versions": ["0.1", "0.2"],
        "layouts": sorted(registry.layouts),
        "transitions": sorted(registry.transitions),
        "motions": sorted(registry.motions),
        "motion_v0.2_enter": ["cut", "none", "fade", "pop_in", "slide_from_left", "slide_from_right", "slide_up", "slide_down"],
        "motion_v0.2_idle": ["none", "float_soft", "wiggle_soft", "pulse_soft", "slow_zoom_in", "slow_zoom_out", "pan"],
        "motion_v0.2_exit": ["cut", "none", "fade", "fade_out", "slide_to_left", "slide_to_right", "slide_to_bottom"],
        "text_styles": sorted(registry.text_styles),
        "caption_styles": sorted(registry.caption_styles),
        "overlay_styles": sorted(registry.overlay_styles),
        "filter_styles": sorted(registry.filter_styles),
    }
