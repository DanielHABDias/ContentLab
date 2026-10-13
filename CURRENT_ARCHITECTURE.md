# Arquitetura do Content Lab — migração para Node

**Estado:** backend Node.js e motor Remotion; testes automatizados Linux/Windows. Revisão visual de projetos reais com assets próprios permanece como teste de aceitação manual.

## Camadas

- `frontend/templates/index.html`, `frontend/static/*.js`, `frontend/static/*.css`: web UI JavaScript.
- `server/http.mjs`: servidor HTTP, rotas do editor e jobs de render.
- `server/plan.mjs`: schema único, validação, URIs de assets e compilação de cenas.
- `server/project.mjs`: criação, leitura, revisão, inventário de mídia e salvamento.
- `server/render.mjs`: orquestração do render final e cache incremental.
- `server/remotion.mjs`: chamada Node ao motor Remotion, preparando props e mídia.
- `backend/remotion/src`: cenas em React/TypeScript.
- `server/cache.mjs`: manifestos persistentes por ID.
- `server/compose.mjs`: concatenação e transições via FFmpeg.
- `server/audio.mjs`: preparação de voz, trilha, SFX e mux.
- `server/source.mjs`: importação de arquivos locais, YouTube.js, cortes e cache de fontes.
- `server/transcribe.mjs`: integração com whisper.cpp (executável externo).
- `server/cli.mjs`, `server/migrate.mjs`: comandos e conversão de plano.

## Contrato

`edit_plan.json` não tem campo de versão; `schemas/edit_plan.schema.json` é
a fonte de verdade. Novos efeitos exigem mudança de schema e tests, sem flags de
compatibilidade com formatos abandonados.

## Cache

Clipes de cena e trechos de composição são preservados em
`output/final/scenes` e `output/final/pieces`. Cada cena é identificada por
`id` e uma assinatura dos elementos visuais e assets, permitindo render
incremental. A montagem final e mixagem podem precisar ser repetidas.

## Riscos e critérios para integração

Os módulos legados foram excluídos. A revisão manual precisa cobrir funções essenciais com as mídias reais no Zorin OS e no Windows.
Prioridades: áudio, overlay/chroma, transições, HTML, downloads, transcrição,
empacotamento e compatibilidade com projetos longos de muitas cenas. A branch
não deve substituir o `main` antes da validação.
