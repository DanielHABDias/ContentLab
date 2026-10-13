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

## Revisão de plano
Antes de entregar: validar schema, regras semânticas, existência de assets, formatos, limites de tempo, IDs, camadas, transcript e eventos. Não afirmar suporte de um efeito apenas por campo desconhecido ter passado pelo parser. A saída deve refletir o estado atual do contrato; novos recursos de composição planejados nas skills serão implementados na fase técnica subsequente, sem serem falsamente simulados no JSON atual.

## Alterações de schema
Quando a engenharia introduzir campo real: atualizar schema, validação, renderer, `server/docs-fields.mjs` e `server/docs-content.mjs`; regenerar documentos com `npm run docs:generate`, validar com `npm run docs:check` e testes. Nunca criar schema alternativo.
