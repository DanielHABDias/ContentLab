# Timeline e componentes

`contentlab-timeline-v1` é a fonte de verdade compartilhada entre interface e agentes. Tracks ordenadas contêm clips de mídia, texto, forma, legenda ou componente. Fundo não é um tipo especial: é uma camada visual que pode ser movida, animada, bloqueada e removida.

Operações passam pelo `TimelineEngine`, mantêm IDs estáveis e geram undo/redo. Layouts usam coordenadas normalizadas e podem declarar variantes `16:9`, `9:16`, `1:1` e `4:5`; `anchor`, `fit` e safe areas evitam deslocamentos implícitos.

Componentes de motion design ficam numa biblioteca local com manifesto, hash, schema de props e TSX. O registro transpila a fonte, confere o hash a cada uso e limita imports a React/Remotion. APIs de sistema, rede e avaliação dinâmica são bloqueadas. Build e render rodam fora do servidor principal, em processo filho com memória, concorrência e tempo limitados; o resultado transparente é cacheado por fonte, propriedades, duração e canvas. Falha devolve `COMPONENT_RENDER_FAILED` com o clip afetado, que continua editável ou removível.

O primeiro componente, `KineticEmphasis`, aparece como **Ênfase cinética** no editor, com texto e cor configuráveis, e usa entrada curta com spring amortecido e opacidade determinística. Novos componentes devem ter primeiro/último frame estáveis, redução de movimento e propósito narrativo explícito. A interface também importa SRT local diretamente para clips editáveis, sem depender do caminho escondido pelo navegador.
