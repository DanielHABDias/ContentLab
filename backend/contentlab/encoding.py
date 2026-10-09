"""Conservative H.264 encoder selection with a real one-frame capability probe."""

import os
import subprocess


NVENC_H264 = ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "18"]


def _software_h264():
    threads = max(1, int(os.environ.get("CONTENTLAB_FFMPEG_THREADS", "2")))
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", str(threads)]


def select_h264_encoder(ffmpeg, hardware_accel=False):
    if not hardware_accel:
        return _software_h264(), "libx264", None
    command = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
        "color=c=black:s=64x64:r=1:d=1", "-frames:v", "1", *NVENC_H264,
        "-f", "null", "-",
    ]
    try:
        result = subprocess.run(
            command, capture_output=True, text=True, timeout=15,
            creationflags=0x08000000 if os.name == "nt" else 0,
        )
        if result.returncode == 0:
            return NVENC_H264, "h264_nvenc", None
    except (OSError, subprocess.TimeoutExpired):
        pass
    return _software_h264(), "libx264", {
        "code": "hardware_encoder_unavailable",
        "message": "NVENC não está disponível; render executado com libx264.",
    }
