import json
import tempfile
import unittest
from pathlib import Path

from backend.contentlab.assets import AssetResolver
from backend.contentlab.errors import PlanValidationError, UnsafeAssetPathError
from backend.contentlab.parser import parse_edit_plan
from backend.contentlab.timeline import compile_timeline


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


if __name__ == "__main__":
    unittest.main()
