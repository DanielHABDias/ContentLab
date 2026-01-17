from pathlib import Path
from core.config_loader import load_config
from core.logger import setup_logger
from audio.extractor import extract_audio
from audio.chunker import split_audio
from transcription.whisper_transcriber import transcribe
from utils.filters import filter_segments
from ai.prompt_builder import build_prompt
from ai.gemini_client import call_gemini
from video.cutter import cut_video
from video.subtitles import generate_srt

def main():
    config = load_config()
    logger = setup_logger(config["paths"]["logs"], config["logging"]["level"])

    input_dir = Path(config["paths"]["input_videos"])
    audio_dir = Path(config["paths"]["temp_audio"])
    chunk_dir = Path(config["paths"]["temp_chunks"])
    output_dir = Path(config["paths"]["output_clips"])

    audio_dir.mkdir(parents=True, exist_ok=True)
    chunk_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    for video in input_dir.glob("*.*"):
        logger.info(f"Processing video: {video.name}")

        audio_path = audio_dir / f"{video.stem}.wav"
        extract_audio(video, audio_path)

        chunks = list(
            split_audio(
                audio_path,
                chunk_dir,
                config["chunking"]["chunk_minutes"],
                config["chunking"]["max_runs"]
            )
        )

        segments = transcribe(chunks, config["whisper"], logger)
        segments = filter_segments(segments)

        prompt = build_prompt(
            config["prompt"]["base"],
            config["prompt"]["instructions"],
            segments
        )

        clips = call_gemini(prompt, config["gemini"], logger)

        for idx, clip in enumerate(clips, start=1):
            srt_dir = Path(config["paths"]["temp_subs"])
            srt_dir.mkdir(exist_ok=True)

            srt_path = srt_dir / f"clip_{idx}.srt"

            generate_srt(
                segments,
                clip["start_time"],
                clip["end_time"],
                srt_path
            )

            cut_video(
                video,
                clip,
                output_dir,
                idx,
                config,
                srt_path
            )
            logger.info(f"Clip generated: {clip['title']}")

if __name__ == "__main__":
    main()