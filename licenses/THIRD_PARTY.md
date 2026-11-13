# Licenças de terceiros

O pacote do Content Lab inclui:

- **Node.js** (runtime embutido em `runtime/node`) — MIT e licenças dos componentes do Node. Texto: https://github.com/nodejs/node/blob/main/LICENSE
- **Dependências npm de produção** (`app/node_modules`) — cada pacote mantém o próprio arquivo `LICENSE` na sua pasta. Principais: React/React DOM (MIT), Remotion (Remotion License: gratuita para pessoas físicas e empresas de até 3 funcionários; empresas maiores precisam de licença comercial), Model Context Protocol SDK (MIT), zod (MIT), yauzl/yazl (MIT), lucide-react (ISC), Vite (MIT).
- **Fontes Inter e Barlow Condensed** (`@fontsource`) — SIL Open Font License 1.1.
- **Fonte Anton** (`app/assets/kit/fonts/`) — SIL Open Font License 1.1, aviso em `OFL.txt` ao lado.
- **Cenas HQ, kit de motion, página HQ e ícones** (`app/src/timeline/components/hq/`, `app/src/motion/kit/`, `app/assets/kit/`) — do Content Lab.
- **SFX** (`app/assets/kit/sfx/`) — `clique`, `sino`, `explosao`, `tapa`, `tapa-eco`, `whoosh-rapido` e `whoosh-lento` vêm do Freesound em CC0, pelo Openverse; os demais são procedurais, gerados pelo Content Lab.

Não incluídos (instalados pelo sistema ou baixados sob demanda em Dependências, com origem, licença e tamanho mostrados antes):

- FFmpeg/ffprobe — LGPL-2.1+ ou GPL-2.0+, conforme a build do sistema.
- zenity — LGPL-2.1+.
- yt-dlp — Unlicense.
- whisper.cpp — MIT; pesos Whisper large-v3 — MIT.
- VoxCPM2 — Apache-2.0; PyTorch — BSD-3-Clause.

Detalhes e riscos: `docs/SEGURANCA_E_PRIVACIDADE.md` no código-fonte.
