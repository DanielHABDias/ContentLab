# Montagens, enquadramentos e transições 2D

O catálogo retornado por `motion_kit` é a fonte de nomes, props, exemplos e eventos sonoros. As cenas abaixo usam imagens, vídeos e PNGs do projeto. Personagem significa o pacote fornecido pelo projeto, importado com `character_import`; não há personagem de marca embutido nessas composições.

O personagem troca o PNG inteiro em cortes secos. Não há articulação de membros, interpolação de desenho ou reconstrução 3D da obra. Movimento de mídia, máscara, texto ou câmera é independente da pose.

## Cenas

| Cena | Comportamento |
| --- | --- |
| `montagemEncaixe` | Recortes diagonais com bordas de tinta e contorno azul ou vermelho entram em sequência; o último cresce até tela cheia e o contorno desaparece na ampliação. |
| `enquadramentoAlternado` | Cortes secos alternam imagens ou vídeos alinhados, com rótulo e foco configurável por fonte. |
| `detalheContexto` | Começa ampliado em um ponto da imagem e abre até mostrar a imagem inteira; círculo preserva a referência. |
| `faixasSequenciais` | Até três fontes dividem a tela; a faixa ativa expande e toca, enquanto as outras congelam e escurecem. |
| `fotogramasMudanca` | Três imagens congeladas entram sobrepostas e deslocadas; a última preenche o quadro. |
| `anotacaoCena` | Vídeo pausa em um frame escolhido, recebe marca localizada e retoma do mesmo frame. |
| `retornoImagem` | Intercala uma lembrança breve em tela cheia; a fonte atual pausa durante o retorno e continua depois. |
| `palavraRecortada` | Palavra grande entra entre a obra de fundo e um recorte PNG transparente, sem modificar a figura. |
| `personagemPrimeiroPlano` | PNG grande de um lado e obra do outro, separados por divisória inclinada; troca de poses a cada 0,8 s. |
| `personagemReacao` | O personagem entra e sai por corte, depois do acontecimento; troca de PNG no meio da reação. |
| `personagemAlternado` | Personagem em destaque, corte para obra em tela cheia, retorno em outra posição e pose. Sem transição de corpo. |
| `legendaVirada` | Mesma mídia, expressão curta com palavra riscada e substituída no instante da virada. |
| `divisaoResolvida` | Duas fontes em tela dividida; a divisória se desloca até a escolhida preencher o quadro. |

## Fontes e tempos

Cada fonte é `{ midia: "media:<id>", inicio?, titulo?, fonte?, foco?, zoom?, deslocamento? }`. `inicio` é em segundos da mídia. `foco` segue `object-position`; `deslocamento: { x,y }` move a mídia por frações da largura/altura do quadro dela, com zero no alinhamento original. Combinar zoom, foco e deslocamento na comparação; o alinhamento depende de ajuste editorial, sem reconhecimento automático.

As fontes ficam mudas. `anotacaoCena` congela o vídeo e retoma do mesmo frame, mas não pausa a narração. `retornoImagem` também pausa a fonte atual enquanto a lembrança aparece. `faixasSequenciais` mantém as faixas futuras no primeiro frame e as passadas no último exibido. `fotogramasMudanca` usa somente o primeiro frame do `inicio` de cada fonte, mesmo quando a mídia é vídeo.

As coordenadas de `detalheContexto` são frações da imagem fonte inteira em contain; as de `anotacaoCena` são frações do quadro já recortado. Ajustar a marca e o enquadramento separadamente para horizontal e vertical. Conferir o ponto no frame de pausa; não reutilizar automaticamente a mesma posição de tela em duas proporções.

`personagemPrimeiroPlano` e `personagemAlternado` trocam poses a cada 0,8 s. `personagemReacao` tem entrada por corte, uma troca no meio do intervalo e saída por corte. Não alterar ou desenhar expressões no aplicativo. A ausência de personagem não gera um substituto: importar o pacote antes de planejar essas cenas.

`narrativeEvents(scene, props, duration, fps)` gera os eventos reais em segundos; gravar sua saída em `sfx` do beat. As frações de `som.eventos` no catálogo são os exemplos de 4 segundos e devem acompanhar a duração/props reais. As funções em `src/motion/kit/narrative/editorial/timing.js` compartilham os instantes de congelamento, lembrança e reação entre implementação e revisão.

## Continuidade

Ao continuar uma mídia em outro beat, somar ao `inicio` somente o tempo efetivamente reproduzido, descontando os intervalos de pausa. Para fontes que começaram dentro do beat, descontar também o tempo antes da ativação. Cada composição pode reenquadrar a mídia; conferir o corte visual além da continuidade temporal. Cenas com áudio original seguem o mecanismo próprio de pausa da narração, e não essas pausas visuais.

Conferir entrada, transição e saída em 16:9 e 9:16. Textos e rosto do personagem devem permanecer na área útil, sem comprometer a ação. Usar recorte PNG com transparência real em `palavraRecortada`; essa cena não remove fundo nem busca mídia.
