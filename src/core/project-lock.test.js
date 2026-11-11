import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import { ProjectStore } from './project-store.js';
import { createWorkflow } from './workflow.js';
import { LOCK_FILE, withProjectLock } from './project-lock.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const lockModule = path.join(path.dirname(fileURLToPath(import.meta.url)), 'project-lock.js');

function project(id) {
  return { schema: 'contentlab-project-v1', id, title: 'Trava', type: 'long', aspectRatio: '16:9', mode: 'review', revision: 1, stages: createWorkflow(), media: [], timeline: { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .08, left: .05 }, tracks: [] } };
}
async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-lock-')); roots.push(root);
  const store = new ProjectStore(root); await store.create(project('trava_teste'));
  return { root, store, directory: path.join(root, 'trava_teste') };
}
const rename = title => current => ({ ...current, title, revision: current.revision + 1 });
const exists = target => stat(target).then(() => true, () => false);

test('outro processo vivo segurando a trava impede a escrita sem alterar o projeto', async () => {
  const { store, directory } = await setup();
  const child = spawn(process.execPath, ['--input-type=module', '-e', `import { withProjectLock } from ${JSON.stringify(lockModule)}; await withProjectLock(${JSON.stringify(directory)}, 'render da CLI', async () => { process.stdout.write('pronto\\n'); await new Promise(r => setTimeout(r, 1500)); });`], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(resolve => child.stdout.once('data', resolve));
  const before = await readFile(path.join(directory, 'project.json'), 'utf8');
  await expect(store.update('trava_teste', 1, rename('Outro'), { type: 'teste' })).rejects.toMatchObject({ code: 'PROJECT_LOCKED', message: expect.stringMatching(/render da CLI/), details: { owner: { pid: child.pid } } });
  expect(await readFile(path.join(directory, 'project.json'), 'utf8')).toBe(before);
  await new Promise(resolve => child.on('exit', resolve));
  await expect(store.update('trava_teste', 1, rename('Depois'), { type: 'teste' })).resolves.toMatchObject({ title: 'Depois', revision: 2 });
  expect(await exists(path.join(directory, LOCK_FILE))).toBe(false);
});

test('trava de processo encerrado é recuperada e temporários órfãos são removidos', async () => {
  const { store, directory } = await setup();
  const dead = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  await writeFile(path.join(directory, LOCK_FILE), JSON.stringify({ pid: Number(dead.stdout), hostname: os.hostname(), operation: 'autosave', startedAt: '2026-11-11T00:00:00Z' }));
  await writeFile(path.join(directory, '.project-orfao.tmp'), '{"meio": ');
  let recovered;
  await withProjectLock(directory, 'teste', async info => { recovered = info.recovered; });
  expect(recovered).toMatchObject({ previous: { operation: 'autosave' }, removedTemporaries: ['.project-orfao.tmp'] });
  expect((await readdir(directory)).filter(name => name.endsWith('.tmp') || name === LOCK_FILE)).toEqual([]);
  await expect(store.update('trava_teste', 1, rename('Recuperado'), { type: 'teste' })).resolves.toMatchObject({ revision: 2 });
});

test('trava corrompida é tratada como obsoleta; trava é reentrante no mesmo processo', async () => {
  const { store, directory } = await setup();
  await writeFile(path.join(directory, LOCK_FILE), 'lixo');
  const result = await withProjectLock(directory, 'externa', () => store.update('trava_teste', 1, rename('Aninhado'), { type: 'teste' }));
  expect(result).toMatchObject({ title: 'Aninhado' });
  expect(await exists(path.join(directory, LOCK_FILE))).toBe(false);
});

test('mudar o ID não deixa trava presa na pasta nova', async () => {
  const { root, store } = await setup();
  await store.changeId('trava_teste', 1, 'novo_nome');
  expect(await exists(path.join(root, 'novo_nome', LOCK_FILE))).toBe(false);
  await expect(store.update('novo_nome', 2, rename('Livre'), { type: 'teste' })).resolves.toMatchObject({ revision: 3 });
});
