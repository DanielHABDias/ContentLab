# Pesquisa e cortes de mídias pelo MCP

O agente usa as mesmas operações da interface, sem baixar ou transcrever por fora:

1. `media_list {path}`: mídias, origem, metadados, cortes e revisão atual.
2. `media_import_url`: importe a fonte com a confirmação de direitos exigida pela ferramenta; acompanhe `job_wait`.
3. `media_transcribe {path, mediaId, requireWords:true}`: Whisper local na fila global. Retorna `jobId` ou `status:"unchanged"`; use `job_wait` para o trabalho.
4. `media_search {path, query}`: localize falas; leia o contexto com `media_transcript {path, mediaId, unit:"segments"}` e os limites com `unit:"words"`. Ambos são paginados por `offset/limit` (até 1000); `nextOffset:null` encerra.
5. Confira imagem e áudio do intervalo. A transcrição pode errar: preserve frases, respostas e reações completas.
6. `media_cut {path, mediaId, baseRevision, start, end, name}`: crie o arquivo de corte no app, preservando a fonte. Tempos em segundos da fonte; releia a revisão depois de cada alteração. Em conflito, recalcule em vez de sobrescrever.

`media_cut_remove {path, mediaId, cutId, baseRevision}` descarta do projeto um corte rejeitado sem remover a fonte.

Os cortes não inserem automaticamente cenas ou áudio na montagem final. Registre sua correspondência com os blocos do roteiro e confira a edição. A transcrição de mídias segue a configuração atual do app em português; ela não traduz automaticamente áudio em inglês.
