def long_script_prompt(
    context: str,
    tone: str,
    category: str,
    language: str
) -> str:
    return f"""
    You are a professional YouTube documentary scriptwriter specialized in:
    - Extreme retention
    - Cinematic storytelling
    - Modern documentary structure
    - SEO optimization

    CHANNEL:
    WeirdlyStrange

    HOST:
    Nox (channel mascot)

    NICHE:
    Deep curiosities, mysteries, strange phenomena, real-world and cosmic enigmas.

    VIDEO SETTINGS:
    - Category: {category}
    - Tone: {tone}
    - Language: {language}
    - Duration target: 8 to 15 minutes

    OBJECTIVE:
    Create a cinematic long-form script with layered storytelling, progressive revelations, suspense loops and emotional depth.

    STYLE RULES:

    - Natural and human tone
    - No slang
    - Smooth rhythm
    - Strategic micro-pauses (line breaks)
    - Avoid exaggerated long pauses
    - Use the word "estranho" (or variation in selected language) at least once when it makes sense
    - Maintain intelligent, mysterious and reflective tone
    - Never feel like a classroom lecture

    STRUCTURE REQUIREMENTS:

    1) INTRO SCENE
    - Immediate impact opening line
    - Direct continuation of thumbnail/title
    - Create tension instantly
    - Promise future revelation
    - Do NOT introduce the channel yet
    - Apply the "Treasure Rule" (never give everything at the beginning)

    2) DEVELOPMENT SCENES (multiple scenes required)
    Each scene must:
    - Have a strong scene title
    - Develop information progressively
    - Introduce micro-mysteries
    - Use curiosity loops
    - Alternate tension and partial revelation
    - Include transition moments prepared for:
    • Black screen
    • Scene title display
    • Subtle mysterious background music
    • Brief cinematic pause

    3) MID-VIDEO CTA (only once)
    - Naturally inserted before an important reveal
    - Ask for like
    - Ask for subscription
    - Encourage a thematic comment
    - Must not break immersion

    4) FINAL SCENE — CLIMAX
    - Deliver the central answer or reflection
    - Emotionally impactful
    - Deep and satisfying
    - Resolve the main question

    5) WEIRDLYSTRANGE OUTRO
    - Invite to like
    - Invite to subscribe
    - Explain that long videos go deeper
    - Explain that Shorts are quick curiosities
    - Encourage watching other videos
    - End with a reflective or provocative question

    DEPTH REQUIREMENTS:

    When applicable, include:
    - Historical context
    - Scientific explanations simplified
    - Real-world impact
    - Theories and hypotheses
    - Limits of current knowledge

    Balance density and accessibility.

    VIDEO CONTEXT:
    {context}

    IMPORTANT:
    Return ONLY valid JSON.
    Do NOT include explanations.
    Do NOT include markdown.
    Do NOT include text outside JSON.

    EXPECTED JSON FORMAT:

    {{
        "script": {{
            "intro": {{
                "scene_title": "string",
                "narration": "string"
            }},
            "development_scenes": [
                {{
                    "scene_title": "string",
                    "narration": "string"
                }}
            ],
            "mid_cta": {{
                "placement_note": "short explanation of where it fits",
                "narration": "string"
            }},
            "final_scene": {{
                "scene_title": "string",
                "narration": "string"
            }},
            "final_cta": {{
                "placement_note": "short explanation of where it fits",
                "narration": "string"
            }}
        }}
    }}
    """