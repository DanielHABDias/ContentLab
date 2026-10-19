# Caixinha HQ

Sobreposição transparente em Bangers maiúscula, com sombra nas letras, borda e sombra sólida de quadrinho. Halftone maior dentro da caixa; não afeta a cena atrás. Ícones são vetoriais no próprio TSX, sem arquivos externos. Funciona em 16:9 e 9:16.


## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Padrão: Bangers. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. Declare apenas a fonte selecionada. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

PNGs `previa-anton-*` antigos podem mostrar sombras anteriores à correção; são históricos. A referência atual de Anton está no Texto HQ, exemplo `anton-limpo`. Consulte FONTES_HQ.md.

## Presets

| `preset` | Texto padrão | Caixa / letra | Ícone |
| --- | --- | --- | --- |
| `inscricao` | INSCREVA-SE | Vermelha / branca | YouTube |
| `like` | DEIXE O LIKE | Azul / branca | Joinha azul sobre disco branco para contrastar |
| `sininho` | ATIVE O SININHO | Amarela / preta | Sino |
| `produto` | INDICAÇÃO DE PRODUTO | Branca / preta | Seta para baixo |
| `instagram` | SIGA NO INSTAGRAM (adicione o @ com `instagramHandle`) | Degradê amarelo/laranja/rosa/roxo/azul / branca | Instagram branco vetorial |
| `livre` | SEU TEXTO AQUI | Branca / preta, configuráveis | Nenhum |

Todos permitem substituir `text`, `boxColor`, `textColor` e `icon`. O modo livre não exige ícone. Textos longos quebram em até duas linhas e diminuem automaticamente; prefira chamadas curtas.

No Instagram, omitir `boxColor` preserva o degradê característico. Se informar uma cor #RRGGBB, ela substitui o degradê por fundo sólido, sem afetar os outros presets. **Use `instagramHandle` para o @ do perfil**, por exemplo `"@SeuPerfil"` ou `"SeuPerfil"`; o componente acrescenta um único `@` e exibe `SIGA NO INSTAGRAM @SEUPERFIL`. Se a prop for omitida, conserva `SIGA NO INSTAGRAM`, evitando alterar vídeos anteriores. `text` continua substituindo toda a frase e tem precedência sobre `instagramHandle`. O nome admite letras, dígitos, ponto e _ (até 30 caracteres). O ícone é desenhado no próprio TSX.

## Parâmetros

| Campo | Uso / padrão |
| --- | --- |
| `corner` | `superior-esquerdo`, `superior-direito`, `inferior-esquerdo`, `inferior-direito` ou `centro`. Padrão inferior-direito. |
| `animation` | Entrada: `lateral`, `vertical` ou `pop`. Padrão lateral. |
| `exitAnimation` | Saída: mesmas três opções. Se omitido, usa a mesma da entrada. |
| `at` | Segundo relativo à cena em que começa a entrar; padrão 0. |
| `holdDuration` | Tempo totalmente visível, sem contar entrada/saída; padrão 5 segundos. |
| `animationDuration` | Duração de cada movimento; padrão 0,4 s. Mínimo 2 frames. |
| `action` | Ação durante a leitura: auto / clique / sininho / pulo / none. Padrão auto: inscrição, like e instagram clicam, sininho treme, produto pula; livre não faz ação. |
| `actionAt` | Centro da ação, em segundos relativos à cena. Padrão: at + animationDuration + holdDuration / 2. |
| `actionDuration` | Duração da ação; padrão 0,45 s, limitado ao tempo de leitura disponível. Mínimo 2 frames. |
| `preset` | inscricao / like / sininho / produto / instagram / livre. Padrão inscricao. |
| `text` | Texto livre que substitui toda a frase do preset; sempre maiúsculo. Tem precedência sobre `instagramHandle`. |
| `instagramHandle` | Somente no preset `instagram`: @ opcional do perfil, com ou sem `@` inicial. Não fornecido: mantém `SIGA NO INSTAGRAM`; ex.: `"@SeuPerfil"`. |
| `boxColor` / `textColor` | Cores #RRGGBB. Se omitidas, usa as cores do preset. |
| `icon` | youtube / like / sininho / seta / instagram / none. |
| `assets.bangers` | Fonte padrão: builtin://fonts/Bangers-Regular.ttf; para Anton use assets.anton. |

Lateral: na direita, entra da direita para a esquerda e sai para a direita; na esquerda, faz o inverso. Vertical: em cima entra descendo e sai subindo; embaixo entra subindo e sai descendo. No centro, lateral entra pela esquerda e sai pela direita; vertical entra por baixo e sai por cima. Pop: cresce de zero, passa levemente do tamanho final e acomoda; na saída encolhe até desaparecer. No centro, o pop usa o centro da caixa como âncora.

A ação interna é independente dessas entradas/saídas e não altera a duração total. Clique: a caixa diminui até 88% exatamente em actionAt e volta ao normal. Sininho: a caixa treme rapidamente e para. Produto: dá um pulo vertical e pousa, com ponto mais alto em actionAt. A ação inteira precisa caber entre o fim da entrada e o início da saída. Use action none para desativar. A escala/rotação da ação usa o centro da caixa, sem mudar seu canto ancorado.

## Duração e instalação

Copie `CaixinhaHQ.tsx` para custom-scenes/ do projeto e use `customComponent.mode: "overlay"` para manter os vídeos e elementos já existentes atrás. Os exemplos usam uma cor neutra apenas para demonstração; preserve o background/clipe real e seus outros elementos ao inserir a caixa numa cena pronta. Não substitua a edição pela cena de exemplo inteira sem necessidade.

A duração total continua em `timeline[].start/end`. A caixa precisa caber dentro dela: `at + animationDuration + holdDuration + animationDuration`. No padrão, termina em 5,8 s e permanece totalmente visível por 5 s. Se quiser 5 s contando animações, use holdDuration 4,2. Se a cena durar mais, a caixa desaparece no tempo calculado e o restante continua normal. Tempos insuficientes geram erro claro, não um corte involuntário da saída.

## Sons: usar os elementos do JSON

O TSX é visual: o áudio fica nos elementos sfx do plano para ser mixado pelo Content Lab com a narração. Não há áudio oculto ou dependência de URLs. Os exemplos originais de presets incluem efeitos de entrada e saída com duração 0,24 s e trimDb -28. Inscrição, like e sininho incluem também o efeito da ação interna descrito abaixo. Há sete JSONs nesta pasta; o exemplo centro-livre é intencionalmente silencioso. O TSX não exige SFX para funcionar.

- Lateral/vertical: builtin://sfx/Whoosh curto 04.mp3.
- Pop: builtin://sfx/Pop 01.mp3.

Para cada movimento: `at do som = start absoluto da cena + início relativo do movimento + animationDuration / 2 - duração do som / 2`. Com start 0, entrada 0,4 s e hold 5 s, os sons começam em 0,08 e 5,48 s. Se mudar at/hold/duração/animação, ajuste os dois sfx também; se exitAnimation for diferente, o som da saída acompanha esse tipo. O Content Lab prepara os arquivos; confira o pico audível no movimento caso use outro som.

Os nomes dos arquivos são importantes: Pop 01.mp3 e Whoosh curto 04.mp3 já existem nos assets padrão locais. Não duplique os efeitos caso a cena já os tenha. O preset não altera o áudio do vídeo nem o volume da narração.

### Som da ação interna

Nos exemplos, actionAt = 2,9 s e actionDuration = 0,45 s. Inscrição/like/instagram incluem Clique 01.mp3 com início exatamente em 2,9 s, no ponto de pressão máxima. Para sincronizar outro momento, configure o at absoluto do sfx como `start da cena + actionAt`. Sininho inclui Notificação sino.mp3 acompanhando a tremida de 2,675 até 3,125 s: início = `start da cena + actionAt - actionDuration / 2`. Os efeitos estão baixos (-28 dB de ajuste), separados dos whooshes/pop de entrada e saída.

Produto pula mesmo sem áudio: o exemplo não adiciona som à ação. Se quiser, adicione um sfx opcional no começo do salto ou no pouso (`start + actionAt + actionDuration / 2`). Remover o áudio não desativa a animação. O TSX não insere sons automaticamente: mantenha/ajuste os elementos do JSON ao configurar a ação. Para sons substitutos, ajuste eventual silêncio/ataque para o clique audível cair no ponto marcado.

## Exemplos

`exemplo-cena.json`: inscrição lateral. `exemplo-like-pop.json`: like com pop. `exemplo-sininho-vertical.json`: sino entrando por cima. `exemplo-produto.json`: produto na esquerda. `exemplo-livre.json`: texto personalizado em caixa roxa.

`exemplo-instagram.json`: preset pedindo para seguir `@SeuPerfil` via `instagramHandle`, degradê padrão, entrada/saída lateral com whoosh baixo e clique no meio. Funciona nos quatro cantos e com lateral/vertical/pop. A ação auto agora diminui até 88% e volta ao normal, como inscrição/like. O exemplo inclui o som no instante de pressão máxima. actionAt continua configurável; ajustar também o at do som ao mudar esse instante. action none desativa a animação; nesse caso remover também o sfx de clique.

## Conferência local

Cinco exemplos JSON validados pelo Content Lab, incluindo caminhos da fonte e sons. TSX compilado e imagens dos quatro presets nos quatro cantos conferidas; modo livre conferido em vertical. Também gerados quadros do pop no início, no ressalto e no fim da saída. A imagem previa-16x9.png é uma montagem de quatro testes separados para comparar os presets; cada instância do componente desenha somente uma caixa. previa-9x16.png mostra o modo livre. Não foi renderizado vídeo final nem auditada a mixagem de áudio; os sons estão configurados nos exemplos JSON.

Atualização das ações internas: recompilados os presets e revalidados os cinco exemplos, incluindo sons de clique e sino. Conferidos quadros antes/durante/depois da pressão e do salto, além de diferentes inclinações da tremida. previa-clique-etapas.png compara tamanho normal, pressionado e normal novamente.

## Camadas e limites

O plano base não é alterado. O TSX desenha somente caixa, halftone interno, ícone e texto, com borda/sombra; o resto é transparente. Entrada/saída movem o conjunto pela posição escolhida. A ação interna transforma a caixa em torno do seu centro, sem trocar a posição. A localização é predefinida pelas margens ou pelo centro do layout: não existem x/y livres nem tamanho livre da caixa. A fonte pode ser Anton ou Bangers, conforme a seção de fontes. A cor do joinha é azul fixa sobre disco branco; alterar textColor não recolore o ícone.

Cada instância tem uma única aparição e uma única ação; o modo livre não tem ação por padrão, mas pode receber action clique/sininho/pulo. O nome da ação sininho aplica a tremida à caixa, não troca automaticamente o ícone do modo livre. As imagens com quatro presets são uma montagem de quatro instâncias separadas, não a saída de um preset que ativa todos de uma vez. Quando necessário, adaptar o planejamento de várias cenas, sem presumir que o campo preset aceita uma lista.

## Referências visuais







## Instagram — atualização de 16/10/2026





O degradê, o ícone e o texto são o sexto preset da caixinha existente, não um oitavo TSX. Permanecem o contorno, a sombra e o halftone interno do padrão. O PNG comparativo dos quatro presets anteriores continua válido e não inclui o novo Instagram.

Conferência local desta atualização: compilação e imagens em 960×540 e 540×960, substituição opcional por cor sólida e regressão visual do preset inscricao. Exemplo JSON lido corretamente e caminhos de fonte/sons conferidos. Não foi renderizado vídeo completo nem realizada nova escuta da mixagem.

## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json
- exemplo-centro-livre.json
- exemplo-instagram.json
- exemplo-like-pop.json
- exemplo-livre.json
- exemplo-produto.json
- exemplo-sininho-vertical.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.


## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Preset = 'inscricao' | 'like' | 'sininho' | 'produto' | 'instagram' | 'livre';
type Corner = 'superior-esquerdo' | 'superior-direito' | 'inferior-esquerdo' | 'inferior-direito' | 'centro';
type Animation = 'lateral' | 'vertical' | 'pop';
type IconName = 'youtube' | 'like' | 'sininho' | 'seta' | 'instagram' | 'none';
type Action = 'auto' | 'clique' | 'sininho' | 'pulo' | 'none';
type Props = {fontFamily?: HQFont; preset?: Preset; corner?: Corner; animation?: Animation; exitAnimation?: Animation;
  text?: string; instagramHandle?: string; boxColor?: string; textColor?: string; icon?: IconName;
  at?: number; holdDuration?: number; animationDuration?: number;
  action?: Action; actionAt?: number; actionDuration?: number; assets?: {bangers?: string; anton?: string}};
type HQFont = 'Bangers' | 'Anton';
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/CaixinhaHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)
- [exemplo-centro-livre.json](exemplo-centro-livre.json)
- [exemplo-instagram.json](exemplo-instagram.json)
- [exemplo-like-pop.json](exemplo-like-pop.json)
- [exemplo-livre.json](exemplo-livre.json)
- [exemplo-produto.json](exemplo-produto.json)
- [exemplo-sininho-vertical.json](exemplo-sininho-vertical.json)

### Regra de uso do Instagram

Para divulgar seu perfil, usar `preset: "instagram"` e `instagramHandle: "@SeuPerfil"` no `customComponent.props`. O @ pertence à prop, não ao ícone nem ao mapa `assets`. Não há arquivo gráfico de Instagram externo. Para outro criador, informar o @ dele; não é necessário editar o código. A frase `text` deve ser usada apenas quando se deseja trocar o convite inteiro.

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
