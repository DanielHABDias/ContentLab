from pydantic import BaseModel
from typing import TypedDict, Optional, List, Union, Literal

class VideoGenerateRequest(BaseModel):
    context: str
    category: Literal["entertainment", "education", "comedy", "news"] = "entertainment"
    tone: Literal["neutral", "funny", "serious", "dramatic"] = "neutral"
    language: Literal["pt-br", "en-us"] = "pt-br"
    type: Literal["short", "long"] = "short"

class ShortVideoScript(BaseModel):
    hook: str
    context: str
    cta: str
    answer: Optional[str] = None
    closing: Optional[str] = None

class Scene(BaseModel):
    scene_title: str
    narration: str

class MidOrFinalCTA(BaseModel):
    placement_note: str
    narration: str

class LongVideoScript(BaseModel):
    intro: Scene
    development_scenes: List[Scene]
    mid_cta: Optional[MidOrFinalCTA] = None
    final_scene: Scene
    final_cta: Optional[MidOrFinalCTA] = None
    answer: Optional[str] = None
    closing: Optional[str] = None

class MusicRecommendation(BaseModel):
    name: str
    recommended_usage_moment: str
    url: str

class VideoGenerateResponse(BaseModel):
    script: Union[ShortVideoScript, LongVideoScript]
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str] = None
    music_recommendations: Optional[List[MusicRecommendation]] = None
    thumbnail_prompt: Optional[str] = None

class VideoGraphState(TypedDict):
    request: VideoGenerateRequest
    script: Optional[str]
    metadata: Optional[dict]
    music: Optional[List[str]]
    thumbnail_prompt: Optional[str]