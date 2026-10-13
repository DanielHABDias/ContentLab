---
name: contentlab-direcao
description: Porta de entrada do Content Lab para planejar e revisar edições, motion design, vídeos narrados e edit_plan.json. Encaminha a tarefa para os módulos de composição, movimento, áudio, contrato e qualidade, respeitando perfis como Diazverso e GSB.
---

# Content Lab — Direção

Esta é a skill central para qualquer trabalho de edição automatizada no Content Lab. A função dela é compreender o objetivo, escolher quais competências especializadas utilizar, integrar as decisões e produzir instruções de edição coesas. **Não** é uma biblioteca de presets nem substitui a documentação técnica.

## Antes de iniciar
1. Identifique a intenção: planejar, criar JSON, aprimorar movimento, revisar cena, adaptar formato, sincronizar áudio ou diagnosticar render.
2. **Antes de gerar edit_plan.json**, verifique se a aba Narração já produziu audio/narration.wav e transcript.json na mesma pasta. O áudio é cortado e opcionalmente estilizado sem depender de JSON; o transcript vem da voz limpa antes do pitch. Não invente arquivos, tempos ou resultados.
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

## Cenas programáveis quando o JSON padrão não basta
Para coreografia complexa num único plano (câmera virtual, grade SVG, partículas, objetos persistentes e tipografia detalhada), **encaminhar à skill `skills/contentlab-cenas-tsx/SKILL.md`**. O caminho econômico é pedir ao ChatGPT **um `.tsx` completo para uma cena**, salvar/baixar e copiar manualmente em `custom-scenes/` na raiz do projeto e devolver apenas `customComponent` no JSON (ou o fragmento mínimo de cena). Não duplicar o TSX no JSON nem regenerar um plano completo por cada ajuste. `replace` é cena toda TSX; `overlay` adiciona TSX sobre a montagem declarativa. A execução exige opt-in `CONTENTLAB_TRUST_CUSTOM_TSX=1` e código de origem confiável; validação do JSON não substitui render e inspeção. O site não instala o TSX automaticamente.

## Roteamento do estilo visual
Quando o usuário citar **visual moderno, estilo Apple, minimalismo premium, cards suaves, fundos variados, tipografia refinada ou o design do próprio site**, direcione as escolhas de layout/fundo/cores à `contentlab-composicao` e o ritmo à `contentlab-motion`. Use `contentlab-cenas-tsx` só se houver animação composicional complexa. Carregar o perfil editorial Diazverso quando for para esse canal; a estética de site é uma referência opcional, **não padrão obrigatório para outras marcas**. Se fonte não estiver disponível no renderer, escolher fonte licenciada instalada ou asset fornecido e registrar a diferença, jamais alegar que SF Pro está embutida.

## Encaminhamento por tarefa
| Solicitação | Carregue |
| --- | --- |
| Roteiro ou criação de storyboard | composição + motion + timeline-áudio + perfil de marca |
| JSON pronto para render | contrato + composição + motion + timeline-áudio + revisão |
| Cena complexa ou vídeo de motion inteiramente contínuo | cenas TSX + composição + motion + contrato + revisão |
| "Movimento está duro/artificial" | motion + revisão |
| "Texto ficou cortado"/adaptação 9:16 | composição + revisão + contrato |
| Narração, música, SFX ou pausas | timeline-áudio + contrato + revisão |
| Ajustar cena já renderizada | revisão + módulos implicados, preservando IDs |
| Revisar output final | revisão + timeline-áudio |

## Hierarquia e entrega
Pedido explícito > contexto de marca fornecido pelo usuário > skill de perfil > diretrizes gerais do Content Lab. O schema e o renderer real determinam a **validade técnica** do JSON; o objetivo criativo não autoriza campos inventados. Caso uma capacidade pedida ainda não tenha implementação, identifique a lacuna para a etapa de engenharia em vez de disfarçá-la com configurações sem efeito. Não afirmar renderização, paridade ou validação sem executar os testes. Preserve decisões aprovadas e não recomece do zero sem necessidade.
