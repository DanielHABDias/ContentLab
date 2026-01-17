import subprocess
from pathlib import Path

def split_audio(audio_path, output_dir, chunk_minutes, max_runs):
    chunk_seconds = chunk_minutes * 60
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for i in range(max_runs):
        output = output_dir / f"chunk_{i+1}.wav"
        subprocess.run([
            "ffmpeg", "-y",
            "-i", str(audio_path),
            "-ss", str(i * chunk_seconds),
            "-t", str(chunk_seconds),
            str(output)
        ])
        if output.exists():
            yield output
        else:
            break
