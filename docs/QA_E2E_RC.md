# QA E2E — release candidate

Executado em 2026-11-12T10:42:32.636Z · Node v24.21.0 · linux x64

| Etapa | Resultado | Tempo | Detalhe |
| --- | --- | --- | --- |
| primeira execução: lista vazia e dependências essenciais | ok | 0.1 s | 8/8 prontas |
| longo: criar projeto long 16:9 | ok | 0.4 s | …/projects/qa_longo |
| longo: configurar (modo e título) | ok | 0.0 s | revisão 2 |
| longo: importar mídia com direitos | ok | 0.4 s | 1 mídia(s) |
| longo: importar e montar narração | ok | 1.5 s | Narração montada |
| longo: timeline (vídeo, narração, legendas, desfazer/refazer) | ok | 0.7 s | visual_main:1 audio_main:1 captions_main:2 |
| longo: prévia de frame pelo plano do render | ok | 0.2 s | 138022 bytes |
| longo: render final e conferência ffprobe | ok | 1.8 s | 1280x720 h264/aac 6.00 s |
| longo: aprovar etapa e histórico | ok | 0.0 s | 10 eventos, 1 pedido(s) |
| longo: exportar .contentlab, importar e reabrir | ok | 0.1 s | qa_longo-r10.contentlab → revisão 10 |
| short: criar projeto short 9:16 | ok | 0.0 s | …/projects/qa_short |
| short: configurar (modo e título) | ok | 0.0 s | revisão 2 |
| short: importar mídia com direitos | ok | 0.4 s | 1 mídia(s) |
| short: importar e montar narração | ok | 0.9 s | Narração montada |
| short: timeline (vídeo, narração, legendas, desfazer/refazer) | ok | 0.1 s | visual_main:1 audio_main:1 captions_main:2 |
| short: prévia de frame pelo plano do render | ok | 0.2 s | 97895 bytes |
| short: render final e conferência ffprobe | ok | 1.3 s | 720x1280 h264/aac 5.00 s |
| short: aprovar etapa e histórico | ok | 0.0 s | 10 eventos, 1 pedido(s) |
| short: exportar .contentlab, importar e reabrir | ok | 0.1 s | qa_short-r10.contentlab → revisão 10 |
| recuperação: kill -9 durante render, reinício retoma o job | ok | 2.9 s | job retomado, tentativa 1 |
| recuperação: projeto íntegro e reaberto após kill -9 | ok | 0.0 s | revisão 10 |
| recuperação: kill -9 durante importação não deixa mídia pela metade | ok | 2.2 s | antes 2, depois do kill 2, após repetir 3 |

**22/22 etapas ok.**
