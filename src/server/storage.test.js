import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { LocalApplicationService } from './local-application-service.js';
import { validateFolder } from './storage-service.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(async root => { await chmodTree(root); await rm(root, { recursive: true, force: true }); })));
async function chmodTree(root) { try { execFileSync('chmod', ['-R', 'u+rwX', root]); } catch { /* ignora */ } }
const exists = target => stat(target).then(() => true, () => false);
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

async function setup(options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-storage-')); roots.push(root);
  const make = (extra = {}) => new LocalApplicationService({ dataDirectory: path.join(root, 'data'), toolsDirectory: path.join(root, 'tools'), ...options, ...extra });
  const service = make(); await service.ready();
  return { root, service, make };
}
async function tone(root, name = 'tone.wav', frequency = 440) {
  const file = path.join(root, name);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=0.2`, file]);
  return file;
}

test('valida pasta com teste de escrita e recusa caminhos inválidos', async () => {
  const { root } = await setup();
  await expect(validateFolder('relativo/pasta')).rejects.toMatchObject({ code: 'INVALID_FOLDER' });
  await writeFile(path.join(root, 'arquivo'), 'x');
  await expect(validateFolder(path.join(root, 'arquivo'))).rejects.toMatchObject({ message: /é um arquivo/ });
  await expect(validateFolder(path.join(root, 'nova', 'pasta'))).resolves.toMatchObject({ writable: true, created: true, empty: true });
  expect(await readdir(path.join(root, 'nova', 'pasta'))).toEqual([]);
  if (!isRoot) {
    await mkdir(path.join(root, 'trancada')); await chmod(path.join(root, 'trancada'), 0o500);
    await expect(validateFolder(path.join(root, 'trancada'))).rejects.toMatchObject({ message: /não aceita escrita/ });
  }
});

test('mudar a raiz de projetos persiste, afeta só projetos novos e detecta conflito de revisão', async () => {
  const { root, service, make } = await setup();
  const before = await service.createProject({ title: 'Antigo', type: 'long', aspectRatio: '16:9' });
  const settings = await service.updateSettings({ baseRevision: 0, roots: { projects: path.join(root, 'novos') } });
  expect(settings).toMatchObject({ revision: 1, roots: { projects: { path: path.join(root, 'novos'), exists: true } } });
  await expect(service.updateSettings({ baseRevision: 0, limits: { minFreeBytes: 1 } })).rejects.toMatchObject({ code: 'SETTINGS_CONFLICT' });
  const restarted = make();
  const after = await restarted.createProject({ title: 'Novo', type: 'long', aspectRatio: '16:9' });
  expect(after.path).toBe(path.join(root, 'novos', 'novo'));
  expect(await exists(before.path)).toBe(true);
  expect((await restarted.listProjects()).map(card => card.id).sort()).toEqual(['antigo', 'novo']);
});

test('trocar raiz com dados exige decisão; “começar vazia” não move nem apaga nada', async () => {
  const { root, service } = await setup();
  const project = await service.createProject({ title: 'Mídia', type: 'long', aspectRatio: '16:9' });
  await service.importMedia({ path: project.path, baseRevision: 1, source: await tone(root), rights: 'owned' });
  await expect(service.updateSettings({ baseRevision: 0, roots: { media: path.join(root, 'cache2') } })).rejects.toMatchObject({ code: 'MIGRATION_DECISION_REQUIRED', details: { kind: 'media' } });
  await service.updateSettings({ baseRevision: 0, roots: { media: path.join(root, 'cache2') }, emptyRoots: ['media'] });
  expect(await readdir(path.join(root, 'data', 'media', 'objects'))).toHaveLength(1);
  expect((await service.inspectProject(project.path)).mediaStatus[0].available).toBe(true);
});

test('migração copia e verifica, troca a raiz, remove a origem e a mídia segue resolvida pelo hash', async () => {
  const captured = [];
  const renderer = { render: async project => { captured.push(project.media[0].uri); return { status: 'completed', output: 'x' }; } };
  const { root, service, make } = await setup({ renderer });
  const project = await service.createProject({ title: 'Migrar', type: 'long', aspectRatio: '16:9' });
  const imported = await service.importMedia({ path: project.path, baseRevision: 1, source: await tone(root), rights: 'owned' });
  const oldUri = imported.project.media[0].uri;
  const target = path.join(root, 'cache novo');
  const plan = await service.planMigration({ kind: 'media', target });
  expect(plan).toMatchObject({ files: 2, sufficient: true, conflicts: [] });
  const job = await service.startMigration({ kind: 'media', target, removeSource: true });
  await expect(service.storage.waitFor(job.id)).resolves.toMatchObject({ state: 'completed', phase: 'Migrado; origem removida' });
  expect(await exists(oldUri)).toBe(false);
  const restarted = make({ renderer });
  expect((await restarted.getSettings()).roots.media.path).toBe(target);
  const details = await restarted.inspectProject(project.path);
  expect(details.mediaStatus[0]).toMatchObject({ available: true, resolvedPath: expect.stringContaining('cache novo') });
  await restarted.renderProject({ path: project.path, outputDirectory: path.join(root, 'out') });
  expect(captured[0]).toContain('cache novo');
});

test('falha no meio da migração reverte o destino e mantém configuração e origem', async () => {
  if (isRoot) return;
  const { root, service } = await setup();
  await mkdir(path.join(root, 'data', 'render', 'a'), { recursive: true });
  await writeFile(path.join(root, 'data', 'render', 'a', 'ok.bin'), 'ok');
  await writeFile(path.join(root, 'data', 'render', 'z-bloqueado.bin'), 'segredo');
  await chmod(path.join(root, 'data', 'render', 'z-bloqueado.bin'), 0o000);
  const target = path.join(root, 'render2');
  const job = await service.startMigration({ kind: 'renderCache', target });
  await expect(service.storage.waitFor(job.id)).resolves.toMatchObject({ state: 'failed', phase: expect.stringMatching(/Revertido/) });
  expect(await readdir(target)).toEqual([]);
  expect((await service.getSettings()).roots.renderCache.path).toBe(path.join(root, 'data', 'render'));
  expect(await exists(path.join(root, 'data', 'render', 'a', 'ok.bin'))).toBe(true);
});

test('migrar ferramentas reescreve o estado e pede reinstalação só do ambiente Python', async () => {
  const { root, service } = await setup();
  const tools = path.join(root, 'tools');
  await mkdir(path.join(tools, 'bin'), { recursive: true }); await mkdir(path.join(tools, 'venvs', 'chatterbox', 'bin'), { recursive: true });
  await writeFile(path.join(tools, 'bin', 'yt-dlp'), 'binario'); await writeFile(path.join(tools, 'bin', 'contentlab-chatterbox'), 'shim'); await writeFile(path.join(tools, 'venvs', 'chatterbox', 'bin', 'python'), 'py');
  await writeFile(path.join(tools, 'setup-state.json'), JSON.stringify({ schema: 'contentlab-setup-v1', items: { 'yt-dlp': { path: path.join(tools, 'bin', 'yt-dlp'), sha256: 'a' }, 'chatterbox-pt-br': { path: path.join(tools, 'bin', 'contentlab-chatterbox') } }, onboarding: { completedAt: 'x' } }));
  const target = path.join(root, 'tools2');
  expect((await service.planMigration({ kind: 'tools', target })).notRelocatable).toMatch(/reinstalado/);
  const job = await service.startMigration({ kind: 'tools', target });
  await expect(service.storage.waitFor(job.id)).resolves.toMatchObject({ state: 'completed' });
  const state = JSON.parse(await readFile(path.join(target, 'setup-state.json'), 'utf8'));
  expect(state.items['yt-dlp'].path).toBe(path.join(target, 'bin', 'yt-dlp'));
  expect(state.items['chatterbox-pt-br']).toBeUndefined();
  expect(await exists(path.join(target, 'venvs'))).toBe(false);
  expect(service.setup.toolsDirectory).toBe(target);
});

test('uso de disco por categoria; limpeza padrão só remove derivados; órfãos exigem escolha e reconferência', async () => {
  const { root, service } = await setup();
  const project = await service.createProject({ title: 'Uso', type: 'long', aspectRatio: '16:9' });
  const used = await service.importMedia({ path: project.path, baseRevision: 1, source: await tone(root), rights: 'owned' });
  await service.media.importFile(await tone(root, 'orfao.wav', 880));
  await mkdir(path.join(root, 'data', 'media', 'cuts', 'ab'), { recursive: true }); await writeFile(path.join(root, 'data', 'media', 'cuts', 'ab', 'corte.mp4'), 'corte');
  const usage = await service.storageUsage();
  expect(usage.categories.objects.bytes).toBeGreaterThan(0);
  expect(usage.categories.cuts.bytes).toBe(5);
  expect(usage.categories.projects.count).toBe(1);
  const { orphans } = await service.storageOrphans();
  expect(orphans).toHaveLength(1);
  const cleaned = await service.storageCleanup({});
  expect(cleaned.removed).toContain('cortes');
  expect(await readdir(path.join(root, 'data', 'media', 'objects'))).toHaveLength(2);
  await expect(service.storageCleanup({ derived: false, orphanHashes: [used.project.media[0].sha256] })).rejects.toMatchObject({ code: 'MEDIA_IN_USE' });
  await service.storageCleanup({ derived: false, orphanHashes: [orphans[0].hash] });
  expect((await service.storageOrphans()).orphans).toEqual([]);
  expect((await service.inspectProject(project.path)).mediaStatus[0].available).toBe(true);
});

test('registro corrompido é recuperado do backup ou por varredura, sem perder projetos', async () => {
  const { root, service, make } = await setup();
  await service.createProject({ title: 'Primeiro', type: 'long', aspectRatio: '16:9' });
  await service.createProject({ title: 'Dois', type: 'long', aspectRatio: '16:9' });
  const file = path.join(root, 'data', 'recent-projects.json');
  await writeFile(file, '{ corrompido');
  const fromBackup = make();
  expect((await fromBackup.listProjects()).length).toBeGreaterThanOrEqual(1);
  expect(fromBackup.registry.lastRecovery).toMatchObject({ source: 'backup' });
  await writeFile(file, 'lixo'); await writeFile(`${file}.bak`, 'lixo');
  const fromScan = make();
  expect((await fromScan.listProjects()).map(card => card.id).sort()).toEqual(['dois', 'primeiro']);
  expect(fromScan.registry.lastRecovery).toMatchObject({ source: 'scan', recovered: 2 });
  expect((await readdir(path.join(root, 'data'))).some(name => name.startsWith('recent-projects.corrupted-'))).toBe(true);
});

test('backup e restauração do registro', async () => {
  const { service } = await setup();
  await service.createProject({ title: 'Guardado', type: 'long', aspectRatio: '16:9' });
  const backup = await service.backupRegistry();
  await service.forgetProject({ path: (await service.listProjects())[0].path });
  expect(await service.listProjects()).toEqual([]);
  const [{ name }] = (await service.listRegistryBackups()).backups;
  expect(backup.path).toContain(name);
  await service.restoreRegistry({ name });
  expect((await service.listProjects()).map(card => card.id)).toEqual(['guardado']);
  await expect(service.restoreRegistry({ name: '../../etc/passwd' })).rejects.toThrow(/inválido/);
});

test('projeto movido é relocalizado; pasta de outro projeto é recusada', async () => {
  const { root, service } = await setup();
  const created = await service.createProject({ title: 'Movido', type: 'long', aspectRatio: '16:9' });
  const other = await service.createProject({ title: 'Outro', type: 'long', aspectRatio: '16:9', parentDirectory: path.join(root, 'outros') });
  const moved = path.join(root, 'novo lugar', 'movido');
  await mkdir(path.dirname(moved), { recursive: true }); await rename(created.path, moved);
  expect((await service.listProjects()).find(card => card.id === 'movido').status).toBe('missing');
  await expect(service.relocateProject({ path: created.path, newPath: other.path })).rejects.toMatchObject({ code: 'PROJECT_MISMATCH' });
  const relocated = await service.relocateProject({ path: created.path, newPath: moved });
  expect(relocated.path).toBe(moved);
  expect((await service.listProjects()).find(card => card.id === 'movido')).toMatchObject({ status: 'ready', path: moved });
});
