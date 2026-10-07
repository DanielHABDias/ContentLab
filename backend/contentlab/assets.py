from pathlib import Path
from urllib.parse import unquote, urlparse

from .errors import UnsafeAssetPathError


class AssetResolver:
    def __init__(self, project_root, builtin_root):
        self.project_root = Path(project_root).expanduser().resolve()
        self.builtin_root = Path(builtin_root).expanduser().resolve()

    @staticmethod
    def _inside(root, relative):
        relative = unquote(relative).replace("\\", "/").lstrip("/")
        candidate = (root / relative).resolve()
        if candidate != root and root not in candidate.parents:
            raise UnsafeAssetPathError(f"Caminho de asset inseguro: {relative}")
        return candidate

    def resolve(self, uri):
        parsed = urlparse(uri)
        relative = f"{parsed.netloc}{parsed.path}"
        if parsed.scheme == "project":
            return self._inside(self.project_root, relative)
        if parsed.scheme == "builtin":
            return self._inside(self.builtin_root, relative)
        raise UnsafeAssetPathError(f"Esquema de asset não permitido: {parsed.scheme or '(ausente)'}")
