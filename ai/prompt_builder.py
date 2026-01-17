def build_prompt(base, instructions, transcript):
    rules = "\n".join(f"- {i}" for i in instructions)
    text = "\n".join(
        f"[{s['start']:.2f}-{s['end']:.2f}] {s['text']}"
        for s in transcript
    )

    return f"""{base}

Rules:
{rules}

Transcript excerpt:
{text}

Return ONLY valid JSON:
[
  {{
    "start_time": 120,
    "end_time": 165,
    "title": "Title here",
    "hashtags": ["#viral", "#shorts"]
  }}
]
"""