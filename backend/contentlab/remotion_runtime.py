"""Install the pinned local Node/Remotion runtime when needed."""

import hashlib
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import threading
import urllib.request
import zipfile
from pathlib import Path

from .errors import RenderError

NODE_VERSION = "v22.16.0"
ROOT = Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).resolve().parents[2]
if getattr(sys, "frozen", False):
    cache_base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData/Local") / "ContentLab"
    REMOTION_DIR = cache_base / "remotion"
    RUNTIME_DIR = cache_base / "runtime"
else:
    REMOTION_DIR = ROOT / "backend" / "remotion"
    RUNTIME_DIR = ROOT / ".runtime"
_LOCK = threading.Lock()


def _system_node():
    node = shutil.which("node")
    if not node:
        return None
    try:
        result = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=5)
        major = int(result.stdout.strip().lstrip("v").split(".")[0])
        npm_bundled = Path(node).resolve().parent.parent / "lib/node_modules/npm/bin/npm-cli.js"
        if os.name == "nt":
            npm_bundled = Path(node).resolve().parent / "node_modules/npm/bin/npm-cli.js"
        return Path(node) if result.returncode == 0 and major >= 18 and (npm_bundled.is_file() or shutil.which("npm")) else None
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None


def _node_archive():
    machine = platform.machine().lower()
    arch = "arm64" if machine in {"aarch64", "arm64"} else "x64" if machine in {"x86_64", "amd64"} else None
    if not arch:
        raise RenderError(f"Arquitetura sem pacote automático do Node: {machine}.")
    if os.name == "nt":
        return f"node-{NODE_VERSION}-win-{arch}.zip"
    if sys.platform == "linux":
        return f"node-{NODE_VERSION}-linux-{arch}.tar.xz"
    if sys.platform == "darwin":
        return f"node-{NODE_VERSION}-darwin-{arch}.tar.gz"
    raise RenderError(f"Sistema sem pacote automático do Node: {sys.platform}.")


def ensure_node():
    node = _system_node()
    if node:
        return node
    archive_name = _node_archive()
    package_name = archive_name.removesuffix(".tar.xz").removesuffix(".tar.gz").removesuffix(".zip")
    target = RUNTIME_DIR / package_name
    executable = target / ("node.exe" if os.name == "nt" else "bin/node")
    if executable.is_file():
        return executable
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    base = f"https://nodejs.org/dist/{NODE_VERSION}/"
    try:
        with urllib.request.urlopen(base + "SHASUMS256.txt", timeout=30) as response:
            sums = response.read().decode("utf-8")
        expected = next(line.split()[0] for line in sums.splitlines() if line.split()[-1] == archive_name)
        with tempfile.TemporaryDirectory(prefix="node-install-", dir=RUNTIME_DIR) as temporary:
            temporary = Path(temporary)
            archive = temporary / archive_name
            with urllib.request.urlopen(base + archive_name, timeout=120) as response, archive.open("wb") as output:
                shutil.copyfileobj(response, output)
            if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
                raise RenderError("Falha na verificação do pacote do Node.")
            stage = temporary / "unpacked"
            stage.mkdir()
            if archive_name.endswith(".zip"):
                with zipfile.ZipFile(archive) as bundle:
                    bundle.extractall(stage)
            else:
                with tarfile.open(archive) as bundle:
                    bundle.extractall(stage)
            extracted = next(item for item in stage.iterdir() if item.is_dir())
            if target.is_dir() and not executable.is_file():
                shutil.rmtree(target)
            if not target.exists():
                shutil.move(str(extracted), str(target))
    except (OSError, StopIteration, ValueError, zipfile.BadZipFile, tarfile.TarError) as exc:
        raise RenderError(f"Não foi possível preparar o Node automaticamente: {exc}") from exc
    if not executable.is_file():
        raise RenderError("O pacote do Node não contém o executável esperado.")
    return executable


def ensure_remotion():
    """Return the Node executable after installing locked npm dependencies."""
    with _LOCK:
        if getattr(sys, "frozen", False):
            bundled = ROOT / "backend" / "remotion"
            REMOTION_DIR.mkdir(parents=True, exist_ok=True)
            for name in ("package.json", "package-lock.json"):
                source = bundled / name
                destination = REMOTION_DIR / name
                if not destination.is_file() or source.read_bytes() != destination.read_bytes():
                    shutil.copy2(source, destination)
            shutil.copytree(bundled / "src", REMOTION_DIR / "src", dirs_exist_ok=True)
        node = ensure_node()
        lock = REMOTION_DIR / "package-lock.json"
        if not lock.is_file():
            raise RenderError("O arquivo de dependências do Remotion não está no projeto.")
        marker = REMOTION_DIR / "node_modules" / ".contentlab-lock-hash"
        digest = hashlib.sha256(lock.read_bytes()).hexdigest()
        cli = REMOTION_DIR / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
        if cli.is_file() and marker.is_file() and marker.read_text() == digest:
            return node
        npm = Path(node).resolve().parent.parent / "lib/node_modules/npm/bin/npm-cli.js"
        if os.name == "nt":
            npm = Path(node).resolve().parent / "node_modules/npm/bin/npm-cli.js"
        if not npm.is_file():
            # A system Node installation may place npm elsewhere.
            npm_cmd = shutil.which("npm")
            if not npm_cmd:
                raise RenderError("Node está disponível, mas npm não foi encontrado.")
            command = [npm_cmd, "ci", "--ignore-scripts", "--no-audit", "--no-fund"]
        else:
            command = [str(node), str(npm), "ci", "--ignore-scripts", "--no-audit", "--no-fund"]
        result = subprocess.run(command, cwd=REMOTION_DIR, capture_output=True, text=True)
        if result.returncode:
            raise RenderError("Falha ao preparar o Remotion: " + (result.stderr or result.stdout)[-2000:])
        marker.write_text(digest)
        return node


if __name__ == "__main__":
    ensure_remotion()
    print("Remotion preparado.")
