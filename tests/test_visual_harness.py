import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app import app


class VisualHarnessRouteTests(unittest.TestCase):
    def test_visual_test_page_reports_missing_fixture(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.dict(os.environ, {"CONTENTLAB_VISUAL_TEST_ROOT": temporary}):
                with app.test_client() as client:
                    page = client.get("/visual-tests")
                    manifest = client.get("/visual-tests/manifest")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"Nenhuma fixture visual", page.data)
        self.assertEqual(manifest.status_code, 404)

    def test_visual_test_page_serves_manifest_and_media(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "visual-tests.mp4").write_bytes(b"fake-video")
            (root / "manifest.json").write_text(json.dumps({
                "version": 1,
                "video": "visual-tests.mp4",
                "duration": 4,
                "cases": [{"id": "demo", "label": "Demo", "time": 1.2, "expectation": "frame visível"}],
            }), encoding="utf-8")
            with patch.dict(os.environ, {"CONTENTLAB_VISUAL_TEST_ROOT": temporary}):
                with app.test_client() as client:
                    page = client.get("/visual-tests?case=demo")
                    manifest = client.get("/visual-tests/manifest")
                    media = client.get("/visual-tests/media")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"visual-test-video", page.data)
        self.assertEqual(manifest.status_code, 200)
        self.assertTrue(manifest.get_json()["generated"])
        self.assertEqual(media.status_code, 200)
        self.assertEqual(media.data, b"fake-video")


if __name__ == "__main__":
    unittest.main()
