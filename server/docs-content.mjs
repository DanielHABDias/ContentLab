// Human explanations and copy/paste examples complement the canonical schema.
export const chapters=[
  {id:'introducao',title:'Visão geral e fluxo de trabalho',diagram:'structure',paragraphs:[
    'Content Lab funciona localmente com servidor Node.js, interface JavaScript, renderização visual Remotion e ferramentas FFmpeg. A IA pode criar um edit_plan.json, que a interface permite validar e ajustar por cena.',
    'O fluxo recomendado é: preparar assets e narração; criar edit_plan.json; abrir a pasta; validar os arquivos; revisar o storyboard; salvar; renderizar com cache; conferir MP4 e áudio.',
    'A referência de campos desta página é derivada do schema instalado. Um campo previsto no JSON não significa automaticamente que todo componente visual use esse campo: essas limitações são mencionadas em cada descrição.'
  ]},
  {id:'arquivos',title:'Organização de arquivos e URIs',diagram:'fitting',paragraphs:[
    'Organize edit_plan.json, audio/narration.wav e assets dentro da pasta do projeto. Caminhos project:// apontam para a raiz do projeto. Arquivos builtin:// vêm da biblioteca instalada.',
    'O atributo sources.assets indica uma pasta, mas não completa os caminhos das camadas: cada asset deve ter seu URI completo e existente. A narração e a transcrição usam caminhos relativos.',
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
    'O motor possui estilos impact, impact_yellow, paper_word, versus_big, word_pop, anton, bangers, word_stack_vertical e word_stream_horizontal, além de estilos de legendas anton_karaoke e bangers_highlight_block.',
    'Campos específicos de config já usados pelo render: maxWords, highlightColors, highlightPaddingX/Y, highlightRadius, transitionDuration, items, inactiveOpacity, slotGap, activeScale, inactiveScale, direction, align, inactiveColor, panelColor, panelOpacity, panelRadius, panelPaddingX/Y, opacity, scanlineOpacity, vignette, flicker e jitter. config aceita outras chaves sintaticamente, mas elas só produzem efeito se o componente as interpretar.',
    'O validador produz avisos para duas camadas de texto sobrepostas em tempo e região; isso não é erro bloqueante, pois composições intencionais são permitidas.'
  ]},
  {id:'som',title:'Áudio, narração, música e SFX',diagram:'audio',paragraphs:[
    'Narração é exigida no fluxo atual. narrationTrim mantém um intervalo start/end da gravação original, enquanto sourceCuts une vários trechos (não usar ambos); silenceInserts cria pausas para sincronizar inserções de cenas. Em voice, fadeIn e fadeOut controlam a entrada e a saída da fala, inclusive antes de uma cauda musical.',
    'O mesmo trim automático dos SFX agora se aplica por padrão às bordas da narração e de cada trecho musical. O FFmpeg usa detecção aproximada de silêncio abaixo de -50 dBFS por pelo menos 40 ms, preserva pausas internas e corrige o relógio das palavras da narração para as legendas. Para respeitar uma abertura silenciosa intencional, use voice.autoTrimSilence: false ou music[].autoTrimSilence: false.',
    'A música tem start/end na timeline e pode escolher um trecho do arquivo usando sourceStart/sourceEnd; o trim automático tira silêncio das bordas do trecho selecionado antes de aplicar loop e fades, e loop repete somente a parte audível quando necessário. Duas músicas podem se cruzar: a primeira termina em 20 s com fadeOut de 3 s; a próxima começa em 17 s com fadeIn de 3 s. A sobreposição de 17 a 20 s produz o crossfade no mixer. Ducking reduz o volume durante a voz. Mudanças só de som não invalidam clipes visuais.'
  ]},
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
    'Transcrição: integração local com whisper.cpp, que gera transcript.json, transcript.srt e transcript.txt quando um modelo compatível está instalado.',
    'Editor automático: abrir/criar projeto, conferir assets, buscar e selecionar cenas, criar, inserir, duplicar e excluir, ajustar tempos, editar camadas, importar transcrição, validar e salvar o JSON, visualizar clipes em cache e exportar o MP4.',
    'Documentação: referência pesquisável de campos e exemplos, disponível no próprio site e como arquivo Markdown ou HTML. A skill ZIP inclui os documentos e diagramas.'
  ]},
  {id:'problemas',title:'Diagnóstico e boas práticas',diagram:'fitting',paragraphs:[
    'Arquivo não encontrado: confira URI, extensão, maiúsculas/minúsculas, symlinks e a pasta do projeto. Propriedade rejeitada: consulte a tabela de campos; objetos do schema geralmente proíbem chaves adicionais.',
    'Áudio dessincronizado: confira sourceCuts, silenceInserts e at dos SFX. Imagem ampliada ou cortada: use contain e remova zoom não intencional. Texto sobreposto: revise start/end, cells, z e os avisos da validação.',
    'Primeiro render após atualizar o motor pode recalcular assinaturas do cache. Não suponha que estilos/presets previstos apenas no schema já criam comportamentos inexistentes.'
  ]}
];
export const exampleCases=[
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
 {title:'Legendas e texto cinético',summary:'Duas modalidades que usam a transcrição temporizada.',
 data:{id:'dialogo',start:15,end:21,layout:'3x3',elements:[
 {id:'palavras',type:'kinetic_text',text:'EU SOU A VINGANÇA',start:15,end:19,
 cells:[2,5,8],style:'word_stream_horizontal',fontScale:0.9,config:{transitionDuration:0.16}},
 {id:'legenda',type:'caption',start:15,end:21,cells:[7,8,9],
 style:'bangers_highlight_block',config:{maxWords:7,highlightColors:['#2563EB','#E53935']}}]}},
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
