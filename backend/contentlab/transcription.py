"""Project narration transcription, independent of YouTube downloads."""

import json
import os
import tempfile
from pathlib import Path

from .errors import PlanValidationError

try:
    from ..audio_decode import decode_for_whisper
except ImportError:  # Importação direta de contentlab no executável.
    from audio_decode import decode_for_whisper


def transcription_folder(directory):
    """A transcription workspace only needs an existing directory, not edit_plan.json."""
    if not isinstance(directory, str) or not directory.strip():
        raise PlanValidationError([{"path": "folder", "message": "Escolha uma pasta para salvar a transcrição."}])
    root = Path(directory).expanduser().resolve()
    if not root.is_dir():
        raise PlanValidationError([{"path": "folder", "message": "A pasta de destino não existe."}])
    return root

MODELS = frozenset({"tiny", "base", "small", "medium"})
DETAILS = frozenset({"segments", "words"})


def _timestamp(seconds, srt=False):
    millis = round(max(0, float(seconds)) * 1000)
    hours, remainder = divmod(millis, 3600000)
    minutes, remainder = divmod(remainder, 60000)
    secs, ms = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}{',' if srt else '.'}{ms:03d}"


def _atomic_text(path, content):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", prefix=".transcript-", suffix=".tmp", dir=path.parent, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def transcribe_narration(project_root, narration, model_name="small", detail="words", language=None, model_factory=None, progress=None):
    root = transcription_folder(str(project_root))
    source = Path(narration).resolve()
    if root not in source.parents or not source.is_file():
        raise ValueError("A narração precisa ser um arquivo dentro do projeto.")
    if model_name not in MODELS or detail not in DETAILS:
        raise ValueError("Modelo ou detalhamento inválido.")
    if language and (not isinstance(language, str) or not language.isalpha() or len(language) not in (2, 3)):
        raise ValueError("Idioma inválido.")
    if model_factory is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise RuntimeError("faster-whisper não está instalado no ambiente Python.") from exc
        model_factory = WhisperModel
    if progress:
        progress("Carregando modelo de transcrição...")
    model = model_factory(model_name, device="cpu", compute_type="int8")
    if progress:
        progress("Lendo o áudio da narração...")
    audio = decode_for_whisper(source)
    if progress:
        progress("Transcrevendo a narração com tempos por palavra...")
    segments_iter, info = model.transcribe(audio, beam_size=5, vad_filter=True, condition_on_previous_text=True, word_timestamps=True, **({"language": language} if language else {}))
    segments = []
    for item in segments_iter:
        text = (item.text or "").strip()
        if not text:
            continue
        words = [{"word": word.word.strip(), "start": float(word.start), "end": float(word.end)} for word in (item.words or []) if word.word and word.start is not None and word.end is not None]
        segments.append({"start": float(item.start), "end": float(item.end), "text": text, "words": words})
    stat = source.stat()
    data = {"model": model_name, "language": getattr(info, "language", language), "language_probability": getattr(info, "language_probability", None), "source": source.relative_to(root).as_posix(), "sourceSize": stat.st_size, "sourceMtimeNs": stat.st_mtime_ns, "segments": segments}
    lines = []
    if detail == "words":
        for segment in segments:
            lines.extend(f"[{_timestamp(word['start'])} → {_timestamp(word['end'])}] {word['word']}" for word in segment["words"])
    else:
        lines = [f"[{_timestamp(segment['start'])} → {_timestamp(segment['end'])}] {segment['text']}" for segment in segments]
    srt = "".join(f"{index}\n{_timestamp(segment['start'], True)} --> {_timestamp(segment['end'], True)}\n{segment['text']}\n\n" for index, segment in enumerate(segments, 1))
    _atomic_text(root / "transcript.json", json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    _atomic_text(root / "transcript.txt", "\n".join(lines) + ("\n" if lines else ""))
    _atomic_text(root / "transcript.srt", srt)
    return {"projectRoot": str(root), "transcript": "transcript.json", "text": "transcript.txt", "subtitles": "transcript.srt", "segmentCount": len(segments), "wordCount": sum(len(item["words"]) for item in segments), "language": data["language"], "detail": detail, "preview": "\n".join(lines[:150])}
