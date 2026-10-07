import os
import re
import sys
import uuid
import json
import hashlib
import threading
import subprocess
import shutil
from pathlib import Path

from flask import Flask, render_template, request, jsonify, Response, stream_with_context, send_file
import yt_dlp
import requests

try:
    from . import ffmpeg_helper
    from .contentlab.errors import PlanValidationError
    from .contentlab.registry import describe_registry
    from .contentlab.service import validate_edit_plan
    from .contentlab.project import project_plan_path, create_project, inspect_asset_folder, import_narration, inspect_project, load_project_document, save_project_plan, render_project
    from .contentlab.cancel import CancelRunner
    from .contentlab.errors import RenderCancelled
    from .contentlab.transcription import transcribe_narration, MODELS as TRANSCRIPTION_MODELS, DETAILS as TRANSCRIPTION_DETAILS
except ImportError:  # Suporte ao executável gerado pelo PyInstaller.
    import ffmpeg_helper
    from contentlab.errors import PlanValidationError
    from contentlab.registry import describe_registry
    from contentlab.service import validate_edit_plan
    from contentlab.project import project_plan_path, create_project, inspect_asset_folder, import_narration, inspect_project, load_project_document, save_project_plan, render_project
    from contentlab.cancel import CancelRunner
    from contentlab.errors import RenderCancelled
    from contentlab.transcription import transcribe_narration, MODELS as TRANSCRIPTION_MODELS, DETAILS as TRANSCRIPTION_DETAILS


def resource_path(relative):
    """Resolve recursos no repositório e no executável do PyInstaller."""
    base = getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent)
    return str(Path(base) / relative)


app = Flask(
    __name__,
    template_folder=resource_path("frontend/templates"),
    static_folder=resource_path("frontend/static"),
)


@app.route("/api/skill/download", methods=["GET"])
def download_contentlab_skill():
    """Serve only the bundled, public skill archive."""
    skill_path = Path(resource_path("skillContentLabEdicao.zip"))
    if not skill_path.is_file():
        return jsonify({"error": "Skill não encontrada nesta instalação."}), 404
    return send_file(skill_path, as_attachment=True, download_name="skillContentLabEdicao.zip", mimetype="application/zip", conditional=True)


@app.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    return response

JOBS = {}  # job_id -> dict(status, percent, message, error, filepath, folder)
EDITOR_JOBS = {}
EDITOR_JOBS_LOCK = threading.Lock()
EDITOR_CANCEL_EVENTS = {}
TRANSCRIPTION_JOBS = {}
TRANSCRIPTION_JOBS_LOCK = threading.Lock()
PREVIEWS = {}  # preview_id -> dict(url, headers)
CACHE_LOCKS = {}  # cache_key -> threading.Lock()
CACHE_LOCKS_GUARD = threading.Lock()

DEFAULT_DOWNLOAD_DIR = str(Path.home() / "Downloads")


# ---------- helpers ----------

def sanitize_filename(name):
    name = name.strip()
    name = re.sub(r'[\\/:*?"<>|]', "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name[:150] or None


def hhmmss_to_seconds(t):
    """Aceita número (segundos) ou string mm:ss / hh:mm:ss."""
    if t is None or t == "":
        return None
    if isinstance(t, (int, float)):
        return float(t)
    parts = str(t).split(":")
    seconds = 0.0
    for p in parts:
        seconds = seconds * 60 + float(p)
    return seconds


def extract_video_id(url):
    patterns = [
        r"(?:v=|/)([0-9A-Za-z_-]{11}).*",
        r"youtu\.be/([0-9A-Za-z_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def app_data_dir():
    """Pasta persistente do Content Lab fora do diretório do projeto/.exe."""
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        return os.path.join(base, "ContentLab")
    base = os.environ.get("XDG_CACHE_HOME") or os.path.join(Path.home(), ".cache")
    return os.path.join(base, "contentlab")


def legacy_app_data_dir():
    """Mantém compatibilidade com o cache criado pelas versões DengsClip."""
    base = os.environ.get("LOCALAPPDATA")
    if not base:
        base = os.path.join(os.path.expanduser("~"), ".dengsclip")
    return os.path.join(base, "DengsClip")


def video_cache_root():
    return os.path.join(app_data_dir(), "cache", "videos")


def legacy_video_cache_root():
    return os.path.join(legacy_app_data_dir(), "cache", "videos")


def _valid_cache_key(key):
    return bool(re.fullmatch(r"[0-9A-Za-z_-]{1,64}", (key or "").strip()))


def _dir_size_bytes(path):
    total = 0
    try:
        for root, _, files in os.walk(path):
            for name in files:
                try:
                    total += os.path.getsize(os.path.join(root, name))
                except OSError:
                    pass
    except OSError:
        pass
    return total


def _cache_dirs_for_key(key):
    if not _valid_cache_key(key):
        return []
    dirs = []
    for root in (video_cache_root(), legacy_video_cache_root()):
        candidate = os.path.abspath(os.path.join(root, key))
        root_abs = os.path.abspath(root)
        try:
            if os.path.commonpath([candidate, root_abs]) != root_abs:
                continue
        except ValueError:
            continue
        if os.path.isdir(candidate):
            dirs.append(candidate)
    return dirs


def resolve_cache_dir_by_key(key):
    dirs = _cache_dirs_for_key(key)
    # Prefere o cache atual do Content Lab quando houver duplicidade.
    current_root = os.path.abspath(video_cache_root())
    for path in dirs:
        if os.path.commonpath([os.path.abspath(path), current_root]) == current_root:
            return path
    return dirs[0] if dirs else None


def cached_entry(key, cache_dir):
    source = find_cached_source(cache_dir)
    if not source:
        return None
    meta = load_cache_metadata(cache_dir)
    video_id = meta.get("id") or (key if re.fullmatch(r"[0-9A-Za-z_-]{11}", key) else None)
    url = meta.get("webpage_url")
    if not url and video_id:
        url = f"https://www.youtube.com/watch?v={video_id}"
    return {
        "key": key,
        "id": video_id,
        "title": meta.get("title") or f"Vídeo em cache ({key})",
        "duration": meta.get("duration") or 0,
        "url": url,
        "thumbnail": meta.get("thumbnail"),
        "size_bytes": _dir_size_bytes(cache_dir),
        "source_file": os.path.basename(source),
        "legacy": os.path.abspath(cache_dir).startswith(os.path.abspath(legacy_video_cache_root())),
    }


def list_cached_videos():
    # Deduplica pelo ID/chave; o cache atual prevalece sobre o legado.
    entries = {}
    for root in (legacy_video_cache_root(), video_cache_root()):
        if not os.path.isdir(root):
            continue
        try:
            names = os.listdir(root)
        except OSError:
            continue
        for key in names:
            if not _valid_cache_key(key):
                continue
            cache_dir = os.path.join(root, key)
            if not os.path.isdir(cache_dir):
                continue
            entry = cached_entry(key, cache_dir)
            if entry:
                entries[key] = entry
    return sorted(entries.values(), key=lambda x: (x.get("title") or "").lower())


def cache_key_for_url(url):
    """Usa o ID do YouTube quando disponível; caso contrário, hash da URL."""
    video_id = extract_video_id(url)
    if video_id:
        return video_id
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]


def cache_dir_for_url(url):
    key = cache_key_for_url(url)
    current = os.path.join(video_cache_root(), key)
    legacy = os.path.join(legacy_app_data_dir(), "cache", "videos", key)
    # Se o vídeo já foi cacheado na versão antiga, reutiliza sem copiar gigabytes.
    if os.path.isdir(legacy) and find_cached_source(legacy):
        return legacy
    return current


def cache_metadata_path(cache_dir):
    return os.path.join(cache_dir, "metadata.json")


def load_cache_metadata(cache_dir):
    path = cache_metadata_path(cache_dir)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_cache_metadata(cache_dir, info, source_path, url):
    data = {
        "id": info.get("id") or extract_video_id(url),
        "title": info.get("title"),
        "duration": info.get("duration"),
        "webpage_url": info.get("webpage_url") or url,
        "thumbnail": info.get("thumbnail"),
        "source_file": os.path.basename(source_path),
    }
    try:
        with open(cache_metadata_path(cache_dir), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        # Cache de vídeo continua útil mesmo se a metadata não puder ser gravada.
        pass


def find_cached_source(cache_dir):
    """Retorna o vídeo completo finalizado no cache, ignorando fragmentos.

    yt-dlp pode deixar .part/.tmp/.f140/.f400 enquanto trabalha. Esses arquivos
    nunca devem ser tratados como um cache completo válido.
    """
    if not os.path.isdir(cache_dir):
        return None

    meta = load_cache_metadata(cache_dir)
    source_name = meta.get("source_file")
    if source_name:
        candidate = os.path.join(cache_dir, source_name)
        if os.path.isfile(candidate) and os.path.getsize(candidate) > 1024 * 1024:
            return candidate

    preferred = ["source.mp4", "source.mkv", "source.webm", "source.mov"]
    for name in preferred:
        candidate = os.path.join(cache_dir, name)
        if os.path.isfile(candidate) and os.path.getsize(candidate) > 1024 * 1024:
            return candidate

    valid_exts = {".mp4", ".mkv", ".webm", ".mov", ".m4v"}
    candidates = []
    for name in os.listdir(cache_dir):
        low = name.lower()
        ext = os.path.splitext(low)[1]
        if ext not in valid_exts:
            continue
        if low.endswith(".part") or ".f" in low and re.search(r"\.f\d+$", low):
            continue
        path = os.path.join(cache_dir, name)
        if os.path.isfile(path) and os.path.getsize(path) > 1024 * 1024:
            candidates.append(path)
    return max(candidates, key=os.path.getsize) if candidates else None


def cache_lock(cache_key):
    with CACHE_LOCKS_GUARD:
        return CACHE_LOCKS.setdefault(cache_key, threading.Lock())


def _download_source_to_cache(job, url, common_opts, ffmpeg_dir):
    """Garante uma cópia completa do vídeo no cache persistente e retorna (fonte, cache_dir)."""
    cache_key = cache_key_for_url(url)
    cache_dir = cache_dir_for_url(url)
    os.makedirs(cache_dir, exist_ok=True)

    lock = cache_lock(cache_key)
    with lock:
        entrada = find_cached_source(cache_dir)
        if entrada:
            job["message"] = "Vídeo encontrado no cache."
            job["percent"] = 100
            return entrada, cache_dir

        def hook_cache(d):
            if d.get("status") == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                downloaded = d.get("downloaded_bytes", 0)
                if total:
                    job["percent"] = round(downloaded / total * 100, 1)
                job["message"] = "Baixando o vídeo completo para o cache (só na primeira vez)..."
            elif d.get("status") == "finished":
                job["message"] = "Finalizando o vídeo no cache..."
                job["percent"] = 100

        opts = dict(common_opts)
        opts["progress_hooks"] = [hook_cache]
        opts["outtmpl"] = os.path.join(cache_dir, "source.%(ext)s")
        opts["format"] = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        opts["merge_output_format"] = "mp4"
        opts["ffmpeg_location"] = ffmpeg_dir

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

        entrada = find_cached_source(cache_dir)
        if not entrada:
            raise RuntimeError("O download completo terminou, mas o vídeo final não foi encontrado no cache.")
        save_cache_metadata(cache_dir, info or {}, entrada, url)
        return entrada, cache_dir


def _transcript_paths(cache_dir, model_name):
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", model_name or "small")
    base = os.path.join(cache_dir, f"transcript_{safe}")
    return base + ".json", base + ".srt", base + ".txt"


def _srt_ts(seconds):
    ms = int(round(max(0.0, float(seconds)) * 1000))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    sec, milli = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{milli:03d}"


def _txt_ts(seconds):
    total = max(0, int(float(seconds)))
    h, rem = divmod(total, 3600)
    m, sec = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{sec:02d}"


def _write_transcript_files(segments, srt_path, txt_path):
    with open(srt_path, "w", encoding="utf-8") as srt:
        for idx, seg in enumerate(segments, 1):
            srt.write(f"{idx}\n{_srt_ts(seg['start'])} --> {_srt_ts(seg['end'])}\n{seg['text'].strip()}\n\n")
    with open(txt_path, "w", encoding="utf-8") as txt:
        for seg in segments:
            txt.write(f"[{_txt_ts(seg['start'])} - {_txt_ts(seg['end'])}] {seg['text'].strip()}\n")


def ensure_transcript(job, url, common_opts, ffmpeg_dir, model_name="small"):
    """Transcreve o vídeo completo uma única vez e mantém JSON/SRT/TXT no cache."""
    entrada, cache_dir = _download_source_to_cache(job, url, common_opts, ffmpeg_dir)
    json_path, srt_path, txt_path = _transcript_paths(cache_dir, model_name)

    if os.path.isfile(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("segments"), list):
                job["message"] = "Transcrição encontrada no cache."
                job["percent"] = 100
                if not os.path.isfile(srt_path) or not os.path.isfile(txt_path):
                    _write_transcript_files(data["segments"], srt_path, txt_path)
                return data, cache_dir
        except Exception:
            pass

    job["message"] = f"Carregando modelo de transcrição ({model_name})..."
    job["percent"] = 100
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise RuntimeError(
            "O módulo de transcrição ainda não está instalado. Feche o Content Lab e execute iniciar.bat novamente para instalar o faster-whisper."
        ) from e

    # CPU/int8 funciona de forma consistente em Windows, inclusive sem GPU dedicada.
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    job["message"] = "Transcrevendo o vídeo. Na primeira vez isso pode demorar; depois ficará em cache..."
    job["indeterminate"] = True
    seg_iter, info = model.transcribe(
        entrada,
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=True,
        word_timestamps=True,
    )
    segments = []
    for seg in seg_iter:
        text = (seg.text or "").strip()
        if not text:
            continue
        words = [
            {"word": word.word.strip(), "start": float(word.start), "end": float(word.end)}
            for word in (seg.words or []) if word.word and word.start is not None and word.end is not None
        ]
        segments.append({"start": float(seg.start), "end": float(seg.end), "text": text, "words": words})

    data = {
        "model": model_name,
        "language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "segments": segments,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    _write_transcript_files(segments, srt_path, txt_path)
    job["indeterminate"] = False
    job["percent"] = 100
    job["message"] = "Transcrição concluída e salva no cache."
    return data, cache_dir


def _filter_transcript_segments(segments, start=None, end=None):
    if start is None or end is None:
        return list(segments)
    out = []
    for seg in segments:
        if float(seg["end"]) <= float(start) or float(seg["start"]) >= float(end):
            continue
        out.append({
            # Mantém os timestamps do vídeo original. Isso deixa os arquivos
            # úteis como índice para localizar cenas no material-fonte.
            "start": max(float(start), float(seg["start"])),
            "end": min(float(end), float(seg["end"])),
            "text": seg["text"],
        })
    return out


def export_transcript(job, url, folder, filename, start, end, full, common_opts, ffmpeg_dir, model_name="small"):
    data, _ = ensure_transcript(job, url, common_opts, ffmpeg_dir, model_name)
    segments = _filter_transcript_segments(data.get("segments", []), None if full else start, None if full else end)
    base = sanitize_filename(filename or "transcricao") or "transcricao"
    srt_path = os.path.join(folder, base + ".srt")
    txt_path = os.path.join(folder, base + ".txt")
    _write_transcript_files(segments, srt_path, txt_path)
    return [srt_path, txt_path]


def parse_strict_time(value):
    """Valida MM:SS ou HH:MM:SS sem aceitar formatos ambíguos."""
    value = (value or "").strip()
    if not re.fullmatch(r"\d{1,3}:\d{2}(?::\d{2})?", value):
        raise ValueError(f'"{value}" não é um tempo válido. Use MM:SS ou HH:MM:SS.')
    parts = [int(p) for p in value.split(":")]
    if len(parts) == 2:
        minutes, seconds = parts
        if seconds > 59:
            raise ValueError(f'"{value}" não é válido: segundos devem estar entre 00 e 59.')
        return minutes * 60 + seconds
    hours, minutes, seconds = parts
    if minutes > 59 or seconds > 59:
        raise ValueError(f'"{value}" não é válido: minutos e segundos devem estar entre 00 e 59.')
    return hours * 3600 + minutes * 60 + seconds


def parse_batch_text(text):
    """Formato obrigatório: tempo inicial;tempo final;título, uma linha por corte."""
    rows = []
    errors = []
    raw_lines = (text or "").splitlines()
    nonempty = [(i + 1, line.strip()) for i, line in enumerate(raw_lines) if line.strip()]
    if not nonempty:
        return [], ["Adicione pelo menos uma linha no formato: tempo inicial;tempo final;título."]

    for line_no, line in nonempty:
        parts = [p.strip() for p in line.split(";")]
        if len(parts) != 3:
            errors.append(
                f"Linha {line_no}: esperado exatamente 3 campos separados por ponto e vírgula (;): "
                "tempo inicial;tempo final;título."
            )
            continue
        start_raw, end_raw, title_raw = parts
        try:
            start = parse_strict_time(start_raw)
        except ValueError as e:
            errors.append(f"Linha {line_no}: tempo inicial inválido. {e}")
            continue
        try:
            end = parse_strict_time(end_raw)
        except ValueError as e:
            errors.append(f"Linha {line_no}: tempo final inválido. {e}")
            continue
        if end <= start:
            errors.append(f"Linha {line_no}: o tempo final precisa ser maior que o tempo inicial.")
            continue
        if not title_raw:
            errors.append(f"Linha {line_no}: o título está vazio.")
            continue
        safe_title = sanitize_filename(title_raw)
        if not safe_title:
            errors.append(f"Linha {line_no}: o título não contém caracteres válidos para nome de arquivo.")
            continue
        rows.append({
            "line": line_no,
            "start": float(start),
            "end": float(end),
            "title": safe_title,
            "start_text": start_raw,
            "end_text": end_raw,
        })
    return rows, errors


# ---------- routes ----------

@app.route("/")
def index():
    return render_template("index.html", default_dir=DEFAULT_DOWNLOAD_DIR)


@app.route("/api/cache", methods=["GET"])
def get_cache_list():
    try:
        return jsonify({"videos": list_cached_videos()})
    except Exception as e:
        return jsonify({"error": f"Não consegui listar o cache: {e}"}), 500


@app.route("/api/cache-preview/<cache_key>")
def cache_preview(cache_key):
    cache_dir = resolve_cache_dir_by_key(cache_key)
    if not cache_dir:
        return jsonify({"error": "Vídeo não encontrado no cache."}), 404
    source = find_cached_source(cache_dir)
    if not source or not os.path.isfile(source):
        return jsonify({"error": "Arquivo de vídeo do cache não foi encontrado."}), 404
    try:
        return send_file(source, conditional=True)
    except Exception as e:
        return jsonify({"error": f"Não consegui abrir a prévia do cache: {e}"}), 500


@app.route("/api/cache/open", methods=["POST"])
def open_cache_folder():
    data = request.get_json(force=True)
    key = (data.get("key") or "").strip()
    cache_dir = resolve_cache_dir_by_key(key)
    if not cache_dir:
        return jsonify({"error": "Vídeo não encontrado no cache."}), 404
    try:
        if sys.platform.startswith("win"):
            os.startfile(cache_dir)  # noqa
        elif sys.platform == "darwin":
            subprocess.Popen(["open", cache_dir])
        else:
            subprocess.Popen(["xdg-open", cache_dir])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/cache/delete", methods=["POST"])
def delete_cache_video():
    data = request.get_json(force=True)
    key = (data.get("key") or "").strip()
    if not _valid_cache_key(key):
        return jsonify({"error": "Identificador de cache inválido."}), 400

    active = [j for j in JOBS.values() if j.get("status") in ("queued", "running")]
    if active:
        return jsonify({
            "error": "Há um processamento em andamento. Aguarde terminar antes de apagar um vídeo do cache."
        }), 409

    dirs = _cache_dirs_for_key(key)
    if not dirs:
        return jsonify({"error": "Vídeo não encontrado no cache."}), 404

    deleted_bytes = 0
    deleted = []
    try:
        for cache_dir in dirs:
            deleted_bytes += _dir_size_bytes(cache_dir)
            shutil.rmtree(cache_dir)
            deleted.append(cache_dir)
        return jsonify({"ok": True, "deleted_bytes": deleted_bytes, "deleted": deleted})
    except Exception as e:
        return jsonify({"error": f"Não consegui apagar o cache: {e}"}), 500


@app.route("/api/info", methods=["POST"])
def get_info():
    data = request.get_json(force=True)
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "Cole um link do YouTube."}), 400
    try:
        ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        return jsonify({
            "id": info.get("id"),
            "title": info.get("title"),
            "duration": info.get("duration") or 0,
            "thumbnail": info.get("thumbnail"),
        })
    except Exception as e:
        return jsonify({"error": f"Não consegui carregar esse vídeo: {e}"}), 400


@app.route("/api/preview", methods=["POST"])
def get_preview():
    data = request.get_json(force=True)
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "Cole um link do YouTube."}), 400
    try:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "noplaylist": True,
            # formato progressivo (vídeo+áudio já juntos num arquivo só),
            # o que existe pra tocar direto num <video>, sem precisar mesclar
            "format": "best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]/best",
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        stream_url = info.get("url")
        if not stream_url:
            return jsonify({"error": "Não encontrei um formato tocável pra prévia."}), 400

        preview_id = uuid.uuid4().hex
        PREVIEWS[preview_id] = {
            "url": stream_url,
            "headers": info.get("http_headers") or {},
            "content_type": "video/mp4" if info.get("ext") == "mp4" else f"video/{info.get('ext', 'mp4')}",
        }
        return jsonify({"preview_id": preview_id})
    except Exception as e:
        return jsonify({"error": f"Prévia indisponível: {e}"}), 400


@app.route("/api/video-proxy/<preview_id>")
def video_proxy(preview_id):
    entry = PREVIEWS.get(preview_id)
    if not entry:
        return jsonify({"error": "Prévia expirada, recarregue o vídeo."}), 404

    headers = dict(entry["headers"])
    range_header = request.headers.get("Range")
    if range_header:
        headers["Range"] = range_header

    upstream = requests.get(entry["url"], headers=headers, stream=True, timeout=20)

    def generate():
        for chunk in upstream.iter_content(chunk_size=262144):
            if chunk:
                yield chunk

    out_headers = {}
    for h in ("Content-Type", "Content-Length", "Accept-Ranges", "Content-Range"):
        if h in upstream.headers:
            out_headers[h] = upstream.headers[h]
    out_headers.setdefault("Content-Type", entry["content_type"])
    out_headers.setdefault("Accept-Ranges", "bytes")

    return Response(
        stream_with_context(generate()),
        status=upstream.status_code,
        headers=out_headers,
    )


@app.route("/api/choose-folder", methods=["POST"])
def choose_folder():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        folder = filedialog.askdirectory(title="Escolher pasta de destino")
        root.destroy()
        return jsonify({"folder": folder or None})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/open-folder", methods=["POST"])
def open_folder():
    data = request.get_json(force=True)
    folder = data.get("folder")
    if not folder or not os.path.isdir(folder):
        return jsonify({"error": "Pasta não encontrada."}), 400
    try:
        if sys.platform.startswith("win"):
            os.startfile(folder)  # noqa
        elif sys.platform == "darwin":
            subprocess.Popen(["open", folder])
        else:
            subprocess.Popen(["xdg-open", folder])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


def export_full_from_cache(job, url, mode, folder, filename, common_opts, ffmpeg_dir):
    """Exporta vídeo/áudio inteiro usando a fonte persistente do cache.

    Se a fonte ainda não estiver no cache, baixa uma única vez para lá. Depois,
    pedidos futuros (inclusive de vídeo/áudio inteiro) reutilizam o mesmo arquivo.
    """
    entrada, cache_dir = _download_source_to_cache(job, url, common_opts, ffmpeg_dir)
    metadata = load_cache_metadata(cache_dir)
    base = sanitize_filename(filename or metadata.get("title") or "video") or "video"

    if mode == "video":
        destino = os.path.join(folder, base + ".mp4")
        job["message"] = "Copiando o vídeo do cache para a pasta escolhida..."
        # O cache é produzido preferencialmente em MP4. Se por alguma razão a
        # extensão for diferente, converte para MP4 para manter o contrato da UI.
        if os.path.splitext(entrada)[1].lower() == ".mp4":
            shutil.copy2(entrada, destino)
        else:
            ffmpeg_exe = os.path.join(ffmpeg_dir, "ffmpeg.exe" if os.name == "nt" else "ffmpeg")
            flags = 0x08000000 if os.name == "nt" else 0
            cmd = [ffmpeg_exe, "-y", "-i", entrada, "-c:v", "libx264", "-preset", "veryfast",
                   "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", destino]
            proc = subprocess.run(cmd, capture_output=True, text=True, creationflags=flags)
            if proc.returncode != 0 or not os.path.isfile(destino):
                detalhe = (proc.stderr or "").strip().splitlines()
                detalhe = detalhe[-1] if detalhe else "sem detalhes"
                raise RuntimeError(f"Falha ao exportar o vídeo do cache ({detalhe})")
        return destino

    destino = os.path.join(folder, base + ".mp3")
    job["message"] = "Extraindo o áudio do vídeo em cache..."
    ffmpeg_exe = os.path.join(ffmpeg_dir, "ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    flags = 0x08000000 if os.name == "nt" else 0
    cmd = [ffmpeg_exe, "-y", "-i", entrada, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", destino]
    proc = subprocess.run(cmd, capture_output=True, text=True, creationflags=flags)
    if proc.returncode != 0 or not os.path.isfile(destino):
        detalhe = (proc.stderr or "").strip().splitlines()
        detalhe = detalhe[-1] if detalhe else "sem detalhes"
        raise RuntimeError(f"Falha ao extrair o áudio do cache ({detalhe})")
    return destino


def run_download(job_id, url, mode, start, end, full, folder, filename=None, transcript_model="small"):
    job = JOBS[job_id]
    try:
        os.makedirs(folder, exist_ok=True)

        # Garante o ffmpeg ANTES de começar: procura na máquina e, se não
        # existir, baixa automaticamente (só na primeira vez), mostrando o
        # progresso na mesma barra do download.
        def ffmpeg_progress(percent, message):
            job["percent"] = percent
            job["message"] = message

        try:
            ffmpeg_dir = ffmpeg_helper.ensure_ffmpeg(ffmpeg_progress)
        except Exception as fe:
            raise RuntimeError(
                "Não consegui preparar o ffmpeg automaticamente "
                f"({fe}). Verifique sua conexão e tente de novo."
            )

        job["percent"] = 0
        job["message"] = "Iniciando..."

        def hook(d):
            if d.get("status") == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                downloaded = d.get("downloaded_bytes", 0)
                if total:
                    job["percent"] = round(downloaded / total * 100, 1)
                job["message"] = "Baixando..."
            elif d.get("status") == "finished":
                job["message"] = "Processando (ffmpeg)..."
                job["percent"] = 100

        if filename:
            base_name = sanitize_filename(filename) or "%(title)s"
            outtmpl = os.path.join(folder, base_name + ".%(ext)s")
        else:
            outtmpl = os.path.join(folder, "%(title)s.%(ext)s")

        def apply_format(opts):
            if mode == "audio":
                opts["format"] = "bestaudio/best"
                opts["postprocessors"] = [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }]
            else:
                opts["format"] = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
                opts["merge_output_format"] = "mp4"
            return opts

        common_opts = {
            "outtmpl": outtmpl,
            "progress_hooks": [hook],
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "ffmpeg_location": ffmpeg_dir,
            "socket_timeout": 30,
        }

        def do_ydl(opts):
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                fname = ydl.prepare_filename(info)
                if mode == "audio":
                    base, _ = os.path.splitext(fname)
                    fname = base + ".mp3"
                return fname

        if mode == "transcript":
            outputs = export_transcript(
                job, url, folder, filename, start, end, full, common_opts, ffmpeg_dir, transcript_model
            )
            job["filepaths"] = outputs
            filename = outputs[-1]
            job["status"] = "done"
            job["percent"] = 100
            job["message"] = "Transcrição concluída"
            job["filepath"] = filename
            job["folder"] = folder
            return

        trecho = (not full and start is not None and end is not None)

        if trecho:
            # Todo corte usa um vídeo completo persistente em cache. Na primeira
            # vez a URL é baixada para o cache interno; nos próximos cortes o
            # arquivo local é reutilizado imediatamente, sem baixar tudo de novo.
            job["indeterminate"] = False
            job["percent"] = 0
            filename = download_full_and_cut(
                job, url, mode, start, end, folder, outtmpl, common_opts, ffmpeg_dir,
            )
        else:
            # Vídeo/áudio inteiro também reutiliza o cache. Se ainda não existir,
            # a fonte completa é baixada uma única vez para o cache persistente.
            filename = export_full_from_cache(
                job, url, mode, folder, filename, common_opts, ffmpeg_dir
            )

        job["status"] = "done"
        job["percent"] = 100
        job["message"] = "Concluído"
        job["filepath"] = filename
        job["folder"] = folder
    except Exception as e:
        job["status"] = "error"
        job["error"] = friendly_error(str(e))


def download_full_and_cut(job, url, mode, start, end, folder, outtmpl, common_opts, ffmpeg_dir):
    """Obtém o vídeo completo do cache persistente e recorta localmente.

    O cache fica em %LOCALAPPDATA%\\ContentLab\\cache\\videos\\<video_id>.
    A pasta escolhida pelo usuário recebe SOMENTE o clipe final; vídeo completo,
    fragmentos de download e arquivos intermediários permanecem no cache interno.
    """
    cache_key = cache_key_for_url(url)
    cache_dir = cache_dir_for_url(url)
    os.makedirs(cache_dir, exist_ok=True)

    # Impede duas solicitações simultâneas da mesma URL de baixarem o vídeo
    # completo duas vezes. Solicitações diferentes continuam independentes.
    lock = cache_lock(cache_key)
    with lock:
        entrada = find_cached_source(cache_dir)
        info = load_cache_metadata(cache_dir)

        if entrada:
            job["message"] = "Vídeo encontrado no cache. Preparando o corte..."
            job["percent"] = 100
        else:
            def hook_cache(d):
                if d.get("status") == "downloading":
                    total = d.get("total_bytes") or d.get("total_bytes_estimate")
                    downloaded = d.get("downloaded_bytes", 0)
                    if total:
                        job["percent"] = round(downloaded / total * 100, 1)
                    job["message"] = "Baixando o vídeo completo para o cache (só na primeira vez)..."
                elif d.get("status") == "finished":
                    job["message"] = "Finalizando o vídeo no cache..."
                    job["percent"] = 100

            opts = dict(common_opts)
            opts["progress_hooks"] = [hook_cache]
            opts["outtmpl"] = os.path.join(cache_dir, "source.%(ext)s")
            # Sempre guarda vídeo+áudio completos. Assim o mesmo cache atende
            # tanto cortes em MP4 quanto pedidos de áudio em MP3.
            opts["format"] = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
            opts["merge_output_format"] = "mp4"

            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)

            entrada = find_cached_source(cache_dir)
            if not entrada:
                # Fallback para mudanças de nome/extensão do yt-dlp. Nunca usa
                # fragmentos (.tmp/.f###/.part) como fonte final.
                media_exts = {".mp4", ".mkv", ".webm", ".mov", ".m4v"}
                candidates = []
                for name in os.listdir(cache_dir):
                    path = os.path.join(cache_dir, name)
                    ext = os.path.splitext(name.lower())[1]
                    if ext in media_exts and os.path.isfile(path):
                        candidates.append(path)
                if candidates:
                    entrada = max(candidates, key=os.path.getsize)

            if not entrada or not os.path.isfile(entrada):
                raise RuntimeError("O download completo terminou, mas o vídeo final não foi encontrado no cache.")

            save_cache_metadata(cache_dir, info or {}, entrada, url)

    # Depois que o cache está pronto, nenhuma mídia intermediária é copiada para
    # a pasta de saída. O ffmpeg lê diretamente do arquivo persistente no cache.
    metadata = load_cache_metadata(cache_dir)
    title = metadata.get("title") or (info.get("title") if isinstance(info, dict) else None)

    base = os.path.splitext(os.path.basename(outtmpl))[0]
    if base == "%(title)s":
        base = sanitize_filename(title or "clip") or "clip"
    ext = ".mp3" if mode == "audio" else ".mp4"
    destino = os.path.join(folder, base + ext)

    job["message"] = "Cortando o trecho a partir do cache..."
    job["percent"] = 100
    ffmpeg_exe = os.path.join(ffmpeg_dir, "ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    dur = max(0.1, float(end) - float(start))
    if mode == "audio":
        cmd = [ffmpeg_exe, "-y", "-ss", str(start), "-i", entrada, "-t", str(dur),
               "-vn", "-acodec", "libmp3lame", "-b:a", "192k", destino]
    else:
        # Re-encode rápido para corte exato no timecode escolhido. Com -c copy,
        # o início poderia pular para o keyframe anterior.
        cmd = [ffmpeg_exe, "-y", "-ss", str(start), "-i", entrada, "-t", str(dur),
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
               "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", destino]
    flags = 0x08000000 if os.name == "nt" else 0  # CREATE_NO_WINDOW
    proc = subprocess.run(cmd, capture_output=True, text=True, creationflags=flags)
    if proc.returncode != 0 or not os.path.isfile(destino):
        detalhe = (proc.stderr or "").strip().splitlines()
        detalhe = detalhe[-1] if detalhe else "sem detalhes"
        raise RuntimeError(f"Falha ao cortar o trecho localmente ({detalhe})")

    return destino


def friendly_error(msg):
    """Traduz os erros mais comuns do yt-dlp/ffmpeg pra algo que o
    usuário entenda, em vez de códigos malucos tipo 3436169992."""
    low = msg.lower()
    if "ffmpeg exited with code" in low or "403" in msg or "forbidden" in low:
        return (
            "O YouTube recusou o acesso a esse vídeo (erro 403). Isso quase "
            "sempre significa que esta versão do Content Lab ficou desatualizado "
            "— atualize o Content Lab. Enquanto isso, vale tentar de "
            "novo em alguns minutos ou baixar o vídeo inteiro em vez de um trecho."
        )
    if "sign in to confirm" in low or "age" in low and "restrict" in low:
        return (
            "Esse vídeo tem restrição de idade ou pede login no YouTube — "
            "não dá pra baixar ele por aqui."
        )
    if "private video" in low or "unavailable" in low and "video" in low:
        return "Esse vídeo está privado ou foi removido do YouTube."
    if "winerror 10061" in low or "connection" in low and ("refused" in low or "aborted" in low or "reset" in low):
        return "Problema de conexão com a internet — confere a rede e tenta de novo."
    if "no space left" in low or "disk full" in low or "errno 28" in low:
        return "O disco encheu! Libera espaço na pasta de destino e tenta de novo."
    return msg


@app.route("/api/download", methods=["POST"])
def start_download():
    data = request.get_json(force=True)
    url = (data.get("url") or "").strip()
    mode = data.get("mode", "video")
    transcript_model = data.get("transcript_model", "small")
    full = bool(data.get("full", False))
    folder = (data.get("folder") or "").strip()
    filename = (data.get("filename") or "").strip() or None

    if not url:
        return jsonify({"error": "Cole um link do YouTube."}), 400
    if not folder:
        return jsonify({"error": "Escolha uma pasta de destino."}), 400
    if mode not in {"video", "audio", "transcript"}:
        return jsonify({"error": "Formato inválido."}), 400
    if transcript_model not in {"tiny", "base", "small", "medium"}:
        return jsonify({"error": "Modelo de transcrição inválido."}), 400

    start = end = None
    if not full:
        start = hhmmss_to_seconds(data.get("start"))
        end = hhmmss_to_seconds(data.get("end"))
        if start is None or end is None or end <= start:
            return jsonify({"error": "Intervalo de corte inválido."}), 400

    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"status": "running", "percent": 0, "message": "Iniciando...",
                     "error": None, "filepath": None, "folder": None}

    t = threading.Thread(target=run_download, args=(job_id, url, mode, start, end, full, folder, filename, transcript_model), daemon=True)
    t.start()

    return jsonify({"job_id": job_id})



def run_batch_download(job_id, url, mode, folder, clips, transcript_model="small"):
    job = JOBS[job_id]
    try:
        os.makedirs(folder, exist_ok=True)

        def ffmpeg_progress(percent, message):
            job["message"] = message
            job["percent"] = min(5, round((percent or 0) * 0.05, 1))

        try:
            ffmpeg_dir = ffmpeg_helper.ensure_ffmpeg(ffmpeg_progress)
        except Exception as fe:
            raise RuntimeError(
                "Não consegui preparar o ffmpeg automaticamente "
                f"({fe}). Verifique sua conexão e tente de novo."
            )

        total = len(clips)
        job["items"] = [
            {"line": c["line"], "title": c["title"], "status": "waiting", "filepath": None, "error": None}
            for c in clips
        ]
        outputs = []

        # Opções usadas apenas para preparar/reutilizar a fonte em cache.
        common_opts = {
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "ffmpeg_location": ffmpeg_dir,
            "socket_timeout": 30,
        }

        transcript_data = None
        if mode == "transcript":
            transcript_data, _ = ensure_transcript(job, url, common_opts, ffmpeg_dir, transcript_model)

        for idx, clip in enumerate(clips):
            item = job["items"][idx]
            item["status"] = "running"
            job["message"] = f"Processando {idx + 1}/{total}: {clip['title']}"
            job["percent"] = round((idx / total) * 100, 1)

            outtmpl = os.path.join(folder, clip["title"] + ".%(ext)s")
            try:
                if mode == "transcript":
                    segments = _filter_transcript_segments(
                        transcript_data.get("segments", []), clip["start"], clip["end"]
                    )
                    srt_path = os.path.join(folder, clip["title"] + ".srt")
                    txt_path = os.path.join(folder, clip["title"] + ".txt")
                    _write_transcript_files(segments, srt_path, txt_path)
                    destino = txt_path
                    item["filepaths"] = [srt_path, txt_path]
                    outputs.extend([srt_path, txt_path])
                else:
                    destino = download_full_and_cut(
                        job, url, mode, clip["start"], clip["end"], folder,
                        outtmpl, common_opts, ffmpeg_dir,
                    )
                    outputs.append(destino)
                item["status"] = "done"
                item["filepath"] = destino
            except Exception as e:
                item["status"] = "error"
                item["error"] = friendly_error(str(e))
                # Por pedido do usuário, validação impede início; durante execução,
                # uma falha pontual não apaga os cortes já concluídos.

            job["percent"] = round(((idx + 1) / total) * 100, 1)

        failed = [i for i in job["items"] if i["status"] == "error"]
        job["status"] = "done" if not failed else "done_with_errors"
        job["percent"] = 100
        job["message"] = "Todos os cortes foram concluídos." if not failed else f"Lote concluído com {len(failed)} erro(s)."
        job["filepaths"] = outputs
        job["filepath"] = outputs[-1] if outputs else None
        job["folder"] = folder
    except Exception as e:
        job["status"] = "error"
        job["error"] = friendly_error(str(e))


@app.route("/api/batch-download", methods=["POST"])
def start_batch_download():
    data = request.get_json(force=True)
    url = (data.get("url") or "").strip()
    mode = data.get("mode", "video")
    transcript_model = data.get("transcript_model", "small")
    folder = (data.get("folder") or "").strip()
    batch_text = data.get("batch_text") or ""

    if not url:
        return jsonify({"error": "Cole um link do YouTube."}), 400
    if not folder:
        return jsonify({"error": "Escolha uma pasta de destino."}), 400
    if mode not in {"video", "audio", "transcript"}:
        return jsonify({"error": "Formato inválido."}), 400
    if transcript_model not in {"tiny", "base", "small", "medium"}:
        return jsonify({"error": "Modelo de transcrição inválido."}), 400

    clips, errors = parse_batch_text(batch_text)
    if errors:
        return jsonify({
            "error": "O lote contém erros. Corrija antes de continuar.",
            "validation_errors": errors,
        }), 400

    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "status": "running", "percent": 0, "message": "Validado. Iniciando lote...",
        "error": None, "filepath": None, "filepaths": [], "folder": folder,
        "items": [], "batch": True,
    }
    threading.Thread(
        target=run_batch_download,
        args=(job_id, url, mode, folder, clips, transcript_model),
        daemon=True,
    ).start()
    return jsonify({"job_id": job_id, "count": len(clips)})


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
        result = transcribe_narration(root, narration, model, detail, language, progress=lambda message: job.update(message=message))
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
        root = str(project_plan_path(request.form.get("projectRoot"))[0])
        with EDITOR_JOBS_LOCK:
            if any(job["status"] == "running" and job["projectRoot"] == root for job in EDITOR_JOBS.values()):
                return jsonify({"error": "Aguarde o render antes de transcrever."}), 409
        with TRANSCRIPTION_JOBS_LOCK:
            if any(job["status"] == "running" and job["projectRoot"] == root for job in TRANSCRIPTION_JOBS.values()):
                return jsonify({"error": "Já existe uma transcrição em andamento neste projeto."}), 409
            imported = import_narration(root, upload)
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
        report = render_project(root, mode=mode, progress=on_progress, hardware_accel=hardware_accel, runner=CancelRunner(cancel_event))
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


def _shutdown_process(delay=0.6):
    """Encerra o processo inteiro depois de dar tempo da resposta HTTP chegar ao navegador.

    O Content Lab roda Flask + ícone da bandeja no mesmo processo Python. Encerrar
    o processo fecha os dois de uma vez, inclusive quando iniciado por pythonw.exe.
    """
    import time
    time.sleep(delay)
    os._exit(0)


@app.route("/api/shutdown", methods=["POST"])
def shutdown_app():
    data = request.get_json(silent=True) or {}
    force = bool(data.get("force", False))

    running = [
        job_id for job_id, job in JOBS.items()
        if job.get("status") == "running"
    ]
    running.extend(job_id for job_id, job in EDITOR_JOBS.items() if job.get("status") == "running")

    if running and not force:
        return jsonify({
            "error": "Há um download/corte em andamento.",
            "active_jobs": len(running),
            "requires_force": True,
        }), 409

    # Faz o desligamento em outra thread para a resposta chegar ao navegador
    # antes de o servidor e o ícone da bandeja serem encerrados.
    threading.Thread(target=_shutdown_process, daemon=True).start()
    return jsonify({"ok": True, "message": "Content Lab encerrando..."})


@app.route("/api/progress/<job_id>")
def progress(job_id):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job não encontrado."}), 404
    return jsonify(job)


if __name__ == "__main__":
    ffmpeg_helper.prewarm_async()
    print("Servidor rodando em http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
