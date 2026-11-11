import { randomUUID } from 'node:crypto';
import { timelineSchema } from '../core/contracts.js';

/** Histórico em memória para uso programático; a interface usa o histórico persistente (`timeline-history.js`). */
export class TimelineEngine {
  constructor(timeline, { historyLimit = 100, media = [] } = {}) { this.current = timelineSchema.parse(structuredClone(timeline)); this.undoStack = []; this.redoStack = []; this.historyLimit = historyLimit; this.media = media; }
  snapshot() { return structuredClone(this.current); }
  apply(command) {
    const before = this.snapshot(); this.current = applyTimelineCommands(before, [command], { media: this.media });
    this.undoStack.push({ id: randomUUID(), command, before }); if (this.undoStack.length > this.historyLimit) this.undoStack.shift(); this.redoStack = [];
    return this.snapshot();
  }
  undo() { const entry = this.undoStack.pop(); if (!entry) return this.snapshot(); this.redoStack.push({ ...entry, after: this.snapshot() }); this.current = entry.before; return this.snapshot(); }
  redo() { const entry = this.redoStack.pop(); if (!entry) return this.snapshot(); this.undoStack.push({ id: entry.id, command: entry.command, before: this.snapshot() }); this.current = entry.after; return this.snapshot(); }
}

const TRACK_MEDIA = { visual: ['video', 'image'], audio: ['audio', 'video'], caption: [] };

/**
 * Aplica comandos de edição em ordem e valida o resultado: tracks bloqueadas,
 * sobreposição na mesma track, mídia compatível e trecho dentro da duração da mídia.
 * A duração da timeline cresce para caber o último clip.
 */
export function applyTimelineCommands(timeline, commands, { media = [] } = {}) {
  const draft = structuredClone(timeline);
  for (const command of commands) reduce(draft, command);
  const end = Math.max(0, ...draft.tracks.flatMap(track => track.clips.map(clip => clip.startFrame + clip.durationInFrames)));
  if (end > draft.durationInFrames) draft.durationInFrames = end;
  const parsed = timelineSchema.parse(draft);
  validateTimeline(parsed, media);
  return parsed;
}

export function validateTimeline(timeline, media = []) {
  const byId = new Map(media.map(item => [item.id, item]));
  const clipIds = new Set();
  for (const track of timeline.tracks) {
    const sorted = [...track.clips].sort((a, b) => a.startFrame - b.startFrame);
    for (const [index, clip] of sorted.entries()) {
      if (clipIds.has(clip.id)) throw new Error(`Clip duplicado: ${clip.id}`);
      clipIds.add(clip.id);
      if (index && sorted[index - 1].startFrame + sorted[index - 1].durationInFrames > clip.startFrame) throw new Error(`Clips sobrepostos em “${track.name}”: ${sorted[index - 1].id} e ${clip.id}`);
      if (track.kind === 'caption' && !['caption', 'text'].includes(clip.type)) throw new Error(`A track de legendas só aceita texto (${clip.id})`);
      if (clip.type !== 'media') continue;
      const item = byId.get(clip.sourceId);
      if (!item) throw new Error(`Mídia ausente no projeto: ${clip.sourceId || '(nenhuma)'} em ${clip.id}`);
      if (!(TRACK_MEDIA[track.kind] || []).includes(item.kind)) throw new Error(`${item.kind === 'image' ? 'Imagem' : 'Mídia'} não combina com a track “${track.name}”`);
      const seconds = item.metadata?.durationSeconds;
      if (item.kind !== 'image' && seconds != null && (clip.sourceInFrame + clip.durationInFrames) / timeline.fps > seconds + 1 / timeline.fps + 0.05) throw new Error(`O clip ${clip.id} passa do fim da mídia (${seconds.toFixed(2)} s)`);
    }
  }
}

function findTrack(timeline, trackId) { const track = timeline.tracks.find(candidate => candidate.id === trackId); if (!track) throw new Error(`Track desconhecida: ${trackId}`); return track; }
function editable(track) { if (track.locked) throw new Error(`Track bloqueada: ${track.name}`); return track; }
function findClip(track, clipId) { const clip = track.clips.find(candidate => candidate.id === clipId); if (!clip) throw new Error(`Clip desconhecido: ${clipId}`); return clip; }
function shiftAfter(track, frame, delta, exceptId) { for (const clip of track.clips) if (clip.id !== exceptId && clip.startFrame >= frame) clip.startFrame = Math.max(0, clip.startFrame + delta); }

function reduce(timeline, command) {
  const op = command.op || command.type;
  if (op === 'track.add') { if (timeline.tracks.some(track => track.id === command.track.id)) throw new Error('Track duplicada'); timeline.tracks.push(structuredClone(command.track)); return; }
  if (op === 'timeline.update') { if (command.durationInFrames) timeline.durationInFrames = command.durationInFrames; if (command.safeArea) timeline.safeArea = command.safeArea; return; }
  const track = findTrack(timeline, command.trackId);
  if (op === 'track.update') { for (const key of ['name', 'muted', 'locked']) if (command[key] !== undefined) track[key] = command[key]; return; }
  editable(track);
  if (op === 'clip.add') { track.clips.push(structuredClone(command.clip)); return; }
  const clip = findClip(track, command.clipId);
  if (op === 'clip.move') {
    clip.startFrame = command.startFrame;
    if (command.toTrackId && command.toTrackId !== track.id) { const target = editable(findTrack(timeline, command.toTrackId)); if (target.kind !== track.kind) throw new Error('Só é possível mover entre tracks do mesmo tipo'); track.clips = track.clips.filter(item => item !== clip); target.clips.push(clip); }
  } else if (op === 'clip.trim') {
    const oldEnd = clip.startFrame + clip.durationInFrames;
    const inShift = command.startFrame - clip.startFrame;
    clip.sourceInFrame = command.sourceInFrame ?? Math.max(0, clip.sourceInFrame + inShift);
    clip.startFrame = command.startFrame; clip.durationInFrames = command.durationInFrames;
    if (command.ripple) shiftAfter(track, oldEnd, clip.startFrame + clip.durationInFrames - oldEnd, clip.id);
  } else if (op === 'clip.split') {
    const offset = command.frame - clip.startFrame;
    if (offset <= 0 || offset >= clip.durationInFrames) throw new Error('O ponto de divisão precisa estar dentro do clip');
    const second = { ...structuredClone(clip), id: command.newClipId, startFrame: command.frame, durationInFrames: clip.durationInFrames - offset, sourceInFrame: clip.sourceInFrame + offset, keyframes: shiftKeyframes(clip.keyframes, offset) };
    clip.durationInFrames = offset;
    track.clips.push(second);
  } else if (op === 'clip.update') Object.assign(clip, structuredClone(command.patch));
  else if (op === 'clip.keyframe') { clip.keyframes[command.property] ||= []; clip.keyframes[command.property].push(command.keyframe); clip.keyframes[command.property].sort((a, b) => a.frame - b.frame); }
  else if (op === 'clip.remove') { track.clips = track.clips.filter(candidate => candidate !== clip); if (command.ripple) shiftAfter(track, clip.startFrame + clip.durationInFrames, -clip.durationInFrames, clip.id); }
  else throw new Error(`Comando desconhecido: ${op}`);
}

function shiftKeyframes(keyframes = {}, offset) { return Object.fromEntries(Object.entries(keyframes).map(([key, points]) => [key, points.filter(point => point.frame >= offset).map(point => ({ ...point, frame: point.frame - offset }))])); }

export { snapFrame } from './snap.js';

export function resolveLayout(clip, ratio, canvas) {
  const specific = clip.layout?.[ratio];
  const box = specific || { x: 0, y: 0, width: 1, height: 1 };
  const width = box.width <= 1 ? box.width * canvas.width : box.width;
  const height = box.height <= 1 ? box.height * canvas.height : box.height;
  const x = (box.x <= 1 ? box.x * canvas.width : box.x) - (specific ? anchorOffset(clip.anchor, width, 'x') : 0);
  const y = (box.y <= 1 ? box.y * canvas.height : box.y) - (specific ? anchorOffset(clip.anchor, height, 'y') : 0);
  return { x, y, width, height, fit: clip.fit };
}

function anchorOffset(anchor, size, axis) { if (anchor === 'center') return size / 2; if (axis === 'x' && anchor === 'right') return size; if (axis === 'y' && anchor === 'bottom') return size; return 0; }
