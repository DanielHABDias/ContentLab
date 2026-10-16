# Personagem, espiral e legenda sincronizada

TSX único para 16:9 e 9:16, com dois fundos procedurais inspirados nos arquivos `background_espiral_pixelada.mp4` e `background_espiral_crescente_pixelada.mp4` fornecidos em Downloads. Recria as faixas curvas, pontilhado e vinheta por código: não precisa carregar esses vídeos, nem módulos auxiliares. É uma recriação visual, não uma cópia pixel a pixel dos vídeos originais.

O personagem é um PNG transparente escolhido pelo usuário, não obrigatoriamente personagem. Entra de baixo para cima, fica grande, balança suavemente e não tem saída animada. A legenda fica à frente, abaixo, em Bangers maiúscula branca com sombra/contorno. A palavra ativa recebe um bloco colorido, alternando as cores configuradas. A TV/textura do fundo não afeta o personagem nem a legenda.

Refinamento do fundo: espiral calculada em baixa resolução e ampliada sem suavização, com degraus de pixels reais nas faixas, granulação e halftone. As faixas têm curvatura ampla e suave, sem dobras fortes, e giram continuamente com formato estável; a variante padrão prioriza o contraste preto/branco da referência escura. Personagem e legenda não são pixelados.


## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Padrão: Bangers. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. Declare apenas a fonte selecionada. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

PNGs `previa-anton-*` antigos podem mostrar sombras anteriores à correção; são históricos. A referência atual de Anton está no Texto HQ, exemplo `anton-limpo`. Consulte FONTES_HQ.md.

## Instalação

Copie somente `PersonagemEspiralLegenda.tsx` para `custom-scenes/` do projeto. Forneça o PNG em `customComponent.assets.character` e a fonte em `assets.bangers` (`builtin://fonts/Bangers-Regular.ttf`). Use `exemplo-cena.json` como uma cena de timeline e substitua o caminho do PNG e as palavras pelos seus. O PNG usado nas prévias é personagem_exemplo.png; ele não está embutido no TSX. O caminho do exemplo é ilustrativo: forneça o arquivo real no projeto, sem presumir que ele ainda esteja na raiz de Downloads.

## Controles

| Campo | Função / padrão |
| --- | --- |
| `timeline[].start/end` | Controla a duração total da cena. |
| `backgroundVariant` | `espiral`: preto/branco de maior contraste; `crescente`: faixas claras/cinzas e curva mais acentuada, movimento inverso. |
| `entryDuration` | Duração da entrada, 0,6 s. Deve caber na cena. |
| `entryDelay` | Espera antes de entrar, 0 s. Programe a entrada antes da fala para o personagem já estar posicionado. |
| `characterScale` | Multiplicador, 1. Base de 140% da altura da tela, limitada a 92% da largura após remover margens transparentes para preservar a cabeça no vertical. |
| `headAnchor` | Centro da cabeça dentro do retângulo visível do PNG, em coordenadas 0–1; padrão `{ "x": 0.5, "y": 0.3 }`. Esse ponto fica no centro exato da espiral. |
| `sway` | Amplitude de balanço em graus, 0,65. Use 0 para desativar. |
| `maxWords` | Palavras por bloco de legenda, 5, de 1 a 8. |
| `captionColor` | Cor das letras, `#FFFFFF`. |
| `highlightColors` | Lista de cores dos blocos ativos; padrão azul, vermelho e preto. |
| `words` | Palavras com `word` ou `text`, `start` e `end` em segundos. Use a transcrição existente. |
| `transcriptOffset` | Tempo absoluto da transcrição que corresponde ao início desta cena, em segundos. Padrão 0. |
| `captions` | Alternativa a words: formato Caption do Remotion, com tempos relativos à cena em milissegundos. |

O tamanho leva em conta somente a parte visível do PNG, não as margens transparentes. A âncora é ajustável porque cada personagem tem proporções diferentes; o código não detecta rostos. Para o personagem pensativo de referência, o padrão alinha os olhos ao centro e deixa a cintura próxima/abaixo da borda inferior. Não há correção de chroma: forneça PNG com transparência real.

## Sincronização precisa

Não se estima o tempo dividindo uma frase por igual. Copie o trecho de `transcript.words` para `props.words`, preservando os timestamps. Por exemplo: cena começa no segundo 30 da narração; palavra Herói vai de 30,85 a 31,4. Passe `transcriptOffset: 30` e essa palavra será destacada de 0,85 a 1,4 nesta cena. Palavras fora da janela são ignoradas; palavras que cruzam a borda são limitadas à cena. A transcrição não é refeita nem modificada.

Se o áudio tiver sido cortado/deslocado depois da transcrição, ajuste primeiro os tempos para a narração final. O componente não carrega transcript.json automaticamente pelo nome: o plano/IA precisa passar as palavras. Sem words/captions, aparece personagem e fundo sem legenda. Não passe as duas formas ao mesmo tempo.

Formato alternativo:

```json
{"captions": [{"text": "Herói", "startMs": 850, "endMs": 1400, "timestampMs": null, "confidence": null}]}
```

Cada item é uma palavra. `captions` já usa tempos relativos, então transcriptOffset não é aplicado nessa forma. Os tempos devem ser finitos, ordenados e sem sobreposição. Na forma captions, `pageBreakAfter: true` força o fim de um bloco. Uma pausa maior que 0,6 s também separa blocos. Durante pausas, nenhuma palavra recebe destaque. O bloco some ao terminar sua última palavra.

## Áudio e uso

O TSX não contém áudio nem solicita outro arquivo além de PNG/fonte. Narração e eventuais sons ficam no edit_plan.json. Se quiser whoosh na entrada, centralize no movimento e use volume abaixo da voz. Não foi acrescentada música. O exemplo é ilustrativo, não altera o projeto nem os Shorts existentes.

## Conferência local

O componente compilou no Content Lab e gerou imagens nos dois fundos e nas duas orientações. Também foram conferidos quadros em 0 / 0,3 / 1,03 / 3,53 / 4,97 segundos para verificar entrada por baixo, mudança do destaque e permanência do personagem até o fim. As prévias PNG estão nesta pasta; não foi renderizado vídeo completo nem validada uma mixagem de narração. Os tempos do exemplo são demonstrativos.

## Camadas, orientação e limites

Ordem: espiral pixelada, halftone/vinheta do fundo, personagem e, por cima, legenda. O rosto indicado por headAnchor fica no centro do fundo; a entrada desloca temporariamente esse ponto e o balanço final gira em torno dele. A identificação do personagem é apenas visual: qualquer PNG transparente pode ser usado, mas a posição anatômica da cabeça precisa ser ajustada manualmente se as proporções forem diferentes.

Em 16:9, o recorte da cintura segue a referência grande. Em 9:16, a largura é limitada para a cabeça não escapar pelas laterais; isso pode mostrar mais do corpo. characterScale aumenta além dessa base e exige conferir o recorte. Os dois fundos giram continuamente em sentidos diferentes; não há propriedade para cor, velocidade ou intensidade de pixelado. Não aplicar filtro de TV sobre todo o personagem/legenda. Não há vídeo verde, chroma, detecção de rosto ou leitura automática de transcript.json dentro deste TSX.

Os blocos alternam por quantidade de palavras ou pausa, não por uma análise semântica do roteiro. Uma palavra futura do bloco já fica legível sem destaque; somente a palavra no intervalo start/end recebe o bloco colorido. As cores alternam pela posição dentro de cada bloco, sem alterar a letra branca por padrão.

## Referências visuais atuais







A referência atual é a de curvas suavizadas com giro, não a versão anterior de ondulação exagerada. Os fundos são recriações procedurais; não dependem dos vídeos de Downloads.

## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.


## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Word = {word?: string; text?: string; start: number; end: number};
type Props = {fontFamily?: HQFont;
  assets?: {character?: string; bangers?: string; anton?: string};
  backgroundVariant?: 'espiral' | 'crescente';
  captions?: Caption[]; words?: Word[]; transcriptOffset?: number;
  entryDuration?: number; entryDelay?: number; characterScale?: number;
  headAnchor?: {x: number; y: number}; sway?: number; maxWords?: number;
  captionColor?: string; highlightColors?: string[];
};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
type HQFont = 'Bangers' | 'Anton';
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/PersonagemEspiralLegenda.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)
