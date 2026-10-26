# Studio de Thumbnails — Content Lab

O editor visual de thumbnails fica na aba **Thumbnails** do Content Lab. Ele é independente do `edit_plan.json` de vídeo: não altera a timeline e não exige narração. Usa a pasta universal selecionada no topo e salva o rascunho editável em `thumbnails/project.json`, com imagens incorporadas. As imagens exportadas, JSONs portáteis e ZIPs também ficam em `thumbnails/`, sem sobrescrever exportações anteriores.

## Fluxo de trabalho

1. Abra **Thumbnails** na barra lateral e dê um nome à coleção.
2. Edite a **base do vídeo longo (16:9)**. Escolha um dos estilos de fundo de `BackgroundHQ`: `halftone`, `paper`, `film`, `stars`, `grid`, `comic_page` (Página HQ transparente) ou `solid`, ou selecione sem textura.

   Ao escolher **Papel**, aparece somente **Tom do papel** (Claro/Escuro), no lugar de **Cor base**, pois a cor base não altera esse estilo. Nos demais estilos, somente **Cor base** aparece. Alternar estilos preserva os dois valores, sem precisar configurá-los novamente; isso também vale ao abrir um projeto JSON ou recuperar o rascunho salvo.
3. Importe uma imagem contextual (por exemplo, cenário/cidade) e ajuste a opacidade. As texturas são desenhadas *sobre* essa imagem, respeitando transparência.
4. Importe PNGs recortados para **personagem principal**, **esquerdo** e **direito**. Selecione a camada e arraste sobre a prévia; ajuste tamanho, opacidade, rotação, flip, glow e luz de cada figura nos controles.
5. Defina uma frase curta. O mesmo texto é desenhado na **posição exata em duas passadas**: preenchimento com glow *atrás* do personagem central, depois traço fino *à frente*. A fonte inicial é Anton; Bangers é opcional. Um subtítulo em caixa é opcional.
6. Ajuste o degradê preto na base. Ele escurece a parte inferior do cenário e personagens laterais, mas mantém o personagem principal e o título acima.
7. Clique **+ Novo Short**. A versão nasce com a mesma composição e herda automaticamente **o fundo global** (cor, textura, imagem contextual, transparência e sombra). Os personagens e textos são independentes nessa versão: substitua somente o PNG central e a frase, ou ajuste posições se o recorte 9:16 exigir.
8. Você também pode abrir **Criar vários Shorts por frases** e colar uma frase por linha: o Content Lab cria todas as versões de uma vez. Depois escolha cada Short e substitua o personagem central. Também é possível mudar o formato individual entre 9:16, 1:1 e 16:9.
9. Escolha **Full HD** (padrão) ou **4K**, e **JPG** (padrão, qualidade 95%), **PNG** ou **WebP**. Use **Baixar imagem desta versão** ou **Baixar todas (ZIP)**, com as imagens na resolução selecionada e o projeto editável JSON.

## O que é compartilhado e o que varia

| Configuração | Compartilhada entre todas as versões? |
| --- | --- |
| Estilo do fundo HQ, papel claro/escuro, cor, intensidade de textura | Sim |
| Imagem contextual, posição/escala e opacidade dessa imagem | Sim |
| Sombra inferior e sua intensidade/altura | Sim |
| Luzes laterais independentes: cores, força e alcance | Sim |
| Personagens esquerdo/central/direito, luz/glow individual | Não — cada Short copia os valores da base ao ser criado, depois pode mudar |
| Texto principal e contorno; subtítulo | Não — edições por versão |
| Orientação da versão | Independente — 16:9, 9:16 ou 1:1 |
| Resolução e codificação | Sim — Full HD/4K; JPG/PNG/WebP |

**Importante:** modificar o layout de personagem/texto do longo **depois** de criar um Short não modifica os recortes individuais já definidos. Isso evita sobrescrever ajustes manuais dos Shorts. Já o fundo é uma única configuração compartilhada em tempo real.

## Camadas (de trás para a frente)

1. Cor base.
2. Imagem contextual, com opacidade controlada.
3. Textura HQ (halftone/papel/filme/estrelas/grade/página transparente).
4. Luzes radiais dos personagens (quando esse modo estiver selecionado).
5. Personagens laterais.
6. Luzes laterais independentes, acima dos secundários; o modo lateral antigo de figura também permanece compatível.
7. Sombra inferior em degradê.
8. **Texto preenchido**, com glow opcional.
9. **Personagem principal**.
10. **Texto com contorno fino** na mesma posição.
11. Caixa de subtítulo, se ativada.

**Padrão de profundidade:** papel, halftone, filme, estrelas, grade e página HQ
ficam sempre atrás dos personagens secundários. Novas coleções usam secundários
com opacidade 100%; ajuste luminosidade/saturação para deixá-los discretos sem
mostrar a textura através do corpo. Opacidade abaixo de 100% é transparência
intencional e deixa o fundo aparecer por baixo, sem alterar a ordem das camadas.
Projetos importados preservam a opacidade definida no JSON.

### Composição com luzes nas laterais

Use o painel **Luzes laterais independentes**, separado do brilho das figuras.
`background.sideLights.left/right` contém `color` (#RRGGBB), `opacity` (0–100)
e `reach` (1–100%, percentual da largura). A luz esquerda vai da borda esquerda
ao centro; a direita faz o inverso, até ficar totalmente transparente no alcance
escolhido. Funcionam mesmo sem PNGs; opacidade 0 desliga aquele lado.
Ficam acima dos secundários e abaixo da sombra inferior, do título e do
protagonista. Não são brilhos radiais atrás dos personagens.

JSONs sem `sideLights` não ganham luzes extras automaticamente. O antigo
`left/right.glowMode: "lateral"` continua compatível, mas depende da existência
do PNG; não o use simultaneamente às novas luzes se não quiser somar os efeitos.
O brilho radial das figuras também continua disponível separadamente.

No título, **Distância entre linhas** (`lineHeight`) usa unidades do tamanho da
fonte: `1.48` deixa duas palavras mais separadas, criando espaço para o rosto.
O preenchimento e o contorno usam exatamente a mesma posição e entrelinha.
O tamanho ainda se reduz automaticamente para caber na tela. Sem o novo campo,
preserva-se a entrelinha anterior `0.91` e o ajuste de tamanho antigo.
O campo `stroke` controla o contorno de 0 a 160, em passos de 0,1: cada unidade equivale a 0,15 px em 1280 (160 = 24 px). Zero desliga; isso não altera o peso real da fonte.

### Composição simplificada e profundidade

`title.mode` aceita `split` (padrão legado: preenchimento atrás e contorno à frente), `front` (preenchimento sólido à frente), `behind` (preenchimento atrás, sem contorno à frente) e `outline` (somente contorno à frente). Todas as passadas usam a mesma geometria.

`title.align` aceita `left`, `center` e `right`; `x` é a âncora correspondente. `title.width` limita o bloco a 0,1–0,95 da largura. Quebras explícitas por Enter continuam respeitadas; o encaixe automático pode reduzir a fonte para caber. Ausência desses campos preserva o layout anterior. Revise as margens ao mudar alinhamento: o aplicativo não move a âncora por conta própria.

Os atalhos Simples, Texto à esquerda, Texto à direita e Profundidade alteram somente propriedades do título da variante atual; não removem mídia ou reposicionam personagens. A prévia de 160 px na seção do título usa a mesma composição sem as guias de seleção. Ela ajuda a observar leitura, não estima CTR. Para comparar, use variantes independentes e confira os arquivos reais lado a lado; a ferramenta não executa testes A/B na plataforma.
Por exemplo, `6` produz 0,9 px; `1` continua sendo um traço subpixel, sem engrossar
o texto artificialmente.

Novas coleções começam com base preta, página HQ transparente em marcas claras,
texto branco e luzes laterais azul/amarela. Projetos já salvos ou importados não
são convertidos para esse visual automaticamente. Para base branca, escolha
branco e desmarque a inversão da página para manter as divisórias escuras.

O traço à frente da figura e o preenchimento atrás criam a sensação de que o personagem atravessa o lettering. Evite parágrafos grandes: uma ou duas linhas fortes funcionam melhor nas miniaturas.

## Dados e exportação

### Resolução e formato do arquivo

| Orientação | Full HD (padrão) | 4K |
| --- | --- | --- |
| Horizontal | 1920×1080 | 3840×2160 |
| Vertical | 1080×1920 | 2160×3840 |
| Quadrado | 1920×1920 | 3840×3840 |

`output: {"resolution":"full_hd","format":"jpeg","quality":0.95}` controla a
coleção. `resolution` aceita `full_hd`/`4k`; `format` aceita `jpeg`/`png`/`webp`;
`quality` opcional aceita 0,5–1, com padrão 0,95 (JPG/WebP). PNG é sem perdas.
Sem `output`, projetos antigos passam a exportar Full HD/JPG; seus layouts são
preservados. A prévia leve não determina o tamanho do arquivo: a exportação
redesenha texto e composição na resolução final, não amplia uma captura HD.
Fotos/PNGs de origem pequenos não ganham detalhe real por serem exportados em 4K.
O ZIP respeita o mesmo formato e resolução. Formato não suportado pelo navegador
gera aviso, sem baixar PNG disfarçado de JPG/WebP.

### Imagem atrás da página HQ

Escolha a imagem contextual no painel de fundo e mantenha `style: "comic_page"`.
A imagem fica entre a cor base e as divisórias, com os personagens acima de ambas.
`photoFit: "cover"` preenche e recorta as bordas; `"contain"` mostra a imagem
inteira centralizada, mantendo a cor base nas margens livres. Não distorce a foto.
`photoX/photoY: 0.5`, `photoScale: 1` são os valores de centralização.
Ao escolher outra foto, posição/zoom voltam ao centro para não herdar o recorte
anterior; a primeira foto entra com opacidade 100%. Há também o botão
**Centralizar imagem e restaurar zoom**. Valores ausentes usam centro e zoom 1.

### Contrato do JSON de thumbnail

É um **projeto de imagem**, não uma timeline. O objeto raiz contém `version: 1`,
`name`, `media` (objeto), `background` (objeto global), `output` (opcional), `base` (camadas), `variants`
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
| Foto contextual | `background.photo`: chave de `media` ou null; `photoX`, `photoY`: frações de posição, centro 0,5; `photoScale`: zoom (interface 0,5–3); `photoFit`: cover/contain. |
| Luzes independentes | `background.sideLights.left/right`: `color` #RRGGBB, `opacity` 0–100, `reach` 1–100 (% da largura). Ausentes = desligadas; não dependem dos personagens. |
| Figura (`left`, `center`, `right`) | `image`: chave de `media` ou null; `x`, `y`: posição fracionária (0,5 = centro, interface −0,5 a 1,5); `scale`: altura relativa à tela (interface 0,08–2,2); `opacity`: 0–100; `rotate`: graus −180 a 180; `flip`: booleano. |
| Tratamento da figura | `saturation`, `brightness`: 0–200%, ausentes preservam 100%; `glowColor`: #RRGGBB; `glowOpacity`: 0–100%; `glowMode`: radial/lateral (ausente=radial); `glowSize`: raio percentual da menor dimensão no modo radial, alcance percentual da largura no modo lateral (interface 1–150%). Lateral é oferecido apenas aos secundários esquerdo/direito. |
| `title` | `text`: frase (Enter quebra linha, caixa alta na saída); `font`: Anton/Bangers; `x`, `y`: frações; `size`: fração da largura (interface 0,05–0,34, ajustada pelo encaixe); `lineHeight`: entrelinha em unidades da fonte, 0,6–2,5, ausente=0,91; `color`, `outlineColor`: #RRGGBB; `mode`: split/front/behind/outline (ausente=split); `align`: left/center/right (ausente=center), x é a âncora; `width`: 0,1–0,95 (ausente preserva encaixe anterior); `stroke`: 0–160 na interface e renderer, passo 0,1; `glowOpacity`: 0–100%; `glowSize`: 0–80 na interface, escalado pela largura/1280. |
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

### Direção a partir da referência do usuário

Antes de pesquisar imagens, defina a ideia que a thumbnail deve comunicar e a
função do protagonista e de cada secundário. Busque expressão, ação e situação
narrativa compatíveis, não apenas um PNG genérico do personagem. Se a referência
pede emoção e imagens icônicas, compare cenas/quadros reconhecíveis, sem trocar
pertinência por fama nem presumir autorização de uso. Confira fonte, recorte,
alpha real e resolução. O estilo de um canal continua sendo um perfil externo.

Uma composição possível usa base branca/preta, protagonista grande no centro,
secundários opcionais à esquerda/direita, luz de cada borda e título em duas
linhas. Configure `background.sideLights`, não o glow dos PNGs, para essas luzes.
Mantenha todos os fundos atrás dos secundários opacos. O preenchimento do título
fica atrás do protagonista e somente o contorno alinhado passa à frente.
Escolha cores e escala pela referência real, sem obrigar todo usuário a adotar
esse desenho. Validar o JSON não substitui comparar a imagem exportada com a
referência, inclusive em tamanho reduzido.

- As imagens PNG/JPG/WebP são carregadas diretamente do computador e passam a compor o projeto como dados locais. Não há upload para serviço externo.
- O rascunho é salvo automaticamente em `thumbnails/project.json` no projeto ativo. **Salvar JSON no projeto** cria uma cópia portátil com as imagens incorporadas; **Abrir projeto JSON** permite importar outro trabalho. **Recarregar projeto**, no topo, relê alterações externas com proteção contra sobrescrita de rascunhos divergentes. Projetos antigos do IndexedDB não são migrados automaticamente: importe seu JSON na pasta desejada.
- A exportação ZIP é local, com JPG/PNG/WebP no formato escolhido, e também contém `projeto-thumbnail.json`.
- O editor não modifica a thumbnail no Canva, nem publica automaticamente no YouTube. O usuário baixa e utiliza os arquivos.
- Fontes **Anton** e **Bangers** são carregadas da instalação do Content Lab: `builtin-assets/fonts`. Se o arquivo de uma delas estiver ausente, a prévia indica o fallback.
- A interface de fundo reutiliza os estilos da biblioteca `BackgroundHQ`, incluindo a página transparente, como composição estática. Papel, filme, estrelas, grade e página são obtidos do componente instalado via SVG; efeitos animados são representados por um quadro estático, sem renderizar um vídeo.
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
coleções começam com personagens laterais discretos e luzes independentes,
mantendo o protagonista nítido e o texto preenchido atrás dele, contorno à frente.

Verifique margens do cabelo/rosto, leitura mobile, alinhamento do contorno, contraste, luzes e recorte vertical. Confira também as dimensões dos arquivos exportados em Full HD/4K. O JSON é um formato de projeto, não uma exigência de edição manual.

### Página HQ transparente

`background.style: "comic_page"` usa o mesmo PNG original do BackgroundHQ. Os espaços entre as divisórias continuam transparentes e mostram a cor/foto base. `textureOpacity` controla a intensidade, e `invertEffects` permite divisórias claras sobre fundos escuros. A imagem usa cover centralizado: sem distorção, com recorte lateral possível em 9:16. Não redesenha os quadros.
