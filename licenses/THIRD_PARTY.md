# Licenças de terceiros

O pacote do Content Lab inclui:

- **Node.js** (runtime embutido em `runtime/node`) — MIT e licenças dos componentes do Node. Texto: https://github.com/nodejs/node/blob/main/LICENSE
- **Dependências npm de produção** (`app/node_modules`) — cada pacote mantém o próprio arquivo `LICENSE` na sua pasta. Principais: React/React DOM (MIT), Remotion (Remotion License: gratuita para pessoas físicas e empresas de até 3 funcionários; empresas maiores precisam de licença comercial), Model Context Protocol SDK (MIT), zod (MIT), yauzl/yazl (MIT), lucide-react (ISC), Vite (MIT).
- **Fontes Inter e Barlow Condensed** (`@fontsource`) — SIL Open Font License 1.1.
- **Fonte Anton** (`app/assets/kit/fonts/`) — SIL Open Font License 1.1, aviso em `OFL.txt` ao lado.
- **Cenas HQ, kit de motion, página HQ e ícones** (`app/src/timeline/components/hq/`, `app/src/motion/kit/`, `app/assets/kit/`) — do Content Lab.
- **SFX** (`app/assets/kit/sfx/`) — gravações do Freesound em CC0 (domínio público; crédito por cortesia), recortadas e niveladas pelo Content Lab:
  - `clique`, `sino`, `explosao`, `tapa`, `tapa-eco`, `whoosh-rapido` e `whoosh-lento`, pelo Openverse;
  - `pop` — "Pop 01", LilMati (antes MATRIXXX_), https://freesound.org/s/506546/
  - `whoosh` — "Whoosh #1", Kinoton, https://freesound.org/s/427823/
  - `swish` — "swosh-08 (stick cutting air)", qubodup, https://freesound.org/s/59995/
  - `camera` — "Camera Shutter", roachpowder, https://freesound.org/s/170229/
  - `sub` — "sub bass 3 seconds", uzerx, https://freesound.org/s/59539/
  - `impact` — "Bass Impact - Ki_01", Kievinay, https://freesound.org/s/512389/ (primeiros 2 s)

  `ding`, `error`, `riser`, `riser-reverso` e `type` (uma tecla recortada de uma gravação de digitação) foram escolhidos pelo criador do canal na área gratuita do Pixabay (Pixabay Content License, sem atribuição obrigatória) e no acervo dele. Os demais (`tick`, `glitch`) são procedurais, gerados pelo Content Lab.

Não incluídos (instalados pelo sistema ou baixados sob demanda em Dependências, com origem, licença e tamanho mostrados antes):

- FFmpeg/ffprobe — LGPL-2.1+ ou GPL-2.0+, conforme a build do sistema.
- zenity — LGPL-2.1+.
- yt-dlp — Unlicense.
- whisper.cpp — MIT; pesos Whisper large-v3 — MIT.
- VoxCPM2 — Apache-2.0; PyTorch — BSD-3-Clause.

Detalhes e riscos: `docs/SEGURANCA_E_PRIVACIDADE.md` no código-fonte.

- **Fundo quadrinhos** (`assets/kit/backgrounds/quadrinhos.png`) — colagem original gerada por IA sob direção do criador: revistas e painéis genéricos, sem personagens ou títulos identificáveis. Asset selecionado pelo criador para integrar o kit.
