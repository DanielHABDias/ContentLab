from config import *
from whisper_srt import generate_srt
from video_editor import edit_video


def main():
    generate_srt(INPUT_VIDEO, SRT_FILE)

    edit_video(
        INPUT_VIDEO,
        OUTPUT_VIDEO,
        SRT_FILE,
        MIN_SILENCE_MS,
        SILENCE_THRESHOLD,
        ZOOM_FACTOR,
        WATERMARK_TEXT,
        TEST_MODE,
        TEST_START,
        TEST_DURATION
    )


if __name__ == "__main__":
    main()
