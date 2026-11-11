import { createHash } from 'node:crypto';
import { resolveLayout } from '../timeline/timeline-engine.js';

export const CANVASES = { '16:9': { width: 1920, height: 1080 }, '9:16': { width: 1080, height: 1920 }, '1:1': { width: 1080, height: 1080 }, '4:5': { width: 1080, height: 1350 } };

/**
 * Plano único de render: o preview e o render final leem as mesmas camadas,
 * tempos, enquadramentos e fontes. `aspectRatio` permite pré-visualizar outra
 * proporção sem alterar o projeto.
 */
export function compileRenderPlan(timeline, media = [], { aspectRatio = timeline.aspectRatio } = {}) {
  const canvas = CANVASES[aspectRatio]; if (!canvas) throw new Error('Proporção sem canvas');
  const sources = new Map(media.map(item => [item.id, item]));
  const fps = timeline.fps;
  const layers = timeline.tracks.flatMap((track, trackIndex) => track.muted ? [] : track.clips.map((clip, clipIndex) => {
    const item = clip.sourceId ? sources.get(clip.sourceId) : undefined;
    const effects = Object.fromEntries((clip.effects || []).filter(effect => effect.enabled !== false).map(effect => [effect.type, effect.params || {}]));
    return {
      id: clip.id, type: clip.type, name: clip.name || null, trackId: track.id, trackKind: track.kind, zIndex: trackIndex * 1000 + clipIndex,
      startFrame: clip.startFrame, durationInFrames: clip.durationInFrames, start: clip.startFrame / fps, duration: clip.durationInFrames / fps, sourceIn: (clip.sourceInFrame || 0) / fps,
      source: item?.uri, sha256: item?.sha256, mediaKind: item?.kind, hasAudio: item ? item.kind === 'audio' || (item.kind === 'video' && item.metadata?.audioCodec != null) : false,
      box: track.kind === 'visual' ? resolveLayout(clip, aspectRatio, canvas) : undefined, fit: clip.fit, anchor: clip.anchor,
      text: clip.text ?? null, style: clip.style || 'legenda', volume: clip.volume ?? 1,
      fadeIn: Number(effects['fade-in']?.seconds) || 0, fadeOut: Number(effects['fade-out']?.seconds) || 0,
      opacity: (clip.keyframes?.opacity || []).filter(point => typeof point.value === 'number').map(point => ({ time: point.frame / fps, value: point.value })),
    };
  })).sort((a, b) => a.zIndex - b.zIndex);
  const plan = { schema: 'contentlab-render-plan-v2', fps, durationInFrames: timeline.durationInFrames, duration: timeline.durationInFrames / fps, aspectRatio, canvas, safeArea: timeline.safeArea, layers };
  return { ...plan, fingerprint: createHash('sha256').update(stable(plan)).digest('hex') };
}

/** Camadas visíveis em um frame (mesma regra do render: início incluído, fim excluído). */
export function previewFrame(plan, frame) {
  return { frame, time: frame / plan.fps, canvas: plan.canvas, layers: plan.layers.filter(layer => frame >= layer.startFrame && frame < layer.startFrame + layer.durationInFrames).map(layer => ({ id: layer.id, type: layer.type, trackKind: layer.trackKind, box: layer.box, opacity: opacityAt(layer.opacity, frame / plan.fps - layer.start), source: layer.source, text: layer.text })) };
}

export function opacityAt(points, time) {
  if (!points?.length) return 1;
  if (time <= points[0].time) return points[0].value;
  for (let index = 1; index < points.length; index += 1) {
    const [a, b] = [points[index - 1], points[index]];
    if (time <= b.time) return b.time === a.time ? b.value : a.value + ((b.value - a.value) * (time - a.time)) / (b.time - a.time);
  }
  return points.at(-1).value;
}

/** Fontes de mídia ausentes no disco (para erro claro antes do FFmpeg). */
export function missingSources(plan, exists) { return [...new Set(plan.layers.filter(layer => layer.type === 'media' && (!layer.source || !exists(layer.source))).map(layer => layer.id))]; }

function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`; return JSON.stringify(value); }
