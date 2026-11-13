import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { ProjectStore } from './project-store.js';
import { approveStage, createWorkflow, reopenStage, requestChanges } from './workflow.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const timeline = { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .05, left: .05 }, tracks: [] };
const project = () => ({ schema: 'contentlab-project-v1', id: 'project_real', title: 'Projeto real', type: 'long', aspectRatio: '16:9', mode: 'review', revision: 1, stages: createWorkflow(), media: [], timeline, creative: { brief: { thesis: 'Tese', audience: 'Público', promise: 'Promessa', notes: '' }, script: { hook: 'Gancho', development: 'Corpo', payoff: 'Final', visual: '', sources: '' }, packaging: { titleA: 'Título', titleB: '', description: 'Descrição', tags: '', seo: '', thumbnailMediaId: null } } });

async function store() { const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-')); roots.push(root); return new ProjectStore(root); }

test('projeto persiste, reabre e mantém snapshots após nova instância', async () => {
  const first = await store();
  await first.create(project());
  await first.update('project_real', 1, value => approveStage(value, 'brief', 0), { type: 'stage.approved', stageId: 'brief' });
  const second = new ProjectStore(first.root);
  expect((await second.read('project_real')).revision).toBe(2);
  expect(JSON.parse(await readFile(path.join(first.root, 'project_real/versions/000001.json'), 'utf8')).revision).toBe(1);
  expect(await second.history('project_real')).toHaveLength(2);
});

test('reabertura invalida dependentes sem apagar histórico', async () => {
  let value = project();
  value = approveStage(value, 'brief', 0);
  value = approveStage(value, 'packaging', 0);
  value = reopenStage(value, 'brief', 'Tese mudou');
  expect(value.stages.find(stage => stage.id === 'brief').state).toBe('active');
  expect(value.stages.find(stage => stage.id === 'script').state).toBe('invalidated');
  expect(value.stages.find(stage => stage.id === 'packaging').state).toBe('invalidated');
});

test('bloqueia conflito de revisão e pedido sem justificativa', async () => {
  const value = project();
  expect(() => requestChanges(value, 'brief', '')).toThrow(/motivo/);
  const repository = await store();
  await repository.create(value);
  await expect(repository.update('project_real', 9, item => item, { type: 'noop' })).rejects.toThrow(/conflito/i);
});

test('pedido de mudança guarda autor, revisão e resolução auditável', () => {
  let value = project();
  value = requestChanges(value, 'brief', 'Detalhar a promessa', { author: 'Revisor', requestId: 'change_review_1' });
  expect(value.changeRequests[0]).toMatchObject({ stageId: 'brief', author: 'Revisor', status: 'open', requestedRevision: 1 });
  value.creative.brief.promise = 'Promessa detalhada';
  value = approveStage(value, 'brief', 1);
  expect(value.changeRequests[0]).toMatchObject({ status: 'resolved', resolution: 'Etapa aprovada após as alterações', resolvedRevision: 3 });
});
