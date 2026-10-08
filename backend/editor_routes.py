"""Editor and transcription HTTP endpoints."""

import threading
import uuid
from pathlib import Path

from flask import jsonify, request, send_file

try:
    from .contentlab.cancel import CancelRunner
    from .contentlab.errors import PlanValidationError, RenderCancelled
    from .contentlab.project import (create_project, import_narration, inspect_asset_folder,
        inspect_project, load_project_document, project_plan_path, render_project,
        save_project_plan, save_uploaded_narration)
    from .contentlab.registry import describe_registry
    from .contentlab.service import validate_edit_plan
    from .contentlab.transcription import (transcription_folder, transcribe_narration,
        MODELS as TRANSCRIPTION_MODELS, DETAILS as TRANSCRIPTION_DETAILS)
except ImportError:
    from contentlab.cancel import CancelRunner
    from contentlab.errors import PlanValidationError, RenderCancelled
    from contentlab.project import (create_project, import_narration, inspect_asset_folder,
        inspect_project, load_project_document, project_plan_path, render_project,
        save_project_plan, save_uploaded_narration)
    from contentlab.registry import describe_registry
    from contentlab.service import validate_edit_plan
    from contentlab.transcription import (transcription_folder, transcribe_narration,
        MODELS as TRANSCRIPTION_MODELS, DETAILS as TRANSCRIPTION_DETAILS)


def register_editor_routes(app, EDITOR_JOBS, EDITOR_JOBS_LOCK, EDITOR_CANCEL_EVENTS,
                           TRANSCRIPTION_JOBS, TRANSCRIPTION_JOBS_LOCK, app_module):
    @app.route("/api/editor/plugins", methods=["GET"])
    def editor_plugins():
        return jsonify(describe_registry())


    @app.route("/api/editor/validate", methods=["POST"])
    def editor_validate():
        data = request.get_json(silent=True) or {}
        plan = data.get("plan")
        if not isinstance(plan, dict):
            return jsonify({"valid": False, "errors": [{"path": "plan", "message": "Envie o plano JSON no campo 'plan'."}]}), 400
        try:
            report = validate_edit_plan(plan, project_root=data.get("projectRoot"))
            return jsonify(report), 200 if report["valid"] else 422
        except PlanValidationError as exc:
            return jsonify({"valid": False, "errors": exc.issues}), 422


    @app.route("/api/editor/project", methods=["POST"])
    def editor_project():
        data = request.get_json(silent=True) or {}
        try:
            return jsonify(load_project_document(data.get("projectRoot")))
        except PlanValidationError as exc:
            return jsonify({"error": "Projeto inválido.", "errors": exc.issues}), 422


    @app.route("/api/editor/project/create", methods=["POST"])
    def editor_project_create():
        data = request.get_json(silent=True) or {}
        try:
            return jsonify(create_project(data.get("parentRoot"), data.get("name"))), 201
        except PlanValidationError as exc:
            return jsonify({"error": "Não foi possível criar o projeto.", "errors": exc.issues}), 422


    @app.route("/api/editor/project/assets", methods=["POST"])
    def editor_project_assets():
        data = request.get_json(silent=True) or {}
        try:
            return jsonify(inspect_asset_folder(data.get("projectRoot"), data.get("folder")))
        except PlanValidationError as exc:
            return jsonify({"error": "Pasta de assets inválida.", "errors": exc.issues}), 422


    @app.route("/api/editor/project/narration", methods=["POST"])
    def editor_project_narration():
        upload = request.files.get("file")
        if upload is None:
            return jsonify({"error": "Selecione uma narração."}), 400
        try:
            root = str(project_plan_path(request.form.get("projectRoot"))[0])
            with EDITOR_JOBS_LOCK:
                if any(job["status"] == "running" and job["projectRoot"] == root for job in EDITOR_JOBS.values()):
                    return jsonify({"error": "Aguarde o render antes de importar a narração."}), 409
                return jsonify(import_narration(root, upload)), 201
        except PlanValidationError as exc:
            return jsonify({"error": "Narração inválida.", "errors": exc.issues}), 422


    @app.route("/api/editor/project/save", methods=["POST"])
    def editor_project_save():
        data = request.get_json(silent=True) or {}
        try:
            root = str(project_plan_path(data.get("projectRoot"))[0])
            with EDITOR_JOBS_LOCK:
                if any(job["status"] == "running" and job["projectRoot"] == root for job in EDITOR_JOBS.values()):
                    return jsonify({"error": "Aguarde o render em andamento antes de salvar."}), 409
                result = save_project_plan(root, data.get("planText"), data.get("revision"))
            return jsonify(result)
        except PlanValidationError as exc:
            conflict = any(item["path"] == "revision" for item in exc.issues)
            return jsonify({"error": "Não foi possível salvar o plano.", "errors": exc.issues}), 409 if conflict else 422


    def _run_transcription_job(job_id, root, narration, model, detail, language):
        job = TRANSCRIPTION_JOBS[job_id]
        try:
            result = app_module.transcribe_narration(root, narration, model, detail, language, progress=lambda message: job.update(message=message))
            job.update(status="done", message="Transcrição concluída.", result=result)
        except Exception as exc:
            job.update(status="error", message="Falha na transcrição.", error=str(exc))


    @app.route("/api/transcription/jobs", methods=["POST"])
    def start_transcription_job():
        upload = request.files.get("file")
        model = request.form.get("model", "small")
        detail = request.form.get("detail", "words")
        language = request.form.get("language", "").strip().lower() or None
        if upload is None:
            return jsonify({"error": "Selecione uma narração."}), 400
        if model not in TRANSCRIPTION_MODELS or detail not in TRANSCRIPTION_DETAILS:
            return jsonify({"error": "Modelo ou detalhamento inválido."}), 400
        if language and (not language.isalpha() or len(language) not in (2, 3)):
            return jsonify({"error": "Idioma inválido."}), 400
        try:
            root = str(transcription_folder(request.form.get("projectRoot")))
            with EDITOR_JOBS_LOCK:
                if any(job["status"] == "running" and job["projectRoot"] == root for job in EDITOR_JOBS.values()):
                    return jsonify({"error": "Aguarde o render antes de transcrever."}), 409
            with TRANSCRIPTION_JOBS_LOCK:
                if any(job["status"] == "running" and job["projectRoot"] == root for job in TRANSCRIPTION_JOBS.values()):
                    return jsonify({"error": "Já existe uma transcrição em andamento nesta pasta."}), 409
                imported = save_uploaded_narration(root, upload)
                job_id = uuid.uuid4().hex
                TRANSCRIPTION_JOBS[job_id] = {"status": "running", "message": "Preparando narração...", "error": None, "projectRoot": root, "narration": imported["relative"]}
            threading.Thread(target=_run_transcription_job, args=(job_id, root, imported["path"], model, detail, language), daemon=True).start()
            return jsonify({"jobId": job_id, "narration": imported["relative"]}), 202
        except PlanValidationError as exc:
            return jsonify({"error": "Narração inválida.", "errors": exc.issues}), 422


    @app.route("/api/transcription/jobs/<job_id>", methods=["GET"])
    def transcription_job(job_id):
        job = TRANSCRIPTION_JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Transcrição não encontrada."}), 404
        return jsonify(job)


    def _run_editor_job(job_id, root, mode, hardware_accel):
        job = EDITOR_JOBS[job_id]
        cancel_event = EDITOR_CANCEL_EVENTS[job_id]

        def on_progress(stage, current, total, scene_id):
            if cancel_event.is_set():
                raise RenderCancelled("Render cancelado pelo usuário.")
            if stage == "scene":
                job.update(percent=min(85, round(current / max(total, 1) * 85)), message=f"Renderizando cena {current}/{total}: {scene_id}")
            elif stage == "narration":
                job.update(percent=3, message="Narração preparada.")
            elif stage == "compose":
                job.update(percent=90, message="Vídeo composto.")
            elif stage == "audio":
                job.update(percent=95, message="Mixando áudio...")

        try:
            if cancel_event.is_set():
                raise RenderCancelled("Render cancelado pelo usuário.")
            report = app_module.render_project(root, mode=mode, progress=on_progress, hardware_accel=hardware_accel, runner=CancelRunner(cancel_event))
            if cancel_event.is_set():
                raise RenderCancelled("Render cancelado pelo usuário.")
            job.update(status="done", percent=100, message="Render concluído.", report=report, filepath=report["output"])
        except RenderCancelled:
            job.update(status="cancelled", message="Render cancelado.", error=None)
        except Exception as exc:
            job.update(status="error", message="Falha no render.", error=str(exc))
        finally:
            with EDITOR_JOBS_LOCK:
                EDITOR_CANCEL_EVENTS.pop(job_id, None)


    @app.route("/api/editor/render", methods=["POST"])
    def editor_render():
        data = request.get_json(silent=True) or {}
        mode = data.get("mode")
        hardware_accel = data.get("hardwareAccel", False)
        if not isinstance(hardware_accel, bool):
            return jsonify({"error": "hardwareAccel deve ser booleano."}), 400
        if mode not in {"preview", "final"}:
            return jsonify({"error": "Modo deve ser preview ou final."}), 400
        try:
            project = inspect_project(data.get("projectRoot"))
        except PlanValidationError as exc:
            return jsonify({"error": "Projeto inválido.", "errors": exc.issues}), 422
        if not project["validation"]["valid"]:
            return jsonify({"error": "Há assets ausentes.", "validation": project["validation"]}), 422
        root = project["projectRoot"]
        with EDITOR_JOBS_LOCK:
            if any(job["status"] == "running" and job["projectRoot"] == root for job in EDITOR_JOBS.values()):
                return jsonify({"error": "Já existe um render em andamento para este projeto."}), 409
            if data.get("revision") and data["revision"] != load_project_document(root)["revision"]:
                return jsonify({"error": "O plano mudou no disco. Recarregue o projeto antes do render."}), 409
            job_id = uuid.uuid4().hex
            EDITOR_JOBS[job_id] = {"status": "running", "percent": 0, "message": "Preparando render...", "error": None, "projectRoot": root, "mode": mode, "filepath": None}
            EDITOR_CANCEL_EVENTS[job_id] = threading.Event()
        threading.Thread(target=_run_editor_job, args=(job_id, root, mode, hardware_accel), daemon=True).start()
        return jsonify({"jobId": job_id}), 202


    @app.route("/api/editor/jobs/<job_id>", methods=["GET"])
    def editor_job(job_id):
        job = EDITOR_JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Render não encontrado."}), 404
        return jsonify(job)


    @app.route("/api/editor/jobs/<job_id>/cancel", methods=["POST"])
    def editor_job_cancel(job_id):
        with EDITOR_JOBS_LOCK:
            job = EDITOR_JOBS.get(job_id)
            event = EDITOR_CANCEL_EVENTS.get(job_id)
            if not job:
                return jsonify({"error": "Render não encontrado."}), 404
            if job["status"] != "running" or not event:
                return jsonify({"error": "Render não está em andamento."}), 409
            event.set()
            job["message"] = "Cancelando render..."
        return jsonify({"ok": True})


    @app.route("/api/editor/media/<job_id>", methods=["GET"])
    def editor_media(job_id):
        job = EDITOR_JOBS.get(job_id)
        if not job or job["status"] != "done":
            return jsonify({"error": "Vídeo ainda não disponível."}), 404
        path = Path(job["filepath"]).resolve()
        expected = Path(job["projectRoot"]) / "output" / job["mode"]
        if expected.resolve() not in path.parents or not path.is_file():
            return jsonify({"error": "Arquivo não encontrado."}), 404
        return send_file(path, mimetype="video/mp4", conditional=True)
