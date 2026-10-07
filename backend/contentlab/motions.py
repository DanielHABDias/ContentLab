"""Presets semânticos de movimento convertidos em filtros FFmpeg."""


SUPPORTED_ENTER = frozenset({"cut", "none", "fade", "slide_up", "pop_in"})
SUPPORTED_IDLE = frozenset({"none", "float_soft", "slow_zoom_in", "slow_zoom_out", "pan", "pulse_soft"})
SUPPORTED_EXIT = frozenset({"cut", "none", "fade", "fade_out"})


def _seconds(value):
    return f"{float(value):.3f}"


def motion_filters(animation, width, height, fps, duration, start, end):
    """Filtros para um layer; os tempos são relativos à cena."""
    enter = animation.get("enter", "cut")
    idle = animation.get("idle", "none")
    exit_motion = animation.get("exit", "cut")
    filters = []
    frames = max(1, round(duration * fps))
    if idle in {"slow_zoom_in", "slow_zoom_out", "pan"}:
        if idle == "slow_zoom_in":
            z = f"min(1+on*0.08/{frames},1.08)"
            x = "iw/2-(iw/zoom/2)"
            y = "ih/2-(ih/zoom/2)"
        elif idle == "slow_zoom_out":
            z = f"max(1.08-on*0.08/{frames},1)"
            x = "iw/2-(iw/zoom/2)"
            y = "ih/2-(ih/zoom/2)"
        else:
            z = "1.12"
            x = f"(iw-iw/zoom)*on/{frames}"
            y = "ih/2-(ih/zoom/2)"
        filters.append(f"zoompan=z='{z}':x='{x}':y='{y}':d=1:s={width}x{height}:fps={fps}")
    if enter in {"fade", "pop_in"}:
        filters.append(f"fade=t=in:st={_seconds(start)}:d={_seconds(min(0.35, max(0.08, end-start)))}:alpha=1")
    if exit_motion in {"fade", "fade_out"}:
        filters.append(f"fade=t=out:st={_seconds(max(start, end-0.35))}:d={_seconds(min(0.35, max(0.08, end-start)))}:alpha=1")
    return filters


def overlay_position(x, y, height, animation, start):
    """Coordenadas animadas para overlay, sem comandos shell."""
    idle = animation.get("idle", "none")
    enter = animation.get("enter", "cut")
    position_y = str(y)
    if enter == "slide_up":
        position_y = f"{y}+{height}*max(0,1-(t-{_seconds(start)})/0.40)"
    if idle == "float_soft":
        position_y += f"+8*sin((t-{_seconds(start)})*2.5)"
    return str(x), position_y.replace(",", r"\,")
