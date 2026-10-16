---
name: contentlab-contrato
description: Constrói e valida edit_plan.json do Content Lab conforme contrato único, preservando IDs, cache, assets e distinção entre intenção criativa e propriedades suportadas.
---

# Content Lab — Contrato de edição

## Autoridade técnica
- Fonte de verdade: `schemas/edit_plan.schema.json` e validações em `server/plan.mjs`; complemente com `EDIT_PLAN_REFERENCE.md`, `MOTION_DESIGN_JSON.md` e documentação gerada.
- Há **um** `edit_plan.json`, sem campo `version` no topo.
- Estrutura principal: `project`, `audio`, `timeline`; `sources` é opcional.
- JSON é declarativo; nunca embutir JS executável.
- Campos arbitrários de `config` que o renderer não usa **não** produzem efeito. Se a skill criativa pedir recurso sem parâmetro suportado, marque como gap técnico para a próxima etapa.

## Identidade e cache
- Cada cena tem `id` estável e único, `start < end`; cada elemento visual tem `id` único na cena.
- Preservar IDs ao editar plano existente para aproveitar o cache por cena, exceto quando a identidade lógica realmente mudou.
- Cache do storyboard não prova que o rascunho foi renderizado; preview da cena anterior é distinto da versão modificada.
- Não inserir novas cenas para toda frase se uma cena longa puder evoluir por camadas/keyframes.

## Assets, posições e componentes
- Mídia existente: `project://assets/arquivo.ext` e `builtin://categoria/arquivo.ext`. Não criar links nem caminhos fictícios.
- `fit:"contain"` preserva a imagem inteira; `cover` recorta intencionalmente.
- `cells` define disposição no grid; `transform.scale` é escala, `transform.offsetX/offsetY` deslocamentos em pixels e `transform.opacity` opacidade.
- A ordem de camadas é definida por `z`. Posições em PNG podem ser afetadas por transparência assimétrica.
- `camera.keyframes` e keyframes de elementos usam tempo relativo à cena; cenas/elementos usam tempo absoluto. Não introduzir um segundo relógio implícito.
- Presets, `kinetic_text`, `word_stack_vertical` e `bangers_highlight_block` devem seguir o contrato real e exemplos disponíveis.
- No `word_stack_vertical`, a faixa central ocupa a largura do quadro; o painel opcional fica somente na faixa central. `config.items` define tempos de frases.
- Em `bangers_highlight_block`, o fundo entre palavras faz crossfade sem mover o texto, respeitando tempos das palavras.

## Contrato para uma cena programável TSX
O projeto pode conter `custom-scenes/MinhaCena.tsx` e uma cena declarativa com `customComponent`:

```json
{"id":"grafico","start":0,"end":8,"layout":"fullscreen","background":{"color":"#080a10"},"elements":[],"customComponent":{"module":"project://custom-scenes/MinhaCena.tsx","mode":"replace","props":{"titulo":"Exemplo","cor":"#ff4444"},"assets":{}}}
```

Para planejamento de uma cena complexa, carregar `skills/contentlab-cenas-tsx/SKILL.md` antes de gerar o componente.

## Revisão de plano
Antes de entregar: validar schema, regras semânticas, existência de assets, formatos, limites de tempo, IDs, camadas, transcript e eventos. Não afirmar suporte de um efeito apenas por campo desconhecido ter passado pelo parser. A saída deve refletir o estado atual do contrato; novos recursos de composição planejados nas skills serão implementados na fase técnica subsequente, sem serem falsamente simulados no JSON atual.

## Alterações de schema
Quando a engenharia introduzir campo real: atualizar schema, validação, renderer, `server/docs-fields.mjs` e `server/docs-content.mjs`; regenerar documentos com `npm run docs:generate`, validar com `npm run docs:check` e testes. Nunca criar schema alternativo.

## Tempos e camadas internas ao TSX, não ao schema

Ao converter mapa de narração em TSX, subtrair `timeline[].start` dos timestamps absolutos e passar tempos derivados como números em `customComponent.props` (se necessário) ou constantes no componente. Não inventar propriedades de contrato como `visualReadyBy`, `layerDepth`, `cameraTarget` no `edit_plan.json`: registrar no guia, no briefing ou em `props` existentes. O `customComponent` continua com `module`/`mode`/`props`/`assets`; vídeos e imagens devem vir de assets locais verificados. Ao pronunciar uma palavra, seu objeto visual deve estar reconhecível e a entrada estar concluída até o final da palavra.

## Registro de SFX e QA de movimentos no contrato instalado

Para cada `element.type="sfx"` usar `element.at` (início audível absoluto), `element.asset` existente, `element.config.duration` opcional e `element.fadeOut` opcional, campos presentes no schema/código do ContentLab. O mixer remove silêncio nas bordas do SFX, calcula `audibleLength` e aplica `fadeOut` **no final do trecho efetivamente usado**. Não colocar `fadeOut` dentro de `config`; não presumir `audio.sfx` ou timestamps relativos para `at`. Um corte em `config.duration` só é aceitável se seu `fadeOut` evitar truncamento audível.

Validar no guia/mapeamento de eventos que cada animação editorial (inclusive câmera e TSX) tenha som correspondente ou áudio original verificado; o início audível deve ocorrer dentro do evento visual, a duração do áudio pode divergir, e a cauda pode continuar suavemente. Schema válido não prova cobertura, coerência, variedade, presença audível ou sincronização: executar `contentlab-revisao` antes de exportar para edição automática e depois do render.


## Padrões oficiais

Consultar scene-library/manifest.json e o README do padrão escolhido antes de criar TSX do zero. A galeria oficial inclui contratos e exemplos. Textos Anton sem sombra; Bangers com tratamento HQ. SFX não são gerados pelos componentes. Flip/Curtain/Blur são transitionOut entre cenas, não presets de cena. Preserve cópias instaladas em projetos e valide sincronismo com transcript.words.
