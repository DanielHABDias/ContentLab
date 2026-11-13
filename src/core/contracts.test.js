import { describe, expect, test } from 'vitest';
import { parseOperation, parseProject, timelineSchema } from './contracts.js';

const timeline = { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .05, left: .05 }, tracks: [{ id: 'visual_main', kind: 'visual', name: 'Principal', muted: false, locked: false, clips: [{ id: 'clip_intro', type: 'text', startFrame: 0, durationInFrames: 60, fit: 'cover', anchor: 'center', keyframes: {}, effects: [] }] }] };

test('valida timeline genérica sem tipo especial de fundo', () => {
  expect(timelineSchema.parse(timeline).tracks[0].clips[0].type).toBe('text');
});

test('valida projeto e referências locais de mídia', () => {
  const result = parseProject({ schema: 'contentlab-project-v1', id: 'project_demo', title: 'Demo', type: 'long', aspectRatio: '16:9', mode: 'review', revision: 1, stages: [{ id: 'script', state: 'active', revision: 1, approvedRevision: null, dependsOn: [] }], media: [], timeline });
  expect(result.revision).toBe(1);
});

test('rejeita operação sem revisão-base e limita lote', () => {
  expect(() => parseOperation({ schema: 'contentlab-operation-v1', operationId: 'op_demo', projectId: 'project_demo', actions: [] })).toThrow();
});

test('aceita operação transacional com dry-run', () => {
  const result = parseOperation({ schema: 'contentlab-operation-v1', operationId: 'op_demo', projectId: 'project_demo', baseRevision: 1, dryRun: true, actions: [{ type: 'clip.move', trackId: 'visual_main', clipId: 'clip_intro', startFrame: 30 }] });
  expect(result.dryRun).toBe(true);
});

test('migração: componente HQ antigo com prefixo dv_ passa a hq_ na leitura', async () => {
  const { clipSchema } = await import('./contracts.js');
  expect(clipSchema.parse({ id: 'clip_a', type: 'component', startFrame: 0, durationInFrames: 30, componentId: 'dv_texto_hq' }).componentId).toBe('hq_texto_hq');
});
