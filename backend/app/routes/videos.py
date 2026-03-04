from fastapi import APIRouter, HTTPException
from app.schemas.video_schema import VideoGenerateRequest, VideoGenerateResponse
from app.services.video_generate_service import VideoGenerateService
from app.services.gemini_service import GeminiService, GeminiServiceError

router = APIRouter(
    prefix="/videos",
    tags=["Videos"]
)

@router.get("/")
async def get_videos():
    return {"message": "Rota para ações relacionadas a vídeos."}

@router.post("/generate", response_model=VideoGenerateResponse)
async def generate_video(data: VideoGenerateRequest):
    try:
        gemini = GeminiService()
        generator = VideoGenerateService(gemini)
        response = await generator.generate(data)
        return response
    except GeminiServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))