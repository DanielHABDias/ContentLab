# Cache incremental por cena — Content Lab

O cache é a base para revisar uma cena por ID sem recriar todos os frames.

## Render por CPU com concorrência limitada

As cenas independentes podem renderizar em até **três subprocessos Remotion simultâneos**, sem GPU. A escolha automática exige pelo menos seis CPUs lógicas disponíveis para duas cenas, ou nove para três, e orçamento conservador de RAM: reserva de 4 GiB da memória total e 2 GiB da disponível, com pelo menos 2,5 GiB por cena (mais em 4K). No Linux, considera MemAvailable, incluindo cache recuperável; restrições de memória do processo também são respeitadas. Sob pressão de memória, espera uma cena ativa terminar antes de iniciar outra. Esse orçamento é uma heurística, não garantia contra falta de memória de TSX excepcionalmente pesado.

GPU habilitada ou concorrência de frames Remotion diferente de 1 mantém somente uma cena por vez, evitando multiplicar consumidores. `CONTENTLAB_SCENE_CONCURRENCY=1` força execução sequencial; `2` solicita até duas e `3` até três, sempre limitado pelos recursos; o padrão solicita três. Não precisa alterar o JSON nem configurar nada para usar o padrão automático. A fila de projetos continua sequencial. Se restar uma única cena, somente ela é processada, sem criar tarefas extras.

Os MP4s podem terminar fora de ordem, mas a montagem, os IDs e o relatório mantêm a ordem da timeline. Progresso conta cenas concluídas, não o índice da última que terminou. Em falha/cancelamento, interrompe os trabalhos ativos e aguarda sua limpeza antes de remover temporários; cache de cenas já concluídas é preservado. Não muda qualidade, FPS, resolução, duração, mixagem ou assinaturas visuais. `render_report.json` inclui `performance.sceneConcurrency` e `performance.sceneTimings` para medir tempo de cada cena. Aceleração depende do conteúdo e da máquina; não é promessa de tempo pela metade.

## Modos do Editor automático

- **Aproveitar cache** (`reuse`): verifica assinatura, tamanho e timestamp de cada MP4. Clipes válidos sobrevivem à execução anterior e são reutilizados.
- **Refazer tudo** (`rebuild`): depois de confirmação, limpa `output/` e renderiza todas as cenas novamente. A remoção é bloqueada se um asset de entrada estiver dentro dessa pasta.

## Arquivos persistidos

```text
output/final/
  final.mp4
  render_report.json
  narration.cleaned.wav
  scenes/
    manifest.json
    <id>-<hash>.mp4
  pieces/
    manifest.json
    <trecho-de-composição>.mp4
```

A assinatura visual separa propriedades renderizadas pelo Remotion de propriedades apenas sonoras (`sfx`, fades/volume de áudio e transição de montagem). O motor é identificado por hash do conteúdo visual, não por horários dos arquivos do servidor. Alterar apenas o SFX ou deslocar uma cena inteira com suas camadas deixa o clipe visual aproveitável. O arquivo de mídia em si ainda usa metadados de arquivo para evitar hashear vídeos grandes a cada verificação. A primeira renderização após esta migração pode atualizar assinaturas antigas.

O manifesto é atualizado atomicamente **depois de cada MP4 concluído**, antes da montagem final. Se a composição final falhar, os clipes já concluídos permanecem disponíveis.

A identidade de um segmento inclui JSON da cena, ID, parâmetros globais de resolução/FPS, motor, arquivos referenciados, transcrição relevante e identidade do renderer. Alterar o `scale` do Batman invalida a própria cena, não todos os outros clipes. Alterações de fundo ou fonte podem exigir novo render da cena que os utiliza. Ajustes de áudio normalmente exigem nova mixagem, mas preservam os quadros visuais.

O cache de peças contém corpos de cena e transições. Uma transição vinculada à cena alterada também pode precisar ser recalculada.

## Montagem final e voz

A preparação do WAV ocorre em paralelo com a geração das cenas e a composição visual, usando os mesmos cortes e relógio de transcrição anteriores. A mixagem só começa depois de vídeo e WAV concluídos. Falha/cancelamento de qualquer tarefa interrompe a outra e aguarda sua limpeza. Não modifica o áudio original.

Na composição, até duas tarefas de cena (transição e corpo) são preparadas em paralelo, conforme CPU/RAM; a ordem de montagem é preservada e as peças concluídas permanecem em cache. Filtros complexos e encoder usam o limite CONTENTLAB_COMPOSE_THREADS (padrão 2). A concatenação final tenta copiar os streams sem outra geração H.264 somente após conferir codec, resolução, FPS, timebase, perfil, cores e cabeçalhos. Confere também duração e quantidade de frames do resultado. Incompatibilidade ou falha na cópia usa recodificação como fallback, sem baixar qualidade ou alterar o tempo das transições.

O relatório performance inclui sceneGenerationSeconds, voicePreparationSeconds, compositionSeconds, audioMixSeconds, compositionConcurrency e assembly (copy/encode e motivo do fallback). Tempos de etapas sobrepostas não devem ser somados como tempo total. A mixagem final continua copiando o vídeo e codificando somente áudio AAC. Cache integral válido continua evitando todo esse trabalho.

## Relatório e uso futuro

`render_report.json` lista `sceneCache.rendered`, `sceneCache.reused` e contagens. No futuro, os MP4s por ID poderão alimentar um editor visual de cenas, com comparação antes/depois e Player sincronizado ao renderizador.

Os segmentos individuais são vídeos visuais sem a mixagem final. Nunca edite os manifestos manualmente nem coloque fontes importantes em `output/`.
