import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { ComponentRegistry } from './component-registry.js';
import { resolveLayout, TimelineEngine } from './timeline-engine.js';

const roots = []; afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const base = { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .05, left: .05 }, tracks: [{ id: 'visual_main', kind: 'visual', name: 'Principal', muted: false, locked: false, clips: [] }] };

test('opera a mesma timeline com undo e redo', () => {
  const engine = new TimelineEngine(base); engine.apply({ type: 'clip.add', trackId: 'visual_main', clip: { id: 'layer_background', type: 'shape', startFrame: 0, durationInFrames: 300 } }); engine.apply({ type: 'clip.move', trackId: 'visual_main', clipId: 'layer_background', startFrame: 10 });
  expect(engine.snapshot().tracks[0].clips[0].startFrame).toBe(10); expect(engine.undo().tracks[0].clips[0].startFrame).toBe(0); expect(engine.redo().tracks[0].clips[0].startFrame).toBe(10);
});

test('fundo é camada genérica e aceita keyframes', () => {
  const engine = new TimelineEngine(base); engine.apply({ type: 'clip.add', trackId: 'visual_main', clip: { id: 'layer_background', type: 'shape', startFrame: 0, durationInFrames: 300 } }); engine.apply({ type: 'clip.keyframe', trackId: 'visual_main', clipId: 'layer_background', property: 'opacity', keyframe: { frame: 20, value: .5, easing: 'ease-in-out' } });
  expect(engine.snapshot().tracks[0].clips[0].keyframes.opacity[0].value).toBe(.5);
});

test('layouts específicos mantêm âncoras consistentes em 16:9 e 9:16', () => {
  const clip = { anchor: 'center', fit: 'cover', layout: { '16:9': { x: .5, y: .5, width: .5, height: .5 }, '9:16': { x: .5, y: .4, width: .8, height: .3 } } };
  expect(resolveLayout(clip, '16:9', { width: 1920, height: 1080 })).toEqual({ x: 480, y: 270, width: 960, height: 540, fit: 'cover' });
  expect(resolveLayout(clip, '9:16', { width: 1080, height: 1920 })).toEqual({ x: 108, y: 480, width: 864, height: 576, fit: 'cover' });
});

test('registro TSX compila allowlist e bloqueia acesso ao sistema', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-components-')); roots.push(root); const registry = new ComponentRegistry(root);
  const manifest = await registry.register({ id: 'kinetic_title', source: "import React from 'react'; export const Title=({text}:{text:string})=><div>{text}</div>;", propsSchema: { text: 'string' } }); expect(manifest.hash).toHaveLength(64);
  await expect(registry.register({ id: 'unsafe_component', source: "import fs from 'node:fs'; export default ()=>null;" })).rejects.toThrow(/não permitido/);
});

test('enquadramento próprio vale só para a proporção indicada', async () => {
  const { applyTimelineCommands } = await import('./timeline-engine.js');
  const timeline = applyTimelineCommands(base, [{ op: 'clip.add', trackId: 'visual_main', clip: { id: 'layer_title', type: 'text', text: 'Oi', startFrame: 0, durationInFrames: 30 } }, { op: 'clip.update', trackId: 'visual_main', clipId: 'layer_title', patch: { layout: { '9:16': { x: .5, y: .3, width: .8, height: .2 } } } }]);
  expect(Object.keys(timeline.tracks[0].clips[0].layout)).toEqual(['9:16']);
});
