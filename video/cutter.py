import subprocess
from pathlib import Path

def cut_video(video_path, clip, output_dir, index, cfg, srt_path=None):
    output_dir = Path(output_dir)
    output_file = output_dir / f"clip_{index}.mp4"

    filters = []

    # Crop para 9:16
    if cfg["video"]["aspect_ratio"] == "9:16":
        filters.append(
            "crop=in_h*9/16:in_h:(in_w-in_h*9/16)/2:0"
        )

    # Burn subtitles
    if cfg["video"]["burn_subtitles"] and srt_path:
        filters.append(f"subtitles={srt_path}")

    vf = ",".join(filters)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-ss", str(clip["start_time"]),
        "-to", str(clip["end_time"]),
        "-vf", vf,
        "-c:a", "aac",
        str(output_file)
    ]

    subprocess.run(cmd, check=True)
