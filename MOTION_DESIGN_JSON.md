# Motion design no `edit_plan.json` v0.2

Esta é a referência de autoria para pessoas e IAs. Use `version: "0.2"` para
cenas contínuas com fundo persistente, elementos independentes e câmera
virtual. O contrato formal é
[`schemas/contentlab.schema.v0.2.json`](schemas/contentlab.schema.v0.2.json);
o parser também verifica ordem/intervalo dos tempos, IDs e células do grid.
O `0.1` continua aceito para projetos antigos. Uma timeline inteira usa uma
versão só: **não misture cenas `0.1` e `0.2` no mesmo arquivo**.

O mesmo JSON é usado pelo motor Remotion em TypeScript. O Python valida o
contrato, resolve cada `project://` e `builtin://`, prepara a narração e
entrega ao Remotion as cenas visuais com caminhos locais já verificados.
Transições e mixagem de voz, música e SFX continuam no processamento Python
e FFmpeg. O Remotion renderiza os elementos por quadro; o JSON informa o
que aparece, quando aparece, onde fica e como se move. Cenas com `overlay`
usam o renderizador Python atual para preservar o chroma key.

## Fluxo mínimo

1. Tenha uma pasta de vídeo com `audio/narracao.wav`, os assets e
   `edit_plan.json`. A transcrição pode ser criada antes do plano.
2. Em `project`, escolha formato, resolução e FPS. Em `audio.narration`, use
   caminho relativo à pasta do vídeo. Em `sources.transcript`, indique o JSON
   de palavras se usar `caption` ou sincronizar `kinetic_text`.
3. Crie uma ou mais cenas em `timeline`. Para cada cena, defina `id`, `start`,
   `end`, `background`, `elements` e, opcionalmente, `camera`.
4. Valide o plano e os assets, salve, gere preview e só então o render final.
   O preview reduz resolução/FPS; a geometria é proporcional e mantém a mesma
   lógica de movimento.

## Fundo, assets e camadas

`background.color` aceita uma cor como `"#182238"`; não precisa de imagem.
`background.asset` aceita imagem ou vídeo. `fit` é `cover` (padrão), `contain`
ou `stretch`; `loop: true` repete vídeo. O fundo é o mesmo durante toda a cena
e a câmera se desloca sobre ele. Para mudar de fundo, inicie outra cena.

| Origem | Exemplo | Uso |
| --- | --- | --- |
| Projeto do vídeo | `project://assets/personagem.png` | Imagem, vídeo, overlay, música ou SFX privados daquele vídeo. |
| Biblioteca do aplicativo | `builtin://backgrounds/colecao/arquivo.mp4` | Arquivo recorrente **já instalado** em `builtin-assets/`; escolha o URI exibido no seletor do editor. |
| Cor sólida | `"background": {"color": "#182238"}` | Não requer arquivo. |

O nome do arquivo, a extensão e as maiúsculas/minúsculas precisam corresponder
ao disco (especialmente no Linux). Use `/` nos URIs também no Windows.
`sources.assets` é apenas informativo: não completa automaticamente os URIs.
`z` crescente desenha a camada por cima. Vídeos, overlays e backgrounds em
vídeo podem usar o próprio áudio: defina `muted: false`. Por compatibilidade,
quando `muted` é omitido a mídia continua silenciosa. `preset` (`subtle`,
`normal`, `strong`), `trimDb`, `fadeIn` e `fadeOut` controlam o ganho e os
fades dessa faixa. `muted: true` silencia explicitamente. O visual continua
sendo renderizado sem áudio pelo compositor; a faixa original é adicionada
uma única vez no mix final Python/FFmpeg.

Tipos de `elements[]`:

| Tipo | Campos principais | Comportamento |
| --- | --- | --- |
| `image` | `id`, `asset`, `cells`, `fit`, tempos, movimento | PNG/JPG/WebP/BMP. PNG preserva transparência. |
| `video` | `id`, `asset`, `loop`, `cells`, `fit`, tempos, movimento, áudio | Frames visuais da fonte. `muted: false` inclui o áudio original; `loop` repete vídeo e áudio. Se o visual acabar sem loop, mantém o último frame. |
| `overlay` | Como vídeo/imagem, `config`, áudio | Camada com chroma key. `config.keyColor` (padrão verde) e `similarity` controlam a remoção aproximada. Em overlay de vídeo, `muted: false` preserva o áudio original. |
| `text` | `id`, `text`, `style`, tempos, movimento | Texto fixo ou letra a letra com `reveal`; estilos registrados (`impact`, `impact_yellow`, `paper_word`, `versus_big`, `word_pop`, `anton`, `bangers`). |
| `kinetic_text` | `id`, `text`, `sync`, `emphasis`, tempos | Uma palavra por vez. Procura a frase na transcrição; sem correspondência distribui as palavras no intervalo. |
| `caption` | `id`, `style`, `range`, tempos | Mostra grupos de até quatro palavras da transcrição; nesta versão ainda não colore a palavra ativa como o karaoke do `0.1`. |
| `sfx` | `asset`, `at`, `config` | Apenas áudio; não usa `transform`, `keyframes` nem câmera. |

`start` e `end` de elemento são **segundos absolutos da timeline final**, dentro
da cena. Se omitidos, cobrem a cena. `at` dispara SFX. `audio.sourceCuts`
continua significando trechos **mantidos** da narração original; todos os
tempos visuais e da transcrição devem se referir à narração final limpa.

Para escrever texto progressivamente, use `type: "text"` com
`"reveal": {"charactersPerSecond": 8}`. A revelação começa no `start` do
elemento; `reveal.delay` (segundos, opcional) retarda o primeiro caractere.
O texto completo define o tamanho e a posição desde o início: as letras não
mudam de escala conforme aparecem. `text` continua visível até seu `end`.
Use `style: "anton"` para selecionar a fonte Anton; escolha a cor com
`textStyle.color` e a caixa com `textStyle.uppercase`. Sem cor explícita, o
renderizador usa branco como padrão, mas isso não faz parte do nome do estilo.
Use `style: "bangers"` para Bangers com contorno preto de 4 px. Ambas as
fontes acompanham o Content Lab; não dependem de instalação no sistema. Em
`textStyle`, altere `fontFamily` (`Anton` ou `Bangers`), `uppercase`, `color`,
`outlineColor`, `outlineWidth` (0–40 px) e `shadow` com `color`, `blur`,
`offsetX` e `offsetY`. Cores usam `#RRGGBB`. `fontAsset` continua disponível
para uma fonte própria e tem prioridade sobre a fonte do estilo. `fontScale` (maior que 0,
até 3) multiplica o tamanho-base antes do ajuste para caber nas `cells`.
**Não** há sintetizador de som por caractere: adicione um `sfx` de digitação
no intervalo desejado, com um arquivo de áudio real.

## Grid 3×3: posição-base e tamanho

```text
1 2 3
4 5 6
7 8 9
```

Use `"layout": "3x3"` (ou `"custom_grid"`) e `cells` em cada elemento.
`[1,4,7]` é a coluna esquerda; `[3,6,9]` é a direita; `[1,2,3]` é a faixa
superior. As células devem ser únicas e formar um retângulo contínuo. No
`0.2`, o grid **não corta** a imagem: ele define o centro e a caixa de encaixe
inicial. `fit: "contain"` preserva a proporção; `cover` preenche e recorta a
caixa; `stretch` distorce para preenchê-la. `transform.scale: 1.2` torna a
camada 20% maior que a caixa inicial, podendo ultrapassar as linhas do grid.
O `z` decide quem fica na frente quando houver sobreposição.

Sem `cells`, a camada visual recebe uma base de 80% da largura e altura do
quadro, centralizada. O grid disponível é fixo em **3×3** nesta versão; não
existe `2×2` nem grade arbitrária. `layout` pode ser `fullscreen`, `3x3` ou
`custom_grid`. O grid é uma ferramenta de posicionamento: não desenha linhas
no vídeo.

## Transformações e keyframes

`transform` define o estado inicial do elemento. `keyframes` é uma lista de
estados ao longo da cena. `t` é relativo ao **início da cena**. Exemplo: cena
com `start: 20`, keyframe `t: 3` acontece em 23 s da timeline. Tempos devem
ser crescentes, únicos e no intervalo de 0 até a duração da cena. Campos
omitidos herdam o valor anterior. O easing no keyframe de destino controla a
chegada a ele.

| Campo | Valores e unidade | Padrão |
| --- | --- | --- |
| `x`, `y` | 0–1 no espaço virtual de 2× a largura/altura do quadro. O quadro inicial mostra aproximadamente o centro (`0.25`–`0.75`). | Centro da região `cells`, ou `0.5` sem células. |
| `scale` | Maior que 0 e até 8; multiplicador da caixa inicial. `1.2` = 20% maior. | `1` |
| `rotation` | −360 a 360 graus; positivo gira no sentido horário. | `0` |
| `opacity` | 0 invisível; 1 opaco. | `1` |
| `easing` | `linear`, `ease_in`, `ease_out`, `ease_in_out`. | `linear` |

Com a câmera inicial, os centros das colunas esquerda, central e direita são
aproximadamente `x: 0.333`, `0.5` e `0.667`. Para deslizar um personagem para
a coluna esquerda, use `animation.enter: "slide_from_left"` ou keyframes que
levem `x` de uma posição fora do quadro (por exemplo `0.08`) até `0.333`.
Os presets de `animation` são atalhos, aplicados **depois** dos keyframes; se
ambos alterarem a mesma propriedade no mesmo instante, o preset prevalece
durante sua entrada/saída. Evite essa combinação quando precisar de controle
exato.

Presets disponíveis no `0.2`:

| Fase | Opções |
| --- | --- |
| `enter` | `cut`, `none`, `fade`, `pop_in`, `slide_from_left`, `slide_from_right`, `slide_up`, `slide_down` |
| `idle` | `none`, `float_soft`, `pulse_soft`, `slow_zoom_in`, `slow_zoom_out`, `pan` |
| `exit` | `cut`, `none`, `fade`, `fade_out`, `slide_to_left`, `slide_to_right`, `slide_to_bottom` |

A entrada dura 0,45 s e a saída 0,35 s por padrão, limitadas à duração do
elemento; `animation.enterDuration` e `animation.exitDuration` (segundos
positivos) permitem ajustar cada uma. `pop_in` cresce, ultrapassa ligeiramente
o tamanho final e acomoda-se nele. `slide_to_bottom` tira a camada por baixo.
Presets de slide entram a partir de fora do quadro visível. `float_soft`
oscila levemente na vertical, `pulse_soft` na escala e `pan` na horizontal.
Esses movimentos são intencionais, não obrigatórios em toda camada.

## Texto digitado, quebra segura e abertura/fechamento central

`text` com `reveal.charactersPerSecond` aparece caractere por caractere.
Espaços fazem parte da cadência, embora naturalmente não desenhem um glyph.
O texto `0.2` faz wrap apenas em fronteiras de palavra: não usa hifenização
automática nem quebra uma palavra no meio. Quando uma palavra completa não
cabe, o renderer reduz o tamanho até acomodá-la; frases maiores podem ocupar
várias linhas.

Além de fade/pop/slide, o `0.2` possui:

- `center_reveal` em `animation.enter`: abre a visibilidade do centro para
  as bordas;
- `center_close` em `animation.exit`: fecha das bordas para o centro.

As bordas da máscara recebem feather curto para evitar uma abertura dura.

Para motion design de frase longa em grid, use vários elementos `text`, cada
um em uma célula 3×3, cortando o conteúdo apenas entre palavras. Os
`camera.keyframes` podem acompanhar os fragmentos na ordem das células. Isso
mantém a frase legível e permite que a câmera viaje pela composição sem partir
palavras.
## Câmera e continuidade

`scene.camera.keyframes` aceita `t`, `x`, `y`, `scale` e `easing`. Padrão:
`x: 0.5`, `y: 0.5`, `scale: 1`. `scale` da câmera vai de 1 a 4; valores de
posição são normalizados de 0 a 1. A câmera move o enquadramento sobre fundo
e elementos juntos, como um único plano; não altera áudio. Ao chegar perto
da borda, o enquadramento é limitado para não expor área sem fundo. Entre duas
cenas há um corte/transição; para manter o mesmo fundo e plano contínuo,
coloque os movimentos dentro de **uma mesma cena**.

Para acompanhar texto escrito em diferentes células, divida a frase em
elementos `text` com `start` e `reveal` próprios e crie keyframes de câmera
em `x/y/scale` correspondentes aos tempos de cada trecho. `scale: 1`
mostra o quadro completo; cerca de `2.6` foca uma célula 3×3. O centro das
células esquerda, central e direita é aproximadamente `x: 0.333`, `0.5`,
`0.667`; as linhas usam os mesmos valores em `y`. A câmera mostra os
elementos intermediários ao deslocar-se entre células; use
`easing: "ease_in_out"` para deslocamento suave. `camera.shake` aceita uma
lista de `{start, end, amplitude, frequency}` com tempos **relativos à cena**.
`amplitude` é fração do mundo virtual (0–0,03; padrão 0,003) e `frequency`
é Hz (padrão 2,5). O balanço é leve e tem entrada/saída suavizada.

`transitionOut` conserva os plugins `cut`, `fade`, `slide_left`, `blur_left`, `blur_right` e `blur_up` entre cenas.
`slide_left` desliza a cena anterior para a esquerda e traz a nova pela direita sem blur.
`blur_left`, `blur_right` e `blur_up` fazem o slide da composição inteira na direção indicada e aplicam blur durante a passagem. `blur_left` desliza a cena anterior para a esquerda e traz a nova pela
direita com blur durante o deslocamento. `transitionDuration` na cena de
saída define segundos positivos; sem ele vale o padrão do plugin (0,4 s).
O intervalo não pode superar metade de nenhuma das duas cenas. A transição
ocupa o trecho final da cena anterior e usa o primeiro quadro da próxima
como chegada; o movimento interno da próxima cena começa no tempo normal
dela. Um `sfx` de whoosh deve ter `at` no início da transição: para uma cena
que termina em 8 s e transição de 3 s, use `at: 5`. O SFX precisa conter o
áudio desejado; `config.duration` limita seu trecho no mix.
`audio.music`, ducking, voice, SFX e `sourceCuts` seguem as mesmas regras do
`0.1` descritas em [EDIT_PLAN_REFERENCE.md](EDIT_PLAN_REFERENCE.md).

## Exemplo: dois personagens no mesmo fundo

Veja [o JSON completo](examples/motion-grid-v0.2.json). Ele usa:

- fundo sólido persistente durante seis segundos;
- personagem esquerdo em `[1,4,7]`, aparecendo em 0 s;
- personagem direito em `[3,6,9]`, aparecendo em 1 s;
- `transform.scale: 1.2` em ambos, ultrapassando o grid em 20%;
- `slide_from_left` e `slide_from_right`, sem corte entre as entradas.

Troque os dois URIs de PNG pelos nomes reais de seus arquivos, confirme a
narração e valide. Para usar papel ou outro fundo, substitua `background.color`
por `background.asset` apontando para `project://` ou `builtin://` existente.
Outro [exemplo com câmera e keyframes](examples/motion-design-proposal.v0.2.json)
mostra a passagem de foco dentro de uma cena.
O [storyboard completo](examples/motion-storyboard-v0.2.json) reúne vídeo de
fundo em loop, texto letra a letra, zoom e deslocamento de câmera, transição
de 3 s, pop, flutuação, balanço de câmera, saída inferior e SFX. É um modelo
de estrutura: troque os URIs pelos arquivos reais antes de validar/renderizar;
nenhum efeito sonoro, fonte ou mídia desse exemplo foi distribuído ainda.

## Pilha vertical de palavras

`style: "word_stack_vertical"` é um preset genérico de `kinetic_text` do
`0.2`. Ele mantém no máximo três palavras visíveis: anterior, ativa e próxima.
A ativa ocupa o centro em opacidade total; anterior e próxima ficam atenuadas.
Quando a palavra seguinte começa, a pilha se desloca suavemente: a ativa desce,
a próxima assume o centro e uma nova palavra entra por cima.

O timing vem de `phraseWords`, normalmente resolvido a partir de
`sources.transcript`. O objeto `config` aceita:

- `inactiveOpacity`: 0–1; padrão 0,32;
- `transitionDuration`: 0,05–1 s; padrão 0,18;
- `slotGap`: 0,10–0,45 da altura da região; padrão 0,24.

A aparência continua em `textStyle`. O preset usa Anton/caixa alta por
padrão, mas pode ser reaproveitado por outro projeto com Bangers ou outra cor
suportada pelo contrato.

## Caption com destaque por palavra

O estilo `bangers_highlight_block` é exclusivo do `edit_plan 0.2` e mantém
um chunk/frase inteiro visível em Bangers branca enquanto um bloco de fundo
com cantos arredondados acompanha a palavra ativa pelos timestamps de
`sources.transcript`. O caption normal existente continua separado.

Defaults: azul `#2563EB`, vermelho `#E53935` e preto `#111111`, no máximo
7 palavras por chunk e quebra antecipada por pontuação. Pequenos intervalos
entre palavras mantêm o destaque na última palavra iniciada para evitar
piscadas. Em `config`, podem ser ajustados `highlightColors`,
`maxWords` (2–12), `highlightRadius`, `highlightPaddingX` e
`highlightPaddingY`.

Exemplo:

```json
{
  "id": "caption-highlight",
  "type": "caption",
  "style": "bangers_highlight_block",
  "cells": [7, 8, 9],
  "range": {"start": 12.0, "end": 17.5},
  "fontScale": 0.5,
  "textStyle": {
    "fontFamily": "Bangers",
    "uppercase": true,
    "color": "#FFFFFF",
    "outlineColor": "#000000",
    "outlineWidth": 4,
    "shadow": {"color": "#000000", "blur": 8, "offsetX": 3, "offsetY": 4}
  },
  "config": {
    "highlightColors": ["#2563EB", "#E53935", "#111111"],
    "maxWords": 7,
    "highlightRadius": 14
  }
}
```

## Filtros em camadas e PNG em destaque

O `0.2` aceita `type: "filter"` como camada procedural. Use `z` para
controlar o escopo visual: cena-base abaixo, filtro no meio e PNG/capa acima.

```json
[
  {"id":"dim","type":"filter","style":"dim","z":20,"config":{"opacity":0.45}},
  {"id":"capa","type":"image","asset":"project://assets/capa.png","z":30,
   "animation":{"enter":"slide_down","idle":"wiggle_soft","exit":"slide_to_bottom"}}
]
```

Presets:

- `dim`: preto translúcido, configurado por `config.opacity`.
- `crt_tv`: scanlines, vinheta e movimento/flicker discretos de TV antiga.
  Configurações: `opacity`, `scanlineOpacity`, `vignette`, `flicker` e
  `jitter`.
- `wiggle_soft` é um idle de elemento e não um filtro: faz microdeslocamento
  e micro-rotação para manter PNGs estáticos respirando.

Para texturas de asset, como partículas luminosas ou filme antigo, prefira um
`video` em tela cheia com `transform.opacity` baixo e `z` abaixo do
primeiro plano. Isso preserva a textura original sem criar um preset específico.

## Erros comuns

- Referenciar `builtin://` antes de instalar o arquivo na biblioteca.
- Confundir `t` relativo à cena com `start/end` absolutos dos elementos.
- Esperar que `cells` recorte ou impeça a imagem de passar da região.
- Usar `scale: 1.2` como 120 pixels: é multiplicador, não tamanho em pixels.
- Criar duas cenas quando a intenção é manter o mesmo plano e fundo.
- Esquecer `id` único de cada elemento visual ou usar células não retangulares.
- Esquecer que áudio de `video`/`overlay`/background é opt-in por compatibilidade: use `muted: false`; `muted: true` silencia explicitamente.
- Esperar karaoke colorido no `caption` do `0.2`.

O renderizador de motion design compõe frames por CPU; cenas longas em alta
resolução podem ser lentas e ocupar espaço temporário durante o render.
