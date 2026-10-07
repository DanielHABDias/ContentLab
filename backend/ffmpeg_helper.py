"""
ffmpeg_helper.py — Localiza (ou baixa automaticamente) o ffmpeg.

Ordem de busca:
  1. Binários embutidos no .exe (PyInstaller _MEIPASS)
  2. Pasta onde o ContentLab.exe / app.py está
  3. PATH do sistema (shutil.which)
  4. Locais comuns de instalação no Windows (C:\\ffmpeg, WinGet, Chocolatey, Scoop)
  5. Pasta própria do DengsClip (%LOCALAPPDATA%\\DengsClip\\ffmpeg\\bin)
  6. No Windows, se não achou: baixa o build "essentials" automaticamente.
     No Linux/macOS, orienta a instalação pelo gerenciador do sistema.
"""

import os
import re
import sys
import shutil
import zipfile
import tempfile
import threading
import subprocess

import requests

# ffmpeg 7.1.1 PINADO de propósito: o corte por trecho (--download-sections)
# do yt-dlp quebrou com o ffmpeg 8.1 (issue yt-dlp #16546). Primeiro tenta o
# mirror oficial do gyan no GitHub; se falhar, cai pro site dele.
FFMPEG_ZIP_URLS = [
    "https://github.com/GyanD/codexffmpeg/releases/download/7.1.1/ffmpeg-7.1.1-essentials_build.zip",
    "https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-7.1.1-essentials_build.zip",
]
MAX_SAFE_MAJOR = 7  # versões acima quebram o corte por trecho

_lock = threading.Lock()
_cached_dir = None  # cache do diretório encontrado, pra não procurar toda hora
_version_cache = {}  # dir -> major version (ou None se o binário não roda)


def _app_data_bin():
    """Pasta própria do Content Lab para guardar o ffmpeg baixado."""
    base = os.environ.get("LOCALAPPDATA") or str(os.path.join(os.path.expanduser("~"), ".contentlab"))
    return os.path.join(base, "ContentLab", "ffmpeg", "bin")


def _legacy_app_data_bin():
    """Reutiliza o ffmpeg já baixado por versões antigas do DengsClip."""
    base = os.environ.get("LOCALAPPDATA") or str(os.path.join(os.path.expanduser("~"), ".dengsclip"))
    return os.path.join(base, "DengsClip", "ffmpeg", "bin")


def _is_valid_bin_dir(path):
    """Confere se a pasta tem ffmpeg E ffprobe (yt-dlp usa os dois),
    e se eles não estão corrompidos/pela metade (tamanho mínimo)."""
    if not path or not os.path.isdir(path):
        return False
    exe = ".exe" if os.name == "nt" else ""
    # Os builds portáteis do Windows têm dezenas de MB; binários Linux ligados
    # dinamicamente podem ser bem menores e devem ser validados pela execução.
    min_size = 1024 * 1024 if os.name == "nt" else 1
    for name in ("ffmpeg" + exe, "ffprobe" + exe):
        f = os.path.join(path, name)
        try:
            if not os.path.isfile(f) or os.path.getsize(f) < min_size:
                return False
            if os.name != "nt" and not os.access(f, os.X_OK):
                return False
        except OSError:
            return False
    return True


def _candidate_dirs():
    """Gera os diretórios candidatos, na ordem de prioridade."""
    exe = ".exe" if os.name == "nt" else ""

    # 1. Embutido no .exe (PyInstaller)
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        yield meipass

    # 2. Ao lado do executável / do script
    if getattr(sys, "frozen", False):
        yield os.path.dirname(sys.executable)
    yield os.path.dirname(os.path.abspath(__file__))

    # 3. PATH do sistema
    which = shutil.which("ffmpeg" + exe)
    if which:
        yield os.path.dirname(which)

    # 4. Locais comuns no Windows
    if os.name == "nt":
        local = os.environ.get("LOCALAPPDATA", "")
        progfiles = os.environ.get("ProgramFiles", r"C:\Program Files")
        userprofile = os.environ.get("USERPROFILE", "")
        yield r"C:\ffmpeg\bin"
        yield os.path.join(progfiles, "ffmpeg", "bin")
        if userprofile:
            yield os.path.join(userprofile, "scoop", "apps", "ffmpeg", "current", "bin")
        yield r"C:\ProgramData\chocolatey\bin"
        if local:
            # WinGet instala em subpastas com nome de versão — varre elas
            winget_pkgs = os.path.join(local, "Microsoft", "WinGet", "Packages")
            if os.path.isdir(winget_pkgs):
                for root, dirs, files in os.walk(winget_pkgs):
                    if "ffmpeg" + exe in files and "ffprobe" + exe in files:
                        yield root
                        break

    # 5. Cache antigo e pasta própria do Content Lab
    yield _legacy_app_data_bin()
    yield _app_data_bin()


def ffmpeg_major(path):
    """Roda `ffmpeg -version` e retorna a versão major (int), ou None se o
    binário não executa (corrompido, arquitetura errada, etc). Com cache."""
    if path in _version_cache:
        return _version_cache[path]
    exe = os.path.join(path, "ffmpeg" + (".exe" if os.name == "nt" else ""))
    major = None
    try:
        flags = 0x08000000 if os.name == "nt" else 0  # CREATE_NO_WINDOW
        out = subprocess.run(
            [exe, "-version"], capture_output=True, text=True,
            timeout=15, creationflags=flags,
        ).stdout
        m = re.search(r"ffmpeg version\D*(\d+)", out or "")
        if m:
            major = int(m.group(1))
    except Exception:
        major = None
    _version_cache[path] = major
    return major


def _is_usable(path):
    """Válido, executável e de versão compatível com corte por trecho."""
    if not _is_valid_bin_dir(path):
        return False
    major = ffmpeg_major(path)
    # O pin da versão 7 existe para o build Windows distribuído pelo projeto.
    # Em Unix usamos a versão mantida pela distribuição do usuário.
    return major is not None and (os.name != "nt" or major <= MAX_SAFE_MAJOR)


def find_ffmpeg_dir():
    """Retorna o diretório com ffmpeg+ffprobe usável, ou None se não achou."""
    global _cached_dir
    if _cached_dir and _is_usable(_cached_dir):
        return _cached_dir
    for d in _candidate_dirs():
        if _is_usable(d):
            _cached_dir = d
            return d
    return None


def download_ffmpeg(progress_callback=None):
    """Baixa o build essentials do gyan.dev e extrai ffmpeg/ffprobe
    pra pasta própria do Content Lab. Retorna o diretório final."""
    if os.name != "nt":
        raise RuntimeError(
            "FFmpeg não encontrado. Instale ffmpeg e ffprobe pelo gerenciador "
            "do sistema (Ubuntu/Debian: sudo apt install ffmpeg; Fedora: "
            "sudo dnf install ffmpeg; Arch: sudo pacman -S ffmpeg)."
        )

    dest_bin = _app_data_bin()
    os.makedirs(dest_bin, exist_ok=True)

    if progress_callback:
        progress_callback(0, "Baixando o ffmpeg (primeira execução, ~90 MB)...")

    tmp_zip = os.path.join(tempfile.gettempdir(), "contentlab_ffmpeg.zip")
    last_err = None
    for url in FFMPEG_ZIP_URLS:
        try:
            with requests.get(url, stream=True, timeout=60, allow_redirects=True) as r:
                r.raise_for_status()
                total = int(r.headers.get("Content-Length") or 0)
                done = 0
                with open(tmp_zip, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1024 * 512):
                        if chunk:
                            f.write(chunk)
                            done += len(chunk)
                            if total and progress_callback:
                                progress_callback(
                                    round(done / total * 100, 1),
                                    "Baixando o ffmpeg (primeira execução, ~90 MB)...",
                                )
            last_err = None
            break
        except Exception as e:
            last_err = e
            continue
    if last_err:
        raise last_err

    if progress_callback:
        progress_callback(100, "Extraindo o ffmpeg...")

    wanted = re.compile(r"/bin/(ffmpeg|ffprobe)\.exe$")
    extracted = 0
    with zipfile.ZipFile(tmp_zip) as z:
        for member in z.namelist():
            if wanted.search(member.replace("\\", "/")):
                final = os.path.join(dest_bin, os.path.basename(member))
                partial = final + ".part"
                with z.open(member) as src, open(partial, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                # só vira o binário oficial depois de extraído por completo —
                # se interromper no meio, não sobra um .exe corrompido
                os.replace(partial, final)
                extracted += 1

    try:
        os.remove(tmp_zip)
    except OSError:
        pass

    _version_cache.pop(dest_bin, None)  # força re-checagem do binário novo
    if extracted < 2 or not _is_usable(dest_bin):
        raise RuntimeError(
            "Download do ffmpeg terminou mas os arquivos não foram encontrados. "
            "Tente de novo ou instale o ffmpeg manualmente (gyan.dev/ffmpeg/builds)."
        )

    global _cached_dir
    _cached_dir = dest_bin
    return dest_bin


def ensure_ffmpeg(progress_callback=None):
    """Garante que o ffmpeg existe: procura na máquina e, se não achar,
    baixa automaticamente. Thread-safe. Retorna o diretório do ffmpeg."""
    found = find_ffmpeg_dir()
    if found:
        return found
    with _lock:
        # outra thread pode ter baixado enquanto esperávamos o lock
        found = find_ffmpeg_dir()
        if found:
            return found
        return download_ffmpeg(progress_callback)


def prewarm_async():
    """Dispara a garantia do ffmpeg em background (usado na inicialização,
    pra quando o usuário for baixar já estar tudo pronto)."""
    def _job():
        try:
            ensure_ffmpeg()
        except Exception:
            pass  # silencioso: se falhar aqui, tenta de novo na hora do download

    threading.Thread(target=_job, daemon=True).start()
