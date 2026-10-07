# Arquitetura atual

## Stack e entrypoints

- Python 3.9+, Flask, yt-dlp, FFmpeg/FFprobe e faster-whisper.
- `python -m backend.app`: servidor web local em `127.0.0.1:5000`.
- `python -m backend.tray_app`: servidor com bandeja, usado no Windows.
- `./run.sh`, `iniciar.bat` e `build.bat`: execução e empacotamento.

## REUTILIZAR

- Download e cache persistente por vídeo em `backend/app.py`.
- Corte único/lote com FFmpeg, extração de áudio e exportação.
- Transcrição e cache do faster-whisper.
- Localização multiplataforma do FFmpeg em `backend/ffmpeg_helper.py`.
- Interface Flask existente, progresso assíncrono e abertura de outputs.

## ADAPTAR

- `backend/app.py` está monolítico; novas rotas devem delegar para serviços do
  pacote `backend.contentlab`, sem mover o fluxo estável de download agora.
- A UI atual continuará atendendo download/corte e ganhará uma área de projetos
  e planos de edição de forma incremental.
- O helper de FFmpeg será reutilizado pelo futuro backend de render.

## DEPRECAR

- Não há mais FastAPI/Gemini/RAG no repositório: pertenciam ao produto antigo.
- O instalador avulso de FFmpeg foi substituído pela descoberta integrada no
  Windows e pela instalação do sistema no Linux.
- OpenCut não será incorporado neste momento: o ZIP analisado é a reescrita
  inicial 0.1.0, com timeline/preview ainda como placeholders. A licença é MIT.

## CRIAR

- Contrato JSON versionado, parser e validação semântica.
- Modelos de domínio independentes de Flask e FFmpeg.
- Asset resolver seguro para `project://` e `builtin://`.
- Registry de layouts, transições, motions e estilos.
- Timeline compiler (`ValidatedEditPlan` -> `ResolvedTimeline`).
- RenderGraph e backend FFmpeg, seguidos de áudio, texto e captions.
- CLI e API usando o mesmo serviço.
- Testes unitários, integração e fixtures golden.

## Integração e riscos

- Downloads, transcrição e cortes existentes não devem ser reescritos durante a
  criação do renderer.
- Tempos da timeline representam o áudio final, depois de `sourceCuts`.
- Caminhos vindos do JSON nunca podem escapar das raízes permitidas.
- Windows, espaços em caminhos e UTF-8 são requisitos permanentes.
- A ausência de FFmpeg/assets deve falhar antes do render longo.

## Plano incremental

1. Parser, schema, resolver, registry, compiler e CLI. **Implementado.**
2. Render mínimo de imagem/vídeo com cortes secos. **Implementado via CLI.**
3. Texto e kinetic text. **Implementado com ASS/libass e word timestamps.**
4. Caption karaoke e preset Nox. **Implementado como caption ASS e vídeo em região sobre background.**
5. Grid 3x3, boxes e motions.
6. Transições, chroma, música/SFX e relatórios.
7. UI de projeto, preview e render final.
