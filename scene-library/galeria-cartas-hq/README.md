# Galeria de cartas HQ

## Movimento e contrato de execução

Viagem parte logo abaixo da tela; a carta antiga mantém seu conteúdo durante a primeira parte da chegada da nova. Profundidades são calculadas numa passagem por frame, não varrendo a lista para cada carta. Camadas totalmente encobertas são descartadas após quatro rodadas na mesma coluna, preservando as bordas dos três níveis visuais.

Instalação manual: copiar **GaleriaCartasHQ.tsx** e **HQComicPage.tsx, HQMotion.tsx** para a mesma pasta custom-scenes. A Galeria prepara esses arquivos automaticamente, sem sobrescrever versões diferentes. Auxiliares idênticos são compartilhados uma única vez no projeto. Todos os sons continuam no plano; não há áudio automático. Anton sem sombra/contorno; Bangers mantém acabamento HQ.

## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Padrão: Bangers. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. Declare apenas a fonte selecionada. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

## Como funciona

As cartas são distribuídas da esquerda para a direita. Ao completar a linha, a próxima carta volta à primeira coluna e cobre a anterior; a seguinte vai para a segunda, e assim por diante. Não cria uma segunda linha e não desloca a galeria para fora da tela.

Por padrão, 16:9 usa três colunas e 9:16 usa duas, para manter imagens e títulos legíveis. Com três colunas: 1/2/3 são a primeira rodada, 4 cobre 1, 5 cobre 2, 6 cobre 3 e 7 cobre 4. Com duas: 3 cobre 1, 4 cobre 2, 5 cobre 3. É possível configurar columns de 1 a 4; o número efetivo nunca supera a quantidade de imagens.

Cada carta desliza inteira de baixo para cima. Depois de chegar, seu título e legenda aparecem suavemente. A imagem não é cortada: usa contain e desconsidera margens transparentes para acertar a escala. As cartas anteriores recuam, inclinam levemente e deixam bordas visíveis; seu conteúdo desaparece ao ser coberto para não deixar textos antigos vazando pelas bordas. O efeito de profundidade é limitado a três níveis visuais, sem limitar a quantidade total de itens.

Não há animação de saída, troca automática de página, ligação gráfica entre personagens, reprodução de vídeo, CRT ou áudio embutido. Todos os tempos e cores abaixo são configuráveis; fontes, bordas e estilo de sombra fazem parte do padrão.

## Instalação

Copie `GaleriaCartasHQ.tsx` para custom-scenes/ do projeto. Use `customComponent.mode: "replace"`, pois o componente desenha a tela inteira. A fonte obrigatória é `assets.bangers: "builtin://fonts/Bangers-Regular.ttf"` no mapa customComponent.assets. Cada item informa uma chave de imagem desse mapa, por exemplo asset personagem1 com caminho project://assets/personagens/imagem.png.

É um TSX único; precisa de React, Remotion e @remotion/fonts do Content Lab, além das imagens/fonte. Não depende de outro padrão da biblioteca. PNG transparente é recomendado para personagens. JPG, SVG e outras imagens estáticas carregáveis também funcionam. Não remove fundo opaco ou verde. As imagens devem ser locais/resolvidas pelo Content Lab para permitir medir sua transparência.

## Parâmetros

| Campo | Uso / padrão |
| --- | --- |
| `title` | Título superior obrigatório em Bangers maiúscula. Ajusta tamanho e até duas linhas para caber. |
| `subtitle` | Texto contextual opcional abaixo do título; vazio por padrão. |
| `items` | Lista ordenada de uma ou mais cartas, sem limite fixo de quantidade. |
| `items[].asset` | Chave de imagem em customComponent.assets. |
| `items[].title` | Título obrigatório da carta. |
| `items[].caption` | Legenda opcional menor sob o título da carta. |
| `items[].at` | Quando essa carta começa a entrar, em segundos relativos à cena. Se omitido: startDelay + índice × stagger. |
| `items[].cardColor` | Cor do papel dessa carta; herda cardColor. |
| `items[].accentColor` | Cor da faixa e etiqueta numérica dessa carta; herda accentColor. |
| `columns` | Quantidade de colunas, inteiro de 1 a 4. Padrão 3 horizontal / 2 vertical. |
| `backgroundColor` | Fundo sólido com halftone, #1B2943. |
| `cardColor` | Papel das cartas, #F6EDD8. |
| `textColor` | Título e subtítulo superiores, #FFFFFF. |
| `cardTextColor` | Títulos e legendas nas cartas, #111723. |
| `accentColor` | Linha sob o cabeçalho, faixa e número das cartas, #F4C542. |
| `startDelay` | Primeira entrada automática, 0,25 s. |
| `stagger` | Intervalo entre começos automáticos, 1,1 s. |
| `entryDuration` | Duração de cada deslizamento, 0,65 s. |
| `textDuration` | Revelação dos títulos da carta depois da chegada, 0,2 s. |
| `stackOffset` | Recuo visual por camada, 16 pixels de referência em 1080 na dimensão menor; de 0 a 24. Escala com a resolução. |

Cores em #RRGGBB. Bangers maiúscula em todos os textos. Prefira títulos e legendas curtos: o componente mede e reduz o tamanho para até duas linhas, mas parágrafos longos ficam pequenos. Não há props para cantos livres, ordem de colunas arbitrária, cor do contorno ou animação de saída. A fonte pode ser Anton ou Bangers. Quantidades altas aumentam o custo de renderização.

## Duração e sincronismo

A duração total é end - start da cena no edit_plan.json. Todos os at dos itens são relativos a esse início; eventos sfx são absolutos. Os tempos dos itens precisam ser não negativos, em ordem crescente ou igual. Cada carta precisa terminar deslizamento + revelação do texto dentro da cena.

Uma carta da rodada seguinte só pode começar depois de a anterior da mesma coluna terminar de entrar e mostrar seu texto. Isso evita sobreposição prematura. As cartas de colunas diferentes podem entrar ao mesmo tempo. Para uma rodada inteira simultânea, configure o mesmo at para esses itens e depois um at posterior para a rodada seguinte.

O tempo de exposição de uma imagem é controlado pelo at da próxima carta da mesma coluna; não existe hold separado por item. Para a imagem/texto já estar presente quando a narração falar dela, programe at antes da fala em pelo menos entryDuration + textDuration, usando os timestamps reais da transcrição como referência. O componente não lê transcript.json sozinho.

No exemplo de 10 s, as sete cartas começam em 0,25 / 1,35 / 2,45 / 3,55 / 4,65 / 5,75 / 6,85 s. A última termina de mostrar seu texto em 7,70 s. Os mesmos horários funcionam nas duas orientações, mas as cartas se distribuem por 3 ou 2 colunas automaticamente.

## Sons e camadas

O TSX não toca sons, música ou narração. O exemplo JSON inclui whooshes baixos e variados para as sete entradas: Whoosh curto 04.mp3, Whoosh 03.mp3 e Whoosh aéreo 03.mp3, em builtin://sfx/. Cada trecho tem 0,24 s, preset subtle e trimDb -28. Não acrescenta teclado, porque os textos surgem por opacidade, não letra por letra.

Para sincronizar o centro do trecho com o meio do deslizamento: `sfx.at = start absoluto da cena + item.at + entryDuration / 2 - duração do som / 2`. O exemplo começa os sons em 0,455 / 1,555 / 2,655 / 3,755 / 4,855 / 5,955 / 7,055 s. Recalcular ao mudar a timeline/itens/velocidade. O Content Lab prepara o silêncio; ouvir o ataque/pico real antes de aprovar a mixagem. trimDb é ganho, não loudness garantido em relação à voz.

Camadas: fundo/halftone, pilhas de cartas com as mais recentes por cima e cabeçalho separado à frente. Cada carta tem papel, textura discreta, borda/sombra, faixa de cor, número e imagem/textos. Nenhum filtro de fundo afeta a imagem ou o texto por acidente.

## Exemplo e referências

exemplo-cena.json é uma cena, não um edit_plan completo. Os quatro SVG em exemplos-assets/ são ilustrações genéricas, não personagens obrigatórios. Para usar o exemplo sem alterar caminhos, copie-os para assets/galeria/ do projeto. A demonstração repete algumas imagens com textos diferentes para mostrar sete entradas e várias rodadas de pilhas. Substitua pelas suas imagens reais.

As imagens com sufixo -inicio mostram uma etapa anterior da galeria. O componente é novo e a aprovação visual fica a cargo do criador, mesmo depois da compilação e dos testes locais.

## Conferência desta versão

Componente compilado no Content Lab local. Gerados e inspecionados PNGs com sete entradas em 16:9 (960×540) e 9:16 (540×960), a 30 fps, aos 3,5 s e 8,5 s. Conferidos o primeiro preenchimento e as pilhas após várias rodadas. Testados 80 cálculos de coluna/camada (1–4 colunas) e seis estados de profundidade, incluindo a volta à primeira coluna e o limite visual de três recuos. Exemplo JSON lido e caminhos de fontes/sons conferidos. Prévia interativa carregada no Remotion Studio. Não foi renderizado vídeo completo nem validada a mixagem com narração real.

## Fundos HQ

Atualização que substitui a descrição anterior dos fundos. Cada preset acompanha o auxiliar HQComicPage.tsx; copie ambos na instalação manual. Confira também o guia compartilhado.

| Prop | Opções / padrão |
| --- | --- |
| `backgroundStyle` | `halftone` (preserva o visual anterior), `solid`, `stars`, `film`, `paper`, `grid`. |
| `backgroundOpacity` | **Percentual 0–100**, padrão 100. 0: fundo totalmente transparente; 50: metade; 80: 80%. Não usar escala 0–1. Afeta só o fundo, inclusive sua retícula/sombra/vinheta, não o conteúdo da frente. |
| `backgroundColor` | Mantém o padrão específico deste componente; usado no halftone e na nova cor sólida, sem retícula. |
| `paperTone` | `light` (padrão) ou `dark`; só para paper. |
| `gridBackgroundColor` | #RRGGBB; padrão #10101A; só para grid. |
| `gridLineColor` | #RRGGBB; padrão #858595; só para grid. |

**Grid corrigido:** movimento horizontal contínuo da esquerda para a direita, sem oscilação nem retorno. Deslocamento de 28 unidades por segundo num plano de altura 1000, com repetição geométrica a cada 84 unidades (três segundos), cobrindo a borda sem salto visível. **Paper corrigido:** troca oito poses desenhadas de dobras, seis vezes por segundo, como fotografias sucessivas de papel amassado, sem interpolação e sem arrastar uma textura estática. Ciclo de 8/6 segundo. É uma releitura HQ, não uma cópia fotográfica.

**Stars:** movimento radial de pontos/bolas claros num fundo preto azulado. **Film:** riscos, poeira e leve variação de exposição num fundo escuro. Sem controles próprios de cor/velocidade. **Solid:** só backgroundColor, sem halftone nem textura. **Halftone:** mantém as cores e o padrão original desta composição.

Não há controle de velocidade, densidade ou tipo de animação para estes fundos. A duração é a da cena. A animação depende do frame/FPS e continua pelo tempo necessário. Fundos não emitem áudio e não aplicam filtros sobre textos, PNGs, cartões ou clipes da frente. As demais props, fontes e sons deste componente não foram alterados.

Exemplos de campos para adicionar em **customComponent.props**, junto das props obrigatórias originais:

```json
{"backgroundStyle":"paper","paperTone":"dark","backgroundOpacity":50}
```
```json
{"backgroundStyle":"grid","gridBackgroundColor":"#18243C","gridLineColor":"#75A3E8","backgroundOpacity":80}
```
```json
{"backgroundStyle":"solid","backgroundColor":"#A61C35","backgroundOpacity":100}
```

**Camadas:** para ver um vídeo/cena comum por trás, configure `customComponent.mode: "overlay"` e mantenha essa mídia na cena base. Em `replace`, a cena base não é desenhada: reduzir a opacidade não recupera uma camada removida. Em zero, só o fundo do TSX desaparece; os elementos da composição continuam visíveis. Isso não adiciona suporte automático a múltiplos módulos TSX.

## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.

## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Card = {asset: string; title: string; caption?: string; at?: number; cardColor?: string; accentColor?: string};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; title: string; subtitle?: string; items: Card[]; columns?: number;
  backgroundColor?: string; cardColor?: string; textColor?: string; cardTextColor?: string; accentColor?: string;
  startDelay?: number; stagger?: number; entryDuration?: number; textDuration?: number; stackOffset?: number;
  assets?: Record<string, string>};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
type TextLayout = {lines: string[]; size: number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/GaleriaCartasHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
