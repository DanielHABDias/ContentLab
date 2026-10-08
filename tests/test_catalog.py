import tempfile
import unittest
from pathlib import Path

from backend.contentlab.catalog import build_ai_catalog, installed_assets


class CatalogTests(unittest.TestCase):
    def test_catalog_rescans_assets_and_includes_reference(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "builtin-assets" / "music").mkdir(parents=True)
            (root / "builtin-assets" / "transitions").mkdir()
            (root / "EDIT_PLAN_REFERENCE.md").write_text("CONTRATO JSON", encoding="utf-8")
            first = build_ai_catalog(root)
            self.assertIn("Músicas (0)", first)
            (root / "builtin-assets" / "music" / "Faixa nova.mp3").touch()
            (root / "builtin-assets" / "transitions" / "Flash verde.mp4").touch()
            second = build_ai_catalog(root)
            self.assertIn("builtin://music/Faixa nova.mp3", second)
            self.assertIn("builtin://transitions/Flash verde.mp4", second)
            self.assertIn("CONTRATO JSON", second)
            self.assertIn("chroma key", second)
            self.assertEqual(len(installed_assets(root / "builtin-assets")["music"]), 1)


if __name__ == "__main__":
    unittest.main()
