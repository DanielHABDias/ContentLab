# CTA de encerramento HQ — 16:9 e 9:16

Padrão com duas composições automáticas: **9:16**, baseado na CTA final aprovada do projeto, e **16:9**, com dois espaços de vídeo nas laterais e um espaço circular central para o canal. O Content Lab fornece largura e altura a partir de `project.resolution`; o TSX escolhe a composição apropriada, sem parâmetro adicional.

No vertical, mantém página de quadrinho, faixa diagonal, thumbnail, personagem grande abaixo do cartão e balão de convite. No horizontal, usa o mesmo estilo HQ, com dois cartões 16:9 e um círculo central, entradas laterais coordenadas e pop do círculo. O personagem entra no canto inferior esquerdo, grande e abaixo da área dos vídeos. O título superior é maior e fica centralizado dentro da faixa, compartilhando sua inclinação de `-3°` e seu movimento. As três etiquetas usam Bangers branca maior sobre caixas pretas.

A distribuição fixa de cores do horizontal é: cartão esquerdo **azul `#2676E8`**, círculo central **amarelo `#F4C542`** e cartão direito **vermelho `#EF3F49`**. As cores aparecem nos fundos dos espaços vazios e nas sombras decorativas; as thumbnails mantêm suas cores originais. Somente a cor da faixa superior depende de `stripeColor`.


## Fonte e acabamento

| Parâmetro | Opções e uso |
| --- | --- |
| `fontFamily` | `"Bangers"` ou `"Anton"`. Padrão: Bangers. |
| `customComponent.assets.bangers` | `builtin://fonts/Bangers-Regular.ttf`, necessário quando Bangers é usada. |
| `customComponent.assets.anton` | `builtin://fonts/Anton-Regular.ttf`, necessário quando Anton é usada. |

Anton é texto puro, **sem sombra nem contorno**. Bangers preserva o acabamento próprio deste padrão. Sombras/bordas de caixas e imagens continuam normais. Declare apenas a fonte selecionada. Não há fallback silencioso. Não passe caminhos de fontes em props. As referências a Bangers no restante do guia descrevem o visual padrão, não uma limitação. Revise legibilidade ao trocar fontes; caixas fixas não acomodam parágrafos ilimitados.

PNGs `previa-anton-*` antigos podem mostrar sombras anteriores à correção; são históricos. A referência atual de Anton está no Texto HQ, exemplo `anton-limpo`. Consulte FONTES_HQ.md.

## Encerramento horizontal 16:9

Use `project.resolution: {"width": 1920, "height": 1080}`. Os cartões ficam em `x = 5%–36%` e `64%–95%`, com topo em `32%` da tela. O círculo fica centralizado, com largura de `14%` da tela e topo em `35%`. As posições finais ficam estáveis depois da entrada para encaixar os elementos da tela final do YouTube. O personagem usa o PNG transparente aprovado, cuja área visível ocupa o canto inferior esquerdo sem cobrir as thumbnails.

| Campo horizontal | Função |
| --- | --- |
| `props.stripeColor` | Cor da faixa superior; os acentos azul, amarelo e vermelho dos espaços permanecem fixos. |
| `props.leftTitle` | Texto sob o vídeo esquerdo; padrão `ASSISTA TAMBÉM`. |
| `props.rightTitle` | Texto sob o vídeo direito; padrão `PRÓXIMO VÍDEO`. |
| `assets.thumbnailLeft` | Thumbnail do vídeo esquerdo, opcional. |
| `assets.thumbnailRight` | Thumbnail do vídeo direito, opcional. |
| `assets.channelIcon` | Imagem circular do canal, opcional. |
| `assets.bangers` / `assets.anton` | Declare a fonte escolhida; padrão Bangers. |
| `assets.character` | PNG transparente aprovado `personagem_exemplo.png`, obrigatório nas duas orientações. |

Os espaços podem ficar vazios para receber os elementos do YouTube. As imagens opcionais ajudam a visualizar o resultado. O TSX gera a arte; as indicações clicáveis precisam ser configuradas na tela final do YouTube. `headline` e `assets.thumbnail` pertencem à versão vertical e são ignorados no horizontal. O encerramento horizontal mantém a imagem até o último quadro, sem fade-out automático.

Exemplo do bloco horizontal:

```json
{
  "module": "project://custom-scenes/ComicPageCTA.tsx",
  "mode": "replace",
  "props": {
    "stripeColor": "#EF3F49",
    "leftTitle": "ASSISTA TAMBÉM",
    "rightTitle": "PRÓXIMO VÍDEO"
  },
  "assets": {
    "bangers": "builtin://fonts/Bangers-Regular.ttf",
    "character": "project://assets/personagem_exemplo.png"
  }
}
```

Para preencher os espaços, acrescente no mapa `assets` os campos `thumbnailLeft`, `thumbnailRight` e `channelIcon`, apontando para arquivos reais com `project://assets/...`. A duração é definida em `timeline[].start/end`; escolha o tempo de encerramento desejado. Os mesmos dois SFX listados adiante acompanham a entrada da versão horizontal.

## Arquivo e nome

- Componente: `ComicPageCTA.tsx` (export default `ComicPageCTA`).
- No projeto de edição: `custom-scenes/ComicPageCTA.tsx`.
- Referência no plano: `project://custom-scenes/ComicPageCTA.tsx` com `mode: "replace"`.
- Uso vertical: encerramento indicando um vídeo, com thumbnail. A duração aprovada no projeto foi **5,36 s**; mantenha pelo menos esse tempo para o personagem entrar e a thumbnail permanecer legível.

## O que pode mudar no vertical

| Campo | Onde | Significado | Exemplo |
| --- | --- | --- | --- |
| `headline` | `customComponent.props` | Texto **abaixo** da thumbnail. | `A REGRA DO Herói E O Antagonista` |
| `stripeColor` | `customComponent.props` | Cor hexadecimal `#RRGGBB` da **faixa diagonal superior somente**. Padrão `#EF3F49`. | `#2962D9` |
| `thumbnail` | `customComponent.assets` | Imagem do vídeo indicado, dentro dos assets do Short. Preferir 16:9. | `project://assets/TH_0005.png` |

O texto superior `A HISTÓRIA NÃO ACABA AQUI!`, o balão `VAI LÁ ASSISTIR!`, o nome `criador`, os detalhes vermelhos restantes, a posição do personagem e as animações são **fixos** neste padrão. Não alterar `channel`, timing, escala ou layout ao trocar de vídeo. Se uma nova direção pedir isso, criar outro padrão ou uma versão revisada aprovada.

## Assets necessários no vertical

- `thumbnail`: PNG/JPG do vídeo indicado, informada no JSON. O arquivo não está embutido neste padrão.
- `personagem`: PNG transparente `personagem_exemplo.png`, copiado para `assets/` do Short. A imagem é fornecida pelo projeto.
- `bangers`: `builtin://fonts/Bangers-Regular.ttf` do Content Lab.

## Sons aprovados — configurar no JSON

O TSX desenha a cena, mas **não toca os efeitos**. Replicar os dois elementos `sfx` na mesma cena do `edit_plan.json`, calculando `at` a partir do início absoluto da CTA (`T`). Os valores vêm da CTA aprovada do projeto:

| Som | `at` absoluto | Duração útil | Volume | `fadeOut` | Função |
| --- | --- | --- | --- | --- | --- |
| `builtin://sfx/Whoosh 03.mp3` | `T + 0.06` | `0.24 s` | `trimDb: -27`, `preset: subtle` | `0.035 s` | Entrada da página/cartão. |
| `builtin://sfx/Pop 01.mp3` | `T + 0.11` | `0.35 s` | `trimDb: -25`, `preset: subtle` | `0.08 s` | Aparição gráfica. |

O personagem começa a entrar em `T + 0.62 s`. A versão aprovada **não** tem um terceiro som dedicado a essa entrada; não inventar um chime. A narração e a música geral do Short permanecem em `audio`, fora deste padrão.

## Exemplo para `edit_plan.json`

O exemplo abaixo usa `T = 44.24 s`. Ao mover a CTA, recalcule **ambos** os campos `at`; não copie os segundos absolutos sem ajuste. Confirme que os três assets existem no projeto.

```json
{
  "id": "cta_encerramento_hq",
  "start": 44.24,
  "end": 49.60,
  "layout": "fullscreen",
  "background": {"color": "#111217"},
  "elements": [
    {
      "id": "cta_page_whoosh",
      "type": "sfx",
      "asset": "builtin://sfx/Whoosh 03.mp3",
      "at": 44.30,
      "fadeOut": 0.035,
      "config": {"duration": 0.24, "preset": "subtle", "trimDb": -27}
    },
    {
      "id": "cta_page_pop",
      "type": "sfx",
      "asset": "builtin://sfx/Pop 01.mp3",
      "at": 44.35,
      "fadeOut": 0.08,
      "config": {"duration": 0.35, "preset": "subtle", "trimDb": -25}
    }
  ],
  "customComponent": {
    "module": "project://custom-scenes/ComicPageCTA.tsx",
    "mode": "replace",
    "props": {
      "headline": "A REGRA DO Herói E O Antagonista",
      "stripeColor": "#EF3F49"
    },
    "assets": {
      "thumbnail": "project://assets/TH_0005.png",
      "character": "project://assets/personagem_exemplo.png",
      "bangers": "builtin://fonts/Bangers-Regular.ttf"
    }
  },
  "transitionOut": "cut"
}
```

Teste a prévia com a thumbnail real: a imagem deve estar inteira visível, o personagem deve ficar grande abaixo do cartão e os sons devem acompanhar as entradas sem encobrir a narração.

## Contrato visual e limites para reutilização

Este padrão substitui a composição inteira. Fundo de papel/halftone fica atrás; cartões, títulos e balão ficam na frente do personagem no vertical para preservar a thumbnail. Não há reprodução de vídeo nas thumbnails: são imagens, mesmo nos espaços chamados “vídeos”. O TSX não cria links nem publica telas finais no YouTube.

Entradas têm tempos fixos relativos à cena: página começa em 0,06 s e dura 0,38 s; cartões começam em 0,06 s e duram 0,48 s; balão/círculo começa em 0,11 s e dura 0,30 s; personagem entra de 0,62 a 1,00 s. Não existem props para duração desses movimentos, posição, escala ou textos superiores. A fonte é selecionável. `leftTitle/rightTitle` têm efeito só no horizontal; `headline/thumbnail` só no vertical. A versão vertical reduz a opacidade nos últimos aproximadamente 4,17% da duração; a horizontal não tem saída animada. Ao mudar a duração total, esse fade vertical acompanha a duração, mas os tempos das entradas continuam fixos.

O PNG personagem_exemplo de referência tem margens e proporções consideradas no layout: outro recorte de personagem pode mudar sua escala aparente e cobrir regiões. Não substituir sem conferir a imagem final. `headline` deve ser curto; este padrão não mede/ajusta parágrafos arbitrários. Defaults: headline A ANÁLISE COMPLETA, faixa #EF3F49, leftTitle ASSISTA TAMBÉM e rightTitle PRÓXIMO VÍDEO.

O som da tabela é a receita editorial aprovada, não áudio embutido nem uma fórmula automática baseada na duração. Preservar a receita ao reutilizar. Os MP4 desta pasta são testes visuais sem narração/mixagem. O conteúdo de um vídeo novo continua dependendo dos assets próprios desse projeto.

## Referências visuais





As duas orientações têm prévias PNG e MP4 geradas localmente. A aprovação visual se refere ao padrão discutido; validar cada nova thumbnail, texto e áudio antes de entregar o vídeo.

## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.


## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Props = {channelName?:string;topTitle?:string;subscribeText?:string;calloutText?:string;fontFamily?: HQFont;
  /** Texto abaixo da thumbnail. */
  headline?: string;
  /** Somente a faixa diagonal superior; os demais detalhes vermelhos são fixos. */
  stripeColor?: string;
  leftTitle?: string;
  rightTitle?: string;
  assets?: {thumbnail?: string; character?: string; bangers?: string; anton?: string;
    thumbnailLeft?: string; thumbnailRight?: string; channelIcon?: string};
};
type HQFont = 'Bangers' | 'Anton';
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/ComicPageCTA.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)


## Identidade parametrizável

assets.character é obrigatório e pode apontar para qualquer imagem fornecida pelo projeto. Nenhum personagem está incluído no padrão. channelName (padrão vazio) configura a assinatura; topTitle, subscribeText e calloutText configuram os textos de convite. headline, leftTitle e rightTitle mantêm suas funções descritas acima. A geometria foi preservada; imagens de proporções diferentes exigem inspeção visual.
