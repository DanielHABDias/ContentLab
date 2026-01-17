import google.generativeai as genai
import json
import re

def clean_json(text: str) -> str:
    """
    Remove markdown, ```json, ``` e texto extra
    """
    text = text.strip()

    text = re.sub(r"```json", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```", "", text)

    match = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
    if match:
        return match.group(0)

    return text


def call_gemini(prompt, cfg, logger):
    for key in cfg["api_keys"]:
        genai.configure(api_key=key)

        model = genai.GenerativeModel(
            model_name=cfg["model"],
            generation_config={
                "temperature": 0.6,
                "max_output_tokens": cfg.get("max_tokens", 1500)
            }
        )

        for attempt in range(1, cfg["max_retries_per_key"] + 1):
            try:
                logger.info(
                    f"Calling Gemini (key={key[:6]}*** attempt={attempt})"
                )

                response = model.generate_content(prompt)
                raw_text = response.text

                clean_text = clean_json(raw_text)
                return json.loads(clean_text)

            except json.JSONDecodeError as e:
                logger.error(
                    "Gemini returned invalid JSON",
                    exc_info=True
                )

            except Exception as e:
                logger.warning(
                    f"Gemini error with key {key[:6]}***: {e}"
                )

    raise RuntimeError("All Gemini API keys failed")