---
name: contentlab-direcao
description: Planejar e revisar vídeos no Content Lab com edit_plan.json, presets TSX e áudio sincronizado; preparar também projetos JSON independentes para o Studio de Thumbnails.
---

# Content Lab — Direção

Parta do objetivo e do guia do projeto. Identidade de canal é externa, não um default obrigatório. Preserve decisões aprovadas, IDs estáveis e produções existentes.

## Preparação

Narração vem antes do plano: audio/narration.wav e transcript.json podem ser preparados numa pasta vazia. Não inventar arquivos ou refazer transcrição disponível sem necessidade. Consultar docs/Documentacao-ContentLab.md, schemas/edit_plan.schema.json e EDIT_PLAN_REFERENCE.md. Existe um schema, sem version. Usar transcript.words para chegada de textos, mídia e câmera; ler o contrato do preset para saber se at significa chegada ou início do movimento.

## Thumbnails — fluxo independente de vídeo

Para criar/editar uma thumbnail, ler **docs/THUMBNAIL_STUDIO.md**, incluído neste pacote. Não pedir narração, transcript ou edit_plan.json: o Studio usa outro contrato, com `version: 1`, `media`, `background`, `base`, `variants` e `selected`. A regra de vídeo “sem version” não se aplica a esse projeto. Preferir partir do JSON exportado pelo usuário, preservando seus ajustes e imagens. Arquivo de thumbnail nunca deve substituir o plano de vídeo.

O fundo é compartilhado entre versões; camadas de personagens/textos são independentes após a cópia inicial. Imagens ficam incorporadas em `media` como data URLs PNG/JPEG/WebP, referenciadas por chaves nas camadas, não por project://, builtin:// ou links remotos. Não inventar imagens/base64. Sem bytes locais verificados, entregar instruções para importação visual, não um projeto falsamente completo.

O título é preenchido atrás do personagem principal e contornado à frente, no mesmo lugar; essa sobreposição é intencional. Anton e Bangers são fontes locais, com peso real do título 400. `title.stroke: 1` é 0,15 px em 1280, zero desliga; não importar para vídeo essa exceção de contorno de thumbnail. Personagens laterais/contextuais podem ser mais discretos que o protagonista via opacidade, saturação e luminosidade; isso é opção de composição, não identidade obrigatória de canal.

Papel/filme/grade/estrelas derivam do próprio BackgroundHQ.tsx em quadro fixo de 1 segundo; não substituí-los por vídeos de textura. `background.invertEffects` inverte somente os efeitos; opacidade zero os desliga. Consultar o guia para unidades e limites, exportar PNG e conferir enquadramento, contraste, linha fina e leitura reduzida. As referências aprovadas de cada usuário orientam a peça sem virar regras públicas. Não publicar nem alterar perfis externos por essa tarefa.

## Cenas oficiais

Consultar scene-library/manifest.json e o README do padrão antes de criar código novo. Os 15 componentes possuem variações, prévias e exemplos na Galeria de cenas especiais. Os templates antigos foram substituídos.

Preparar pela documentação ou copiar o TSX para custom-scenes na pasta do vídeo. O plano usa project://custom-scenes/Nome.tsx. Não sobrescrever uma versão diferente sem autorização; a instalação não altera o JSON nem inicia render. props recebe dados JSON; customComponent.assets recebe URIs de mídia/fontes. replace substitui a cena; overlay mantém a base. Opacidade zero não recupera base descartada em replace. Anton sem sombra/contorno; Bangers com acabamento próprio.

## Módulos por tarefa

- skills/contentlab-cenas-tsx/SKILL.md: escolha e parametrização de presets; código novo só quando necessário.
- skills/contentlab-composicao/SKILL.md: foco, hierarquia e formatos.
- skills/contentlab-motion/SKILL.md: coreografia e continuidade.
- skills/contentlab-timeline-audio/SKILL.md: voz, transcrição, SFX e música.
- skills/contentlab-contrato/SKILL.md: JSON, assets e cache.
- skills/contentlab-revisao/SKILL.md: inspeção audiovisual.

## Transições e áudio

Flip, Curtain e Blur são transitionOut entre cenas reais, não cenas intermediárias. transitionDuration ocupa o início da próxima cena sem encurtar o vídeo. Os TSX não geram SFX automaticamente: usar eventos explícitos no plano. Centralizar o centro audível do whoosh no movimento após trim de silêncio; clique/sino no gesto. Não duplicar áudio embutido nem presumir loudness a partir de trimDb.

## Qualidade

Validar JSON, caminhos, props e duração. Conferir frames de entrada/desenvolvimento/saída, ouvir voz/SFX e testar cache. Não declarar homologação estética com TypeScript/schema apenas. Antes de inspecionar o render, classificar como pré-render. Não publicar, alterar Drive nem fazer Git sem autorização.
