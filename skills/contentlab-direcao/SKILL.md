---
name: contentlab-direcao
description: Planejar e revisar vídeos no Content Lab com edit_plan.json, presets TSX e áudio sincronizado; preparar também projetos JSON independentes para o Studio de Thumbnails.
---

# Content Lab — Direção

Parta do objetivo e do guia do projeto. Identidade de canal é externa, não um default obrigatório. Preserve decisões aprovadas, IDs estáveis e produções existentes.

## Preparação

O seletor universal no topo define a pasta para gravação, geração de voz, edição e thumbnails; não exige edit_plan.json. Recarregar projeto relê os arquivos, tomadas e rascunho de thumbnails, sem renderizar. O último caminho é restaurado no mesmo navegador. Não trocar de pasta durante uma tomada não salva; preservar alterações do editor e conflitos de rascunho.

Antes de transcrever, distinguir **arquivo avulso para pesquisa/decupagem** de **narração oficial**. A finalidade padrão em Tratamento é Transcrição avulsa: arquivo local obrigatório, JSON/TXT/SRT em Downloads/transcricao-<identificador>, sem tratamento, cortes ou alteração do projeto. Esses tempos pertencem à fonte original; não usá-los como relógio da narração final. Para atualizar audio/narration.wav e transcript.json do projeto, selecionar explicitamente a finalidade de narração oficial e confirmar. Na API de transcrição, somente scope=narration autoriza esse fluxo; ausente/outro valor é avulso.

Vídeos/cortes podem ser baixados sem projeto, para Downloads ou destino escolhido. Guardar nos assets é opcional: usa assets/<fonte>/clips, audio ou transcripts. Transcrições de fontes baixadas sempre ganham subpasta exclusiva, sem substituir transcript.json da raiz. Não mover resultados avulsos para o lugar da transcrição oficial por conveniência.

Narração vem antes do plano: audio/narration.wav e transcript.json podem ser preparados numa pasta vazia. Não inventar arquivos ou refazer transcrição disponível sem necessidade. Consultar docs/Documentacao-ContentLab.md, schemas/edit_plan.schema.json e EDIT_PLAN_REFERENCE.md. Existe um schema, sem version. Usar transcript.words para chegada de textos, mídia e câmera; ler o contrato do preset para saber se at significa chegada ou início do movimento.

## Thumbnails — fluxo independente de vídeo

Para criar/editar uma thumbnail, ler **docs/THUMBNAIL_STUDIO.md**, incluído neste pacote. Não pedir narração, transcript ou edit_plan.json: o Studio usa outro contrato, com `version: 1`, `media`, `background`, `output` opcional, `base`, `variants` e `selected`. A regra de vídeo “sem version” não se aplica a esse projeto. Preferir partir do JSON exportado pelo usuário, preservando seus ajustes e imagens. Arquivo de thumbnail nunca deve substituir o plano de vídeo.

O rascunho automático fica em thumbnails/project.json na pasta universal, e imagens/JSONs/ZIPs exportados ficam em thumbnails/, com sufixo para evitar sobrescrita. Recarregar relê esse estado; não ignorar conflito de revisão SHA-256 nem transportar silenciosamente imagens entre projetos. JSONs antigos do navegador precisam ser importados, não são migrados automaticamente.

O fundo é compartilhado entre versões; camadas de personagens/textos são independentes após a cópia inicial. Imagens ficam incorporadas em `media` como data URLs PNG/JPEG/WebP, referenciadas por chaves nas camadas, não por project://, builtin:// ou links remotos. Não inventar imagens/base64. Sem bytes locais verificados, entregar instruções para importação visual, não um projeto falsamente completo.

O título permite `mode:split` (padrão antigo: preenchimento atrás/contorno à frente), `front` (sólido à frente), `behind` (sólido atrás) e `outline` (contorno à frente). Alinhamento left/center/right usa x como âncora; width limita a largura. Anton e Bangers são fontes locais no peso real 400. lineHeight mantém a geometria dos passes. stroke aceita 0–160, com passo 0,1: uma unidade = 0,15 px em 1280; zero desliga. Isso não altera o peso da fonte. Secundários ficam à frente dos fundos e texturas; opacidade menor é escolha explícita.

Foto contextual fica acima da cor base e abaixo de papel/halftone/filme/estrelas/grade/página HQ, todos abaixo dos personagens. `background.sideLights.left/right: {color, opacity, reach}` cria degradês independentes das bordas para o centro, mesmo sem PNGs. `opacity`: 0–100, `reach`: 1–100 (% da largura). Essas luzes ficam acima dos secundários, abaixo da sombra inferior, texto e protagonista. Não confundir com o brilho radial dos personagens; evitar somar efeitos antigos `glowMode:lateral` sem intenção.

Papel/filme/grade/estrelas/página derivam do BackgroundHQ.tsx; não substituí-los por vídeos de textura. `background.invertEffects` inverte somente os efeitos; opacidade zero os desliga. No estilo `paper`, escolher `paperTone:light/dark` (Cor base não o recolore); nos outros, configurar `color`. `photoFit:cover/contain`, `photoX/photoY:0.5` e `photoScale:1` permitem fundo centralizado sem distorção.

Exportação: `output: {resolution:"full_hd", format:"jpeg", quality:0.95}`; aceitar `4k` e `png/webp` quando desejado. Horizontal: 1920×1080 ou 3840×2160; vertical: 1080×1920 ou 2160×3840; quadrado: 1920² ou 3840². Omitir output usa Full HD/JPG. Não entregar HD 1280×720 como resolução final nem ampliar uma captura de tela. Conferir os pixels e o formato reais do arquivo, a leitura reduzida, contraste e recorte. Aumentar a saída não recupera detalhe de um asset pequeno.

Pesquisar imagens pela função narrativa, expressão e ação, não só pelo nome; conferir transparência e qualidade dos bytes reais. Quando o usuário preferir imagens icônicas/marcantes, preservar esse critério sem confundir fama com pertinência ou licença de uso. As referências aprovadas orientam a peça sem virar regras públicas de canal. Não publicar nem alterar perfis externos por essa tarefa.

## Cenas oficiais

Consultar scene-library/manifest.json e o README do padrão antes de criar código novo. Os 15 componentes possuem variações, prévias e exemplos na Galeria de cenas especiais. Os templates antigos foram substituídos.

Preparar pela documentação (inclui todos os arquivos auxiliares) ou copiar o TSX e seus companions do manifesto para custom-scenes. HQComicPage.tsx e HQMotion.tsx, quando listados, devem ter uma única cópia compatível no projeto. O plano usa project://custom-scenes/Nome.tsx. Não sobrescrever uma versão diferente sem autorização; a instalação não altera o JSON nem inicia render. props recebe dados JSON; customComponent.assets recebe URIs de mídia/fontes. replace substitui a cena; overlay mantém a base. Opacidade zero não recupera base descartada em replace. Anton sem sombra/contorno; Bangers com acabamento próprio.

## Módulos por tarefa

- skills/contentlab-pesquisa/SKILL.md: temas, evidências e perguntas da audiência.
- skills/contentlab-packaging/SKILL.md: título e thumbnail como promessa conjunta.
- skills/contentlab-roteiro/SKILL.md: gancho, progressão, payoff e CTA.
- skills/contentlab-metadados/SKILL.md: descrições, capítulos, tags e links.
- skills/contentlab-cenas-tsx/SKILL.md: escolha e parametrização de presets; código novo só quando necessário.
- skills/contentlab-composicao/SKILL.md: foco, hierarquia e formatos.
- skills/contentlab-motion/SKILL.md: coreografia e continuidade.
- skills/contentlab-timeline-audio/SKILL.md: voz, transcrição, SFX e música.
- skills/contentlab-contrato/SKILL.md: JSON, assets e cache.
- skills/contentlab-revisao/SKILL.md: inspeção audiovisual.
- skills/contentlab-revisor-json-tecnico/SKILL.md: contrato do JSON, assets, regiões, defaults do renderer e cache.
- skills/contentlab-revisor-abertura/SKILL.md: gate exclusivo dos primeiros 30 segundos de vídeos longos e checkpoints de alta complexidade.
- skills/contentlab-revisor-visual-movimento/SKILL.md: enquadramento, fluidez, continuidade e sincronismo visual.
- skills/contentlab-revisor-audio-sincronizacao/SKILL.md: voz, música, SFX e timing perceptivo.

## Transições e áudio

Flip, Curtain e Blur são transitionOut entre cenas reais, não cenas intermediárias. transitionDuration ocupa o início da próxima cena sem encurtar o vídeo. Os TSX não geram SFX automaticamente: usar eventos explícitos no plano. Centralizar o centro audível do whoosh no movimento após trim de silêncio; clique/sino no gesto. Não duplicar áudio embutido nem presumir loudness a partir de trimDb.

## Qualidade

Validar JSON, caminhos, props e duração. Conferir frames de entrada/desenvolvimento/saída, ouvir voz/SFX e testar cache. Não declarar homologação estética com TypeScript/schema apenas. Antes de inspecionar o render, classificar como pré-render. Não publicar, alterar Drive nem fazer Git sem autorização.

Antes de entregar `edit_plan.json` como pronto para render, executar primeiro o revisor técnico do JSON e depois os três passes perceptivos, consolidando tudo em `contentlab-revisao`. Vídeos longos exigem técnico, abertura, visual/movimento e áudio/sincronização; Shorts exigem técnico, visual/movimento e áudio/sincronização, com abertura `N/A`. Um estado `CORRIGIR` bloqueia a entrega; `NÃO VERIFICADO` permite apenas rascunho explicitamente pendente. Depois do MP4, repetir os passes aplicáveis sobre pixels e áudio reais.
