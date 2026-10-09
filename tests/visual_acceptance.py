"""Render deterministic visual fixtures for Iris/coding-agent inspection.

Run:
    python -m tests.visual_acceptance

The generated artifacts live in .visual-tests/ and are intentionally ignored by git.
Start the Flask app afterwards and open http://127.0.0.1:5000/visual-tests.
"""

import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

from backend.contentlab.project import render_project
from backend.contentlab.service import validate_edit_plan


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / ".visual-tests"
PROJECT_ROOT = OUTPUT_ROOT / "project"


def _run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-2400:])
    return result


def _image(path, color, label):
    image = Image.new("RGBA", (420, 540), color)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((18, 18, 402, 522), radius=30, outline="white", width=9)
    draw.rectangle((55, 390, 365, 470), fill=(0, 0, 0, 180))
    draw.text((90, 420), label, fill="white")
    image.save(path)


def _build_fixture(ffmpeg):
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    assets = PROJECT_ROOT / "assets"
    audio = PROJECT_ROOT / "audio"
    assets.mkdir(parents=True)
    audio.mkdir()

    _run(
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "testsrc2=size=960x540:rate=30:duration=6",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", str(assets / "base.mp4"),
    )
    _run(
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-t", "34", "-c:a", "pcm_s16le", str(audio / "narration.wav"),
    )

    badge = Image.new("RGBA", (520, 240), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle((10, 10, 510, 230), radius=48, fill=(230, 52, 70, 255), outline="white", width=10)
    draw.text((165, 105), "PNG / LOGO", fill="white")
    badge.save(assets / "badge.png")
    _image(assets / "cover_a.png", (190, 44, 62, 255), "CAPA A")
    _image(assets / "cover_b.png", (37, 99, 235, 255), "CAPA B")
    _image(assets / "cover_c.png", (226, 163, 35, 255), "CAPA C")

    words = []
    for index, word in enumerate(("ALFA", "BETA", "GAMA", "DELTA")):
        start = 10.2 + index * 0.8
        words.append({"word": word, "start": start, "end": start + 0.62})
    for index, word in enumerate(("TESTE", "VISUAL", "COM", "IRIS")):
        start = 22.2 + index * 0.8
        words.append({"word": word, "start": start, "end": start + 0.62})
    (PROJECT_ROOT / "transcript.json").write_text(
        json.dumps({"words": words}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    plan = {
        "version": "0.2",
        "project": {
            "name": "contentlab-visual-tests",
            "format": "custom",
            "profile": "generic",
            "resolution": {"width": 960, "height": 540},
            "fps": 30,
        },
        "sources": {"assets": "assets", "transcript": "transcript.json"},
        "audio": {
            "narration": "audio/narration.wav",
            "voice": {"normalize": False, "trimDb": 0},
        },
        "timeline": [
            {
                "id": "typewriter-camera",
                "start": 0, "end": 6, "layout": "3x3",
                "background": {"color": "#111111"},
                "camera": {"keyframes": [
                    {"t": 0, "x": 0.33, "y": 0.18, "scale": 2.2, "easing": "ease_in_out"},
                    {"t": 1.8, "x": 0.83, "y": 0.33, "scale": 2.2, "easing": "ease_in_out"},
                    {"t": 3.6, "x": 0.33, "y": 0.68, "scale": 1.9, "easing": "ease_in_out"},
                    {"t": 5.2, "x": 0.5, "y": 0.5, "scale": 1, "easing": "ease_in_out"},
                ]},
                "elements": [
                    {
                        "id": "fragment-1", "type": "text", "style": "anton", "text": "O QUE",
                        "cells": [1, 2], "start": 0.1, "end": 6,
                        "fontScale": 0.7, "reveal": {"charactersPerSecond": 8},
                        "textStyle": {"fontFamily": "Anton", "uppercase": True, "color": "#FFFFFF"},
                    },
                    {
                        "id": "fragment-2", "type": "text", "style": "anton", "text": "ACONTECEU",
                        "cells": [3, 6], "start": 1.7, "end": 6,
                        "fontScale": 0.55, "reveal": {"charactersPerSecond": 9},
                        "textStyle": {"fontFamily": "Anton", "uppercase": True, "color": "#E53935"},
                    },
                    {
                        "id": "fragment-3", "type": "text", "style": "anton", "text": "NESSE PAÍS?",
                        "cells": [4, 5, 7, 8], "start": 3.3, "end": 6,
                        "fontScale": 0.7, "reveal": {"charactersPerSecond": 9},
                        "textStyle": {"fontFamily": "Anton", "uppercase": True, "color": "#FFFFFF"},
                    },
                ],
                "transitionOut": "cut",
            },
            {
                "id": "center-mask",
                "start": 6, "end": 10, "layout": "fullscreen",
                "background": {"color": "#F3F1E9"},
                "elements": [{
                    "id": "center-title", "type": "text", "style": "anton",
                    "text": "ABRIR E FECHAR", "start": 6, "end": 10, "fontScale": 0.72,
                    "textStyle": {"fontFamily": "Anton", "uppercase": True, "color": "#111111"},
                    "animation": {"enter": "center_reveal", "enterDuration": 1, "exit": "center_close", "exitDuration": 1},
                }],
                "transitionOut": "cut",
            },
            {
                "id": "word-stack",
                "start": 10, "end": 14, "layout": "fullscreen",
                "background": {"color": "#10131B"},
                "elements": [{
                    "id": "stack", "type": "kinetic_text", "style": "word_stack_vertical",
                    "text": "ALFA BETA GAMA DELTA", "sync": "transcript", "start": 10, "end": 14,
                    "fontScale": 0.95,
                    "textStyle": {
                        "fontFamily": "Anton", "uppercase": True, "color": "#111111",
                        "outlineWidth": 0,
                    },
                    "config": {
                        "inactiveOpacity": 0.42,
                        "transitionDuration": 0.18,
                        "slotGap": 0.24,
                        "direction": "down",
                        "align": "left",
                        "activeScale": 1.45,
                        "inactiveScale": 0.72,
                        "inactiveColor": "#6F6F6F",
                        "panelColor": "#D9D9D9",
                        "panelOpacity": 0.92,
                        "panelRadius": 28,
                        "panelPaddingX": 52,
                        "panelPaddingY": 30,
                    },
                }],
                "transitionOut": "cut",
            },
            {
                "id": "filters-and-png",
                "start": 14, "end": 18, "layout": "fullscreen",
                "background": {"asset": "project://assets/base.mp4", "fit": "cover", "loop": True, "muted": True},
                "elements": [
                    {"id": "crt", "type": "filter", "style": "crt_tv", "start": 14, "end": 18, "z": 10},
                    {"id": "dim", "type": "filter", "style": "dim", "start": 15, "end": 17.7, "z": 20, "config": {"opacity": 0.45}},
                    {
                        "id": "badge", "type": "image", "asset": "project://assets/badge.png",
                        "start": 15, "end": 17.7, "z": 30, "fit": "contain",
                        "animation": {"enter": "pop_in", "idle": "wiggle_soft", "exit": "slide_to_left"},
                        "transform": {"x": 0.5, "y": 0.5, "scale": 0.8},
                    },
                ],
                "transitionOut": "cut",
            },
            {
                "id": "three-covers",
                "start": 18, "end": 22, "layout": "3x3",
                "background": {"color": "#E7E1D7"},
                "elements": [
                    {
                        "id": "cover-a", "type": "image", "asset": "project://assets/cover_a.png",
                        "cells": [1, 4, 7], "start": 18.15, "end": 22, "fit": "contain",
                        "animation": {"enter": "slide_from_left", "idle": "wiggle_soft"},
                    },
                    {
                        "id": "cover-b", "type": "image", "asset": "project://assets/cover_b.png",
                        "cells": [2, 5, 8], "start": 19.05, "end": 22, "fit": "contain",
                        "animation": {"enter": "slide_down", "idle": "wiggle_soft"},
                    },
                    {
                        "id": "cover-c", "type": "image", "asset": "project://assets/cover_c.png",
                        "cells": [3, 6, 9], "start": 19.95, "end": 22, "fit": "contain",
                        "animation": {"enter": "slide_from_right", "idle": "wiggle_soft"},
                    },
                ],
                "transitionOut": "cut",
            },
            {
                "id": "caption-highlight",
                "start": 22, "end": 26, "layout": "fullscreen",
                "background": {"color": "#252B3B"},
                "elements": [{
                    "id": "caption", "type": "caption", "style": "bangers_highlight_block",
                    "start": 22, "end": 26, "range": {"start": 22, "end": 26},
                    "cells": [7, 8, 9], "fontScale": 0.52,
                    "textStyle": {
                        "fontFamily": "Bangers", "uppercase": True, "color": "#FFFFFF",
                        "outlineColor": "#000000", "outlineWidth": 4,
                        "shadow": {"color": "#000000", "blur": 8, "offsetX": 3, "offsetY": 4},
                    },
                    "config": {
                        "highlightColors": ["#2563EB", "#E53935", "#111111"],
                        "maxWords": 7, "highlightRadius": 14,
                    },
                }],
                "transitionOut": "cut",
            },
            {
                "id": "blur-left-a",
                "start": 26, "end": 28, "layout": "fullscreen",
                "background": {"color": "#C62828"},
                "elements": [{"id": "left-label", "type": "text", "style": "anton", "text": "BLUR LEFT", "start": 26, "end": 28}],
                "transitionOut": "blur_left", "transitionDuration": 0.6,
            },
            {
                "id": "blur-left-b",
                "start": 28, "end": 30, "layout": "fullscreen",
                "background": {"color": "#1565C0"},
                "elements": [{"id": "right-label", "type": "text", "style": "anton", "text": "BLUR RIGHT", "start": 28, "end": 30}],
                "transitionOut": "blur_right", "transitionDuration": 0.6,
            },
            {
                "id": "blur-up-a",
                "start": 30, "end": 32, "layout": "fullscreen",
                "background": {"color": "#F9A825"},
                "elements": [{"id": "up-label", "type": "text", "style": "anton", "text": "BLUR UP", "start": 30, "end": 32}],
                "transitionOut": "blur_up", "transitionDuration": 0.6,
            },
            {
                "id": "blur-up-b",
                "start": 32, "end": 34, "layout": "fullscreen",
                "background": {"color": "#2E7D32"},
                "elements": [{"id": "end-label", "type": "text", "style": "anton", "text": "FIM", "start": 32, "end": 34}],
                "transitionOut": "cut",
            },
        ],
    }
    (PROJECT_ROOT / "edit_plan.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return plan


def _extract_frames(ffmpeg, video):
    cases = [
        ("typewriter-1", "Typewriter / câmera — início", 1.20, "Primeiro fragmento visível, câmera focada no começo da frase; nenhuma palavra deve estar partida."),
        ("typewriter-2", "Typewriter / câmera — meio", 2.80, "Câmera avançou para o segundo fragmento e a palavra ACONTECEU permanece inteira."),
        ("typewriter-pullback", "Typewriter / câmera — pullback", 5.45, "Composição inteira legível após o percurso da câmera."),
        ("center-reveal", "Center reveal", 6.45, "Texto parcialmente aberto a partir do centro com bordas suaves."),
        ("center-full", "Center reveal — aberto", 8.00, "Texto ABRIR E FECHAR totalmente visível."),
        ("center-close", "Center close", 9.65, "Texto fechando das bordas para o centro."),
        ("word-stack", "Word stack vertical", 11.10, "Pilha alinhada à esquerda em painel cinza; a palavra ativa é maior, anterior/próxima menores e o fluxo progride de cima para baixo."),
        ("crt-only", "CRT", 14.55, "Cena-base com scanlines/vinheta/flicker visual sem PNG em primeiro plano."),
        ("crt-dim-png", "CRT + dim + PNG", 15.65, "Cena-base tratada e escurecida; PNG/LOGO permanece limpo acima dos filtros."),
        ("three-covers", "Três capas", 21.05, "Três capas ocupam esquerda/centro/direita e permanecem inteiras."),
        ("caption-highlight", "Caption com palavra ativa", 23.75, "Chunk em Bangers permanece estável e apenas a palavra ativa recebe bloco colorido."),
        ("blur-left", "Blur left", 27.72, "Cena vermelha deslizando para a esquerda enquanto a azul entra, com blur."),
        ("blur-right", "Blur right", 29.72, "Cena azul deslizando para a direita enquanto a amarela entra, com blur."),
        ("blur-up", "Blur up", 31.72, "Cena amarela deslizando para cima enquanto a verde entra, com blur."),
    ]
    frames = OUTPUT_ROOT / "frames"
    frames.mkdir()
    manifest_cases = []
    for case_id, label, second, expectation in cases:
        frame = frames / f"{case_id}.png"
        _run(
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-ss", str(second), "-i", str(video), "-frames:v", "1", str(frame),
        )
        if not frame.is_file() or frame.stat().st_size < 500:
            raise RuntimeError(f"Frame visual não foi produzido: {case_id}")
        manifest_cases.append({
            "id": case_id,
            "label": label,
            "time": second,
            "expectation": expectation,
            "frame": f"frames/{frame.name}",
        })
    return manifest_cases


def main():
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise SystemExit("FFmpeg e FFprobe são necessários para os visual tests.")

    plan = _build_fixture(ffmpeg)
    validation = validate_edit_plan(plan, PROJECT_ROOT)
    if not validation["valid"]:
        raise RuntimeError(json.dumps(validation, ensure_ascii=False, indent=2))

    report = render_project(str(PROJECT_ROOT), "preview", ffmpeg_dir=Path(ffmpeg).parent, use_cache=False)
    source = Path(report["output"])
    target = OUTPUT_ROOT / "visual-tests.mp4"
    shutil.copy2(source, target)

    probe = json.loads(_run(
        ffprobe, "-v", "error", "-show_entries", "format=duration",
        "-of", "json", str(target),
    ).stdout)
    duration = float(probe["format"]["duration"])
    if duration < 33.5:
        raise RuntimeError(f"Vídeo visual ficou curto demais: {duration:.3f}s")

    cases = _extract_frames(ffmpeg, target)
    manifest = {
        "version": 1,
        "video": target.name,
        "duration": duration,
        "renderer": "Content Lab preview / edit_plan 0.2",
        "cases": cases,
    }
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "passed",
        "visualRoot": str(OUTPUT_ROOT),
        "video": str(target),
        "manifest": str(OUTPUT_ROOT / "manifest.json"),
        "cases": len(cases),
        "duration": duration,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
