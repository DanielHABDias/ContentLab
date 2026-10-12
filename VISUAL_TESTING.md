# Verificação visual — Content Lab Node/Remotion

O renderizador visual é Remotion. As verificações automatizadas produzem MP4s sintéticos reais com FFmpeg para reduzir riscos de integração.

```bash
npm test
node server/smoke.mjs
node server/smoke-transitions.mjs
```

Para inspecionar manualmente, rode `npm start`, abra `http://127.0.0.1:5000`, carregue o projeto e use **Aproveitar cache**. Revise diferentes momentos da mesma cena, com atenção ao começo, ápice e saída de textos, PNGs e câmera.

Pontos importantes:
- Limites de tela respeitados em 16:9 e 9:16.
- Transparência e centralização dos sprites preservadas.
- Sem texto sobreposto indevidamente.
- Keyframes alinhados à narração e composição sem cortes inesperados.
- Áudio e transições inspecionados no MP4 final, não apenas no código-fonte.
- Conferir o cache por ID após renderizar e após modificar somente uma cena.

A futura interface de inspeção deve utilizar `@remotion/player` e componentes compartilhados com o render final. Não criar um segundo encoder integral apenas para Preview.
