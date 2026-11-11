# Validação final

Executada em 11 de novembro de 2026, Linux x64, Node 24.21.0, FFmpeg/FFprobe 6.1.1.

## Gates aprovados

- 36 testes em 10 arquivos: contratos, persistência/reinício, workflow, CLI, agente, mídia/cortes reais, áudio/takes reais, timeline/TSX, renders 16:9 e 9:16, pacotes e E2E.
- E2E: cria projeto, simula diff, aplica operação, renderiza vertical com áudio, exporta `.contentlab`, restaura e relê revisão/MP4.
- Build Vite de produção concluído.
- Skills `contentlab-control` e `contentlab-packages` aprovadas pelo `quick_validate.py`.
- MCP `stdio` inicia sem saída indevida em `stdout`.
- `npm audit --omit=dev`: nenhuma vulnerabilidade conhecida.
- Doctor: Node, FFmpeg e FFprobe prontos.

## Capacidades opcionais diagnosticadas

`yt-dlp`, whisper.cpp/large-v3 e VoxCPM2 não estão instalados nesta máquina (o VoxCPM2 foi validado no teste comparativo de 2026-11-11 em `.tools/voice-bakeoff`). A aplicação mantém edição, cache de arquivos, áudio, render e pacotes operacionais; importação por URL, transcrição e voz por IA retornam diagnóstico e solução, sem fingir sucesso nem instalar pesos não verificados. Antes de uso de produção, essas capacidades exigem os runtimes/pesos documentados e avaliação auditiva PT-BR autorizada.

## Comandos

```bash
npm run doctor
npm run check
npm audit --omit=dev
python3 /home/daniel/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/contentlab-control
python3 /home/daniel/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/contentlab-packages
```
