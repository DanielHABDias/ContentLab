# Componentes narrativos do kit

As cenas usam o mesmo palco, Anton, câmera, mídia, efeitos e composição do kit. Implementação em `src/motion/kit/narrative/`; registro em `SCENES`, catálogo público em `motion_kit` e exemplos ao vivo na Documentação. Nenhum componente depende de personagem ou marca.

## Escolher pela função

| Cena | Uso |
| --- | --- |
| `dossie` | Cruzar pistas e distinguir suspeita, hipótese e prova; não substitui a galeria sequencial. |
| `cronologiaRamos` | Cronologia com ponto de divergência e até três desdobramentos; para sequência linear use LinhaDoTempoHQ. |
| `revelacaoCamadas` | Ocultações retiradas em sequência sobre uma revelação; camadas superiores saem primeiro. |
| `contradicao` | Uma afirmação é riscada quando a evidência entra; não é uma comparação simétrica. |
| `efeitoDomino` | Encadeamento causal de consequências em cascata, com tombamento progressivo. |
| `constelacao` | Relações simultâneas ao redor da tese; não é o percurso entre nós de BrainstormHQ. |
| `quadrosProfundidade` | Travelling lateral por planos sobrepostos em Z, com o conjunto visível; sem voo WebGL. |
| `lupaEvidencia` | Inspecionar detalhe da mesma fonte com lente ampliada, sem fabricar outra evidência. |
| `bifurcacao` | Comparar possibilidades mutuamente exclusivas e realçar a escolha; rotular hipótese. |
| `limiar` | Identificar o cruzamento de um limite; valores precisam de fonte ou simulação. |
| `balancaCusto` | Pesar ganho contra sacrifício; inclinação é julgamento editorial declarado. |
| `ecoVisual` | Reconhecer recorrências através de sobreposição de fontes, sem confundir continuidades. |
| `pecaAusente` | Tornar a lacuna visível e revelar a peça só quando existir evidência. |
| `convergencia` | Frentes independentes avançam em paralelo para o mesmo acontecimento. |

## Propriedades e limites

`len` vem da duração do beat em frames. `titulo`, `fundo` (estrelas, escuro, meio-tom ou explosao) e `tom` são comuns. Cada item recebe `titulo`, `texto`, `midia`, `fonte` e `tom` opcionais, com `titulo` obrigatório. Props específicas e exemplos estão no catálogo; o exemplo de cada cena também aparece na Documentação. Respeitar os limites de itens informados: as cenas limitam a quantidade para manter legibilidade. Títulos até 40 caracteres; itens com 1–4 palavras e explicação curta. Para textos maiores, dividir o beat em vez de apertar a fonte.

`virada` é a fração do beat em `contradicao` (padrão 0,42), `bifurcacao` e `pecaAusente` (0,6). A abertura, progressão e conclusão são dirigidas por frame, sem relógio ou animação CSS. As áreas úteis se adaptam a 1920×1080 e 1080×1920; no Short o conteúdo fica entre 14% e 69% da altura. Imagens/vídeos vêm de `media:<id>`; a lupa exige imagem, as outras cenas aceitam mídia do projeto. Imagens de páginas de quadrinhos podem ser conteúdo de uma evidência. Os novos fundos não incluem papel.

## Som no mesmo evento

O campo `som.eventos` do catálogo informa nome, fração e volume sugeridos. Ao escrever o beat, converter para segundos: `at = fracao * duration`. Ajustar som e evento à fala; se mudar `virada`, mover o SFX correspondente. O Player da Documentação é visual e fica mudo. O render da composição toca os SFX do beat com os mesmos arquivos licenciados do kit. Não empilhar mais de dois sons; manter abaixo da voz. Exemplo:

```json
{
  "id": "prova-1",
  "scene": "contradicao",
  "at": 0,
  "duration": 4,
  "props": {
    "titulo": "A VERSÃO NÃO FECHA",
    "afirmacao": {
      "titulo": "NINGUÉM SABIA",
      "texto": "A afirmação"
    },
    "prova": {
      "titulo": "O REGISTRO MOSTRA",
      "texto": "A evidência contradiz",
      "fonte": "FONTE A CONFERIR"
    },
    "veredito": "TEM UMA CONTRADIÇÃO"
  },
  "sfx": [
    {
      "name": "type",
      "at": 0,
      "volume": 0.35
    },
    {
      "name": "error",
      "at": 1.68,
      "volume": 0.4
    },
    {
      "name": "impact",
      "at": 3.04,
      "volume": 0.4
    }
  ],
  "legenda": false
}
```

As frações sugeridas se referem aos exemplos. Para `limiar`, o cruzamento usa a curva de easing do kit: `0,1 + 0,65 × inversaEase((limite - de) / (valor - de))`, se estiver dentro do intervalo. `ease` é a Bézier (0,16; 1; 0,3; 1) de `fx`; resolver a inversa por busca binária. O exemplo cruza em aproximadamente 20,29% do beat; arredondar para o frame e pôr o som nesse instante. Para listas de tamanho diferente, casar cada pista/plano/etapa com sua entrada. Não tocar efeitos de um evento que não ocorre.

## Prévia isolada

`node scripts/preview-narrative.mjs` gera três frames por cena e por orientação em `output/narrative-preview/`, com mídias próprias neutras. `--video` gera também duas prévias MP4 com som; `--output=<pasta>` escolhe o destino. O script não abre nem modifica projetos. Usar `npm run check` e `npm run qa:motion -- --only=b` para verificar o modo composição sem depender de voz clonada. As opções completas do QA incluem cenários narrados que exigem perfil de voz.
