def thumbnail_prompt(
    script: dict,
    context: str,
    tone: str,
    category: str,
    language: str
) -> str:
    return f"""
    You are a professional YouTube thumbnail concept designer.

    Your task is to create a highly detailed AI image generation prompt in english for a cinematic YouTube thumbnail.

    VIDEO SETTINGS:
    - Script content: {script.get('content', '')}
    - Context: {context}
    - Tone: {tone}
    - Category: {category}
    - Language: {language}

    RULES:

    - NO text inside the image.
    - Extremely high curiosity.
    - Strong emotion or mystery.
    - Must visually match the topic.
    - If mystery/horror → darker tones, dramatic lighting.
    - If scientific → strong contrast, dramatic highlights.
    - Focus on facial emotion, symbolism, or dramatic composition.
    - Designed for high CTR.

    Return ONLY valid JSON.
    Do NOT include explanations.
    Do NOT include markdown.
    Do NOT include text outside JSON.

    EXPECTED FORMAT:

    {{
        "thumbnail_prompt": "highly detailed cinematic AI image prompt"
    }}
    """