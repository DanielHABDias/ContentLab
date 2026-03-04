def video_metadata_prompt(
    script: dict,
    context: str,
    tone: str,
    category: str,
    language: str,
    type: str
) -> str:
    return f"""
    You are a YouTube SEO optimization expert.

    Your task is to generate optimized metadata for a YouTube video.

    VIDEO SETTINGS:
    - Script content: {script.get('content', '')}
    - Context: {context}
    - Tone: {tone}
    - Category: {category}
    - Language: {language}
    - Type: {type}

    TITLE RULES:
    - Highly clickable.
    - Curiosity-driven.
    - Some strategic words in UPPERCASE (e.g., WHY, HOW, SECRET, MYSTERY).
    - Must NOT reveal the answer.
    - If video_type is "short", include #shorts.
    - May include emojis (moderately).

    DESCRIPTION RULES:
    - SEO optimized.
    - Introduce the topic clearly.
    - If long video → mention WeirdlyStrange and Nox.
    - Encourage subscription and engagement.
    - Include relevant hashtags at the end.
    - Must NOT reveal the answer.

    TAGS RULES:
    - Comma-separated.
    - No hashtags.
    - Optimized for algorithm reach.
    - If short → must include "shorts".
    - If long → include when possible: vocesabia, fatosdesconhecidos.
    - Do NOT mention AI in tags.

    Return ONLY valid JSON.
    Do NOT include explanations.
    Do NOT include markdown.
    Do NOT include text outside JSON.

    EXPECTED FORMAT:

    {{
        "title": "string",
        "description": "string",
        "tags": "tag1, tag2, tag3"
    }}
    """