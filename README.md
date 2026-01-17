# PyClips
Ferramenta em python para criação de clips a partir de video de uma série, filme ou video longo.

# Como Rodar

1) Habilitar a venv e instalar libs:
    - Habilitar Scripts: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
    - Ativar venv: venv\Scripts\activate
    - Instalar Libs: pip install -r requirements.txt

2) Configurar o config.json com as chaves do gemini e preferências.

3) Baixar video .mp4 e adicionar a pasta input_videos.

4) Rodar o arquivo principal: py main.py