import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # Diretório base

# =========================
# CONFIG FFmpeg LOCAL
# =========================
FFMPEG_DIR = os.path.join(BASE_DIR, "ffmpeg", "bin")
os.environ["PATH"] = FFMPEG_DIR + os.pathsep + os.environ["PATH"]

# =========================
# ARQUIVOS DO PROJETO
# =========================
INPUT_VIDEO = os.path.join(BASE_DIR, "corte.mp4")  # Tem que ser formato .mp4
OUTPUT_VIDEO = os.path.join(BASE_DIR, "corte_final.mp4")  # Tem que ser formato .mp4
SRT_FILE = os.path.join(BASE_DIR, "legenda.srt")  # Tem que ser formato .srt

# =========================
# CONFIG EDIÇÃO
# =========================
MIN_SILENCE_MS = 700  # Tempo mínimo de silêncio para cortar
SILENCE_THRESHOLD = -40  # Limiar de silêncio
ZOOM_FACTOR = 1.2  # Fator de zoom

WATERMARK_TEXT = "CANAL TESTE"  # Marca d’água

# =========================
# MODO TESTE
# =========================
TEST_MODE = True   # True ou False
TEST_START = 30    # segundo inicial
TEST_DURATION = 5 # duração usada no teste
