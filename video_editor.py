import os
from moviepy import (
    VideoFileClip,
    TextClip,
    CompositeVideoClip,
    concatenate_videoclips,
    ColorClip,
    VideoClip
)
from moviepy.video.fx import Crop, Resize
from moviepy.video.tools.subtitles import SubtitlesClip
import numpy as np

# ---------- Função de legenda ----------
def subtitle_generator(txt):
    words = txt.split(" ")
    if len(words) > 1:
        main_text = " ".join(words[:-1])
        last_word = words[-1]
    else:
        main_text = txt
        last_word = ""
    main_clip = TextClip(
        text=main_text,
        font_size=48,
        color="white",
        stroke_color="black",
        stroke_width=3,
        font="Arial-Bold"
    )
    last_clip = TextClip(
        text=" " + last_word,
        font_size=48,
        color="yellow",
        stroke_color="black",
        stroke_width=3,
        font="Arial-Bold"
    )
    combined = CompositeVideoClip([
        main_clip,
        last_clip.with_position((main_clip.w, 0))
    ])
    return combined.with_position(("center", "bottom"))

# ---------- Remover silêncios ----------
def remove_silence(
    clip,
    silence_threshold=0.01,
    min_silence_duration=0.7,
    window_size=0.1
):
    print("Detectando silêncios...")
    audio = clip.audio.to_soundarray(fps=16000)
    audio_mono = audio.mean(axis=1)
    window_samples = int(16000 * window_size)
    energy = []
    for i in range(0, len(audio_mono), window_samples):
        window = audio_mono[i:i + window_samples]
        energy.append(np.abs(window).mean())
    energy = np.array(energy)
    speaking = energy > silence_threshold
    segments = []
    start = None
    for i, active in enumerate(speaking):
        t = i * window_size
        if active and start is None:
            start = t
        elif not active and start is not None:
            duration = t - start
            if duration > min_silence_duration:
                segments.append((start, t))
            start = None
    if start is not None:
        segments.append((start, clip.duration))
    print("Segmentos detectados:", len(segments))
    subclips = [clip[max(0, s):min(e, clip.duration)] for s, e in segments]
    if not subclips:
        print("Nenhum segmento detectado, retornando vídeo original.")
        return clip
    return concatenate_videoclips(subclips)

# ---------- Cortar para 9:16 ----------
def crop_to_vertical(clip):
    w, h = clip.size
    target_width = int(h * 9 / 16)  # largura menor que a altura para 9:16

    # centraliza horizontalmente
    x_center = w // 2
    y_center = h // 2
    x1 = max(0, x_center - target_width // 2)
    y1 = 0  # topo
    x2 = x1 + target_width
    y2 = h  # mantém altura total

    return clip.with_effects([Crop(x1=x1, y1=y1, x2=x2, y2=y2)])

# ---------- Função principal ----------
def edit_video(
    input_video,
    output_video,
    srt_file=None,
    silence_ms=700,
    silence_thresh=0.01,
    zoom_factor=1.2,
    watermark_text="CANAL TESTE",
    test_mode=False,
    test_start=0,
    test_duration=30
):
    clip = VideoFileClip(input_video)
    
    if test_mode:
        clip = clip[test_start:test_start+test_duration]
    
    clip = remove_silence(clip, silence_thresh, silence_ms/1000)
    clip = crop_to_vertical(clip)
    blur_bg = clip.with_effects([Resize(zoom_factor)])
    
    layers = [blur_bg]

    # Legenda opcional
    if srt_file and os.path.exists(srt_file):
        # Checa se o arquivo não está vazio
        if os.path.getsize(srt_file) > 0:
            subs = SubtitlesClip(srt_file, subtitle_generator)
            layers.append(subs)
        else:
            print("⚠ Legenda encontrada, mas está vazia. Seguindo sem legenda.")
    else:
        print("⚠ Legenda não encontrada ou não fornecida, seguindo sem legenda.")

    # Marca d’água
    watermark = (
        TextClip(
            text=watermark_text,
            font_size=40,               # tamanho da fonte
            font="Comic-Sans-MS",       # fonte estilo quadrinhos, precisa estar instalada no Windows
            color="yellow",             # cor principal
            stroke_color="red",         # contorno para dar destaque
            stroke_width=2              # largura do contorno
        )
        .set_duration(clip.duration)
        .set_position(("left", "top"))  # canto superior esquerdo
    )

    final = CompositeVideoClip(layers)
    
    final.write_videofile(
        output_video,
        codec="libx264",
        audio_codec="aac",
        threads=4
    )

    print("Video editado com sucesso!")