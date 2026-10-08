"""Developer-only visual regression routes for Iris/coding-agent inspection."""

import json
import os
from pathlib import Path

from flask import jsonify, render_template, send_from_directory


def _visual_root(app_module):
    configured = os.environ.get("CONTENTLAB_VISUAL_TEST_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()
    return (Path(app_module.resource_path(".")) / ".visual-tests").resolve()


def _load_manifest(app_module):
    root = _visual_root(app_module)
    path = root / "manifest.json"
    if not path.is_file():
        return root, None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return root, None
    if not isinstance(data, dict) or not isinstance(data.get("cases"), list):
        return root, None
    return root, data


def register_visual_test_routes(app, app_module):
    @app.route("/visual-tests", methods=["GET"])
    def visual_tests():
        root, manifest = _load_manifest(app_module)
        return render_template(
            "visual_tests.html",
            manifest=manifest,
            generated=manifest is not None,
            visual_root=str(root),
        )

    @app.route("/visual-tests/manifest", methods=["GET"])
    def visual_tests_manifest():
        _, manifest = _load_manifest(app_module)
        if manifest is None:
            return jsonify({
                "generated": False,
                "error": "Fixtures visuais ainda não foram geradas. Rode python -m tests.visual_acceptance.",
            }), 404
        return jsonify({"generated": True, **manifest})

    @app.route("/visual-tests/media", methods=["GET"])
    def visual_tests_media():
        root, manifest = _load_manifest(app_module)
        if manifest is None:
            return jsonify({"error": "Fixtures visuais ainda não foram geradas."}), 404
        filename = manifest.get("video")
        if not isinstance(filename, str) or not filename or Path(filename).name != filename:
            return jsonify({"error": "Manifesto visual inválido."}), 500
        media = root / filename
        if not media.is_file():
            return jsonify({"error": "Vídeo de teste visual não encontrado."}), 404
        return send_from_directory(root, filename, conditional=True)
