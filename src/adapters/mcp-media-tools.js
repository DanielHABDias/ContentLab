import { z } from 'zod';

/** Expose the same media operations used by the app, without a second pipeline. */
export function registerMediaTools(server, { tool, api, projectPath }) {
  const mediaId = z.string().min(1);
  tool(server, 'media_list', 'Lista mídias, metadados, cortes e estado da transcrição do projeto.', { path: projectPath }, async ({ path }) => {
    const { project } = await api('/projects/open', { path });
    return { revision: project.revision, media: project.media };
  });
  tool(server, 'media_transcribe', 'Transcreve uma mídia importada com Whisper local na fila do app. requireWords exige tempos por palavra. Retorna jobId ou unchanged; acompanhe job_wait.', {
    path: projectPath, mediaId, force: z.boolean().default(false), requireWords: z.boolean().default(true),
  }, async args => {
    const result = await api('/media/transcribe', args);
    return result.id ? { jobId: result.id, hint: 'Use job_wait.' } : result;
  });
  tool(server, 'media_transcript', 'Lê a transcrição de uma mídia, paginada em segmentos ou palavras, em segundos da fonte. Leia antes de cortar; confira também o áudio para preservar a frase e a reação.', {
    path: projectPath, mediaId, unit: z.enum(['segments', 'words']).default('segments'), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(1000).default(200),
  }, async ({ path, mediaId, unit, offset, limit }) => {
    const { transcript } = await api('/media/transcript', { path, mediaId });
    if (!transcript) return { transcript: null };
    const items = unit === 'words' ? (transcript.words || []) : (transcript.current || []);
    return { mediaId, unit, total: items.length, offset, items: items.slice(offset, offset + limit), nextOffset: offset + limit < items.length ? offset + limit : null };
  });
  tool(server, 'media_search', 'Busca falas nas transcrições do projeto; resultados incluem mediaId e tempos da fonte.', { path: projectPath, query: z.string().trim().min(1) }, async args => api('/media/search', args));
  tool(server, 'media_cut', 'Cria um corte real de vídeo/áudio no app, preservando o original. start/end em segundos da fonte; baseRevision atual obrigatória. Confira fala completa e reação antes de escolher o intervalo.', {
    path: projectPath, mediaId, baseRevision: z.number().int().min(0), start: z.number().finite().min(0), end: z.number().finite().positive(), name: z.string().trim().min(1).max(80),
  }, async args => {
    if (args.end <= args.start) throw new Error('O fim do corte deve ser depois do início');
    return api('/media/cut', args);
  });
}
