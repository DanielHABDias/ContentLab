# Content Lab — Documentação oficial

Referência construída a partir de schemas/edit_plan.schema.json e do código atual Node.js, Remotion e FFmpeg.

Esta documentação diferencia propriedades aceitas pelo schema de comportamentos efetivamente implementados.

## Índice

- Visão geral, arquivos, grade, camadas, áudio, timeline, cache, interface e diagnóstico
- Catálogo de recursos implementados
- Referência completa dos campos do JSON
- Exemplos de uso
- Regras de validação

## Visão geral e fluxo de trabalho

Content Lab funciona localmente com servidor Node.js, interface JavaScript, renderização visual Remotion e ferramentas FFmpeg. A IA pode criar um edit_plan.json, que a interface permite validar e ajustar por cena.

Comece pela aba Narração: escolha uma pasta que pode estar vazia, importe a gravação, aplique limpeza de silêncios e efeito opcional, ouça o resultado e gere transcript.json/txt/srt. Nenhum edit_plan.json é exigido nessa etapa. Com a transcrição preparada, peça ao ChatGPT o guia e o edit_plan.json; abra a mesma pasta no Editor, organize assets, valide, salve e renderize.

A referência de campos desta página é derivada do schema instalado. Um campo previsto no JSON não significa automaticamente que todo componente visual use esse campo: essas limitações são mencionadas em cada descrição.

![Estrutura do edit_plan.json](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/structure.svg)

## Organização de arquivos e URIs

Organize edit_plan.json, audio/narration.wav e assets dentro da pasta do projeto. Caminhos project:// apontam para a raiz do projeto. Arquivos builtin:// vêm da biblioteca instalada.

O atributo sources.assets indica uma pasta, mas não completa os caminhos das camadas: cada asset deve ter seu URI completo e existente. A narração e a transcrição usam caminhos relativos.

Na aba Narração, a voz é preparada antes do plano; o editor oferece um atalho para voltar a essa aba. Ao criar edit_plan.json depois, use audio.narration = 'audio/narration.wav' e sources.transcript = 'transcript.json'; o MP4 usa a voz já tratada. No Editor, use Listar para consultar URIs de assets e Validar JSON antes do render.

Use / como separador nos caminhos tanto no Windows quanto no Linux. Nomes, subpastas e extensões precisam corresponder exatamente aos arquivos: no Linux, Narracao.wav não é igual a narracao.wav. Caminhos que saem da pasta do projeto, inclusive por links simbólicos, são bloqueados.

Para criar cenas de motion design, vá à seção Sua linha do tempo no Editor automático, clique em + Nova cena e abra Editar propriedades avançadas (fundo, câmera, elementos, animações). Use background.color para cor, background.asset com URI builtin:// ou project:// para mídia própria e background.loop:true para repetir um fundo de vídeo. Adicione quantas camadas quiser e defina cells livremente no grid 3×3, sem obrigatoriedade de duas imagens ou de uma composição esquerda/direita.

Se a pasta já possui narração, a aba Narração pode reaproveitar o original arquivado para gerar novas versões, sobrescrevendo audio/narration.wav e as transcrições sem apagar o original. O mesmo projeto posteriormente recebe edit_plan.json; não precisa criar pastas paralelas.

Para imagens, vídeos, músicas e SFX, use URIs project:// desde a raiz da pasta do projeto (ex.: project://assets/personagens/heroi.png); arquivos incorporados ao aplicativo usam builtin://. O atributo sources.assets nunca preenche automaticamente o caminho dos elementos.

Para gameplay, preserve a proporção. contain mostra todo o quadro e é o padrão visual; cover recorta e stretch estica. Não amplie um clipe 1920×1080 quando a saída também é 1920×1080.

### Estrutura sugerida do projeto

```text
meu-video/
├── edit_plan.json                     criado DEPOIS da narração
├── audio/
│   ├── narration.original.wav         gravação original preservada
│   ├── narration.prepared.wav         voz limpa (antes do efeito)
│   └── narration.wav                  voz final, com efeito opcional
├── assets/
│   ├── abertura.mp4
│   └── personagens/
│       └── heroi.png                 subpastas permitidas
├── custom-scenes/
│   └── MinhaCena.tsx                  componente Remotion local (opcional)
├── transcript.json                    gerado após preparar a narração
├── transcript.txt                     texto gerado
├── transcript.srt                     legendas geradas
├── transcript.build.json              origem dos timestamps
├── narration.build.json               opções e arquivo de origem
└── output/                            produzido após render
```

![Comparação entre contain e cover](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/fitting.svg)

## Layouts, grade 3×3 e profundidade

Na grade, 1/2/3 ocupam a primeira linha, 4/5/6 a linha central e 7/8/9 a inferior. cells [2,5,8] ocupa a coluna central; cells [5,8] ocupa os dois quadrados centrais inferiores; cells [5] somente o centro. A mídia é encaixada automaticamente na caixa: contain preserva o PNG sem recorte e cover preenche com possível recorte.

As camadas podem usar transform e keyframes para posição, escala, rotação e opacidade. transform.opacity de 0 a 1 controla a transparência; keyframes[].opacity anima esse valor; z maior fica na frente. Use transform.scale somente para ajuste fino após definir cells.

PNG com transparência assimétrica pode parecer deslocado apesar de estar centralizado matematicamente. transform.offsetX/offsetY permitem corrigir a posição em pixels: positivo move para direita/baixo; negativo move para esquerda/cima. Os offsets não modificam a caixa do grid e margens transparentes internas continuam fazendo parte do PNG.

![Grade de nove células](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/grid.svg)

## Camadas, animações, textos e efeitos

Tipos disponíveis: image e video para mídia, overlay para sobreposições, text para frase estática, kinetic_text para palavras em movimento, caption para legendas, filter para tratamento visual e sfx para som.

Os presets de entrada, movimento contínuo e saída ficam em animation. Os keyframes usam segundos relativos ao início da cena; já start/end/at usam tempo absoluto.

Suavidade não significa lentidão: o motor usa interpolação contínua de ordem C2 (smootherstep) por padrão em keyframes de elementos e câmera, entradas, saídas e carrosséis. Uma duração de 0.1 segundo continua tendo exatamente 0.1 segundo. animation.enterDuration/exitDuration e config.transitionDuration controlam TEMPO, independentemente da curva. easing:linear continua disponível para movimento intencionalmente linear; ease_in/out aceleram/desaceleram. Não adicionar segundos automaticamente em nome da fluidez.

O pan e slow_zoom_in/out usam início e fim assentados; float_soft, wiggle_soft, pulse_soft e camera.shake têm envelope de amplitude suave para não começar ou encerrar com saltos. No word_stack_vertical a posição, escala, opacidade e cor dos textos mudam continuamente; word_stream_horizontal também elimina a antiga palavra-fantasma ao terminar a passagem. Transições fade, slide_left e blur_left/right/up usam curvas suaves e chegam à posição final no último frame, sem expandir a timeline; o blur só cresce no meio da passagem e recua antes do corte.

Limitação física: uma transição de 0.1 s em 30 fps tem apenas 3 frames; em 60 fps tem 6. O software não inventa quadros nem transforma 0.1 s em 0.4 s: caso queira mais amostras de movimento, aumente project.fps conscientemente. cut continua instantâneo por definição, e texto digitado/reveal continua discreto por caractere; suavizar não deve mudar sua cadência semântica.

Legenda bangers_highlight_block: o fundo colorido da palavra anterior desaparece enquanto o da próxima cresce suavemente, sem mover ou apagar as letras. O tempo padrão é 0.10 segundo e pode ser ajustado via config.highlightTransitionDuration:0.1 (sem mudança dos timestamps nem da duração da fala). Para transições de cena, o fade agora preserva corretamente a direção: cena anterior no início, próxima cena no final, inclusive quando restam somente três frames.

O motor possui estilos impact, impact_yellow, paper_word, versus_big, word_pop, anton, bangers, word_stack_vertical e word_stream_horizontal, além de estilos de legendas anton_karaoke e bangers_highlight_block.

O carrossel word_stack_vertical usa três faixas horizontais: a frase ativa ocupa a linha CENTRAL em toda a largura do vídeo, mesmo que cells indique somente duas colunas. A frase seguinte fica acima, menor, com transparência reduzida e alinhada à borda inferior do slot superior; a anterior fica abaixo, menor, semitransparente e alinhada ao topo do slot inferior. A transição padrão direction:down faz o texto de cima assumir o centro enquanto o centro desce. Todo o texto fica à esquerda por padrão, com quebras de linha automáticas para frases longas.

O painel cinza opcional de word_stack_vertical pertence SOMENTE à faixa horizontal central e cobre a largura integral da tela. panelOpacity:0 (padrão) desativa a faixa; panelColor e panelOpacity permitem destaque sutil, sem card curto nem fundo atrás de toda a pilha. Para frases inteiras, use config.items com text/start/end por item, não elementos text independentes. config.align:center e direction:up continuam disponíveis em projetos antigos, mas a composição editorial padrão é align:left e direction:down.

Campos específicos de config já usados pelo render: maxWords, highlightColors, highlightPaddingX/Y, highlightRadius, transitionDuration, items, inactiveOpacity, slotGap, activeScale, inactiveScale, direction, align, inactiveColor, panelColor, panelOpacity, panelRadius, panelPaddingX/Y, opacity, scanlineOpacity, vignette, flicker e jitter. config aceita outras chaves sintaticamente, mas elas só produzem efeito se o componente as interpretar.

O validador produz avisos para duas camadas de texto sobrepostas em tempo e região; isso não é erro bloqueante, pois composições intencionais são permitidas.

![Composição das camadas z](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/layers.svg)

## Áudio, narração, música e SFX

Crie a transcrição antes do edit_plan.json: a aba Narração reduz silêncio no início, no fim e intervalos internos longos conforme o parâmetro escolhido, salva audio/narration.wav com pitch opcional e transcreve a versão limpa sem efeito de pitch. O JSON posterior usa esses timestamps originais da voz preparada. As pausas deliberateadas posteriores devem usar audio.silenceInserts no edit_plan.json: o renderer aplica a inserção aos tempos das palavras uma só vez. narrationTrim e sourceCuts são destinados a edições posteriores do áudio de entrada, não devem reproduzir cortes que a aba Narração já fez.

O estágio independente de Narração usa silencedetect com limite padrão -42 dB e redução de pausas internas acima de 0,7 s, mantendo pequena margem para evitar cortes secos; ajuste ou desative a redução interna se comprometer a expressão. A limpeza é executada ANTES do Whisper. O modo Corpo natural usa somente reforço moderado de graves por equalização (sem mudar pitch e sem exigir rubberband); os modos Grave suave/equilibrado/profundo mudam pitch apenas -0,2/-0,4/-0,7 semitons, com preservação de formantes, janela longa e suavização quando rubberband estiver instalado. Os modos são interpretações próprias, não cópia de efeitos proprietários de terceiros. Você pode ouvir A/B a versão limpa narration.prepared.wav e a voz final narration.wav na aba; comparar a mesma frase antes de aprovar. O Studio reconhece narração já preparada e evita repetir normalização e trim no render. Em fluxos legados, voice.autoTrimSilence controla bordas e sourceCuts/silenceInserts ainda funcionam.

A música tem start/end na timeline e pode escolher um trecho do arquivo usando sourceStart/sourceEnd; o trim automático tira silêncio das bordas do trecho selecionado antes de aplicar loop e fades, e loop repete somente a parte audível quando necessário. Duas músicas podem se cruzar: a primeira termina em 20 s com fadeOut de 3 s; a próxima começa em 17 s com fadeIn de 3 s. A sobreposição de 17 a 20 s produz o crossfade no mixer. Ducking reduz o volume durante a voz. Mudanças só de som não invalidam clipes visuais.

![Trim de silêncio nas bordas dos SFX](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/audio.svg)

## Cenas programáveis Remotion (TSX) — do ChatGPT ao vídeo

Quando a composição precisar de uma câmera virtual que percorre um espaço maior, SVGs procedurais, partículas, tipografia coreografada, grades reativas ou outros movimentos complexos, use uma cena programável TSX. Não precisa fragmentar uma animação contínua em dezenas de cenas: uma cena da timeline pode conter a composição React inteira. Para imagens simples, textos e cartões comuns, continue usando os elementos existentes.

Fluxo econômico de tokens: descreva o objetivo e os tempos e peça ao ChatGPT um ÚNICO arquivo .tsx completo, export default, pronto para o Remotion do Content Lab. Solicite alterações futuras como patches ao mesmo arquivo, preservando os nomes e a estrutura, em vez de reescrever o código todo. Peça também apenas o fragmento JSON da cena, não o plano completo quando já existir.

Baixe ou salve o arquivo TSX gerado pelo ChatGPT em seu computador e coloque-o dentro da pasta do projeto: custom-scenes/MinhaCena.tsx. A interface atual não baixa nem instala automaticamente o código produzido no chat; essa cópia é manual. Use project://custom-scenes/MinhaCena.tsx em timeline[].customComponent.module. A geração e o download do arquivo dependem das ferramentas que estiverem disponíveis no ChatGPT.

No edit_plan.json existente, use customComponent: {module: 'project://custom-scenes/MinhaCena.tsx', mode: 'replace', props: {...}, assets: {...}}. mode replace entrega toda a composição visual ao componente; mode overlay desenha o TSX sobre as camadas tradicionais. O JSX deve ter export default. Não cole código TSX dentro do JSON: o contrato só contém referência, parâmetros e URIs de assets.

Em props, forneça valores JSON reutilizáveis como títulos, cores e dados, sem repetir a estrutura de cada elemento. Em assets, dê nomes a URIs locais como project://assets/logo.svg, project://assets/mascote.png ou builtin://...; o componente recebe os URLs pelo objeto assets. Retículas, curvas, linhas, diagramas e cards normalmente devem ser desenhados com React/SVG/CSS por código, sem downloads desnecessários. Não suponha que arquivos citados existem antes de conferir.

No TSX, importações suportadas são React, Remotion e módulos locais de custom-scenes, respeitadas as dependências realmente instaladas. Use useCurrentFrame e useVideoConfig para calcular qualquer quadro por tempo; use SVG, interpolate, spring e cálculos determinísticos conforme a necessidade. Não use setInterval, relógio real, CSS animations/transitions, URLs externas não verificadas nem aleatoriedade sem semente, pois os quadros devem renderizar corretamente em qualquer ordem.

Por segurança, código TSX é código executável e só deve vir de projeto local inspecionado. Para habilitar, inicie o processo com CONTENTLAB_TRUST_CUSTOM_TSX=1 (Linux: export CONTENTLAB_TRUST_CUSTOM_TSX=1; PowerShell: $env:CONTENTLAB_TRUST_CUSTOM_TSX='1'). A opção não deve ser ligada para projetos ou código de terceiros não confiáveis. O Content Lab não executa esse TSX a partir do texto do JSON nem oferece sandbox completo.

Depois de copiar TSX e atualizar o JSON, clique Validar JSON, salve, renderize e confira o MP4. A validação do JSON não comprova que o TSX compilou: importações, fonte, layout, clipping e comportamento de frames exigem render. O cache da cena identifica mudanças nos arquivos da pasta custom-scenes; mantenha IDs estáveis e repita a inspeção de quadros após modificar o TSX.

Exemplo de código e plano de edição versionados no repositório: examples/custom-scenes/FollowDot.tsx e examples/programmatic-motion-edit-plan.json. O exemplo mostra câmera e geometria contínua em uma cena de 17,7 s; não é cópia pixel a pixel do vídeo de referência. Para reproduzir a cena no próprio projeto, copie o TSX, prepare uma narração válida e adapte seu JSON, duração e resolução.

![Composição das camadas z](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/layers.svg)

## Cenas, tempo e transições

A lista timeline é ordenada pelo start absoluto. Cada cena possui ID estável; cenas não se sobrepõem. A duração real resulta da diferença entre end e start.

Transições disponíveis: cut, fade, blur_left, blur_right, blur_up e slide_left. O compositor utiliza frames em movimento da cena entrante sem ampliar o tempo total do vídeo.

O cache mantém MP4s individuais por ID. A montagem e o áudio final continuam sendo etapas necessárias mesmo quando todas as cenas visuais são reaproveitadas.

![Timeline com cenas identificadas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/timeline.svg)

## Inserção de tempo e sincronização

Ao inserir ou duplicar uma cena, o storyboard desloca as cenas seguintes, seus efeitos sonoros, a trilha global e as palavras da transcrição. Uma pausa correspondente é registrada na narração.

Mover manualmente somente uma cena é uma decisão visual: isso não insere silêncio automaticamente na voz. Use Desfazer e Refazer para recuperar alterações do storyboard.

Se a cena nova também precisar de fala nova, atualize a gravação e seus dados de transcrição; o silenceInsert serve como espaço reservado de voz.

![Deslocamento de áudio e vídeo após inserir uma cena](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/ripple.svg)

## Cache, prévias de cena e exportação

Aproveitar cache compara os dados visuais relevantes, assets e a identidade do renderer para detectar cenas que exigem novo MP4. Refazer tudo limpa output/ com confirmação e reconstrói os clipes.

O storyboard permite reproduzir o vídeo individual já renderizado. Quando o JSON é alterado, a interface distingue o clipe anterior do resultado novo. A reprodução por cena não codifica um Preview completo.

Os clipes individuais não incluem obrigatoriamente toda a mixagem. Conferir o vídeo final ainda é importante para validar narração, música, efeitos e transições.

![Quadros em movimento durante uma transição](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/transitions.svg)

## O que a interface oferece

Vídeos e cortes: carregamento de fonte YouTube, importação local, lista de arquivos em cache, marcação e exportação de trechos de vídeo e áudio.

Narração: escolha a pasta mesmo sem edit_plan.json, selecione a gravação (ou reutilize a original preservada), ajuste remoção de pausas longas e o efeito grave opcional. O app salva audio/narration.original.ext, audio/narration.prepared.wav, audio/narration.wav, transcript.json/txt/srt e metadados. Ouça pelo player integrado e compare a versão limpa sem efeitos com o áudio final no seletor A/B. Comece pelo Corpo natural (EQ leve sem pitch) se o grave antigo soar artificial; os outros presets são progressivamente mais intensos e precisam de escuta real. Grave suave/equilibrado/profundo usam o filtro rubberband. Os inicializadores Linux/Windows verificam o filtro em ffmpeg -filters e, quando ausente, instalam automaticamente em .tools/ffmpeg um FFmpeg portátil GPL com librubberband e checksum SHA256 verificado; reutilizam instalações completas. Não é necessário instalar manualmente o filtro ao usar run.sh ou iniciar.bat. O comando npm start inicia somente o servidor e não instala dependências. O arquivo final já pode ser usado no plano e render. Os inicializadores instalam whisper-cli/modelo quando necessário.

Instalação automática: no Linux, execute bash run.sh ou use o atalho criado por instalar-atalho.sh; no Windows, abra iniciar.vbs ou iniciar.bat. Os inicializadores verificam Node.js 22+, FFmpeg/FFprobe COM filtro rubberband, whisper.cpp, modelo Whisper, dependências npm/Remotion e Chrome Headless Shell para renderizar, baixando apenas o que estiver ausente ou sem capacidade necessária. Binários locais ficam na pasta .tools ignorada pelo Git; no Zorin/Ubuntu o compilador para whisper.cpp pode exigir sudo. O Studio não precisa alterar a instalação global de Node. O download inicial requer internet; as aberturas posteriores reaproveitam o material instalado.

Editor automático: abrir/criar projeto depois do preparo da voz, conferir assets, buscar e selecionar cenas, criar, inserir, duplicar e excluir, ajustar tempos, editar camadas, abrir a aba Narração quando necessário, validar e salvar o JSON, visualizar clipes em cache e exportar o MP4. Pausas editoriais são inseridas na timeline por audio.silenceInserts.

Na seção Sua linha do tempo, + Nova cena cria uma cena editável; + Adicionar camada inclui imagem, vídeo, texto, legenda, overlay ou efeito sonoro; e Propriedades avançadas contém background, grid/cells, câmera, animações, transformações e keyframes. Não há um formulário paralelo limitado a esquerda/direita: toda a composição usa o mesmo editor visual e um único edit_plan.json.

Documentação: referência pesquisável de campos e exemplos, disponível no próprio site e como arquivo Markdown ou HTML. A skill ZIP inclui os documentos e diagramas.

![Estrutura do edit_plan.json](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/structure.svg)

## Diagnóstico e boas práticas

Arquivo não encontrado: confira URI, extensão, maiúsculas/minúsculas, symlinks e a pasta do projeto. Propriedade rejeitada: consulte a tabela de campos; objetos do schema geralmente proíbem chaves adicionais.

Áudio dessincronizado: confira sourceCuts, silenceInserts e at dos SFX. Imagem ampliada ou cortada: use contain e remova zoom não intencional. Texto sobreposto: revise start/end, cells, z e os avisos da validação.

Primeiro render após atualizar o motor pode recalcular assinaturas do cache. Não suponha que estilos/presets previstos apenas no schema já criam comportamentos inexistentes.

![Comparação entre contain e cover](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/fitting.svg)

## Catálogo de recursos implementados

### Layouts

`fullscreen` · `3x3` · `custom_grid` · `three_columns` · `left_right` · `character_vs` · `center_column`

### Transições

`cut` · `fade` · `blur_left` · `blur_right` · `blur_up` · `slide_left`

### Animações de entrada

`cut` · `none` · `fade` · `pop_in` · `slide_from_left` · `slide_from_right` · `slide_up` · `slide_down` · `center_reveal`

### Animações contínuas

`none` · `float_soft` · `wiggle_soft` · `pulse_soft` · `slow_zoom_in` · `slow_zoom_out` · `pan`

### Animações de saída

`cut` · `none` · `fade` · `fade_out` · `slide_to_left` · `slide_to_right` · `slide_to_bottom` · `center_close`

### Estilos de texto

`impact` · `impact_yellow` · `paper_word` · `versus_big` · `word_pop` · `anton` · `bangers` · `word_stack_vertical` · `word_stream_horizontal`

### Estilos de legenda

`anton_karaoke` · `bangers_highlight_block`

### Filtros

`dim` · `crt_tv`

### Estilos de overlay

`green_screen` · `green_screen_default` · `green_screen_soft`

## Referência completa dos campos do JSON

Obrigatório significa exigido dentro do objeto pai. Um bloco opcional pode ter campos obrigatórios quando preenchido.

### Projeto

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `project` | object | Sim | — | `{}` | Metadados gerais de formato e identificação da produção. |
| `project.name` | string | Sim | mín. caracteres 1 | `"Meu vídeo"` | Nome do vídeo exibido no projeto e no relatório de render. |
| `project.format` | enum | Sim | opções: youtube_long, youtube_short, custom | `"youtube_long"` | Formato de saída: youtube_long, youtube_short ou custom. |
| `project.profile` | string | Sim | mín. caracteres 1 | `"generic"` | Identificador textual do perfil; não carrega automaticamente templates diferentes. |
| `project.resolution` | object | Não | — | `{}` | Dimensões que substituem as do formato escolhido. |
| `project.resolution.width` | integer | Sim | mín. 1 | `1920` | Largura do MP4 em pixels. |
| `project.resolution.height` | integer | Sim | mín. 1 | `1080` | Altura do MP4 em pixels. |
| `project.fps` | number | Não | maior que 0 | `30` | Quadros por segundo do vídeo final. |
| `project.seed` | integer | Não | — | `1` | Semente para efeitos determinísticos, quando utilizados. |

### Fontes

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `sources` | object | Não | — | `{}` | Referências a arquivos auxiliares do projeto. |
| `sources.assets` | string | Não | — | `"exemplo"` | Nome da pasta de mídia; não resolve automaticamente URIs de camada. |
| `sources.transcript` | string | Não | — | `"exemplo"` | Arquivo de palavras e frases temporizadas relativo à pasta do projeto. |
| `sources.assetCatalog` | string | Não | — | `"exemplo"` | Caminho de catálogo de mídia; previsto no contrato, mas sem uso direto confirmado no render atual. |

### Áudio

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `audio` | object | Sim | — | `{}` | Configurações de narração, música, efeitos e mixagem. |
| `audio.narration` | string | Sim | mín. caracteres 1 | `"audio/narration.wav"` | Caminho relativo do arquivo de voz obrigatório. |
| `audio.sourceCuts` | array | Não | — | `[]` | Recortes da narração original, concatenados antes da mixagem. |
| `audio.sourceCuts[].start` | number | Sim | mín. 0 | `0` | Início do recorte na gravação original, em segundos. |
| `audio.sourceCuts[].end` | number | Sim | maior que 0 | `12` | Fim do recorte na gravação original, em segundos. |
| `audio.voice` | object | Não | — | `{}` | Parâmetros de tratamento da voz principal. |
| `audio.voice.preset` | string | Não | — | `"exemplo"` | Nome textual do preset de voz; o FFmpeg atual usa principalmente os campos numéricos. |
| `audio.voice.trimDb` | number | Não | — | `1` | Ganho final de voz em decibéis. |
| `audio.voice.normalize` | boolean | Não | — | `true` | Habilita a normalização de loudness da voz; padrão ativo. |
| `audio.voice.targetLufs` | number | Não | mín. -30; máx. -5 | `-30` | Loudness alvo da narração, normalmente -16 LUFS. |
| `audio.voice.truePeakDb` | number | Não | mín. -9; máx. 0 | `-9` | Limite de pico verdadeiro da narração, normalmente -1,5 dBTP. |
| `audio.voice.highpassHz` | number | Não | mín. 0; máx. 300 | `0` | Frequência de filtro passa-altas, normalmente 70 Hz; zero desliga. |
| `audio.voice.fadeIn` | number | Não | mín. 0 | `0.4` | Fade-in da narração em segundos, aplicado no começo audível da voz. |
| `audio.voice.fadeOut` | number | Não | mín. 0 | `0.8` | Fade-out da narração em segundos, aplicado no fim audível da voz mesmo com música após a fala. |
| `audio.voice.autoTrimSilence` | boolean | Não | — | `true` | Trim automático do silêncio apenas no começo/fim da narração; padrão ligado. Não remove pausas internas. |
| `audio.ducking` | object | Não | — | `{}` | Redução da música quando a narração está ativa. |
| `audio.ducking.enabled` | boolean | Não | — | `true` | Ativa o compressor sidechain comandado pela voz. |
| `audio.ducking.threshold` | number | Não | maior que 0; máx. 1 | `1` | Limiar linear do compressor, padrão aproximado 0,02. |
| `audio.ducking.ratio` | number | Não | mín. 1; máx. 20 | `1` | Razão de compressão do áudio musical, padrão 6. |
| `audio.ducking.attackMs` | number | Não | mín. 0.1; máx. 2000 | `0.1` | Ataque da redução musical em milissegundos. |
| `audio.ducking.releaseMs` | number | Não | mín. 1; máx. 9000 | `1` | Liberação da redução musical em milissegundos. |
| `audio.music` | array | Não | — | `[]` | Lista de clipes musicais posicionados na timeline. |
| `audio.music[].asset` | string | Sim | — | `"project://audio/trilha.wav"` | URI do arquivo de música existente. |
| `audio.music[].start` | number | Sim | mín. 0 | `0` | Início absoluto da música em segundos. |
| `audio.music[].end` | number | Sim | maior que 0 | `1` | Fim absoluto da música em segundos. |
| `audio.music[].preset` | string | Não | — | `"exemplo"` | Intensidade da trilha; valores usuais subtle, normal e present, dependendo do motor. |
| `audio.music[].trimDb` | number | Não | — | `1` | Volume da música em decibéis, sobrepondo o preset. |
| `audio.music[].fadeIn` | number | Não | mín. 0 | `0` | Duração da subida de volume inicial. |
| `audio.music[].fadeOut` | number | Não | mín. 0 | `0` | Duração da descida de volume final. |
| `audio.music[].sourceStart` | number | Não | mín. 0 | `12` | Ponto inicial da música dentro do arquivo de origem, em segundos (padrão 0). |
| `audio.music[].sourceEnd` | number | Não | maior que 0 | `32` | Ponto final da música dentro do arquivo de origem, em segundos; ausente significa fim do arquivo. |
| `audio.music[].loop` | boolean | Não | — | `true` | Repete apenas o trecho musical selecionado até preencher start/end; padrão true. |
| `audio.music[].autoTrimSilence` | boolean | Não | — | `true` | Trim automático do silêncio nas bordas do trecho musical, antes de loop e fades; padrão ligado, não corta pausas internas. |
| `audio.silenceInserts` | array | Não | — | `[]` | Pausas adicionadas à narração para preservar sincronização quando cenas são inseridas. |
| `audio.silenceInserts[].at` | number | Sim | mín. 0 | `5` | Posição absoluta da pausa na timeline resultante. |
| `audio.silenceInserts[].duration` | number | Sim | maior que 0 | `2` | Duração positiva da pausa adicionada à voz. |
| `audio.narrationTrim` | object | Não | — | `{}` | Trecho único da gravação original que será mantido, com start/end em segundos; não combinar com sourceCuts. |
| `audio.narrationTrim.start` | number | Sim | mín. 0 | `2` | Início do trecho contínuo da voz no arquivo original. |
| `audio.narrationTrim.end` | number | Sim | maior que 0 | `30` | Fim do trecho contínuo da voz no arquivo original. |

### Cenas e transições

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `timeline` | array | Sim | — | `[]` | Lista ordenada de cenas com intervalos absolutos sem sobreposição. |
| `timeline[].id` | string | Sim | mín. caracteres 1 | `"batman"` | Identificador único, estável e chave de reaproveitamento do cache. |
| `timeline[].start` | number | Sim | mín. 0 | `0` | Instante absoluto do começo da cena. |
| `timeline[].end` | number | Sim | maior que 0 | `5` | Instante absoluto do fim da cena, posterior ao começo. |
| `timeline[].layout` | texto ou objeto | Não | — | `{}` | Layout predefinido como fullscreen, 3x3 ou character_vs. |
| `timeline[].layout.grid` | objeto | Não | fixo: 3x3 | `"3x3"` | Grade declarada na forma de objeto: atualmente 3x3. |
| `timeline[].layout.preset` | string | Não | — | `"exemplo"` | Nome textual do layout a ser aplicado. |
| `timeline[].transitionOut` | string | Não | — | `"fade"` | Transição: cut, fade, blur_left, blur_right, blur_up ou slide_left. |
| `timeline[].transitionDuration` | number | Não | maior que 0 | `0.35` | Duração temporal da transição que introduz a próxima cena. |
| `timeline[].customComponent` | object | Não | — | `{}` | Composição programável Remotion/TSX; código local confiável sob custom-scenes/. |
| `timeline[].customComponent.module` | string | Sim | — | `"exemplo"` | URI project://custom-scenes/...tsx; o código só executa com CONTENTLAB_TRUST_CUSTOM_TSX=1. |
| `timeline[].customComponent.mode` | enum | Não | opções: replace, overlay | `"replace"` | replace substitui a parte visual por TSX; overlay sobrepõe TSX às camadas normais. |
| `timeline[].customComponent.props` | object | Não | — | `{}` | Parâmetros JSON fornecidos ao componente TSX como propriedades React. |
| `timeline[].customComponent.assets` | object | Não | — | `{}` | Mapa de nomes para URIs existentes; arquivos expostos ao TSX pelo prop assets. |

### Fundo

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `timeline[].background` | object | Não | — | `{}` | Fundo sólido, com imagem ou com vídeo. |
| `timeline[].background.color` | string | Não | — | `"exemplo"` | Cor CSS/hexadecimal usada como fundo sólido. |
| `timeline[].background.asset` | string | Não | — | `"project://assets/fundo.mp4"` | URI de imagem ou vídeo de fundo. |
| `timeline[].background.fit` | enum | Não | opções: cover, contain, stretch | `"contain"` | contain preserva o quadro; cover recorta; stretch estica. |
| `timeline[].background.loop` | boolean | Não | — | `true` | Repetir vídeo de fundo até acabar a cena. |
| `timeline[].background.muted` | boolean | Não | — | `true` | Quando false, incluir áudio original da mídia de fundo. |
| `timeline[].background.preset` | enum | Não | opções: subtle, normal, strong | `"subtle"` | Intensidade do áudio de fundo, se ativado. |
| `timeline[].background.trimDb` | number | Não | — | `1` | Ganho em decibéis do áudio original do fundo. |
| `timeline[].background.fadeIn` | number | Não | mín. 0 | `0` | Fade de entrada do áudio do fundo. |
| `timeline[].background.fadeOut` | number | Não | mín. 0 | `0` | Fade de saída do áudio do fundo. |

### Camadas e seus parâmetros

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `timeline[].elements` | array | Sim | — | `[]` | Lista de camadas gráficas e/ou efeitos sonoros. |
| `timeline[].elements[].type` | enum | Sim | opções: video, image, text, kinetic_text, caption, overlay, filter, sfx | `"image"` | Tipo: video, image, text, kinetic_text, caption, overlay, filter ou sfx. |
| `timeline[].elements[].asset` | string | Não | — | `"project://assets/heroi.png"` | Arquivo da camada com URI project:// ou builtin://. |
| `timeline[].elements[].text` | string | Não | — | `"exemplo"` | Texto exibido na camada. |
| `timeline[].elements[].style` | string | Não | — | `"exemplo"` | Nome de estilo de texto, legenda, overlay ou filtro. |
| `timeline[].elements[].fontAsset` | string | Não | — | `"exemplo"` | URI para arquivo de fonte que substitui a tipografia padrão. |
| `timeline[].elements[].fontScale` | number | Não | maior que 0; máx. 3 | `1` | Multiplicador de tamanho do texto, maior que zero. |
| `timeline[].elements[].reveal` | object | Não | — | `{}` | Revelação de texto com velocidade e atraso. |
| `timeline[].elements[].reveal.charactersPerSecond` | number | Sim | maior que 0 | `1` | Quantidade de caracteres revelados por segundo. |
| `timeline[].elements[].reveal.delay` | number | Não | mín. 0 | `0` | Atraso antes de iniciar a revelação textual. |
| `timeline[].elements[].textStyle` | object | Não | — | `{}` | Detalhes personalizados de texto, contorno e sombra. |
| `timeline[].elements[].textStyle.fontFamily` | enum | Não | opções: Anton, Bangers | `"Anton"` | Família de fonte aceita pelo schema, como Anton ou Bangers. |
| `timeline[].elements[].textStyle.uppercase` | boolean | Não | — | `true` | Controla exibição de palavras em letras maiúsculas. |
| `timeline[].elements[].textStyle.color` | string | Não | — | `"exemplo"` | Cor CSS do preenchimento do texto. |
| `timeline[].elements[].textStyle.outlineColor` | string | Não | — | `"exemplo"` | Cor do contorno do texto. |
| `timeline[].elements[].textStyle.outlineWidth` | number | Não | mín. 0; máx. 40 | `0` | Espessura do contorno em pixels. |
| `timeline[].elements[].textStyle.shadow` | object | Não | — | `{}` | Objeto de sombra do texto. |
| `timeline[].elements[].textStyle.shadow.color` | string | Não | — | `"exemplo"` | Cor CSS da sombra, podendo incluir transparência. |
| `timeline[].elements[].textStyle.shadow.blur` | number | Não | mín. 0; máx. 100 | `0` | Raio de desfoque da sombra. |
| `timeline[].elements[].textStyle.shadow.offsetX` | number | Não | mín. -100; máx. 100 | `-100` | Deslocamento horizontal da sombra em pixels. |
| `timeline[].elements[].textStyle.shadow.offsetY` | number | Não | mín. -100; máx. 100 | `-100` | Deslocamento vertical da sombra em pixels. |
| `timeline[].elements[].start` | number | Não | mín. 0 | `0` | Início absoluto da camada; usa o início da cena se ausente. |
| `timeline[].elements[].end` | number | Não | maior que 0 | `1` | Fim absoluto da camada; usa o fim da cena se ausente. |
| `timeline[].elements[].at` | number | Não | mín. 0 | `1.25` | Disparo absoluto do SFX, marcado pelo início audível depois do trim. |
| `timeline[].elements[].cells` | array | Não | mín. itens 1; sem duplicatas | `[2,5,8]` | Células únicas de 1 a 9 que delimitam a região ocupada. |
| `timeline[].elements[].fit` | enum | Não | opções: cover, contain, stretch, smart_cover | `"contain"` | contain preserva, cover recorta, stretch deforma, smart_cover se comporta como cover atualmente. |
| `timeline[].elements[].box` | texto ou objeto | Não | — | `{}` | Caixa decorativa: string de preset ou objeto de configurações. |
| `timeline[].elements[].box.preset` | string | Não | — | `"exemplo"` | Nome opcional do preset da caixa. |
| `timeline[].elements[].box.padding` | number | Não | mín. 0 | `0` | Preenchimento interno da caixa. |
| `timeline[].elements[].box.radius` | number | Não | mín. 0 | `0` | Raio de arredondamento da caixa. |
| `timeline[].elements[].box.shadow` | string | Não | — | `"exemplo"` | Descrição textual de sombra da caixa. |
| `timeline[].elements[].box.background` | string | Não | — | `"exemplo"` | Cor do fundo da caixa. |
| `timeline[].elements[].box.border` | string | Não | — | `"exemplo"` | Descrição CSS da borda da caixa. |
| `timeline[].elements[].animation` | object | Não | — | `{}` | Preset de entrada, movimento contínuo e saída. |
| `timeline[].elements[].animation.enter` | string | Não | — | `"exemplo"` | Nome do preset de entrada, como fade ou pop_in. |
| `timeline[].elements[].animation.idle` | string | Não | — | `"exemplo"` | Nome do preset contínuo, como float_soft ou pan. |
| `timeline[].elements[].animation.exit` | string | Não | — | `"exemplo"` | Nome do preset de saída, como fade_out ou cut. |
| `timeline[].elements[].animation.enterDuration` | number | Não | maior que 0 | `1` | Duração de entrada em segundos. |
| `timeline[].elements[].animation.exitDuration` | number | Não | maior que 0 | `1` | Duração de saída em segundos. |
| `timeline[].elements[].z` | integer | Não | — | `1` | Ordem de empilhamento; valores maiores ficam à frente. |
| `timeline[].elements[].loop` | boolean | Não | — | `true` | Repete a mídia da camada em vídeo. |
| `timeline[].elements[].muted` | boolean | Não | — | `true` | Se false, inclui som original do vídeo/overlay. |
| `timeline[].elements[].preset` | enum | Não | opções: subtle, normal, strong | `"subtle"` | Preset de intensidade sonora da camada. |
| `timeline[].elements[].trimDb` | number | Não | — | `1` | Ganho do áudio da camada em decibéis. |
| `timeline[].elements[].fadeIn` | number | Não | mín. 0 | `0` | Tempo de fade-in do áudio original da camada. |
| `timeline[].elements[].fadeOut` | number | Não | mín. 0 | `0` | Tempo de fade-out do áudio original da camada. |
| `timeline[].elements[].sync` | string | Não | — | `"exemplo"` | Rótulo aceito pelo schema; não presume sincronização automática universal. |
| `timeline[].elements[].emphasis` | array | Não | — | `[]` | Palavras enfatizadas na autoria; o efeito depende do estilo utilizado. |
| `timeline[].elements[].range` | object | Não | — | `{}` | Intervalo de referência para palavras da transcrição. |
| `timeline[].elements[].range.start` | number | Sim | mín. 0 | `0` | Início do intervalo de transcrição. |
| `timeline[].elements[].range.end` | number | Sim | maior que 0 | `1` | Fim do intervalo de transcrição. |
| `timeline[].elements[].config` | object | Não | — | `{}` | Objeto de opções específicas de cada efeito; nem toda chave arbitrária é interpretada. |
| `timeline[].elements[].id` | string | Não | mín. caracteres 1 | `"personagem"` | Identificador da camada visual, único dentro da cena. |
| `timeline[].elements[].transform` | object | Não | — | `{}` | Valores de posição, escala, rotação e opacidade inicial. |
| `timeline[].elements[].transform.x` | number | Não | mín. 0; máx. 1 | `0` | Posição horizontal normalizada entre zero e um. |
| `timeline[].elements[].transform.y` | number | Não | mín. 0; máx. 1 | `0` | Posição vertical normalizada entre zero e um. |
| `timeline[].elements[].transform.offsetX` | number | Não | — | `0` | Deslocamento horizontal em pixels após o encaixe no grid; positivo move para a direita. |
| `timeline[].elements[].transform.offsetY` | number | Não | — | `24` | Deslocamento vertical em pixels após o encaixe no grid; positivo move para baixo. |
| `timeline[].elements[].transform.scale` | number | Não | maior que 0; máx. 8 | `1.25` | Multiplicador de escala; maior que 1 amplia o objeto. |
| `timeline[].elements[].transform.rotation` | number | Não | mín. -360; máx. 360 | `-360` | Ângulo de rotação em graus. |
| `timeline[].elements[].transform.opacity` | number | Não | mín. 0; máx. 1 | `0` | Opacidade entre 0 (invisível) e 1 (visível). |
| `timeline[].elements[].keyframes` | array | Não | — | `[]` | Lista de mudanças de movimento ao longo da cena. |
| `timeline[].elements[].keyframes[].t` | number | Sim | mín. 0 | `0` | Tempo do keyframe relativo ao início da cena. |
| `timeline[].elements[].keyframes[].x` | number | Não | mín. 0; máx. 1 | `0` | Posição horizontal do keyframe. |
| `timeline[].elements[].keyframes[].y` | number | Não | mín. 0; máx. 1 | `0` | Posição vertical do keyframe. |
| `timeline[].elements[].keyframes[].scale` | number | Não | maior que 0; máx. 8 | `1` | Escala interpolada do keyframe. |
| `timeline[].elements[].keyframes[].rotation` | number | Não | mín. -360; máx. 360 | `-360` | Ângulo do keyframe. |
| `timeline[].elements[].keyframes[].opacity` | number | Não | mín. 0; máx. 1 | `0` | Opacidade do keyframe. |
| `timeline[].elements[].keyframes[].easing` | enum | Não | opções: linear, ease_in, ease_out, ease_in_out | `"linear"` | Curva de interpolação do keyframe. |

### Câmera

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `timeline[].camera` | object | Não | — | `{}` | Transformações da câmera virtual aplicada às camadas, sem ampliar automaticamente o fundo. |
| `timeline[].camera.keyframes` | array | Não | — | `[]` | Lista de quadros-chave da câmera. |
| `timeline[].camera.keyframes[].t` | number | Sim | mín. 0 | `0` | Tempo do quadro-chave relativo ao início da cena. |
| `timeline[].camera.keyframes[].x` | number | Não | mín. 0; máx. 1 | `0` | Centro horizontal normalizado da câmera. |
| `timeline[].camera.keyframes[].y` | number | Não | mín. 0; máx. 1 | `0` | Centro vertical normalizado da câmera. |
| `timeline[].camera.keyframes[].scale` | number | Não | mín. 1; máx. 4 | `1` | Escala/zoom da câmera. |
| `timeline[].camera.keyframes[].easing` | enum | Não | opções: linear, ease_in, ease_out, ease_in_out | `"linear"` | Curva temporal de interpolação da câmera. |
| `timeline[].camera.shake` | array | Não | — | `[]` | Lista de trechos de tremor da câmera. |
| `timeline[].camera.shake[].start` | number | Sim | mín. 0 | `0` | Início relativo do tremor em segundos. |
| `timeline[].camera.shake[].end` | number | Sim | maior que 0 | `1` | Fim relativo do tremor em segundos. |
| `timeline[].camera.shake[].amplitude` | number | Não | mín. 0; máx. 0.03 | `0` | Amplitude do tremor. |
| `timeline[].camera.shake[].frequency` | number | Não | maior que 0; máx. 20 | `1` | Frequência da oscilação do tremor. |

## Exemplos de uso

Alguns exemplos abaixo são fragmentos de cena ou áudio. Complete o projeto principal e valide os caminhos antes de renderizar.

### Cena programável TSX (câmera, SVG e movimento)

Copie examples/custom-scenes/FollowDot.tsx para custom-scenes/FollowDot.tsx na pasta do projeto, confirme narração existente e habilite CONTENTLAB_TRUST_CUSTOM_TSX=1 somente para código local confiável. É uma única cena contínua; sem importar JavaScript no JSON.

```json
{
  "project": {
    "name": "Exemplo TSX",
    "format": "custom",
    "profile": "generic",
    "resolution": {
      "width": 576,
      "height": 1024
    },
    "fps": 30
  },
  "audio": {
    "narration": "audio/narration.wav"
  },
  "timeline": [
    {
      "id": "motion_world",
      "start": 0,
      "end": 17.7,
      "layout": "fullscreen",
      "background": {
        "color": "#090a0e"
      },
      "customComponent": {
        "module": "project://custom-scenes/FollowDot.tsx",
        "mode": "replace",
        "props": {
          "title": "MOTION LAB",
          "accent": "#fa4245"
        },
        "assets": {}
      },
      "elements": [],
      "transitionOut": "cut"
    }
  ]
}
```

### Projeto completo com pastas e URIs

Exemplo ilustrativo: crie/importa narração no Editor, respeite os nomes reais dos arquivos e valide o JSON. transcript.json é gerado automaticamente após preparar a voz.

```json
{
  "project": {
    "name": "Meu vídeo",
    "format": "youtube_long",
    "profile": "generic"
  },
  "sources": {
    "assets": "assets",
    "transcript": "transcript.json"
  },
  "audio": {
    "narration": "audio/narracao.wav",
    "music": [
      {
        "asset": "project://audio/musica.mp3",
        "start": 0,
        "end": 5,
        "fadeIn": 0.3,
        "fadeOut": 0.5
      }
    ]
  },
  "timeline": [
    {
      "id": "intro",
      "start": 0,
      "end": 5,
      "layout": "3x3",
      "background": {
        "color": "#121826"
      },
      "elements": [
        {
          "id": "abertura",
          "type": "video",
          "asset": "project://assets/abertura.mp4",
          "start": 0,
          "end": 5,
          "fit": "contain",
          "cells": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9
          ]
        },
        {
          "id": "heroi",
          "type": "image",
          "asset": "project://assets/personagens/heroi.png",
          "start": 0,
          "end": 5,
          "cells": [
            2,
            5,
            8
          ],
          "fit": "contain",
          "z": 2
        }
      ],
      "transitionOut": "cut"
    }
  ]
}
```

### Plano completo mínimo

Narração obrigatória e uma cena de texto.

```json
{
  "project": {
    "name": "Introdução",
    "format": "youtube_long",
    "profile": "generic"
  },
  "sources": {
    "assets": "assets"
  },
  "audio": {
    "narration": "audio/narration.wav"
  },
  "timeline": [
    {
      "id": "intro",
      "start": 0,
      "end": 4,
      "layout": "fullscreen",
      "background": {
        "color": "#152238"
      },
      "elements": [
        {
          "id": "titulo",
          "type": "text",
          "text": "MEU PRIMEIRO VÍDEO",
          "style": "impact",
          "start": 0,
          "end": 4
        }
      ]
    }
  ]
}
```

### Personagem centralizado

PNG em coluna central, com animação e proporção preservada.

```json
{
  "id": "personagem",
  "start": 4,
  "end": 9,
  "layout": "3x3",
  "background": {
    "color": "#10151F"
  },
  "elements": [
    {
      "id": "heroi",
      "type": "image",
      "asset": "project://assets/heroi.png",
      "start": 4,
      "end": 9,
      "cells": [
        2,
        5,
        8
      ],
      "fit": "contain",
      "transform": {
        "scale": 1.25
      },
      "animation": {
        "enter": "pop_in",
        "idle": "float_soft",
        "exit": "cut"
      }
    }
  ]
}
```

### Gameplay sem recorte

Vídeo 16:9 mantido inteiro em fullscreen.

```json
{
  "id": "arkham",
  "start": 9,
  "end": 15,
  "layout": "fullscreen",
  "background": {
    "asset": "project://assets/arkham.mp4",
    "fit": "contain",
    "loop": true
  },
  "elements": [
    {
      "id": "subtitulo",
      "type": "text",
      "text": "ARKHAM KNIGHT",
      "start": 10,
      "end": 14,
      "cells": [
        7,
        8,
        9
      ],
      "style": "impact_yellow"
    }
  ]
}
```

### Narração, ducking e efeito sonoro

Áudio global e SFX disparado pelo início audível.

```json
{
  "audio": {
    "narration": "audio/narration.wav",
    "sourceCuts": [
      {
        "start": 0,
        "end": 12
      }
    ],
    "silenceInserts": [
      {
        "at": 5,
        "duration": 2
      }
    ],
    "voice": {
      "normalize": true,
      "targetLufs": -16,
      "truePeakDb": -1.5
    },
    "ducking": {
      "enabled": true,
      "threshold": 0.02,
      "ratio": 6,
      "attackMs": 40,
      "releaseMs": 350
    },
    "music": [
      {
        "asset": "project://audio/trilha.wav",
        "start": 0,
        "end": 14,
        "preset": "subtle",
        "fadeIn": 1,
        "fadeOut": 1
      }
    ]
  },
  "scene": {
    "id": "impacto",
    "start": 5,
    "end": 7,
    "elements": [
      {
        "type": "sfx",
        "asset": "project://audio/impacto.wav",
        "at": 5.2,
        "preset": "normal",
        "config": {
          "duration": 1.5
        }
      }
    ]
  }
}
```

### Trim e crossfade de duas músicas

Recortar trechos da fonte e sobrepor fades em segundos absolutos. Narração com corte simples e fades próprios.

```json
{
  "audio": {
    "narration": "audio/narration.wav",
    "narrationTrim": {
      "start": 2,
      "end": 30
    },
    "voice": {
      "normalize": true,
      "fadeIn": 0.4,
      "fadeOut": 0.8
    },
    "music": [
      {
        "asset": "project://audio/trilha-a.wav",
        "start": 0,
        "end": 20,
        "sourceStart": 12,
        "sourceEnd": 32,
        "autoTrimSilence": true,
        "fadeOut": 3
      },
      {
        "asset": "project://audio/trilha-b.wav",
        "start": 17,
        "end": 40,
        "sourceStart": 5,
        "sourceEnd": 45,
        "fadeIn": 3,
        "fadeOut": 2
      }
    ]
  }
}
```

### Carrossel vertical de frases em largura total

Três faixas: próxima menor acima, ativa maior no centro, anterior menor abaixo. Painel do centro percorre a largura inteira mesmo com cells em duas colunas.

```json
{
  "id": "pilha",
  "type": "kinetic_text",
  "style": "word_stack_vertical",
  "cells": [
    1,
    2,
    4,
    5,
    7,
    8
  ],
  "start": 0,
  "end": 4,
  "fontScale": 0.95,
  "textStyle": {
    "fontFamily": "Anton",
    "uppercase": true,
    "color": "#FFFFFF",
    "outlineWidth": 0
  },
  "config": {
    "items": [
      {
        "text": "BATMAN NÃO É JUIZ",
        "start": 0,
        "end": 1.3
      },
      {
        "text": "BATMAN NÃO É JÚRI",
        "start": 1.3,
        "end": 2.6
      },
      {
        "text": "BATMAN NÃO É O CARRASCO",
        "start": 2.6,
        "end": 4
      }
    ],
    "direction": "down",
    "align": "left",
    "inactiveOpacity": 0.38,
    "activeScale": 1.45,
    "inactiveScale": 0.72,
    "panelColor": "#D9D9D9",
    "panelOpacity": 0.12,
    "panelRadius": 0,
    "transitionDuration": 0.18
  }
}
```

### Legendas e texto cinético

Duas modalidades que usam a transcrição temporizada.

```json
{
  "id": "dialogo",
  "start": 15,
  "end": 21,
  "layout": "3x3",
  "elements": [
    {
      "id": "palavras",
      "type": "kinetic_text",
      "text": "EU SOU A VINGANÇA",
      "start": 15,
      "end": 19,
      "cells": [
        2,
        5,
        8
      ],
      "style": "word_stream_horizontal",
      "fontScale": 0.9,
      "config": {
        "transitionDuration": 0.16
      }
    },
    {
      "id": "legenda",
      "type": "caption",
      "start": 15,
      "end": 21,
      "cells": [
        7,
        8,
        9
      ],
      "style": "bangers_highlight_block",
      "config": {
        "maxWords": 7,
        "highlightColors": [
          "#2563EB",
          "#E53935"
        ]
      }
    }
  ]
}
```

### Movimento suave em 0,1 segundo

Curva suave independente do tempo declarado: 0.1 s continua 0.1 s; sem aumentar a animação.

```json
{
  "id": "micro-motion",
  "start": 0,
  "end": 2,
  "layout": "3x3",
  "background": {
    "color": "#111111"
  },
  "camera": {
    "keyframes": [
      {
        "t": 0,
        "x": 0.48,
        "y": 0.5,
        "scale": 1
      },
      {
        "t": 0.1,
        "x": 0.5,
        "y": 0.5,
        "scale": 1.02,
        "easing": "ease_in_out"
      }
    ]
  },
  "elements": [
    {
      "id": "titulo",
      "type": "text",
      "text": "SUAVE E RÁPIDO",
      "start": 0,
      "end": 2,
      "cells": [
        4,
        5,
        6
      ],
      "style": "anton",
      "animation": {
        "enter": "slide_up",
        "enterDuration": 0.1
      },
      "keyframes": [
        {
          "t": 0,
          "opacity": 0
        },
        {
          "t": 0.1,
          "opacity": 1
        }
      ]
    }
  ]
}
```

### Animação e câmera

Keyframes com tempos relativos ao início da cena.

```json
{
  "id": "close",
  "start": 21,
  "end": 26,
  "layout": "fullscreen",
  "camera": {
    "keyframes": [
      {
        "t": 0,
        "x": 0.5,
        "y": 0.5,
        "scale": 1
      },
      {
        "t": 4.7,
        "x": 0.5,
        "y": 0.5,
        "scale": 1.1,
        "easing": "ease_in_out"
      }
    ]
  },
  "elements": [
    {
      "id": "avatar",
      "type": "image",
      "asset": "project://assets/avatar.png",
      "start": 21,
      "end": 26,
      "cells": [
        2,
        5,
        8
      ],
      "keyframes": [
        {
          "t": 0,
          "scale": 1,
          "opacity": 0
        },
        {
          "t": 0.5,
          "scale": 1.2,
          "opacity": 1
        }
      ]
    }
  ]
}
```

### Filtros e transição

Efeito CRT e transição para a cena seguinte.

```json
{
  "id": "filtro",
  "start": 26,
  "end": 30,
  "background": {
    "color": "#203854"
  },
  "elements": [
    {
      "id": "crt",
      "type": "filter",
      "style": "crt_tv",
      "start": 26,
      "end": 30,
      "config": {
        "scanlineOpacity": 0.18,
        "vignette": 0.42,
        "flicker": 0.035,
        "jitter": 1.5
      }
    }
  ],
  "transitionOut": "fade",
  "transitionDuration": 0.35
}
```

## Regras práticas e validação

- IDs de cena devem ser exclusivos e estáveis, e camadas visuais exigem ID único dentro da cena.
- Cenas são sequenciais, com fim posterior ao início; keyframes são ordenados e relativos ao começo da cena.
- Assets são obrigatórios para image, video, overlay e sfx. Use project:// ou builtin:// para mídias existentes.
- Narração é obrigatória; depois da importação o Content Lab prepara a voz e cria o transcript.json automaticamente com whisper.cpp, quando instalado.
- Sobreposições de texto podem gerar avisos, sem bloquear composições intencionais.
- Pausas internas de SFX são preservadas; somente silêncio inicial/final é removido antes do disparo em at.
- config aceita opções livres, mas só as consumidas pelo renderer alteram o resultado.

