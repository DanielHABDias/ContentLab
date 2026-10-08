"""Frame-based compositor for continuous edit_plan 0.2 scenes."""

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageColor, ImageDraw, ImageFilter, ImageFont

from .text import STYLE_DEFINITIONS, _phrase_words, caption_chunk, transcript_words
from .typography import appearance, bundled_font_path
from .errors import RenderCancelled


def _ease(value, name):
    value = max(0.0, min(1.0, value))
    if name == "ease_in":
        return value * value
    if name == "ease_out":
        return 1 - (1 - value) ** 2
    if name == "ease_in_out":
        return value * value * (3 - 2 * value)
    return value


def interpolate(initial, keyframes, t):
    """Keyframe values persist; easing on the destination frame governs arrival."""
    state = dict(initial)
    previous_t = 0.0
    for frame in keyframes:
        destination = {**state, **{k: v for k, v in frame.items() if k not in {"t", "easing"}}}
        end_t = float(frame["t"])
        if t < end_t and end_t > previous_t:
            fraction = _ease((t - previous_t) / (end_t - previous_t), frame.get("easing", "linear"))
            return {key: state[key] + (destination[key] - state[key]) * fraction for key in state}
        state = destination
        previous_t = end_t
    return state


def _cover(image, size):
    width, height = size
    ratio = max(width / image.width, height / image.height)
    resized = image.resize((math.ceil(image.width * ratio), math.ceil(image.height * ratio)), Image.Resampling.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def _fit(image, size, mode="contain"):
    if mode == "cover":
        return _cover(image, size)
    if mode == "stretch":
        return image.resize(size, Image.Resampling.LANCZOS)
    width, height = size
    ratio = min(width / image.width, height / image.height)
    resized = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(resized, ((width - resized.width) // 2, (height - resized.height) // 2))
    return canvas


def _media_frames(ffmpeg, path, directory, fps, duration, run, loop=False):
    directory.mkdir()
    count = max(1, round(duration * fps))
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    if loop:
        command += ["-stream_loop", "-1"]
    command += ["-i", str(path), "-vf", f"fps={fps},tpad=stop_mode=clone:stop_duration={duration:.3f},format=rgba", "-frames:v", str(count), "-start_number", "0", str(directory / "frame-%06d.png")]
    run(command)
    frames = sorted(directory.glob("frame-*.png"))
    if not frames:
        raise ValueError(f"Vídeo sem quadros decodificáveis: {path}")
    return frames


def _grid_anchor(region, width, height):
    x, y, cell_width, cell_height = region
    return 0.25 + (x + cell_width / 2) / (2 * width), 0.25 + (y + cell_height / 2) / (2 * height)


def _font(size, font_path=None, family=None):
    for name in (font_path, bundled_font_path(family), "DejaVuSansCondensed-Bold.ttf", "DejaVuSans-Bold.ttf", "Arial.ttf"):
        if not name:
            continue
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def _element_image(element, width, height, text_override=None):
    if element.type in {"image", "video", "overlay"}:
        with Image.open(element.asset_path) as source:
            picture = source.convert("RGBA")
        size = element.region[2:] if element.data.get("cells") else (round(width * 0.8), round(height * 0.8))
        return _fit(picture, size, element.data.get("fit", "contain"))
    look = appearance(element.data)
    text = str(text_override if text_override is not None else element.data.get("text", ""))
    measure_text = str(element.data.get("text", "")) if element.data.get("reveal") else text
    if look["uppercase"]:
        text, measure_text = text.upper(), measure_text.upper()
    style = STYLE_DEFINITIONS.get(element.data.get("style", "impact"), STYLE_DEFINITIONS["impact"])
    limit_width, limit_height = element.region[2:]
    size = max(12, round(min(limit_height * 0.6, limit_width * 0.26) * float(element.data.get("fontScale", 1))))
    font = _font(size, element.data.get("_font_path"), look["fontFamily"])
    temporary = Image.new("RGBA", (1, 1))
    stroke = round(look["outlineWidth"]) if look["outlineWidth"] is not None else 0 if style.get("outline_width") == 0 else max(1, round(size * 0.055))
    bounds = ImageDraw.Draw(temporary).textbbox((0, 0), measure_text, font=font, stroke_width=stroke)
    while bounds[2] - bounds[0] > limit_width * 0.94 and size > 12:
        size = max(12, round(size * 0.85))
        font = _font(size, element.data.get("_font_path"), look["fontFamily"])
        stroke = round(look["outlineWidth"]) if look["outlineWidth"] is not None else 0 if style.get("outline_width") == 0 else max(1, round(size * 0.055))
        bounds = ImageDraw.Draw(temporary).textbbox((0, 0), measure_text, font=font, stroke_width=stroke)
    has_shadow = look["shadow"] is not None
    shadow = look["shadow"] or {}
    blur = float(shadow.get("blur", 8))
    offset_x, offset_y = float(shadow.get("offsetX", 3)), float(shadow.get("offsetY", 4))
    padding = max(4, math.ceil(blur * 3 + max(abs(offset_x), abs(offset_y)) + stroke)) if has_shadow else 4
    image = Image.new("RGBA", (max(1, bounds[2] - bounds[0] + 2 * padding), max(1, bounds[3] - bounds[1] + 2 * padding)))
    if has_shadow:
        shadow_layer = Image.new("RGBA", image.size)
        shadow_color = ImageColor.getrgb(shadow.get("color", "#000000")) + (255 if "color" in shadow else 153,)
        ImageDraw.Draw(shadow_layer).text((padding - bounds[0] + offset_x, padding - bounds[1] + offset_y), text, font=font, fill=shadow_color, stroke_width=stroke, stroke_fill=shadow_color)
        image.alpha_composite(shadow_layer.filter(ImageFilter.GaussianBlur(blur)))
    draw = ImageDraw.Draw(image)
    draw.text((padding - bounds[0], padding - bounds[1]), text, font=font, fill=look["color"] or style["primary"], stroke_width=stroke, stroke_fill=look["outlineColor"] or style["outline"])
    return image


def _highlight_caption_image(element, words, absolute):
    caption_range = element.data.get("range") or {}
    start = float(caption_range.get("start", element.start))
    end = float(caption_range.get("end", element.end))
    config = element.data.get("config", {})
    chunk, active_local, active_global = caption_chunk(words, absolute, start, end, config.get("maxWords", 7))
    if not chunk or active_local is None:
        return None

    look = appearance(element.data)
    style = STYLE_DEFINITIONS["bangers_highlight_block"]
    uppercase = look["uppercase"]
    labels = [str(word["word"]).upper() if uppercase else str(word["word"]) for word in chunk]
    limit_width, limit_height = element.region[2:]
    size = max(16, round(min(limit_height * 0.42, limit_width * 0.075) * float(element.data.get("fontScale", 0.5))))
    colors = config.get("highlightColors") or ["#2563EB", "#E53935", "#111111"]
    radius = float(config.get("highlightRadius", 14))
    pad_x = float(config.get("highlightPaddingX", 10))
    pad_y = float(config.get("highlightPaddingY", 5))
    gap = max(4, round(size * 0.12))
    line_gap = max(4, round(size * 0.16))
    usable_width = limit_width * 0.90
    usable_height = limit_height * 0.82

    def measure(font_size):
        font = _font(font_size, element.data.get("_font_path"), look["fontFamily"])
        stroke = round(look["outlineWidth"]) if look["outlineWidth"] is not None else max(1, round(font_size * 0.055))
        metrics = []
        probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        for label in labels:
            bounds = probe.textbbox((0, 0), label, font=font, stroke_width=stroke)
            metrics.append((bounds, max(1, bounds[2] - bounds[0]) + 2 * pad_x, max(1, bounds[3] - bounds[1]) + 2 * pad_y))
        lines, current, current_width = [], [], 0
        for index, metric in enumerate(metrics):
            word_width = metric[1]
            proposed = word_width if not current else current_width + gap + word_width
            if current and proposed > usable_width:
                lines.append(current)
                current, current_width = [index], word_width
            else:
                current.append(index)
                current_width = proposed
        if current:
            lines.append(current)
        line_heights = [max(metrics[index][2] for index in line) for line in lines]
        total_height = sum(line_heights) + line_gap * max(0, len(lines) - 1)
        max_width = max((sum(metrics[index][1] for index in line) + gap * max(0, len(line) - 1) for line in lines), default=0)
        return font, stroke, metrics, lines, line_heights, max_width, total_height

    font, stroke, metrics, lines, line_heights, max_width, total_height = measure(size)
    while size > 16 and (max_width > usable_width or total_height > usable_height):
        size = max(16, round(size * 0.9))
        font, stroke, metrics, lines, line_heights, max_width, total_height = measure(size)

    image = Image.new("RGBA", (limit_width, limit_height))
    shadow = look["shadow"] or {"color": "#000000", "blur": 8, "offsetX": 3, "offsetY": 4}
    shadow_layer = Image.new("RGBA", image.size)
    shadow_draw = ImageDraw.Draw(shadow_layer)
    draw = ImageDraw.Draw(image)
    y = (limit_height - total_height) / 2
    active_color = colors[int(active_global or 0) % len(colors)]

    for line, line_height in zip(lines, line_heights):
        line_width = sum(metrics[index][1] for index in line) + gap * max(0, len(line) - 1)
        x = (limit_width - line_width) / 2
        for index in line:
            bounds, word_width, word_height = metrics[index]
            top = y + (line_height - word_height) / 2
            if index == active_local:
                draw.rounded_rectangle(
                    (x, top, x + word_width, top + word_height),
                    radius=max(0, min(radius, word_height / 2)),
                    fill=active_color,
                )
            text_x = x + pad_x - bounds[0]
            text_y = top + pad_y - bounds[1]
            shadow_color = ImageColor.getrgb(shadow.get("color", "#000000")) + (153,)
            shadow_draw.text(
                (text_x + float(shadow.get("offsetX", 3)), text_y + float(shadow.get("offsetY", 4))),
                labels[index], font=font, fill=shadow_color, stroke_width=stroke, stroke_fill=shadow_color,
            )
            draw.text(
                (text_x, text_y), labels[index], font=font,
                fill=look["color"] or style["primary"], stroke_width=stroke,
                stroke_fill=look["outlineColor"] or style["outline"],
            )
            x += word_width + gap
        y += line_height + line_gap

    blur = float(shadow.get("blur", 8))
    if blur > 0:
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    shadow_layer.alpha_composite(image)
    return shadow_layer


def _visual_state(element, scene, t, width, height):
    anchor_x, anchor_y = _grid_anchor(element.region, width, height)
    state = interpolate({"x": anchor_x, "y": anchor_y, "scale": 1.0, "rotation": 0.0, "opacity": 1.0, **element.data.get("transform", {})}, element.data.get("keyframes", []), t)
    animation = element.data.get("animation", {})
    elapsed = t - (element.start - scene.start)
    remaining = element.end - scene.start - t
    total = element.end - element.start
    enter_time = min(float(animation.get("enterDuration", 0.45)), total)
    exit_time = min(float(animation.get("exitDuration", 0.35)), total)
    enter = animation.get("enter", "none")
    if enter_time and elapsed < enter_time:
        progress = _ease(elapsed / enter_time, "ease_out")
        if enter in {"slide_from_left", "slide_from_right", "slide_up", "slide_down"}:
            start_x, start_y = {
                "slide_from_left": (0.08, state["y"]),
                "slide_from_right": (0.92, state["y"]),
                "slide_up": (state["x"], 0.92),
                "slide_down": (state["x"], 0.08),
            }[enter]
            state["x"] = start_x + (state["x"] - start_x) * progress
            state["y"] = start_y + (state["y"] - start_y) * progress
        if enter in {"fade", "pop_in"}:
            state["opacity"] *= progress
        if enter == "pop_in":
            state["scale"] *= 0.65 + 0.35 * progress + 0.13 * math.sin(math.pi * progress)
    exit_motion = animation.get("exit", "none")
    if exit_time and remaining < exit_time:
        progress = _ease(1 - remaining / exit_time, "ease_in")
        if exit_motion == "slide_to_left":
            state["x"] += (0.08 - state["x"]) * progress
        elif exit_motion == "slide_to_right":
            state["x"] += (0.92 - state["x"]) * progress
        elif exit_motion == "slide_to_bottom":
            state["y"] += (0.92 - state["y"]) * progress
        elif exit_motion in {"fade", "fade_out"}:
            state["opacity"] *= 1 - progress
    idle = animation.get("idle", "none")
    if idle == "float_soft":
        state["y"] += 0.005 * math.sin(elapsed * 2)
    elif idle == "pulse_soft":
        state["scale"] *= 1 + 0.025 * math.sin(elapsed * 3)
    elif idle == "slow_zoom_in":
        state["scale"] *= 1 + 0.06 * elapsed / max(total, 0.01)
    elif idle == "slow_zoom_out":
        state["scale"] *= 1.06 - 0.06 * elapsed / max(total, 0.01)
    elif idle == "pan":
        state["x"] += 0.015 * elapsed / max(total, 0.01)
    return state


def _chroma(image, config):
    key = ImageColor.getrgb(str(config.get("keyColor", "#00FF00")).replace("0x", "#"))
    channels = image.convert("RGBA").split()
    index = key.index(max(key))
    others = [channels[i] for i in range(3) if i != index]
    difference = ImageChops.subtract(channels[index], ImageChops.lighter(others[0], others[1]))
    threshold = round(float(config.get("similarity", 0.18)) * 255)
    mask = difference.point(lambda value: 0 if value > threshold else 255)
    image.putalpha(ImageChops.multiply(channels[3], mask))
    return image


def _card(image, box):
    if not box:
        return image
    if isinstance(box, str):
        box = {"preset": box}
    if box.get("preset") != "floating_card" and not box.get("background"):
        return image
    padding = max(0, round(box.get("padding", 20)))
    radius = max(0, round(box.get("radius", 28)))
    card = Image.new("RGBA", (image.width + 2 * padding, image.height + 2 * padding))
    if box.get("shadow", "soft") != "none":
        shadow = Image.new("RGBA", card.size)
        ImageDraw.Draw(shadow).rounded_rectangle((padding + 3, padding + 6, card.width - 1, card.height - 1), radius=radius, fill=(0, 0, 0, 100))
        card.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(max(2, padding // 2))))
    if box.get("background"):
        ImageDraw.Draw(card).rounded_rectangle((padding, padding, card.width - padding - 1, card.height - padding - 1), radius=radius, fill=box["background"])
    card.alpha_composite(image, (padding, padding))
    return card


def render_motion_scene(ffmpeg, scene, output, project, duration, run, work_dir, video_encoding, transcript=None, cancel_event=None):
    """Render a continuous canvas with layered media, grid and camera."""
    width, height = project.width, project.height
    world_size = (width * 2, height * 2)
    video_suffixes = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
    background_video = bool(scene.background_path and scene.background_path.suffix.lower() not in video_suffixes)
    if background_video:
        background_frames = _media_frames(ffmpeg, scene.background_path, Path(work_dir) / f"{output.stem}-background", project.fps, duration, run, scene.background.get("loop", False))
    elif scene.background_path:
        with Image.open(scene.background_path) as source:
            background = _fit(source.convert("RGBA"), world_size, scene.background.get("fit", "cover"))
    else:
        color = ImageColor.getrgb(scene.background.get("color", "#000000"))
        background = Image.new("RGBA", world_size, (*color, 255))
    media = {}
    for media_index, element in enumerate(scene.elements):
        if element.type in {"video", "overlay"} and element.asset_path and element.asset_path.suffix.lower() not in video_suffixes:
            media[element.data["id"]] = _media_frames(ffmpeg, element.asset_path, Path(work_dir) / f"{output.stem}-media-{media_index}", project.fps, element.end - element.start, run, element.data.get("loop", False))
    images = {element.data["id"]: _element_image(element, width, height) for element in scene.elements if element.type in {"image", "text"} or element.type in {"video", "overlay"} and element.data["id"] not in media}
    words = transcript_words(transcript)
    phrases = {element.data["id"]: _phrase_words(element.data.get("text"), element.start, element.end, words) for element in scene.elements if element.type == "kinetic_text"}
    frames_dir = Path(work_dir) / f"{output.stem}-frames"
    frames_dir.mkdir()
    frame_count = max(1, round(duration * project.fps))
    camera_initial = {"x": 0.5, "y": 0.5, "scale": 1.0}
    camera_frames = scene.camera.get("keyframes", [])
    shake = scene.camera.get("shake", [])
    for index in range(frame_count):
        if cancel_event is not None and cancel_event.is_set():
            raise RenderCancelled("Render cancelado pelo usuário.")
        t = index / project.fps
        absolute_t = scene.start + t
        camera = interpolate(camera_initial, camera_frames, t)
        for effect in shake:
            if effect["start"] <= t < effect["end"]:
                fade = min(1.0, (t - effect["start"]) / 0.15, (effect["end"] - t) / 0.15)
                amplitude = effect.get("amplitude", 0.003) * max(0, fade)
                frequency = effect.get("frequency", 2.5)
                camera["x"] += amplitude * math.sin(2 * math.pi * frequency * t)
                camera["y"] += amplitude * math.sin(2 * math.pi * frequency * 1.37 * t)
        view_width = width / camera["scale"]
        view_height = height / camera["scale"]
        center_x = camera["x"] * world_size[0]
        center_y = camera["y"] * world_size[1]
        center_x = max(view_width / 2, min(world_size[0] - view_width / 2, center_x))
        center_y = max(view_height / 2, min(world_size[1] - view_height / 2, center_y))
        left = center_x - view_width / 2
        top = center_y - view_height / 2
        if background_video:
            with Image.open(background_frames[min(index, len(background_frames) - 1)]) as source:
                frame_background = _fit(source.convert("RGBA"), world_size, scene.background.get("fit", "cover"))
        else:
            frame_background = background
        canvas = frame_background.crop((round(left), round(top), round(left + view_width), round(top + view_height)))
        canvas = canvas.resize((width, height), Image.Resampling.BICUBIC)
        for element in scene.elements:
            if element.type == "sfx" or not element.start <= absolute_t < element.end:
                continue
            state = _visual_state(element, scene, t, width, height)
            if state["opacity"] <= 0:
                continue
            if element.data["id"] in media:
                paths = media[element.data["id"]]
                frame_index = min(max(0, round((absolute_t - element.start) * project.fps)), len(paths) - 1)
                with Image.open(paths[frame_index]) as source:
                    image = source.convert("RGBA")
                size = element.region[2:] if element.data.get("cells") else (round(width * 0.8), round(height * 0.8))
                image = _fit(image, size, element.data.get("fit", "contain"))
            elif element.type == "kinetic_text":
                active = next((word for word in phrases[element.data["id"]] if word["start"] <= absolute_t < word["end"]), None)
                if not active:
                    continue
                image = _element_image(element, width, height, active["word"])
            elif element.type == "text" and element.data.get("reveal"):
                reveal = element.data["reveal"]
                elapsed = absolute_t - element.start - reveal.get("delay", 0)
                if elapsed < 0:
                    continue
                text = element.data["text"]
                count = min(len(text), math.floor(elapsed * reveal["charactersPerSecond"]) + 1)
                if count <= 0:
                    continue
                image = _element_image(element, width, height, text[:count])
            elif element.type == "caption":
                if element.data.get("style") == "bangers_highlight_block":
                    image = _highlight_caption_image(element, words, absolute_t)
                    if image is None:
                        continue
                else:
                    caption_range = element.data.get("range") or {}
                    if not caption_range.get("start", element.start) <= absolute_t < caption_range.get("end", element.end):
                        continue
                    active_index = next((i for i, word in enumerate(words) if word["start"] <= absolute_t < word["end"]), None)
                    if active_index is None:
                        continue
                    group_start = (active_index // 4) * 4
                    image = _element_image(element, width, height, " ".join(word["word"] for word in words[group_start:group_start + 4]))
            else:
                image = images[element.data["id"]]
            if element.type == "overlay":
                image = _chroma(image.copy(), element.data.get("config", {}))
            image = _card(image, element.data.get("box"))
            scale = state["scale"] * camera["scale"]
            image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.LANCZOS)
            if state["rotation"]:
                image = image.rotate(-state["rotation"], resample=Image.Resampling.BICUBIC, expand=True)
            if state["opacity"] < 1:
                image.putalpha(image.getchannel("A").point(lambda alpha: round(alpha * state["opacity"])))
            x = round((state["x"] * world_size[0] - left) * camera["scale"] - image.width / 2)
            y = round((state["y"] * world_size[1] - top) * camera["scale"] - image.height / 2)
            canvas.alpha_composite(image, (x, y))
        canvas.convert("RGB").save(frames_dir / f"frame-{index:06d}.png")
    run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(project.fps), "-i", str(frames_dir / "frame-%06d.png"), "-frames:v", str(frame_count), "-an", *(video_encoding or ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"]), "-pix_fmt", "yuv420p", str(output)])
