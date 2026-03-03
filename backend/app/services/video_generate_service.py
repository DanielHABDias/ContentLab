from app.services.gemini_service import GeminiService
from app.schemas.video_schema import VideoGenerateRequest, VideoGenerateResponse, VideoGraphState
from langgraph.graph import StateGraph, END
from langchain_core.runnables import RunnableLambda

class VideoGenerateService:
    def __init__(self, gemini_service: GeminiService):
        self.gemini_service = gemini_service
    
    async def generate_full_video_package(self, request: VideoGenerateRequest):
        initial_state = {
            "request": request,
            "script": None,
            "metadata": None,
            "music": None,
            "thumbnail_prompt": None
        }

        result = await self.graph.ainvoke(initial_state)

        return result

    async def _generate_script(self, state: VideoGraphState):
        request = state["request"]

        if request.type == "short":
            base_prompt = self._short_script_prompt()
        else:
            base_prompt = self._long_script_prompt()

        prompt = f"""
        {base_prompt}

        CONTEXTO:
        {request.context}
        """

        response = await self.llm.ainvoke(prompt)

        return {"script": response.content}
    
    async def _generate_metadata(self, state: VideoGraphState):
        request = state["request"]

        if request.type == "short":
            base_prompt = self._short_metadata_prompt()
        else:
            base_prompt = self._long_metadata_prompt()

        prompt = f"""
        {base_prompt}

        CONTEXTO:
        {request.context}
        """

        response = await self.llm.ainvoke(prompt)

        return {"metadata": {"raw": response.content}}
    
    async def _suggest_music(self, state: VideoGraphState):
        request = state["request"]

        prompt = f"""
        Sugira 5 músicas sem copyright da YouTube Audio Library
        para um vídeo sobre:

        {request.context}

        Tom: {request.tone}
        Tipo: {request.type}

        Retorne lista simples.
        """

        response = await self.llm.ainvoke(prompt)

        return {"music": response.content}
    
    async def _generate_thumbnail(self, state: VideoGraphState):
        request = state["request"]

        prompt = f"""
        Gere um prompt para thumbnail cinematográfica.

        Sem texto.
        Alta curiosidade.
        Baseado em:

        {request.context}
        """

        response = await self.llm.ainvoke(prompt)

        return {"thumbnail_prompt": response.content}
    
    def _build_graph(self):
        workflow = StateGraph(VideoGraphState)

        workflow.add_node("script", self._generate_script)
        workflow.add_node("metadata", self._generate_metadata)
        workflow.add_node("music", self._suggest_music)
        workflow.add_node("thumbnail", self._generate_thumbnail)

        workflow.set_entry_point("script")

        workflow.add_edge("script", "metadata")
        workflow.add_edge("metadata", "music")

        workflow.add_conditional_edges(
            "music",
            self._should_generate_thumbnail,
            {
                "thumbnail": "thumbnail",
                END: END
            }
        )

        workflow.add_edge("thumbnail", END)

        return workflow.compile()