import json
import io
import os
import tempfile
import unittest
import wave
import shutil
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from threading import Event, Timer

from backend.contentlab.assets import AssetResolver
from backend.contentlab.errors import PlanValidationError, UnsafeAssetPathError
from backend.contentlab.parser import parse_edit_plan
from backend.contentlab.render import render_edit_plan, _compose_visual, _cleanup_stale_render_workdirs, _composite_video_overlays
from backend.contentlab.text import build_scene_ass, caption_chunk, transcript_words, word_stack_state
from backend.contentlab.timeline import compile_timeline
from backend.contentlab.layout import box_geometry, create_card_assets
from backend.contentlab.motions import motion_filters, overlay_position
from backend.contentlab.transitions import discover_transitions
from backend.contentlab.project import create_project, inspect_asset_folder, inspect_project, load_project_document, save_project_plan, render_project
from backend.contentlab.cancel import CancelRunner
from backend.contentlab.errors import RenderCancelled
from backend.contentlab.audio import remap_transcript
from backend.contentlab.encoding import select_h264_encoder
from backend.contentlab.transcription import transcribe_narration
from backend.contentlab.motion_renderer import interpolate, _visual_state
from backend.contentlab.motion_renderer import _element_image, _font, _wrap_words, _word_stream_image
from backend.contentlab.typography import bundled_font_path, appearance
from backend.contentlab.registry import describe_registry
from PIL import Image


def valid_plan():
    return {
        "version": "0.1",
        "project": {"name": "teste", "format": "youtube_long", "profile": "generic"},
        "audio": {"narration": "audio/narration.wav"},
        "timeline": [{
            "id": "s1", "start": 0, "end": 3, "layout": {"grid": "3x3"},
            "elements": [{"type": "image", "asset": "project://images/a.png", "cells": [1, 2, 4, 5]}],
            "transitionOut": "cut",
        }],
    }


class ParserTests(unittest.TestCase):
    def test_anton_style_keeps_color_and_case_independent(self):
        self.assertIn("anton", describe_registry()["text_styles"])
        self.assertNotIn("anton_white", describe_registry()["text_styles"])
        self.assertEqual(appearance({"style": "anton"})["uppercase"], False)
        self.assertIsNone(appearance({"style": "anton"})["color"])
        chosen = appearance({"style": "anton", "textStyle": {"color": "#FF0000", "uppercase": True}})
        self.assertEqual((chosen["fontFamily"], chosen["color"], chosen["uppercase"]), ("Anton", "#FF0000", True))
        legacy = valid_plan()
        legacy["timeline"][0]["elements"] = [{"type": "text", "text": "Teste", "style": "anton_white"}]
        compile_timeline(parse_edit_plan(legacy))

    def test_storyboard_motion_contract(self):
        example = Path(__file__).resolve().parents[1] / "examples" / "motion-storyboard-v0.2.json"
        plan = parse_edit_plan(json.loads(example.read_text(encoding="utf-8")))
        self.assertEqual(len(plan.timeline), 2)
        timeline = compile_timeline(plan)
        self.assertEqual(timeline.scenes[0].transition_duration, 3)
        self.assertTrue(timeline.scenes[0].background["loop"])
        central = next(item for item in timeline.scenes[1].elements if item.data.get("id") == "figura-central")
        self.assertGreater(_visual_state(central, timeline.scenes[1], 0, 1920, 1080)["y"], 0.75)
        self.assertGreater(_visual_state(central, timeline.scenes[1], 7.95, 1920, 1080)["y"], 0.75)

    def test_bangers_highlight_caption_contract_and_chunking(self):
        self.assertIn("bangers_highlight_block", describe_registry()["caption_styles"])
        look = appearance({"style": "bangers_highlight_block"})
        self.assertEqual((look["fontFamily"], look["uppercase"]), ("Bangers", True))

        data = valid_plan()
        data["version"] = "0.2"
        data["sources"] = {"transcript": "transcript.json"}
        data["timeline"][0]["layout"] = "fullscreen"
        data["timeline"][0]["elements"] = [{
            "id": "caption", "type": "caption", "style": "bangers_highlight_block",
            "cells": [7, 8, 9], "config": {
                "highlightColors": ["#2563EB", "#E53935", "#111111"],
                "maxWords": 7, "highlightRadius": 14,
            },
        }]
        self.assertEqual(parse_edit_plan(data).version, "0.2")

        words = [
            {"word": "EU", "start": 0.0, "end": 0.4},
            {"word": "ACHO", "start": 0.4, "end": 0.8},
            {"word": "QUE,", "start": 0.8, "end": 1.1},
            {"word": "SIM", "start": 1.1, "end": 1.5},
        ]
        chunk, active_local, active_global = caption_chunk(words, 0.65, 0, 2, 7)
        self.assertEqual([word["word"] for word in chunk], ["EU", "ACHO", "QUE,"])
        self.assertEqual((active_local, active_global), (1, 1))
        _, gap_active, _ = caption_chunk(words, 1.05, 0, 2, 7)
        self.assertEqual(gap_active, 2)

        legacy = valid_plan()
        legacy["sources"] = {"transcript": "transcript.json"}
        legacy["timeline"][0]["elements"] = [{"type": "caption", "style": "bangers_highlight_block"}]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(legacy)

        bad = json.loads(json.dumps(data))
        bad["timeline"][0]["elements"][0]["config"]["highlightColors"] = ["blue"]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(bad)

    def test_vertical_word_stack_contract_and_state(self):
        self.assertIn("word_stack_vertical", describe_registry()["text_styles"])
        look = appearance({"style": "word_stack_vertical"})
        self.assertEqual((look["fontFamily"], look["uppercase"]), ("Anton", True))

        data = valid_plan()
        data["version"] = "0.2"
        data["sources"] = {"transcript": "transcript.json"}
        data["timeline"][0]["layout"] = "fullscreen"
        data["timeline"][0]["elements"] = [{
            "id": "stack", "type": "kinetic_text", "style": "word_stack_vertical",
            "text": "ALFA BETA GAMA DELTA",
            "sync": "transcript",
            "textStyle": {"fontFamily": "Anton", "uppercase": True, "color": "#FFFFFF"},
            "config": {
                "inactiveOpacity": 0.36,
                "transitionDuration": 0.18,
                "slotGap": 0.24,
                "direction": "down",
                "align": "left",
                "activeScale": 1.45,
                "inactiveScale": 0.72,
                "inactiveColor": "#777777",
                "panelColor": "#D9D9D9",
                "panelOpacity": 0.18,
                "panelRadius": 28,
                "panelPaddingX": 42,
                "panelPaddingY": 28,
            },
        }]
        self.assertEqual(parse_edit_plan(data).version, "0.2")

        words = [
            {"word": "ALFA", "start": 0.0, "end": 0.5},
            {"word": "BETA", "start": 0.5, "end": 1.0},
            {"word": "GAMA", "start": 1.0, "end": 1.5},
            {"word": "DELTA", "start": 1.5, "end": 2.0},
        ]
        settled = word_stack_state(words, 0.45, 0.18)
        self.assertEqual(settled["active"]["word"], "ALFA")
        self.assertEqual(settled["next"]["word"], "BETA")
        self.assertEqual(settled["progress"], 1.0)

        moving = word_stack_state(words, 0.56, 0.18)
        self.assertEqual((moving["previous"]["word"], moving["active"]["word"], moving["next"]["word"]), ("ALFA", "BETA", "GAMA"))
        self.assertGreater(moving["progress"], 0)
        self.assertLess(moving["progress"], 1)

        legacy = valid_plan()
        legacy["timeline"][0]["elements"] = [{"type": "kinetic_text", "style": "word_stack_vertical", "text": "A B C"}]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(legacy)

        bad = json.loads(json.dumps(data))
        bad["timeline"][0]["elements"][0]["config"]["inactiveOpacity"] = 1.4
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(bad)

        bad_align = json.loads(json.dumps(data))
        bad_align["timeline"][0]["elements"][0]["config"]["align"] = "right"
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(bad_align)

        bad_direction = json.loads(json.dumps(data))
        bad_direction["timeline"][0]["elements"][0]["config"]["direction"] = "sideways"
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(bad_direction)

    def test_vertical_word_stack_accepts_timed_phrase_items(self):
        data = valid_plan()
        data["version"] = "0.2"
        data["timeline"][0]["layout"] = "fullscreen"
        data["timeline"][0]["elements"] = [{
            "id": "phrase-stack",
            "type": "kinetic_text",
            "style": "word_stack_vertical",
            "text": "BATMAN NÃO É JUIZ BATMAN NÃO É JÚRI BATMAN NÃO É O CARRASCO",
            "start": 0,
            "end": 3,
            "textStyle": {"fontFamily": "Anton", "uppercase": True, "color": "#175AE8", "outlineWidth": 0},
            "config": {
                "align": "left",
                "direction": "down",
                "items": [
                    {"text": "BATMAN NÃO É JUIZ", "start": 0.0, "end": 1.0},
                    {"text": "BATMAN NÃO É JÚRI", "start": 1.0, "end": 2.0},
                    {"text": "BATMAN NÃO É O CARRASCO", "start": 2.0, "end": 3.0},
                ],
            },
        }]
        plan = parse_edit_plan(data)
        self.assertEqual(plan.version, "0.2")

        bad = json.loads(json.dumps(data))
        bad["timeline"][0]["elements"][0]["config"]["items"][1]["start"] = 2.5
        bad["timeline"][0]["elements"][0]["config"]["items"][2]["start"] = 2.0
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(bad)

    def test_horizontal_word_stream_contract_and_python_frame(self):
        self.assertIn("word_stream_horizontal", describe_registry()["text_styles"])
        look = appearance({"style": "word_stream_horizontal"})
        self.assertEqual((look["fontFamily"], look["uppercase"]), ("Anton", True))

        data = valid_plan()
        data["version"] = "0.2"
        data["sources"] = {"transcript": "transcript.json"}
        data["timeline"][0]["layout"] = "fullscreen"
        data["timeline"][0]["elements"] = [{
            "id": "stream",
            "type": "kinetic_text",
            "style": "word_stream_horizontal",
            "text": "VOCÊ SABE ME DIZER",
            "sync": "transcript",
            "start": 0,
            "end": 2,
            "fontScale": 1.5,
            "textStyle": {"fontFamily": "Anton", "uppercase": True, "color": "#FFFFFF", "outlineWidth": 0},
            "config": {"transitionDuration": 0.16},
        }]
        plan = parse_edit_plan(data)
        timeline = compile_timeline(plan)
        element = timeline.scenes[0].elements[0]
        words = [
            {"word": "VOCÊ", "start": 0.0, "end": 0.5},
            {"word": "SABE", "start": 0.5, "end": 1.0},
            {"word": "ME", "start": 1.0, "end": 1.4},
            {"word": "DIZER", "start": 1.4, "end": 2.0},
        ]
        image = _word_stream_image(element, words, 0.65)
        self.assertIsNotNone(image)
        self.assertEqual(image.size, (1920, 1080))

        bad = json.loads(json.dumps(data))
        bad["timeline"][0]["elements"][0]["config"]["transitionDuration"] = 2
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(bad)

    def test_center_text_motions_and_word_safe_wrap(self):
        registry = describe_registry()
        self.assertIn("center_reveal", registry["motion_v0.2_enter"])
        self.assertIn("center_close", registry["motion_v0.2_exit"])

        data = valid_plan()
        data["version"] = "0.2"
        data["timeline"][0]["layout"] = "fullscreen"
        data["timeline"][0]["elements"] = [{
            "id": "phrase", "type": "text", "style": "anton",
            "text": "UMA FRASE COMPLETA SEM CORTAR PALAVRAS",
            "animation": {"enter": "center_reveal", "exit": "center_close"},
            "reveal": {"charactersPerSecond": 12},
        }]
        plan = parse_edit_plan(data)
        timeline = compile_timeline(plan)
        element = timeline.scenes[0].elements[0]
        self.assertLess(_visual_state(element, timeline.scenes[0], 0.05, 1920, 1080)["centerVisibility"], 1)
        self.assertLess(_visual_state(element, timeline.scenes[0], 4.9, 1920, 1080)["centerVisibility"], 1)

        font = _font(36)
        source = "UMA PALAVRA COMPLETA"
        wrapped = _wrap_words(source, font, 0, 130)
        self.assertEqual(wrapped.replace("\\n", " ").split(), source.split())
        self.assertIn("\n", wrapped)
    def test_element_image_accepts_fractional_pillow_bbox(self):
        element = SimpleNamespace(
            type="text",
            data={
                "id": "fractional-text",
                "text": "A CONTENÇÃO CONTINUA SENDO SUFICIENTE?",
                "style": "anton",
                "fontScale": 1.15,
                "textStyle": {
                    "fontFamily": "Anton",
                    "uppercase": True,
                    "color": "#2470FF",
                    "outlineWidth": 0,
                },
            },
            region=(0, 0, 1920, 1080),
            asset_path=None,
        )
        fractional_bounds = (0.25, 0.5, 913.75, 188.25)
        with patch("PIL.ImageDraw.ImageDraw.multiline_textbbox", return_value=fractional_bounds):
            image = _element_image(element, 1920, 1080)

        self.assertIsInstance(image.width, int)
        self.assertIsInstance(image.height, int)
        self.assertGreater(image.width, 0)
        self.assertGreater(image.height, 0)

    def test_fit_accepts_fractional_target_size(self):
        from backend.contentlab.motion_renderer import _fit

        source = Image.new("RGBA", (64, 36), (255, 0, 0, 255))
        fitted = _fit(source, (640.2, 360.7), "contain")
        self.assertEqual(fitted.size, (641, 361))

    def test_motion_renderer_cleans_scene_frame_cache(self):
        import backend.contentlab.motion_renderer as motion_renderer

        scene = SimpleNamespace(
            id="overlay-scene",
            start=0.0,
            end=1 / 30,
            background_path=None,
            background={"color": "#000000"},
            camera={"keyframes": [], "shake": []},
            elements=(),
        )
        project = SimpleNamespace(width=64, height=36, fps=30)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "segment.mp4"

            def fake_run(command):
                Path(command[-1]).write_bytes(b"segment")

            motion_renderer.render_motion_scene(
                "ffmpeg", scene, output, project, 1 / 30,
                fake_run, root, ["-c:v", "libx264"], transcript=None,
            )

            self.assertTrue(output.is_file())
            self.assertFalse((root / "segment-motion").exists())

    def test_composite_video_overlays_uses_base_plus_overlay_without_python_frames(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base = root / "base.mp4"
            overlay = root / "cta.mp4"
            output = root / "out.mp4"
            base.write_bytes(b"base")
            overlay.write_bytes(b"overlay")
            element = SimpleNamespace(
                type="overlay",
                start=2.0,
                end=3.5,
                region=(0, 0, 1920, 1080),
                asset_path=overlay,
                data={
                    "id": "cta",
                    "fit": "cover",
                    "loop": False,
                    "config": {"keyColor": "#00FF00", "similarity": 0.28, "blend": 0.08},
                },
            )
            scene = SimpleNamespace(id="long-scene", start=0.0, end=40.0)
            project = SimpleNamespace(width=1920, height=1080, fps=30)
            commands = []

            class Result:
                returncode = 0
                stderr = ""
                stdout = ""

            def fake_runner(command, **kwargs):
                commands.append(list(command))
                Path(command[-1]).write_bytes(b"out")
                return Result()

            _composite_video_overlays(
                "ffmpeg", base, scene, (element,), output, project, 40.0,
                fake_runner, video_encoding=["-c:v", "libx264", "-threads", "2"],
            )

            self.assertTrue(output.is_file())
            self.assertEqual(len(commands), 1)
            command = commands[0]
            self.assertEqual(command.count("-i"), 2)
            graph = command[command.index("-filter_complex") + 1]
            self.assertIn("chromakey=0x00FF00:0.280:0.080", graph)
            self.assertIn("between(t,2.000000,3.500000)", graph)
            self.assertNotIn("frame-%06d", " ".join(command))

    def test_compose_visual_limits_transition_ffmpeg_to_two_media_inputs(self):
        class Transition:
            def __init__(self, name, ffmpeg_name):
                self.name = name
                self.ffmpeg_name = ffmpeg_name

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            segments = []
            for index in range(4):
                path = root / f"segment-{index}.mp4"
                path.write_bytes(b"segment")
                segments.append(path)

            commands = []

            class Result:
                returncode = 0
                stderr = ""
                stdout = ""

            def fake_runner(command, **kwargs):
                commands.append(list(command))
                destination = Path(command[-1])
                if destination.suffix in {".mp4", ".png"}:
                    destination.write_bytes(b"out")
                return Result()

            boundaries = [
                (Transition("blur_left", "slideleft"), 0.4),
                (Transition("cut", None), 0),
                (Transition("blur_up", "slideup"), 0.4),
            ]
            visual = _compose_visual(
                "ffmpeg", segments, boundaries, [2.0, 2.0, 2.0, 2.0],
                8.0, 30, 1920, 1080, root, fake_runner,
                video_encoding=["-c:v", "libx264"],
            )

            self.assertTrue(visual.is_file())
            transition_commands = [
                command for command in commands
                if "-filter_complex" in command and "overlay=" in command[command.index("-filter_complex") + 1]
            ]
            self.assertEqual(len(transition_commands), 2)
            for command in transition_commands:
                self.assertLessEqual(command.count("-i"), 2)

    def test_filter_layers_and_wiggle_soft_are_available_in_v02(self):
        registry = describe_registry()
        self.assertEqual(set(registry["filter_styles"]), {"dim", "crt_tv"})
        self.assertIn("wiggle_soft", registry["motion_v0.2_idle"])

        data = valid_plan()
        data["version"] = "0.2"
        data["timeline"][0]["layout"] = "fullscreen"
        data["timeline"][0]["elements"] = [
            {"id": "fx", "type": "filter", "style": "dim", "z": 5, "config": {"opacity": 0.4}},
            {"id": "cover", "type": "image", "asset": "project://images/a.png", "z": 10,
             "animation": {"enter": "slide_down", "idle": "wiggle_soft", "exit": "slide_to_bottom"}},
        ]
        plan = parse_edit_plan(data)
        timeline = compile_timeline(plan)
        self.assertEqual([item.type for item in timeline.scenes[0].elements], ["filter", "image"])
        cover = timeline.scenes[0].elements[1]
        self.assertNotEqual(_visual_state(cover, timeline.scenes[0], 0.6, 1920, 1080)["rotation"], 0)

        bad = json.loads(json.dumps(data))
        bad["timeline"][0]["elements"][0]["config"]["opacity"] = 1.5
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(bad)

        legacy = valid_plan()
        legacy["timeline"][0]["elements"] = [{"type": "filter", "style": "dim"}]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(legacy)

    def test_rejects_invalid_shake_and_reveal(self):
        data = valid_plan()
        data["version"] = "0.2"
        data["timeline"][0]["elements"][0]["id"] = "figure"
        data["timeline"][0]["elements"][0]["reveal"] = {"charactersPerSecond": 8}
        data["timeline"][0]["camera"] = {"shake": [{"start": 2, "end": 4}]}
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(data)

    def test_motion_v02_validates_keyframe_order_and_keeps_v01(self):
        data = valid_plan()
        self.assertEqual(parse_edit_plan(data).version, "0.1")
        data["version"] = "0.2"
        data["timeline"][0]["layout"] = "fullscreen"
        element = data["timeline"][0]["elements"][0]
        element.pop("cells")
        element["id"] = "hero"
        element["keyframes"] = [{"t": 0, "opacity": 0}, {"t": 1, "opacity": 1}]
        data["timeline"][0]["camera"] = {"keyframes": [{"t": 0, "x": 0.5}, {"t": 2, "x": 0.7}]}
        self.assertEqual(parse_edit_plan(data).version, "0.2")
        element["keyframes"].append({"t": 0.5, "opacity": 0})
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(data)

    def test_motion_interpolation(self):
        state = interpolate({"x": 0.2, "opacity": 0}, [{"t": 2, "x": 0.8, "opacity": 1, "easing": "linear"}], 1)
        self.assertAlmostEqual(state["x"], 0.5)
        self.assertAlmostEqual(state["opacity"], 0.5)

    def test_motion_grid_slide_and_oversize(self):
        plan = json.loads((Path(__file__).resolve().parents[1] / "examples" / "motion-grid-v0.2.json").read_text())
        timeline = compile_timeline(parse_edit_plan(plan))
        scene = timeline.scenes[0]
        left, right = scene.elements
        self.assertEqual(left.region, (0, 0, 640, 1080))
        self.assertEqual(right.region, (1280, 0, 640, 1080))
        self.assertEqual(_visual_state(left, scene, 0, 1920, 1080)["scale"], 1.2)
        self.assertLess(_visual_state(left, scene, 0, 1920, 1080)["x"], 0.25)
        self.assertAlmostEqual(_visual_state(left, scene, 0.6, 1920, 1080)["x"], 1 / 3)
        self.assertGreater(_visual_state(right, scene, 1, 1920, 1080)["x"], 0.75)
    def test_rejects_overlapping_narration_cuts(self):
        data = valid_plan()
        data["audio"]["sourceCuts"] = [{"start": 0, "end": 2}, {"start": 1, "end": 3}]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(data)

    def test_phase6_plugin_registry_and_audio_validation(self):
        self.assertEqual(set(discover_transitions()), {"cut", "fade", "blur_left", "blur_right", "blur_up", "slide_left"})
        data = valid_plan()
        data["audio"]["music"] = [{"asset": "project://music.wav", "start": 2, "end": 1}]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(data)

    def test_media_audio_controls_are_explicit_and_scoped(self):
        for version in ("0.1", "0.2"):
            data = valid_plan()
            data["version"] = version
            data["timeline"][0]["layout"] = "fullscreen"
            video = {"type": "video", "asset": "project://clip.mp4", "muted": False, "preset": "strong", "trimDb": -3, "fadeIn": 0.2, "fadeOut": 0.2}
            if version == "0.2":
                video["id"] = "clip"
            data["timeline"][0]["elements"] = [video]
            data["timeline"][0]["background"] = {"asset": "project://background.mp4", "muted": False, "preset": "subtle", "loop": True}
            parsed = parse_edit_plan(data)
            self.assertFalse(parsed.timeline[0]["elements"][0]["muted"])
            self.assertFalse(parsed.timeline[0]["background"]["muted"])

        bad = valid_plan()
        bad["timeline"][0]["elements"] = [{"type": "image", "asset": "project://images/a.png", "muted": False}]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(bad)

        bad_background = valid_plan()
        bad_background["timeline"][0]["background"] = {"asset": "project://images/a.png", "muted": False}
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(bad_background)

    def test_defaults_and_grid_compilation(self):
        timeline = compile_timeline(parse_edit_plan(valid_plan()))
        self.assertEqual((timeline.project.width, timeline.project.height), (1920, 1080))
        self.assertEqual(timeline.scenes[0].elements[0].region, (0, 0, 1280, 720))

    def test_rejects_invalid_scene_range(self):
        data = valid_plan()
        data["timeline"][0]["end"] = 0
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(data)

    def test_rejects_irregular_grid_cells(self):
        data = valid_plan()
        data["timeline"][0]["elements"][0]["cells"] = [1, 5]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(data)

    def test_rejects_motion_in_wrong_phase(self):
        data = valid_plan()
        data["timeline"][0]["elements"][0]["animation"] = {"exit": "slow_zoom_in"}
        with self.assertRaises(PlanValidationError):
            compile_timeline(parse_edit_plan(data))


class AssetResolverTests(unittest.TestCase):
    def test_builtin_backgrounds_and_hex_color_are_distinct_sources(self):
        root = Path(__file__).resolve().parents[1]
        resolver = AssetResolver(root, root / "builtin-assets")
        uri = "builtin://backgrounds/background_amarelo.png"
        self.assertTrue(resolver.resolve(uri).is_file())
        data = valid_plan()
        data["version"] = "0.2"
        data["timeline"][0]["elements"][0]["id"] = "figure"
        data["timeline"][0]["background"] = {"color": "#ffcc00"}
        self.assertEqual(parse_edit_plan(data).timeline[0]["background"]["color"], "#ffcc00")
        data["timeline"][0]["background"] = {"asset": uri}
        self.assertEqual(parse_edit_plan(data).timeline[0]["background"]["asset"], uri)

    def test_resolves_project_asset(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resolver = AssetResolver(root, root / "builtin")
            self.assertEqual(resolver.resolve("project://images/a.png"), root / "images" / "a.png")

    def test_blocks_path_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resolver = AssetResolver(root, root / "builtin")
            with self.assertRaises(UnsafeAssetPathError):
                resolver.resolve("project://../secret.txt")


class RendererTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg indisponível")
    def test_motion_ten_second_continuous_composition(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "audio").mkdir()
            Image.new("RGBA", (80, 120), (240, 45, 45, 255)).save(root / "assets" / "left.png")
            Image.new("RGBA", (80, 120), (45, 80, 240, 255)).save(root / "assets" / "right.png")
            with wave.open(str(root / "audio" / "voice.wav"), "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(16000)
                output.writeframes(b"\x00\x00" * (16000 * 10))
            plan = {"version": "0.2", "project": {"name": "continuity", "format": "custom", "profile": "generic", "resolution": {"width": 320, "height": 180}, "fps": 10},
                    "audio": {"narration": "audio/voice.wav"},
                    "timeline": [{"id": "one-shot", "start": 0, "end": 10, "layout": "3x3", "background": {"color": "#182238"},
                                  "camera": {"keyframes": [{"t": 0, "x": 0.5, "scale": 1}, {"t": 10, "x": 0.55, "scale": 1.1, "easing": "ease_in_out"}]},
                                  "elements": [{"id": "left", "type": "image", "asset": "project://assets/left.png", "cells": [1, 4, 7], "transform": {"scale": 1.2}, "animation": {"enter": "slide_from_left"}},
                                               {"id": "right", "type": "image", "asset": "project://assets/right.png", "cells": [3, 6, 9], "start": 1, "transform": {"scale": 1.2}, "animation": {"enter": "slide_from_right"}},
                                               {"id": "label", "type": "text", "text": "COMPARAÇÃO", "cells": [7, 8, 9], "start": 4, "end": 8, "animation": {"enter": "fade"}}]}]}
            path = root / "edit_plan.json"
            path.write_text(json.dumps(plan), encoding="utf-8")
            ffmpeg_dir = Path(shutil.which("ffmpeg")).parent
            report = render_edit_plan(path, output_dir=root / "output", ffmpeg_dir=ffmpeg_dir)
            self.assertEqual(report["scenes"], 1)
            self.assertAlmostEqual(report["outputProbe"]["videoDuration"], 10, delta=0.11)
            self.assertTrue(Path(report["output"]).is_file())

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg indisponível")
    def test_motion_v02_video_background_grid_and_caption(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "audio").mkdir()
            ffmpeg = shutil.which("ffmpeg")
            subprocess.run([ffmpeg, "-y", "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=5:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(root / "assets" / "background.mp4")], check=True, capture_output=True)
            Image.new("RGBA", (80, 80), (255, 30, 30, 255)).save(root / "assets" / "left.png")
            Image.new("RGBA", (80, 80), (30, 255, 30, 255)).save(root / "assets" / "right.png")
            with wave.open(str(root / "audio" / "voice.wav"), "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(16000)
                output.writeframes(b"\x00\x00" * 16000)
            (root / "transcript.json").write_text(json.dumps({"words": [{"word": "Olá", "start": 0, "end": 0.5}, {"word": "mundo", "start": 0.5, "end": 1}]}), encoding="utf-8")
            plan = {"version": "0.2", "project": {"name": "grid-video", "format": "custom", "profile": "generic", "resolution": {"width": 320, "height": 180}, "fps": 5},
                    "sources": {"transcript": "transcript.json"}, "audio": {"narration": "audio/voice.wav"},
                    "timeline": [{"id": "s", "start": 0, "end": 1, "layout": "3x3", "background": {"asset": "project://assets/background.mp4"},
                                  "elements": [{"id": "clip", "type": "video", "asset": "project://assets/background.mp4", "cells": [2, 5, 8], "start": 0.2, "end": 0.8, "z": 1},
                                               {"id": "left", "type": "image", "asset": "project://assets/left.png", "cells": [1, 4, 7], "transform": {"scale": 1.2}, "animation": {"enter": "slide_from_left"}},
                                               {"id": "right", "type": "image", "asset": "project://assets/right.png", "cells": [3, 6, 9], "start": 0.4, "animation": {"enter": "slide_from_right"}},
                                               {"id": "caption", "type": "caption", "style": "anton_karaoke"}]}]}
            path = root / "edit_plan.json"
            path.write_text(json.dumps(plan), encoding="utf-8")
            report = render_edit_plan(path, output_dir=root / "output", ffmpeg_dir=Path(ffmpeg).parent)
            self.assertEqual(report["status"], "completed")
            sample = root / "sample.png"
            subprocess.run([ffmpeg, "-y", "-ss", "0.6", "-i", report["output"], "-frames:v", "1", str(sample)], check=True, capture_output=True)
            with Image.open(sample) as frame:
                red = frame.convert("RGB").getpixel((110, 50))
            self.assertGreater(red[0], red[1] + 70, "scale 1.2 deve ultrapassar a coluna esquerda")

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg indisponível")
    def test_motion_storyboard_render_with_loop_transition_and_sfx(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "audio").mkdir()
            ffmpeg = shutil.which("ffmpeg")
            subprocess.run([ffmpeg, "-y", "-f", "lavfi", "-i", "color=c=navy:s=160x90:r=5:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(root / "assets" / "paper.mp4")], check=True, capture_output=True)
            Image.new("RGBA", (60, 70), (250, 80, 80, 255)).save(root / "assets" / "figure.png")
            for name, seconds in (("voice.wav", 8), ("whoosh.wav", 1)):
                with wave.open(str(root / "audio" / name), "wb") as output:
                    output.setnchannels(1)
                    output.setsampwidth(2)
                    output.setframerate(16000)
                    output.writeframes(b"\x00\x00" * (16000 * seconds))
            plan = {"version": "0.2", "project": {"name": "storyboard", "format": "custom", "profile": "generic", "resolution": {"width": 320, "height": 180}, "fps": 5},
                    "audio": {"narration": "audio/voice.wav"}, "timeline": [
                        {"id": "typed", "start": 0, "end": 4, "layout": "3x3", "background": {"asset": "project://assets/paper.mp4", "loop": True}, "transitionOut": "blur_left", "transitionDuration": 1.5,
                         "camera": {"keyframes": [{"t": 0, "x": 0.333, "scale": 2.5}, {"t": 2, "x": 0.667, "scale": 2.5}, {"t": 3, "x": 0.5, "scale": 1}]},
                         "elements": [{"id": "typed", "type": "text", "text": "PERGUNTA", "style": "anton_white", "cells": [1, 2], "reveal": {"charactersPerSecond": 6}},
                                      {"type": "sfx", "asset": "project://audio/whoosh.wav", "at": 2.5, "config": {"duration": 1}}]},
                        {"id": "figures", "start": 4, "end": 8, "background": {"color": "#224422"}, "camera": {"shake": [{"start": 2, "end": 3, "amplitude": 0.003}]},
                         "elements": [{"id": "figure", "type": "image", "asset": "project://assets/figure.png", "cells": [5, 8], "animation": {"enter": "slide_up", "idle": "float_soft", "exit": "slide_to_bottom", "exitDuration": 0.6}}]}
                    ]}
            path = root / "edit_plan.json"
            path.write_text(json.dumps(plan), encoding="utf-8")
            report = render_edit_plan(path, output_dir=root / "output", ffmpeg_dir=Path(ffmpeg).parent)
            self.assertEqual(report["status"], "completed")
            self.assertAlmostEqual(report["transitions"][0]["duration"], 1.5, delta=0.11)
            self.assertEqual(report["audioLayers"][0]["type"], "sfx")
            self.assertAlmostEqual(report["outputProbe"]["videoDuration"], 8, delta=0.2)

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg indisponível")
    def test_motion_v02_renders_continuous_scene(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "audio").mkdir()
            Image.new("RGB", (320, 180), "#204060").save(root / "assets" / "background.png")
            Image.new("RGBA", (80, 80), (255, 40, 40, 230)).save(root / "assets" / "character.png")
            with wave.open(str(root / "audio" / "voice.wav"), "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(16000)
                output.writeframes(b"\x00\x00" * 16000)
            plan = {
                "version": "0.2",
                "project": {"name": "motion-smoke", "format": "custom", "profile": "generic", "resolution": {"width": 320, "height": 180}, "fps": 4},
                "audio": {"narration": "audio/voice.wav"},
                "timeline": [{"id": "continuous", "start": 0, "end": 1,
                              "background": {"asset": "project://assets/background.png"},
                              "camera": {"keyframes": [{"t": 0, "x": 0.5}, {"t": 1, "x": 0.6}]},
                              "elements": [{"id": "hero", "type": "image", "asset": "project://assets/character.png", "transform": {"x": 0.45, "y": 0.5}, "keyframes": [{"t": 0, "opacity": 0}, {"t": 0.5, "opacity": 1}]},
                                           {"id": "title", "type": "text", "text": "TESTE", "start": 0.25, "end": 1, "transform": {"x": 0.6, "y": 0.7}}]}],
            }
            plan_path = root / "edit_plan.json"
            plan_path.write_text(json.dumps(plan), encoding="utf-8")
            report = render_edit_plan(plan_path, output_dir=root / "output", ffmpeg_dir=Path(shutil.which("ffmpeg")).parent)
            self.assertEqual(report["status"], "completed")
            self.assertTrue(Path(report["output"]).is_file())

    def test_gpu_probe_falls_back_to_software(self):
        class Result:
            returncode = 1

        with patch("backend.contentlab.encoding.subprocess.run", return_value=Result()):
            args, encoder, warning = select_h264_encoder("ffmpeg", True)
        self.assertEqual(encoder, "libx264")
        self.assertIn("libx264", args)
        self.assertEqual(warning["code"], "hardware_encoder_unavailable")

    def test_create_project_and_asset_folder_scope(self):
        with tempfile.TemporaryDirectory() as directory:
            created = create_project(directory, "Projeto Teste")
            root = Path(created["projectRoot"])
            self.assertTrue((root / "edit_plan.json").is_file())
            self.assertFalse(created["validation"]["valid"])
            (root / "assets" / "image.png").touch()
            listing = inspect_asset_folder(str(root), str(root / "assets"))
            self.assertEqual(listing["assets"][0]["uri"], "project://assets/image.png")
            with self.assertRaises(PlanValidationError):
                inspect_asset_folder(str(root), directory)

    def test_cancel_runner_interrupts_subprocess(self):
        import sys
        event = Event()
        timer = Timer(0.1, event.set)
        timer.start()
        try:
            with self.assertRaises(RenderCancelled):
                CancelRunner(event)([sys.executable, "-c", "import time; time.sleep(5)"], text=True, creationflags=0)
        finally:
            timer.join()

    def test_phase9_project_editor_validates_and_guards_external_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "audio").mkdir()
            (root / "images").mkdir()
            (root / "audio" / "narration.wav").touch()
            (root / "images" / "a.png").touch()
            path = root / "edit_plan.json"
            path.write_text(json.dumps(valid_plan()), encoding="utf-8")
            loaded = load_project_document(str(root))
            self.assertTrue(loaded["validation"]["valid"])
            self.assertIn("images/a.png", loaded["validation"]["resolvedAssets"]["project://images/a.png"])
            updated = valid_plan()
            updated["project"]["name"] = "editado"
            saved = save_project_plan(str(root), json.dumps(updated), loaded["revision"])
            self.assertEqual(saved["name"], "editado")
            self.assertNotEqual(saved["revision"], loaded["revision"])
            with self.assertRaises(PlanValidationError):
                save_project_plan(str(root), json.dumps(valid_plan()), loaded["revision"])
            with self.assertRaises(PlanValidationError):
                save_project_plan(str(root), "{bad json", saved["revision"])
            self.assertEqual(json.loads(path.read_text())["project"]["name"], "editado")
            path.write_text("{bad json", encoding="utf-8")
            repair = load_project_document(str(root))
            self.assertFalse(repair["validation"]["valid"])
            self.assertEqual(repair["planText"], "{bad json")

    def test_remaps_transcript_to_cleaned_narration(self):
        transcript = {"words": [
            {"word": "um", "start": 0.2, "end": 0.5},
            {"word": "removido", "start": 1.2, "end": 1.6},
            {"word": "dois", "start": 2.2, "end": 2.5},
        ]}
        mapped = remap_transcript(transcript, [{"start": 0, "end": 1}, {"start": 2, "end": 3}])
        self.assertEqual([word["word"] for word in mapped["words"]], ["um", "dois"])
        self.assertAlmostEqual(mapped["words"][1]["start"], 1.2)

    def test_cleanup_stale_render_workdirs_keeps_fresh_and_removes_old(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old_dir = root / "contentlab-render-old"
            fresh_dir = root / "contentlab-render-fresh"
            other_dir = root / "other"
            old_dir.mkdir()
            fresh_dir.mkdir()
            other_dir.mkdir()
            old_time = 1_000_000_000
            os.utime(old_dir, (old_time, old_time))
            with patch("backend.contentlab.render.time.time", return_value=old_time + 1000):
                removed = _cleanup_stale_render_workdirs(root, minimum_age_seconds=300)
            self.assertEqual(removed, [str(old_dir)])
            self.assertFalse(old_dir.exists())
            self.assertTrue(fresh_dir.exists())
            self.assertTrue(other_dir.exists())

    def test_software_encoder_caps_threads(self):
        with patch.dict("os.environ", {"CONTENTLAB_FFMPEG_THREADS": "2"}, clear=False):
            args, encoder, warning = select_h264_encoder("ffmpeg", False)
        self.assertEqual(encoder, "libx264")
        self.assertIsNone(warning)
        self.assertIn("-threads", args)
        self.assertEqual(args[args.index("-threads") + 1], "2")

    def test_project_preview_and_final_are_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "audio").mkdir()
            (root / "images").mkdir()
            (root / "bin").mkdir()
            (root / "audio" / "narration.wav").touch()
            (root / "images" / "a.png").touch()
            (root / "bin" / "ffmpeg").touch()
            (root / "edit_plan.json").write_text(json.dumps(valid_plan()), encoding="utf-8")
            self.assertEqual(inspect_project(str(root))["name"], "teste")
            commands = []

            class Result:
                returncode = 0
                stderr = ""
                stdout = ""

            def fake_runner(command, **kwargs):
                commands.append(command)
                Path(command[-1]).write_bytes(b"x")
                return Result()

            preview = render_project(str(root), "preview", ffmpeg_dir=root / "bin", runner=fake_runner)
            final = render_project(str(root), "final", ffmpeg_dir=root / "bin", runner=fake_runner)
            command_count = len(commands)
            cached = render_project(str(root), "preview", ffmpeg_dir=root / "bin", runner=fake_runner)
            self.assertTrue(preview["output"].endswith("/output/preview/preview.mp4"))
            self.assertTrue(final["output"].endswith("/output/final/final.mp4"))
            self.assertEqual(preview["mode"], "preview")
            self.assertEqual(final["mode"], "final")
            self.assertTrue(cached["cacheHit"])
            self.assertEqual(len(commands), command_count)
            (root / "images" / "a.png").write_bytes(b"changed")
            refreshed = render_project(str(root), "preview", ffmpeg_dir=root / "bin", runner=fake_runner)
            self.assertFalse(refreshed["cacheHit"])
            self.assertGreater(len(commands), command_count)
            self.assertTrue(any("960x540" in str(part) for command in commands for part in command))

    def test_editor_api_loads_project_and_serves_completed_render(self):
        from backend.app import app, EDITOR_JOBS
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "audio").mkdir()
            (root / "images").mkdir()
            (root / "audio" / "narration.wav").touch()
            (root / "images" / "a.png").touch()
            (root / "edit_plan.json").write_text(json.dumps(valid_plan()), encoding="utf-8")
            output = root / "output" / "preview" / "preview.mp4"
            output.parent.mkdir(parents=True)
            output.write_bytes(b"test-video")
            finished = Event()

            def fake_render(*args, **kwargs):
                finished.set()
                return {"status": "completed", "output": str(output), "mode": "preview"}

            client = app.test_client()
            loaded = client.post("/api/editor/project", json={"projectRoot": str(root)})
            self.assertEqual(loaded.status_code, 200)
            self.assertIn("planText", loaded.get_json())
            self.assertIn(b'editorPlanText', client.get("/").data)
            self.assertEqual(client.get("/api/editor/plugins").status_code, 200)
            backgrounds = client.get("/api/editor/backgrounds")
            self.assertEqual(backgrounds.status_code, 200)
            collection = [item for item in backgrounds.get_json()["backgrounds"] if item["uri"].startswith("builtin://backgrounds/background_")]
            self.assertEqual(len(collection), 48)
            self.assertTrue(all(item["name"].startswith("background_") for item in collection))
            self.assertIn("builtin://backgrounds/background_amarelo.png", {item["uri"] for item in collection})
            assets_response = client.post("/api/editor/project/assets", json={"projectRoot": str(root), "folder": str(root / "images")})
            self.assertEqual(assets_response.status_code, 200)
            upload_response = client.post("/api/editor/project/narration", data={"projectRoot": str(root), "file": (io.BytesIO(b"audio"), "voice.wav")}, content_type="multipart/form-data")
            self.assertEqual(upload_response.status_code, 201)
            self.assertTrue((root / upload_response.get_json()["relative"]).is_file())
            self.assertTrue(client.post("/api/editor/validate", json={"projectRoot": str(root), "plan": valid_plan()}).get_json()["valid"])
            bad_save = client.post("/api/editor/project/save", json={"projectRoot": str(root), "planText": "{}", "revision": loaded.get_json()["revision"]})
            self.assertEqual(bad_save.status_code, 422)
            updated = valid_plan()
            updated["project"]["name"] = "salvo pela API"
            saved = client.post("/api/editor/project/save", json={"projectRoot": str(root), "planText": json.dumps(updated), "revision": loaded.get_json()["revision"]})
            self.assertEqual(saved.status_code, 200)
            conflict = client.post("/api/editor/project/save", json={"projectRoot": str(root), "planText": json.dumps(updated), "revision": loaded.get_json()["revision"]})
            self.assertEqual(conflict.status_code, 409)
            with patch("backend.app.render_project", fake_render):
                response = client.post("/api/editor/render", json={"projectRoot": str(root), "mode": "preview", "revision": saved.get_json()["revision"]})
                self.assertEqual(response.status_code, 202)
                self.assertTrue(finished.wait(2))
            job_id = response.get_json()["jobId"]
            self.assertEqual(client.get(f"/api/editor/jobs/{job_id}").get_json()["status"], "done")
            media = client.get(f"/api/editor/media/{job_id}")
            self.assertEqual(media.data, b"test-video")
            media.close()
            EDITOR_JOBS.pop(job_id, None)

    def test_editor_api_cancels_running_render(self):
        from backend.app import app, EDITOR_JOBS
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "audio").mkdir()
            (root / "images").mkdir()
            (root / "audio" / "narration.wav").touch()
            (root / "images" / "a.png").touch()
            (root / "edit_plan.json").write_text(json.dumps(valid_plan()), encoding="utf-8")
            started, release = Event(), Event()

            def fake_render(*args, **kwargs):
                started.set()
                release.wait(2)
                return {"status": "completed", "output": str(root / "fake.mp4")}

            client = app.test_client()
            with patch("backend.app.render_project", fake_render):
                response = client.post("/api/editor/render", json={"projectRoot": str(root), "mode": "final"})
                job_id = response.get_json()["jobId"]
                self.assertTrue(started.wait(2))
                self.assertEqual(client.post(f"/api/editor/jobs/{job_id}/cancel").status_code, 200)
                release.set()
                for _ in range(100):
                    if client.get(f"/api/editor/jobs/{job_id}").get_json()["status"] == "cancelled":
                        break
                    Event().wait(0.01)
            self.assertEqual(client.get(f"/api/editor/jobs/{job_id}").get_json()["status"], "cancelled")
            self.assertEqual(client.get(f"/api/editor/media/{job_id}").status_code, 404)
            EDITOR_JOBS.pop(job_id, None)

    def test_phase6_routes_transitions_and_audio_to_ffmpeg(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "audio").mkdir()
            (root / "bin").mkdir()
            for name in ("narration.wav", "music.wav", "effect.wav"):
                (root / "audio" / name).touch()
            (root / "bin" / "ffmpeg").touch()
            data = valid_plan()
            data["project"]["resolution"] = {"width": 64, "height": 64}
            data["timeline"][0]["elements"] = []
            data["timeline"][0]["transitionOut"] = "fade"
            data["timeline"].append({"id": "s2", "start": 3, "end": 5, "elements": [
                {"type": "sfx", "asset": "project://audio/effect.wav", "at": 3.5}
            ]})
            data["audio"]["music"] = [{"asset": "project://audio/music.wav", "start": 0, "end": 5, "trimDb": -20, "fadeIn": 0.3}]
            commands = []

            class Result:
                returncode = 0
                stderr = ""
                stdout = ""

            def fake_runner(command, **kwargs):
                commands.append(command)
                Path(command[-1]).touch()
                return Result()

            report = render_edit_plan(data, output_dir=root / "output", project_root=root, ffmpeg_dir=root / "bin", runner=fake_runner)
            self.assertEqual(report["transitions"][0]["type"], "fade")
            self.assertTrue(report["ducking"]["enabled"])
            self.assertEqual([layer["type"] for layer in report["audioLayers"]], ["music", "sfx"])
            self.assertTrue(any("xfade=transition=fade" in str(part) for command in commands for part in command))
            self.assertTrue(any("amix=inputs=3" in str(part) for command in commands for part in command))
            self.assertTrue(any("sidechaincompress" in str(part) for command in commands for part in command))
            self.assertTrue(any("loudnorm" in str(part) for command in commands for part in command))
            self.assertTrue(any("alimiter" in str(part) for command in commands for part in command))

    def test_media_audio_layers_can_be_enabled_or_muted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "audio").mkdir()
            (root / "assets").mkdir()
            (root / "bin").mkdir()
            (root / "audio" / "narration.wav").touch()
            for name in ("background.mp4", "clip.mp4", "overlay.mp4", "muted.mp4"):
                (root / "assets" / name).touch()
            (root / "bin" / "ffmpeg").touch()
            data = valid_plan()
            data["project"]["resolution"] = {"width": 64, "height": 64}
            data["timeline"][0]["layout"] = "fullscreen"
            data["timeline"][0]["background"] = {
                "asset": "project://assets/background.mp4", "loop": True,
                "muted": False, "preset": "subtle",
            }
            data["timeline"][0]["elements"] = [
                {"type": "video", "asset": "project://assets/clip.mp4", "muted": False, "trimDb": -3},
                {"type": "overlay", "asset": "project://assets/overlay.mp4", "muted": False, "preset": "strong"},
                {"type": "video", "asset": "project://assets/muted.mp4", "muted": True},
            ]
            commands = []

            class Result:
                returncode = 0
                stderr = ""
                stdout = ""

            def fake_runner(command, **kwargs):
                commands.append(command)
                Path(command[-1]).touch()
                return Result()

            report = render_edit_plan(data, output_dir=root / "output", project_root=root, ffmpeg_dir=root / "bin", runner=fake_runner)
            self.assertEqual([layer["type"] for layer in report["audioLayers"]], ["background", "video", "overlay"])
            self.assertEqual([layer["trimDb"] for layer in report["audioLayers"]], [-12.0, -3.0, 0.0])
            self.assertNotIn("project://assets/muted.mp4", [layer["asset"] for layer in report["audioLayers"]])
            self.assertTrue(report["audioLayers"][0]["loop"])
            self.assertTrue(any("amix=inputs=4" in str(part) for command in commands for part in command))

    def test_builds_rough_cut_and_report_with_argument_lists(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "audio").mkdir()
            (root / "images").mkdir()
            (root / "bin").mkdir()
            (root / "audio" / "narration.wav").touch()
            (root / "images" / "a.png").touch()
            (root / "bin" / "ffmpeg").touch()
            data = valid_plan()
            plan_path = root / "edit_plan.json"
            plan_path.write_text(json.dumps(data), encoding="utf-8")
            commands = []

            class Result:
                returncode = 0
                stderr = ""
                stdout = ""

            def fake_runner(command, **kwargs):
                commands.append(command)
                Path(command[-1]).touch()
                return Result()

            report = render_edit_plan(
                plan_path, output_dir=root / "output", ffmpeg_dir=root / "bin", runner=fake_runner
            )
            self.assertEqual(report["status"], "completed")
            self.assertFalse(report["ducking"]["enabled"])
            self.assertTrue(report["narration"]["normalization"]["enabled"])
            self.assertTrue((root / "output" / "rough_cut.mp4").is_file())
            self.assertTrue((root / "output" / "render_report.json").is_file())
            self.assertEqual(len(commands), 4)
            self.assertTrue(all(isinstance(command, list) for command in commands))

    def test_failed_render_report_keeps_stage_and_scene_context(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "audio").mkdir()
            (root / "images").mkdir()
            (root / "bin").mkdir()
            (root / "audio" / "narration.wav").touch()
            (root / "images" / "a.png").touch()
            (root / "bin" / "ffmpeg").touch()
            plan_path = root / "edit_plan.json"
            plan_path.write_text(json.dumps(valid_plan()), encoding="utf-8")
            calls = 0

            class Result:
                stdout = ""

                def __init__(self, returncode=0, stderr=""):
                    self.returncode = returncode
                    self.stderr = stderr

            def fake_runner(command, **kwargs):
                nonlocal calls
                calls += 1
                if calls == 1:
                    Path(command[-1]).touch()
                    return Result()
                return Result(1, "falha de cena proposital")

            with self.assertRaises(Exception):
                render_edit_plan(
                    plan_path, output_dir=root / "output", ffmpeg_dir=root / "bin", runner=fake_runner
                )

            report = json.loads((root / "output" / "render_report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["status"], "failed")
            self.assertEqual(report["stage"], "scene")
            self.assertEqual(report["scene"], "s1")
            self.assertIn("Falha ao renderizar cena", report["error"])
            self.assertIn("falha de cena proposital", report["error"])

    def test_three_columns_assigns_visual_regions_and_card_assets(self):
        data = valid_plan()
        data["timeline"][0]["layout"] = "three_columns"
        data["timeline"][0]["elements"] = [
            {"type": "image", "asset": f"project://images/{index}.png", "box": {"padding": 12, "radius": 20, "shadow": "soft"}}
            for index in range(3)
        ]
        scene = compile_timeline(parse_edit_plan(data)).scenes[0]
        self.assertEqual([element.region[0] for element in scene.elements], [0, 640, 1280])
        self.assertEqual([element.region[2] for element in scene.elements], [640, 640, 640])
        _, content, radius = box_geometry(scene.elements[0])
        self.assertEqual(content, (12, 12, 616, 1056))
        self.assertEqual(radius, 20)
        with tempfile.TemporaryDirectory() as directory:
            mask, backing = create_card_assets(scene.elements[0], directory, "card")
            self.assertTrue(mask.is_file())
            self.assertTrue(backing.is_file())


class TextRendererTests(unittest.TestCase):
    def test_expands_segment_timestamps_into_words(self):
        words = transcript_words({"segments": [{"start": 1, "end": 3, "text": "duas palavras"}]})
        self.assertEqual([item["word"] for item in words], ["duas", "palavras"])
        self.assertEqual(words[0]["start"], 1)
        self.assertEqual(words[-1]["end"], 3)

    def test_writes_static_and_kinetic_ass_events(self):
        data = valid_plan()
        data["timeline"][0]["elements"] = [
            {"type": "text", "text": "FASE 2", "style": "impact", "start": 0, "end": 1},
            {"type": "kinetic_text", "text": "texto em movimento", "style": "word_pop", "sync": "transcript", "start": 1, "end": 3, "emphasis": ["movimento"]},
        ]
        timeline = compile_timeline(parse_edit_plan(data))
        with tempfile.TemporaryDirectory() as directory:
            ass_path = Path(directory) / "scene.ass"
            count, warnings = build_scene_ass(timeline.scenes[0], timeline.project, None, ass_path)
            content = ass_path.read_text(encoding="utf-8-sig")
            self.assertEqual(count, 4)
            self.assertIn("FASE 2", content)
            self.assertIn("movimento", content)
            self.assertTrue(any(item["code"] == "kinetic_text_timing_fallback" for item in warnings))

    def test_caption_highlights_current_word_from_transcript(self):
        data = valid_plan()
        data["timeline"][0]["elements"] = [
            {"type": "caption", "style": "anton_karaoke", "sync": "transcript", "range": {"start": 1, "end": 3}, "cells": [7, 8, 9]}
        ]
        timeline = compile_timeline(parse_edit_plan(data))
        transcript = {"segments": [{"start": 1, "end": 3, "text": "duas palavras", "words": [
            {"word": "duas", "start": 1, "end": 2},
            {"word": "palavras", "start": 2, "end": 3},
        ]}]}
        with tempfile.TemporaryDirectory() as directory:
            ass_path = Path(directory) / "caption.ass"
            count, warnings = build_scene_ass(timeline.scenes[0], timeline.project, transcript, ass_path)
            content = ass_path.read_text(encoding="utf-8-sig")
            self.assertEqual(count, 2)
            self.assertEqual(warnings, [])
            self.assertEqual(content.count("Dialogue:"), 2)
        self.assertIn("\\1c&H00D4FF&", content)


class NarrationTranscriptionTests(unittest.TestCase):
    def test_folder_picker_uses_zenity_when_tkinter_is_unavailable(self):
        from backend.app import app
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict("sys.modules", {"tkinter": None}), patch("backend.app.shutil.which", return_value="/usr/bin/zenity"), patch("backend.app.subprocess.run", return_value=SimpleNamespace(returncode=0, stdout=directory + "\n")) as run:
                with app.test_client() as client:
                    response = client.post("/api/choose-folder")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.get_json()["folder"], directory)
                self.assertIn("--directory", run.call_args.args[0])

    def test_transcription_job_api_imports_audio_and_reports_result(self):
        from backend.app import app, TRANSCRIPTION_JOBS
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory) / "transcription-first"
            project.mkdir()
            self.assertFalse((project / "edit_plan.json").exists())
            with app.test_client() as client, patch("backend.app.transcribe_narration", return_value={"transcript": "transcript.json", "segmentCount": 1, "wordCount": 2}) as transcribe:
                response = client.post("/api/transcription/jobs", data={"projectRoot": str(project), "model": "medium", "detail": "words", "language": "pt", "file": (io.BytesIO(b"audio"), "narration.wav")}, content_type="multipart/form-data")
                self.assertEqual(response.status_code, 202)
                job_id = response.get_json()["jobId"]
                for _ in range(100):
                    result = client.get(f"/api/transcription/jobs/{job_id}").get_json()
                    if result["status"] != "running":
                        break
                    Event().wait(0.01)
                self.assertEqual(result["status"], "done")
                self.assertTrue(transcribe.call_args.args[1].startswith(str(project / "audio")))
                self.assertEqual(transcribe.call_args.args[2:5], ("medium", "words", "pt"))
                self.assertEqual(result["result"]["wordCount"], 2)
                TRANSCRIPTION_JOBS.pop(job_id, None)
                editor_response = client.post("/api/editor/project/narration", data={"projectRoot": str(project), "file": (io.BytesIO(b"audio"), "narration.wav")}, content_type="multipart/form-data")
                self.assertEqual(editor_response.status_code, 422)

    def test_skill_download_returns_named_zip(self):
        from backend.app import app
        with app.test_client() as client:
            response = client.get("/api/skill/download")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data[:2], b"PK")
            self.assertIn("skillContentLabEdicao.zip", response.headers["Content-Disposition"])
            response.close()

    def test_transcription_without_plan_exports_editor_json_and_timed_text(self):
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            (project / "audio").mkdir()
            narration = project / "audio" / "narration.wav"
            narration.write_bytes(b"fake audio for mocked model")
            calls = []

            class FakeModel:
                def transcribe(self, source, **options):
                    calls.append((source, options))
                    segment = SimpleNamespace(start=0.5, end=1.5, text="Olá mundo", words=[
                        SimpleNamespace(word=" Olá", start=0.5, end=0.9),
                        SimpleNamespace(word=" mundo", start=0.9, end=1.5),
                    ])
                    return iter([segment]), SimpleNamespace(language="pt", language_probability=0.99)

            with patch("backend.contentlab.transcription.decode_for_whisper", return_value=__import__("numpy").zeros(16000, dtype="float32")):
                result = transcribe_narration(project, narration, "small", "words", "pt", model_factory=lambda *args, **kwargs: FakeModel())
            data = json.loads((project / "transcript.json").read_text(encoding="utf-8"))
            self.assertEqual(result["wordCount"], 2)
            self.assertEqual(data["segments"][0]["words"][0]["start"], 0.5)
            self.assertIn("[00:00:00.500 → 00:00:00.900] Olá", (project / "transcript.txt").read_text(encoding="utf-8"))
            self.assertIn("00:00:00,500 --> 00:00:01,500", (project / "transcript.srt").read_text(encoding="utf-8"))
            self.assertEqual(calls[0][0].shape, (16000,))
            self.assertTrue(calls[0][1]["word_timestamps"])
            self.assertEqual(calls[0][1]["language"], "pt")

    def test_audio_decoder_handles_real_wav_without_pyav_open(self):
        from backend.audio_decode import decode_for_whisper
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "voice.wav"
            with wave.open(str(source), "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(16000)
                output.writeframes(b"\0\0" * 16000)
            with patch("av.open", side_effect=TypeError("open() got an unexpected keyword argument 'metadata_errors'")):
                samples = decode_for_whisper(source)
            self.assertEqual(samples.shape, (16000,))
            self.assertEqual(str(samples.dtype), "float32")

    def test_transcription_rejects_outside_project(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            create_project(str(root), "example")
            outside = root / "outside.wav"
            outside.touch()
            with self.assertRaises(ValueError):
                transcribe_narration(root / "example", outside, model_factory=lambda *args, **kwargs: None)


class MotionTests(unittest.TestCase):
    def test_bundled_typography_reveal_and_custom_outline_shadow(self):
        for family in ("Anton", "Bangers"):
            path = bundled_font_path(family)
            self.assertTrue(path.is_file())
            self.assertIn(family, _font(42, family=family).getname()[0])
        element = SimpleNamespace(type="text", region=(0, 0, 640, 360), data={
            "text": "Olá mundo", "style": "bangers", "reveal": {"charactersPerSecond": 8},
            "textStyle": {"uppercase": True, "color": "#FFFFFF", "outlineColor": "#112233",
                          "outlineWidth": 6, "shadow": {"color": "#000000", "blur": 8, "offsetX": 3, "offsetY": 4}},
        })
        shadowed = _element_image(element, 640, 360, "Olá")
        element.data["textStyle"].pop("shadow")
        plain = _element_image(element, 640, 360, "Olá")
        self.assertGreater(shadowed.width, plain.width)
        self.assertGreater(shadowed.height, plain.height)

    def test_text_appearance_schema_and_color_validation(self):
        data = valid_plan()
        data["version"] = "0.2"
        data["timeline"][0]["layout"] = "3x3"
        data["timeline"][0]["elements"] = [{"id": "titulo", "type": "text", "text": "Olá", "style": "bangers",
            "reveal": {"charactersPerSecond": 9}, "textStyle": {"fontFamily": "Bangers", "uppercase": True,
            "outlineWidth": 6, "shadow": {"color": "#000000", "blur": 8, "offsetX": 3, "offsetY": 4}}}]
        self.assertEqual(parse_edit_plan(data).version, "0.2")
        data["timeline"][0]["elements"][0]["textStyle"]["shadow"]["color"] = "preto"
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(data)

    def test_timed_enter_idle_exit_filters(self):
        filters = motion_filters(
            {"enter": "fade", "idle": "slow_zoom_out", "exit": "fade_out"},
            640, 360, 24, 3, 0.5, 2.5,
        )
        self.assertTrue(any("zoompan" in value for value in filters))
        self.assertTrue(any("fade=t=in:st=0.500" in value for value in filters))
        self.assertTrue(any("fade=t=out:st=2.150" in value for value in filters))
        self.assertEqual(overlay_position(20, 30, 100, {"enter": "slide_up", "idle": "float_soft"}, 0)[0], "20")


if __name__ == "__main__":
    unittest.main()
