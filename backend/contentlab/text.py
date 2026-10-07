import re
import unicodedata
from pathlib import Path


STYLE_DEFINITIONS = {
    "impact": {"font": "Arial", "size": 86, "primary": "#FFFFFF", "outline": "#000000", "outline_width": 6, "bold": True},
    "impact_yellow": {"font": "Arial", "size": 86, "primary": "#FFD400", "outline": "#000000", "outline_width": 6, "bold": True},
    "paper_word": {"font": "Arial", "size": 80, "primary": "#111111", "outline": "#F5E8CE", "outline_width": 10, "bold": True},
    "versus_big": {"font": "Arial", "size": 108, "primary": "#FF334F", "outline": "#FFFFFF", "outline_width": 5, "bold": True},
    "word_pop": {"font": "Arial", "size": 96, "primary": "#FFFFFF", "outline": "#000000", "outline_width": 7, "bold": True},
    "anton_karaoke": {"font": "Arial", "size": 62, "primary": "#FFFFFF", "outline": "#000000", "outline_width": 5, "bold": True},
    "anton_white": {"font": "Anton", "size": 86, "primary": "#FFFFFF", "outline": "#FFFFFF", "outline_width": 0, "bold": True},
}


def _ass_color(value):
    value = value.lstrip("#")
    if len(value) != 6:
        value = "FFFFFF"
    red, green, blue = value[0:2], value[2:4], value[4:6]
    return f"&H00{blue}{green}{red}"


def _ass_time(seconds):
    centiseconds = max(0, int(round(float(seconds) * 100)))
    hours, remainder = divmod(centiseconds, 360000)
    minutes, remainder = divmod(remainder, 6000)
    secs, cents = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{cents:02d}"


def _escape_text(value):
    return str(value).replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}").replace("\n", r"\N")


def _normalized_word(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", value.lower())


def transcript_words(transcript):
    words = []
    if not transcript:
        return words
    sources = transcript.get("words") or []
    for item in sources:
        if {"start", "end"} <= item.keys() and (item.get("word") or item.get("text")):
            words.append({"word": (item.get("word") or item.get("text")).strip(), "start": float(item["start"]), "end": float(item["end"])})
    for segment in transcript.get("segments", []):
        segment_words = segment.get("words") or []
        if segment_words:
            for item in segment_words:
                if {"start", "end"} <= item.keys() and (item.get("word") or item.get("text")):
                    words.append({"word": (item.get("word") or item.get("text")).strip(), "start": float(item["start"]), "end": float(item["end"])})
            continue
        tokens = str(segment.get("text", "")).split()
        if not tokens:
            continue
        start, end = float(segment.get("start", 0)), float(segment.get("end", 0))
        step = max(0.04, (end - start) / len(tokens))
        for index, token in enumerate(tokens):
            words.append({"word": token, "start": start + index * step, "end": min(end, start + (index + 1) * step)})
    return sorted(words, key=lambda item: (item["start"], item["end"]))


def _phrase_words(text, start, end, available):
    tokens = str(text or "").split()
    if not tokens:
        return []
    wanted = [_normalized_word(token) for token in tokens]
    candidates = [item for item in available if item["end"] > start and item["start"] < end]
    normalized = [_normalized_word(item["word"]) for item in candidates]
    for index in range(max(0, len(candidates) - len(tokens) + 1)):
        if normalized[index:index + len(tokens)] == wanted:
            return candidates[index:index + len(tokens)]
    step = max(0.04, (end - start) / len(tokens))
    return [{"word": token, "start": start + index * step, "end": min(end, start + (index + 1) * step)} for index, token in enumerate(tokens)]


def _style_line(name, style):
    return "Style: {name},{font},{size},{primary},{secondary},{outline},&H64000000,{bold},0,0,0,100,100,0,0,1,{outline_width},2,5,30,30,30,1".format(
        name=name,
        font=style["font"], size=style["size"], primary=_ass_color(style["primary"]),
        secondary=_ass_color("#FFD400"), outline=_ass_color(style["outline"]),
        bold=-1 if style.get("bold") else 0, outline_width=style["outline_width"],
    )


def build_scene_ass(scene, project, transcript, output):
    events = []
    warnings = []
    available_words = transcript_words(transcript)
    used_styles = set()
    for element in scene.elements:
        if element.type not in {"text", "kinetic_text", "caption"}:
            continue
        style_name = element.data.get("style") or ("anton_karaoke" if element.type == "caption" else "word_pop" if element.type == "kinetic_text" else "impact")
        used_styles.add(style_name)
        center_x = element.region[0] + element.region[2] // 2
        center_y = element.region[1] + element.region[3] // 2
        start = max(scene.start, element.start)
        end = min(scene.end, element.end)
        if end <= start:
            continue
        if element.type == "text":
            tags = rf"{{\an5\pos({center_x},{center_y})\fad(90,90)}}"
            events.append((start - scene.start, end - scene.start, style_name, tags + _escape_text(element.data.get("text", ""))))
            continue

        if element.type == "caption":
            caption_range = element.data.get("range") or {}
            start = max(start, float(caption_range.get("start", start)))
            end = min(end, float(caption_range.get("end", end)))
            if not transcript:
                raise ValueError(f"Cena {scene.id}: caption requer sources.transcript com timestamps.")
            words = [word for word in available_words if word["end"] > start and word["start"] < end]
            if not words:
                warnings.append({"scene": scene.id, "code": "caption_no_words", "message": "Nenhuma palavra da transcrição no intervalo da legenda."})
                continue
            # Keep karaoke groups narrow enough for preview and portrait formats.
            group_size = max(2, min(5, project.width // 300))
            for index, word in enumerate(words):
                word_start = max(start, word["start"])
                word_end = min(end, word["end"])
                if word_end <= word_start:
                    continue
                group_start = (index // group_size) * group_size
                group = words[group_start:group_start + group_size]
                parts = []
                for group_index, item in enumerate(group):
                    prefix = r"{\1c&H00D4FF&\fscx112\fscy112}" if group_start + group_index == index else r"{\1c&H00FFFFFF&\fscx100\fscy100}"
                    parts.append(prefix + _escape_text(item["word"]))
                caption_y = element.region[1] + int(element.region[3] * 0.78)
                tags = rf"{{\an5\pos({center_x},{caption_y})}}"
                events.append((word_start - scene.start, word_end - scene.start, style_name, tags + " ".join(parts)))
            continue

        words = _phrase_words(element.data.get("text"), start, end, available_words)
        if not available_words and element.data.get("sync") == "transcript":
            warnings.append({"scene": scene.id, "code": "kinetic_text_timing_fallback", "message": "Transcrição sem timestamps; palavras distribuídas uniformemente."})
        emphasis = {_normalized_word(word) for word in element.data.get("emphasis", [])}
        for word in words:
            word_start = max(start, word["start"])
            word_end = min(end, max(word["end"], word_start + 0.08))
            if word_end <= word_start:
                continue
            color = r"\1c&H00D4FF&" if _normalized_word(word["word"]) in emphasis else ""
            tags = rf"{{\an5\pos({center_x},{center_y}){color}\fad(50,50)\fscx118\fscy118\t(0,110,\fscx100\fscy100)}}"
            events.append((word_start - scene.start, word_end - scene.start, style_name, tags + _escape_text(word["word"])))

    if not events:
        return 0, warnings
    styles = [_style_line(name, STYLE_DEFINITIONS.get(name, STYLE_DEFINITIONS["impact"])) for name in sorted(used_styles)]
    header = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {project.width}", f"PlayResY: {project.height}", "ScaledBorderAndShadow: yes", "WrapStyle: 2", "",
        "[V4+ Styles]", "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
        *styles, "", "[Events]", "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ]
    lines = [f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},{style},,0,0,0,,{text}" for start, end, style, text in events]
    Path(output).write_text("\n".join(header + lines) + "\n", encoding="utf-8-sig")
    return len(events), warnings
