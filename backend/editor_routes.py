"""Editor and transcription HTTP endpoints."""

import threading
import uuid
import json
import math
import os
import tempfile
import traceback
from pathlib import Path

from flask import jsonify, request, send_file

try:
    from .contentlab.cancel import CancelRunner
    from .contentlab.errors import PlanValidationError, RenderCancelled
    from .contentlab.project import (create_project, import_narration, inspect_asset_folder,
        inspect_project, load_project_document, project_plan_path, render_project,
        save_project_plan, save_uploaded_narration)
    from .contentlab.registry import describe_registry
    from .contentlab.catalog import installed_assets
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
    from contentlab.catalog import installed_assets
    from contentlab.service import validate_edit_plan
    from contentlab.transcription import (transcription_folder, transcribe_narration,
        MODELS as TRANSCRIPTION_MODELS, DETAILS as TRANSCRIPTION_DETAILS)


def register_editor_routes(app, EDITOR_JOBS, EDITOR_JOBS_LOCK, EDITOR_CANCEL_EVENTS,
                           TRANSCRIPTION_JOBS, TRANSCRIPTION_JOBS_LOCK, app_module):
    @app.route("/api/editor/visual-context", methods=["POST"])
    def editor_visual_context():
        data = request.get_json(silent=True) or {}
        try:
            root, _ = project_plan_path(data.get("projectRoot"))
            schemas = {version: json.loads(Path(app_module.resource_path(f"schemas/contentlab.schema.v{version}.json")).read_text(encoding="utf-8"))
                       for version in ("0.1", "0.2")}
            builtin = installed_assets(app_module.resource_path("builtin-assets"))
            project_assets = []
            for path in sorted(root.rglob("*")):
                if len(project_assets) >= 1000:
                    break
                if path.is_file() and root in path.resolve().parents and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".mp4", ".mov", ".mkv", ".webm", ".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".ttf", ".otf"}:
                    project_assets.append("project://" + path.relative_to(root).as_posix())
            transcript_path = root / "transcript.json"
            transcript = None
            if transcript_path.is_file() and transcript_path.stat().st_size <= 5 * 1024 * 1024:
                try:
                    document = json.loads(transcript_path.read_text(encoding="utf-8-sig"))
                    if isinstance(document, dict) and isinstance(document.get("segments"), list):
                        transcript = [{"start": item.get("start"), "end": item.get("end"), "text": item.get("text", "")}
                                      for item in document["segments"][:2000] if isinstance(item, dict)]
                except (ValueError, UnicodeError):
                    pass
            return jsonify({"schemas": schemas, "builtin": builtin, "projectAssets": project_assets, "transcript": transcript,
                            "plugins": describe_registry()})
        except PlanValidationError as exc:
            return jsonify({"error": "Projeto inválido.", "errors": exc.issues}), 422

    @app.route("/api/editor/project/transcript", methods=["POST"])
    def editor_import_transcript():
        upload = request.files.get("file")
        if upload is None:
            return jsonify({"error": "Selecione transcript.json."}), 400
        try:
            root, _ = project_plan_path(request.form.get("projectRoot"))
            content = upload.stream.read(5 * 1024 * 1024 + 1)
            if len(content) > 5 * 1024 * 1024:
                return jsonify({"error": "A transcrição excede 5 MB."}), 422
            data = json.loads(content.decode("utf-8-sig"))
            if not isinstance(data, dict) or not isinstance(data.get("segments"), list):
                return jsonify({"error": "A transcrição JSON precisa conter uma lista de segmentos."}), 422
            for item in data["segments"]:
                if not isinstance(item, dict) or not isinstance(item.get("start"), (int, float)) or not isinstance(item.get("end"), (int, float)) or not isinstance(item.get("text"), str) or not math.isfinite(item["start"]) or not math.isfinite(item["end"]) or item["start"] < 0 or item["end"] < item["start"]:
                    return jsonify({"error": "Segmentos da transcrição inválidos."}), 422
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(mode="wb", prefix=".transcript-", dir=root, delete=False) as handle:
                    temporary = Path(handle.name)
                    handle.write(content)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary, root / "transcript.json")
            finally:
                if temporary and temporary.exists():
                    temporary.unlink()
            return jsonify({"transcript": "transcript.json", "segments": len(data["segments"])}), 201
        except (ValueError, UnicodeError):
            return jsonify({"error": "Arquivo JSON de transcrição inválido."}), 422
        except PlanValidationError as exc:
            return jsonify({"error": "Projeto inválido.", "errors": exc.issues}), 422

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


    def _run_editor_job(job_id, root, mode, hardware_accel, cache_mode):
        job = EDITOR_JOBS[job_id]
        cancel_event = EDITOR_CANCEL_EVENTS[job_id]

        def on_progress(stage, current, total, scene_id):
            if cancel_event.is_set():
                raise RenderCancelled("Render cancelado pelo usuário.")
            job.update(stage=stage, current=current, total=total)
            if stage == "scene":
                cache_hit = str(scene_id).endswith(" (cache)")
                clean_id = str(scene_id)[:-8] if cache_hit else scene_id
                job.update(sceneId=clean_id, percent=min(85, round(current / max(total, 1) * 85)),
                           message=f"{'Reaproveitando' if cache_hit else 'Renderizando'} cena {current}/{total}: {clean_id}")
            elif stage == "narration":
                job.update(sceneId=None, percent=3, message="Narração preparada.")
            elif stage == "compose":
                job.update(sceneId=None, percent=90, message="Vídeo composto.")
            elif stage == "audio":
                job.update(sceneId=None, percent=95, message="Mixando áudio...")

        try:
            if cancel_event.is_set():
                raise RenderCancelled("Render cancelado pelo usuário.")
            report = app_module.render_project(root, mode=mode, progress=on_progress, hardware_accel=hardware_accel, runner=CancelRunner(cancel_event), cache_mode=cache_mode)
            if cancel_event.is_set():
                raise RenderCancelled("Render cancelado pelo usuário.")
            job.update(status="done", percent=100, message="Render concluído.", report=report, filepath=report["output"])
        except RenderCancelled:
            job.update(status="cancelled", message="Render cancelado.", error=None)
        except Exception as exc:
            trace = traceback.format_exc()
            log_dir = Path(root) / "output" / "logs"
            log_path = log_dir / f"render-{job_id}.log"
            try:
                log_dir.mkdir(parents=True, exist_ok=True)
                context = {
                    "jobId": job_id,
                    "mode": mode,
                    "projectRoot": root,
                    "stage": job.get("stage"),
                    "sceneId": job.get("sceneId"),
                    "current": job.get("current"),
                    "total": job.get("total"),
                    "percent": job.get("percent"),
                    "hardwareAccel": hardware_accel,
                    "errorType": type(exc).__name__,
                    "error": str(exc),
                }
                log_path.write_text(
                    "CONTENT LAB RENDER ERROR\n"
                    + json.dumps(context, ensure_ascii=False, indent=2)
                    + "\n\nTRACEBACK\n"
                    + trace,
                    encoding="utf-8",
                )
                job.update(errorLog=str(log_path), hasErrorLog=True)
            except Exception as log_exc:
                job.update(errorLog=None, hasErrorLog=False, logError=str(log_exc))
            scene_suffix = f" na cena {job.get('sceneId')}" if job.get("sceneId") else ""
            job.update(
                status="error",
                message=f"Falha no render{scene_suffix}.",
                error=str(exc),
                errorType=type(exc).__name__,
                tracebackTail="\n".join(trace.strip().splitlines()[-12:]),
            )
        finally:
            with EDITOR_JOBS_LOCK:
                EDITOR_CANCEL_EVENTS.pop(job_id, None)


    @app.route("/api/editor/render", methods=["POST"])
    def editor_render():
        data = request.get_json(silent=True) or {}
        mode = data.get("mode")
        cache_mode = data.get("cacheMode", "reuse")
        if cache_mode not in {"reuse", "rebuild"}:
            return jsonify({"error": "cacheMode deve ser reuse ou rebuild."}), 400
        hardware_accel = data.get("hardwareAccel", False)
        if not isinstance(hardware_accel, bool):
            return jsonify({"error": "hardwareAccel deve ser booleano."}), 400
        if mode != "final":
            return jsonify({"error": "A geração de preview foi removida. Use o render final."}), 400
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
            EDITOR_JOBS[job_id] = {
                "status": "running", "percent": 0, "message": "Preparando render...",
                "error": None, "errorType": None, "errorLog": None, "hasErrorLog": False,
                "tracebackTail": None, "stage": "prepare", "sceneId": None, "current": 0, "total": 0,
                "projectRoot": root, "mode": mode, "cacheMode": cache_mode, "filepath": None,
            }
            EDITOR_CANCEL_EVENTS[job_id] = threading.Event()
        threading.Thread(target=_run_editor_job, args=(job_id, root, mode, hardware_accel, cache_mode), daemon=True).start()
        return jsonify({"jobId": job_id}), 202


    @app.route("/api/editor/jobs/<job_id>", methods=["GET"])
    def editor_job(job_id):
        job = EDITOR_JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Render não encontrado."}), 404
        return jsonify(job)


    @app.route("/api/editor/jobs/<job_id>/log", methods=["GET"])
    def editor_job_log(job_id):
        job = EDITOR_JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Render não encontrado."}), 404
        raw = job.get("errorLog")
        if not raw:
            return jsonify({"error": "Este render não possui log de erro."}), 404
        path = Path(raw).resolve()
        allowed = (Path(job["projectRoot"]) / "output" / "logs").resolve()
        if allowed not in path.parents or not path.is_file():
            return jsonify({"error": "Log de erro não encontrado."}), 404
        return send_file(path, mimetype="text/plain", as_attachment=True, download_name=path.name)


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
