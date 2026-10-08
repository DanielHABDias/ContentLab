import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app import app
from backend.download_support import (
    cache_key_for_url,
    cache_ref_for_key,
    import_local_video_to_cache,
    load_cache_metadata,
)


class LocalSourceTests(unittest.TestCase):
    def test_cache_reference_round_trip(self):
        ref = cache_ref_for_key("local_abc123")
        self.assertEqual(ref, "contentlab-cache://local_abc123")
        self.assertEqual(cache_key_for_url(ref), "local_abc123")

    def test_import_local_video_copies_to_cache_without_touching_original(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "Meu Filme.mp4"
            payload = (b"CONTENTLAB" * 300000)[:2_000_000]
            source.write_bytes(payload)
            original_stat = source.stat()
            cache_root = root / "cache"
            legacy_root = root / "legacy"

            job = {"message": "", "percent": 0}
            with patch("backend.download_support.video_cache_root", return_value=str(cache_root)), \
                 patch("backend.download_support.legacy_video_cache_root", return_value=str(legacy_root)), \
                 patch("backend.download_support._probe_local_duration", return_value=5432.1):
                entry = import_local_video_to_cache(job, str(source), str(root))
                copied = cache_root / entry["key"] / "source.mp4"
                metadata = load_cache_metadata(str(cache_root / entry["key"]))

            self.assertTrue(copied.is_file())
            self.assertEqual(copied.read_bytes(), payload)
            self.assertEqual(source.read_bytes(), payload)
            self.assertEqual(source.stat().st_size, original_stat.st_size)
            self.assertEqual(entry["origin"], "local")
            self.assertEqual(entry["duration"], 5432.1)
            self.assertEqual(entry["original_name"], "Meu Filme.mp4")
            self.assertTrue(entry["url"].startswith("contentlab-cache://"))
            self.assertEqual(metadata["source_origin"], "local")
            self.assertEqual(metadata["original_path"], str(source.resolve()))
            self.assertEqual(job["percent"], 100)

    def test_local_source_route_rejects_missing_or_unsupported_file(self):
        with app.test_client() as client:
            missing = client.post("/api/local-source/import", json={"path": "/arquivo/que-nao-existe.mp4"})
            self.assertEqual(missing.status_code, 400)

            with tempfile.TemporaryDirectory() as temporary:
                bad = Path(temporary) / "arquivo.txt"
                bad.write_text("x", encoding="utf-8")
                unsupported = client.post("/api/local-source/import", json={"path": str(bad)})
            self.assertEqual(unsupported.status_code, 400)

    def test_main_page_exposes_local_source_mode(self):
        with app.test_client() as client:
            response = client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'value="local"', response.data)
        self.assertIn(b'id="localSourceBlock"', response.data)
        self.assertIn(b'id="chooseLocalVideoBtn"', response.data)


if __name__ == "__main__":
    unittest.main()
