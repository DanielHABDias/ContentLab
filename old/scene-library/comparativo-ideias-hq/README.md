# Comparativo de ideias HQ — 2 a 4 imagens

## Movimento e contrato de execução

A imagem parte logo além da borda mais próxima de sua posição real, inclusive para PNGs estreitos, em vez de percorrer uma tela extra. O texto só revela após a chegada. Bounds de imagens são reutilizados pelo auxiliar HQMotion. Título superior permanece opcional e vazio por padrão.

Instalação manual: copiar **ComparativoIdeiasHQ.tsx** e **HQComicPage.tsx, HQMotion.tsx** para a mesma pasta custom-scenes. A Galeria prepara esses arquivos automaticamente, sem sobrescrever versões diferentes. Auxiliares idênticos são compartilhados uma única vez no projeto. Todos os sons continuam no plano; não há áudio automático. Anton sem sombra/contorno; Bangers mantém acabamento HQ.

Padrão reutilizável para composição HQ. Compara duas, três ou quatro ideias, cada uma com uma imagem e um texto associado. Fundo halftone de cor configurável; Bangers em maiúsculas com sombra escura. Sem painéis decorativos, balões, partículas ou vídeos embutidos.

## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Padrão: Bangers. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. Declare apenas a fonte selecionada. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

## O que acontece

1. O fundo fica visível desde o início. Os exemplos e referências atuais não usam título superior, conforme solicitado pelo criador.
2. Cada imagem entra deslizando pela lateral/canto mais próximo de sua posição final. As imagens podem entrar em sequência ou simultaneamente.
3. **Só depois que a imagem termina de entrar**, o texto dela aparece com uma revelação curta de opacidade e leve assentamento vertical. O texto não viaja junto da imagem.
4. Os itens permanecem na tela até o fim. Não há animação de saída ou troca de foco automática.

As imagens são ajustadas por contain, sem distorcer nem cortar o conteúdo visível. Margens transparentes de PNG são desconsideradas no enquadramento para não deixar o personagem minúsculo. JPG e imagens opacas mantêm a área inteira. Não faz chroma nem remove fundos opacos. PNG/SVG transparente é recomendado para personagens/elementos recortados.

## Composição responsiva

| Itens | 16:9 | 9:16 |
| --- | --- | --- |
| 2 | Duas colunas: esquerda e direita; entram pelas laterais. | Duas linhas: superior e inferior; entram por cima e por baixo. |
| 3 | Três colunas: esquerda entra da esquerda, centro por cima, direita da direita. | Um item central em cima, dois embaixo; entram por cima e pelos cantos inferiores. |
| 4 | Grade 2×2; entradas pelos quatro cantos. | Grade 2×2; entradas pelos quatro cantos. |

A ordem de items segue a ordem de leitura. A orientação vem de width/height do Content Lab; configure a resolução do projeto, não passe um prop de formato. Não é uma composição vertical esticada para o horizontal. No caso de entrada diagonal, os dois eixos se movem juntos a partir do canto correspondente. O texto fica sempre abaixo da imagem à qual pertence.

## Instalação e assets

Copie `ComparativoIdeiasHQ.tsx` para `custom-scenes/` do projeto de edição e use `customComponent.mode: "replace"`. Copie os auxiliares declarados no manifesto junto do componente. Precisa do runtime Remotion/React e @remotion/fonts do Content Lab, das imagens e da fonte Bangers.

Declare `customComponent.assets.bangers: "builtin://fonts/Bangers-Regular.ttf"`. Para cada item, crie uma chave no mesmo mapa, como `ideia1: "project://assets/ideias/imagem.png"`, e use `items[].asset: "ideia1"`. Não coloque o mapa assets dentro de props. Não é obrigatório usar as imagens dos exemplos nem personagens específicos.

## Parâmetros reais

| Prop | Função / padrão |
| --- | --- |
| `items` | Obrigatório: lista com exatamente 2, 3 ou 4 objetos. |
| `items[].asset` | Chave de imagem em customComponent.assets. |
| `items[].text` | Texto associado obrigatório; convertido em maiúsculas, medido com a fonte selecionada e ajustado para até três linhas. Preferir frases curtas. |
| `items[].at` | Início da entrada dessa imagem, em segundos relativos à cena. Opcional; substitui o horário automático somente desse item. |
| `title` | Título opcional no topo, vazio por padrão. Reserva área no layout quando informado. Não é animado. |
| `backgroundColor` | Fundo sólido com halftone por cima, padrão #D6AD42. |
| `textColor` | Cor de todos os textos, padrão #FFFFFF; sombra e contorno escuros fixos. |
| `startDelay` | Primeira entrada automática em 0,15 s. |
| `stagger` | Intervalo entre começos de entrada, 0,45 s. Use 0 para entrar simultaneamente. |
| `entryDuration` | Duração de cada deslizamento, 0,6 s. |
| `textDuration` | Duração da revelação do texto após chegar, 0,25 s. |
| `assets.bangers` / `assets.anton` | Declare a fonte escolhida em customComponent.assets. |

Cores #RRGGBB. A fonte pode ser Anton ou Bangers. Não há props para curva de entrada, saída, posições manuais ou cor por item. As posições se adaptam automaticamente à quantidade e ao formato. Textos muito longos ficam menores: o ajuste impede vazamento, mas não garante boa leitura de parágrafos extensos. Não aceita vídeos como items.

## Duração e sincronização

`timeline[].start/end` define a duração total. Para cada item i, a entrada automática começa em `startDelay + i × stagger`, com i começando em 0. Se houver at no item, esse valor prevalece. O texto só começa em `início da imagem + entryDuration` e termina em `início da imagem + entryDuration + textDuration`.

A cena precisa ter duração >= ao maior desses términos; o componente gera erro se faltar tempo. Deixe tempo adicional para leitura. No exemplo de quatro itens, começos em 0,15 / 0,60 / 1,05 / 1,50 s; chegadas em 0,75 / 1,20 / 1,65 / 2,10 s; textos prontos em 1,00 / 1,45 / 1,90 / 2,35 s. A cena de 6 s deixa o restante para observar o comparativo.

Para o texto já estar legível quando a narração disser a ideia, programe items[].at pelo menos entryDuration + textDuration antes da palavra-chave, usando transcript.words como referência. Não lê transcrição nem estima tempos a partir da frase automaticamente.

## Sons e camadas

O TSX é visual e não reproduz SFX, narração ou música. Os três exemplos JSON incluem um whoosh baixo por deslizamento: Whoosh curto 04.mp3, Whoosh 03.mp3 e Whoosh aéreo 03.mp3, em builtin://sfx/, com trecho 0,24 s, preset subtle e trimDb -28. Ganho não equivale a loudness final medido; conferir com a voz real.

Para centralizar o som no deslizamento: `sfx.at = início absoluto da cena + início relativo da imagem + entryDuration / 2 - duração do som / 2`. No exemplo, 0,33 / 0,78 / 1,23 / 1,68 s. Se mudar at/stagger/entryDuration ou start da cena, atualizar também os eventos sfx. Conferir o ataque audível após trim de silêncio do Content Lab. Não há som obrigatório para a revelação do texto; não adicionar teclado, pois a animação não é escrita letra por letra.

Camadas: fundo sólido, halftone, imagens e textos associados. Não há CRT automático, filtro sobre a tela inteira, balanço de personagem, zoom de câmera ou imagem de fundo externa. Se quiser uma comparação de vídeos com reprodução/foco, use PaginaHQCenas; este padrão compara imagens estáticas.

## Exemplos e referências

`exemplo-2-ideias.json`, `exemplo-3-ideias.json` e `exemplo-4-ideias.json` são cenas, não planos completos. Os quatro SVG de `exemplos-assets/` são apenas ilustrações genéricas criadas para demonstração. Para usar os JSON sem trocar caminhos, copie esses SVG para `assets/ideias/` do projeto. Não são obrigatórios no runtime de outros projetos.

As outras imagens com sufixos 2 e 3 mostram as duas contagens restantes. A aprovação deste novo padrão ainda depende da conferência do criador; não declarar a nova composição aprovada por ter compilado.

## Conferência técnica desta versão

Compilado no Content Lab local e geradas imagens de 2, 3 e 4 itens em 960×540 e 540×960, a 30 fps. Conferidos também quadros antes e depois de a primeira imagem terminar de entrar. Testados 12 layouts (duas orientações × três quantidades × com/sem título), sem sobreposição de regiões, e rejeição de quantidades fora de 2–4. Os três exemplos JSON foram lidos e os caminhos dos SFX conferidos; seus assets ilustrativos estão incluídos nesta subpasta. Preview interativo aberto localmente para inspeção. Não houve render final de vídeo nem teste de mixagem com narração real.

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

- exemplo-2-ideias.json
- exemplo-3-ideias.json
- exemplo-4-ideias.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.

## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Item = {asset: string; text: string; at?: number};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; items: Item[]; title?: string; backgroundColor?: string; textColor?: string;
  startDelay?: number; stagger?: number; entryDuration?: number; textDuration?: number; assets?: Record<string, string>};
type Slot = {x: number; y: number; width: number; height: number; fromX: number; fromY: number};
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

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/ComparativoIdeiasHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-2-ideias.json](exemplo-2-ideias.json)
- [exemplo-3-ideias.json](exemplo-3-ideias.json)
- [exemplo-4-ideias.json](exemplo-4-ideias.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
