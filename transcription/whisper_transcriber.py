import whisper

def transcribe(chunks, cfg, logger):
    model = whisper.load_model(cfg["model"])
    segments = []

    for chunk in chunks:
        logger.info(f"Transcribing {chunk.name}")
        result = model.transcribe(
            str(chunk),
            language=cfg["language"],
            word_timestamps=cfg["word_timestamps"],
            condition_on_previous_text=cfg["condition_on_previous_text"]
        )
        segments.extend(result["segments"])

    return segments
