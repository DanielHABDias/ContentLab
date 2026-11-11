/**
 * Mapa único de quais etapas e recursos dependem de quais itens do catálogo de
 * dependências. Usado pela interface (bloqueio com atalho para instalar) e pelo
 * servidor (recusa a operação com DEPENDENCY_MISSING).
 */
export const FEATURES = {
  'media.import': { label: 'Importar mídia local', requires: ['ffmpeg', 'ffprobe'] },
  'media.url': { label: 'Importar vídeo por URL', requires: ['yt-dlp'] },
  transcription: { label: 'Transcrever em português', requires: ['whisper-cli', 'whisper-large-v3'] },
  'narration.treatment': { label: 'Tratar e medir áudio da narração', requires: ['ffmpeg', 'ffprobe'] },
  'voice.synthetic': { label: 'Gerar voz por IA (Chatterbox)', requires: ['chatterbox-pt-br'] },
  render: { label: 'Renderizar e validar o vídeo', requires: ['ffmpeg', 'ffprobe'] },
};

/** `requires`: sem eles a etapa não abre. `features`: recursos bloqueados individualmente. */
export const STAGE_REQUIREMENTS = {
  media: { requires: ['ffmpeg', 'ffprobe'], features: ['media.import', 'media.url', 'transcription'] },
  narration: { requires: ['ffmpeg', 'ffprobe'], features: ['narration.treatment', 'voice.synthetic'] },
  edit: { requires: ['ffmpeg', 'ffprobe'], features: [] },
  review: { requires: ['ffmpeg', 'ffprobe'], features: ['render'] },
};

/** Itens ausentes (com rótulo) entre `ids`, a partir do status do setup. */
export function missingDependencies(ids = [], items = []) {
  const byId = new Map(items.map(item => [item.id, item]));
  return ids.filter(id => !byId.get(id)?.ready).map(id => ({ id, label: byId.get(id)?.label || id }));
}

export function stageBlock(stageId, items) {
  const requirement = STAGE_REQUIREMENTS[stageId];
  return requirement ? missingDependencies(requirement.requires, items) : [];
}

export function featureBlock(featureId, items) {
  const feature = FEATURES[featureId];
  if (!feature) throw new Error(`Recurso desconhecido: ${featureId}`);
  return missingDependencies(feature.requires, items);
}
