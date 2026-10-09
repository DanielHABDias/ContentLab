import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from backend.contentlab.remotion_bridge import _link_media, render_remotion_scene


class RemotionBridgeTests(unittest.TestCase):
    def test_link_media_reuses_same_source_when_cache_is_shared(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            public = root / "public"
            public.mkdir()
            source = root / "gameplay.mp4"
            source.write_bytes(b"video")
            cache = {}

            first = _link_media(source, public, 0, cache)
            second = _link_media(source, public, 8, cache)

            self.assertEqual(first, "media-0.mp4")
            self.assertEqual(second, first)
            self.assertEqual([path.name for path in public.glob("*.mp4")], ["media-0.mp4"])

    def test_render_reuses_background_source_and_sets_stable_remotion_limits(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "gameplay.mp4"
            source.write_bytes(b"video")
            font = root / "anton.ttf"
            font.write_bytes(b"font")
            output = root / "segment.mp4"
            captured = {}

            element = SimpleNamespace(
                type="video",
                data={"id": "resume", "fit": "cover", "_font_path": str(font)},
                start=5.0,
                end=20.0,
                z=10,
                region=(0, 0, 1920, 1080),
                asset_path=source,
            )
            scene = SimpleNamespace(
                id="12_gameplay_com_carrossel",
                start=0.0,
                end=23.57,
                background={"asset": "project://assets/gameplay.mp4", "fit": "cover"},
                background_path=source,
                camera={"keyframes": [], "shake": []},
                elements=(element,),
            )
            project = SimpleNamespace(width=1920, height=1080, fps=30)

            class Result:
                returncode = 0
                stderr = ""
                stdout = ""

            def fake_runner(command, **kwargs):
                captured["command"] = command
                props_path = Path(command[command.index("--props") + 1])
                captured["payload"] = json.loads(props_path.read_text(encoding="utf-8"))
                output.write_bytes(b"ok")
                return Result()

            with patch("backend.contentlab.remotion_bridge.ensure_remotion", return_value="node"), \
                 patch.dict("os.environ", {
                     "CONTENTLAB_REMOTION_TIMEOUT_MS": "90000",
                     "CONTENTLAB_REMOTION_CONCURRENCY": "2",
                 }, clear=False):
                render_remotion_scene(
                    scene, output, project, 23.57, root,
                    runner=fake_runner, transcript=None,
                )

            command = captured["command"]
            self.assertEqual(command[command.index("--timeout") + 1], "90000")
            self.assertEqual(command[command.index("--concurrency") + 1], "2")
            payload = captured["payload"]
            self.assertEqual(payload["scene"]["elements"][0]["src"], "media-0.mp4")
            self.assertEqual(payload["scene"]["backgroundSrc"], "media-0.mp4")

    def test_frame_extraction_timeout_retries_once_in_conservative_mode(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "gameplay.mp4"
            source.write_bytes(b"video")
            output = root / "segment.mp4"
            calls = []

            scene = SimpleNamespace(
                id="timeout-scene",
                start=0.0,
                end=3.0,
                background={"asset": "project://assets/gameplay.mp4", "fit": "cover"},
                background_path=source,
                camera={"keyframes": [], "shake": []},
                elements=(),
            )
            project = SimpleNamespace(width=1920, height=1080, fps=30)

            class Result:
                stdout = ""

                def __init__(self, returncode, stderr=""):
                    self.returncode = returncode
                    self.stderr = stderr

            def fake_runner(command, **kwargs):
                calls.append(list(command))
                if len(calls) == 1:
                    return Result(1, "Error Timeout while extracting frame at time 1.66sec from /public/media-1.mp4")
                output.write_bytes(b"ok")
                return Result(0)

            with patch("backend.contentlab.remotion_bridge.ensure_remotion", return_value="node"):
                render_remotion_scene(
                    scene, output, project, 3.0, root,
                    runner=fake_runner, transcript=None,
                )

            self.assertEqual(len(calls), 2)
            retry = calls[1]
            self.assertEqual(retry[retry.index("--concurrency") + 1], "1")
            self.assertEqual(retry[retry.index("--timeout") + 1], "180000")
            self.assertEqual(retry[retry.index("--log") + 1], "verbose")
            self.assertIn("--disallow-parallel-encoding", retry)


if __name__ == "__main__":
    unittest.main()
