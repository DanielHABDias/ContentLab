import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

from .errors import PlanValidationError, RenderError, RenderCancelled
from .service import prepare_edit_plan
from .text import build_scene_ass
from .layout import box_geometry, create_card_assets
from .motions import motion_filters, overlay_position
from .transitions import discover_transitions
from .audio import prepare_narration, remap_transcript
from .encoding import select_h264_encoder
from .motion_renderer import render_motion_scene
from .remotion_bridge import render_remotion_scene


def _creation_flags():
    return 0x08000000 if os.name == "nt" else 0


def _run(command, runner=subprocess.run):
    result = runner(command, capture_output=True, text=True, creationflags=_creation_flags())
    if result.returncode != 0:
        details = (result.stderr or result.stdout or "Erro desconhecido do FFmpeg.").strip().splitlines()
        raise RenderError("FFmpeg falhou: " + "\n".join(details[-12:]))


def _verify_output(ffmpeg_dir, path, expected_duration, fps):
    probe = Path(ffmpeg_dir) / ("ffprobe.exe" if os.name == "nt" else "ffprobe")
    if not probe.is_file():
        return None
    result = subprocess.run(
        [str(probe), "-v", "error", "-show_entries", "stream=codec_type,duration,codec_name:format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, timeout=30, creationflags=_creation_flags(),
    )
    if result.returncode:
        raise RenderError("FFprobe não conseguiu verificar o vídeo gerado.")
    try:
        info = json.loads(result.stdout)
        streams = {stream["codec_type"]: stream for stream in info["streams"]}
        video_duration = float(streams["video"]["duration"])
        audio_duration = float(streams["audio"]["duration"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise RenderError("O vídeo gerado não contém áudio e vídeo válidos.") from exc
    tolerance = max(0.12, 2 / fps)
    if abs(video_duration - expected_duration) > tolerance or abs(audio_duration - expected_duration) > tolerance:
        raise RenderError(f"Duração incorreta: vídeo {video_duration:.2f}s, áudio {audio_duration:.2f}s; esperado {expected_duration:.2f}s.")
    return {"videoDuration": round(video_duration, 3), "audioDuration": round(audio_duration, 3), "videoCodec": streams["video"].get("codec_name"), "audioCodec": streams["audio"].get("codec_name")}


def _video_filter(fit, width, height, fps, duration):
    if fit == "contain":
        sizing = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black"
    elif fit == "stretch":
        sizing = f"scale={width}:{height}"
    else:
        sizing = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}"
    return f"{sizing},fps={fps},tpad=stop_mode=clone:stop_duration={duration},format=yuv420p"


def _filter_path(path):
    value = str(Path(path).resolve()).replace("\\", "/")
    return value.replace(":", r"\:").replace("'", r"\'").replace("[", r"\[").replace("]", r"\]")


def _scene_visual(scene, full_region):
    for element in scene.elements:
        if element.type in {"video", "image"} and element.asset_path and element.region == full_region and not element.data.get("box") and not element.data.get("animation"):
            return element.asset_path, element.type, element.data.get("fit", "cover"), bool(element.data.get("loop"))
    if scene.background_path:
        suffix = scene.background_path.suffix.lower()
        kind = "image" if suffix in {".png", ".jpg", ".jpeg", ".webp", ".bmp"} else "video"
        return scene.background_path, kind, scene.background.get("fit", "cover"), bool(scene.background.get("loop"))
    return None


def _render_segment(ffmpeg, scene, output, project, duration, runner, warnings, transcript=None, work_dir=None, video_encoding=None):
    full_region = (0, 0, project.width, project.height)
    visual = _scene_visual(scene, full_region)
    common = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    if visual:
        path, kind, fit, loop = visual
        if kind == "image":
            command = common + ["-loop", "1", "-framerate", str(project.fps), "-i", str(path)]
        else:
            command = common + (["-stream_loop", "-1"] if loop else []) + ["-i", str(path)]
        video_filter = _video_filter(fit, project.width, project.height, project.fps, duration)
    else:
        color = scene.background.get("color", "#000000")
        command = common + ["-f", "lavfi", "-i", f"color=c={color}:s={project.width}x{project.height}:r={project.fps}:d={duration}"]
        video_filter = "format=yuv420p"

    layers = [element for element in scene.elements if element.type in {"video", "image", "overlay"} and element.asset_path and (element.type == "overlay" or not visual or element.asset_path != visual[0] or element.region != full_region or element.data.get("box") or element.data.get("animation"))]
    graph = [f"[0:v]{video_filter}[base0]"]
    current = "base0"
    input_index = 1
    for layer_index, element in enumerate(layers):
        box, content, radius = box_geometry(element)
        x, y, width, height = content
        animation = element.data.get("animation") or {}
        local_start = max(0.0, element.start - scene.start)
        local_end = min(duration, element.end - scene.start)
        position_x, position_y = overlay_position(x, y, height, animation, local_start)
        enabled = f":enable='between(t,{local_start:.3f},{local_end:.3f})'" if local_start > 0 or local_end < duration else ""
        mask_path, backing_path = create_card_assets(element, work_dir or output.parent, f"{output.stem}-layer-{layer_index}")
        if backing_path:
            command += ["-loop", "1", "-i", str(backing_path)]
            next_label = f"backed{layer_index}"
            backing_x, backing_y = overlay_position(element.region[0], element.region[1], element.region[3], animation, local_start)
            backing_filters = ["format=rgba"] + motion_filters(
                {"enter": animation.get("enter", "cut"), "exit": animation.get("exit", "cut")},
                element.region[2], element.region[3], project.fps, duration, local_start, local_end,
            )
            graph.append(f"[{input_index}:v]{','.join(backing_filters)}[backing_layer{layer_index}]")
            graph.append(f"[{current}][backing_layer{layer_index}]overlay=x='{backing_x}':y='{backing_y}':eval=frame:shortest=0:repeatlast=1{enabled}[{next_label}]")
            current = next_label
            input_index += 1

        if element.type == "image" or (element.type == "overlay" and element.asset_path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}):
            command += ["-loop", "1", "-framerate", str(project.fps), "-i", str(element.asset_path)]
        else:
            command += (["-stream_loop", "-1"] if element.data.get("loop") else []) + ["-i", str(element.asset_path)]
        fit = element.data.get("fit", "cover")
        if fit == "contain":
            scale = f"format=rgba,scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black@0"
        elif fit == "stretch":
            scale = f"scale={width}:{height}"
        else:
            scale = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}"
        raw_label = f"layer{layer_index}"
        filters = [scale, "format=rgba"]
        if element.type == "overlay":
            config = element.data.get("config", {})
            chroma_color = str(config.get("keyColor", "0x00FF00")).replace("#", "0x")
            similarity = float(config.get("similarity", 0.18))
            blend = float(config.get("blend", 0.08))
            filters.append(f"chromakey={chroma_color}:{similarity:.3f}:{blend:.3f}")
        filters.extend(motion_filters(animation, width, height, project.fps, duration, local_start, local_end))
        graph.append(f"[{input_index}:v]{','.join(filters)}[{raw_label}]")
        input_index += 1
        if mask_path:
            command += ["-loop", "1", "-i", str(mask_path)]
            masked = f"masked{layer_index}"
            graph.append(f"[{raw_label}]split=2[colors{layer_index}][alpha_src{layer_index}]")
            graph.append(f"[alpha_src{layer_index}]alphaextract[alpha{layer_index}]")
            graph.append(f"[alpha{layer_index}][{input_index}:v]blend=all_mode=multiply[combined_alpha{layer_index}]")
            graph.append(f"[colors{layer_index}][combined_alpha{layer_index}]alphamerge[{masked}]")
            raw_label = masked
            input_index += 1
        next_label = f"composed{layer_index}"
        graph.append(f"[{current}][{raw_label}]overlay=x='{position_x}':y='{position_y}':eval=frame:shortest=0:repeatlast=1{enabled}[{next_label}]")
        current = next_label

    ass_path = Path(work_dir or output.parent) / f"{output.stem}.ass"
    text_event_count, text_warnings = build_scene_ass(scene, project, transcript, ass_path)
    warnings.extend(text_warnings)
    if text_event_count:
        subtitle_filter = f"subtitles=filename='{_filter_path(ass_path)}':original_size={project.width}x{project.height}"
        graph.append(f"[{current}]{subtitle_filter}[out]")
        current = "out"
    command += ["-t", str(duration), "-filter_complex", ";".join(graph), "-map", f"[{current}]"]

    unsupported = [element.type for element in scene.elements if element.type not in {"video", "image", "overlay", "sfx", "text", "kinetic_text", "caption"}]
    if unsupported:
        warnings.append({"scene": scene.id, "code": "elements_not_rendered", "elements": unsupported})
    command += ["-an", "-r", str(project.fps), *(video_encoding or ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"]), "-pix_fmt", "yuv420p", str(output)]
    _run(command, runner)


def _concat_file_line(path):
    escaped = str(Path(path).resolve()).replace("\\", "/").replace("'", "'\\''")
    return f"file '{escaped}'\n"


def _compose_visual(ffmpeg, segments, boundaries, durations, total, fps, work, runner, video_encoding=None):
    visual = work / "visual.mp4"
    if all(spec.ffmpeg_name is None for spec, _ in boundaries):
        concat_list = work / "segments.ffconcat"
        concat_list.write_text("ffconcat version 1.0\n" + "".join(_concat_file_line(path) for path in segments), encoding="utf-8")
        _run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(visual)], runner)
        return visual
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    graph = []
    for index, segment in enumerate(segments):
        command += ["-i", str(segment)]
        graph.append(f"[{index}:v]setpts=PTS-STARTPTS,format=yuv420p,fps={fps}[v{index}]")
    # Each transition is an independent short clip: outgoing tail -> frozen
    # first frame of the next scene. A chain of xfade filters can truncate
    # everything after the second transition on FFmpeg 6/7.
    for index, duration in enumerate(durations):
        incoming = boundaries[index - 1][1] if index else 0
        outgoing = boundaries[index][1] if index < len(boundaries) else 0
        labels = [f"rawbody{index}"]
        if outgoing:
            labels.append(f"rawtail{index}")
        if incoming:
            labels.append(f"rawfirst{index}")
        if len(labels) > 1:
            graph.append(f"[v{index}]split={len(labels)}" + "".join(f"[{label}]" for label in labels))
        else:
            graph.append(f"[v{index}]null[rawbody{index}]")
        body_duration = duration - outgoing
        graph.append(f"[rawbody{index}]trim=start=0:end={body_duration:.6f},setpts=PTS-STARTPTS,fps={fps}[body{index}]")
        if outgoing:
            graph.append(f"[rawtail{index}]trim=start={body_duration:.6f}:end={duration:.6f},setpts=PTS-STARTPTS,fps={fps}[tail{index}]")
        if incoming:
            graph.append(f"[rawfirst{index}]trim=start=0:end={1 / fps:.6f},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={incoming:.6f},trim=duration={incoming:.6f},fps={fps}[first{index}]")
    pieces = []
    for index in range(len(segments)):
        pieces.append(f"[body{index}]")
        if index < len(boundaries):
            spec, transition_duration = boundaries[index]
            if spec.ffmpeg_name:
                transition_label = f"transitionraw{index}" if spec.name == "blur_left" else f"transition{index}"
                graph.append(f"[tail{index}][first{index + 1}]xfade=transition={spec.ffmpeg_name}:duration={transition_duration:.6f}:offset=0[{transition_label}]")
                if spec.name == "blur_left":
                    graph.append(f"[{transition_label}]gblur=sigma=2[transition{index}]")
                pieces.append(f"[transition{index}]")
    graph.append("".join(pieces) + f"concat=n={len(pieces)}:v=1:a=0[out]")
    command += ["-filter_complex", ";".join(graph), "-map", "[out]", "-an", "-t", str(total), "-r", str(fps), *(video_encoding or ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"]), "-pix_fmt", "yuv420p", str(visual)]
    _run(command, runner)
    return visual


def _audio_mix(ffmpeg, visual, narration, plan, timeline, resolved_assets, output, runner):
    duration = timeline.duration
    sources = []
    for item in plan.audio.get("music", []):
        sources.append((item, resolved_assets[item["asset"]], "music", float(item["start"]), float(item["end"])))
    for scene in timeline.scenes:
        for element in scene.elements:
            if element.type == "sfx":
                sources.append((element.data, str(element.asset_path), "sfx", element.start, min(duration, element.start + float(element.data.get("config", {}).get("duration", 10)))))
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(visual), "-i", str(narration)]
    voice_trim = float(plan.audio.get("voice", {}).get("trimDb", 0))
    graph = [f"[1:a]apad,atrim=0:{duration},asetpts=PTS-STARTPTS,volume={voice_trim:g}dB[voice]"]
    music_labels = []
    sfx_labels = []
    applied = []
    input_index = 2
    for item, path, kind, start, end in sources:
        if end <= start or start >= duration:
            continue
        command += (["-stream_loop", "-1"] if kind == "music" else []) + ["-i", str(path)]
        length = min(end, duration) - start
        preset = item.get("preset", item.get("config", {}).get("preset", "normal"))
        presets = {"music": {"subtle": -22, "normal": -18, "present": -12, "music_only": -6}, "sfx": {"subtle": -12, "normal": -6, "strong": 0}}
        trim_db = float(item.get("trimDb", item.get("config", {}).get("trimDb", presets[kind].get(preset, presets[kind]["normal"]))))
        filters = [f"atrim=0:{length:.6f}", "asetpts=PTS-STARTPTS", "loudnorm=I=-16:TP=-1.5:LRA=11", "aresample=48000", "aformat=sample_rates=48000:channel_layouts=stereo", f"volume={trim_db:g}dB"]
        fade_in = min(float(item.get("fadeIn", item.get("config", {}).get("fadeIn", 0))), length)
        fade_out = min(float(item.get("fadeOut", item.get("config", {}).get("fadeOut", 0))), length)
        if fade_in:
            filters.append(f"afade=t=in:st=0:d={fade_in:.6f}")
        if fade_out:
            filters.append(f"afade=t=out:st={length - fade_out:.6f}:d={fade_out:.6f}")
        filters.append(f"adelay={round(start * 1000)}:all=1")
        filters += ["apad", f"atrim=0:{duration}"]
        label = f"audio{input_index}"
        graph.append(f"[{input_index}:a]{','.join(filters)}[{label}]")
        (music_labels if kind == "music" else sfx_labels).append(f"[{label}]")
        applied.append({"type": kind, "asset": item["asset"], "start": start, "end": min(end, duration), "trimDb": trim_db, "preset": preset, "normalized": True, "fadeIn": fade_in, "fadeOut": fade_out})
        input_index += 1
    mix_labels = []
    ducking = plan.audio.get("ducking", {})
    ducking_enabled = bool(music_labels) and ducking.get("enabled", True)
    if music_labels:
        if len(music_labels) == 1:
            graph.append(f"{music_labels[0]}anull[musicbed]")
        else:
            graph.append("".join(music_labels) + f"amix=inputs={len(music_labels)}:duration=longest:normalize=0[musicbed]")
        if ducking_enabled:
            graph.append("[voice]asplit=2[voice_mix][voice_side]")
            threshold = float(ducking.get("threshold", 0.02))
            ratio = float(ducking.get("ratio", 6))
            attack = float(ducking.get("attackMs", 40))
            release = float(ducking.get("releaseMs", 350))
            graph.append(f"[musicbed][voice_side]sidechaincompress=threshold={threshold:g}:ratio={ratio:g}:attack={attack:g}:release={release:g}[ducked]")
            mix_labels = ["[voice_mix]", "[ducked]"]
        else:
            mix_labels = ["[voice]", "[musicbed]"]
    else:
        mix_labels = ["[voice]"]
    mix_labels += sfx_labels
    graph.append("".join(mix_labels) + f"amix=inputs={len(mix_labels)}:duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:{duration}[mix]")
    audio_map = "[mix]"
    command += ["-filter_complex", ";".join(graph), "-map", "0:v:0", "-map", audio_map, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(duration), str(output)]
    _run(command, runner)
    return applied


def _load_transcript(plan, project_root, warnings):
    transcript_ref = plan.sources.get("transcript")
    if not transcript_ref:
        return None
    path = Path(transcript_ref).expanduser()
    if not path.is_absolute():
        path = (project_root / path).resolve()
    else:
        path = path.resolve()
    if path != project_root and project_root not in path.parents:
        raise PlanValidationError([{"path": "sources.transcript", "message": "A transcrição está fora da raiz do projeto."}])
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        warnings.append({"code": "transcript_unavailable", "path": str(path), "message": str(exc)})
        return None


def render_edit_plan(source, output_dir=None, project_root=None, ffmpeg_dir=None, runner=subprocess.run, progress=None, mode="rough", hardware_accel=False):
    if mode not in {"rough", "preview", "final"}:
        raise ValueError("Modo de render inválido.")
    started = time.time()
    plan, timeline, narration, validation = prepare_edit_plan(source, project_root)
    if not validation["valid"]:
        raise PlanValidationError([{"path": item["asset"], "message": f"Arquivo não encontrado: {item['path']}"} for item in validation["missingAssets"]])
    if not timeline.scenes:
        raise PlanValidationError([{"path": "timeline", "message": "A timeline precisa conter ao menos uma cena."}])

    if ffmpeg_dir is None:
        try:
            from backend import ffmpeg_helper
        except ImportError:
            import ffmpeg_helper
        ffmpeg_dir = ffmpeg_helper.ensure_ffmpeg()
    ffmpeg = str(Path(ffmpeg_dir) / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"))

    output_dir = Path(output_dir or (plan.source_path.parent / "output" if plan.source_path else Path.cwd() / "output")).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / {"rough": "rough_cut.mp4", "preview": "preview.mp4", "final": "final.mp4"}[mode]
    report_path = output_dir / "render_report.json"
    warnings = []
    video_encoding, video_encoder, encoder_warning = select_h264_encoder(ffmpeg, hardware_accel)
    if encoder_warning:
        warnings.append(encoder_warning)
    actual_project_root = Path(project_root or (plan.source_path.parent if plan.source_path else Path.cwd())).resolve()
    transcript = _load_transcript(plan, actual_project_root, warnings)
    transcript = remap_transcript(transcript, plan.audio.get("sourceCuts", []))

    try:
        with tempfile.TemporaryDirectory(prefix="contentlab-render-", dir=output_dir) as work:
            work = Path(work)
            cleaned_temp = work / "narration.cleaned.wav"
            narration_report = prepare_narration(
                ffmpeg, narration, cleaned_temp, plan.audio,
                lambda command: _run(command, runner),
            )
            if progress:
                progress("narration", 0, len(timeline.scenes), "Narração preparada")
            segments = []
            segment_durations = []
            boundaries = []
            transition_specs = discover_transitions()
            applied_transitions = []
            scene_renderers = []
            cursor = 0.0
            render_scenes = []
            for scene in timeline.scenes:
                if scene.start > cursor:
                    render_scenes.append((None, scene.start - cursor))
                render_scenes.append((scene, scene.end - scene.start))
                cursor = scene.end

            for index, (scene, duration) in enumerate(render_scenes):
                segment = work / f"segment-{index:04d}.mp4"
                lead_in = 0.0
                if index:
                    previous, previous_duration = render_scenes[index - 1]
                    spec = transition_specs[previous.transition_out] if previous and scene else transition_specs["cut"]
                    if previous and not scene and previous.transition_out != "cut":
                        warnings.append({"scene": previous.id, "code": "transition_gap", "requested": previous.transition_out, "used": "cut"})
                    if spec.ffmpeg_name:
                        requested_duration = previous.transition_duration if previous.transition_duration is not None else spec.duration
                        lead_in = min(requested_duration, previous_duration / 2, duration / 2)
                        lead_in = round(lead_in * plan.project.fps) / plan.project.fps
                        if lead_in:
                            applied_transitions.append({"from": previous.id, "to": scene.id, "type": spec.name, "duration": lead_in})
                        else:
                            warnings.append({"scene": previous.id, "code": "transition_too_short", "requested": spec.name, "used": "cut"})
                            spec = transition_specs["cut"]
                    boundaries.append((spec, lead_in))
                scene_for_render = scene
                if scene_for_render is None:
                    from .models import ResolvedScene
                    scene_for_render = ResolvedScene(id=f"gap-{index}", start=0, end=duration, transition_out="cut", elements=(), background={"color": "#000000"})
                if progress:
                    progress("scene", index + 1, len(render_scenes), scene_for_render.id)
                if plan.version == "0.2" and scene is not None:
                    if os.environ.get("CONTENTLAB_MOTION_ENGINE", "remotion") == "python" or any(element.type == "overlay" for element in scene.elements):
                        scene_renderers.append({"scene": scene.id, "renderer": "python"})
                        render_motion_scene(ffmpeg, scene_for_render, segment, plan.project, duration,
                                            lambda command: _run(command, runner), work, video_encoding, transcript, getattr(runner, "event", None))
                    else:
                        scene_renderers.append({"scene": scene.id, "renderer": "remotion"})
                        render_remotion_scene(scene_for_render, segment, plan.project, duration,
                                              work, runner=runner, transcript=transcript,
                                              cancel_event=getattr(runner, "event", None),
                                              hardware_accel=hardware_accel)
                else:
                    if scene is not None:
                        scene_renderers.append({"scene": scene.id, "renderer": "ffmpeg"})
                    _render_segment(
                        ffmpeg, scene_for_render, segment, plan.project, duration, runner, warnings,
                        transcript=transcript, work_dir=work, video_encoding=video_encoding,
                    )
                segments.append(segment)
                segment_durations.append(duration)

            if timeline.scenes[-1].transition_out != "cut":
                warnings.append({"scene": timeline.scenes[-1].id, "code": "transition_at_end", "requested": timeline.scenes[-1].transition_out, "used": "cut"})

            visual = _compose_visual(ffmpeg, segments, boundaries, segment_durations, timeline.duration, plan.project.fps, work, runner, video_encoding=video_encoding)
            if progress:
                progress("compose", len(render_scenes), len(render_scenes), "Vídeo composto")

            temp_output = work / output.name
            if progress:
                progress("audio", len(render_scenes), len(render_scenes), "Mixando áudio")
            applied_audio = _audio_mix(ffmpeg, visual, cleaned_temp, plan, timeline, validation["resolvedAssets"], temp_output, runner)
            output_probe = _verify_output(ffmpeg_dir, temp_output, timeline.duration, plan.project.fps)
            os.replace(temp_output, output)
            cleaned_output = output_dir / "narration.cleaned.wav"
            os.replace(cleaned_temp, cleaned_output)
            narration_report["path"] = str(cleaned_output)

        report = {
            "status": "completed", "project": plan.project.name, "version": plan.version, "mode": mode,
            "output": str(output), "outputBytes": output.stat().st_size, "duration": timeline.duration, "scenes": len(timeline.scenes), "videoEncoder": video_encoder,
            "warnings": warnings, "transitions": applied_transitions, "audioLayers": applied_audio,
            "sceneRenderers": scene_renderers,
            "narration": narration_report,
            "outputProbe": output_probe,
            "ducking": {
                "threshold": plan.audio.get("ducking", {}).get("threshold", 0.02),
                "ratio": plan.audio.get("ducking", {}).get("ratio", 6),
                "attackMs": plan.audio.get("ducking", {}).get("attackMs", 40),
                "releaseMs": plan.audio.get("ducking", {}).get("releaseMs", 350),
                "enabled": bool(any(layer["type"] == "music" for layer in applied_audio)) and plan.audio.get("ducking", {}).get("enabled", True),
            },
            "limiter": {"enabled": True, "limit": 0.95},
            "elapsedSeconds": round(time.time() - started, 3),
            "renderRealtimeFactor": round(timeline.duration / max(time.time() - started, 0.001), 2),
        }
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return report
    except Exception as exc:
        report = {"status": "cancelled" if isinstance(exc, RenderCancelled) else "failed", "project": plan.project.name, "error": str(exc), "warnings": warnings, "elapsedSeconds": round(time.time() - started, 3)}
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        raise
