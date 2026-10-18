# Studio de Thumbnails — Content Lab

O editor visual de thumbnails fica na aba **Thumbnails** do Content Lab. Ele é independente do \`edit_plan.json\` de vídeo: não altera a timeline, não exige narração e não cria cópias \`backup\`/ \`legado\`. Salva um único projeto editável no navegador (IndexedDB) e permite exportá-lo/importá-lo como JSON.

## Fluxo de trabalho

1. Abra **Thumbnails** na barra lateral e dê um nome à coleção.
2. Edite a **base do vídeo longo (16:9)**. Escolha um dos estilos de fundo de \`BackgroundHQ\`: \`halftone\`, \`paper\`, \`film\`, \`stars\`, \`grid\` ou \`solid\`, ou selecione sem textura.
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
3. Textura HQ (halftone/papel/filme/estrelas/grade).
4. Luzes laterais e luz do centro.
5. Personagens laterais.
6. Sombra inferior em degradê.
7. **Texto preenchido**, com glow opcional.
8. **Personagem principal**.
9. **Texto com contorno fino** na mesma posição.
10. Caixa de subtítulo, se ativada.

O traço à frente da figura e o preenchimento atrás criam a sensação de que o personagem atravessa o lettering. Evite parágrafos grandes: uma ou duas linhas fortes funcionam melhor nas miniaturas.

## Dados e exportação

- As imagens PNG/JPG/WebP são carregadas diretamente do computador e passam a compor o projeto como dados locais. Não há upload para serviço externo.
- O navegador tenta salvar automaticamente no IndexedDB. **Baixar projeto JSON** cria uma cópia portátil com as imagens incorporadas; **Abrir projeto JSON** permite continuar em outro computador.
- A exportação ZIP é local e usa arquivos PNG sem recompressão adicional; o ZIP também contém \`projeto-thumbnail.json\`.
- O editor não modifica a thumbnail no Canva, nem publica automaticamente no YouTube. O usuário baixa e utiliza os arquivos.
- Fontes **Anton** e **Bangers** são carregadas da instalação do Content Lab: \`builtin-assets/fonts\`. Se o arquivo de uma delas estiver ausente, a prévia indica o fallback.
- A interface de fundo reutiliza a **paleta e os seis estilos** da biblioteca \`BackgroundHQ\`, adaptados a renderização de canvas estático. Não é uma renderização Remotion do próprio TSX; os efeitos animados (papel trocando poses, estrelas móveis, grade em movimento) são representados por quadros estáticos na thumbnail.
- O editor respeita o tamanho máximo de arquivo por imagem de 18 MB e até 30 variações por coleção.
- Para remover uma variante, use **Excluir versão selecionada**. Não são criados arquivos \`legado\`, \`backup\` ou \`antigo\`: o histórico do código fica no Git.

## Conferência visual recomendada

Verifique com a prévia real os PNGs recortados, margens do cabelo/rosto, leitura mobile do título, alinhamento do contorno, contrastes sobre halftone, luzes e recorte vertical após trocar o personagem. Confira os PNGs exportados em 1280×720 e 1080×1920. O JSON é um formato de projeto, não uma exigência de edição manual.
