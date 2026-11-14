# Preview, render e jobs

A timeline é compilada para `contentlab-render-plan-v1`. Preview e render consomem esse mesmo plano: canvas, duração, camadas, fontes, caixas e keyframes têm uma única interpretação. O preview amostra o estado em qualquer frame; o render usa adaptadores locais.

O adaptador FFmpeg produz H.264/AAC, normaliza áudio a -16 LUFS, valida dimensões, streams e duração com ffprobe e reaproveita resultados pelo fingerprint do plano. Camadas TSX são pré-renderizadas pelo adaptador Remotion como sequência PNG com alfa em processo isolado e entram no mesmo grafo FFmpeg, preservando transparência, geometria, duração e cache do `RenderPlan`.

## Fila de processamento

Render, transcrição, criação de voz de IA, montagem de WAV e importações de todos os projetos compartilham uma fila FIFO. Apenas um trabalho executa por vez; enviar quatro vídeos mantém três aguardando enquanto o primeiro processa. Cancelar o trabalho atual aguarda o encerramento efetivo antes de liberar o próximo.

A aba **Fila de processamento** mostra os trabalhos ativos, as posições de espera e o histórico com concluídos, falhos e cancelados. Há cancelamento individual e **Cancelar todos** (inclui os aguardando). **Limpar histórico** remove somente registros encerrados; mantém os ativos, os aguardando, os arquivos gerados e o último resultado de cada projeto. Na Edição/Revisão, o painel exibe só o render atual ou o último, com **Ver fila de processamento**.

O histórico é persistido localmente. Renders interrompidos voltam de `running` para `queued` após reinício. Outros trabalhos interrompidos ficam marcados no histórico para novo envio pelo projeto. Saídas parciais de render são removidas; um render só termina como concluído após inspeção.

O agente envia o render à fila, avisa e encerra a resposta. A pessoa volta ao chat para retomar; não há acompanhamento automático de porcentagens.

A interface oferece presets Full HD e HD calculados a partir da proporção do projeto e recusa preset de outra proporção. Em projetos longos com muitas camadas, o mesmo grafo é processado em segmentos de 60 segundos e concatenado sem recodificação adicional; o resultado completo passa novamente pela inspeção.
