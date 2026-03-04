from app.services.gemini_service import GeminiService
from app.schemas.video_schema import VideoGenerateRequest, VideoGenerateResponse, VideoGraphState, MusicRecommendation
from langgraph.graph import StateGraph, END
from app.prompts.long_script_prompt import long_script_prompt
from app.prompts.short_script_prompt import short_script_prompt
from app.prompts.video_metadata_prompt import video_metadata_prompt
from app.prompts.music_recommendation_prompt import music_recommendation_prompt
from app.prompts.thumbnail_prompt import thumbnail_prompt
from app.utils.json_utils import clean_json

class VideoGenerateService:
    def __init__(self, gemini_service: GeminiService):
        self.gemini_service = gemini_service
        self.graph = self._build_graph()
    
    async def generate(self, request: VideoGenerateRequest) -> VideoGenerateResponse :
        initial_state = {
            "request": request,
            "script": None,
            "title": None,
            "description": None,
            "tags": None,
            "music_recommendations": None,
            "thumbnail_prompt": None
        }

        result = await self.graph.ainvoke(initial_state)

        return VideoGenerateResponse(**result)

    async def _generate_script(self, state: VideoGraphState):
        request = state["request"]

        if request.type == "short":
            prompt = short_script_prompt(request.context, request.tone, request.category, request.language)
        else:
            prompt = long_script_prompt(request.context, request.tone, request.category, request.language)

        response = self.gemini_service.generate_text(prompt)

        return {"script": clean_json(response)}
    
    async def _generate_metadata(self, state: VideoGraphState):
        request = state["request"]
        script = state["script"]

        script_text = self._extract_script_text(script, request.type)

        prompt = video_metadata_prompt({"content": script_text}, request.context, request.tone, request.category, request.language, request.type)

        response = self.gemini_service.generate_text(prompt)

        return clean_json(response)
    
    async def _suggest_music(self, state: VideoGraphState):
        request = state["request"]
        script = state["script"]

        script_text = self._extract_script_text(script, request.type)

        prompt = music_recommendation_prompt({"content": script_text}, request.context, request.tone, request.category, request.language, request.type)

        response = self.gemini_service.generate_text(prompt)

        music_list = clean_json(response).get("music_recommendations", [])

        return {"music_recommendations": [MusicRecommendation(**m) for m in music_list]}
    
    async def _generate_thumbnail(self, state: VideoGraphState):
        request = state["request"]
        script = state["script"]

        script_text = self._extract_script_text(script, request.type)

        prompt = thumbnail_prompt({"content": script_text}, request.context, request.tone, request.category, request.language)
        
        response = self.gemini_service.generate_text(prompt)

        return clean_json(response)
    
    def _should_generate_thumbnail(self, state: VideoGraphState):
        request = state["request"]
        if request.type == "short":
            return False
        return True
    
    def _extract_script_text(self, script: dict, type: str) -> str:
        if type == "short":
            parts = [
                script.get("hook", ""),
                script.get("context", ""),
                script.get("cta", ""),
                script.get("answer", ""),
                script.get("closing", "")
            ]
            return "\n".join([p for p in parts if p])

        else:
            parts = []
            intro = script.get("intro", {})
            if intro:
                parts.append(intro.get("scene_title", ""))
                parts.append(intro.get("narration", ""))

            development = script.get("development_scenes", [])
            for scene in development:
                parts.append(scene.get("scene_title", ""))
                parts.append(scene.get("narration", ""))

            mid_cta = script.get("mid_cta", {})
            if mid_cta:
                parts.append(mid_cta.get("placement_note", ""))
                parts.append(mid_cta.get("narration", ""))

            final_scene = script.get("final_scene", {})
            if final_scene:
                parts.append(final_scene.get("scene_title", ""))
                parts.append(final_scene.get("narration", ""))

            final_cta = script.get("final_cta", {})
            if final_cta:
                parts.append(final_cta.get("placement_note", ""))
                parts.append(final_cta.get("narration", ""))

            extra = script.get("answer", "") + "\n" + script.get("closing", "")
            if extra.strip():
                parts.append(extra.strip())

            return "\n".join([p for p in parts if p])

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