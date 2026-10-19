# Studio de Thumbnails — Content Lab

O editor visual de thumbnails fica na aba **Thumbnails** do Content Lab. Ele é independente do `edit_plan.json` de vídeo: não altera a timeline, não exige narração e não cria cópias `backup`/ `legado`. Salva um único projeto editável no navegador (IndexedDB) e permite exportá-lo/importá-lo como JSON.

## Fluxo de trabalho

1. Abra **Thumbnails** na barra lateral e dê um nome à coleção.
2. Edite a **base do vídeo longo (16:9)**. Escolha um dos estilos de fundo de `BackgroundHQ`: `halftone`, `paper`, `film`, `stars`, `grid`, `comic_page` (Página HQ transparente) ou `solid`, ou selecione sem textura.
3. Importe uma imagem contextual (por exemplo, cenário/cidade) e ajuste a opacidade. As texturas são desenhadas *sobre* essa imagem, respeitando transparência.
4. Importe PNGs recortados para **personagem principal**, **esquerdo** e **direito**. Selecione a camada e arraste sobre a prévia; ajuste tamanho, opacidade, rotação, flip, glow e luz de cada figura nos controles.
5. Defina uma frase curta. O mesmo texto é desenhado na **posição exata em duas passadas**: preenchimento com glow *atrás* do personagem central, depois traço fino *à frente*. A fonte inicial é Anton; Bangers é opcional. Um subtítulo em caixa é opcional.
6. Ajuste o degradê preto na base. Ele escurece a parte inferior do cenário e personagens laterais, mas mantém o personagem principal e o título acima.
7. Clique **+ Novo Short**. A versão nasce com a mesma composição e herda automaticamente **o fundo global** (cor, textura, imagem contextual, transparência e sombra). Os personagens e textos são independentes nessa versão: substitua somente o PNG central e a frase, ou ajuste posições se o recorte 9:16 exigir.
8. Você também pode abrir **Criar vários Shorts por frases** e colar uma frase por linha: o Content Lab cria todas as versões de uma vez. Depois escolha cada Short e substitua o personagem central. Também é possível mudar o formato individual entre 9:16, 1:1 e 16:9.
9. Use **Baixar PNG desta versão** ou **Baixar todas (ZIP)**, que contém os PNGs em resolução final mais o projeto editável JSON.

## O que é compartilhado e o que varia

| Configuração | Compartilhada entre todas as versões? |
| --- | --- |
| Estilo do fundo HQ, papel claro/escuro, cor, intensidade de textura | Sim |
| Imagem contextual, posição/escala e opacidade dessa imagem | Sim |
| Sombra inferior e sua intensidade/altura | Sim |
| Personagens esquerdo/central/direito, luz/glow individual | Não — cada Short copia os valores da base ao ser criado, depois pode mudar |
| Texto principal e contorno; subtítulo | Não — edições por versão |
| Formato de saída | Não — longo 1280×720, Short vertical 1080×1920, quadrado 1080×1080 |

**Importante:** modificar o layout de personagem/texto do longo **depois** de criar um Short não modifica os recortes individuais já definidos. Isso evita sobrescrever ajustes manuais dos Shorts. Já o fundo é uma única configuração compartilhada em tempo real.

## Camadas (de trás para a frente)

1. Cor base.
2. Imagem contextual, com opacidade controlada.
3. Textura HQ (halftone/papel/filme/estrelas/grade/página transparente).
4. Luzes laterais e luz do centro.
5. Personagens laterais.
6. Sombra inferior em degradê.
7. **Texto preenchido**, com glow opcional.
8. **Personagem principal**.
9. **Texto com contorno fino** na mesma posição.
10. Caixa de subtítulo, se ativada.

O traço à frente da figura e o preenchimento atrás criam a sensação de que o personagem atravessa o lettering. Evite parágrafos grandes: uma ou duas linhas fortes funcionam melhor nas miniaturas.

## Dados e exportação

### Contrato do JSON de thumbnail

É um **projeto de imagem**, não uma timeline. O objeto raiz contém `version: 1`,
`name`, `media` (objeto), `background` (objeto global), `base` (camadas), `variants`
(lista, até 30) e `selected` (`"base"` ou ID existente). Cada variante tem `id`
único, `name`, `format` (`long`, `vertical`, `square`) e `layers`, com a mesma
estrutura de `base`: `left`, `center`, `right`, `title`, `subtitle`.

Use preferencialmente **Baixar projeto JSON** como ponto de partida. Preserve
campos e versões que o usuário já ajustou; não confunda a existência de um arquivo
com aprovação visual. Ao criar uma coleção, preencha todos os controles descritos
abaixo para evitar campos indefinidos na interface.

| Objeto | Campos e unidades |
| --- | --- |
| `media` | Mapa `chave → data:image/png;base64,...` (também jpeg/webp). Bytes reais, sem URLs externas nem placeholders de base64. |
| `background` | `style`: halftone/paper/film/stars/grid/comic_page/solid/none; `color`: #RRGGBB; `paperTone`: light/dark; `textureOpacity`, `photoOpacity`, `shadowOpacity`, `shadowHeight`: 0–100; `invertEffects`: booleano. |
| Foto contextual | `background.photo`: chave de `media` ou null; `photoX`, `photoY`: frações de posição, centro 0,5; `photoScale`: zoom (interface 0,5–3). |
| Figura (`left`, `center`, `right`) | `image`: chave de `media` ou null; `x`, `y`: posição fracionária (0,5 = centro, interface −0,5 a 1,5); `scale`: altura relativa à tela (interface 0,08–2,2); `opacity`: 0–100; `rotate`: graus −180 a 180; `flip`: booleano. |
| Tratamento da figura | `saturation`, `brightness`: 0–200%, ausentes preservam 100%; `glowColor`: #RRGGBB; `glowOpacity`: 0–100%; `glowSize`: raio relativo à menor dimensão (interface 1–150%). |
| `title` | `text`: frase (Enter quebra linha, caixa alta na saída); `font`: Anton/Bangers; `x`, `y`: frações; `size`: fração da largura (interface 0,05–0,34, ajustada pelo encaixe); `color`, `outlineColor`: #RRGGBB; `stroke`: 0–15 na interface, passo 0,1; `glowOpacity`: 0–100%; `glowSize`: 0–80 na interface, escalado pela largura/1280. |
| `subtitle` | `text` vazio desliga; `font`: Anton/Bangers; `x`, `y`: frações 0–1; `size`: fração da largura (interface 0,015–0,14); `color`, `boxColor`: #RRGGBB; `opacity`: 0–100%. |

Essas faixas descrevem os controles atuais, não um schema de vídeo. A validação
de importação verifica estrutura, formatos, referências e tipos de imagem, não
certifica enquadramento nem estética. `title.tracking`, presente em algumas
exportações antigas, não é aplicado pelo canvas atual: não prometer controle de
espaçamento por esse campo. Posições normalizadas não são pixels nem células do
grid de nove usado nas cenas de vídeo.

### Composição por profundidade

Uma possibilidade é combinar cenário/foto e figuras laterais mais discretas,
personagem central nítido, sombra inferior e título cruzando o personagem. Ajuste
independentemente as laterais: não é necessário apagá-las, e valores padrão não
são uma exigência estética. Evite esconder rostos importantes ou tornar o título
ilegível; o efeito de profundidade não exige que toda letra apareça preenchida.
Na parte coberta pelo protagonista, pode aparecer apenas o contorno fino.
Confira o resultado em tamanho reduzido e após trocar de formato; essa composição
é configurável e não fixa personagens, paleta, texto ou identidade de canal.

- As imagens PNG/JPG/WebP são carregadas diretamente do computador e passam a compor o projeto como dados locais. Não há upload para serviço externo.
- O navegador tenta salvar automaticamente no IndexedDB. **Baixar projeto JSON** cria uma cópia portátil com as imagens incorporadas; **Abrir projeto JSON** permite continuar em outro computador.
- A exportação ZIP é local e usa arquivos PNG sem recompressão adicional; o ZIP também contém `projeto-thumbnail.json`.
- O editor não modifica a thumbnail no Canva, nem publica automaticamente no YouTube. O usuário baixa e utiliza os arquivos.
- Fontes **Anton** e **Bangers** são carregadas da instalação do Content Lab: `builtin-assets/fonts`. Se o arquivo de uma delas estiver ausente, a prévia indica o fallback.
- A interface de fundo reutiliza a **paleta e os seis estilos** da biblioteca `BackgroundHQ`, adaptados a renderização de canvas estático. Não é uma renderização Remotion do próprio TSX; os efeitos animados (papel trocando poses, estrelas móveis, grade em movimento) são representados por quadros estáticos na thumbnail.
- O editor respeita o tamanho máximo de arquivo por imagem de 18 MB e até 30 variações por coleção.
- Para remover uma variante, use **Excluir versão selecionada**. Não são criados arquivos `legado`, `backup` ou `antigo`: o histórico do código fica no Git.

## Conferência visual recomendada

### Cor dos efeitos e texturas

**Inverter cor dos efeitos** altera somente a textura: halftone preto vira branco;
grade e estrelas brancas viram pretas. A cor base, a foto contextual, os personagens
e os textos não são invertidos. O controle é compartilhado por todas as versões e
salvo no JSON como `background.invertEffects` (booleano; ausente = false).
Papel, filme, grade e estrelas usam **o próprio `BackgroundHQ.tsx` instalado**,
convertido em SVG no quadro fixo de 1 segundo, preservando polígonos, retícula,
riscos e demais formas HQ. Não usam quadros dos vídeos de backgrounds. A cor
base é composta separadamente para permitir inversão apenas do efeito; o papel
mantém os tons claro e escuro. Não é render de vídeo nem alteração dos TSX animados. A opacidade continua
controlando a intensidade; 0 desliga a textura, inclusive quando invertida.

O contorno do título aceita **0** (desligado) e valores fracionários. O valor **1**
equivale a **0,15 pixel na largura 1280**, escalado proporcionalmente na prévia e
exportação. O título usa peso real 400 da fonte, sem negrito sintético que engrossa
o `strokeText`. Projetos antigos continuam importáveis. Saturação e luminosidade
dos personagens agora são controláveis; ausentes no JSON preservam 100%. Novas
coleções começam com laterais discretas (opacidade 45%, saturação 45%, luz 65%),
mantendo o protagonista nítido e o texto preenchido atrás dele, contorno à frente.

Verifique com a prévia real os PNGs recortados, margens do cabelo/rosto, leitura mobile do título, alinhamento do contorno, contrastes sobre halftone, luzes e recorte vertical após trocar o personagem. Confira os PNGs exportados em 1280×720 e 1080×1920. O JSON é um formato de projeto, não uma exigência de edição manual.

### Página HQ transparente

`background.style: "comic_page"` usa o mesmo PNG original do BackgroundHQ. Os espaços entre as divisórias continuam transparentes e mostram a cor/foto base. `textureOpacity` controla a intensidade, e `invertEffects` permite divisórias claras sobre fundos escuros. A imagem usa cover centralizado: sem distorção, com recorte lateral possível em 9:16. Não redesenha os quadros.
