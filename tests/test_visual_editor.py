import io
import json
import tempfile
import unittest
from pathlib import Path

from backend.app import app, EDITOR_JOBS
from backend.contentlab.project import create_project


class VisualEditorRouteTests(unittest.TestCase):
    def test_context_lists_project_and_builtin_assets(self):
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(create_project(temporary, "visual")["projectRoot"])
            (project / "assets" / "personagem.png").touch()
            with app.test_client() as client:
                response = client.post("/api/editor/visual-context", json={"projectRoot": str(project)})
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertIn("0.1", data["schemas"])
            self.assertIn("0.2", data["schemas"])
            self.assertIn("project://assets/personagem.png", data["projectAssets"])
            self.assertTrue(data["builtin"]["backgrounds"])

    def test_render_error_log_route_serves_project_log(self):
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(temporary).resolve()
            log_dir = project / "output" / "logs"
            log_dir.mkdir(parents=True)
            log_path = log_dir / "render-test.log"
            log_path.write_text("traceback de teste", encoding="utf-8")
            EDITOR_JOBS["render-log-test"] = {
                "status": "error",
                "projectRoot": str(project),
                "errorLog": str(log_path),
            }
            try:
                with app.test_client() as client:
                    response = client.get("/api/editor/jobs/render-log-test/log")
                self.assertEqual(response.status_code, 200)
                self.assertIn(b"traceback de teste", response.data)
            finally:
                EDITOR_JOBS.pop("render-log-test", None)

    def test_import_transcript_and_read_it_for_scene_timing(self):
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(create_project(temporary, "visual")["projectRoot"])
            transcript = {"segments": [{"start": 1, "end": 2, "text": "Olá mundo", "words": []}]}
            with app.test_client() as client:
                uploaded = client.post("/api/editor/project/transcript", data={"projectRoot": str(project), "file": (io.BytesIO(json.dumps(transcript).encode()), "transcript.json")}, content_type="multipart/form-data")
                context = client.post("/api/editor/visual-context", json={"projectRoot": str(project)})
            self.assertEqual(uploaded.status_code, 201)
            self.assertEqual(context.get_json()["transcript"][0]["text"], "Olá mundo")
            self.assertEqual(json.loads((project / "transcript.json").read_text()), transcript)


if __name__ == "__main__":
    unittest.main()
