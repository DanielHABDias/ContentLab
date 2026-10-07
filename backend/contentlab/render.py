import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

from .errors import PlanValidationError, RenderError
from .service import prepare_edit_plan
from .text import build_scene_ass


def _creation_flags():
    return 0x08000000 if os.name == "nt" else 0


def _run(command, runner=subprocess.run):
    result = runner(command, capture_output=True, text=True, creationflags=_creation_flags())
    if result.returncode != 0:
        details = (result.stderr or result.stdout or "Erro desconhecido do FFmpeg.").strip().splitlines()
        raise RenderError("FFmpeg falhou: " + "\n".join(details[-12:]))


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
        if element.type in {"video", "image"} and element.asset_path and element.region == full_region:
            return element.asset_path, element.type, element.data.get("fit", "cover"), bool(element.data.get("loop"))
    if scene.background_path:
        suffix = scene.background_path.suffix.lower()
        kind = "image" if suffix in {".png", ".jpg", ".jpeg", ".webp", ".bmp"} else "video"
        return scene.background_path, kind, scene.background.get("fit", "cover"), bool(scene.background.get("loop"))
    return None


def _render_segment(ffmpeg, scene, output, project, duration, runner, warnings, transcript=None, work_dir=None):
    visual = _scene_visual(scene, (0, 0, project.width, project.height))
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

    ass_path = Path(work_dir or output.parent) / f"{output.stem}.ass"
    text_event_count, text_warnings = build_scene_ass(scene, project, transcript, ass_path)
    warnings.extend(text_warnings)
    if text_event_count:
        video_filter += f",subtitles=filename='{_filter_path(ass_path)}':original_size={project.width}x{project.height}"
    command += ["-t", str(duration), "-vf", video_filter]

    unsupported = [element.type for element in scene.elements if element.type not in {"video", "image", "text", "kinetic_text"}]
    if unsupported:
        warnings.append({"scene": scene.id, "code": "elements_not_rendered", "elements": unsupported})
    partial = [element.type for element in scene.elements if element.type in {"video", "image"} and element.region != (0, 0, project.width, project.height)]
    if partial:
        warnings.append({"scene": scene.id, "code": "positioned_elements_not_rendered", "elements": partial})
    if scene.transition_out != "cut":
        warnings.append({"scene": scene.id, "code": "transition_fallback", "requested": scene.transition_out, "used": "cut"})

    command += ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", str(output)]
    _run(command, runner)


def _concat_file_line(path):
    escaped = str(Path(path).resolve()).replace("\\", "/").replace("'", "'\\''")
    return f"file '{escaped}'\n"


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


def render_edit_plan(source, output_dir=None, project_root=None, ffmpeg_dir=None, runner=subprocess.run, progress=None):
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
    output = output_dir / "rough_cut.mp4"
    report_path = output_dir / "render_report.json"
    warnings = []
    actual_project_root = Path(project_root or (plan.source_path.parent if plan.source_path else Path.cwd())).resolve()
    transcript = _load_transcript(plan, actual_project_root, warnings)
    if plan.audio.get("sourceCuts"):
        warnings.append({"code": "source_cuts_not_applied", "message": "sourceCuts será implementado na fase de áudio."})

    try:
        with tempfile.TemporaryDirectory(prefix="contentlab-render-", dir=output_dir) as work:
            work = Path(work)
            segments = []
            cursor = 0.0
            render_scenes = []
            for scene in timeline.scenes:
                if scene.start > cursor:
                    render_scenes.append((None, scene.start - cursor))
                render_scenes.append((scene, scene.end - scene.start))
                cursor = scene.end

            for index, (scene, duration) in enumerate(render_scenes):
                segment = work / f"segment-{index:04d}.mp4"
                scene_for_render = scene
                if scene_for_render is None:
                    from .models import ResolvedScene
                    scene_for_render = ResolvedScene(id=f"gap-{index}", start=0, end=duration, transition_out="cut", elements=(), background={"color": "#000000"})
                if progress:
                    progress("scene", index + 1, len(render_scenes), scene_for_render.id)
                _render_segment(
                    ffmpeg, scene_for_render, segment, plan.project, duration, runner, warnings,
                    transcript=transcript, work_dir=work,
                )
                segments.append(segment)

            concat_list = work / "segments.ffconcat"
            concat_list.write_text("ffconcat version 1.0\n" + "".join(_concat_file_line(path) for path in segments), encoding="utf-8")
            visual = work / "visual.mp4"
            _run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(visual)], runner)

            temp_output = work / "rough_cut.mp4"
            audio_filter = f"[1:a]apad,atrim=0:{timeline.duration}[a]"
            _run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(visual), "-i", str(narration), "-filter_complex", audio_filter, "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(timeline.duration), str(temp_output)], runner)
            os.replace(temp_output, output)

        report = {
            "status": "completed", "project": plan.project.name, "version": plan.version,
            "output": str(output), "duration": timeline.duration, "scenes": len(timeline.scenes),
            "warnings": warnings, "elapsedSeconds": round(time.time() - started, 3),
        }
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return report
    except Exception as exc:
        report = {"status": "failed", "project": plan.project.name, "error": str(exc), "warnings": warnings, "elapsedSeconds": round(time.time() - started, 3)}
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        raise
