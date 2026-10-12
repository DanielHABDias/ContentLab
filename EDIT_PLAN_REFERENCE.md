# Content Lab — referência do edit_plan.json

**Contrato único:** `schemas/edit_plan.schema.json`. O plano **não possui campo de versão**. O mesmo JSON alimenta o editor visual, o validador Node, o compositor Remotion e o cache incremental.

## Estrutura

```json
{
  "project": {
    "name": "Meu vídeo",
    "format": "youtube_long",
    "profile": "generic",
    "resolution": {"width": 1920, "height": 1080},
    "fps": 30,
    "seed": 0
  },
  "sources": {"assets": "assets", "transcript": "transcript.json"},
  "audio": {
    "narration": "audio/narration.wav",
    "voice": {"normalize": true, "targetLufs": -16, "truePeakDb": -1.5},
    "music": []
  },
  "timeline": [{
    "id": "intro",
    "start": 0,
    "end": 5,
    "layout": "3x3",
    "background": {"asset": "project://assets/papel.mp4", "fit": "contain", "loop": true},
    "camera": {"keyframes": []},
    "elements": [{
      "id": "batman", "type": "image", "asset": "project://assets/batman.png",
      "start": 0, "end": 5, "z": 10,
      "cells": [2, 5, 8], "fit": "contain",
      "transform": {"scale": 1.2},
      "animation": {"enter": "pop_in", "idle": "float_soft", "exit": "cut"}
    }],
    "transitionOut": "cut"
  }]
}
```

## Regras gerais

- IDs de cenas são únicos e estáveis: `timeline[].id` é a identidade do clipe no cache persistente. IDs de camadas visuais também devem ser únicos dentro da cena.
- `start` e `end` são segundos absolutos na linha do tempo final. Cenas não se sobrepõem. Camadas podem se sobrepor **dentro** da mesma cena.
- `project.format`: `youtube_long` (1920×1080), `youtube_short` (1080×1920), `custom`. `resolution` e `fps` substituem os padrões; `seed` controla ruído determinístico.
- `sources.transcript` é relativo à pasta do projeto; `sources.assets` nomeia a pasta de mídia (não preenche automaticamente os URIs de cada elemento).
- Arquivos são `project://` (raiz do projeto) ou `builtin://` (biblioteca instalada). O resolver bloqueia `..`, symlinks externos e URI inválida. Não use caminhos absolutos em `asset`.
- `audio.narration` informa um arquivo dentro do projeto. `sourceCuts` lista trechos `{start,end}` da narração original, aplicados antes da mixagem.
- `audio.music[]` aceita `asset`, `start`, `end`, `trimDb`, `fadeIn`, `fadeOut`, `preset`. A voz pode usar `normalize`, `targetLufs`, `truePeakDb`, `highpassHz` e `trimDb`. Também há configuração `ducking`; confirme o comportamento audiovisual final nos testes.
- `timeline[].transitionOut`: `cut`, `fade`, `slide_left`, `blur_left`, `blur_right`, `blur_up` com `transitionDuration`. Transições dependem das cenas adjacentes.
- `background` recebe `color` ou `asset`; `fit: contain` preserva conteúdo inteiro, `cover` só quando o recorte for intencional; `loop` repete vídeo curto. Vídeo 16:9 já no formato final não deve ser ampliado implicitamente.
- `elements[]` permite `image`, `video`, `text`, `kinetic_text`, `caption`, `overlay`, `filter` e `sfx`. Áudio de `sfx` usa `at` e `config`.
- Textos: `text`, `style`, `textStyle` (família, cor, contorno e sombra), `fontAsset`, `fontScale`, `reveal` e `emphasis`. `caption` pode consultar `sources.transcript`.
- Mídia: `fit` (`contain`, `cover`, `stretch`, `smart_cover`), `loop`, `muted`, `trimDb`, `fadeIn`, `fadeOut`.
- `transform` inclui `x`, `y`, `scale`, `rotation`, `opacity`; `keyframes` tem `t` em segundos relativos ao começo da cena e `easing` (`linear`, `ease_in`, `ease_out`, `ease_in_out`).
- `animation` tem `enter`, `idle`, `exit`, `enterDuration`, `exitDuration`. `camera.keyframes` usa posição/escala e `camera.shake[]` controla vibração.

## Grid 3×3

Numere as células da esquerda para a direita, de cima para baixo:

```text
1 | 2 | 3
4 | 5 | 6
7 | 8 | 9
```

- `[1,4,7]`: coluna esquerda.
- `[2,5,8]`: coluna central, útil para Batman sozinho.
- `[3,6,9]`: coluna direita.
- `[5]`: centro central do quadro.
- `[1,2,3,4,5,6,7,8,9]`: composição inteira.

`cells` define a região de encaixe e o posicionamento básico; `transform.scale` é um multiplicador. Uma imagem com transparência assimétrica pode aparentar deslocamento mesmo com células centralizadas.

## Fluxo e cache

1. Execute `node server/cli.mjs validate "PASTA_DO_PROJETO"`.
2. Gere usando `npm run render -- "PASTA_DO_PROJETO"` ou o botão **Aproveitar cache**.
3. Os segmentos são salvos individualmente antes da montagem final em `output/final/scenes/`.
4. Para limpar todos os intermediários e começar novamente, use **Refazer tudo** ou `npm run render -- "PASTA_DO_PROJETO" --rebuild`.

Veja `MOTION_DESIGN_JSON.md`, `SCENE_CACHE.md`, exemplos em `examples/` e o schema para todos os campos, tipos e limites permitidos.

## Posicionamento por grid e transparência

`cells: [5,8]` dimensiona a caixa das duas células centrais inferiores. `fit: contain` preserva a proporção do PNG, inclusive margens transparentes; `cover` pode recortar. Use `transform.scale` somente para ajuste adicional e `transform.offsetX`/`offsetY` para deslocamentos em pixels após encaixar no grid (positivo = direita/baixo; negativo = esquerda/cima). `transform.opacity` já controla a transparência entre 0 e 1; `keyframes[].opacity` permite animá-la. `z` maior desenha na frente. Exemplo de elemento:

```json
{"id":"nox","type":"image","asset":"project://assets/nox.png","cells":[5,8],"fit":"contain","z":3,"transform":{"scale":1.05,"offsetY":35,"opacity":0.65}}
```
