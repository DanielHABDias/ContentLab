# Motion design no edit_plan.json

**Motor visual:** Remotion (React/TypeScript). **Formato de autoria:** JSON único, sem campo de versão. O validador e o schema canônico ficam em `server/plan.mjs` e `schemas/edit_plan.schema.json`.

## Anatomia das cenas

Uma cena é uma composição contínua com um fundo persistente, câmera virtual e camadas independentes que surgem e desaparecem em momentos diferentes. Não é necessário criar uma cena nova a cada fala.

```json
{
  "id": "interrogatorio",
  "start": 40,
  "end": 47,
  "layout": "3x3",
  "background": {"asset": "project://assets/arkham.mp4", "fit": "contain", "loop": true},
  "camera": {
    "keyframes": [
      {"t": 0, "x": 0.5, "y": 0.5, "scale": 1},
      {"t": 4, "x": 0.5, "y": 0.5, "scale": 1.2, "easing": "ease_in_out"}
    ]
  },
  "elements": [
    {
      "id": "batman",
      "type": "image",
      "asset": "project://assets/batman.png",
      "cells": [2, 5, 8],
      "start": 40,
      "end": 47,
      "z": 10,
      "transform": {"scale": 1.3},
      "animation": {"enter": "pop_in", "idle": "float_soft", "exit": "cut"}
    },
    {
      "id": "fala", "type": "text", "text": "O BATMAN NÃO MATA",
      "cells": [2, 3], "start": 42, "end": 45,
      "z": 20, "style": "anton",
      "reveal": {"charactersPerSecond": 11}
    }
  ],
  "transitionOut": "cut"
}
```

## Camadas

- Imagens PNG com alfa: `image` + `cells` + `transform`; manter bordas transparentes, sem esticar.
- Vídeo: `video` ou `background.asset`; usar `contain` quando a imagem inteira deve aparecer.
- Tipografia: `text`, `kinetic_text` e `caption` com `fontScale`, `textStyle`, `reveal` e timestamps de transcrição.
- Sobreposições: `overlay` pode aplicar efeitos cromáticos conforme suporte do renderer.
- Filtros: `filter` (p.ex. `dim`, `crt_tv`) ordenado por `z`.
- Efeitos sonoros: `sfx` com `at` relativo à timeline absoluta, `asset` e duração.

## Animação determinística

- `transform` define estado inicial (`x`, `y`, `scale`, `rotation`, `opacity`).
- `keyframes[].t` é relativo ao começo da cena, estritamente crescente.
- `easing` usa `linear`, `ease_in`, `ease_out`, `ease_in_out`. A omissão usa smootherstep C2 (velocidade e aceleração zero nos extremos); `linear` explícito continua linear. `ease_in_out` também é C2.
- `animation.enter`/`idle`/`exit` escolhe presets reutilizáveis de entrada, movimento e saída.
- `camera.keyframes` e `camera.shake` controlam a câmera para camadas posicionadas, sem ampliar automaticamente o background.
- A composição deve ser determinística por frame; evitar relógio real e `Math.random()` sem seed.

## Presets e composição visual

Entradas comuns: `cut`, `fade`, `pop_in`, `slide_from_left`, `slide_from_right`, `slide_up`, `slide_down`, `center_reveal`.

Idle comuns: `none`, `float_soft`, `wiggle_soft`, `pulse_soft`, `slow_zoom_in`, `slow_zoom_out`, `pan`.

Saídas comuns: `cut`, `fade`, `fade_out`, `slide_to_left`, `slide_to_right`, `slide_to_bottom`, `center_close`.

O grid 3×3 é organizado com células `1,2,3 / 4,5,6 / 7,8,9`. `[2,5,8]` define a coluna central inteira, enquanto `[5]` define somente a célula central.

## Qualidade e limites

- Vídeos 1920×1080 em projeto 1920×1080 não devem sofrer expansão implícita.
- Usar fundo sólido ou faixas laterais quando a proporção difere, em vez de zoom que prejudica a nitidez.
- Evitar textos sobrepostos e cortes abruptos involuntários em camadas consecutivas.
- A posição de um PNG pode parecer deslocada se a transparência não for simétrica.
- Conferir transições, efeitos cromáticos, temporização e áudio em render real antes de considerar a cena aprovada.

A biblioteca futura seguirá padrões de Remotion e referências de animação seekable do HyperFrames: `MOTION_ENGINE_STRATEGY.md`. Campos novos precisam ser introduzidos no schema e testados antes de serem emitidos pela IA.

## Grid, deslocamento e opacidade

Camadas de PNG podem usar `cells:[5,8]` para encaixe automático nas duas células centrais inferiores, `fit:"contain"` para evitar recorte, `transform.scale` para ajuste opcional, `transform.offsetX` e `offsetY` em pixels (positivo = direita/baixo) para reposicionamento e `transform.opacity` entre 0 e 1 para transparência. `keyframes[].opacity` anima fades. `z` define a ordem de sobreposição.

## Carrossel vertical moderno de frases

O preset `kinetic_text` com `style:"word_stack_vertical"` ocupa três faixas. O destaque central (e seu painel, quando `panelOpacity>0`) **se estende horizontalmente por todo o quadro**, mesmo que `cells` inclua somente duas colunas. A frase ativa é maior e plenamente opaca no centro. A próxima, acima, é menor e semitransparente e se ancora pela borda de BAIXO de sua faixa; a anterior, abaixo, é menor e semitransparente e se ancora pela borda de CIMA. As três ficam alinhadas à esquerda por padrão. `direction:"down"` gera o movimento superior→central→inferior.

Para frases completas, usar `config.items:[{"text":"BATMAN NÃO É JUIZ","start":0,"end":1.2},...]`; não simular a pilha com camadas independentes. A linha central aceita quebras responsivas; não usar `whiteSpace:nowrap` nem limitar o painel a duas colunas. O novo padrão visual é transparente (`panelOpacity:0`), com destaque cinza opcional restrito ao terço central e em largura total. O exemplo `examples/word-stack.json` e `server/smoke-word-stack.mjs` demonstram a composição.

A partir do ajuste de suavidade do destaque, `bangers_highlight_block` mantém o texto parado enquanto o **fundo colorido** da palavra anterior desaparece e o da próxima surge por crossfade suave. Use `config.highlightTransitionDuration:0.1` para ajustar o tempo sem deslocar `word.start/end` e sem afetar o áudio. O `fade` entre cenas preserva a direção: começa na cena anterior e termina exatamente na seguinte.
