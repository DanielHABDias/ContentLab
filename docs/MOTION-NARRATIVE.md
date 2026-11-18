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

As frações sugeridas se referem aos exemplos de quatro segundos a 30 fps. Usar `narrativeEvents(scene, props, duration, fps)` de `src/motion/kit/narrative/events.js` para recalcular a lista do beat quando mudar quantidade de itens, duração, `virada`, escolha ou revelação. O helper não insere áudio por conta própria: sua saída vai em `beat.sfx`. Para `limiar`, ele calcula o primeiro frame do cruzamento usando a mesma curva do valor, inclusive em movimento descendente. Sem cruzamento, não há SFX de erro; `revelar: false` não produz som de revelação e bifurcação aberta não produz som de escolha. A lupa usa coordenadas da imagem fonte e compensa as margens de `contain`.

## Prévia isolada

`node scripts/preview-narrative.mjs` gera oito frames por cena e por orientação em `output/narrative-preview/`, com mídias próprias neutras. `--video` gera também duas prévias MP4 com som; `--horizontal` limita a 16:9; `--scenes=dossie,bifurcacao` revisa só as cenas indicadas; `--seconds=6` permite avaliar a leitura com outra duração; `--output=<pasta>` escolhe o destino. O script não abre nem modifica projetos. Usar `npm run check` e `npm run qa:motion -- --only=b` para verificar o modo composição sem depender de voz clonada. As opções completas do QA incluem cenários narrados que exigem perfil de voz.

## Conferência de animação

Comparar com `comparacao` (Versus) e com as entradas dos componentes HQ: deslocamento visível, antecipação, overshoot controlado, desaceleração e impacto motivado pela narrativa. Conferir cada cena ao longo do beat, não só no frame final. Testes de código não certificam qualidade visual.

- Entradas de cartões ficam em um elemento interno; movimento espacial e perspectiva ficam no externo. Um `transform` de profundidade nunca pode cancelar a entrada ou mostrar um item antes do tempo.
- Dossiê conecta e carimba pistas; cronologia distribui caminhos a partir da bifurcação; camadas saem inteiras; contradição risca e substitui a afirmação; dominó transfere o impacto entre peças.
- Constelação expande e pulsa conexões; profundidade alterna foco entre planos; lupa se desloca do ponto observado e amplia a mesma fonte; escolha aproxima a opção selecionada e recua a alternativa.
- Limiar tem preparação e impacto no cruzamento; balança recebe cargas e oscila com amortecimento; eco alinha recorrências; peça ausente encaixa a nova prova; convergência conduz sinais paralelos até o encontro.
- Verificar 16:9 e 9:16, abertura, etapas intermediárias, virada, leitura final e preparação do corte. Repetir com limites de itens e com `revelar: false`/escolha aberta. Não aplicar explosões ou tremor constante: impactos são locais e não escondem a mídia ou a fonte.

## Relações e passagem pela história

- `vinculo`: duas pessoas permanecem em quadro enquanto o vínculo muda; `virada` define o instante.
- `memoria`: abre uma lembrança em destaque sobre o presente desfocado e retorna ao presente.
- `duplaVida`: alterna o foco entre responsabilidades em `trocas`, sem declarar vencedor.

Use mídias da obra nos itens e identifique a fonte. Estas composições não substituem o áudio original: trechos emocionais continuam entrando como `evidencia` com `som:true` e pausa na narração.

## Percurso, personagem em close e rasgo

- `trilhaViva`: até quatro fragmentos em uma trilha sinuosa. Os inativos ficam cinza e congelados; somente o ativo toca colorido. O traço ganha cor até a posição atual. O último fragmento amplia até preencher o quadro (`mergulhar: true`). Cada `inicio` marca o tempo na fonte.
- Continuidade do mergulho: para continuar com `evidencia`, usar a mesma mídia do último fragmento; `inicio` seguinte = `inicio` da fonte + (frames do beat − frame de ativação do último fragmento) / fps. A ativação vem de `trailSchedule`, em `src/motion/kit/narrative/trilha.js`. Em 30 fps e beat de 10 s com 2–4 fragmentos, o último ativa no frame 228; a continuação começa 2,4 s após o `inicio`. Sem áudio original na trilha; a continuação com som exige pausa na narração.
- `personagemClose`: personagem importado ampliado, com pernas além da borda; balões únicos, ícones e poses ligados à fala. Um item de `ideias` por vez; preferir beats em que cada item dure 0,7–1 s.
- `pensamentoVivo`: três pensamentos surgem e permanecem ao redor do personagem. `poses` troca a cada 0,8 s. Não usar para citar evidências que precisam aparecer em cena.
- `rasgoCena`: transição irregular entre duas mídias em tela cheia; a segunda começa na `virada`, sem áudio original. O rasgo leva 42% da duração total, por isso `virada` deve ser no máximo 0,58.

As cenas do personagem exigem `character_import`; o aplicativo permanece neutro, sem personagem de marca embutido. No Diazverso, o agente importa o Nox do plugin.
