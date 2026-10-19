# Texto HQ

Texto de destaque em Anton ou Bangers, com frase única ou sequência de palavras/frases substituindo umas às outras. É o antigo padrão de texto Bangers/halftone, agora renomeado porque fonte e fundo são selecionáveis. Copie **TextoHQ.tsx** para custom-scenes e use module `project://custom-scenes/TextoHQ.tsx`. As props antigas de frase única continuam válidas, mas o nome do arquivo/module mudou.

## Fontes e assets

`fontFamily: "Bangers"` (padrão) ou `"Anton"`. Declare em customComponent.assets a fonte realmente usada:
- `bangers: "builtin://fonts/Bangers-Regular.ttf"`
- `anton: "builtin://fonts/Anton-Regular.ttf"`

Pode declarar apenas a fonte escolhida; se alternar fontes entre textos, declare ambas. Não há fallback silencioso: falta de asset gera erro claro. A medição e a quebra de linhas usam a fonte selecionada. O componente é independente e usa React, Remotion e @remotion/fonts já existentes.

## Dois modos

**Frase única:** passe `text`. Ocupa a duração total da cena, definida por end - start. Pode aparecer inteira, ser digitada letra a letra, abrir do centro para fora ou usar a entrada kinetic descrita abaixo. Exemplo completo em exemplo-frase.json.

**Sequência:** passe `texts`, sem passar text simultaneamente. Cada item tem `text`, `at` (início relativo à cena em segundos) e `duration` (segundos). Os intervalos são ordenados, não podem se sobrepor e precisam caber na cena. Uma palavra/frase substitui a anterior: não acumula nem sobrepõe. Intervalos vazios mostram só o fundo global, sem texto. Depois do último item não o mantém automaticamente: estenda sua duration se desejar.

Não divide a frase em tempos iguais nem deduz timestamps. Para sincronismo, obtenha at/duration de transcript.words ou do guia. Sem animação, o texto aparece no primeiro quadro correspondente a at. Com animação, antecipe at para a palavra já estar visível quando for dita. Em cenas de 30 fps, uma mudança em 1.2 s ocorre no quadro 36, sem atraso extra.

## Propriedades do texto

As seguintes props podem ser globais ou sobrescritas por item de texts. Cada item herda as globais; não herda as alterações do item anterior.

| Prop | Padrão / unidade / regra |
| --- | --- |
| fontFamily | Bangers ou Anton; padrão Bangers. |
| textColor | #RRGGBB; padrão #FFFFFF. Agora a cor da letra é configurável. |
| textScale | 0.2–1; padrão 1 = maior tamanho calculado que cabe na área segura. 0.5 = metade desse tamanho. Não são pixels. A palavra fica centralizada mesmo menor. |
| entryAnimation | escrita (padrão), abrir, kinetic, none ou null. none/null: corte seco no texto. escrita: revela letras mantendo o layout estável. abrir: revelação central para os lados. kinetic: letras com deslocamento, rotação e pequeno impulso de escala, em cascata. |
| entryDuration | Segundos de entrada; se fornecido, positivo e precisa caber junto de delay/saída. Ignorado visualmente se entrada none. |
| writeDuration | Legado, padrão 1.8 s; usado como duração desejada quando entryDuration não é informado, limitado automaticamente ao tempo disponível. |
| entryDelay | Segundos desde at antes de aparecer. Na sequência, padrão 0; na frase única animada, até 0.12 s; com entrada none, padrão 0. |
| exitAnimation | none (padrão), null ou fechar. A saída fechar apaga do centro para fora, concluindo no último quadro do intervalo. Não anima o fundo. |
| exitDuration | Segundos de saída; padrão 0.5 quando fechar, mínimo um quadro e precisa caber no intervalo. |

A tipografia é sempre maiúscula e centralizada. **Bangers mantém sombra e contorno HQ; Anton é somente texto, sem sombra e sem contorno.** A fonte e a cor da letra são independentes do fundo. O texto se ajusta à área segura de 16:9 ou 9:16; não estica a composição entre formatos. Frases muito longas serão reduzidas, então prefira blocos legíveis.

## Kinetic Typography — entrada cartunesca

Adaptação da técnica antiga `MotionDesignToolkit/kinetic_typography`, integrada ao mesmo TextoHQ. Use `entryAnimation: "kinetic"` em frases de impacto, aberturas e mudanças de ideia. As letras chegam em cascata, com deslocamento curto, inclinação e impulso suave de escala; ficam estáveis ao concluir a entrada. Não é uma câmera percorrendo palavras nem legenda automática. Fundos, transparência, fontes e sequência de frases continuam disponíveis.

| Prop global ou por item de texts | Padrão / efeito |
| --- | --- |
| `kineticDirection` | `up` (sobe de baixo), `down` (desce de cima), `left` (vem da direita) ou `right` (vem da esquerda). Nome indica a direção do movimento, não a borda de origem. |
| `kineticStagger` | 0,035 s entre letras; aceita 0–0,15 s. Zero faz todas entrarem juntas. Em textos longos, o intervalo é comprimido para toda a entrada caber em entryDuration. |
| `kineticAccentColor` | Cor opcional #RRGGBB para cada quinto caractere, começando pelo primeiro. Sem este parâmetro, todas as letras usam textColor. Espaços contam na sequência; não é marcação semântica de palavras. |

`entryDuration` inclui a cascata e a acomodação da última letra, não a duração por letra. `entryDelay` atrasa toda a entrada. Para o texto estar pronto na palavra falada, programe `at + entryDelay + entryDuration` até esse instante. A duração total pertence ao start/end da cena; na sequência, cada duration também precisa comportar entrada, espera e saída. O ajuste de fonte reserva espaço extra no modo kinetic para os movimentos e sombras, sem alterar o tamanho dos modos anteriores. Quebras explícitas com `\n` são aceitas.

`exitAnimation` continua none/null ou fechar. O modo kinetic não acrescenta saída automática, som, música, efeito CRT ou movimento contínuo após acomodar. `kinetic*` só é validado/usado quando a entrada daquele texto é kinetic. Anton continua sem contorno/sombra mesmo quando há movimento e cor de destaque.

Exemplo de cena de 6 s · Prévia horizontal · Prévia vertical · Validação.

O exemplo alterna duas frases e duas direções; usa apenas a fonte Bangers da instalação. É um trecho para inserir em timeline válida, não um edit_plan completo. As prévias são visuais e não incluem áudio. Se desejar som, use um whoosh baixo por entrada (não um por letra), centralizado aproximadamente em `start + at + entryDelay + entryDuration / 2`; confira o centro audível após aparar silêncio. Digitação é apropriada à animação escrita, não é necessária neste modo.

## Backgrounds por texto ou globais

| Prop | Padrão / uso |
| --- | --- |
| backgroundStyle | halftone, solid, stars, film, paper ou grid; padrão halftone. |
| backgroundColor | #2459C9; #RRGGBB; usado por halftone e solid. |
| backgroundOpacity | 0–100%, padrão 100. Afeta só o fundo, nunca letras/sombra/contorno. |
| paperTone | light (padrão) ou dark; só paper. |
| gridBackgroundColor | #10101A; só grid. |
| gridLineColor | #858595; só grid. |

Trocar uma backgroundColor em um item muda o fundo junto com aquela palavra, em corte seco, sem transição involuntária. Para cores lisas, use solid. Stars/film têm aparência fixa; paper usa poses em stop-motion e grid desliza continuamente à direita. Não há controle de velocidade; relógio do fundo acompanha a cena inteira, sem reiniciar a cada palavra. Mais detalhes em BACKGROUNDS_HQ.md.

## Exemplo de props: palavras com contraste e tamanhos diferentes

```json
{
  "fontFamily": "Anton",
  "backgroundStyle": "solid",
  "entryAnimation": "none",
  "texts": [
    {"text":"NÃO","at":0,"duration":1.2,"backgroundColor":"#E63040","textColor":"#080A11","textScale":0.65},
    {"text":"BASTA","at":1.2,"duration":1.3,"backgroundColor":"#175AE8","textColor":"#FFFFFF","textScale":1},
    {"text":"UMA REGRA","at":2.5,"duration":1.5,"backgroundColor":"#F4C542","textColor":"#080A11","textScale":0.8,"entryAnimation":"abrir","entryDuration":0.25}
  ]
}
```

Use exemplo-sequencia.json para uma cena completa, com module e asset Anton. A duração pertence à cena; a soma dos intervalos não amplia end automaticamente.

## Camadas, áudio e testes

Mode replace mostra só a composição; mode overlay preserva a cena comum abaixo. Para revelar essa cena, reduza backgroundOpacity; em replace, transparência não recupera uma base que não foi desenhada.

Não há áudio automático. Quando usar escrita, configure o som de digitação baixo no JSON somente durante [start + at + entryDelay, início + entryDuration], cortando no fim da animação. Abrir/fechar podem ter whoosh discreto centralizado em seu próprio movimento; none não exige whoosh por palavra. Não refiz mixagem nem narração.

Prévias principais mostram frase Bangers. Os PNGs previa-anton e previa-sequencia da primeira implementação são históricos, anteriores à remoção do acabamento da Anton. A referência atual é o exemplo abaixo. Os MP4s antigos com outros nomes também são históricos. Novas combinações de texto/cores precisam de revisão de legibilidade.

## Exemplo Anton limpo: NÃO PODE FALTAR ATITUDE

Teste solicitado em 16/10/2026, com cortes secos e uma palavra por vez:

| Palavra | Intervalo relativo | Letra | Fundo | Escala |
| --- | --- | --- | --- | --- |
| NÃO | 0–1.4 s | Vermelho #E63040 | Branco #FFFFFF | 1 |
| PODE | 1.4–2.8 s | Branco #FFFFFF | Azul #175AE8 | 0.5 |
| FALTAR | 2.8–4.2 s | Preto #080A11 | Amarelo #F4C542 | 0.8 |
| ATITUDE | 4.2–5.6 s | Branco #FFFFFF | Vermelho #E63040 | 1 |

Todos em Anton, sem sombra/contorno, fundo solid sem halftone. O tamanho relativo se refere ao maior tamanho que cabe na tela para cada palavra. Os arquivos exemplo-anton-16x9.mp4 e exemplo-anton-9x16.mp4 mostram o movimento; exemplo-anton-palavra-por-palavra.json contém a cena pronta. Os PNGs anton-limpo-* são frames de referência. Este é somente o teste da cena, não uma renderização de produção do canal. Não há áudio ou música no exemplo.


## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-anton-palavra-por-palavra.json
- exemplo-frase.json
- exemplo-sequencia.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.


## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Entrance='abrir'|'escrita'|'kinetic'|'none'|null;
type Exit='fechar'|'none'|null;
type TextStyle=HQBackgroundOptions & {fontFamily?:HQFont;textColor?:string;textScale?:number;
  kineticDirection?:'up'|'down'|'left'|'right';kineticStagger?:number;kineticAccentColor?:string;
  entryAnimation?:Entrance;exitAnimation?:Exit;entryDuration?:number;exitDuration?:number;entryDelay?:number;writeDuration?:number};
type TextStep=TextStyle & {text:string;at:number;duration:number};
type Props=TextStyle & {text?:string;texts?:TextStep[];assets?:{bangers?:string;anton?:string}};
type PreparedStep=TextStep & {fontFamily:HQFont;textColor:string;textScale:number;entryAnimation:Entrance;exitAnimation:Exit;
  entryDuration:number;exitDuration:number;entryDelay:number};
type Layout={lines:string[];fontSize:number};
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

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/TextoHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-anton-palavra-por-palavra.json](exemplo-anton-palavra-por-palavra.json)
- [exemplo-frase.json](exemplo-frase.json)
- [exemplo-kinetic.json](exemplo-kinetic.json)
- [exemplo-sequencia.json](exemplo-sequencia.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
