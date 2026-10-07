from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Optional, Tuple


@dataclass(frozen=True)
class ProjectSettings:
    name: str
    format: str
    profile: str
    width: int
    height: int
    fps: float
    seed: int = 0


@dataclass(frozen=True)
class EditPlan:
    version: str
    project: ProjectSettings
    sources: Mapping[str, Any]
    audio: Mapping[str, Any]
    timeline: Tuple[Mapping[str, Any], ...]
    source_path: Optional[Path] = None


@dataclass(frozen=True)
class ResolvedElement:
    type: str
    start: float
    end: float
    z: int
    region: Tuple[int, int, int, int]
    asset_uri: Optional[str] = None
    asset_path: Optional[Path] = None
    data: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ResolvedScene:
    id: str
    start: float
    end: float
    transition_out: str
    elements: Tuple[ResolvedElement, ...]
    background: Mapping[str, Any] = field(default_factory=dict)
    background_path: Optional[Path] = None


@dataclass(frozen=True)
class ResolvedTimeline:
    project: ProjectSettings
    scenes: Tuple[ResolvedScene, ...]
    duration: float
