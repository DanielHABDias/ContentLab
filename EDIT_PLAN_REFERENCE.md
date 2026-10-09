# Editor automático — funções e referência do JSON

> Este documento detalha o JSON `0.1` e as regras compartilhadas. Para motion design `0.2`, use a [referência completa de motion design](MOTION_DESIGN_JSON.md), o [schema `0.2`](schemas/contentlab.schema.v0.2.json), o [exemplo de grid](examples/motion-grid-v0.2.json) e o [storyboard completo](examples/motion-storyboard-v0.2.json). Ambos os contratos são renderizáveis; a versão é escolhida no topo de cada arquivo.

## Escolha da versão

- `0.1`: editor tradicional, contrato detalhado abaixo.
- `0.2`: composição contínua com fundo, grid 3×3, camadas, câmera e keyframes;
  use [MOTION_DESIGN_JSON.md](MOTION_DESIGN_JSON.md) para todos os parâmetros,
  presets, unidades, limites e exemplos. O `0.2` também aceita vídeo, overlay,
  texto cinético e caption com as diferenças descritas naquela referência.
  As cenas visuais são renderizadas em TypeScript pelo Remotion; cenas com
  chroma key seguem no renderizador Python. O contrato JSON é o mesmo.

Não misture versões de cena dentro de um mesmo `edit_plan.json`.

Este guia descreve o que a versão atual do Content Lab executa. A fonte formal
do contrato é [`schemas/contentlab.schema.v0.1.json`](schemas/contentlab.schema.v0.1.json);
o parser, o compilador de timeline e o renderer também aplicam validações e
comportamentos descritos abaixo. Campos desconhecidos são rejeitados em todos
os objetos tipados do schema, exceto `config`, que é um objeto livre.

## Fluxo e funções disponíveis

1. Na aba **Transcrição**, escolha uma pasta existente (pode estar vazia) e o
   arquivo da narração. Não é necessário ter `edit_plan.json` nesta etapa.
   A aba copia o áudio para `audio/` e produz `transcript.json` (tempos por
   palavra), `transcript.txt` (tempos por palavra ou por trecho) e
   `transcript.srt` na pasta escolhida.
2. Use `skillContentLabEdicao.zip` para orientar o GPT na criação do plano:
   forneça roteiro, narração ou transcrição, nomes dos assets e preferências de
   edição. A saída é o conteúdo de `edit_plan.json`, não um vídeo pronto.
3. Salve o JSON gerado como `edit_plan.json` nessa pasta e abra-a na área
   **Editor automático**. Acrescente os assets, liste-os, valide e gere o render final. O painel
   mostra cenas, assets, plugins, progresso, avisos e relatório; permite
   cancelar um render em andamento.
4. Gere o render final. O CLI também oferece `validate`, `plugins` e `render`.
   O render final mantém resolução e FPS do plano. O modo `rough` gera `rough_cut.mp4`.

O renderer compõe imagens e vídeos, texto fixo e cinético, legenda karaoke,
layouts, cards, animações, transições, chroma key, narração, música e SFX.
Prepara a narração com cortes, high-pass e normalização; faz ducking da música
pela voz, limiter e mixagem AAC. Cache de render e NVENC opcional aceleram
reexecuções quando disponíveis. FFprobe verifica a duração dos streams antes
de publicar o MP4. O render final e rough cut têm relatórios próprios.

## Estrutura mínima

```json
{
  "version": "0.1",
  "project": {"name": "video-01", "format": "youtube_long", "profile": "generic"},
  "sources": {"assets": "assets", "transcript": "transcript.json"},
  "audio": {"narration": "audio/narration.wav"},
  "timeline": [
    {"id": "intro", "start": 0, "end": 5, "layout": "fullscreen",
     "elements": [
       {"type": "image", "asset": "project://assets/intro.png", "fit": "cover"},
       {"type": "text", "text": "ABERTURA", "style": "impact", "start": 1, "end": 4}
     ], "transitionOut": "cut"}
  ]
}
```

`version`, `project`, `audio` e `timeline` são obrigatórios. O projeto deve
conter o arquivo de narração. `timeline` pode estar vazia estruturalmente,
mas um vídeo útil exige cenas. Tempos são números em segundos, na timeline
**após** `audio.sourceCuts`; o fim da última cena define a duração renderizada.
Cada cena deve terminar depois de começar, IDs não podem se repetir e cenas
não podem se sobrepor. Intervalos podem ter lacunas.

## Parâmetros do nível superior

| Campo | Valores / efeito |
| --- | --- |
| `version` | Obrigatório; exatamente `"0.1"`. |
| `project.name` | Obrigatório; texto não vazio. |
| `project.format` | Obrigatório: `youtube_long` (1920×1080), `youtube_short` (1080×1920) ou `custom` (1920×1080), salvo resolução explícita. |
| `project.profile` | Obrigatório; texto não vazio. Atualmente metadado; `generic` é o perfil usado nos exemplos. |
| `project.resolution` | Opcional; `{ "width": inteiro positivo, "height": inteiro positivo }`. Ambos são obrigatórios se o objeto for usado. |
| `project.fps` | Número maior que zero; padrão 30. |
| `project.seed` | Inteiro; padrão 0. Reservado, sem efeito visual nesta versão. |
| `sources.assets` | Texto opcional de referência da pasta de assets; não muda a resolução dos URIs. |
| `sources.transcript` | Caminho de arquivo JSON relativo à raiz do projeto; usado para palavra cinética e legenda. |
| `sources.assetCatalog` | Texto opcional reservado; não alimenta o renderer nesta versão. |
| `audio` | Objeto obrigatório; detalhes na seção seguinte. |
| `timeline` | Array de cenas, inclusive vazio no schema. |

### Endereçamento de arquivos e transcrição

Assets visuais, música e SFX usam `project://caminho/arquivo` (dentro da pasta
do projeto) ou `builtin://caminho/arquivo` (dentro de `builtin-assets/`).
Caminhos que escapem dessas raízes são rejeitados. Narração e transcrição são
caminhos de arquivo relativos ao projeto; a narração também aceita caminho
absoluto **somente dentro** da raiz do projeto. Use `/` nos URIs mesmo no
Windows. O arquivo de transcrição é JSON com `words` ou `segments`; cada
palavra pode ter `word` ou `text`, `start` e `end`. Segmentos apenas com texto
recebem tempos distribuídos uniformemente entre início e fim.

## Áudio

| Campo | Valores / efeito |
| --- | --- |
| `audio.narration` | Obrigatório, texto não vazio; caminho do áudio da voz. WAV, MP3, M4A, AAC, FLAC, OGG e Opus são aceitos pelo importador da UI (o FFmpeg precisa decodificar o arquivo). |
| `audio.sourceCuts` | Array opcional de `{start,end}`: trechos **mantidos** da narração original. `start >= 0`, `end > start`, ordem crescente e sem sobreposição. A transcrição é remapeada para o áudio concatenado. |
| `audio.voice.preset` | Texto opcional reservado; não altera os filtros nesta versão. |
| `audio.voice.trimDb` | Número de ganho em dB aplicado à voz no mix; padrão 0. |
| `audio.voice.normalize` | Booleano; padrão `true`. |
| `audio.voice.targetLufs` | Número de −30 a −5; padrão −16 se normalizado. |
| `audio.voice.truePeakDb` | Número de −9 a 0; padrão −1.5 se normalizado. |
| `audio.voice.highpassHz` | Número de 0 a 300; padrão 70; zero desliga o high-pass. |
| `audio.ducking.enabled` | Booleano; padrão `true` quando há música. |
| `audio.ducking.threshold` | Número maior que 0 e até 1; padrão 0.02. |
| `audio.ducking.ratio` | Número de 1 a 20; padrão 6. |
| `audio.ducking.attackMs` | Número de 0.1 a 2000; padrão 40. |
| `audio.ducking.releaseMs` | Número de 1 a 9000; padrão 350. |
| `audio.music[]` | Cada item exige `asset`, `start >= 0` e `end > start`; aceita `preset`, `trimDb`, `fadeIn`, `fadeOut`. Os fades são não negativos e sua soma não pode exceder a duração do item. |

Presets de música: `subtle` (−22 dB), `normal` (−18 dB), `present` (−12
dB) e `music_only` (−6 dB). `trimDb`, quando informado, substitui o ganho do
preset. Um nome de preset desconhecido cai em `normal`. Música é repetida
se necessário para preencher seu intervalo. O mix aplica limiter.

## Cenas, layouts e transições

| Campo da cena | Valores / efeito |
| --- | --- |
| `id`, `start`, `end`, `elements` | Obrigatórios; `id` é texto não vazio, `start >= 0`, `end > start`, `elements` é array. |
| `layout` | `fullscreen` (padrão), `left_right`, `three_columns`, `character_vs`, `nox`, `custom_grid`, `3x3`; ou objeto `{ "grid": "3x3", "preset": "nome" }`. O `preset`, quando presente, prevalece e deve ser um layout registrado. |
| `background.color` | Cor FFmpeg, por exemplo `"#10131B"`; padrão preto. |
| `background.asset` | URI de imagem/vídeo para fundo; `background.fit` aceita `cover`, `contain`, `stretch`; `background.loop` é booleano. Fundo em vídeo aceita `muted`, `preset`, `trimDb`, `fadeIn` e `fadeOut` com a mesma semântica de mídia; áudio só entra com `muted: false`. |
| `transitionOut` | `cut` (padrão), `fade`, `slide_left`, `blur_left`, `blur_right`, `blur_up`; aplicada para a cena seguinte contígua. `slide_left` é o deslizamento horizontal puro. As variantes `blur_*` combinam deslocamento da cena inteira com blur. |

`three_columns` distribui os três primeiros elementos visuais em colunas;
`left_right` e `character_vs`, nos lados; `nox`, na coluna central. `fullscreen`,
`custom_grid` e `3x3` ocupam a tela inteira por padrão, salvo `cells` em cada
elemento. `cells` usa posições 1–9 em uma grade 3×3, da esquerda para a
direita e de cima para baixo; as células escolhidas devem formar um retângulo
contínuo. Mais elementos do que regiões automáticas retornam à tela inteira.

## Elementos de `timeline[].elements[]`

Tipos aceitos: `video`, `image`, `text`, `kinetic_text`, `caption`, `overlay`,
`filter` e `sfx`. Todos exigem `type`. `filter` é exclusivo do `0.2`.
Campos comuns possíveis:

| Campo | Valores / efeito |
| --- | --- |
| `asset` | URI do arquivo. Necessário para imagens, vídeos, overlays e SFX; `overlay`/`sfx` são verificados já na validação semântica. |
| `text` | Texto exibido por `text` ou dividido em palavras por `kinetic_text`. |
| `style` | Nome do estilo registrado para texto, legenda ou overlay. |
| `textStyle` | No JSON 0.2, aparência opcional de `text`, `kinetic_text` ou `caption`: `fontFamily`, `uppercase`, `color`, `outlineColor`, `outlineWidth`, `shadow`. |
| `reveal` | No JSON 0.2 e com `type: "text"`, `{ "charactersPerSecond": 8, "delay": 0 }` faz o texto aparecer caractere por caractere; espaços também consomem a cadência. O renderer quebra linhas apenas entre palavras e reduz a fonte quando uma palavra inteira não cabe. |
| `start`, `end` | Segundos opcionais; por padrão abrangem a cena. `end` deve ser maior que `start` quando ambos aparecem. Prefira limites dentro da cena. |
| `at` | Segundo do disparo do `sfx`; se omitido, usa `start` ou início da cena. |
| `cells` | Array não vazio de inteiros únicos de 1 a 9; região retangular da grade. Aplicado a imagem/vídeo e aos demais elementos pela região calculada. |
| `fit` | `cover` (padrão), `contain`, `stretch`, `smart_cover`; este último é aceito, mas usa o mesmo comportamento de `cover` nesta versão. |
| `box` | Nome de preset ou objeto `{preset,padding,radius,shadow,background,border}`. Detalhes abaixo. |
| `animation` | Objeto com `enter`, `idle`, `exit`; presets abaixo. No `0.2`, `center_reveal` abre a camada do centro para as bordas e `center_close` fecha das bordas para o centro. |
| `z` | Inteiro de ordenação das camadas; padrão é o índice do elemento. |
| `loop` | Booleano; repete vídeo/overlay quando necessário. Para mídia com áudio habilitado, repete também a faixa de áudio. |
| `muted` | Em `video`/`overlay`, `false` inclui o áudio embutido no mix; `true` silencia. Quando omitido, mantém o comportamento legado silencioso. |
| `preset` | Com áudio de `video`/`overlay`: `subtle` (−12 dB), `normal` (−6 dB) ou `strong` (0 dB). |
| `trimDb` | Ganho em dB do áudio embutido de `video`/`overlay`; substitui o ganho do `preset`. |
| `fadeIn`, `fadeOut` | Fades do áudio embutido em segundos; não podem somar mais que a duração do elemento. |
| `sync` | Texto opcional; em `kinetic_text`, `"transcript"` procura as palavras na transcrição; sem coincidência, distribui no intervalo. |
| `emphasis` | Array de palavras; em `kinetic_text`, colore as palavras correspondentes. |
| `range` | `{start,end}`; em `caption`, restringe o intervalo da legenda. |
| `config` | Objeto livre; parâmetros implementados para `overlay` e `sfx` abaixo. |

### Comportamento por tipo

| Tipo | Função e particularidades |
| --- | --- |
| `video` | Exibe vídeo do asset, como base ou camada, com `fit`, `cells`, `loop`, `box` e `animation`. O áudio embutido entra no mix somente com `muted: false`; ganho e fades usam `preset`/`trimDb`/`fadeIn`/`fadeOut`. |
| `image` | Exibe imagem fixa com as mesmas opções visuais. |
| `text` | Texto fixo no centro da região; estilo padrão `impact`. |
| `kinetic_text` | Por padrão exibe uma palavra por vez. No `0.2`, `style: "word_stack_vertical"` mantém anterior/ativa/próxima em uma pilha vertical e anima a troca usando os timestamps das palavras. |
| `caption` | Legenda gerada das palavras de `sources.transcript`. `anton_karaoke` mantém o comportamento simples; `bangers_highlight_block` mantém um chunk inteiro e destaca a palavra ativa. |
| `overlay` | Camada visual com chroma key; estilos aceitos `green_screen`, `green_screen_default`, `green_screen_soft` (a cor e sensibilidade efetivas vêm de `config`). Vídeos de overlay também podem preservar o áudio embutido com `muted: false`. |
| `filter` | Camada procedural do `0.2`, sem asset obrigatório. `style: "dim"` cria escurecimento preto translúcido; `style: "crt_tv"` cria scanlines, vinheta e oscilação/flicker leves. Posicione por `z`: o que estiver abaixo recebe visualmente o efeito e camadas acima permanecem limpas. |
| `sfx` | Áudio disparado por `at`, sem camada visual; duração padrão de até 10 segundos, limitada pelo fim da timeline. |

Estilos de texto aceitos: `impact`, `impact_yellow`, `word_pop`, `paper_word`,
`versus_big`, `anton`, `bangers` e `word_stack_vertical`. Anton e Bangers estão embutidas no
aplicativo. Em `0.2`, `textStyle` permite substituir a aparência do preset:
`fontFamily` é `Anton` ou `Bangers`; `uppercase` é booleano; `color` e
`outlineColor` usam `#RRGGBB`; `outlineWidth` vai de 0 a 40 px;
`shadow` é opcional com `color` (`#RRGGBB`), `blur` (0–100 px), `offsetX` e
`offsetY` (−100 a 100 px). `fontAsset` permite uma fonte própria e prevalece
sobre `fontFamily`. `fontScale` controla o tamanho relativo. Exemplo:

```json
{"id":"titulo","type":"text","text":"O QUE ACONTECEU?","style":"anton","start":0,"end":4,"reveal":{"charactersPerSecond":8},"textStyle":{"uppercase":true,"color":"#FFFFFF","outlineWidth":0}}
```

Para Bangers com sombra e contorno: `"style":"bangers"` e
`"textStyle":{"fontFamily":"Bangers","outlineColor":"#000000","outlineWidth":6,"shadow":{"color":"#000000","blur":8,"offsetX":3,"offsetY":4}}`.
Estilos de overlay são nomes registrados, mas
nesta versão não alteram os parâmetros de chroma por si só.

### Caption `bangers_highlight_block`

No `0.2`, `caption` também aceita `style: "bangers_highlight_block"`.
Esse estilo mantém a frase/chunk inteira visível e destaca somente a palavra
ativa com um retângulo de cantos arredondados. Usa Bangers, texto branco,
contorno preto e timestamps por palavra. O `config` aceita
`highlightColors` (1–8 cores `#RRGGBB`), `maxWords` (2–12),
`highlightRadius`, `highlightPaddingX` e `highlightPaddingY`.
Sem configuração, usa azul, vermelho e preto e até 7 palavras por chunk.
O estilo `anton_karaoke` existente continua disponível e não foi alterado.

### Texto longo, quebra por palavras e reveal central

Em cenas `0.2`, texto fixo/revelado usa quebra de linha **entre palavras**.
O renderer não hifeniza nem parte uma palavra para completar a linha. Se uma
palavra inteira exceder a largura disponível, a fonte é reduzida até caber.
Frases longas podem ocupar várias linhas dentro da região.

`reveal.charactersPerSecond` continua sendo caractere por caractere, incluindo
espaços. Isso permite sincronizar um SFX real de digitação/escrita em uma camada
separada sem transformar o espaço em um glyph visível.

Motions adicionais:

- `animation.enter: "center_reveal"`: revela a camada do centro para as bordas
  com borda suavizada;
- `animation.exit: "center_close"`: fecha a camada das bordas para o centro.

Esses motions são genéricos e podem ser usados em texto ou outras camadas
visuais do `0.2`.

Para uma frase espalhada por uma composição 3×3 com câmera, divida o texto em
elementos por célula **somente em fronteiras de palavra** e sincronize
`camera.keyframes` com o começo de cada fragmento. A câmera pode percorrer
1→2→3→4→5 etc.; se um fragmento não couber em sua célula, reduza
`fontScale` ou mova a palavra completa para a próxima célula.
### `kinetic_text` com `word_stack_vertical`

O estilo genérico `word_stack_vertical` é exclusivo do `0.2`. Ele usa até
três posições visuais ao mesmo tempo: palavra anterior abaixo, palavra ativa
no centro e próxima palavra acima. A palavra central usa opacidade total; as
laterais ficam atenuadas. Na troca, as palavras deslizam verticalmente em
sincronia com os timestamps de `phraseWords`/transcrição.

Defaults: Anton, caixa alta, `inactiveOpacity: 0.32`,
`transitionDuration: 0.18` s e `slotGap: 0.24` da altura da região.
`textStyle` continua podendo trocar fonte, cor, contorno e sombra.

Exemplo:

```json
{
  "id": "lista",
  "type": "kinetic_text",
  "style": "word_stack_vertical",
  "text": "PRIMEIRA SEGUNDA TERCEIRA QUARTA",
  "sync": "transcript",
  "fontScale": 1,
  "textStyle": {"fontFamily": "Anton", "uppercase": true, "color": "#FFFFFF"},
  "config": {
    "inactiveOpacity": 0.32,
    "transitionDuration": 0.18,
    "slotGap": 0.24
  }
}
```

### `filter` do motion design `0.2`

Filtros são elementos visuais sem asset e obedecem a ordem de `z`. Isso permite
colocar o efeito sobre a cena-base e abaixo de um PNG/capa em destaque.

- `style: "dim"`: escurecimento preto translúcido; `config.opacity` vai de 0 a 1 e o padrão é 0,45.
- `style: "crt_tv"`: scanlines de TV antiga + vinheta + flicker/jitter sutis. Defaults: `opacity: 1`, `scanlineOpacity: 0.18`, `vignette: 0.42`, `flicker: 0.035`, `jitter: 1.5`.
- `wiggle_soft`: idle de elemento `0.2` com microdeslocamento e rotação suave, útil para PNGs estáticos sem transformar o elemento em shake agressivo.

Texturas em vídeo já existentes, como partículas ou filme antigo, não precisam
do tipo `filter`: use um elemento `video` full-screen com `z` entre a
cena-base e o primeiro plano e `transform.opacity` baixo.

### Cards e animações

`box` aceita a string `"floating_card"` ou objeto com `preset` (somente
`floating_card` tem efeito especial), `padding` e `radius` numéricos não
negativos, `shadow` e `background` como textos. `floating_card` usa por padrão
padding 20, radius 28 e sombra `soft`; valores no objeto podem substituir
esses padrões. Qualquer `shadow` diferente de `"none"` usa a mesma sombra
suave. `background` aceita cor; `border` é aceito mas ainda não é desenhado.
Padding precisa caber na região; radius é limitado ao tamanho do conteúdo.

| Fase | Valores aceitos |
| --- | --- |
| `animation.enter` | `cut`, `none`, `fade`, `slide_up`, `pop_in` |
| `animation.idle` | `none`, `float_soft`, `slow_zoom_in`, `slow_zoom_out`, `pan`, `pulse_soft` |
| `animation.exit` | `cut`, `none`, `fade`, `fade_out` |

Nem todo movimento tem um filtro distinto: `pop_in` usa entrada com fade;
`pulse_soft` atualmente não acrescenta filtro visual. Use os nomes acima na
fase correspondente; um nome registrado em outra fase é rejeitado.

### `config` de overlay e SFX

| Tipo | Campos implementados |
| --- | --- |
| `overlay` | `keyColor`: cor FFmpeg, padrão `"0x00FF00"`; `similarity`: número de 0 a 1, padrão 0.18; `blend`: número de 0 a 1, padrão 0.08. |
| `sfx` | `duration`: número positivo, padrão 10 s; `preset`: `subtle` (−12 dB), `normal` (−6 dB), `strong` (0 dB); `trimDb`: ganho numérico que substitui o preset; `fadeIn` e `fadeOut`: segundos não negativos. |

## Validação e execução por CLI

```bash
python -m backend.contentlab.cli plugins
python -m backend.contentlab.cli validate caminho/para/edit_plan.json
python -m backend.contentlab.cli render caminho/para/edit_plan.json --mode rough
python -m backend.contentlab.cli render caminho/para/edit_plan.json --mode final --gpu
```

`validate` e `render` aceitam `--project-root`; `render` aceita também
`--output-dir`. `--gpu` tenta NVENC e retorna a `libx264` se indisponível.
O CLI retorna código 2 quando o plano ou os assets são inválidos. A UI salva o render final em `output/final/` e evita dois renders simultâneos do mesmo projeto. Arquivos de saída e relatórios são descritos no README e em
[`MVP_ACCEPTANCE.md`](MVP_ACCEPTANCE.md).

Para um ponto de partida, veja
[`examples/minimal-edit-plan.json`](examples/minimal-edit-plan.json) e
[`examples/audio-phase8-edit-plan.json`](examples/audio-phase8-edit-plan.json).
