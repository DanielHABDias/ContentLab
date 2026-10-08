"""Cancellable subprocess runner compatible with render._run."""

import subprocess

from .errors import RenderCancelled


class CancelRunner:
    def __init__(self, event):
        self.event = event

    def __call__(self, command, **kwargs):
        if self.event.is_set():
            raise RenderCancelled("Render cancelado pelo usuário.")
        process = subprocess.Popen(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=kwargs.get("text", True), creationflags=kwargs.get("creationflags", 0),
            cwd=kwargs.get("cwd"),
        )
        while True:
            try:
                stdout, stderr = process.communicate(timeout=0.25)
                return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
            except subprocess.TimeoutExpired:
                if self.event.is_set():
                    process.terminate()
                    try:
                        process.communicate(timeout=3)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.communicate()
                    raise RenderCancelled("Render cancelado pelo usuário.")
