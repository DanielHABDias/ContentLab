import json
import io
import tempfile
import unittest
import wave
import shutil
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from threading import Event, Timer

from backend.contentlab.assets import AssetResolver
from backend.contentlab.errors import PlanValidationError, UnsafeAssetPathError
from backend.contentlab.parser import parse_edit_plan
from backend.contentlab.render import render_edit_plan
from backend.contentlab.text import build_scene_ass, transcript_words
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
from backend.contentlab.motion_renderer import interpolate
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
    def test_rejects_overlapping_narration_cuts(self):
        data = valid_plan()
        data["audio"]["sourceCuts"] = [{"start": 0, "end": 2}, {"start": 1, "end": 3}]
        with self.assertRaises(PlanValidationError):
            parse_edit_plan(data)

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
                response = client.post("/api/transcription/jobs", data={"projectRoot": str(project), "model": "small", "detail": "words", "language": "pt", "file": (io.BytesIO(b"audio"), "narration.wav")}, content_type="multipart/form-data")
                self.assertEqual(response.status_code, 202)
                job_id = response.get_json()["jobId"]
                for _ in range(100):
                    result = client.get(f"/api/transcription/jobs/{job_id}").get_json()
                    if result["status"] != "running":
                        break
                    Event().wait(0.01)
                self.assertEqual(result["status"], "done")
                self.assertTrue(transcribe.call_args.args[1].startswith(str(project / "audio")))
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

            result = transcribe_narration(project, narration, "small", "words", "pt", model_factory=lambda *args, **kwargs: FakeModel())
            data = json.loads((project / "transcript.json").read_text(encoding="utf-8"))
            self.assertEqual(result["wordCount"], 2)
            self.assertEqual(data["segments"][0]["words"][0]["start"], 0.5)
            self.assertIn("[00:00:00.500 → 00:00:00.900] Olá", (project / "transcript.txt").read_text(encoding="utf-8"))
            self.assertIn("00:00:00,500 --> 00:00:01,500", (project / "transcript.srt").read_text(encoding="utf-8"))
            self.assertTrue(calls[0][1]["word_timestamps"])
            self.assertEqual(calls[0][1]["language"], "pt")

    def test_transcription_rejects_outside_project(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            create_project(str(root), "example")
            outside = root / "outside.wav"
            outside.touch()
            with self.assertRaises(ValueError):
                transcribe_narration(root / "example", outside, model_factory=lambda *args, **kwargs: None)


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
