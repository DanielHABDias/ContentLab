---
name: contentlab-direcao
description: Porta de entrada do Content Lab para planejar e revisar edições, motion design, vídeos narrados e edit_plan.json. Encaminha a tarefa para os módulos de composição, movimento, áudio, contrato e qualidade, respeitando perfis como Diazverso e GSB.
---


## Direção Diazverso — biblioteca oficial TSX (regra de precedência)
Em projetos Diazverso, consultar a [biblioteca Custom Cenas Diasverso](https://drive.google.com/drive/folders/1yWogLK6bRWXunvdJxTHBMIqB4ibSN44f) e seus READMEs antes de planejar `customComponent`. Somente os sete TSX oficiais são opção **padrão**, responsivos em 16:9/9:16; **novo TSX ou alteração de código apenas com comando explícito do criador**, mesmo que outros módulos genéricos sugiram implementar um. Guia de edição + `edit_plan.json` devem especificar `mode`, props/asset reais, formato, SFX no JSON e referência. Sobreposições: QuadroHQSobreCena e CaixinhaCTAHQ; os outros cinco substituem a composição. TSX não tocam áudio. Priorizar montagem por cenas e imagens, e não composição gráfica a cada beat. Qualquer instrução histórica desta skill sugerindo geração espontânea de TSX para Diazverso fica subordinada a esta regra.

# Content Lab — Direção

## Checagem de variedade e ordem visual (14/10/2026)

Em Shorts Diazverso, rejeitar a sequência em que várias cenas consecutivas reapresentam o mesmo clipe mesmo com títulos/cores ou variantes TSX diferentes. Identificar as fontes visíveis em `background.asset` **e** `customComponent.assets.main/next` por cena; TSX pode cobrir o background, então a mera troca de fundo não corrige a repetição. Misturar clipes relevantes, PNGs oficiais/de acervo de personagens, composições HQ e telas tipográficas puras. PNG de personagem inteiramente visível com `contain`; vídeo 16:9 no formato 9:16 com crop `cover` central. A abertura Minecraft 0–3s deve passar **na frente** do componente TSX: `z>=900` e `config.alwaysOnTop:true` com o ContentLab atualizado; `server/custom-scenes.mjs` contém a passagem foreground após UserScene. Não alterar padrão sonoro anterior nem presumir QA sem MP4.



## Perfil Diazverso: direção revisada em 15/10/2026

Em projetos Diazverso, a edição é **HQ simples com baixa interferência**: base de cenas pertinentes e ilustrações completas em movimento (pan/zoom suave), sem repetir continuamente o mesmo clipe nem adiantar spoilers; PNGs com entrada + balanço sutil + saída; caixas de narrador retangulares (etiqueta amarela sobre caixa branca/creme, sombra preta), halftone e grandes frases Anton. A antiga preferência por muitos TSX foi SUPERADA: criar poucos componentes-padrão reaproveitáveis em 16:9 para longos, com painéis HQ, Bangers e personagem entrando na moldura. Não converter cada frase em motion. Para textura gráfica recorrente, permitir overlay de imagem transparente em vez de TSX novo. Preservar Nox e a edição tradicional.

Filmes/séries/animações com overlay de televisão/CRT e proporção original; JOGOS sem CRT por padrão. Longos podem usar Nox grande em opinião, legenda especial embaixo, Anton sobre clipe escurecido e CTAs HQ no canto superior direito com hold >=5 s, whooshes de entrada/saída, clique visual/sonoro e sino quando aplicável. Títulos de capítulo entre cenas só em vídeos que recontam história de jogo capítulo a capítulo, sobre cena com áudio original — não cartela avulsa.

Shorts: gancho com explosão Minecraft por cima, riser metálico EXCLUSIVAMENTE para tensão, whoosh+blur direcional após gancho, música depois, legendas Bangers obrigatórias logo abaixo do centro com contorno/sombra, cenas e ilustrações com movimento, motion HQ pontual, CTA final baseada no `ComicPageCTA.tsx` do SH_0005. Apenas os visuais de hook/caixas/tipografia do `DiazversoHQEditorial.tsx` do SH_0005 também foram aprovados; o resto dos experimentos não é padrão.

Efeitos: variar WHOOSHs nos slides/transições; POP/CLICK/BLING para aparições e interação; riser para tensão, NÃO deslize. Alinhar ataque audível ao MEIO do gesto, não disparar antes ou automaticamente no primeiro frame. Preservar recursos genéricos do ContentLab para outras marcas e não alterar VD_0005 concluído. Fonte editorial vigente: `skills/diazverso-video/SKILL.md` e `skills/diazverso-criacao-video/SKILL.md`; o documento temporário foi excluído a pedido do criador.

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
Para coreografia complexa num único plano (câmera virtual, grade SVG, partículas, objetos persistentes e tipografia detalhada), **encaminhar à skill `skills/contentlab-cenas-tsx/SKILL.md`**. Gerar um `.tsx` completo por componente e **criar esse arquivo diretamente em `<pasta-do-vídeo>/custom-scenes/`**, não deixá-lo somente num ZIP. Para o Diazverso, também publicar na subpasta `custom-scenes/` da pasta do respectivo `VD_XXXX` ou `SH_XXXX` em `Guia de Edições` no Drive, se houver acesso de escrita; quando a escrita não estiver disponível, entregar o arquivo com instruções de instalação e indicar a pendência. O `edit_plan.json` fica na raiz do vídeo e usa `project://custom-scenes/Nome.tsx`; conferir o vínculo antes de finalizar. Não duplicar o TSX dentro do JSON nem regenerar o plano inteiro por ajustes pequenos. `replace` é cena inteira; `overlay` é sobreposição. O TSX local renderiza sem configuração extra, mas deve ser código confiável, pois não há sandbox; validação do JSON não substitui render. O site não instala TSX do chat automaticamente.

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

## Escolha parcimoniosa entre montagem e TSX

Para o perfil Diazverso, a prioridade é montar bem as cenas, as imagens e o áudio; TSX apenas quando um componente HQ reutilizável ajudar realmente. Recursos avançados de câmera e espaço continuam POSSÍVEIS em outras marcas ou pedidos pontuais, mas não são prescrição. Preservar clips, cortes secos e variações de imagem, em vez de prolongar TSX por hábito.

## Gate obrigatório para edição automática

A criação do `edit_plan.json`, guia e componentes `custom-scenes/*.tsx` **não é a conclusão do trabalho**. Antes de solicitar render/edição automática, acionar obrigatoriamente `contentlab-revisao` + `contentlab-timeline-audio` para checagem completa pré-render, e após o primeiro render executar QA audiovisual final. Checar todas as cenas e, em cada cena com movimento editorial, cada evento significativo com SFX real e **início audível dentro da animação** (não antes/depois). Se áudio for mais curto/maior que o movimento, aceitar; caudas extensas só se funcionais e com `fadeOut` em cortes necessários. Variar tipos de efeito, preservar áudio embutido sem duplicar e proteger narração. Não fazer o motor de render inventar SFX ou assumir que TSX contém som; eventos de TSX precisam ser traduzidos em `type:"sfx"` no plano.

Se houver falhas, corrigir plano/TSX e refazer QA antes de liberar; caso ainda não exista render, classificar apenas `APROVADO PRÉ-RENDER`, nunca `APROVADO FINAL`. O revisor especializado da marca Diazverso (`diazverso-revisao-edicao` no Drive) adiciona identidade/Nox/CRT/estilo sem substituir a validação geral do ContentLab.


## Exemplos técnicos versus presets aprovados

Componentes como `NarrativePath`, `EvidenceConstellation`, `PixelNotification` e `ComicMotionKit` são exemplos técnicos, não padrões automaticamente aprovados do Diazverso. A biblioteca futura de HQ será testada com Codex, com poucos TSX e motion simples. Não trocar cenas reais por templates sofisticados sem motivo; não inserir balões de fala como padrão. Validar MP4 e direitos de áudio/mídia. VD_0005 permanece intocado.
