"""Narration preparation and transcript timing for source cuts."""

from pathlib import Path
import wave

from .errors import RenderError
from .text import transcript_words


def remap_transcript(transcript, cuts):
    """Map original-source word timestamps onto the concatenated narration."""
    if not transcript or not cuts:
        return transcript
    words = transcript_words(transcript)
    mapped = []
    offset = 0.0
    for cut in cuts:
        start, end = float(cut["start"]), float(cut["end"])
        for word in words:
            overlap_start = max(start, word["start"])
            overlap_end = min(end, word["end"])
            if overlap_end > overlap_start:
                mapped.append({
                    "word": word["word"],
                    "start": round(offset + overlap_start - start, 6),
                    "end": round(offset + overlap_end - start, 6),
                })
        offset += end - start
    return {"words": mapped}


def prepare_narration(ffmpeg, source, output, audio_settings, runner):
    """Produce a cleaned WAV; cuts are kept ranges in source time."""
    cuts = audio_settings.get("sourceCuts", [])
    voice = audio_settings.get("voice", {})
    graph = []
    if cuts:
        for index, cut in enumerate(cuts):
            graph.append(f"[0:a]atrim=start={cut['start']}:end={cut['end']},asetpts=PTS-STARTPTS[c{index}]")
        graph.append("".join(f"[c{index}]" for index in range(len(cuts))) + f"concat=n={len(cuts)}:v=0:a=1[cut]")
        current = "cut"
    else:
        graph.append("[0:a]asetpts=PTS-STARTPTS[cut]")
        current = "cut"
    filters = []
    highpass = float(voice.get("highpassHz", 70))
    if highpass:
        filters.append(f"highpass=f={highpass:g}")
    normalized = voice.get("normalize", True)
    if normalized:
        filters.append(f"loudnorm=I={float(voice.get('targetLufs', -16)):g}:TP={float(voice.get('truePeakDb', -1.5)):g}:LRA=11")
    filters += ["aresample=48000", "aformat=sample_rates=48000:channel_layouts=stereo"]
    graph.append(f"[{current}]{','.join(filters)}[clean]")
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-filter_complex", ";".join(graph), "-map", "[clean]", "-c:a", "pcm_s16le", str(output)]
    runner(command)
    expected_duration = sum(float(cut["end"]) - float(cut["start"]) for cut in cuts) if cuts else None
    actual_duration = None
    if Path(output).stat().st_size > 44:
        with wave.open(str(output), "rb") as cleaned:
            actual_duration = cleaned.getnframes() / cleaned.getframerate()
        if expected_duration is not None and abs(actual_duration - expected_duration) > 0.06:
            raise RenderError("sourceCuts excedem a duração da narração ou produziram áudio incompleto.")
    return {
        "path": str(Path(output).resolve()),
        "sourceCuts": [{"sourceStart": float(cut["start"]), "sourceEnd": float(cut["end"])} for cut in cuts],
        "expectedDuration": expected_duration,
        "actualDuration": actual_duration,
        "normalization": {"enabled": normalized, "targetLufs": voice.get("targetLufs", -16) if normalized else None, "truePeakDb": voice.get("truePeakDb", -1.5) if normalized else None},
        "highpassHz": highpass,
    }
