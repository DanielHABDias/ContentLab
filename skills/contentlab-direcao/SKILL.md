---
name: contentlab-direcao
description: Porta de entrada do Content Lab para planejar e revisar edições, motion design, vídeos narrados e edit_plan.json. Encaminha a tarefa para os módulos de composição, movimento, áudio, contrato e qualidade, respeitando perfis como Diazverso e GSB.
---

# Content Lab — Direção

Esta é a skill central para qualquer trabalho de edição automatizada no Content Lab. A função dela é compreender o objetivo, escolher quais competências especializadas utilizar, integrar as decisões e produzir instruções de edição coesas. **Não** é uma biblioteca de presets nem substitui a documentação técnica.

## Antes de iniciar
1. Identifique a intenção: planejar, criar JSON, aprimorar movimento, revisar cena, adaptar formato, sincronizar áudio ou diagnosticar render.
2. Leia o projeto e seus materiais efetivamente disponíveis: narração preparada, transcript, assets, plano anterior e formato. Não invente arquivos, tempos, transcrições ou resultados.
3. Quando existir perfil de marca, carregue sua skill antes de planejar a aparência: `skills/diazverso-video/SKILL.md` para Diazverso; `skills/gsb-contentlab/SKILL.md` para GSB.
4. Consulte a documentação oficial empacotada: `docs/Documentacao-ContentLab.md`, `schemas/edit_plan.schema.json`, `EDIT_PLAN_REFERENCE.md` e exemplos. O contrato único não contém campo `version`.
5. Acione **somente os módulos relevantes**, lendo seus arquivos completos antes de trabalhar:
   - `skills/contentlab-composicao/SKILL.md`: narrativa visual, layouts, tipografia, profundidade, câmera, formatos;
   - `skills/contentlab-motion/SKILL.md`: coreografia, timing, keyframes, easing, stagger e continuidade;
   - `skills/contentlab-timeline-audio/SKILL.md`: narração preparada, eventos de áudio, transcrição, música, cortes e pausas;
   - `skills/contentlab-contrato/SKILL.md`: especificação declarativa, schema, assets, IDs e renderização;
   - `skills/contentlab-revisao/SKILL.md`: inspeção de frames, áudio, qualidade e iteração.
6. Una as decisões numa edição consistente. Nenhum módulo especializado decide isoladamente o projeto inteiro.

## Princípios de direção
- Primeiro a informação e o foco do público; depois a composição; por fim o movimento. Evite animações decorativas.
- Para cada cena, descreva a intenção, o foco visual, a organização inicial, o momento de desenvolvimento/hold e o destino dos elementos.
- Trate a cena como uma composição contínua, não uma troca de templates por frase. Não multiplique cenas quando uma composição pode evoluir.
- Planeje a **entrada, permanência, transformação e saída**; coordene movimentos e deixe tempo real de leitura.
- Escolha conscientemente entre intensidade `contida`, `equilibrada` e `dinâmica`. O perfil de marca pode definir o baseline; nenhum desses modos exige movimento em toda frase.
- Para formatos diferentes, recompose o layout; não presuma que crop é adaptação editorial.
- A referência de @thejplabs inspira princípios de composição, ritmo e transformações, **não** cópias de cenas, marcas, textos ou timing.

## Encaminhamento por tarefa
| Solicitação | Carregue |
| --- | --- |
| Roteiro ou criação de storyboard | composição + motion + timeline-áudio + perfil de marca |
| JSON pronto para render | contrato + composição + motion + timeline-áudio + revisão |
| "Movimento está duro/artificial" | motion + revisão |
| "Texto ficou cortado"/adaptação 9:16 | composição + revisão + contrato |
| Narração, música, SFX ou pausas | timeline-áudio + contrato + revisão |
| Ajustar cena já renderizada | revisão + módulos implicados, preservando IDs |
| Revisar output final | revisão + timeline-áudio |

## Hierarquia e entrega
Pedido explícito > contexto de marca fornecido pelo usuário > skill de perfil > diretrizes gerais do Content Lab. O schema e o renderer real determinam a **validade técnica** do JSON; o objetivo criativo não autoriza campos inventados. Caso uma capacidade pedida ainda não tenha implementação, identifique a lacuna para a etapa de engenharia em vez de disfarçá-la com configurações sem efeito. Não afirmar renderização, paridade ou validação sem executar os testes. Preserve decisões aprovadas e não recomece do zero sem necessidade.
