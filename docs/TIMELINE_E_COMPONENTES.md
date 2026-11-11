# Timeline e componentes

`contentlab-timeline-v1` é a fonte de verdade compartilhada entre interface e agentes. Tracks ordenadas contêm clips de mídia, texto, forma, legenda ou componente. Fundo não é um tipo especial: é uma camada visual que pode ser movida, animada, bloqueada e removida.

Operações passam pelo `TimelineEngine`, mantêm IDs estáveis e geram undo/redo. Layouts usam coordenadas normalizadas e podem declarar variantes `16:9`, `9:16`, `1:1` e `4:5`; `anchor`, `fit` e safe areas evitam deslocamentos implícitos.

Componentes de motion design ficam numa biblioteca local com manifesto, hash, schema de props e TSX. O registro compila a fonte e limita imports a React/Remotion. APIs de sistema, rede e avaliação dinâmica são bloqueadas. Isso é uma barreira inicial, não um sandbox completo; a renderização deve ocorrer em processo isolado com limites.

O primeiro componente, `KineticEmphasis`, usa entrada curta com spring amortecido e opacidade determinística. Novos componentes devem ter primeiro/último frame estáveis, redução de movimento e propósito narrativo explícito.
