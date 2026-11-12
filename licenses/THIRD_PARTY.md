# Licenças de terceiros

O pacote do Content Lab inclui:

- **Node.js** (runtime embutido em `runtime/node`) — MIT e licenças dos componentes do Node. Texto: https://github.com/nodejs/node/blob/main/LICENSE
- **Dependências npm de produção** (`app/node_modules`) — cada pacote mantém o próprio arquivo `LICENSE` na sua pasta. Principais: React/React DOM (MIT), Remotion (Remotion License: gratuita para pessoas físicas e empresas de até 3 funcionários; empresas maiores precisam de licença comercial), Model Context Protocol SDK (MIT), zod (MIT), yauzl/yazl (MIT), lucide-react (ISC), Vite (MIT).
- **Fontes Inter e Barlow Condensed** (`@fontsource`) — SIL Open Font License 1.1.
- **Fonte Anton** (`app/assets/brand/fonts/`) — SIL Open Font License 1.1, aviso em `OFL.txt` ao lado.
- **Cenas HQ, Nox e ícones do Diazverso** (`app/src/timeline/components/diazverso/`, `app/assets/brand/`) — do plugin Diazverso, do mesmo criador do Content Lab; o Nox é personagem do criador.

Não incluídos (instalados pelo sistema ou baixados sob demanda em Dependências, com origem, licença e tamanho mostrados antes):

- FFmpeg/ffprobe — LGPL-2.1+ ou GPL-2.0+, conforme a build do sistema.
- zenity — LGPL-2.1+.
- yt-dlp — Unlicense.
- whisper.cpp — MIT; pesos Whisper large-v3 — MIT.
- VoxCPM2 — Apache-2.0; PyTorch — BSD-3-Clause.

Detalhes e riscos: `docs/SEGURANCA_E_PRIVACIDADE.md` no código-fonte.
