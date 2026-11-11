import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { LocalApplicationService } from './local-application-service.js';
import { LifecycleError, SystemTrash } from './project-lifecycle.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

async function setup(options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-lifecycle-')); roots.push(root);
  const service = new LocalApplicationService({ dataDirectory: path.join(root, 'data'), opener: { reveal: async () => {} }, ...options(root) });
  const details = await service.createProject({ title: 'Projeto real', type: 'long', aspectRatio: '16:9', parentDirectory: path.join(root, 'workspace') });
  return { root, service, details };
}

/** Lixeira de teste com a mesma semântica: move para fora e restaura ao local original. */
function folderTrash(root) {
  const bin = path.join(root, 'trash-bin');
  const items = new Map();
  return { bin, items, trash: async directory => { await mkdir(bin, { recursive: true }); const target = path.join(bin, `${items.size}-${path.basename(directory)}`); await rename(directory, target); items.set(directory, target); }, restore: async original => { if (!items.has(original)) throw new LifecycleError('NOT_IN_TRASH', 'ausente'); await rename(items.get(original), original); items.delete(original); } };
}

const exists = async target => stat(target).then(() => true, () => false);

test('remover de Recentes altera só o registro e preserva o projeto em disco', async () => {
  const { service, details } = await setup(() => ({}));
  const before = await readFile(path.join(details.path, 'project.json'), 'utf8');
  await expect(service.forgetProject({ path: details.path })).resolves.toMatchObject({ removed: 1 });
  expect(await service.listProjects()).toEqual([]);
  expect(await readFile(path.join(details.path, 'project.json'), 'utf8')).toBe(before);
  await expect(service.registerProject(details.path)).resolves.toMatchObject({ project: { id: 'projeto_real', revision: 1 } });
});

test('recentes mostram tamanho, datas e aviso de caminho ausente sem apagar a entrada', async () => {
  const { root, service, details } = await setup(() => ({}));
  const [card] = await service.listProjects();
  expect(card).toMatchObject({ status: 'ready', sizeBytes: expect.any(Number), modifiedAt: expect.any(String), openedAt: expect.any(String) });
  expect(card.sizeBytes).toBeGreaterThan(0);
  await rename(details.path, path.join(root, 'movido'));
  expect(await service.listProjects()).toMatchObject([{ id: 'projeto_real', title: 'Projeto real', status: 'missing', problem: 'Pasta não encontrada' }]);
  expect(await service.listProjects()).toHaveLength(1);
});

test('excluir exige o ID exato e não altera nada sem confirmação', async () => {
  const { root, service, details } = await setup(root => ({ trash: folderTrash(root) }));
  await expect(service.deleteProject({ path: details.path, confirmation: 'outro' })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
  expect(await exists(details.path)).toBe(true);
  expect(await service.listProjects()).toHaveLength(1);
  expect(root).toBeTruthy();
});

test('excluir move para a lixeira, remove o cartão e restaurar recupera um projeto válido', async () => {
  let trash;
  const { service, details } = await setup(root => { trash = folderTrash(root); return { trash }; });
  await expect(service.deleteProject({ path: details.path, confirmation: 'projeto_real' })).resolves.toMatchObject({ deleted: true, method: 'trash', restorable: true });
  expect(await exists(details.path)).toBe(false);
  expect(await service.listProjects()).toEqual([]);
  expect(trash.items.size).toBe(1);
  const restored = await service.restoreProject({ path: details.path });
  expect(restored.project).toMatchObject({ id: 'projeto_real', revision: 1 });
  expect(await service.listProjects()).toMatchObject([{ id: 'projeto_real', status: 'ready' }]);
});

test('lixeira real do sistema (gio) move e restaura o projeto', async () => {
  try { execFileSync('gio', ['version'], { stdio: 'ignore' }); } catch { return; }
  let env;
  const { service, details } = await setup(root => { env = { ...process.env, XDG_DATA_HOME: path.join(root, 'xdg') }; return { trash: new SystemTrash({ env }) }; });
  await service.deleteProject({ path: details.path, confirmation: 'projeto_real' });
  expect(await exists(details.path)).toBe(false);
  expect(await readdir(path.join(env.XDG_DATA_HOME, 'Trash', 'files'))).toEqual(['projeto_real']);
  const restored = await service.restoreProject({ path: details.path });
  expect(restored.project.id).toBe('projeto_real');
  await expect(service.restoreProject({ path: details.path })).rejects.toMatchObject({ code: 'NOT_IN_TRASH' });
});

test('exclusão é bloqueada durante render e liberada após cancelamento', async () => {
  let started;
  const renderer = { render: (project, { signal }) => new Promise(resolve => { started(); signal.addEventListener('abort', () => resolve({ status: 'cancelled', output: null })); }) };
  const { root, service, details } = await setup(root => ({ renderer, trash: folderTrash(root) }));
  const running = new Promise(resolve => { started = resolve; });
  const render = service.renderProject({ path: details.path, outputDirectory: path.join(root, 'renders') });
  await running;
  await expect(service.deleteProject({ path: details.path, confirmation: 'projeto_real' })).rejects.toMatchObject({ code: 'PROJECT_BUSY', details: { activities: [expect.objectContaining({ kind: 'render', cancellable: true })] } });
  expect(await exists(details.path)).toBe(true);
  expect(service.cancelActivities({ path: details.path })).toEqual({ cancelled: 1, remaining: 0 });
  await expect(render).resolves.toMatchObject({ status: 'cancelled' });
  expect(service.listActivities({ path: details.path })).toEqual({ activities: [] });
  await expect(service.deleteProject({ path: details.path, confirmation: 'projeto_real' })).resolves.toMatchObject({ deleted: true });
});

test('sem lixeira, exclusão permanente exige nova confirmação e aceita backup verificado', async () => {
  const unavailable = { trash: async () => { throw new LifecycleError('TRASH_UNAVAILABLE', 'sem lixeira'); }, restore: async () => {} };
  const { root, service, details } = await setup(() => ({ trash: unavailable }));
  await expect(service.deleteProject({ path: details.path, confirmation: 'projeto_real' })).rejects.toMatchObject({ code: 'TRASH_UNAVAILABLE' });
  expect(await exists(details.path)).toBe(true);
  expect(await service.listProjects()).toHaveLength(1);
  await expect(service.deleteProject({ path: details.path, confirmation: 'projeto_real', mode: 'permanent' })).rejects.toMatchObject({ code: 'PERMANENT_CONFIRMATION_REQUIRED' });
  const backup = await service.exportProject({ path: details.path, outputDirectory: path.join(root, 'backups') });
  expect(backup.path).toMatch(/projeto_real-r1\.contentlab$/);
  await expect(service.deleteProject({ path: details.path, confirmation: 'projeto_real', mode: 'permanent', permanentConfirmation: 'EXCLUIR projeto_real', backupPath: backup.path })).resolves.toMatchObject({ method: 'permanent', restorable: true });
  expect(await exists(details.path)).toBe(false);
  expect(await service.listProjects()).toEqual([]);
  await expect(service.importPackage({ packagePath: backup.path })).resolves.toMatchObject({ project: { id: 'projeto_real' } });
});

test('exportar não sobrescreve arquivos e ignora renders por padrão', async () => {
  const { root, service, details } = await setup(() => ({}));
  await mkdir(path.join(details.path, 'output'));
  execFileSync('sh', ['-c', `printf render > "${path.join(details.path, 'output', 'video.mp4')}"`]);
  const first = await service.exportProject({ path: details.path, outputDirectory: path.join(root, 'out'), format: 'zip' });
  const second = await service.exportProject({ path: details.path, outputDirectory: path.join(root, 'out'), format: 'zip' });
  expect(second.path).not.toBe(first.path);
  const listing = execFileSync('unzip', ['-Z1', first.path]).toString();
  expect(listing).toContain('project.json');
  expect(listing).not.toContain('output/');
  await expect(service.exportProject({ path: details.path, outputDirectory: path.join(details.path, 'dentro') })).rejects.toThrow(/fora da pasta/);
});

test('duplicar cria novo ID, revisão 1, histórico de origem e reaproveita mídia por hash', async () => {
  const { root, service, details } = await setup(() => ({}));
  const source = path.join(root, 'tone.wav');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.2', source]);
  const withMedia = await service.importMedia({ path: details.path, baseRevision: 1, source, rights: 'owned' });
  const objectsBefore = execFileSync('find', [path.join(root, 'data', 'media', 'objects'), '-type', 'f']).toString();
  const copy = await service.duplicateProject({ path: details.path });
  expect(copy.project).toMatchObject({ id: 'projeto_real_copia', title: 'Projeto real (cópia)', revision: 1 });
  expect(copy.project.media).toEqual(withMedia.project.media);
  expect(copy.history).toMatchObject([{ type: 'project.created', duplicatedFrom: { id: 'projeto_real', revision: 2 } }]);
  expect(execFileSync('find', [path.join(root, 'data', 'media', 'objects'), '-type', 'f']).toString()).toBe(objectsBefore);
  const again = await service.duplicateProject({ path: details.path });
  expect(again.project.id).toBe('projeto_real_copia_2');
  expect((await service.listProjects()).map(card => card.id).sort()).toEqual(['projeto_real', 'projeto_real_copia', 'projeto_real_copia_2']);
});

test('renomear muda só o título; mudar ID é atômico e recusa conflitos', async () => {
  const { service, details } = await setup(() => ({}));
  const renamed = await service.renameProject({ path: details.path, baseRevision: 1, title: 'Novo título' });
  expect(renamed).toMatchObject({ path: details.path, project: { id: 'projeto_real', title: 'Novo título', revision: 2 } });
  await expect(service.renameProject({ path: details.path, baseRevision: 1, title: 'Velho' })).rejects.toThrow(/Conflito de revisão/);
  const other = await service.createProject({ title: 'Ocupado', type: 'long', aspectRatio: '16:9', parentDirectory: path.dirname(details.path) });
  await expect(service.changeProjectId({ path: details.path, baseRevision: 2, id: 'ocupado' })).rejects.toThrow(/Já existe/);
  await expect(service.changeProjectId({ path: details.path, baseRevision: 2, id: 'Inválido!' })).rejects.toMatchObject({ code: 'INVALID_ID' });
  await expect(service.changeProjectId({ path: details.path, baseRevision: 1, id: 'novo_id' })).rejects.toThrow(/Conflito de revisão/);
  expect(await exists(details.path)).toBe(true);
  const moved = await service.changeProjectId({ path: details.path, baseRevision: 2, id: 'novo_id' });
  expect(moved).toMatchObject({ path: path.join(path.dirname(details.path), 'novo_id'), project: { id: 'novo_id', revision: 3 } });
  expect(moved.history[0]).toMatchObject({ type: 'project.id_changed', from: 'projeto_real', to: 'novo_id' });
  expect(await exists(details.path)).toBe(false);
  expect((await service.listProjects()).map(card => [card.id, card.status]).sort()).toEqual([['novo_id', 'ready'], ['ocupado', 'ready']]);
  expect(other.project.id).toBe('ocupado');
});

test('não exclui pasta que não é projeto válido', async () => {
  const { root, service } = await setup(root => ({ trash: folderTrash(root) }));
  const plain = path.join(root, 'qualquer'); await mkdir(plain);
  await expect(service.deleteProject({ path: plain, confirmation: 'qualquer' })).rejects.toThrow();
  expect(await exists(plain)).toBe(true);
});
