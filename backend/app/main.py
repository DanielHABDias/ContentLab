from app.config import Config
from fastapi import FastAPI
from app.routes import videos
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "status": "error",
            "message": "Dados inválidos. Verifique o formato enviado.",
            "details": exc.errors() 
        }
    )


app.include_router(videos.router)

@app.get("/")
def root():
    return {
        "status": "success",
        "message": "ContentLab API running 🚀"
    }