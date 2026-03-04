import re, json

def clean_json(json_string: str) -> str:
    cleaned = re.sub(r"^```json\s*|\s*```$", "", json_string.strip())
    data = json.loads(cleaned)
    return data