---
name: contentlab-timeline-audio
description: Planeja sincronismo com narração, transcript, SFX, música, cortes, pausas e timeline absoluta do Content Lab.
---

# Content Lab — Timeline, voz e áudio

## Fonte temporal
A narração **preparada** é a referência para sincronizar legendas, palavras e beats. Ao importar a narração, o Content Lab pode aplicar auto-trim de bordas, `narrationTrim` ou `sourceCuts`, `silenceInserts`, gerar `audio/narration.prepared.wav` e transcrever com Whisper. A transcrição gerada já usa a linha temporal preparada: não remapeie os tempos novamente.

## Regras de relógio
- `scene.start/end` e `element.start/end`: segundos **absolutos** no vídeo.
- `keyframes[].t` dentro de cenas: segundos **relativos** ao início da cena.
- Eventos de SFX `at`: posição audível absoluta.
- Diferencie duração da cena, janela de visibilidade, entrada, hold e saída.
- Em narrações com timestamps de palavras, ancore revelações nos beats semânticos relevantes; o tempo de leitura pode exigir manter a informação após o enunciado.

## Tratamento de voz
- O auto-trim remove **apenas silêncio inicial e terminal**, preservando pausas internas e respirações. Use `audio.voice.autoTrimSilence:false` quando o silêncio de borda for intencional.
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

## Saída para outras skills
Produza mapa de beats (tempo → informação → ação visual → hold → possível SFX) e restrições temporais. O motion é construído sobre esse mapa, não o contrário.
