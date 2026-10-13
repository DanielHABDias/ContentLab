# AUDITORIA COMPLETA — edição automática e render final

## Finalidade
Este protocolo é a referência operacional de `contentlab-revisao`. A liberação para render/edição automática exige inspeção do conjunto completo: roteiro/áudio preparado, transcrição, plano, assets, TSX, transições, música e SFX. A aprovação FINAL exige um segundo ciclo sobre o MP4 exportado. Não confundir procedimento das skills com uma nova funcionalidade automática já programada no servidor.

## Fontes e relógios
- `audio/narration.wav` (áudio final) e `transcript.json` gerado sobre `audio/narration.prepared.wav`, antes de alterações futuras de `silenceInserts`.
- `edit_plan.json` canônico e `schemas/edit_plan.schema.json` real, assets builtin/project reais, `custom-scenes/*.tsx` realmente instalados.
- `scene.start/end` e `sfx.at` são absolutos; `keyframes.t` e `useCurrentFrame()/fps` são locais à cena.
- Se não houver áudio/TSX/render disponível, registrar o que não foi verificado; nunca afirmar audição ou render inexistente.

## Gate A: pré-edição automática
1. Schema, IDs, durações, transições, paths e caches consistentes; cenas e assets reais. TSX compila apenas se for testado; schema aprovado não basta.
2. Cobertura semântica de todas as frases-chave: transcrição corresponde ao áudio preparado, mídia pertinente, ausência de spoiler, começo/chegada de palavra/imagem concluído até fim da locução (idealmente no começo).
3. Construir *inventário de movimentos*: para toda cena, indicar `scene.id` e eventos editoriais de câmera, entrada/saída, transformação, panel slide, glyph pop, máscaras, parallax ou travelling. Em TSX ler a timeline local; se o código é dinâmico demais, exigir mapa explícito do autor. Movimento contínuo de background em loop pode usar camada ambiental já audível caso seja intencional e registrado, mas nunca encobrir evento editorial sem SFX.
4. Construir *inventário sonoro*: `scene.id`, `movementStart`, `movementEnd`, `sfxAsset`, `sfxAudibleStart`, `audibleDuration`, `fadeOut`, `gain`, `sourceOriginalAudio`, observações.
5. **Bloquear** movimento intencional sem cobertura ou com início audível fora de `[movementStart,movementEnd)`. O efeito deve começar **dentro** da ação; nem antes, nem depois. Caudas maiores/menores que a animação são aceitas se úteis; o ataque/reconhecimento deve coincidir com o gesto.
6. Se o trecho sonoro invadir o próximo beat de modo ruim, limitar `config.duration` e aplicar `fadeOut` de elemento SFX. Conferir se o arquivo escolhido tem material audível suficiente e se não há estalo. O mixer mede e remove silêncio nas bordas do SFX, então não usar o silêncio da fonte como parte da sincronização.
7. Verificar variedade: evitar sequência sistemática de whooshes iguais, casar pop/click/glitch/riser/hit/swish com a natureza do movimento e emoção; proteger a inteligibilidade da voz. Se CTA/Nox já tem SFX, não duplicar. Não inventar paths de SFX da biblioteca.
8. Conferir legibilidade, área segura, Nox, CRT se perfil requer, música, fades, clip/audio original, escala, z-order, formatos e transições sem blackout.
9. Gerar `relatorio_qa_edicao.md` junto ao vídeo com achados por evento, evidência ou limitação e correção mínima. Qualquer bloqueante = `REPROVADO`. Informação insuficiente = `PENDENTE DE VERIFICAÇÃO`. Apenas sem bloqueantes e com todas as verificações prévias realizadas = `APROVADO PRÉ-RENDER`.

## Gate B: após o render
1. Abrir/escutar MP4 final, não só storyboard. Inspecionar frames em início/meio/fim de cada movimento relevante e também nas palavras.
2. Confirmar `sfx.at` perceptual por escuta e forma de onda: início/pico audível corresponde ao movimento, sem antecipação/atraso. Efeitos longos cortados fazem fade real no áudio ouvido.
3. Conferir cortes indesejados, clicks, mudos, clipping, loops, sequência repetitiva de SFX, volumes relativos, música e áudio original.
4. Conferir imagens/textos presentes ao pronunciar palavras, hold, legibilidade de dispositivos menores, clipes corretos, Nox/CTA/CRT, transição completa e fim do vídeo.
5. Documentar gravação/frames realmente verificados e reabrir cenas bloqueadas para patch mínimo. Um patch visual ou de áudio requer nova auditoria dos trechos afetados e vizinhos.
6. **`APROVADO FINAL` somente após MP4+áudio realmente inspecionados**; caso contrário manter status pré-render ou pendente.

## Formato de reporte por evento
| Cena | Evento/movimento (janela abs.) | Asset de SFX ou áudio embutido | Início audível | Fade/corte | Resultado | Evidência/ação |
|---|---|---|---|---|---|---|
| ID real | início..fim | caminho verificado | `at` | duração/fade | OK/BLOQUEANTE/ALERTA/NÃO VERIFICADO | motivo concreto |

Indicadores obrigatórios: total de cenas; cenas com motion; eventos de movimento; eventos cobertos; faltas de SFX; início fora da janela; fades suspeitos; duplicações/monotonia; palavras ou focos atrasados; assets ausentes; bloqueantes e pendências; fase A/B verificada. Nunca gerar porcentagem de cobertura baseada só em contagem de elementos JSON quando os movimentos TSX não foram analisados.

## Exceções permitidas explicitamente
- Cena parada ou corte realmente seco sem transformação: não exige efeito por convenção.
- Loop gráfico ambiental de fundo sem evento focal pode estar coberto por textura ambiente **verificada** e não exige “whoosh por oscilação”.
- Som nativo de clipe Nox/CTA ou footage pode cumprir o papel, desde que seja audível naquele movimento.
- Um SFX contínuo pode cobrir um travelling contínuo com várias curvas; diferentes revelações editoriais normalmente pedem eventos separados.
- Qualquer decisão de silêncio intencional deve ser autorizada pelo pedido atual; no Diazverso prevalece regra de SFX em motion editorial.

## Limite técnico
A skill descreve QA a executar pelo Codex/agente ou operador; não afirma que ContentLab já tenha um botão que executa toda auditoria automaticamente. Schema e mixer suportam `type:"sfx"`, `at`, `config.duration`, `fadeOut`. Análise perceptual de áudio e render é obrigatória e depende de arquivos/acesso real.
