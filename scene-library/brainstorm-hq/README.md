# Brainstorm HQ


## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Padrão: Bangers. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. Declare apenas a fonte selecionada. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

PNGs `previa-anton-*` antigos podem mostrar sombras anteriores à correção; são históricos. A referência atual de Anton está no Texto HQ, exemplo `anton-limpo`. Consulte FONTES_HQ.md.

## Como funciona

A câmera começa aproximada no primeiro nó. Cada etapa mantém esse foco por `hold` segundos. Depois, a câmera viaja suavemente até o próximo nó durante `moveDuration`, enquanto a nova ligação é desenhada e o cartão aparece. Os pontos anteriores permanecem no mapa. Ao terminar a última espera, há um zoom out para contemplar o conjunto. Não há animação de saída.

Uma conexão pode partir de qualquer nó já apresentado: defina `from`. Isso não muda o ponto de partida da câmera: ela sai do foco atual e chega ao novo ponto, enquanto a linha liga os nós escolhidos. `connect: false` permite revisitar um ponto sem desenhar outra conexão.

## Parâmetros

| Campo | Uso |
| --- | --- |
| `nodes` | Lista de nós. Cada um exige `id` único e `text`, `asset` ou ambos. |
| `nodes[].asset` | Chave do arquivo declarado em `customComponent.assets`, não um caminho direto. |
| `nodes[].text` | Texto exibido em Bangers, automaticamente em maiúsculas. Prefira títulos/frases curtas. |
| `nodes[].x`, `y` | Posição do centro do nó no plano virtual; informe os dois ou nenhum. Sem coordenadas: três colunas no horizontal, duas no vertical. Espaçamento: 580 horizontal e 490 vertical. Use coordenadas próprias para mapas orgânicos e ramificações. |
| `nodes[].color` | Cor do cartão individual, opcional. |
| `steps[].node` | Nó em que a câmera vai focar. Todos os nós precisam ser visitados. |
| `steps[].from` | Origem da conexão; padrão: nó da etapa anterior. Precisa já ter aparecido. |
| `steps[].hold` | Segundos de foco após a chegada, obrigatório e maior que zero. |
| `steps[].moveDuration` | Segundos de viagem até este nó; padrão 0.85. A primeira etapa não tem viagem. Zero permite corte de câmera. |
| `steps[].connect` | Padrão true. False desativa a ligação dessa etapa. |
| `backgroundColor` | Fundo halftone, padrão #18243C. |
| `cardColor` | Cor dos cartões, padrão #FFF5D7. |
| `textColor` | Cor das letras, padrão #FFFFFF; escolha contraste com os cartões. |
| `lineColor` | Cor das ligações, padrão #FF435A. |
| `zoomOutDuration` | Duração do zoom out final, padrão 1.4 segundo. |

## Tempo e sincronização

A duração total vem de `end - start` na cena do edit plan. Mínimo necessário: soma dos `hold` + soma das viagens (exceto a primeira) + `zoomOutDuration`. O tempo que sobrar mantém o mapa completo visível. O componente recusa cenas curtas e referências inválidas.

No exemplo, as chegadas são 0, 2.9, 6 e 8.9 segundos; o zoom out começa em 10.9 e termina em 12.3. A cena acaba em 14. Para sincronizar com uma palavra, faça a chegada acontecer até o início dela; não espere a palavra começar para iniciar a viagem.

## Sons

O TSX não toca áudio automaticamente nem inclui narração/música. Configure os sons no edit plan, separadamente: whooshes baixos centralizados nas viagens (exemplo: 2.45, 5.45 e 8.45 segundos) e, se desejado, no zoom out (11.6). Varie os sons sem competir com a voz. Para pop de cartão, alinhe o ataque ao aparecimento; é opcional. Não some o tempo de silêncio do arquivo ao posicionar o ataque.

## Instalação e exemplos

Copie `BrainstormHQ.tsx` para `custom-scenes/` do projeto e adapte `exemplo-cena.json`. Copie a imagem demonstrativa para `assets/brainstorm/` ou substitua por suas imagens. A fonte é a Bangers fornecida pelo Content Lab. Nenhuma dependência além de React, Remotion e @remotion/fonts já presentes no aplicativo.

Prévia horizontal: `previa-16x9.png`. Vertical: `previa-9x16.png`. Foco inicial: `previa-foco.png`. As imagens demonstrativas não fazem parte obrigatória do padrão. Não foi renderizado um vídeo completo.

## Backgrounds HQ v2 — 16/10/2026

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

Prévias antigas mostram os fundos anteriores. `previa-background-16x9.png` e `previa-background-9x16.png` foram atualizadas nos testes de integração v2. Os novos visuais aguardam aprovação. O novo BackgroundHQ é o padrão que mostra somente o fundo, com a mesma API.

## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.

## Modo percurso — adaptação do FollowDot

O mesmo BrainstormHQ oferece apresentações complementares, sem criar um TSX duplicado:

- `presentation: "cards"` (padrão): preserva os cartões, a rede ramificada e os exemplos anteriores.
- `presentation: "path"`: percurso contínuo, texto/imagem sem cartões, traço com contorno e bolinha de acabamento cartunesco. A câmera segue a mesma curva da bolinha, para no ponto durante hold e abre o plano no final. Sem código de demonstração, marca ou palavras fixas do FollowDot antigo.

Use cards para mapa mental ramificado; use path para uma sequência narrativa conectada, como uma ideia levando a uma escolha e a uma consequência. Não desenha o grid de 196 células, órbitas e janela de código do exemplo antigo: esses elementos eram conteúdo demonstrativo, não requisitos do percurso. A adaptação preserva a função de ponto/trajetória/câmera, não cada ornamento do antigo FollowDot.

### Props adicionais

| Campo | Valores / padrão |
| --- | --- |
| `presentation` | cards (padrão), path, narrative ou evidence. |
| `pathBend` | -1–1; padrão 0.18. Curvatura da trajetória quadrática; 0 faz linha reta; sinal troca o lado da curva. Só path. |
| `dotColor` | #RRGGBB; padrão #F4C542. Cor da bolinha, independente de lineColor. Só path. |
| `dotSize` | 6–30 unidades do plano virtual; padrão 14. Não são pixels de saída: a câmera escala a bolinha junto do plano. Só path. |

As props de fundo/fonte/cores/zoom e nodes/steps existentes continuam válidas. No path, `nodes[].color` altera a cor do texto daquele ponto; cardColor não aparece, pois não há cartões. Imagens usam contain, sem detecção adicional de margem transparente. Prefira imagens recortadas e textos curtos. O tamanho do texto usa uma estimativa por comprimento, não um ajuste ilimitado de parágrafos.

### Tempos, posições e conexões

O relógio segue a mesma fórmula do Brainstorm: primeiro ponto em 0, hold, viagem ao próximo por moveDuration, novo hold. O primeiro moveDuration é ignorado. Para saber a chegada de uma etapa, some hold e viagens anteriores. A câmera e o ponto chegam juntos; use esses tempos reais para sincronizar com transcript.words. Nenhum timestamp de narração é inferido.

No path, as conexões partem do ponto anterior. Não passar from apontando a um ancestral diferente: isso é rede ramificada e pertence ao modo cards. `connect: false` deixa a bolinha/câmera viajar sem desenhar a linha desse trecho. Pode revisitar nós existentes. A animação desenhada termina exatamente na bolinha; o zoom out inclui a região das curvas e os rótulos.

Sem x/y, a distribuição continua responsiva: três colunas no horizontal, duas no vertical. Para trajetos próprios, passe x/y juntos em coordenadas virtuais. O fundo fica preso à tela, não viaja com os pontos. Não existe nova prop de câmera manual, partículas ou desenho de trajetória SVG arbitrária. Para a primeira prévia, as posições são automáticas nos dois formatos.

### Exemplo e sons

exemplo-percurso.json: quatro pontos, 12 segundos. Holds de 1.3 s e viagens de 1 s. Chegadas em 0, 2.3, 4.6 e 6.9 s. Zoom out de 8.2 a 9.7 s; depois mantém a visão geral até 12 s.

O TSX não toca áudio. O exemplo inclui whooshes discretos e variados nas três viagens, com trechos de 0.24 s centrados em 1.8, 4.1 e 6.4 s. Portanto seus inícios absolutos são 1.68, 3.98 e 6.28 s para uma cena começando em 0. Recalcule todos os SFX ao mudar start/hold/moveDuration; confira ataque audível e volume junto da voz. Não há teclado, clique ou música obrigatórios.

`backgroundOpacity` 0–100 afeta só o fundo. Em overlay, a cena comum pode aparecer atrás; labels, ponto e linha continuam visíveis. Em replace, transparência não recupera mídia base removida. Anton permanece sem sombra/contorno; Bangers preserva acabamento HQ.

### Prévia e estado







Resultados da validação do modo percurso.

## Modo narrativo — adaptação do NarrativePath (item 02)

Use `presentation: "narrative"` para uma sequência de argumentos ou capítulos, cada um com título e frase de apoio. A câmera acompanha a curva, destaca a ideia atual e reduz a opacidade das outras. No zoom out final, os textos apresentados recuperam destaque para mostrar o raciocínio completo. Contador e progresso ficam presos à tela, sem viajar com os nós. Não é legenda por palavra nem texto digitado.

A adaptação foi integrada ao Brainstorm HQ, não duplicada em outro TSX. Não altera os modos cards/path. O fluxo antigo de props beats/heading/at **não é importado automaticamente**: use nodes/steps no formato atual. Heading foi reaproveitado como nome da ideia geral; não implica manter os outros contratos antigos.

### Parâmetros próprios e reaproveitados

| Campo | Regra |
| --- | --- |
| presentation | narrative; padrão global continua cards. |
| heading | Texto opcional do cabeçalho, padrão vazio; até 70 caracteres. Só aparece no modo narrativo. Mesmo fontFamily do restante. Prefira título curto. |
| nodes[].text | Título principal do ponto. Medido com a fonte carregada e ajustado para até duas linhas; sempre maiúsculo. |
| nodes[].subtitle | Texto de apoio opcional, até 120 caracteres; medido para até duas linhas, sempre maiúsculo. Só aparece no modo narrative, ignorado em cards/path. Não basta subtitle sozinho: mantenha text ou asset no nó. |
| nodes[].color | Cor #RRGGBB do título desse ponto. Apoio/cabeçalho usam textColor; sem color, título também usa textColor. |
| nodes[].asset | Opcional; chave de imagem no mapa customComponent.assets. No modo narrativo usa área menor acima do texto, sem distorcer. |
| nodes[].x / y | Centro do estágio no plano virtual; passar ambos ou nenhum. Exemplo usa diagonal/subida/descida, não posições de pixels da tela. |
| steps | Mesma sequência hold/moveDuration de path. from deve ser o ponto anterior nas conexões; cards continua sendo o modo de rede ramificada. |
| fontFamily | Bangers ou Anton. Declare assets.bangers ou assets.anton conforme a seleção. Anton sem sombra/contorno. |

Fundos, opacidade, pathBend, lineColor, dotColor/dotSize e zoomOutDuration seguem o contrato do modo percurso. O cabeçalho/contador/progresso não são afetados por backgroundOpacity: em overlay com fundo 0, o conteúdo permanece sobre a cena base. Não há controle separado para ocultar contador/progresso; não inventar props para isso. Não existe cor de fundo por etapa neste modo. Para alternância de cartelas/palavras, use Texto HQ.

### Relógio do exemplo

exemplo-narrativo.json é uma cena de 14 s, não um plano completo. Chegadas em 0 / 3 / 6 / 9 s. Cada hold dura 2.2 s; a viagem seguinte dura 0.8 s. Zoom out de 11.2 até 12.6 s e visão geral até 14 s. Contador/progresso avançam **na chegada**, não no início da viagem; em revisitas o contador segue as etapas, não a contagem de nós únicos.

A frase principal e o apoio entram durante a chegada; programe a chegada até o início da palavra-chave. Use transcript.words do áudio final e converta para tempos relativos. O componente não lê áudio nem transcrição sozinho. A primeira ideia está presente em 0; não há uma entrada extra atrasando a fala.

Sons continuam fora do TSX: o exemplo usa três whooshes de 0.24 s, preset subtle e trimDb -28, começando em 2.48 / 5.48 / 8.48 s. Seus centros coincidem com 2.60 / 5.60 / 8.60 s, os meios das viagens. Somar o início absoluto da cena quando ela for movida. Não há teclado porque as frases não são digitadas; conferir ganho/ataque com narração real.

### Prévia







Primeira proposta visual da adaptação 02; ainda depende da avaliação do criador. Não replica cada ornamento do NarrativePath antigo: remove círculos decorativos e usa o mesmo percurso/cartoon do repertório atual. Fonte/cores/fundo vêm do plano. Nenhum arquivo do Content Lab ou projeto VD/SH foi substituído nesta etapa.

Resultados da validação do modo narrativo.

## Modo evidências — adaptação do EvidenceConstellation (item 03)

Use `presentation: "evidence"` para apresentar personagens, objetos ou evidências em cartões verticais conectados. Cada cartão entra, a câmera se aproxima e permanece durante hold; depois viaja ao próximo. A imagem ativa fica colorida; as anteriores ficam mais discretas, recuperando destaque na visão geral final. Sem imagem, aparece um número grande. O modo foi integrado ao Brainstorm HQ, sem criar TSX duplicado, e não altera cards/path/narrative.

### Contrato e diferenças

| Campo | Regra / uso em evidence |
| --- | --- |
| presentation | evidence; padrão global continua cards. |
| heading | Cabeçalho opcional, até 70 caracteres; mesmo fontFamily. Omitir/vazio remove o cabeçalho, mas não o contador. |
| nodes[].asset | Chave de imagem em customComponent.assets, opcional. Imagem em contain, sem esticar, chroma ou detecção de rosto. Margens transparentes não são removidas automaticamente. |
| nodes[].text | Título opcional se houver imagem; ajuste medido para até duas linhas. Sem imagem, text é necessário. |
| nodes[].subtitle | Apoio opcional de até 120 caracteres, medido para até duas linhas. Também disponível no modo narrative; continua ignorado em cards/path. |
| nodes[].color | Cor #RRGGBB da faixa de identificação e dos conectores desse cartão, não a cor do papel nem do título. |
| nodes[].x / y | Centro do cartão em coordenadas virtuais; informar ambos ou nenhum. Sem valores: sequência alternada no horizontal e duas colunas no vertical. |
| cardColor | Papel de todos os cartões e etiquetas do cabeçalho; padrão #FFF5D7. |
| textColor | Letras dos cartões/cabeçalho; neste modo, padrão escuro #172338 para contrastar com o papel claro. Nos outros modos o default anterior #FFFFFF permanece. |
| lineColor | Cor das ligações e progresso; padrão global #FF435A. |
| steps[].from | Permite ramificação: liga o novo cartão a qualquer ponto já apresentado. A câmera sai do foco atual, não obrigatoriamente da origem da ligação. |
| steps[].connect | false impede desenhar a ligação dessa etapa; a câmera continua viajando. |

Todos os campos de fonte, fundos, backgroundOpacity, duração/steps e zoomOutDuration seguem os guias acima. Anton sem sombra/contorno; Bangers com acabamento HQ. A ordem dos nós define os números dos cartões; o contador acompanha as etapas, inclusive revisitas. Não existe limite fixo de cinco nós como no exemplo antigo, mas muitos itens custam mais e ficam pequenos no zoom out.

Os cartões têm 360×460 unidades virtuais, contorno/sombra definidos, retícula interna e acento colorido. Não há width/height livre, animação de boca ou vídeo dentro deles. PNGs e imagens opacas são aceitos. pathBend/dotColor/dotSize não têm efeito em evidence. Os modos path/narrative são percursos sem cartões, enquanto cards é o mapa de cartões compacto anterior.

### Linhas, câmera e enquadramento

As conexões se prendem à borda dos cartões, não ao rosto/texto. Traços e conectores são desenhados à frente para não desaparecerem atrás dos cartões. A curva automática faz um arco lateral/superior e a visão geral inclui sua região. Não é um roteador que evita qualquer obstáculo: ao passar x/y próprios, mantenha espaço entre os cartões e revise cruzamentos. Cartões conectados não podem ocupar exatamente o mesmo centro.

A câmera e as entradas usam o mesmo relógio de steps. No primeiro cartão não há espera extra; o texto já pode ser lido no início. As cores/destaques mudam durante a viagem e chegam ao novo foco no fim de moveDuration. Fundo fica preso à tela; cabeçalho/contador/progresso também, sem receber o zoom do mundo. A imagem fica cinza quando perde foco, mas seus arquivos originais não são modificados.

### Exemplo, assets e áudio

exemplo-evidencias.json: cena de 12 s, chegadas em 0 / 3.1 / 6.2 s; holds de 2.2 s, viagens de 0.9 s. A terceira evidência se conecta à primeira para demonstrar ramificação. Zoom out de 8.4 a 9.8 s; visão geral até 12 s. Ajuste os tempos à transcrição real; não há leitura automática de transcript.json.

Copie escudo.svg, balanca.svg e lampada.svg de exemplos-assets para assets/brainstorm no projeto ou substitua os caminhos por suas imagens. São ilustrações genéricas, não personagens obrigatórios. O JSON é uma cena, não um edit_plan completo.

Nenhum som é embutido. O exemplo tem dois whooshes variados de 0.24 s, preset subtle, trimDb -28, começando em 2.53 e 5.63 s. Os centros são 2.65 e 5.75 s, meios das viagens. Some o start absoluto da cena ao reposicionar. Não há som obrigatório por cartão nem digitação; escute os ataques e volumes junto da voz.

Mode overlay com backgroundOpacity 0 revela a cena comum por trás, mas preserva o papel dos cartões, textos e linhas. Para remover o papel, este não é o padrão indicado: use path/narrative. Replace não recupera a base removida ao reduzir opacidade.

### Referências







Resultados da validação de evidências.


## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Node = {id:string; text?:string; subtitle?:string; asset?:string; x?:number; y?:number; color?:string};
type Step = {node:string; from?:string; hold:number; moveDuration?:number; connect?:boolean};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; nodes:Node[]; steps:Step[]; backgroundColor?:string; cardColor?:string; textColor?:string;
  lineColor?:string; zoomOutDuration?:number; presentation?:'cards'|'path'|'narrative'|'evidence'; heading?:string; pathBend?:number; dotColor?:string; dotSize?:number; assets?:Record<string,string>};
type JourneyPoint={x:number;y:number};
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

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/BrainstormHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)
- [exemplo-evidencias.json](exemplo-evidencias.json)
- [exemplo-narrativo.json](exemplo-narrativo.json)
- [exemplo-percurso.json](exemplo-percurso.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
