from app.config import Config
from fastapi import FastAPI
from app.routes import videos
from fastapi.middleware.cors import CORSMiddleware

settings = Config()
settings.validate()

app = FastAPI(
    title="ContentLab API",
    version="0.0.1",
    description="API para ContentLab",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(videos.router)

@app.get("/")
def root():
    return {
        "status": "success",
        "message": "ContentLab API running 🚀"
    }