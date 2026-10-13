---
name: contentlab-timeline-audio
description: Planeja sincronismo com narração, transcript, SFX, música, cortes, pausas e timeline absoluta do Content Lab.
---

# Content Lab — Timeline, voz e áudio

## Fonte temporal
A narração **preparada** é a referência para sincronizar palavras, legendas e beats. O fluxo preferido agora começa na aba **Narração**, sem `edit_plan.json`: o Content Lab remove silêncio das bordas e reduz pausas internas longas (configurável), preserva `audio/narration.original.*`, salva `audio/narration.prepared.wav` e gera o áudio final `audio/narration.wav` com grave opcional. O `transcript.json` é produzido sobre a versão limpa, **antes do pitch**. Depois o ChatGPT cria `edit_plan.json` com `audio.narration: "audio/narration.wav"` e `sources.transcript: "transcript.json"`. `silenceInserts` é etapa de edição posterior: aplique as pausas pelo JSON e deixe o renderer remapear apenas essas inserções. Não duplicar `sourceCuts` de cortes que a aba Narração já realizou.

## Regras de relógio
- `scene.start/end` e `element.start/end`: segundos **absolutos** no vídeo.
- `keyframes[].t` dentro de cenas: segundos **relativos** ao início da cena.
- Eventos de SFX `at`: posição audível absoluta.
- Diferencie duração da cena, janela de visibilidade, entrada, hold e saída.
- Em narrações com timestamps de palavras, ancore revelações nos beats semânticos relevantes; o tempo de leitura pode exigir manter a informação após o enunciado.

## Tratamento de voz
- O fluxo novo na aba Narração reduz silêncio de início/fim e, opcionalmente, pausas internas longas. O auto-trim antigo do plano ainda remove **apenas silêncio inicial e terminal**. Use `audio.voice.autoTrimSilence:false` quando o silêncio de borda for intencional.
- Para um único intervalo de corte da voz use `audio.narrationTrim`; para múltiplos intervalos use `sourceCuts`; não use os dois juntos.
- Após mudar cortes, pausas ou o áudio, a transcrição preparada pode ser regenerada; preserve backup de correções manuais.
- Correções ortográficas no texto da transcrição não autorizam deslocar arbitrariamente timestamps.
- `audio.voice.fadeIn/fadeOut` se refere ao áudio da voz, inclusive encerramento antes de uma cauda musical.

## Música e SFX
- Música: `start/end` localizam na timeline final; `sourceStart/sourceEnd` delimitam a região da fonte; `loop` repete o trecho selecionado.
- Música tem auto-trim nas bordas da seleção antes de loop/fades, salvo `autoTrimSilence:false`.
- Crossfades exigem sobreposição real dos intervalos e fades complementares; não confundir transição sonora com visual.
- O início do SFX é seu `at` audível depois da limpeza das bordas. Não remover silenciosamente pausas internas.
- Priorize a inteligibilidade da voz, variação funcional de SFX, ausência de whoosh repetitivo e silêncio quando melhor servir à cena.

## Alteração editorial
Ao inserir ou duplicar cenas, mantenha alinhamento dos tempos posteriores e da voz por `silenceInserts` quando adequado; verifique música, SFX e legendas. Não reconfigure automaticamente tempos aprovados só para suavizar movimentos. A renderização final exige ouvir o áudio, além de inspecionar imagens.

## Narração em cenas TSX
Uma cena TSX ainda possui `timeline[].start/end` absolutos; internamente o `useCurrentFrame()` começa em zero para aquela cena e `useVideoConfig().fps` define a conversão para segundos. Forneça ao componente **tempos relativos** aos beats já conferidos na voz preparada. A cena programável não substitui `audio.narration`, música, SFX ou FFmpeg do projeto. Não gere um player de áudio paralelo dentro da composição sem pedido específico.

## Saída para outras skills
Produza mapa de beats (tempo → informação → ação visual → hold → possível SFX) e restrições temporais. O motion é construído sobre esse mapa, não o contrário.
