# Quadro HQ sobre a cena

## Movimento e contrato de execução

compactAt: segundos até começar a redução horizontal (padrão 2); compactDuration: segundos da redução (padrão 0.65); compactScale: escala final, 0.2–1 (padrão 0.58). Não reduzem no vertical. Texto principal é medido com a fonte para caber. Entradas continuam em 0.08–0.48 e 0.20–0.50 s; canto inferior esquerdo e retícula transparente são preservados.

Instalação manual: copiar **QuadroHQSobreCena.tsx** e **HQComicPage.tsx, HQMotion.tsx** para a mesma pasta custom-scenes. A Galeria prepara esses arquivos automaticamente, sem sobrescrever versões diferentes. Auxiliares idênticos são compartilhados uma única vez no projeto. Todos os sons continuam no plano; não há áudio automático. Anton sem sombra/contorno; Bangers mantém acabamento HQ.

Padrão **9:16 e 16:9** baseado no quadro aprovado mostrado pelo criador: uma cena continua visível atrás de uma moldura clara; na parte inferior, uma etiqueta colorida pequena fica encostada em um retângulo claro com a frase principal. A etiqueta também é repetida discretamente no canto superior esquerdo, como na referência. Na camada mais baixa do TSX há **halftone transparente sobre o clipe**, abaixo da moldura e dos textos. O componente não escolhe nem corta a mídia de fundo e não aplica efeito de televisão por conta própria.

## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Omitido: Anton na frase principal/etiqueta superior e Bangers no bloquinho. Informado: aplica a fonte escolhida a todos os textos. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. No modo misto, declare ambas as fontes. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

## O que pode mudar

| Item | Como mudar | Exemplo |
| --- | --- | --- |
| Duração | Ajustar `timeline[].start` e `timeline[].end` no `edit_plan.json`. A entrada gráfica dura cerca de 0,5 s; deixar tempo suficiente para leitura. | `start: 4`, `end: 8` |
| Texto da etiqueta | `customComponent.props.upperText`. Aparece no bloquinho acima do texto principal e, em tamanho pequeno, no canto superior esquerdo. | `A TESE` |
| Frase principal | `customComponent.props.lowerText`. Aparece no retângulo claro inferior, em Anton escuro. | `UM DIA RUIM?` |
| Cor da etiqueta | `customComponent.props.tagColor`, hexadecimal `#RRGGBB`. O texto da etiqueta muda automaticamente entre claro e escuro para manter o contraste. Padrão `#5CA5AD`. | `#F4C542` |

Moldura, papel claro e movimento de entrada são fixos; a compactação horizontal é configurável. A fonte é selecionável; veja a tabela de fontes abaixo. A disposição responde automaticamente à resolução do Content Lab: em 9:16, o bloco ocupa a base da tela; em 16:9, vira uma caixa na parte inferior esquerda, com 65% da largura. Bordas e letras se ajustam à dimensão menor da tela. Configure `project.resolution` como `1080 × 1920` ou `1920 × 1080`; não há parâmetro extra de orientação.

As duas caixas entram **abrindo da esquerda para a direita**: a caixa principal abre entre `T + 0.08` e `T + 0.48 s`; a etiqueta colorida abre entre `T + 0.20` e `T + 0.50 s`. O texto aparece junto da abertura sem ser espremido ou mudar de posição. A duração total continua definida por `start/end` da cena.

**Somente no horizontal 16:9:** após completar a abertura em `T + 0.50 s`, as caixas mantêm o tamanho inicial por **1,5 s**. Entre `T + 2.00` e `T + 2.65 s`, diminuem suavemente até **58% do tamanho inicial**. As duas caixas encolhem juntas, com o canto inferior esquerdo fixo nas margens de 5%. A largura visível passa de 65% para cerca de 38% da tela, liberando a cena de fundo. Depois permanecem pequenas até o fim. Em cenas que terminem antes disso, a animação só é exibida até o ponto alcançado. O formato vertical mantém seu comportamento anterior.

A prévia `previa-16x9.mp4` mostra a abertura, o tempo de leitura e a redução; `previa-16x9-entrada.png` mostra o tamanho inicial e `previa-16x9.png` mostra o estado compacto.

## Arquivo e recursos

- Componente: `QuadroHQSobreCena.tsx` (export default `QuadroHQSobreCena`).
- Copiar para `custom-scenes/QuadroHQSobreCena.tsx` dentro do projeto local.
- Usar `customComponent.mode: "overlay"` para que a cena normal do Content Lab continue **atrás** do TSX.
- Fontes no modo misto padrão: `builtin://fonts/Anton-Regular.ttf` e `builtin://fonts/Bangers-Regular.ttf`. Com `fontFamily` explícito, basta a fonte escolhida.
- O vídeo ou imagem de fundo é definido em `timeline[].elements` ou `timeline[].background`, **não** em `customComponent.assets`.
- Para filmes e animações, adicionar `crt_tv` como camada/filtro da cena base quando desejado. O efeito fica atrás da moldura e dos textos; não deve cobri-los. Para jogos, aplicar somente se a direção daquela cena pedir.
- Este padrão **não possui SFX fixo**. Se houver transição ou movimento na mídia de fundo, sincronizar o som correspondente na cena do plano, sem presumir um whoosh obrigatório para a etiqueta.

## Exemplo de cena no `edit_plan.json`

Os tempos são **absolutos** na timeline. O clipe e as fontes devem existir no projeto; adapte o caminho do clipe à obra que estiver sendo mostrada. O vídeo é centralizado e recortado para o formato 9:16 sem esticar a imagem.

```json
{
  "id": "quadro_hq_sobre_cena",
  "start": 4,
  "end": 8,
  "layout": "fullscreen",
  "background": {
    "asset": "project://assets/cenas/minha_cena.mp4",
    "fit": "cover",
    "muted": true
  },
  "elements": [
    {
      "id": "crt_no_clipe",
      "type": "filter",
      "style": "crt_tv",
      "start": 4,
      "end": 8,
      "z": 0,
      "config": {"scanlineOpacity": 0.23, "vignette": 0.38}
    }
  ],
  "customComponent": {
    "module": "project://custom-scenes/QuadroHQSobreCena.tsx",
    "mode": "overlay",
    "props": {
      "upperText": "A TESE",
      "lowerText": "UM DIA RUIM?",
      "tagColor": "#5CA5AD"
    },
    "assets": {
      "anton": "builtin://fonts/Anton-Regular.ttf",
      "bangers": "builtin://fonts/Bangers-Regular.ttf"
    }
  },
  "transitionOut": "cut"
}
```

Verifique a prévia no início, meio e fim da cena: a moldura e os textos precisam ficar nítidos e por cima do clipe; o clipe e seu filtro permanecem atrás. Não copie um clipe específico da referência como parte obrigatória deste padrão.

## Camadas, saída e limites

Ordem visual: mídia e seus filtros na cena base; por cima, halftone transparente do TSX; depois moldura e etiqueta discreta superior; por último as duas caixas inferiores com sombra. Não há vídeo, imagem ou áudio embutido. A cor da etiqueta é livre, mas a cor do papel e a cor da frase principal são fixas; não existem props para trocar essas cores, canto ou tempos das entradas; a compactação horizontal aceita compactAt/compactDuration/compactScale; a fonte é selecionável. Para uma caixinha nos quatro cantos, usar CaixinhaHQ, não inventar corner neste componente.

O texto é sempre maiúsculo. A frase principal usa Anton; a etiqueta inferior usa Bangers e a repetição discreta superior usa Anton. O tamanho da frase depende do comprimento e pode quebrar linha, mas não é um ajustador de parágrafos ilimitados: prefira uma frase curta que caiba na base. Não há saída animada; termina com a cena. No vertical não há redução posterior; no horizontal a redução usa compactAt + compactDuration (defaults totalizam 2,65 s).

## Referências visuais

As duas orientações têm imagens e MP4 de teste visual local; não são uma validação de mixagem de áudio. O visual de base e os ajustes de abertura/redução foram definidos com o criador.

## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.

## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Props = HQComicPageOptions & {fontFamily?: HQFont;
  compactAt?:number;compactDuration?:number;compactScale?:number;
  upperText: string;
  lowerText: string;
  tagColor?: string;
  assets?: {anton?: string; bangers?: string};
};
type HQFont = 'Bangers' | 'Anton';
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/QuadroHQSobreCena.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
