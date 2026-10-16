# Imagem e frases HQ

Padrão solicitado em 16/10/2026, em avaliação visual. Uma imagem com brilho discreto atrás e, no outro lado, blocos de texto que aparecem inteiros nos horários definidos. Sem escrita letra por letra, slide ou fade do texto. As frases anteriores permanecem. Layout, Bangers em maiúsculas, sombra escura e halftone discreto seguem a biblioteca; não copia a fonte/branding da referência como obrigação.


## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Padrão: Bangers. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. Declare apenas a fonte selecionada. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

PNGs `previa-anton-*` antigos podem mostrar sombras anteriores à correção; são históricos. A referência atual de Anton está no Texto HQ, exemplo `anton-limpo`. Consulte FONTES_HQ.md.

## Composição

Em 16:9, imagem e textos ficam lado a lado. imageSide right (padrão) deixa textos à esquerda e imagem à direita; left espelha as áreas sem espelhar a imagem. Em 9:16, imagem centralizada acima e textos abaixo: imageSide não muda a disposição vertical. As áreas não se sobrepõem.

A imagem e o brilho estão presentes desde o primeiro quadro. O brilho é uma luz radial atrás, não uma estrela/partícula ou filtro sobre o personagem. PNGs transparentes são enquadrados pela área visível, sem considerar margens vazias. Imagens opacas ficam inteiras, sem esticar ou cortar, mas o fundo opaco pode esconder parte do brilho. Não remove fundo verde nem detecta personagens/rostos.

O layout de texto inteiro é medido antecipadamente: palavras que ainda não apareceram reservam seu espaço, sem empurrar as já visíveis. Cada frase pode quebrar em linhas; a fonte é ajustada em conjunto para caber na área segura. Prefira poucos blocos curtos. Uma página muito longa ficará pequena; o componente não cria páginas nem rolagem automaticamente.

## Instalação

Copie ImagemFrasesHQ.tsx para custom-scenes/ do projeto. Use mode replace. Declare customComponent.assets.image como project://assets/... e assets.bangers como builtin://fonts/Bangers-Regular.ttf. O TSX é único, sem helpers locais; depende do runtime React/Remotion/@remotion/fonts do Content Lab e dos assets fornecidos. Não passe o mapa de assets dentro de props.

## Parâmetros

| Prop | Função / padrão |
| --- | --- |
| `phrases` | Lista obrigatória de blocos, na ordem visual. |
| `phrases[].text` | Texto obrigatório; Bangers maiúscula. |
| `phrases[].at` | Instante em segundos relativos à cena em que o bloco aparece inteiro. Obrigatório, ordenado e dentro da cena. |
| `phrases[].color` | Cor opcional #RRGGBB que substitui a alternância só nesse bloco. |
| `phrases[].size` | Peso relativo no tamanho do texto, 0,4–1,5; padrão 1. O tamanho final também depende do ajuste global à área. |
| `imageSide` | right ou left; padrão right. Só muda os lados no horizontal. |
| `label` | Etiqueta contextual opcional no topo, vazia por padrão. |
| `backgroundColor` | Cor do fundo, #111522. |
| `textColor` | Cor clara da alternância, #FFFFFF. |
| `mutedColor` | Cor cinza da alternância, #A6A9B1. |
| `accentColor` | Cor de ênfase configurável, #EF3F49; também colore a etiqueta e o brilho quando glowColor não é informado. |
| `glowColor` | Cor do brilho; herda accentColor. |
| `glowIntensity` | Intensidade do brilho, de 0 a 1; padrão 0,65. Use 0 para desativar. |
| `imageScale` | Escala dentro da área disponível, de 0,25 a 1; padrão 1. Não amplia além da área segura. |

Todas as cores usam #RRGGBB. A fonte pode ser Anton ou Bangers; Anton não tem sombra/contorno. As posições das áreas e a aparência instantânea são fixas. Não há parâmetros de digitação, câmera, balanço ou entrada/saída da imagem. Aceita imagens estáticas, não clipes de vídeo.

## Cores e relógio

A alternância padrão segue a ordem dos blocos: cinza, branco, destaque, cinza, branco, destaque... Não é uma mudança de cor da mesma frase ao longo do tempo: cada bloco preserva sua cor. Para mudar a ordem livremente, informe color em cada frase. Alterar accentColor não muda os dois primeiros tons. Para trocar só o brilho sem trocar a ênfase, use glowColor.

A duração total continua definida por timeline.start/end. at é relativo ao início da cena, não absoluto na edição. Para a frase entrar junto da narração, consulte transcript.words e calcule `at = início da palavra/frase no áudio final - start da cena`. Não dividir o texto em tempos iguais. O componente não carrega transcript.json nem a narração automaticamente.

Cada frase aparece no primeiro frame cujo tempo é maior ou igual a at, sem antecipação. Em 30 fps, a resolução temporal é 1/30 s. at precisa deixar ao menos um frame visível antes do fim. Frases podem compartilhar o mesmo at para aparecerem juntas. Depois de aparecer, cada uma fica até o fim; nenhuma é digitada ou apagada sozinha.

## Som e camadas

O TSX é visual e não toca sons, voz ou música. O exemplo tem elements vazio de propósito: como não há deslizamento nem digitação, não presume whoosh nem teclado. Se a direção pedir um pequeno impacto ao surgir uma ênfase, coloque o sfx no JSON em `start da cena + phrases[i].at`, com ganho baixo e ataque alinhado. Não estender efeitos de escrita sobre esta cena.

Camadas: fundo/halftone, brilho radial, imagem, textos/etiqueta. Não aplicar CRT/pixelado sobre a composição inteira nem acrescentar círculos, barras de progresso, logos ou ornamentos da referência automaticamente.

## Exemplo e referências

exemplo-cena.json é uma cena, não um plano completo. A máscara em exemplos-assets/mascara.svg é uma ilustração de demonstração em vetor, não uma imagem obrigatória. Para rodar o exemplo sem trocar caminhos, copie-a para assets/imagem-frases/ do projeto. Pode substituir por qualquer PNG real com transparência, sem ser personagem.





Os PNGs de etapa mostram a entrada progressiva dos blocos; a prévia esquerda mostra a opção imageSide left.

## Conferência local

Compilado no Content Lab e conferido em PNG 960×540 e 540×960, a 30 fps, com imagem/halftone/brilho e os quatro blocos completos. Também gerados quadros antes e no instante da primeira aparição (frames 14 e 15 para at 0,5 s) e uma etapa com dois textos. Conferida a inversão de lados, destaque amarelo e brilho azul como controles independentes. Testados 20 limites de aparição em 24/25/30/60 fps e 12 seleções da alternância de cores; as imagens visuais são de 30 fps, não uma inspeção em todos esses FPS. O exemplo JSON foi lido; não há render de vídeo completo nem áudio para mixar neste teste. A máscara é demonstrativa e pode ser substituída.

## Backgrounds HQ v2 — 16/10/2026

Atualização que substitui a descrição anterior dos fundos. Cada TSX continua independente. Confira também o guia compartilhado.

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

Prévias antigas mostram os fundos anteriores. `previa-background-16x9.png` e `previa-background-9x16.png` foram atualizadas nos testes de integração v2. Os novos visuais aguardam aprovação. O novo BackgroundHQ é o padrão que mostra somente o fundo, com a mesma API.

## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.


## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Phrase = {text: string; at: number; color?: string; size?: number};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; phrases: Phrase[]; imageSide?: 'left' | 'right'; label?: string;
  backgroundColor?: string; textColor?: string; mutedColor?: string; accentColor?: string; glowColor?: string;
  glowIntensity?: number; imageScale?: number; assets?: {image?: string; bangers?: string; anton?: string}};
type Line = {text: string; size: number; height: number};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
type HQBackgroundOptions = {
  backgroundStyle?: 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/ImagemFrasesHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)
