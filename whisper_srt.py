import whisper


def format_time(t):
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int((t - int(t)) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def generate_srt(video_path, output_srt):
    print("Carregando modelo Whisper...")
    model = whisper.load_model("small")

    print("Transcrevendo áudio...")
    result = model.transcribe(video_path, language="pt")

    with open(output_srt, "w", encoding="utf-8") as f:
        for i, seg in enumerate(result["segments"], start=1):
            start = format_time(seg["start"])
            end = format_time(seg["end"])
            text = seg["text"].strip()

            f.write(f"{i}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{text}\n\n")

    print("Legenda SRT gerada.")
