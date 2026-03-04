from langchain_google_genai import ChatGoogleGenerativeAI
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
            response = self.llm.invoke(prompt).content
        except Exception as e:
            raise GeminiServiceError(500, f"Falha ao gerar texto: {str(e)}")
        return response