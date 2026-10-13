// Human explanations and copy/paste examples complement the canonical schema.
export const projectFolderTree = "meu-video/\n├── edit_plan.json                     plano de edição\n├── audio/\n│   ├── narracao.wav                   arquivo original\n│   ├── musica.mp3                     música opcional\n│   └── narration.prepared.wav         gerado ao preparar a voz\n├── assets/\n│   ├── abertura.mp4\n│   └── personagens/\n│       └── heroi.png                 subpastas permitidas\n├── custom-scenes/\n│   └── MinhaCena.tsx                  componente Remotion local (opcional)\n├── transcript.json                    gerado após preparar a narração\n├── transcript.txt                     texto gerado\n├── transcript.srt                     legendas geradas\n├── transcript.build.json              controle de sincronização\n└── output/                            produzido após render";
export const chapters=[
  {id:'introducao',title:'Visão geral e fluxo de trabalho',diagram:'structure',paragraphs:[
    'Content Lab funciona localmente com servidor Node.js, interface JavaScript, renderização visual Remotion e ferramentas FFmpeg. A IA pode criar um edit_plan.json, que a interface permite validar e ajustar por cena.',
    'Para começar, abra Editor automático → Criar e escolha a pasta do novo vídeo: o Studio cria o edit_plan.json e as pastas audio/ e assets/. Depois use Selecionar narração e gerar transcrição: ele prepara o áudio (cortes e pausas) e gera transcript.json/txt/srt automaticamente, quando o Whisper local está disponível. Adicione assets, monte cenas, valide o JSON, salve, renderize e confira vídeo/áudio.',
    'A referência de campos desta página é derivada do schema instalado. Um campo previsto no JSON não significa automaticamente que todo componente visual use esse campo: essas limitações são mencionadas em cada descrição.'
  ]},
  {id:'arquivos',title:'Organização de arquivos e URIs',diagram:'fitting',paragraphs:[
    'Organize edit_plan.json, audio/narration.wav e assets dentro da pasta do projeto. Caminhos project:// apontam para a raiz do projeto. Arquivos builtin:// vêm da biblioteca instalada.',
    'O atributo sources.assets indica uma pasta, mas não completa os caminhos das camadas: cada asset deve ter seu URI completo e existente. A narração e a transcrição usam caminhos relativos.',
    "Na aba Editor automático, use Criar para começar um vídeo, Selecionar narração e gerar transcrição para importar a fala, Listar para consultar os URIs dos assets e Validar JSON antes de salvar/renderizar. Os tempos de legendas devem acompanhar a narração preparada, não a gravação original.",
    "Use / como separador nos caminhos tanto no Windows quanto no Linux. Nomes, subpastas e extensões precisam corresponder exatamente aos arquivos: no Linux, Narracao.wav não é igual a narracao.wav. Caminhos que saem da pasta do projeto, inclusive por links simbólicos, são bloqueados.",
    "Para criar cenas de motion design, vá à seção Sua linha do tempo no Editor automático, clique em + Nova cena e abra Editar propriedades avançadas (fundo, câmera, elementos, animações). Use background.color para cor, background.asset com URI builtin:// ou project:// para mídia própria e background.loop:true para repetir um fundo de vídeo. Adicione quantas camadas quiser e defina cells livremente no grid 3×3, sem obrigatoriedade de duas imagens ou de uma composição esquerda/direita.",
    "Se o projeto já tem edit_plan.json e mídia organizada, abra essa pasta em vez de criar outra. Os arquivos transcript.json, transcript.txt e transcript.srt normalmente são GERADOS após a narração ser preparada; não é necessário inseri-los antes da criação. A aba Transcrição separada serve para outras fontes de vídeo/áudio.",
    "Para imagens, vídeos, músicas e SFX, use URIs project:// desde a raiz da pasta do projeto (ex.: project://assets/personagens/heroi.png); arquivos incorporados ao aplicativo usam builtin://. O atributo sources.assets nunca preenche automaticamente o caminho dos elementos.",
    'Para gameplay, preserve a proporção. contain mostra todo o quadro e é o padrão visual; cover recorta e stretch estica. Não amplie um clipe 1920×1080 quando a saída também é 1920×1080.'
  ]},
  {id:'grade',title:'Layouts, grade 3×3 e profundidade',diagram:'grid',paragraphs:[
    'Na grade, 1/2/3 ocupam a primeira linha, 4/5/6 a linha central e 7/8/9 a inferior. cells [2,5,8] ocupa a coluna central; cells [5,8] ocupa os dois quadrados centrais inferiores; cells [5] somente o centro. A mídia é encaixada automaticamente na caixa: contain preserva o PNG sem recorte e cover preenche com possível recorte.',
    'As camadas podem usar transform e keyframes para posição, escala, rotação e opacidade. transform.opacity de 0 a 1 controla a transparência; keyframes[].opacity anima esse valor; z maior fica na frente. Use transform.scale somente para ajuste fino após definir cells.',
    'PNG com transparência assimétrica pode parecer deslocado apesar de estar centralizado matematicamente. transform.offsetX/offsetY permitem corrigir a posição em pixels: positivo move para direita/baixo; negativo move para esquerda/cima. Os offsets não modificam a caixa do grid e margens transparentes internas continuam fazendo parte do PNG.'
  ]},
  {id:'camadas',title:'Camadas, animações, textos e efeitos',diagram:'layers',paragraphs:[
    'Tipos disponíveis: image e video para mídia, overlay para sobreposições, text para frase estática, kinetic_text para palavras em movimento, caption para legendas, filter para tratamento visual e sfx para som.',
    'Os presets de entrada, movimento contínuo e saída ficam em animation. Os keyframes usam segundos relativos ao início da cena; já start/end/at usam tempo absoluto.',
    'Suavidade não significa lentidão: o motor usa interpolação contínua de ordem C2 (smootherstep) por padrão em keyframes de elementos e câmera, entradas, saídas e carrosséis. Uma duração de 0.1 segundo continua tendo exatamente 0.1 segundo. animation.enterDuration/exitDuration e config.transitionDuration controlam TEMPO, independentemente da curva. easing:linear continua disponível para movimento intencionalmente linear; ease_in/out aceleram/desaceleram. Não adicionar segundos automaticamente em nome da fluidez.',
    'O pan e slow_zoom_in/out usam início e fim assentados; float_soft, wiggle_soft, pulse_soft e camera.shake têm envelope de amplitude suave para não começar ou encerrar com saltos. No word_stack_vertical a posição, escala, opacidade e cor dos textos mudam continuamente; word_stream_horizontal também elimina a antiga palavra-fantasma ao terminar a passagem. Transições fade, slide_left e blur_left/right/up usam curvas suaves e chegam à posição final no último frame, sem expandir a timeline; o blur só cresce no meio da passagem e recua antes do corte.',
    'Limitação física: uma transição de 0.1 s em 30 fps tem apenas 3 frames; em 60 fps tem 6. O software não inventa quadros nem transforma 0.1 s em 0.4 s: caso queira mais amostras de movimento, aumente project.fps conscientemente. cut continua instantâneo por definição, e texto digitado/reveal continua discreto por caractere; suavizar não deve mudar sua cadência semântica.',
    'Legenda bangers_highlight_block: o fundo colorido da palavra anterior desaparece enquanto o da próxima cresce suavemente, sem mover ou apagar as letras. O tempo padrão é 0.10 segundo e pode ser ajustado via config.highlightTransitionDuration:0.1 (sem mudança dos timestamps nem da duração da fala). Para transições de cena, o fade agora preserva corretamente a direção: cena anterior no início, próxima cena no final, inclusive quando restam somente três frames.',
    'O motor possui estilos impact, impact_yellow, paper_word, versus_big, word_pop, anton, bangers, word_stack_vertical e word_stream_horizontal, além de estilos de legendas anton_karaoke e bangers_highlight_block.',
    'O carrossel word_stack_vertical usa três faixas horizontais: a frase ativa ocupa a linha CENTRAL em toda a largura do vídeo, mesmo que cells indique somente duas colunas. A frase seguinte fica acima, menor, com transparência reduzida e alinhada à borda inferior do slot superior; a anterior fica abaixo, menor, semitransparente e alinhada ao topo do slot inferior. A transição padrão direction:down faz o texto de cima assumir o centro enquanto o centro desce. Todo o texto fica à esquerda por padrão, com quebras de linha automáticas para frases longas.',
    'O painel cinza opcional de word_stack_vertical pertence SOMENTE à faixa horizontal central e cobre a largura integral da tela. panelOpacity:0 (padrão) desativa a faixa; panelColor e panelOpacity permitem destaque sutil, sem card curto nem fundo atrás de toda a pilha. Para frases inteiras, use config.items com text/start/end por item, não elementos text independentes. config.align:center e direction:up continuam disponíveis em projetos antigos, mas a composição editorial padrão é align:left e direction:down.',
    'Campos específicos de config já usados pelo render: maxWords, highlightColors, highlightPaddingX/Y, highlightRadius, transitionDuration, items, inactiveOpacity, slotGap, activeScale, inactiveScale, direction, align, inactiveColor, panelColor, panelOpacity, panelRadius, panelPaddingX/Y, opacity, scanlineOpacity, vignette, flicker e jitter. config aceita outras chaves sintaticamente, mas elas só produzem efeito se o componente as interpretar.',
    'O validador produz avisos para duas camadas de texto sobrepostas em tempo e região; isso não é erro bloqueante, pois composições intencionais são permitidas.'
  ]},
  {id:'som',title:'Áudio, narração, música e SFX',diagram:'audio',paragraphs:[
    'Narração é exigida no fluxo atual, mas a transcrição não precisa ser importada: ela é criada automaticamente depois da preparação do áudio, não antes. O JSON gerado tem timestamps no relógio da narração limpa (inclusive silenceInserts) e não deve ser remapeado novamente no render. narrationTrim mantém um intervalo start/end da gravação original, enquanto sourceCuts une vários trechos (não usar ambos); silenceInserts cria pausas para sincronizar inserções de cenas. Em voice, fadeIn e fadeOut controlam a entrada e a saída da fala, inclusive antes de uma cauda musical.',
    'O mesmo trim automático dos SFX agora se aplica por padrão às bordas da narração e de cada trecho musical. O transcript.json é regenerado quando o áudio importado ou seus recortes/pausas mudarem; corrigir somente texto de palavras não deve alterar os tempos. O FFmpeg usa detecção aproximada de silêncio abaixo de -50 dBFS por pelo menos 40 ms, preserva pausas internas e corrige o relógio das palavras da narração para as legendas. Para respeitar uma abertura silenciosa intencional, use voice.autoTrimSilence: false ou music[].autoTrimSilence: false.',
    'A música tem start/end na timeline e pode escolher um trecho do arquivo usando sourceStart/sourceEnd; o trim automático tira silêncio das bordas do trecho selecionado antes de aplicar loop e fades, e loop repete somente a parte audível quando necessário. Duas músicas podem se cruzar: a primeira termina em 20 s com fadeOut de 3 s; a próxima começa em 17 s com fadeIn de 3 s. A sobreposição de 17 a 20 s produz o crossfade no mixer. Ducking reduz o volume durante a voz. Mudanças só de som não invalidam clipes visuais.'
  ]},
  {
  "id": "cenas-programaveis",
  "title": "Cenas programáveis Remotion (TSX) — do ChatGPT ao vídeo",
  "diagram": "layers",
  "paragraphs": [
    "Quando a composição precisar de uma câmera virtual que percorre um espaço maior, SVGs procedurais, partículas, tipografia coreografada, grades reativas ou outros movimentos complexos, use uma cena programável TSX. Não precisa fragmentar uma animação contínua em dezenas de cenas: uma cena da timeline pode conter a composição React inteira. Para imagens simples, textos e cartões comuns, continue usando os elementos existentes.",
    "Fluxo econômico de tokens: descreva o objetivo e os tempos e peça ao ChatGPT um ÚNICO arquivo .tsx completo, export default, pronto para o Remotion do Content Lab. Solicite alterações futuras como patches ao mesmo arquivo, preservando os nomes e a estrutura, em vez de reescrever o código todo. Peça também apenas o fragmento JSON da cena, não o plano completo quando já existir.",
    "Baixe ou salve o arquivo TSX gerado pelo ChatGPT em seu computador e coloque-o dentro da pasta do projeto: custom-scenes/MinhaCena.tsx. A interface atual não baixa nem instala automaticamente o código produzido no chat; essa cópia é manual. Use project://custom-scenes/MinhaCena.tsx em timeline[].customComponent.module. A geração e o download do arquivo dependem das ferramentas que estiverem disponíveis no ChatGPT.",
    "No edit_plan.json existente, use customComponent: {module: 'project://custom-scenes/MinhaCena.tsx', mode: 'replace', props: {...}, assets: {...}}. mode replace entrega toda a composição visual ao componente; mode overlay desenha o TSX sobre as camadas tradicionais. O JSX deve ter export default. Não cole código TSX dentro do JSON: o contrato só contém referência, parâmetros e URIs de assets.",
    "Em props, forneça valores JSON reutilizáveis como títulos, cores e dados, sem repetir a estrutura de cada elemento. Em assets, dê nomes a URIs locais como project://assets/logo.svg, project://assets/mascote.png ou builtin://...; o componente recebe os URLs pelo objeto assets. Retículas, curvas, linhas, diagramas e cards normalmente devem ser desenhados com React/SVG/CSS por código, sem downloads desnecessários. Não suponha que arquivos citados existem antes de conferir.",
    "No TSX, importações suportadas são React, Remotion e módulos locais de custom-scenes, respeitadas as dependências realmente instaladas. Use useCurrentFrame e useVideoConfig para calcular qualquer quadro por tempo; use SVG, interpolate, spring e cálculos determinísticos conforme a necessidade. Não use setInterval, relógio real, CSS animations/transitions, URLs externas não verificadas nem aleatoriedade sem semente, pois os quadros devem renderizar corretamente em qualquer ordem.",
    "Por segurança, código TSX é código executável e só deve vir de projeto local inspecionado. Para habilitar, inicie o processo com CONTENTLAB_TRUST_CUSTOM_TSX=1 (Linux: export CONTENTLAB_TRUST_CUSTOM_TSX=1; PowerShell: $env:CONTENTLAB_TRUST_CUSTOM_TSX='1'). A opção não deve ser ligada para projetos ou código de terceiros não confiáveis. O Content Lab não executa esse TSX a partir do texto do JSON nem oferece sandbox completo.",
    "Depois de copiar TSX e atualizar o JSON, clique Validar JSON, salve, renderize e confira o MP4. A validação do JSON não comprova que o TSX compilou: importações, fonte, layout, clipping e comportamento de frames exigem render. O cache da cena identifica mudanças nos arquivos da pasta custom-scenes; mantenha IDs estáveis e repita a inspeção de quadros após modificar o TSX.",
    "Exemplo de código e plano de edição versionados no repositório: examples/custom-scenes/FollowDot.tsx e examples/programmatic-motion-edit-plan.json. O exemplo mostra câmera e geometria contínua em uma cena de 17,7 s; não é cópia pixel a pixel do vídeo de referência. Para reproduzir a cena no próprio projeto, copie o TSX, prepare uma narração válida e adapte seu JSON, duração e resolução."
  ]
},
  {id:'timeline',title:'Cenas, tempo e transições',diagram:'timeline',paragraphs:[
    'A lista timeline é ordenada pelo start absoluto. Cada cena possui ID estável; cenas não se sobrepõem. A duração real resulta da diferença entre end e start.',
    'Transições disponíveis: cut, fade, blur_left, blur_right, blur_up e slide_left. O compositor utiliza frames em movimento da cena entrante sem ampliar o tempo total do vídeo.',
    'O cache mantém MP4s individuais por ID. A montagem e o áudio final continuam sendo etapas necessárias mesmo quando todas as cenas visuais são reaproveitadas.'
  ]},
  {id:'insercao',title:'Inserção de tempo e sincronização',diagram:'ripple',paragraphs:[
    'Ao inserir ou duplicar uma cena, o storyboard desloca as cenas seguintes, seus efeitos sonoros, a trilha global e as palavras da transcrição. Uma pausa correspondente é registrada na narração.',
    'Mover manualmente somente uma cena é uma decisão visual: isso não insere silêncio automaticamente na voz. Use Desfazer e Refazer para recuperar alterações do storyboard.',
    'Se a cena nova também precisar de fala nova, atualize a gravação e seus dados de transcrição; o silenceInsert serve como espaço reservado de voz.'
  ]},
  {id:'cache',title:'Cache, prévias de cena e exportação',diagram:'transitions',paragraphs:[
    'Aproveitar cache compara os dados visuais relevantes, assets e a identidade do renderer para detectar cenas que exigem novo MP4. Refazer tudo limpa output/ com confirmação e reconstrói os clipes.',
    'O storyboard permite reproduzir o vídeo individual já renderizado. Quando o JSON é alterado, a interface distingue o clipe anterior do resultado novo. A reprodução por cena não codifica um Preview completo.',
    'Os clipes individuais não incluem obrigatoriamente toda a mixagem. Conferir o vídeo final ainda é importante para validar narração, música, efeitos e transições.'
  ]},
  {id:'interface',title:'O que a interface oferece',diagram:'structure',paragraphs:[
    'Vídeos e cortes: carregamento de fonte YouTube, importação local, lista de arquivos em cache, marcação e exportação de trechos de vídeo e áudio.',
    'Transcrição: ao escolher a narração no projeto, o Content Lab executa primeiro auto-trim e cortes explícitos, insere os silêncios planejados, salva audio/narration.prepared.wav e só então usa whisper.cpp para gerar transcript.json, transcript.txt e transcript.srt. Não é necessário enviar uma transcrição. Uma alteração posterior nos cortes/pausas dispara nova transcrição e preserva cópias de correções manuais quando necessário. Os inicializadores instalam automaticamente whisper-cli e o modelo base quando ausentes.',
    'Instalação automática: no Linux, execute bash run.sh ou use o atalho criado por instalar-atalho.sh; no Windows, abra iniciar.vbs ou iniciar.bat. Os inicializadores verificam Node.js 22+, FFmpeg/FFprobe, whisper.cpp, modelo Whisper e dependências npm/Remotion e Chrome Headless Shell para renderizar, baixando apenas o que estiver ausente. Binários locais ficam na pasta .tools ignorada pelo Git; no Zorin/Ubuntu o compilador para whisper.cpp pode exigir sudo. O Studio não precisa alterar a instalação global de Node. O download inicial requer internet; as aberturas posteriores reaproveitam o material instalado.',
    'Editor automático: abrir/criar projeto, conferir assets, buscar e selecionar cenas, criar, inserir, duplicar e excluir, ajustar tempos, editar camadas, importar transcrição, validar e salvar o JSON, visualizar clipes em cache e exportar o MP4.',
    'Na seção Sua linha do tempo, + Nova cena cria uma cena editável; + Adicionar camada inclui imagem, vídeo, texto, legenda, overlay ou efeito sonoro; e Propriedades avançadas contém background, grid/cells, câmera, animações, transformações e keyframes. Não há um formulário paralelo limitado a esquerda/direita: toda a composição usa o mesmo editor visual e um único edit_plan.json.',
    'Documentação: referência pesquisável de campos e exemplos, disponível no próprio site e como arquivo Markdown ou HTML. A skill ZIP inclui os documentos e diagramas.'
  ]},
  {id:'problemas',title:'Diagnóstico e boas práticas',diagram:'fitting',paragraphs:[
    'Arquivo não encontrado: confira URI, extensão, maiúsculas/minúsculas, symlinks e a pasta do projeto. Propriedade rejeitada: consulte a tabela de campos; objetos do schema geralmente proíbem chaves adicionais.',
    'Áudio dessincronizado: confira sourceCuts, silenceInserts e at dos SFX. Imagem ampliada ou cortada: use contain e remova zoom não intencional. Texto sobreposto: revise start/end, cells, z e os avisos da validação.',
    'Primeiro render após atualizar o motor pode recalcular assinaturas do cache. Não suponha que estilos/presets previstos apenas no schema já criam comportamentos inexistentes.'
  ]}
];
export const exampleCases=[
 {
  "title": "Cena programável TSX (câmera, SVG e movimento)",
  "summary": "Copie examples/custom-scenes/FollowDot.tsx para custom-scenes/FollowDot.tsx na pasta do projeto, confirme narração existente e habilite CONTENTLAB_TRUST_CUSTOM_TSX=1 somente para código local confiável. É uma única cena contínua; sem importar JavaScript no JSON.",
  "data": {
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
},
 {title:'Projeto completo com pastas e URIs',summary:'Exemplo ilustrativo: crie/importa narração no Editor, respeite os nomes reais dos arquivos e valide o JSON. transcript.json é gerado automaticamente após preparar a voz.',
 data:{
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
}},

 {title:'Plano completo mínimo',summary:'Narração obrigatória e uma cena de texto.',
 data:{project:{name:'Introdução',format:'youtube_long',profile:'generic'},sources:{assets:'assets'},
 audio:{narration:'audio/narration.wav'},timeline:[{id:'intro',start:0,end:4,layout:'fullscreen',
 background:{color:'#152238'},elements:[{id:'titulo',type:'text',text:'MEU PRIMEIRO VÍDEO',style:'impact',start:0,end:4}]}]}},
 {title:'Personagem centralizado',summary:'PNG em coluna central, com animação e proporção preservada.',
 data:{id:'personagem',start:4,end:9,layout:'3x3',background:{color:'#10151F'},
 elements:[{id:'heroi',type:'image',asset:'project://assets/heroi.png',start:4,end:9,
 cells:[2,5,8],fit:'contain',transform:{scale:1.25},
 animation:{enter:'pop_in',idle:'float_soft',exit:'cut'}}]}},
 {title:'Gameplay sem recorte',summary:'Vídeo 16:9 mantido inteiro em fullscreen.',
 data:{id:'arkham',start:9,end:15,layout:'fullscreen',
 background:{asset:'project://assets/arkham.mp4',fit:'contain',loop:true},
 elements:[{id:'subtitulo',type:'text',text:'ARKHAM KNIGHT',start:10,end:14,cells:[7,8,9],style:'impact_yellow'}]}},
 {title:'Narração, ducking e efeito sonoro',summary:'Áudio global e SFX disparado pelo início audível.',
 data:{audio:{narration:'audio/narration.wav',sourceCuts:[{start:0,end:12}],
 silenceInserts:[{at:5,duration:2}],voice:{normalize:true,targetLufs:-16,truePeakDb:-1.5},
 ducking:{enabled:true,threshold:0.02,ratio:6,attackMs:40,releaseMs:350},
 music:[{asset:'project://audio/trilha.wav',start:0,end:14,preset:'subtle',fadeIn:1,fadeOut:1}]},
 scene:{id:'impacto',start:5,end:7,elements:[
 {type:'sfx',asset:'project://audio/impacto.wav',at:5.2,preset:'normal',config:{duration:1.5}}]}}},
 {title:'Trim e crossfade de duas músicas',summary:'Recortar trechos da fonte e sobrepor fades em segundos absolutos. Narração com corte simples e fades próprios.',
 data:{audio:{narration:'audio/narration.wav',narrationTrim:{start:2,end:30},
 voice:{normalize:true,fadeIn:0.4,fadeOut:0.8},
 music:[{asset:'project://audio/trilha-a.wav',start:0,end:20,sourceStart:12,sourceEnd:32,autoTrimSilence:true,fadeOut:3},
 {asset:'project://audio/trilha-b.wav',start:17,end:40,sourceStart:5,sourceEnd:45,fadeIn:3,fadeOut:2}]}}},
 {title:'Carrossel vertical de frases em largura total',summary:'Três faixas: próxima menor acima, ativa maior no centro, anterior menor abaixo. Painel do centro percorre a largura inteira mesmo com cells em duas colunas.',
 data:{id:'pilha',type:'kinetic_text',style:'word_stack_vertical',cells:[1,2,4,5,7,8],start:0,end:4,
 fontScale:0.95,textStyle:{fontFamily:'Anton',uppercase:true,color:'#FFFFFF',outlineWidth:0},
 config:{items:[{text:'BATMAN NÃO É JUIZ',start:0,end:1.3},{text:'BATMAN NÃO É JÚRI',start:1.3,end:2.6},
 {text:'BATMAN NÃO É O CARRASCO',start:2.6,end:4}],direction:'down',align:'left',inactiveOpacity:0.38,
 activeScale:1.45,inactiveScale:0.72,panelColor:'#D9D9D9',panelOpacity:0.12,panelRadius:0,transitionDuration:0.18}}},
 {title:'Legendas e texto cinético',summary:'Duas modalidades que usam a transcrição temporizada.',
 data:{id:'dialogo',start:15,end:21,layout:'3x3',elements:[
 {id:'palavras',type:'kinetic_text',text:'EU SOU A VINGANÇA',start:15,end:19,
 cells:[2,5,8],style:'word_stream_horizontal',fontScale:0.9,config:{transitionDuration:0.16}},
 {id:'legenda',type:'caption',start:15,end:21,cells:[7,8,9],
 style:'bangers_highlight_block',config:{maxWords:7,highlightColors:['#2563EB','#E53935']}}]}},
 {title:'Movimento suave em 0,1 segundo',summary:'Curva suave independente do tempo declarado: 0.1 s continua 0.1 s; sem aumentar a animação.',
 data:{id:'micro-motion',start:0,end:2,layout:'3x3',background:{color:'#111111'},camera:{keyframes:[{t:0,x:0.48,y:0.5,scale:1},{t:0.1,x:0.5,y:0.5,scale:1.02,easing:'ease_in_out'}]},elements:[
 {id:'titulo',type:'text',text:'SUAVE E RÁPIDO',start:0,end:2,cells:[4,5,6],style:'anton',animation:{enter:'slide_up',enterDuration:0.1},keyframes:[{t:0,opacity:0},{t:0.1,opacity:1}]}]}},
 {title:'Animação e câmera',summary:'Keyframes com tempos relativos ao início da cena.',
 data:{id:'close',start:21,end:26,layout:'fullscreen',
 camera:{keyframes:[{t:0,x:0.5,y:0.5,scale:1},{t:4.7,x:0.5,y:0.5,scale:1.1,easing:'ease_in_out'}]},
 elements:[{id:'avatar',type:'image',asset:'project://assets/avatar.png',start:21,end:26,
 cells:[2,5,8],keyframes:[{t:0,scale:1,opacity:0},{t:0.5,scale:1.2,opacity:1}]}]}},
 {title:'Filtros e transição',summary:'Efeito CRT e transição para a cena seguinte.',
 data:{id:'filtro',start:26,end:30,background:{color:'#203854'},
 elements:[{id:'crt',type:'filter',style:'crt_tv',start:26,end:30,
 config:{scanlineOpacity:0.18,vignette:0.42,flicker:0.035,jitter:1.5}}],
 transitionOut:'fade',transitionDuration:0.35}}
];
