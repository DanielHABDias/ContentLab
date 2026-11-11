import { randomUUID } from 'node:crypto';
import { timelineSchema } from '../core/contracts.js';

export class TimelineEngine {
  constructor(timeline, { historyLimit = 100 } = {}) { this.current = timelineSchema.parse(structuredClone(timeline)); this.undoStack = []; this.redoStack = []; this.historyLimit = historyLimit; }
  snapshot() { return structuredClone(this.current); }
  apply(command) {
    const before = this.snapshot(); const next = reduce(structuredClone(before), command); this.current = timelineSchema.parse(next);
    this.undoStack.push({ id: randomUUID(), command, before }); if (this.undoStack.length > this.historyLimit) this.undoStack.shift(); this.redoStack = [];
    return this.snapshot();
  }
  undo() { const entry = this.undoStack.pop(); if (!entry) return this.snapshot(); this.redoStack.push({ ...entry, after: this.snapshot() }); this.current = entry.before; return this.snapshot(); }
  redo() { const entry = this.redoStack.pop(); if (!entry) return this.snapshot(); this.undoStack.push({ id: entry.id, command: entry.command, before: this.snapshot() }); this.current = entry.after; return this.snapshot(); }
}

function reduce(timeline, command) {
  if (command.type === 'track.add') { if (timeline.tracks.some(track => track.id === command.track.id)) throw new Error('Track duplicada'); timeline.tracks.push(command.track); return timeline; }
  const track = timeline.tracks.find(candidate => candidate.id === command.trackId); if (!track) throw new Error(`Track desconhecida: ${command.trackId}`); if (track.locked) throw new Error('Track bloqueada');
  if (command.type === 'clip.add') { if (timeline.tracks.some(item => item.clips.some(clip => clip.id === command.clip.id))) throw new Error('Clip duplicado'); track.clips.push(command.clip); }
  else {
    const clip = track.clips.find(candidate => candidate.id === command.clipId); if (!clip) throw new Error(`Clip desconhecido: ${command.clipId}`);
    if (command.type === 'clip.move') clip.startFrame = command.startFrame;
    else if (command.type === 'clip.trim') { clip.startFrame = command.startFrame; clip.durationInFrames = command.durationInFrames; }
    else if (command.type === 'clip.keyframe') { clip.keyframes[command.property] ||= []; clip.keyframes[command.property].push(command.keyframe); clip.keyframes[command.property].sort((a, b) => a.frame - b.frame); }
    else if (command.type === 'clip.remove') track.clips = track.clips.filter(candidate => candidate.id !== command.clipId);
    else throw new Error(`Comando desconhecido: ${command.type}`);
  }
  return timeline;
}

export function resolveLayout(clip, ratio, canvas) {
  const specific = clip.layout?.[ratio];
  const box = specific || { x: 0, y: 0, width: 1, height: 1 };
  const width = box.width <= 1 ? box.width * canvas.width : box.width;
  const height = box.height <= 1 ? box.height * canvas.height : box.height;
  const x = (box.x <= 1 ? box.x * canvas.width : box.x) - anchorOffset(clip.anchor, width, 'x');
  const y = (box.y <= 1 ? box.y * canvas.height : box.y) - anchorOffset(clip.anchor, height, 'y');
  return { x, y, width, height, fit: clip.fit };
}

function anchorOffset(anchor, size, axis) { if (anchor === 'center') return size / 2; if (axis === 'x' && anchor === 'right') return size; if (axis === 'y' && anchor === 'bottom') return size; return 0; }
