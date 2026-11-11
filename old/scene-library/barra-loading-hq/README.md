# Barra Loading HQ

## Movimento e contrato de execução

Pontos/cores são preparados quando as props mudam. Pausas e progresso linear permanecem. Um ponto explicitamente no fim da cena é atingido no último frame exibido, sem criar tempos duplicados nem dividir por zero.

Instalação manual: copiar **BarraLoadingHQ.tsx** e **HQComicPage.tsx** para a mesma pasta custom-scenes. A Galeria prepara esses arquivos automaticamente, sem sobrescrever versões diferentes. Auxiliares idênticos são compartilhados uma única vez no projeto. Todos os sons continuam no plano; não há áudio automático. Anton sem sombra/contorno; Bangers mantém acabamento HQ.

## Funcionamento e tempo

A duração total é `end - start` da cena no edit plan. Os tempos abaixo são **segundos relativos ao começo dessa cena**, não ao vídeo inteiro. Use `customComponent.mode: "overlay"`, mantendo os vídeos/textos nos elementos normais da cena.

`points` define quanto está preenchido em cada momento. `value` vai de 0 a 100. Repetir o mesmo valor em dois tempos cria uma pausa exata. Ao chegar ao último ponto, mantém o valor até terminar a cena. Antes do primeiro ponto, mantém seu valor inicial. Sem `points`, a barra vai de 0 a 100 linearmente durante toda a cena, chegando a 100 no último quadro.

Exemplo: 0% em 0s → 30% em 2s → mantém 30% até 3.5s → 70% em 6s → mantém até 7s → 100% em 9.5s → permanece cheia até 10s. Não há limite fixo de pontos nem pausas. O progresso não retrocede.

`colors` tem relógio independente: de 0 a 4s azul; de 4 a 7s transição gradual azul→vermelho; depois vermelho. O preenchimento inteiro muda de cor, passando pelos tons intermediários, não deixa uma faixa azul antiga atrás. Para manter a cor por mais tempo, repita-a em outro ponto. Pode usar quantas cores desejar. A mudança pode ocorrer durante uma pausa do progresso. Uma só cor mantém o preenchimento sempre igual.

## Parâmetros completos

| Campo | Padrão / significado |
| --- | --- |
| `points` | Opcional; sem ele, preenchimento linear da duração inteira. |
| `points[].at` | Tempo em segundos; crescente, não repetido, de 0 à duração da cena. |
| `points[].value` | Percentual 0–100; crescente ou igual ao anterior para pausa. |
| `points[].easing` | `linear` (padrão) ou `smooth`: acelera/desacelera suavemente **o trecho que termina neste ponto**. |
| `colors` | Opcional; padrão azul #2689FF. |
| `colors[].at` | Tempo crescente, não repetido, dentro da cena. |
| `colors[].color` | Cor #RRGGBB atingida nesse instante; interpolada desde a cor anterior. |
| `position` | `bottom` (padrão), `top` ou `center`. |
| `width` | Largura em % da tela; padrão 86, permitido 5–96. |
| `height` | Altura em % do **menor lado** da tela; padrão 6, permitido 1–20. Preserva a proporção visual nos dois formatos. |
| `margin` | Distância vertical da borda até a barra, em % da altura; padrão 7, permitido 1–35. Ignorada em center ou quando y é informado. |
| `x`, `y` | Centro da barra em % da largura/altura. x padrão 50; y calculado por position/margin. Não pode recortar a barra nem a sombra fora da tela. |
| `trackColor` | Fundo da parte vazia, padrão #FFF3D6. |
| `outlineColor` | Contorno e sombra, padrão #101018. |
| `texture` | true por padrão: retícula e hachuras do preenchimento. False remove essas duas texturas; mantém reflexos. |
| `opacity` | Opacidade do conjunto, 0–1; padrão 1. |

Para barra fina de acompanhamento do Short, experimente `height: 2.5`, `width: 90`, `margin: 5`, sem points. Para explicar uma ideia, use height maior e pausas em points. Ajuste margin/y para não cobrir legendas e controles da plataforma.

## Instalação e composição

Copie `BarraLoadingHQ.tsx` para `custom-scenes/` do projeto; use o JSON de exemplo como trecho de timeline. O fundo azul do exemplo é apenas demonstrativo: o componente em si é transparente. Não exige `assets`, músicas ou sons. Não toca áudio automaticamente; por padrão é silencioso para acompanhar a fala. Caso queira pontuar uma conclusão, coloque um som discreto no edit plan exatamente no instante do ponto de 100%, não no início da animação.

Para usar junto de outro TSX, o aplicativo precisa permitir compor esses componentes; este arquivo não modifica o mecanismo de múltiplos TSX. Ele exporta um componente React que também pode ser importado por uma composição customizada. O modo overlay permite usá-lo sobre a cena comum sem precisar combinar dois TSX.

Prévias: `previa-16x9.png`, `previa-9x16.png`, `previa-azul.png`, `previa-gradiente.png`. Representam frames de testes locais, não um vídeo final exportado. A animação é determinística por quadro, inclusive ao saltar para outro momento da timeline.

## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.

## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type ProgressPoint = {at:number; value:number; easing?:'linear'|'smooth'};
type ColorPoint = {at:number; color:string};
type Props = HQComicPageOptions & {points?:ProgressPoint[]; colors?:ColorPoint[]; position?:'top'|'bottom'|'center';
  width?:number; height?:number; margin?:number; x?:number; y?:number;
  trackColor?:string; outlineColor?:string; texture?:boolean; opacity?:number};
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/BarraLoadingHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
