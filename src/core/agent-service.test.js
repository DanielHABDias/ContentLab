import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { AgentService } from './agent-service.js';
import { ProjectStore } from './project-store.js';
import { createWorkflow } from './workflow.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
async function setup() { const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-agent-')); roots.push(root); const service = new AgentService(new ProjectStore(root)); await service.create({ schema: 'contentlab-project-v1', id: 'agent_demo', title: 'Demo', type: 'long', aspectRatio: '16:9', mode: 'review', revision: 1, stages: createWorkflow(), media: [], timeline: { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .05, left: .05 }, tracks: [{ id: 'visual_main', kind: 'visual', name: 'Principal', muted: false, locked: false, clips: [] }] } }); return { root, service }; }

test('dry-run retorna diff sem alterar revisão', async () => {
  const { service } = await setup();
  const result = await service.run({ schema: 'contentlab-operation-v1', operationId: 'op_preview', projectId: 'agent_demo', baseRevision: 1, dryRun: true, actions: [{ type: 'clip.add', trackId: 'visual_main', clip: { id: 'clip_one', type: 'text', startFrame: 0, durationInFrames: 30 } }] });
  expect(result.status).toBe('preview');
  expect((await service.inspect('agent_demo')).revision).toBe(1);
});

test('operação é idempotente e aprovação exige revisão esperada', async () => {
  const { service } = await setup();
  const operation = { schema: 'contentlab-operation-v1', operationId: 'op_approve', projectId: 'agent_demo', baseRevision: 1, dryRun: false, actions: [{ type: 'stage.approve', stageId: 'brief', expectedRevision: 0 }] };
  expect((await service.run(operation)).status).toBe('applied');
  expect((await service.run(operation)).status).toBe('unchanged');
});

test('CLI cria e inspeciona projeto com saída JSON compacta', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-cli-')); roots.push(root);
  const inputPath = path.join(root, 'input.json');
  await writeFile(inputPath, JSON.stringify({ schema: 'contentlab-project-v1', id: 'cli_demo', title: 'CLI', type: 'short', aspectRatio: '9:16', mode: 'review', revision: 1, stages: createWorkflow(), media: [], timeline: { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '9:16', safeArea: { top: .08, right: .05, bottom: .15, left: .05 }, tracks: [] } }));
  const { spawnSync } = await import('node:child_process');
  const created = spawnSync(process.execPath, ['src/adapters/cli.js', 'project.create', inputPath], { cwd: path.resolve('.'), env: { ...process.env, CONTENTLAB_DATA_DIR: path.join(root, 'data') }, encoding: 'utf8' });
  expect(created.status).toBe(0);
  expect(JSON.parse(created.stdout).result.id).toBe('cli_demo');
  const inspected = spawnSync(process.execPath, ['src/adapters/cli.js', 'project.inspect', 'cli_demo'], { cwd: path.resolve('.'), env: { ...process.env, CONTENTLAB_DATA_DIR: path.join(root, 'data') }, encoding: 'utf8' });
  expect(JSON.parse(inspected.stdout).result).not.toHaveProperty('timeline');
});
