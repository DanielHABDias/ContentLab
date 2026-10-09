"""Reproducible 60-second synthetic MVP integration check.

Run: python -m tests.mvp_acceptance
Requires FFmpeg, FFprobe and Pillow. Keeps its generated project in /tmp.
"""

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

from backend.contentlab.project import inspect_project, render_project
from backend.contentlab.render import render_edit_plan


def _run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-1800:])


def _probe(path, ffprobe):
    result = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


def build_fixture(root, ffmpeg):
    assets = root / "assets"
    audio = root / "audio"
    assets.mkdir()
    audio.mkdir()
    for name, color in (("clip_a", "purple"), ("clip_b", "blue"), ("nox", "gray")):
        _run(ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"color=c={color}:s=320x180:r=30:d=15", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(assets / f"{name}.mp4"))
    _run(ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=green:s=320x180:r=30:d=15", "-vf", "drawbox=x=105:y=45:w=110:h=90:color=red:t=fill", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(assets / "cta.mp4"))
    for index, color in enumerate(("red", "blue", "green"), 1):
        image = Image.new("RGB", (240, 360), color)
        ImageDraw.Draw(image).rectangle((30, 30, 210, 330), outline="white", width=5)
        image.save(assets / f"character_{index}.png")
    for name, freq, duration in (("narration", 440, 60), ("music", 220, 60), ("impact", 880, 1)):
        _run(ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"sine=frequency={freq}:duration={duration}", "-c:a", "pcm_s16le", str(audio / f"{name}.wav"))
    words = []
    for index, word in enumerate("herói volta agora".split()):
        words.append({"word": word, "start": 7 + index, "end": 7.75 + index})
    for index, word in enumerate("Nox apresenta o próximo capítulo desta história".split()):
        words.append({"word": word, "start": 17 + index, "end": 17.75 + index})
    (root / "transcript.json").write_text(json.dumps({"words": words}, ensure_ascii=False), encoding="utf-8")
    plan = {
        "version": "0.1",
        "project": {"name": "mvp-60s", "format": "custom", "profile": "generic", "resolution": {"width": 640, "height": 360}, "fps": 30},
        "sources": {"assets": "assets", "transcript": "transcript.json"},
        "audio": {"narration": "audio/narration.wav", "music": [{"asset": "project://audio/music.wav", "start": 0, "end": 60, "preset": "subtle", "fadeIn": 1, "fadeOut": 1}]},
        "timeline": [
            {"id": "intro", "start": 0, "end": 15, "layout": "fullscreen", "elements": [
                {"type": "video", "asset": "project://assets/clip_a.mp4", "fit": "cover", "loop": True},
                {"type": "text", "text": "CONTENT LAB", "style": "impact", "start": 1, "end": 6},
                {"type": "kinetic_text", "text": "herói volta agora", "style": "word_pop", "sync": "transcript", "start": 7, "end": 11},
            ], "transitionOut": "fade"},
            {"id": "nox", "start": 15, "end": 30, "layout": "nox", "background": {"color": "#10131B"}, "elements": [
                {"type": "video", "asset": "project://assets/nox.mp4", "loop": True},
                {"type": "caption", "style": "anton_karaoke", "start": 16, "end": 28, "range": {"start": 16, "end": 28}},
            ], "transitionOut": "blur_left"},
            {"id": "grid", "start": 30, "end": 45, "layout": "three_columns", "background": {"color": "#111111"}, "elements": [
                {"type": "image", "asset": "project://assets/character_1.png", "box": {"padding": 8, "radius": 12, "shadow": "soft"}},
                {"type": "image", "asset": "project://assets/character_2.png"},
                {"type": "image", "asset": "project://assets/character_3.png"},
            ], "transitionOut": "cut"},
            {"id": "cta", "start": 45, "end": 60, "layout": "fullscreen", "elements": [
                {"type": "video", "asset": "project://assets/clip_b.mp4", "fit": "cover", "loop": True},
                {"type": "overlay", "asset": "project://assets/cta.mp4", "start": 48, "end": 58, "loop": True, "config": {"keyColor": "0x008000", "similarity": 0.25}},
                {"type": "sfx", "asset": "project://audio/impact.wav", "at": 52, "config": {"duration": 0.4}},
            ]},
        ],
    }
    (root / "edit_plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise SystemExit("FFmpeg e FFprobe são necessários para o aceite sintético.")
    root = Path(tempfile.mkdtemp(prefix="contentlab-mvp-60s-"))
    build_fixture(root, ffmpeg)
    project = inspect_project(str(root))
    assert project["validation"]["valid"], project["validation"]
    final = render_project(str(root), "final", ffmpeg_dir=Path(ffmpeg).parent, use_cache=False)
    rough = render_edit_plan(root / "edit_plan.json", output_dir=root / "output" / "rough", project_root=root, ffmpeg_dir=Path(ffmpeg).parent)
    assert Path(rough["output"]).name == "rough_cut.mp4"
    assert (root / "output" / "rough" / "render_report.json").is_file()
    cached = render_project(str(root), "final", ffmpeg_dir=Path(ffmpeg).parent)
    assert cached["cacheHit"] is True
    info = _probe(final["output"], ffprobe)
    streams = {stream["codec_type"]: stream for stream in info["streams"]}
    assert abs(float(info["format"]["duration"]) - 60) < 0.2, info
    assert streams["video"]["codec_name"] == "h264" and streams["audio"]["codec_name"] == "aac", info
    assert streams["video"]["width"] == 640 and streams["video"]["height"] == 360, info
    assert streams["video"]["r_frame_rate"] == "30/1", info
    assert len(final["transitions"]) == 2 and len(final["audioLayers"]) == 2, final
    frames = root / "frames"
    frames.mkdir()
    for second in (3, 8.3, 18, 35, 53):
        _run(ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(second), "-i", final["output"], "-frames:v", "1", str(frames / f"{second}.png"))
    for second, minimum in ((3, 2000), (8.3, 500), (18, 500)):
        picture = Image.open(frames / f"{second}.png").convert("RGB")
        bright = sum(1 for y in range(picture.height) for x in range(picture.width) if min(picture.getpixel((x, y))) > 210)
        assert bright > minimum, (second, bright)
    grid = Image.open(frames / "35.png").convert("RGB")
    left, middle, right = (grid.getpixel((x, 180)) for x in (100, 320, 540))
    assert left[0] > left[2] and middle[2] > middle[0] and right[1] > right[0], (left, middle, right)
    cta = Image.open(frames / "53.png").convert("RGB").getpixel((320, 180))
    assert cta[0] > cta[1] * 2 and cta[0] > cta[2] * 2, cta
    print(json.dumps({"status": "passed", "projectRoot": str(root), "final": final["output"], "rough": rough["output"], "frames": str(frames), "finalSeconds": final["elapsedSeconds"], "cacheHit": cached["cacheHit"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
