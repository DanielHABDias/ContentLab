---
name: contentlab-revisor-audio-sincronizacao
description: Audita voz, música, SFX e sincronização audiovisual no Content Lab usando arquivos reais, waveform e escuta do preview/render. Use antes de liberar edit_plan.json e após o render; não aprove áudio apenas pela presença de eventos no JSON.
---

# Revisor de áudio e sincronização

Revise por percepção e por tempo. Um arquivo existente ou um `at` válido não comprova que o efeito está audível nem sincronizado.

## Entradas mínimas

- áudio de narração efetivamente usado, `transcript.words` e arquivos reais de música/SFX;
- `edit_plan.json`, durações reais após trim e fades;
- preview das cenas críticas e, na etapa final, o MP4.

## Inventário pré-render

1. Liste cada gesto que pede som: entrada, saída, blur, impacto, clique, sino, escrita e movimento de câmera relevante.
2. Para cada gesto, registre janela de movimento, início audível do SFX, centro perceptivo/impacto, duração e cauda.
3. Exija `motionStart <= audibleSfxStart < motionEnd`. Posicione o centro perceptivo no meio ou no impacto visual, conforme o gesto. Considere o silêncio já removido do começo e fim do arquivo.
4. Prefira nenhum SFX a um efeito fora de timing. Não preencha todos os movimentos por automatismo.
5. Varie whooshes por duração, peso e direção. Reprove repetição mecânica, duplicidade com áudio embutido e efeito cobrindo a voz.
6. Verifique música por duração real do arquivo, offset, fade, troca entre faixas, final do vídeo e limites de fonte. Não permita trecho além do arquivo.
7. Confira voz, música e efeitos por loudness e pico: voz clara, música abaixo dela, ducking natural e ausência de clipping. Valores configurados são ponto de partida; a escuta decide.

## Sincronização com a fala

Cruze `word.start`/`word.end` com a chegada do elemento. A animação pode começar antes da palavra, mas o conceito precisa estar legível no primeiro fonema ou, no máximo, assentado até o fim da palavra. Verifique pausas e respiros intencionais; não comprima a fala para compensar edição atrasada.

## Evidência

Use waveform ou espectrograma para localizar onsets, silêncios, picos e sobreposições, mas sempre escute o trecho em contexto. Na revisão final, ouça antes, durante e depois de cada evento crítico no MP4. JSON, waveform e escuta são evidências complementares.

## Saída

Relate por evento: `scene.id`, tempo, gesto, janela de movimento, arquivo, onset audível, centro perceptivo, resultado `CONFORME|CORRIGIR|NÃO VERIFICADO`, causa e correção. Inclua matriz de:

- movimentos com cobertura válida;
- movimentos intencionalmente sem SFX;
- efeitos ausentes ou atrasados;
- repetições e duplicidades;
- música, fades, ducking e limites de arquivo;
- voz, picos e clipping.

Qualquer `CORRIGIR` bloqueia a liberação; sem escuta do MP4, não existe aprovação final.
