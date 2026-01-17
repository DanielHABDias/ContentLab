import subprocess

def extract_audio(video_path, output_audio):
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-ac", "1",
        "-ar", "16000",
        str(output_audio)
    ], check=True)
