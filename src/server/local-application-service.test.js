import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { LocalApplicationService } from './local-application-service.js';
import { PackageService } from '../package/package-service.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

test('cria projeto real e o registra nos recentes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-app-')); roots.push(root);
  const service = new LocalApplicationService({ dataDirectory: path.join(root, 'data') });
  const created = await service.createProject({ title: 'Meu vídeo real', type: 'long', aspectRatio: '16:9', parentDirectory: path.join(root, 'workspace') });
  expect(created.project).toMatchObject({ id: 'meu_video_real', title: 'Meu vídeo real', revision: 1 });
  expect(await service.listProjects()).toMatchObject([{ id: 'meu_video_real', path: path.join(root, 'workspace', 'meu_video_real') }]);
});

test('cancelamento do seletor retorna null sem fingir sucesso', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-dialog-')); roots.push(root);
  const dialog = { chooseDirectory: async () => null, choosePackage: async () => null };
  const service = new LocalApplicationService({ dataDirectory: root, dialog });
  await expect(service.chooseDirectory({})).resolves.toEqual({ path: null });
  await expect(service.choosePackage({})).resolves.toEqual({ path: null });
});

test('importa pacote contentlab para um projeto real', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-import-')); roots.push(root);
  const sourceService = new LocalApplicationService({ dataDirectory: path.join(root, 'source-data') });
  const source = await sourceService.createProject({ title: 'Projeto empacotado', type: 'short', aspectRatio: '9:16' });
  const packagePath = path.join(root, 'project.contentlab');
  await new PackageService().exportContentLab(source.path, packagePath);
  const targetService = new LocalApplicationService({ dataDirectory: path.join(root, 'target-data') });
  const imported = await targetService.importPackage({ packagePath });
  expect(imported.project).toMatchObject({ id: 'projeto_empacotado', title: 'Projeto empacotado' });
  expect(await targetService.listProjects()).toHaveLength(1);
});
