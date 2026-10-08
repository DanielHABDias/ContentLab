"""Generate an AI-readable guide from the installed public asset library."""

from pathlib import Path


MEDIA_EXTENSIONS = {
    "backgrounds": {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".mp4", ".mov", ".mkv", ".webm"},
    "music": {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"},
    "sfx": {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".mp4"},
    "transitions": {".mp4", ".mov", ".mkv", ".webm"},
}


def installed_assets(builtin_root):
    """Rescan every download; never cache paths or follow links outside the library."""
    root = Path(builtin_root).resolve()
    result = {}
    for category, extensions in MEDIA_EXTENSIONS.items():
        directory = root / category
        items = []
        if directory.is_dir():
            for path in sorted(directory.rglob("*")):
                if path.is_file() and path.suffix.lower() in extensions and root in path.resolve().parents:
                    items.append({"name": path.name, "uri": "builtin://" + path.relative_to(root).as_posix()})
        result[category] = items
    return result


def build_ai_catalog(app_root):
    root = Path(app_root).resolve()
    assets = installed_assets(root / "builtin-assets")
    transition_example = assets["transitions"][0]["uri"] if assets["transitions"] else "project://assets/transicao.mp4"
    lines = [
        "# Content Lab — catálogo e guia para IA",
        "",
        "Gerado no momento do download. Os nomes e URIs abaixo refletem os arquivos instalados agora.",
        "Use os URIs exatamente como aparecem, inclusive acentos, maiúsculas e extensão.",
        "Não invente arquivos. Se um asset não estiver listado, peça o arquivo ao usuário e use project://.",
        "",
        "## Assets padrão instalados",
        "",
    ]
    labels = {"backgrounds": "Backgrounds", "music": "Músicas", "sfx": "Efeitos sonoros", "transitions": "Transições visuais (chroma key)"}
    for category, items in assets.items():
        lines += [f"### {labels[category]} ({len(items)})", ""]
        lines += [f"- `{item['uri']}`" for item in items] if items else ["Nenhum arquivo instalado nesta categoria."]
        lines.append("")
    lines += [
        "## Como usar",
        "",
        "- Background: `timeline[].background.asset` com `builtin://backgrounds/...`; `loop: true` repete vídeo curto.",
        "- Música: `audio.music[].asset` com `builtin://music/...`.",
        "- Som: elemento `sfx` com `asset: builtin://sfx/...`.",
        "- Transição de fundo verde: elemento visual `overlay` com `asset: builtin://transitions/...`, `style: green_screen` e `config` de chroma. É uma sobreposição na cena, não um valor de `transitionOut`.",
        "- Arquivos próprios: use `project://` com o caminho relativo à pasta do projeto.",
        "- `transitionOut` usa os presets nativos documentados abaixo; combine uma sobreposição verde com uma transição nativa se desejar.",
        "",
        "Exemplo de transição visual com fundo verde (ajuste os tempos à cena):",
        "```json",
        '{"id":"flash","type":"overlay","asset":"' + transition_example + '","start":2,"end":3,"z":100,"style":"green_screen","fit":"cover","config":{"keyColor":"0x00FF00","similarity":0.18,"blend":0.08}}',
        "```",
        "",
    ]
    for filename in ("README.md", "EDIT_PLAN_REFERENCE.md", "MOTION_DESIGN_JSON.md", "builtin-assets/README.md"):
        path = root / filename
        if path.is_file():
            lines += [f"## Documento: {filename}", "", path.read_text(encoding="utf-8"), ""]
    return "\n".join(lines)
