from pathlib import Path

def generate_srt(segments, clip_start, clip_end, output_path):
    index = 1
    lines = []

    for seg in segments:
        if seg["start"] >= clip_start and seg["end"] <= clip_end:
            start = seg["start"] - clip_start
            end = seg["end"] - clip_start

            lines.append(f"{index}")
            lines.append(f"{format_time(start)} --> {format_time(end)}")
            lines.append(seg["text"].strip())
            lines.append("")
            index += 1

    Path(output_path).write_text("\n".join(lines), encoding="utf-8")


def format_time(seconds):
    ms = int((seconds % 1) * 1000)
    s = int(seconds)
    h = s // 3600
    m = (s % 3600) // 60
    s = s % 60
    return f"{h:02}:{m:02}:{s:02},{ms:03}"
