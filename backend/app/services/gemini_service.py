from langchain_google_genai import ChatGoogleGenerativeAI
import os

class GeminiService:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash-lite",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )

    def generate_text(self, prompt: str):
        return self.llm.invoke(prompt).content