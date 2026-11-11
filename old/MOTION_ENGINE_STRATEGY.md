# Estratégia de motion design — Node.js e Remotion

**Decisão:** Node.js 22+ na aplicação; JavaScript na interface; React/TypeScript + Remotion como motor visual; FFmpeg para áudio, cortes, composição final e operações especializadas. Um único `edit_plan.json` sem campo de versão.

## Referências

- Remotion: https://www.remotion.dev/docs/
- Remotion Player: https://www.remotion.dev/docs/player
- HyperFrames (HeyGen): https://github.com/heygen-com/hyperframes
- Skills de composição e animação do HyperFrames (dentro do repositório oficial).

O HyperFrames serve de referência para GSAP seekable, camadas, transições, parallax, máscaras, tipografia e reutilização de receitas visuais. Não exigir um segundo renderizador no pipeline nem executar código JavaScript arbitrário vindo do JSON.

## Arquitetura

- `server/http.mjs`: aplicação local Node.js na porta 5000; o launcher cria processo detached e abre o navegador.
- `server/plan.mjs` e `schemas/edit_plan.schema.json`: validação e interpretação do contrato canônico.
- `backend/remotion/src/`: cenas React/TypeScript, base dos presets.
- `server/remotion.mjs`: adapter Node → Remotion.
- `server/render.mjs` e `server/cache.mjs`: render por cena, cache incremental por ID, verificação e relatório.
- `server/compose.mjs` e `server/audio.mjs`: FFmpeg para concatenação, transições e mixagem.
- `server/source.mjs` e `server/transcribe.mjs`: ingestão de mídias, cortes e transcrição sem Python.
- `frontend/static/`: interface web JavaScript. O futuro Player poderá compartilhar os componentes Remotion.

## Sequência de evolução

1. Concluir testes de paridade do backend Node (incluindo Windows).
2. Limpar código e documentação de formatos abandonados.
3. Separar a `scene.tsx` monolítica em componentes de camada, fundo, câmera e texto.
4. Implementar biblioteca tipada de presets cinematográficos e exemplos JSON validados.
5. Integrar `@remotion/player` para visualizar e ajustar uma cena por vez, com antes/depois e cache preservado.
6. Medir consumo de CPU/RAM, tempos de render e ganho com cache incremental.

## Critérios visuais

- Imagem 1920×1080 em quadro 1920×1080 sem zoom automático.
- Exatidão dos timestamps, sem textos sobrepostos.
- Cenas isoladas renderizáveis por ID e reuso dos segmentos válidos.
- Gráficos, efeitos e transições reproduzíveis em qualquer frame.
- Comparação de frames e áudio reais, além de testes de unidade.

Não assumir desempenho superior só porque o processo controlador usa Node: custo real depende de Chromium/Remotion e FFmpeg. Evitar duplicar processamento. Atualizar o JSON apenas com campos reconhecidos pelo schema.
