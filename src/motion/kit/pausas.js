/**
 * Pausas na narração para trechos com o áudio original da obra (contrato `contentlab-motion-v1`, campo `pausas`).
 * Cada pausa é ancorada no tempo da narração montada: `em` = segundo da narração em que ela para, `duracao` = quanto
 * tempo o vídeo segue sem a voz. Os beats ficam no tempo do vídeo; as palavras do Whisper e os capítulos são deslocados.
 */
export const sortPausas = (pausas = []) => [...(pausas || [])].filter(p => Number.isFinite(p?.em) && p.duracao > 0).sort((a, b) => a.em - b.em);

/** Segundo da narração → segundo do vídeo (soma as pausas que vêm antes). */
export const narrationToVideo = (seconds, pausas = []) => seconds + sortPausas(pausas).filter(p => p.em <= seconds + 1e-6).reduce((sum, p) => sum + p.duracao, 0);

/** Trechos do vídeo em que a narração está parada: [{ start, end }] no tempo do vídeo. */
export const pauseWindows = (pausas = []) => sortPausas(pausas).map(p => { const end = narrationToVideo(p.em, pausas); return { start: end - p.duracao, end }; });

/** Trechos contínuos da narração: { from (narração), to (narração ou null), at (vídeo) }. */
export const narrationSegments = (pausas = []) => {
  const cuts = [...new Set(sortPausas(pausas).map(p => p.em))].filter(t => t > 0);
  const starts = [0, ...cuts];
  return starts.map((from, i) => ({ from, to: starts[i + 1] ?? null, at: narrationToVideo(from, pausas) }));
};

/** Total de segundos acrescentados pelas pausas. */
export const pauseTotal = (pausas = []) => sortPausas(pausas).reduce((sum, p) => sum + p.duracao, 0);
