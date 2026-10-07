"""Frame-based renderer for the image/text motion-design subset of edit_plan 0.2."""

import math
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFont


DEFAULT_TRANSFORM = {"x": 0.5, "y": 0.5, "scale": 1.0, "rotation": 0.0, "opacity": 1.0}


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


def _font(size):
    for name in ("DejaVuSans-Bold.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def _element_image(element, height):
    if element.type == "image":
        with Image.open(element.asset_path) as source:
            picture = source.convert("RGBA")
        max_width, max_height = int(height * 0.9), int(height * 0.7)
        ratio = min(max_width / picture.width, max_height / picture.height)
        return picture.resize((max(1, round(picture.width * ratio)), max(1, round(picture.height * ratio))), Image.Resampling.LANCZOS)
    text = str(element.data.get("text", ""))
    font = _font(max(12, round(height * 0.1)))
    temporary = Image.new("RGBA", (1, 1))
    bounds = ImageDraw.Draw(temporary).textbbox((0, 0), text, font=font, stroke_width=max(1, height // 300))
    image = Image.new("RGBA", (max(1, bounds[2] - bounds[0] + 8), max(1, bounds[3] - bounds[1] + 8)))
    draw = ImageDraw.Draw(image)
    colors = {"impact_yellow": "#FFD400", "paper_word": "#111111", "versus_big": "#FF334F"}
    draw.text((4 - bounds[0], 4 - bounds[1]), text, font=font, fill=colors.get(element.data.get("style"), "#FFFFFF"), stroke_width=max(1, height // 300), stroke_fill="#000000")
    return image


def render_motion_scene(ffmpeg, scene, output, project, duration, run, work_dir, video_encoding):
    """Render a 0.2 continuous canvas, then encode it with the existing FFmpeg path."""
    width, height = project.width, project.height
    world_size = (width * 2, height * 2)
    if scene.background_path:
        with Image.open(scene.background_path) as source:
            background = _cover(source.convert("RGBA"), world_size)
    else:
        color = ImageColor.getrgb(scene.background.get("color", "#000000"))
        background = Image.new("RGBA", world_size, (*color, 255))
    images = {element.data["id"]: _element_image(element, height) for element in scene.elements if element.type in {"image", "text"}}
    frames_dir = Path(work_dir) / f"{output.stem}-frames"
    frames_dir.mkdir()
    frame_count = max(1, round(duration * project.fps))
    camera_initial = {"x": 0.5, "y": 0.5, "scale": 1.0}
    camera_frames = scene.camera.get("keyframes", [])
    for index in range(frame_count):
        t = index / project.fps
        camera = interpolate(camera_initial, camera_frames, t)
        view_width = width / camera["scale"]
        view_height = height / camera["scale"]
        center_x = camera["x"] * world_size[0]
        center_y = camera["y"] * world_size[1]
        center_x = max(view_width / 2, min(world_size[0] - view_width / 2, center_x))
        center_y = max(view_height / 2, min(world_size[1] - view_height / 2, center_y))
        left = center_x - view_width / 2
        top = center_y - view_height / 2
        canvas = background.crop((round(left), round(top), round(left + view_width), round(top + view_height)))
        canvas = canvas.resize((width, height), Image.Resampling.BICUBIC)
        for element in scene.elements:
            if element.type not in {"image", "text"} or not element.start - scene.start <= t < element.end - scene.start:
                continue
            initial = {**DEFAULT_TRANSFORM, **element.data.get("transform", {})}
            state = interpolate(initial, element.data.get("keyframes", []), t)
            if state["opacity"] <= 0:
                continue
            image = images[element.data["id"]]
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
