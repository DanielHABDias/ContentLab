import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { ProjectStore } from '../core/project-store.js';
import { createWorkflow } from '../core/workflow.js';
import { ProjectRegistry } from './project-registry.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

function project(id, title = 'Real') {
  return { schema: 'contentlab-project-v1', id, title, type: 'long', aspectRatio: '16:9', mode: 'review', revision: 1, stages: createWorkflow(), media: [], timeline: { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .08, left: .05 }, tracks: [] } };
}

test('lista projetos reais e sinaliza caminhos inválidos sem removê-los do registro', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-registry-')); roots.push(root);
  const projects = path.join(root, 'projects');
  await new ProjectStore(projects).create(project('real_project'));
  const registry = new ProjectRegistry(path.join(root, 'data'));
  await registry.open(path.join(projects, 'real_project'));
  await mkdir(path.join(root, 'missing'));
  await writeFile(path.join(root, 'data', 'recent-projects.json'), JSON.stringify({ projects: [{ path: path.join(root, 'missing'), openedAt: '2026-01-01' }, { path: path.join(projects, 'real_project'), openedAt: '2026-01-02' }] }));
  expect(await registry.list()).toMatchObject([{ id: 'missing', status: 'invalid' }, { id: 'real_project', title: 'Real', status: 'ready', path: path.join(projects, 'real_project') }]);
  await registry.remove(path.join(root, 'missing'));
  expect(await registry.list()).toMatchObject([{ id: 'real_project' }]);
});

test('recusa pasta sem project.json válido', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-registry-invalid-')); roots.push(root);
  const registry = new ProjectRegistry(path.join(root, 'data'));
  await expect(registry.open(root)).rejects.toThrow();
});
