---
name: contentlab-direcao
description: Porta de entrada do Content Lab para planejar e revisar edições, motion design, vídeos narrados e edit_plan.json. Encaminha a tarefa para os módulos de composição, movimento, áudio, contrato e qualidade, respeitando perfis como Diazverso e GSB.
---

# Content Lab — Direção

## Perfil Diazverso: direção consolidada em 14/10/2026

Quando a marca for **Diazverso**, a direção visual aprovada é **motion design moderno/cinematográfico + linguagem HQ editorial sóbria**, não UI minimalista pura e não gibi infantil. Combinar retícula/halftone discreta, painéis/gutters, páginas espaciais, câmera transitando entre trechos reais de filmes/jogos, quadro dessaturado que ganha cor ao receber foco e caixas retangulares de narração. Evitar balões de fala/pensamento por padrão. **Anton** para palavras enormes e fundo sólido com cores mutáveis, **Bangers** para lettering HQ e Comic Sans pontual em caixas editoriais; Inter/sans apenas quando a função pedir. Usar bastante TSX em explicações e comparações, preservando cenas reais citadas — em tela cheia ou incorporadas ao motion. Baixa interferência significa movimentos justificados, não escassez de motion. Padrões TSX novos só entram no catálogo depois de implementação, render e QA.

**Shorts Diazverso** conservam a assinatura própria: gancho forte com voz imediata, vídeo 0–3s `explosaoMinecraft.mp4` com chroma/áudio, riser metálico antes da primeira virada, blur direcional acompanhado de woosh durante o movimento, música apenas após o blur e CTA final. Não aplicar essa vinheta a longos nem a outras marcas. **VD_0005 continua fechado.**



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

## Nova prioridade criativa — TSX na edição autoral

Para edições do Diazverso, a experiência do VD_0005 validou o valor de **considerar TSX primeiro para motion de explicação original** com cenário contínuo, texto espacial, câmera, mídia em perspectiva e separação de camadas. Isso não transforma o vídeo inteiro em UI nem invalida a baixa interferência: footage real relevante, pausas, cortes secos e Nox com função continuam fundamentais.

Encaminhar à `contentlab-cenas-tsx` quando a cena exige autoria espacial, ainda que seja relativamente curta; consultar `contentlab-composicao` e `contentlab-motion` para direção. Exigir âncoras de narração preparada: conteúdo focal completamente pronto preferencialmente no começo da palavra, **obrigatoriamente até o final da palavra**, com hold real. A câmera deve estar no alvo quando o nome/ideia é pronunciado. Não criar tempos estimados como se fossem transcrição verificada.

Para variar, experimentar deslocamento da câmera por palavras em diagonal, vídeo como placa inclinada, explosão de camadas, parallax de fundo/meio/frente, galerias em profundidade, nó para rede e painéis de HQ no espaço. CSS/React/SVG geram 2.5D e parallax; sem recortes reais não existe separação semântica de um clipe plano. Ver catálogo na referência da skill TSX.

## Gate obrigatório para edição automática

A criação do `edit_plan.json`, guia e componentes `custom-scenes/*.tsx` **não é a conclusão do trabalho**. Antes de solicitar render/edição automática, acionar obrigatoriamente `contentlab-revisao` + `contentlab-timeline-audio` para checagem completa pré-render, e após o primeiro render executar QA audiovisual final. Checar todas as cenas e, em cada cena com movimento editorial, cada evento significativo com SFX real e **início audível dentro da animação** (não antes/depois). Se áudio for mais curto/maior que o movimento, aceitar; caudas extensas só se funcionais e com `fadeOut` em cortes necessários. Variar tipos de efeito, preservar áudio embutido sem duplicar e proteger narração. Não fazer o motor de render inventar SFX ou assumir que TSX contém som; eventos de TSX precisam ser traduzidos em `type:"sfx"` no plano.

Se houver falhas, corrigir plano/TSX e refazer QA antes de liberar; caso ainda não exista render, classificar apenas `APROVADO PRÉ-RENDER`, nunca `APROVADO FINAL`. O revisor especializado da marca Diazverso (`diazverso-revisao-edicao` no Drive) adiciona identidade/Nox/CRT/estilo sem substituir a validação geral do ContentLab.


## Componentes derivados de produção e direção futura HQ

Consultar `VD0005_REUSABLE_REVIEW.md` para escolher padrões comprovados por **inspeção de código** do VD_0005, mas **não certificados por render**: `examples/custom-scenes/NarrativePath.tsx`, `EvidenceConstellation.tsx`, `PixelNotification.tsx` e `ComicMotionKit.tsx`. Modelos de exemplos não se tornam presets da UI ou campos novos no JSON. Configurar `props`, `assets` e sincronismo de cada novo roteiro; manter tempo de cena, SFX absolutos e assets reais.

Para futuros vídeos Diazverso, considerar teste criativo de *HQ em movimento*: quadros/gutters, tinta desenhada, halftone discreto, balões, lettering Anton/Bangers, máscaras entre painéis e parallax 2.5D com recortes. Não afetar o VD_0005 aprovado. Fonte e licença da música devem ser verificadas antes de promover localmente; ver `MUSIC_LIBRARY_DIAZVERSO.md` e skill `contentlab-timeline-audio`.
