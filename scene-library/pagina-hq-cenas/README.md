# Página HQ com cenas — padrão aprovado

## Movimento e contrato de execução

Intervalos por painel são preparados quando focus/enter mudam. Expansão conclui no último frame exibido; curva de câmera tem acomodação suave. A geometria e o crop aprovado foram preservados: não há troca automática para FLIP que altere o enquadramento. CRT continua dentro da mídia e a continuidade da próxima cena depende do sourceStart correto.

Instalação manual: copiar **PaginaHQCenas.tsx** e **HQComicPage.tsx, HQMotion.tsx** para a mesma pasta custom-scenes. A Galeria prepara esses arquivos automaticamente, sem sobrescrever versões diferentes. Auxiliares idênticos são compartilhados uma única vez no projeto. Todos os sons continuam no plano; não há áudio automático. Anton sem sombra/contorno; Bangers mantém acabamento HQ.

**Layouts atuais:** grid (padrão, quatro quadros), asymmetric (dois painéis assimétricos, adaptação do Panels), split (dois lados, adaptação do Split Choice) e parallax (dois a quatro quadros em profundidade). As regras antigas de quatro quadros abaixo se referem ao modo grid; asymmetric/split exigem exatamente dois painéis.

## Parallax — camadas em profundidade

Use `panelLayout: "parallax"` para apresentar versões, consequências ou etapas com imagens/clipes sobrepostos. É a adaptação HQ da técnica `MotionDesignToolkit/parallax_25d`, no mesmo TSX da Página HQ. Não precisa de outro módulo nem de dependência nova.

Aceita **2 a 4 panels**, numerados a partir de 1 na ordem da lista. O quadro focado ocupa o centro e fica colorido; os outros aparecem menores, inclinados e com mídia escurecida/cinza. Ao trocar o foco, os deslocamentos e as mudanças de escala simulam profundidade 2,5D. O fundo e o cabeçalho não viajam junto com os quadros. A página mantém sua oscilação discreta; não há cenário 3D real, separação automática de objetos da imagem ou necessidade de recortes em camadas do mesmo arquivo. Os quadros laterais podem ficar parcialmente fora da tela deliberadamente; o foco central permanece visível nos dois formatos.

| Controle | Comportamento |
| --- | --- |
| `parallaxDuration` | Segundos para mover o foco de um quadro ao próximo; padrão 0,65. Deve ser positiva e caber na cena. Cada intervalo de focus deve durar pelo menos esse tempo. Só usada/validada em parallax. |
| `focus` | Lista ordenável de `{panel, at, until}` sem sobreposição; permite avançar, voltar e saltar quadros. A câmera mantém o último destino entre os intervalos, mas todos os clipes pausam/escurecem quando não há foco. |
| `panels[].at`, `entryDuration` | Entrada inicial de cada quadro: padrão at = índice × 0,55 e duração 0,55 s. Programe as entradas antes da fala que exige vê-los. |
| `panels[].mediaType`, `asset`, `fit`, `sourceStart`, `crt` | Mesmas regras de imagens/vídeos dos outros layouts. Vídeos mudos, tocando apenas no foco e expansão, sem loop automático. |
| `heading`, `headingColor`, `accentColor` | Cabeçalho opcional, cor do texto e bordas do foco. Cada painel pode sobrescrever accentColor/backgroundColor. |
| `enter` | Expande qualquer quadro para tela cheia, removendo inclinação, bordas, outros quadros e cabeçalho. A câmera deixa de visitar os próximos focos após enter.at. |

`focus.at` é o **começo** do movimento. Para o enquadramento estar pronto numa palavra da narração, antecipe-o em parallaxDuration. Antes do primeiro foco a câmera começa no quadro 1; com focus vazio/sem enter, os quadros ficam coloridos e a pilha é estática, além da oscilação. Não há saída geral automática; não confundir os quadros parcialmente ocultos com arquivos que serão removidos da timeline.

O fundo aceita os estilos compartilhados e backgroundOpacity 0–100; a transparência afeta só o fundo, não a mídia e as caixas. Para ver uma cena externa atrás, use mode overlay e desenhe essa cena no plano. Anton continua sem sombra tipográfica; sombras das caixas são normais. CRT atua só na mídia do painel, não em etiquetas/cabeçalho.

Exemplo de cena de 10 s · Horizontal · Vertical · Validação.

Copie os SVGs escudo/balanca/raio de exemplos-assets para assets/paineis do projeto, ou substitua seus caminhos por mídia real. O exemplo visita os quadros 1 (0–3 s), 2 (3–6 s), 3 (6–8 s) e expande o 3 em 8–9 s, mantendo-o até 10 s. Para uma versão em vídeo com sourceStart 2 no terceiro quadro, a próxima cena começa no segundo 6 do arquivo (2 + 4 s reproduzidos entre 6 e 10). A emenda deve manter arquivo, recorte, efeito e FPS; não reiniciar a mídia.

Não inclui áudio automático nem música. Os exemplos/prévias desta adaptação são visuais, sem SFX. Se adicionar whoosh, use um por deslocamento, baixo em relação à voz e centrado em start + focus.at + parallaxDuration/2. A expansão tem seu próprio centro: start + enter.at + enter.duration/2. Confira o centro audível após aparar silêncio; não sonorize cada quadro pausado. Ajustar a duração da cena não realinha os tempos internos automaticamente.

## Split Choice — dois caminhos

Use `panelLayout: "split"` para comparar escolhas, versões ou rumos de uma história. Reaproveita este mesmo TSX, sem módulo adicional. Em 16:9 os painéis têm o mesmo tamanho e ficam lado a lado; em 9:16 ficam acima/abaixo para preservar a área das imagens. A resolução da composição determina o formato automaticamente.

| Parâmetro | Uso |
| --- | --- |
| `splitColors` | Duas cores `#RRGGBB`, na ordem dos painéis. Padrão vermelho `#D92F45` e azul `#2459C9`. |
| `dividerColor` | Cor `#RRGGBB` do divisor, padrão `#111723`. |
| `panels[].at` | Início da entrada em segundos relativos; padrão 0 e 0,55. |
| `entryDuration` | Duração de cada entrada, padrão 0,55 s. Deve caber na cena. |
| `heading`, `headingColor` | Cabeçalho opcional e sua cor. Escolher contraste com os dois lados. |

O primeiro painel desliza da esquerda e o segundo da direita no horizontal; no vertical entram de cima e de baixo. Cada metade colorida acompanha sua entrada e tem retícula HQ. Após a última entrada, o divisor é desenhado em 0,35 s; reserve esse tempo se quiser vê-lo completo. O fundo base continua configurável, mas fica coberto pelas metades coloridas após as entradas. `backgroundOpacity` controla o fundo base e as metades/divisor, não os painéis/textos; 0 permite conteúdo externo atrás.

`panels[].mediaType` aceita image/video; `fit` aceita contain/cover; `accentColor` e `backgroundColor` por painel continuam válidos. `focus: []` sem `enter` mostra as duas imagens coloridas e estáticas. Para reproduzir vídeos, programe `focus`. A expansão `enter` continua disponível: fundo dividido/divisor desaparecem e o quadro preenche a tela; siga as regras de continuidade abaixo. Clipes são mudos, sem repetição automática.

Exemplo de cena · Prévia 16:9 · Prévia 9:16 · Validação.

O exemplo dura 7 s e usa os SVGs de `exemplos-assets/`: copie-os para `assets/paineis/` do seu projeto ou substitua as referências. Os dois whooshes do JSON são baixos (-28 dB de ganho) e seus centros coincidem com o meio de cada entrada: 0,275 s e 1,025 s. O TSX não gera som; ao alterar `at`/`entryDuration`, reposicione os SFX. Não há som obrigatório para o divisor.

Quatro quadros retangulares sobre um fundo halftone, em 9:16 ou 16:9 conforme a resolução do Content Lab. A página tem oscilação muito leve. O quadro destacado fica colorido e reproduz seu vídeo; ao perder o destaque, o vídeo **pausa no último ponto e escurece em preto e branco**. Quando o destaque volta, ele continua de onde parou. Não é um vídeo rodando escondido durante os outros quadros.

Os quatro espaços são numerados em ordem de leitura: **1 superior esquerdo, 2 superior direito, 3 inferior esquerdo, 4 inferior direito**. No horizontal eles são largos; no vertical, mais altos, sempre com recorte central e sem esticar a imagem.

## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Padrão: Bangers. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. Quando houver etiquetas, declare a fonte selecionada. Sem etiquetas, o componente dispensa fonte. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

## Arquivos e uso

- Copiar `PaginaHQCenas.tsx` para `custom-scenes/` do projeto.
- Usar `customComponent.mode: "replace"`.
- `exemplo-cena.json` contém uma **cena**, não um plano completo. Acrescentá-la à timeline de um plano válido com narração e transcrição, quando aplicável.
- Os caminhos de clipes do exemplo são ilustrativos dos arquivos locais disponíveis no projeto. Em outro projeto, informar os clipes reais daquela produção no mapa `customComponent.assets`.
- Os sons ficam nos elementos `sfx` do JSON; o TSX deixa todos os clipes mudos para preservar a narração. Não adiciona música.

## Atributos

| Campo | Função |
| --- | --- |
| `backgroundColor` | Cor hexadecimal do fundo halftone. Padrão `#E8C64F`. |
| `accentColor` | Cor da borda do quadro em destaque. Padrão azul `#2676E8`, independente do fundo. |
| `panels` | Exatamente quatro objetos em grid ou dois em asymmetric, um por espaço. |
| `panels[].asset` | Nome da chave no mapa `customComponent.assets`, como `clip1`. |
| `panels[].sourceStart` | Tempo inicial do vídeo de origem, em segundos. Padrão 0. |
| `panels[].label` | Etiqueta opcional em Bangers. Omitir para deixar só os vídeos. |
| `panels[].crt` | `true` aplica televisão apenas ao vídeo daquele quadro. Usar em filmes/animações quando solicitado; deixar `false` nos jogos. |
| `focus` | Intervalos de destaque. Cada objeto tem `panel` (1 a 4 em grid, 1 a 2 em asymmetric), `at` e `until`. |
| `enter` | Opcional: `{panel, at, duration}` para entrar em um quadro até preencher a tela. Duração padrão 1,1 s. |
| `assets.bangers` | Fonte selecionada, necessária somente quando houver etiquetas. Bangers: builtin://fonts/Bangers-Regular.ttf; Anton: assets.anton com builtin://fonts/Anton-Regular.ttf. |

`focus.at/until` e `enter.at` são **segundos relativos ao início desta cena**. Já `timeline.start/end` e os `at` dos SFX são absolutos na edição. Os destaques não podem se sobrepor; podem voltar a um quadro já mostrado. Nos intervalos sem destaque, todos ficam pausados. Os clipes precisam ter duração suficiente para `sourceStart + tempo total em destaque`; o componente não repete clipes automaticamente.

## Controles de cenas, duração e cores

- **Qual vídeo aparece em cada espaço:** alterar `panels[].asset` e o caminho correspondente em `customComponent.assets`.
- **Qual trecho do arquivo é mostrado:** alterar `panels[].sourceStart`.
- **Quanto tempo cada quadro reproduz:** definir `focus[].at` e `focus[].until`. A duração desse destaque é `until - at`; os quatro quadros podem ter durações diferentes e aparecer em qualquer ordem. Por exemplo, `{ "panel": 2, "at": 3, "until": 8 }` mostra o quadro 2 por cinco segundos.
- **Duração total da página:** definir `timeline[].start/end`, mantendo os intervalos relativos de foco dentro dessa duração.
- **Qual quadro expande:** escolher `enter.panel`. O quarto é somente a escolha do exemplo; pode ser qualquer um dos quatro. `enter.at` define quando começa e `enter.duration` controla a velocidade da expansão.
- **Cor do fundo:** `backgroundColor`. **Cor do selecionado:** `accentColor`. São parâmetros separados; trocar um não modifica o outro. O exemplo usa fundo amarelo `#E8C64F` e destaque azul `#2676E8` para diferenciá-los. Preferir cores que contrastem entre si.

Os parâmetros ficam em `customComponent.props`, com exceção da duração total, dos caminhos de assets e dos eventos sonoros. Ao mudar os tempos de foco ou de expansão, realinhar também os SFX da cena.

A mudança de cor leva aproximadamente 0,24 s. A troca preserva os dois momentos: o quadro anterior para e escurece, o novo começa a tocar e recupera as cores.

## Entrar no quadro e continuar na próxima cena

Ao alcançar `enter.at`, o quadro escolhido assume o destaque e continua tocando. Ele cresce até ocupar toda a tela; os outros quadros, a etiqueta, a borda e a oscilação desaparecem progressivamente. Ao terminar a expansão, a imagem fica plana e preenche exatamente a resolução final, com `cover` central.

**A próxima cena é independente.** Para o corte ficar invisível, ela deve usar o mesmo arquivo, recorte central, cor e efeito CRT, começando no ponto exato em que este TSX termina. Usar `transitionOut: "cut"`, sem fade ou whoosh extra na emenda. Não reiniciar o clipe do zero.

O tempo inicial da próxima cena é:

`sourceStart do quadro + soma de todos os segundos em que ele reproduziu nesta página`.

Depois de `enter.at`, somente o quadro escolhido continua reproduzindo até o fim desta cena, mesmo que outros destaques tenham sido programados. Não contar duas vezes intervalos contíguos ou sobrepostos desse mesmo quadro.

No exemplo de 9 s, o quadro 4 começa no segundo **4,5** do arquivo e fica ativo de **5,6 a 9 s** da página. Portanto a próxima cena deve começar em **7,9 s** do vídeo de origem. A expansão ocorre de 7,1 a 8,3 s, e o clipe continua até 9 s. O último frame é o imediatamente anterior a 7,9 s na grade de FPS; o primeiro frame seguinte é 7,9 s. Escolher uma passagem sem corte ou salto de câmera do próprio arquivo exatamente nesse ponto facilita perceber a continuidade.

Se a próxima composição não oferecer seleção de tempo inicial, preparar um recorte do arquivo ou usar um componente independente que aceite esse tempo. O zoom da página, sozinho, não cria nem configura a próxima cena.

Omitir `enter` mantém a página com quatro quadros até o fim. O movimento e o fluxo deste padrão foram aprovados; os clipes e as etiquetas do exemplo são substituíveis em cada produção.

## Prévias locais

`previa-16x9.mp4` e `previa-9x16.mp4` mostram **9 s desta página e mais 1 s de outra composição independente**, iniciada no segundo 7,9 do clipe. Esse segundo final serve para avaliar a emenda; não aumenta a duração do exemplo JSON e não faz parte da implementação da página. As prévias são visuais, sem mixagem de áudio. As imagens `previa-*.png` mostram a grade; as imagens com sufixo `-tela-cheia.png` mostram a expansão concluída.

## Sons de movimento do exemplo

Os quatro whooshes de troca têm duração de 0,24 s e volume de -26 dB; seus centros audíveis devem coincidir com o meio da mudança visual de 0,24 s. O whoosh da expansão dura 0,24 s e usa -25 dB, centralizado no meio do movimento de 1,2 s. Os `at` do exemplo consideram o começo audível do som depois do trim de silêncio do Content Lab. Recalcular esses eventos ao trocar os tempos e conferir a sincronização na prévia com áudio.

Esses valores são trimDb de ganho, não loudness final medido. Sem o sfx no JSON, não haverá whoosh: o componente visual não o produz. Se a troca incluir um intervalo sem foco, conferir também o momento efetivo em que o quadro recupera as cores para não antecipar o som.

## Camadas e limites

O TSX desenha fundo halftone, quadros/vídeos, CRT opcional dentro de cada vídeo e etiquetas por cima. A oscilação e as bordas desaparecem na expansão; a etiqueta também some. Não aplicar CRT novamente na composição inteira. O fundo e o destaque têm cores separadas. Os vídeos usam cover central por padrão, podendo recortar bordas no vertical; fit contain preserva o quadro completo. Não há controle de reposicionamento do recorte por personagem.

No modo grid os quatro panels são obrigatórios, mesmo quando um deles nunca ganha foco; no asymmetric são obrigatórios dois. focus é uma lista, inclusive vazia; intervalos devem ser ordenáveis, não negativos, dentro da cena, com until maior que at e sem sobreposição. enter deve terminar dentro da cena; após enter.at, o painel escolhido assume o restante da reprodução. Não há grade variável, quantidade livre de painéis, áudio original dos clipes, repetição automática ou animação geral de saída. Para quantidade livre, use LinhaDoTempoHQ. Defaults de sourceStart e crt são 0 e false.

## Referências visuais

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

## Dois painéis assimétricos — adaptação do Panels (item 04)

O mesmo PaginaHQCenas agora aceita `panelLayout: "asymmetric"`: um painel dominante e um secundário, inclinados levemente, entrando por baixo em tempos separados. No 16:9 ficam lado a lado; no 9:16, o dominante fica acima e o secundário abaixo/deslocado. É um layout próprio por orientação, não o horizontal esticado. Sem novo TSX duplicado. Omitir panelLayout preserva a grade de quatro quadros.

### Parâmetros adicionais e mídia

| Campo | Regra / padrão |
| --- | --- |
| panelLayout | grid (padrão, exatamente 4 panels) ou asymmetric (exatamente 2). |
| heading | Cabeçalho opcional, até 80 caracteres, em maiúsculas. Só aparece em asymmetric. Some ao expandir um painel para tela cheia. |
| headingColor | #RRGGBB; padrão #111723, escolha contraste com o fundo. |
| entryDuration | 0.55 s; duração de cada entrada em asymmetric, positiva e precisa caber na cena. Grid mantém sua entrada fixa de 0.38 s. |
| panels[].at | Início da entrada em segundos relativos à cena; só asymmetric. Padrões 0 e 0.55 s. Pode ser igual nos dois para entrada simultânea. |
| panels[].mediaType | video (padrão, preserva planos antigos) ou image. Não há detecção pela extensão: declare image para PNG/JPG/SVG. Vale nos dois layouts. |
| panels[].fit | cover (padrão) ou contain. Cover preenche/recorta; contain preserva toda a imagem e pode deixar áreas vazias: papel claro por padrão em asymmetric, escuro na grade original. |
| panels[].backgroundColor | #RRGGBB opcional do fundo interno em asymmetric; padrão #F5EFDE. Útil para PNG transparente ou letterbox em contain. Ignorado em grid. |
| panels[].accentColor | #RRGGBB opcional da borda ativa em asymmetric; herda accentColor global. Em grid, a borda mantém a cor global anterior. |

FontFamily Anton/Bangers e assets seguem o contrato existente. É necessário fornecer a fonte selecionada quando houver etiquetas ou cabeçalho. Sem ambos, nenhuma fonte é necessária. Paths de imagens/clipes/fontes ficam em customComponent.assets, não dentro de props. Cada painel informa a chave asset desse mapa. Anton sem sombra/contorno; a aparência original das etiquetas foi preservada.

Os limites de focus e enter acompanham a quantidade do layout: 1–2 no asymmetric, 1–4 no grid. sourceStart, crt e label permanecem disponíveis. sourceStart não tem efeito visual em imagens estáticas. CRT fica somente na mídia do quadro, nunca no cabeçalho/etiqueta. Não há reprodução de áudio dos clipes: continuam mudos. Não há posições, rotações e proporções livres por painel: o layout garante a composição responsiva.

### Mostrar junto ou alternar o foco

- Em asymmetric com focus vazio e sem enter, os dois painéis ficam coloridos. Imagens permanecem estáticas; vídeos ficam congelados no sourceStart até receber intervalo de foco. Não pressupor reprodução simultânea automática.
- Com focus, reutiliza o comportamento da Página HQ: somente o quadro destacado avança e recupera a cor, os outros pausam/escurecem. Configure entradas para chegarem antes de citar os elementos na narração. A disponibilidade da mídia não altera automaticamente os tempos da narração.
- enter permite expandir um dos dois para tela cheia. A inclinação, borda, sombra e movimento do painel desaparecem ao concluir a expansão. O cabeçalho também desaparece.
- Em overlay com backgroundOpacity 0, a base comum aparece fora dos painéis; não fica transparente o conteúdo dentro deles. Em replace, opacidade não recupera a base removida.

### Exemplos e áudio

exemplo-dois-paineis.json: duas imagens, cena de 7 s, entradas 0–0.55 e 0.75–1.30 s. Copie escudo.svg e balanca.svg de exemplos-assets para assets/paineis do projeto, ou substitua os caminhos. São ilustrações neutras, não assets obrigatórios do padrão. O exemplo tem whooshes de 0.24 s, preset subtle, trimDb -28, em 0.155 e 0.905 s: seus centros coincidem com os meios das entradas. Ao mover a cena, some start absoluto aos disparos.

exemplo-dois-videos.json: dois vídeos externos, cena de 9 s, troca de foco em 3.6 s e expansão do painel 2 de 7.4 até 8.0 s. Os MP4s não estão incluídos: forneça cena_a.mp4 e cena_b.mp4 ou substitua os caminhos. sourceStart do segundo é 1 s. Seu playback avança de 3.6 a 7.4 (3.8 s) e de 7.4 a 9.0 (1.6 s); a continuação externa começa em **6.4 s do arquivo**, não 1 nem 7.4. Garantir que a mídia tenha duração suficiente. Não há loop automático.

Esses JSONs são cenas, não planos completos. O TSX não toca SFX, música ou narração. Sons adicionais em troca/expansão dependem da direção e devem ficar no JSON, centralizados no movimento; não são inferidos ao inserir o componente. As prévias de Studio do TSX isolado são silenciosas.

### Prévias

Primeira proposta de adaptação do item 04; aguardando avaliação visual. São testes isolados, não render de produção. Nenhum arquivo antigo do Content Lab ou projeto VD/SH foi substituído.

Resultados da validação dos painéis.

## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Panel = {asset: string; label?: string; sourceStart?: number; crt?: boolean; mediaType?:'video'|'image'; fit?:'cover'|'contain'; at?:number; accentColor?:string; backgroundColor?:string};
type Focus = {panel: number; at: number; until: number};
type Entry = {panel: number; at: number; duration?: number};
type Props = HQBackgroundOptions & {fontFamily?: HQFont;
  panels: Panel[];
  focus: Focus[];
  enter?: Entry;
  backgroundColor?: string;
  accentColor?: string;
  panelLayout?: 'grid'|'asymmetric'|'split'|'parallax';
  parallaxDuration?:number;
  splitColors?: [string,string];
  dividerColor?:string;
  heading?:string;
  headingColor?:string;
  entryDuration?:number;
  assets?: Record<string, string>;
};
type Interval = {at: number; until: number};
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

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/PaginaHQCenas.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)
- [exemplo-dois-paineis.json](exemplo-dois-paineis.json)
- [exemplo-dois-videos.json](exemplo-dois-videos.json)
- [exemplo-parallax.json](exemplo-parallax.json)
- [exemplo-split-choice.json](exemplo-split-choice.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
