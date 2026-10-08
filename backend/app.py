import os
import sys
import uuid
import threading
import subprocess
import shutil
from pathlib import Path

from flask import Flask, render_template, request, jsonify, Response, stream_with_context, send_file
import yt_dlp
import requests

try:
    from . import ffmpeg_helper
    from .contentlab.project import render_project
    from .contentlab.transcription import transcribe_narration
    from .contentlab.catalog import build_ai_catalog
except ImportError:  # Suporte ao executável gerado pelo PyInstaller.
    import ffmpeg_helper
    from contentlab.project import render_project
    from contentlab.transcription import transcribe_narration
    from contentlab.catalog import build_ai_catalog


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


@app.route("/api/catalog/download", methods=["GET"])
def download_ai_catalog():
    content = build_ai_catalog(Path(resource_path(".")))
    return Response(content, mimetype="text/markdown; charset=utf-8", headers={
        "Content-Disposition": 'attachment; filename="catalogo-contentlab-para-ia.md"',
    })


@app.route("/api/editor/backgrounds", methods=["GET"])
def editor_backgrounds():
    """List installed background media without exposing arbitrary filesystem paths."""
    root = Path(resource_path("builtin-assets/backgrounds")).resolve()
    allowed = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".mp4", ".mov", ".mkv", ".webm"}
    assets = []
    if root.is_dir():
        for path in sorted(root.rglob("*")):
            if path.is_file() and path.suffix.lower() in allowed and root in path.resolve().parents:
                relative = path.relative_to(root).as_posix()
                assets.append({"name": path.name, "uri": f"builtin://backgrounds/{relative}", "type": "video" if path.suffix.lower() in {".mp4", ".mov", ".mkv", ".webm"} else "image"})
    return jsonify({"backgrounds": assets})


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

DEFAULT_DOWNLOAD_DIR = str(Path.home() / "Downloads")


# ---------- helpers ----------

try:
    from .download_support import (
        _cache_dirs_for_key, _dir_size_bytes, _download_source_to_cache,
        _filter_transcript_segments, _valid_cache_key, _write_transcript_files,
        cache_dir_for_url, cache_key_for_url, cache_lock, ensure_transcript,
        export_transcript, find_cached_source, hhmmss_to_seconds,
        list_cached_videos, load_cache_metadata, parse_batch_text,
        resolve_cache_dir_by_key, sanitize_filename, save_cache_metadata,
    )
except ImportError:
    from download_support import (
        _cache_dirs_for_key, _dir_size_bytes, _download_source_to_cache,
        _filter_transcript_segments, _valid_cache_key, _write_transcript_files,
        cache_dir_for_url, cache_key_for_url, cache_lock, ensure_transcript,
        export_transcript, find_cached_source, hhmmss_to_seconds,
        list_cached_videos, load_cache_metadata, parse_batch_text,
        resolve_cache_dir_by_key, sanitize_filename, save_cache_metadata,
    )


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
        try:
            root.withdraw()
            root.attributes("-topmost", True)
            folder = filedialog.askdirectory(title="Escolher pasta de destino")
        finally:
            root.destroy()
        return jsonify({"folder": folder or None})
    except Exception:
        # Linux frequentemente tem Zenity, mas não o módulo opcional tkinter.
        chooser = shutil.which("zenity") if os.name != "nt" else None
        if chooser:
            try:
                result = subprocess.run([chooser, "--file-selection", "--directory", "--title=Escolher pasta de destino"], capture_output=True, text=True, timeout=180)
                if result.returncode == 0:
                    folder = result.stdout.strip()
                    return jsonify({"folder": folder if folder and Path(folder).is_dir() else None})
                if result.returncode == 1:
                    return jsonify({"folder": None})
            except (OSError, subprocess.TimeoutExpired):
                pass
        return jsonify({"error": "Seletor gráfico indisponível. Digite o caminho da pasta no campo."}), 400


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


try:
    from .editor_routes import register_editor_routes
except ImportError:  # PyInstaller pode importar app como módulo de topo.
    from editor_routes import register_editor_routes

register_editor_routes(app, EDITOR_JOBS, EDITOR_JOBS_LOCK, EDITOR_CANCEL_EVENTS,
                       TRANSCRIPTION_JOBS, TRANSCRIPTION_JOBS_LOCK, sys.modules[__name__])

try:
    from .visual_test_routes import register_visual_test_routes
except ImportError:
    from visual_test_routes import register_visual_test_routes

register_visual_test_routes(app, sys.modules[__name__])


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
