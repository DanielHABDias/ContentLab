import google.generativeai as genai
import json

def call_gemini(prompt, cfg, logger):
    for key in cfg["api_keys"]:
        genai.configure(api_key=key)
        model = genai.GenerativeModel(cfg["model"])

        for attempt in range(cfg["max_retries_per_key"]):
            try:
                response = model.generate_content(prompt)
                return json.loads(response.text)
            except Exception as e:
                logger.warning(f"Gemini error with key {key}: {e}")

    raise RuntimeError("All Gemini API keys failed")
