# Content Lab — referência do edit_plan.json

**Contrato único:** `schemas/edit_plan.schema.json`. O plano **não possui campo de versão**. O mesmo JSON alimenta o editor visual, o validador Node, o compositor Remotion e o cache incremental.

## Estrutura

```json
{
  "project": {
    "name": "Meu vídeo",
    "format": "youtube_long",
    "profile": "generic",
    "resolution": {"width": 1920, "height": 1080},
    "fps": 30,
    "seed": 0
  },
  "sources": {"assets": "assets", "transcript": "transcript.json"},
  "audio": {
    "narration": "audio/narration.wav",
    "voice": {"normalize": true, "targetLufs": -16, "truePeakDb": -1.5},
    "music": []
  },
  "timeline": [{
    "id": "intro",
    "start": 0,
    "end": 5,
    "layout": "3x3",
    "background": {"asset": "project://assets/papel.mp4", "fit": "contain", "loop": true},
    "camera": {"keyframes": []},
    "elements": [{
      "id": "batman", "type": "image", "asset": "project://assets/batman.png",
      "start": 0, "end": 5, "z": 10,
      "cells": [2, 5, 8], "fit": "contain",
      "transform": {"scale": 1.2},
      "animation": {"enter": "pop_in", "idle": "float_soft", "exit": "cut"}
    }],
    "transitionOut": "cut"
  }]
}
```

## Regras gerais

- IDs de cenas são únicos e estáveis: `timeline[].id` é a identidade do clipe no cache persistente. IDs de camadas visuais também devem ser únicos dentro da cena.
- `start` e `end` são segundos absolutos na linha do tempo final. Cenas não se sobrepõem. Camadas podem se sobrepor **dentro** da mesma cena.
- `project.format`: `youtube_long` (1920×1080), `youtube_short` (1080×1920), `custom`. `resolution` e `fps` substituem os padrões; `seed` controla ruído determinístico.
- `sources.transcript` é relativo à pasta do projeto; `sources.assets` nomeia a pasta de mídia (não preenche automaticamente os URIs de cada elemento).
- Arquivos são `project://` (raiz do projeto) ou `builtin://` (biblioteca instalada). O resolver bloqueia `..`, symlinks externos e URI inválida. Não use caminhos absolutos em `asset`.
- `audio.narration` informa um arquivo dentro do projeto. `sourceCuts` lista trechos `{start,end}` da narração original, aplicados antes da mixagem.
- `audio.music[]` aceita `asset`, `start`, `end`, `trimDb`, `fadeIn`, `fadeOut`, `preset`. A voz pode usar `normalize`, `targetLufs`, `truePeakDb`, `highpassHz` e `trimDb`. Também há configuração `ducking`; confirme o comportamento audiovisual final nos testes.
- `timeline[].transitionOut`: `cut`, `fade`, `slide_left`, `blur_left`, `blur_right`, `blur_up` com `transitionDuration`. Transições dependem das cenas adjacentes.

As transições não encurtam cenas: os quadros misturados/deslizados ocupam o **começo da cena seguinte**. Para um whoosh centralizado em `blur_*`, posicione `sfx.at` na cena entrante, em segundos absolutos, aproximadamente em `cena_entrante.start + (duração_visual - duração_audível_do_whoosh)/2`. O mixer remove silêncio nas bordas do SFX antes de posicioná-lo, então meça a duração audível e confirme uma prévia curta com áudio.
- `background` recebe `color` ou `asset`; `fit: contain` preserva conteúdo inteiro, `cover` só quando o recorte for intencional; `loop` repete vídeo curto. Vídeo 16:9 já no formato final não deve ser ampliado implicitamente.
- `elements[]` permite `image`, `video`, `text`, `kinetic_text`, `caption`, `overlay`, `filter` e `sfx`. Áudio de `sfx` usa `at` e `config`.
- Textos: `text`, `style`, `textStyle` (família, cor, contorno e sombra), `fontAsset`, `fontScale`, `reveal` e `emphasis`. `caption` pode consultar `sources.transcript`.
- Mídia: `fit` (`contain`, `cover`, `stretch`, `smart_cover`), `loop`, `muted`, `trimDb`, `fadeIn`, `fadeOut`.
- `transform` inclui `x`, `y`, `scale`, `rotation`, `opacity`; `keyframes` tem `t` em segundos relativos ao começo da cena e `easing` (`linear`, `ease_in`, `ease_out`, `ease_in_out`).
- `animation` tem `enter`, `idle`, `exit`, `enterDuration`, `exitDuration`. `camera.keyframes` usa posição/escala e `camera.shake[]` controla vibração.

## Grid 3×3

Numere as células da esquerda para a direita, de cima para baixo:

```text
1 | 2 | 3
4 | 5 | 6
7 | 8 | 9
```

- `[1,4,7]`: coluna esquerda.
- `[2,5,8]`: coluna central, útil para Batman sozinho.
- `[3,6,9]`: coluna direita.
- `[5]`: centro central do quadro.
- `[1,2,3,4,5,6,7,8,9]`: composição inteira.

`cells` define a região de encaixe e o posicionamento básico; `transform.scale` é um multiplicador. Uma imagem com transparência assimétrica pode aparentar deslocamento mesmo com células centralizadas.

## Fluxo e cache

1. Execute `node server/cli.mjs validate "PASTA_DO_PROJETO"`.
2. Gere usando `npm run render -- "PASTA_DO_PROJETO"` ou o botão **Aproveitar cache**.
3. Os segmentos são salvos individualmente antes da montagem final em `output/final/scenes/`.
4. Para limpar todos os intermediários e começar novamente, use **Refazer tudo** ou `npm run render -- "PASTA_DO_PROJETO" --rebuild`.

Veja `MOTION_DESIGN_JSON.md`, `SCENE_CACHE.md`, exemplos em `examples/` e o schema para todos os campos, tipos e limites permitidos.

## Posicionamento por grid e transparência

`cells: [5,8]` dimensiona a caixa das duas células centrais inferiores. `fit: contain` preserva a proporção do PNG, inclusive margens transparentes; `cover` pode recortar. Use `transform.scale` somente para ajuste adicional e `transform.offsetX`/`offsetY` para deslocamentos em pixels após encaixar no grid (positivo = direita/baixo; negativo = esquerda/cima). `transform.opacity` já controla a transparência entre 0 e 1; `keyframes[].opacity` permite animá-la. `z` maior desenha na frente. Exemplo de elemento:

```json
{"id":"personagem","type":"image","asset":"project://assets/personagem.png","cells":[5,8],"fit":"contain","z":3,"transform":{"scale":1.05,"offsetY":35,"opacity":0.65}}
```

## Cortes e fades de narração e música, com crossfade (FFmpeg)

A narração pode usar **ou** `audio.narrationTrim: {"start":2,"end":30}` (um único intervalo mantido da gravação original) **ou** `audio.sourceCuts: [{"start":2,"end":8},{"start":12,"end":30}]` (vários intervalos mantidos concatenados). Esses campos não podem coexistir. Ambos alteram a duração e o relógio da fala, por isso a transcrição deve ser remapeada e os eventos sincronizados conferidos. `audio.silenceInserts` continua inserindo pausas após os cortes, quando necessário.

`audio.voice.fadeIn` e `fadeOut` aceitam segundos não negativos; o segundo se aplica ao **final audível da fala**, antes da eventual cauda musical do vídeo. `audio.voice.trimDb` continua sendo ganho em decibéis, não um corte temporal.

Para cada música, `audio.music[].start/end` são **segundos absolutos da timeline final**; `sourceStart/sourceEnd` selecionam o **trecho da fonte musical** em segundos a partir do arquivo original. O `loop` opcional (padrão `true`) repete apenas o trecho selecionado até cobrir a duração do clipe. `loop:false` exige que o trecho da fonte seja longo o bastante.

**Crossfade**: a sobreposição é explícita, sem deslocar a narração e sem campo de transição especial. Neste exemplo, os três segundos de 17 até 20 pertencem a ambas as músicas. A primeira diminui enquanto a segunda cresce:

```json
{
  "narration": "audio/narration.wav",
  "narrationTrim": {"start": 2, "end": 30},
  "voice": {"fadeIn": 0.4, "fadeOut": 0.8},
  "music": [
    {"asset":"project://audio/a.wav","start":0,"end":20,"sourceStart":5,"sourceEnd":25,"fadeOut":3},
    {"asset":"project://audio/b.wav","start":17,"end":40,"sourceStart":2,"sourceEnd":30,"fadeIn":3,"fadeOut":2}
  ]
}
```

O JSON acima representa somente o objeto `audio` parcial de um projeto. Os caminhos são ilustrativos; sempre validar os assets reais. O mixer já soma as músicas em paralelo via FFmpeg (`amix`) e a compressão de ducking contra a voz pode reduzir ambos os trechos durante uma narração.

## Trim automático de silêncio nas bordas (narração e música)

O Content Lab aplica por padrão aos arquivos de **narração** e **música** a mesma detecção de silêncio nas bordas utilizada nos SFX (`silencedetect` do FFmpeg, aproximadamente -50 dBFS por 40 ms). Remove somente o silêncio inicial e terminal: **pausas internas, respirações e silêncios musicais no meio do trecho são preservados**. O áudio original nunca é sobrescrito.

- `audio.voice.autoTrimSilence: true` (padrão): detecta os limites audíveis da narração, inclusive depois de `narrationTrim` ou `sourceCuts`. O início real da fala passa a ser o tempo zero do áudio preparado e os timestamps das palavras da transcrição são remapeados para esse mesmo relógio. O `render_report.json` registra os segundos removidos em `narrationAutoTrim.start/end`.
- `audio.music[].autoTrimSilence: true` (padrão): detecta o silêncio das bordas da **seleção musical** (`sourceStart/sourceEnd`, ou faixa completa quando ausentes); o motor elimina essas bordas antes de repetir o trecho com `loop` e antes de aplicar `fadeIn/fadeOut`. Cada camada reporta `autoSilenceTrim.start/end` quando ocorreu trim.
- Especifique `false` em voz ou música quando houver silêncio intencional na introdução/saída que deva continuar audível como intervalo vazio.
- O trim é **automático e não requer preencher `sourceStart`, `sourceEnd`, `narrationTrim` ou `sourceCuts`**: esses campos continuam opcionais para recortes editoriais específicos. `trimDb` é volume em dB e não tem relação com remoção de silêncio.
- Crossfade de duas músicas continua funcionando por sobreposição de `start/end` e combinações `fadeOut/fadeIn`. Silêncio no meio dos arquivos continua intocado.
- A timeline de cenas permanece absoluta; a remoção do silêncio inicial desloca a fala para mais cedo. O renderizador remapeia os tempos das palavras para captions/kinetic text, mas **entradas manuais de cenas e SFX que tenham sido marcadas usando a gravação não limpa precisam ser revisadas** no Preview.

## Fluxo canônico da transcrição: áudio preparado primeiro

No Editor, **Criar projeto → Selecionar narração** já inicia a preparação e a transcrição. O Content Lab copia a narração original para `audio/`, registra seu caminho em `audio.narration` e mantém `sources.transcript: "transcript.json"`. **Não é necessário fornecer transcript.json** no momento de criar o projeto.

O motor faz o trim de silêncio apenas nas bordas e aplica `narrationTrim` ou `sourceCuts` (quando declarados), depois `silenceInserts` na timeline da voz. Salva uma cópia do áudio resultante como `audio/narration.prepared.wav` e usa `whisper-cli -ml 1 -sow` para produzir palavras com timestamps; gera `transcript.json`, `transcript.txt` e `transcript.srt`. Sem `whisper-cli` e modelo local o projeto mantém a importação mas mostra falha de transcrição — nunca inventa tempos.

O sistema registra `transcript.build.json` para identificar qual narração/cortes/pausas geraram o JSON. Ao salvar alterações que afetam o relógio, dispara novo processamento. A transcrição gerada já usa os **tempos da narração preparada**, portanto o render não desloca as palavras uma segunda vez. Correções de ortografia/nome podem alterar `words[].word` e `segments[].text` sem modificar `start/end`. Antes de regenerar, correções humanas divergentes são preservadas em `transcript.manual-backup-*.json`. Consulte o estado no editor e use **Atualizar transcrição** para tentar novamente, se necessário.

**Importante:** timestamps de reconhecimento de fala são estimativas; para legendas críticas inspecione o preview e faça ajustes finos. Pausas/respirações internas são preservadas. Mesmo gerando a transcrição automaticamente, tempos **manuais** de cortes visuais e SFX que se basearam no arquivo de voz original precisam ser conferidos após correções.

## Interpolação suave sem mudar velocidade (Content Lab)

A curva de movimento e a duração são conceitos diferentes. A implementação suaviza `keyframes` de camadas e câmera, `animation.enter/exit`, `word_stack_vertical`, `word_stream_horizontal`, `pan`, zoom e idle sem alterar os segundos declarados no JSON. A curva padrão é **smootherstep C2**, que começa e termina com velocidade e aceleração zero; `easing:"linear"` é respeitado caso seja escolha explícita. `fade`, `slide_left`, `blur_left/right/up` chegam ao fim da transição no último frame, e o blur deixa de aparecer ou sumir abruptamente. `cut` permanece instantâneo.

Exemplo: `animation:{"enter":"slide_up","enterDuration":0.1}` continua com **100 ms**; `{ "config": {"transitionDuration":0.1} }` faz carrossel em **100 ms**. Nunca alongar o tempo automaticamente em nome da fluidez. O limite visual é o FPS: a 30 fps, 0.1s = 3 frames, a 60 fps = 6 frames. Teste `node --test server/motion.test.mjs` valida matematicamente as curvas e `node server/smoke-motion.mjs` renderiza cada transição FFmpeg com 100 ms e verifica 24 frames para duas cenas de 0.4 s.

## Carrossel de palavras e frases: `word_stack_vertical`

Usar um único elemento `kinetic_text` com `style:"word_stack_vertical"`. Para **frases inteiras**, declarar `config.items` com `text/start/end` por frase; não criar três elementos `text` independentes. Para palavras individuais da narração, também é possível seguir o transcript.

A composição possui três faixas na vertical. **A linha central ativa ocupa 100% da largura do vídeo**, não apenas as duas colunas eventualmente selecionadas por `cells`. O `cells` ainda pode posicionar a pilha verticalmente, mas nunca limitar a largura da faixa horizontal. O painel cinza, quando ativado, cobre somente o TERÇO central, em toda a largura do frame; o padrão `panelOpacity:0` deixa o fundo transparente. Evitar um cartão cinza atrás de toda a pilha.

- `config.direction:"down"`: a próxima frase entra por CIMA e cresce até assumir a faixa central; a central anterior encolhe e desce ao terço inferior. `direction:"up"` é alternativa legada explícita.
- `config.align:"left"` é o padrão moderno: todas as três linhas se alinham à esquerda; `center` continua possível mediante configuração explícita.
- Frase atual: maior, opacidade total e centralização vertical. Próxima frase no alto: menor, opacidade reduzida, alinhada à BASE de seu slot. Frase anterior abaixo: menor, opacidade reduzida e alinhada ao TOPO do seu slot.
- `activeScale`, `inactiveScale`, `inactiveOpacity`, `transitionDuration`, `slotGap` e `fontScale` controlam o tamanho/tempo. Frases grandes quebram em linhas dentro de sua faixa; não devem ser cortadas em uma caixa de duas colunas.
- `panelColor`, `panelOpacity` e `panelRadius` controlam opcionalmente o destaque do terço central (ex.: painel cinza com `panelOpacity:0.12` e `panelRadius:0`).

Exemplo pronto: `examples/word-stack.json`, que ocupa duas colunas em `cells:[1,2,4,5,7,8]` **mas renderiza a faixa do carrossel na largura completa do quadro**. O teste `node server/smoke-word-stack.mjs` renderiza frames reais no Remotion e confere a faixa central inteira, opacidade das vizinhas e presença de texto nos três slots.

**Correção do highlight de captions:** `bangers_highlight_block` agora suaviza a troca do background entre palavras, sem alterar o texto nem os timestamps. `config.highlightTransitionDuration:0.1` define 100 ms de crossfade; a passagem fica limitada ao intervalo real da palavra. Fade de cenas foi corrigido para misturar da cena anterior para a próxima, finalizando no último frame da transição.
