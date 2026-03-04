def music_recommendation_prompt(
    script: dict,
    context: str,
    tone: str,
    category: str,
    language: str,
    type: str
) -> str:
    return f"""
    You are a YouTube soundtrack specialist.

    Your task is to recommend royalty-free music suitable for a YouTube video.

    VIDEO SETTINGS:
    - Script content: {script.get('content', '')}
    - Context: {context}
    - Tone: {tone}
    - Category: {category}
    - Language: {language}
    - Type: {type}

    INSTRUCTIONS:

    - Suggest exactly 5 royalty-free tracks.
    - Prioritize YouTube Audio Library style.
    - Music must match the emotional tone.
    - If the video is mysterious → suggest cinematic/mysterious music.
    - If emotional → suggest atmospheric/ambient music.
    - If intense → suggest dramatic builds.

    For each suggestion provide:
    - Track name
    - Style/genre
    - Emotional mood
    - Recommended usage moment (intro, suspense build, climax, outro)

    Return ONLY valid JSON.
    Do NOT include explanations.
    Do NOT include markdown.
    Do NOT include text outside JSON.

    EXPECTED FORMAT:

    {{
        "music_recommendations": [
            {{
                "name": "Track name",
                "recommended_usage_moment": "Recommended usage moment"
                "url": "Track URL"
            }}
        ]
    }}
    """