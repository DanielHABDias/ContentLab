import json
import tempfile
import unittest
from pathlib import Path

from backend.contentlab.assets import AssetResolver
from backend.contentlab.errors import PlanValidationError, UnsafeAssetPathError
from backend.contentlab.parser import parse_edit_plan
from backend.contentlab.render import render_edit_plan
from backend.contentlab.text import build_scene_ass, transcript_words
from backend.contentlab.timeline import compile_timeline
from backend.contentlab.layout import box_geometry, create_card_assets
from backend.contentlab.motions import motion_filters, overlay_position
from backend.contentlab.transitions import discover_transitions


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
    def test_phase6_plugin_registry_and_audio_validation(self):
        self.assertEqual(set(discover_transitions()), {"cut", "fade", "blur_left"})
        data = valid_plan()
        data["audio"]["music"] = [{"asset": "project://music.wav", "start": 2, "end": 1}]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(data)

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
            self.assertEqual([layer["type"] for layer in report["audioLayers"]], ["music", "sfx"])
            self.assertTrue(any("xfade=transition=fade" in str(part) for command in commands for part in command))
            self.assertTrue(any("amix=inputs=3" in str(part) for command in commands for part in command))

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
            self.assertTrue((root / "output" / "rough_cut.mp4").is_file())
            self.assertTrue((root / "output" / "render_report.json").is_file())
            self.assertEqual(len(commands), 3)
            self.assertTrue(all(isinstance(command, list) for command in commands))

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


class MotionTests(unittest.TestCase):
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
