import { createHash } from 'node:crypto';
import { resolveLayout } from '../timeline/timeline-engine.js';

const canvases = { '16:9': { width: 1920, height: 1080 }, '9:16': { width: 1080, height: 1920 }, '1:1': { width: 1080, height: 1080 }, '4:5': { width: 1080, height: 1350 } };

export function compileRenderPlan(timeline, media = []) {
  const canvas = canvases[timeline.aspectRatio]; if (!canvas) throw new Error('Proporção sem canvas');
  const sources = new Map(media.map(item => [item.id, item.uri]));
  const layers = timeline.tracks.flatMap((track, trackIndex) => track.clips.map((clip, clipIndex) => ({ ...clip, trackId: track.id, trackKind: track.kind, zIndex: trackIndex * 1000 + clipIndex, source: clip.sourceId ? sources.get(clip.sourceId) : undefined, box: track.kind === 'visual' ? resolveLayout(clip, timeline.aspectRatio, canvas) : undefined }))).sort((a, b) => a.zIndex - b.zIndex);
  const plan = { schema: 'contentlab-render-plan-v1', fps: timeline.fps, durationInFrames: timeline.durationInFrames, duration: timeline.durationInFrames / timeline.fps, aspectRatio: timeline.aspectRatio, canvas, safeArea: timeline.safeArea, layers };
  return { ...plan, fingerprint: createHash('sha256').update(stable(plan)).digest('hex') };
}

export function previewFrame(plan, frame) {
  return { frame, time: frame / plan.fps, canvas: plan.canvas, layers: plan.layers.filter(layer => frame >= layer.startFrame && frame < layer.startFrame + layer.durationInFrames).map(layer => ({ id: layer.id, type: layer.type, trackKind: layer.trackKind, box: layer.box, opacity: interpolateKeyframes(layer.keyframes?.opacity, frame, 1), source: layer.source })) };
}

function interpolateKeyframes(points, frame, fallback) { if (!points?.length) return fallback; const before = [...points].reverse().find(point => point.frame <= frame) || points[0]; const after = points.find(point => point.frame >= frame) || points.at(-1); if (before.frame === after.frame || typeof before.value !== 'number') return before.value; const progress = (frame - before.frame) / (after.frame - before.frame); return before.value + (after.value - before.value) * progress; }
function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`; return JSON.stringify(value); }
