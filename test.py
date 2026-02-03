import subprocess
from config import *

try:
    result = subprocess.run(
        ["ffmpeg", "-version"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✅ FFmpeg encontrado!")
        print(result.stdout.splitlines()[0])
    else:
        print("❌ FFmpeg não executou corretamente.")
        print(result.stderr)

except FileNotFoundError:
    print("❌ FFmpeg não encontrado no PATH.")