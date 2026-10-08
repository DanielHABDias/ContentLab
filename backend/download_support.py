"""YouTube cache, transcription export and batch-input helpers."""

import hashlib
import json
import os
import re
import threading
from pathlib import Path

import yt_dlp

CACHE_LOCKS = {}
CACHE_LOCKS_GUARD = threading.Lock()

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
    try:
        from .audio_decode import decode_for_whisper
    except ImportError:
        from audio_decode import decode_for_whisper
    job["message"] = "Lendo o áudio para transcrição..."
    audio = decode_for_whisper(entrada)
    seg_iter, info = model.transcribe(
        audio,
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
