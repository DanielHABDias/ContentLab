# Preview, render e jobs

A timeline é compilada para `contentlab-render-plan-v1`. Preview e render consomem esse mesmo plano: canvas, duração, camadas, fontes, caixas e keyframes têm uma única interpretação. O preview amostra o estado em qualquer frame; o render usa adaptadores locais.

O adaptador FFmpeg produz H.264/AAC, normaliza áudio a -16 LUFS, valida dimensões, streams e duração com ffprobe e reaproveita resultados pelo fingerprint do plano. Camadas TSX são pré-renderizadas pelo adaptador Remotion como sequência PNG com alfa em processo isolado e entram no mesmo grafo FFmpeg, preservando transparência, geometria, duração e cache do `RenderPlan`.

Jobs são persistidos, executados em fila, expõem fase/progresso, podem ser cancelados e voltam de `running` para `queued` após reinício. Saídas parciais são removidas; um render só termina como concluído após inspeção.
