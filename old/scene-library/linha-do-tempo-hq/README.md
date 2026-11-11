# Linha do tempo HQ

## Movimento e contrato de execução

Revelação e descoloração ocupam no máximo 30% cada do hold curto, reservando um estado colorido legível. Expansão conclui no último frame exibido mesmo quando termina no limite da cena. Rótulos são medidos após carregar a fonte. Vídeos distantes da área de câmera não são montados; seeks continuam calculados pelo frame e sourceStart. Forward/reverse e a continuidade externa foram preservados.

Instalação manual: copiar **LinhaDoTempoHQ.tsx** e **HQComicPage.tsx, HQMotion.tsx** para a mesma pasta custom-scenes. A Galeria prepara esses arquivos automaticamente, sem sobrescrever versões diferentes. Auxiliares idênticos são compartilhados uma única vez no projeto. Todos os sons continuam no plano; não há áudio automático. Anton sem sombra/contorno; Bangers mantém acabamento HQ.

Padrão reutilizável: fundo halftone, linha com preenchimento de progresso, nós e quadros de vídeo. A câmera acompanha cada ponto suavemente. Antes de partir, o vídeo pausa e perde a cor em 0,24 s. O próximo quadro abre colorido. O último quadro visitado pode expandir até preencher a tela, sem moldura. Detecta automaticamente 16:9 e 9:16; Bangers em todas as etiquetas.

## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Padrão: Bangers. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. Declare apenas a fonte selecionada. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

## Instalação

Copie `LinhaDoTempoHQ.tsx` para `custom-scenes/` do projeto de edição. Use `exemplo-cena.json` como uma cena de `timeline` e ajuste os caminhos em `customComponent.assets`. Os clipes do exemplo não são obrigatórios: substitua-os pelos seus. Cada chave usada em `clips[].asset` deve existir no mapa de assets.

## Controles

| Parâmetro | Função / padrão |
| --- | --- |
| `clips` | Lista com um ou mais clipes, sem limite fixo; ordem espacial da esquerda para a direita. |
| `clips[].asset` | Chave do vídeo em `customComponent.assets`. |
| `clips[].title` | Texto livre abaixo do ponto: ano, título, número ou frase. Opcional. |
| `clips[].subtitle` | Segunda linha livre. Opcional. |
| `clips[].sourceStart` | Segundo inicial no arquivo de vídeo; padrão 0. |
| `clips[].hold` | Tempo parado neste ponto, incluindo entrada do quadro e descoloração; mínimo 0,35 s, padrão 2 s. |
| `clips[].crt` | Efeito de televisão apenas no vídeo; padrão false. |
| `direction` | `forward`: visita a lista do primeiro ao último, avançando para a direita. `reverse`: visita do último ao primeiro, recuando para a esquerda. Não inverta também a lista. |
| `backgroundColor` | Cor do fundo halftone, padrão `#E8C64F`. |
| `accentColor` | Cor dos quadros, nós e progresso, padrão `#2676E8`. |
| `textColor` | Cor do ano/título e da segunda linha, padrão `#FFFFFF`. Maiúsculas sem caixa de fundo; Bangers tem sombra escura, Anton não tem sombra/contorno. |
| `startDelay` | Espera antes do primeiro quadro; padrão 0,3 s. |
| `moveDuration` | Duração de cada deslocamento entre pontos; padrão 0,8 s. |
| `enterLast` | Expande o último clipe visitado; padrão true. Em reverse, é o primeiro item da lista. |
| `enterDuration` | Tempo da expansão final; padrão 1,05 s. |
| `assets.bangers` | Fonte padrão; ao escolher Anton, declare assets.anton em vez de assets.bangers. |

Cores usam `#RRGGBB`. Todos os tempos são em segundos relativos ao início desta cena. Use textos curtos nas etiquetas: elas quebram linha, mas não são cartelas de parágrafos.

Os dois textos compartilham `textColor`. A caixa alta é fixa; escolha a fonte com fontFamily. Bangers preserva a sombra; Anton não tem acabamento. O fundo halftone é controlado por `backgroundColor`, e a linha/progresso por `accentColor`, independentemente da cor dos textos.

## Duração e sincronização

Duração mínima da cena = `startDelay + soma(hold) + (quantidade - 1) × moveDuration + enterDuration` (some a expansão só se `enterLast = true`). O componente acusa erro se a cena for curta. Tempo extra mantém o último clipe tocando em tela cheia; sem expansão, mantém o último quadro pausado e colorido. Garanta que os vídeos tenham duração suficiente a partir de sourceStart.

No exemplo de 7 s, os quadros chegam em 0,30 / 2,45 / 4,60 s. A câmera desloca em 1,65–2,45 e 3,80–4,60 s. A expansão ocorre em 5,95–7,00 s. Estes tempos também servem no reverse porque os holds são iguais; com holds diferentes, recalcule conforme a ordem visitada.

Para que uma palavra já esteja legível ao ser narrada, programe a chegada pelo menos 0,30 s antes dela. O componente não lê transcrição nem altera seus timestamps.

## Continuação na próxima cena

Finalize com `transitionOut: "cut"`. Na próxima cena independente, use o mesmo vídeo, enquadramento central cover e CRT correspondente. O sourceStart da continuação é `sourceStart do último clipe visitado + duração total desta cena - chegada desse clipe`. Exemplo forward: `5 + 7 - 4,6 = 7,4 s`. Reverse: `0,1 + 7 - 4,6 = 2,5 s`. A expansão não reinicia a reprodução. Nenhum quadro, etiqueta ou halftone permanece sobre a imagem ao completar a entrada.

## Sons

Os vídeos deste TSX são mudos. Narração e sons são responsabilidade do plano, permitindo mixagem independente. O JSON inclui três whooshes baixos e variados, centralizados nos dois deslocamentos e na expansão. Ao mudar tempos, ajuste também os efeitos: `at = início do movimento + duração / 2 - duração do som / 2`. As prévias são testes visuais sem mixagem de áudio. Não há músicas adicionadas.

## Prévias e verificação

Renderizados no Content Lab local: três clipes, 7 segundos, 30 fps, em 960×540 e 540×960, nos dois sentidos. JSON e caminhos do exemplo validados; compilação e quatro renders concluídos. Conferidos visualmente o enquadramento horizontal/vertical e a expansão final horizontal. Arquivos `previa-16x9.mp4` e `previa-9x16.mp4` avançam; os de sufixo `-reverse.mp4` recuam. São prévias isoladas: não modificam projetos de edição existentes.

Atualização documental: os PNG principais foram refeitos com o código atual, incluindo branco configurável, maiúsculas e sombra fixa. Os MP4 permanecem anteriores ao ajuste tipográfico; servem para consultar o movimento, não a cor atual do texto.

## Camadas e limites

Fundo halftone e oscilação ficam atrás da linha, progresso, pontos, quadros e etiquetas. O CRT opcional pertence somente ao vídeo. Os textos não têm retângulo de fundo: fonte Anton/Bangers e cor são configuráveis; caixa alta é fixa. Anton não tem sombra/contorno. Cada título/subtítulo pode quebrar linha, mas não há autoajuste de tamanho para parágrafos; usar textos curtos. Os vídeos são recortados centralmente em cover e ficam mudos.

O sentido reverse inverte a ordem de visita, não a reprodução temporal do arquivo de vídeo: os vídeos continuam tocando para frente. Não há foco de retorno arbitrário no mesmo componente, curva de percurso editável, repetição de clipe curto ou garantia de desempenho para listas enormes. Não há limite fixo de itens, mas cada vídeo aumenta o trabalho de renderização. Para voltar várias vezes aos mesmos quatro quadros, use PaginaHQCenas.

## Referências visuais atuais

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
type Clip = {asset: string; title?: string; subtitle?: string; sourceStart?: number; hold?: number; crt?: boolean};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; clips: Clip[]; direction?: 'forward' | 'reverse'; backgroundColor?: string; accentColor?: string; textColor?: string;
  startDelay?: number; moveDuration?: number; enterDuration?: number; enterLast?: boolean; assets?: Record<string, string>};
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

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/LinhaDoTempoHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
