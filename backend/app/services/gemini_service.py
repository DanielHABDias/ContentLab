from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda
from google.api_core.exceptions import ResourceExhausted, PermissionDenied
import os

class GeminiServiceError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"GeminiServiceError {status_code}: {message}")

class GeminiService:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash-lite",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )

    def generate_text(self, prompt: str):
        try:
            chain = (
                RunnableLambda(lambda _: prompt)
                | self.llm
                | StrOutputParser()
            )

            response = chain.invoke({})
        except ResourceExhausted:
            raise GeminiServiceError(402, "Cota do Gemini esgotada")
        except PermissionDenied:
            raise GeminiServiceError(403, "Problema de billing ou permissão")
        except Exception as e:
            raise GeminiServiceError(500, f"Erro inesperado: {str(e)}")
        return response