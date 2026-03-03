from fastapi import APIRouter
from app.schemas.video_schema import VideoGenerateRequest, VideoGenerateResponse
from app.services.video_generate_service import VideoGenerateService
from app.services.gemini_service import GeminiService

router = APIRouter(
    prefix="/videos",
    tags=["Videos"]
)

@router.get("/")
async def get_videos():
    return {"message": "Rota para ações relacionadas a vídeos."}

@router.post("/generate")
async def generate_video(data: VideoGenerateRequest):
    gemini = GeminiService()
    generator = VideoGenerateService(gemini)
    response = await generator.generate(data)
    return response