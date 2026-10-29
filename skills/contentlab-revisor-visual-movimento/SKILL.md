---
name: contentlab-revisor-visual-movimento
description: Revisa o movimento visual de um edit_plan e de seus previews/renders no Content Lab, verificando enquadramento, hierarquia, fluidez, continuidade e sincronismo com a fala. Use antes de liberar o plano e depois do render; não substitui a revisão exclusiva da abertura nem a auditoria de áudio.
---

# Revisor visual e de movimento

Avalie o que o espectador realmente verá. Schema válido e TSX compilado são apenas pré-condições.

## Entradas mínimas

- `edit_plan.json`, `transcript.words`, guia de edição e assets resolvidos;
- contratos dos componentes TSX usados;
- previews das cenas complexas e, na etapa final, o MP4 com áudio.

Se o render ou a evidência necessária não existir, marque `NÃO VERIFICADO`; não presuma que o código produz o movimento esperado.

## Passagem pré-render

1. Cruze cada beat da fala com o visual correspondente. A mídia deve confirmar o que é dito, sem imagem genérica, continuidade falsa ou conceito chegando tarde.
2. Para cada cena programável, transição, overlay e movimento editorial, registre início, primeiro estado legível, pico, assentamento, hold e saída. O elemento deve estar legível quando a palavra relevante é dita e assentado até o fim dela.
3. Confira enquadramento, escala, `cover`/`contain`, safe area, cortes de PNG, z-order, máscaras, CRT somente na camada de mídia e ausência de frames vazios.
4. Avalie trajetória, easing, aceleração, desaceleração, continuidade de velocidade, mudança de direção e câmera. Reprove jitter, salto, zoom sem intenção, travelling repetido e elementos concorrendo pelo foco.
5. Verifique variedade editorial. Repetir a mesma composição ou movimento por hábito é falha; movimento diferente sem função também é falha.
6. Em 16:9 e 9:16, confirme que o foco permanece legível e que o reenquadramento não apenas corta a composição horizontal.

## Evidência visual

Inspecione frames de checkpoint no início, estado legível, pico, hold e saída, além do frame anterior e posterior às transições. Use contact sheet quando ajudar a comparar estados. Para cenas complexas, reproduza o preview em velocidade normal: frames isolados não provam fluidez.

Selecione também checkpoints no restante do vídeo por risco: mudanças de capítulo, cenas com múltiplas camadas, mídia com crop agressivo, CTAs, transições e trechos apontados pelo usuário. Não use amostragem para ignorar todas as cenas complexas; elas precisam de revisão individual.

## Passagem pós-render

Assista aos trechos revisados no MP4 final e confirme:

- movimento contínuo e sem travamentos;
- chegada visual sincronizada à fala;
- leitura suficiente após a animação;
- transições sem frame preto, sobreposição indevida ou salto;
- composição final equivalente ao preview, inclusive cache e assets locais.

## Saída

Relate por `scene.id` e tempo: evidência observada, resultado `CONFORME|CORRIGIR|NÃO VERIFICADO`, gravidade, causa e correção mínima. Termine com contagem de cenas complexas, transições e checkpoints inspecionados.

Este passe não aprova o projeto sozinho. Qualquer `CORRIGIR` bloqueia a liberação; qualquer `NÃO VERIFICADO` impede afirmar aprovação final.
