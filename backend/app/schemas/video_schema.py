from pydantic import BaseModel
from typing import TypedDict, Optional, List

class VideoGenerateRequest(BaseModel):
    context: str
    category: str = "entertainment"
    tone: str = "neutral"
    language: str = "pt-br"
    type: str = "short"

class VideoGenerateResponse(BaseModel):
    script: str
    title: str
    description: str
    tags: str

class VideoGraphState(TypedDict):
    request: VideoGenerateRequest
    script: Optional[str]
    metadata: Optional[dict]
    music: Optional[List[str]]
    thumbnail_prompt: Optional[str]