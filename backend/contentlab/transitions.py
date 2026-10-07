"""Small, discoverable FFmpeg transition plugins."""

from dataclasses import dataclass
from importlib import import_module
from pkgutil import iter_modules
from typing import Optional


@dataclass(frozen=True)
class TransitionSpec:
    name: str
    ffmpeg_name: Optional[str]
    duration: float = 0.4


def discover_transitions():
    package = import_module(f"{__package__}.transition_plugins")
    found = {}
    for module in iter_modules(package.__path__):
        plugin = import_module(f"{package.__name__}.{module.name}")
        spec = getattr(plugin, "TRANSITION", None)
        if not isinstance(spec, TransitionSpec) or spec.name in found or spec.duration <= 0:
            raise ValueError(f"Plugin de transição inválido: {module.name}")
        found[spec.name] = spec
    return found
