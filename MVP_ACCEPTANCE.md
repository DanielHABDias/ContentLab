# Aceitação do Content Lab Node/Remotion

## Validação automatizada

```bash
npm test
node server/smoke.mjs
node server/smoke-transitions.mjs
```

Os testes verificam contrato único, IDs, caminhos de assets, segurança do rebuild, cache, HTTP, render real Remotion/FFmpeg, transições, música e efeitos sonoros.

## Aceitação manual pendente

- Iniciar o Zorin pelo atalho de aplicativo sem manter terminal aberto; encerrar pelo botão da interface.
- Inicializar o Windows com `iniciar.vbs` e verificar fechamento, abertura do navegador e logs.
- Abrir o VD_0005: comparar frames-chave, personagens PNG, câmeras e textos, sem recorte ou ampliação não solicitada.
- Render com cache: editar apenas Batman; verificar que os demais MP4s mantêm as assinaturas.
- Testar narrador com `sourceCuts`, normalização, níveis de música, ducking, SFX e transições.
- Validar vídeos locais e vídeos do YouTube na área de fontes.
- Testar transcrição `whisper.cpp` com modelo local instalado e conferir precisão de palavra.
- Conferir distribuição no Windows e comportamento de erro quando falta FFmpeg.

**Não considerar aprovado apenas pelos smoke tests.** Dados e assets reais, e execução no Windows, precisam de aceitação.
