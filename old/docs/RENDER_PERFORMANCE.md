# Render CPU: concorrência e validação

O pipeline mantém até três cenas independentes em execução, com um renderizador de frames por cena no padrão. Não são virtual threads de Java: o Node coordena subprocessos Remotion/Chromium. Qualidade, FPS, composição, transições e mixagem não foram reduzidos para acelerar.

A política automática e os overrides estão em [SCENE_CACHE.md](../SCENE_CACHE.md). Não é necessário mudar projetos. Preferir **Aproveitar cache**; a otimização não justifica refazer cenas já válidas. Evitar outros processos pesados durante o render. O limite de RAM é uma estimativa conservadora, não detector infalível de OOM; para TSX especialmente pesado, usar uma cena por vez.

## Evidência local

Teste Linux x64 com 12 CPUs lógicas disponíveis e aproximadamente 15,5 GiB de RAM total. Amostra de seis segundos, 1920×1080/30 fps: três segundos de TextoHQ com fonte local e três de vídeo com filtro CRT e texto. Projeto temporário independente; nenhuma alteração no plano ou mídia do vídeo original.

| Execução | Limite efetivo | Tempo total |
| --- | ---: | ---: |
| Sequencial | 1 | 25,36 s |
| Paralela | 2 | 17,48 s |

Frames decodificados comparados por FFmpeg framemd5: idênticos. Áudio decodificado comparado por SHA256: idêntico. Frames representativos das duas cenas foram inspecionados. FFprobe confirmou vídeo H.264 e áudio AAC de seis segundos. Reexecução com cache: ambas as cenas reaproveitadas, sem recodificação. Isso não substitui escuta humana ou validação de um vídeo inteiro. É uma medição pontual; efeitos de cache do bundler, carga do sistema, TSX e codecs variam. Não extrapolar a porcentagem para projetos longos. Teste físico Windows não realizado; os testes portáveis permanecem na CI existente. Suíte de 209 testes aprovada em Node 22.16.0 e 24.21.0 no Linux, além do smoke oficial e verificação de saúde HTTP.

## Como comparar

### Montagem com transições e preparação da voz

A montagem usa até duas tarefas de peças, com limites de CPU/RAM e ordem estável, e evita a recodificação H.264 integral extra quando os streams são compatíveis. Verifica cabeçalhos, formato, FPS, timebase, cores, duração e quantidade de frames; incompatibilidade ou falha usa o fallback de encode. A preparação do WAV ocorre durante as cenas/composição, mantendo o relógio e os bytes da fonte; a mixagem espera ambos. Falha de voz cancela e aguarda renderizadores ativos antes de limpar temporários.

Em amostra Full HD/30 fps de nove segundos com TextoHQ, vídeo CRT, blur e flip, a montagem sequencial com encode final levou 24,556 s; o caminho com duas tarefas e concatenação copy levou 17,579 s. Ambos produziram nove segundos e 270 frames; a ordem e os tempos das transições foram preservados e frames de blur/flip foram inspecionados. É medição pontual, não promessa para vídeos completos. Copiar evita a geração extra de compressão, portanto não se exige igualdade de pixels com a versão duplamente comprimida. O teste automatizado compara frames idênticos entre montagem sequencial/paralela no caminho copy, verifica reuso de peças e força a incompatibilidade para testar o fallback.

Suíte atual: 213 testes aprovados em Linux; Node 22 e 24 verificados. Smoke de render, transições e sincronismo de áudio concluídos. CI mantém testes portáveis Windows e exige os testes reais de composição no job com FFmpeg; Windows físico não foi testado. Inspeção por frames e medidas de áudio não substitui escuta humana do projeto completo.

1. Trabalhar numa cópia temporária pequena e representativa; nunca usar Refazer tudo no projeto real só para medir.
2. Executar `renderProject(pasta, {sceneConcurrency: 1})` e depois `{sceneConcurrency: 2}`, com entradas e qualidade idênticas, sem reaproveitar cenas na comparação de custo. O limite real continua sujeito à RAM/CPU.
3. Consultar `performance.sceneConcurrency`, `performance.sceneTimings` e `elapsedSeconds` no relatório. Separar economia por cache de ganho de paralelismo.
4. Comparar frames, duração, ordem, transições e áudio; repetir alternando a ordem dos testes antes de tirar conclusões gerais.
5. Conferir cancelamento e falha: interromper irmãos ativos, aguardar encerramento e preservar cache concluído e MP4 final anterior.

Os testes em `scene-workers.test.mjs`, `render.test.mjs` e `exec.test.mjs` cobrem limite, pressão de memória, ordem, progresso, cancelamento e persistência. O smoke oficial valida o pipeline real. Referência: [desempenho do Remotion](https://www.remotion.dev/docs/performance).
