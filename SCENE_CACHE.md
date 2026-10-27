# Cache incremental por cena — Content Lab

O cache é a base para revisar uma cena por ID sem recriar todos os frames.

## Render por CPU com concorrência limitada

As cenas independentes podem renderizar em até **dois subprocessos Remotion simultâneos**, sem GPU. A escolha automática exige pelo menos seis CPUs lógicas disponíveis e orçamento conservador de RAM: reserva de 4 GiB da memória total e 2 GiB da disponível, com pelo menos 3 GiB por cena (mais em 4K). No Linux, considera MemAvailable, incluindo cache recuperável; restrições de memória do processo também são respeitadas. Sob pressão de memória, espera uma cena ativa terminar antes de iniciar outra. Esse orçamento é uma heurística, não garantia contra falta de memória de TSX excepcionalmente pesado.

GPU habilitada ou concorrência de frames Remotion diferente de 1 mantém somente uma cena por vez, evitando multiplicar consumidores. `CONTENTLAB_SCENE_CONCURRENCY=1` força execução sequencial; `2` solicita até duas, sempre limitado pelos recursos. Não precisa alterar o JSON nem configurar nada para usar o padrão automático. A fila de projetos continua sequencial.

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

## Relatório e uso futuro

`render_report.json` lista `sceneCache.rendered`, `sceneCache.reused` e contagens. No futuro, os MP4s por ID poderão alimentar um editor visual de cenas, com comparação antes/depois e Player sincronizado ao renderizador.

Os segmentos individuais são vídeos visuais sem a mixagem final. Nunca edite os manifestos manualmente nem coloque fontes importantes em `output/`.
