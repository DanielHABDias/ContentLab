import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { UpdateService, canonical, compareVersions } from './update-service.js';
import { installLinux, linuxTargets, uninstallLinux } from './installer.js';
import { installedPaths, serverRoots } from '../server/app-paths.js';

const roots = []; afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const temp = async () => { const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-update-')); roots.push(root); return root; };
const keys = () => { const { publicKey, privateKey } = generateKeyPairSync('ed25519'); return { publicPem: publicKey.export({ type: 'spki', format: 'pem' }), privateKey }; };

async function bundle(root, version) {
  const name = `contentlab-${version}`; const dir = path.join(root, 'build', name);
  await mkdir(path.join(dir, 'app'), { recursive: true }); await mkdir(path.join(dir, 'bin'), { recursive: true }); await mkdir(path.join(dir, 'share'), { recursive: true });
  await writeFile(path.join(dir, 'app', 'package.json'), JSON.stringify({ version }));
  await writeFile(path.join(dir, 'bin', 'contentlab'), '#!/bin/sh\n'); await chmod(path.join(dir, 'bin', 'contentlab'), 0o755);
  await writeFile(path.join(dir, 'share', 'contentlab.svg'), '<svg/>');
  const archive = path.join(root, `${name}.tar.gz`);
  execFileSync('tar', ['-czf', archive, '-C', path.join(root, 'build'), name]);
  const data = await readFile(archive);
  return { dir, archive, sha256: createHash('sha256').update(data).digest('hex'), size: data.length };
}

function feed(manifest) { return async url => ({ ok: true, status: 200, json: async () => { expect(String(url)).toMatch(/stable\.json$/); return manifest; } }); }
const copyDownload = async ({ url, destination }) => { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, await readFile(new URL(url))); };

test('versões e caminhos instalados ficam separados do app', () => {
  expect(compareVersions('2.1.0', '2.0.9')).toBeGreaterThan(0); expect(compareVersions('2.1.0-beta.1', '2.1.0')).toBeLessThan(0);
  const linux = installedPaths({ env: {}, platform: 'linux', home: '/home/x' });
  expect(linux).toMatchObject({ app: '/home/x/.local/share/contentlab/app', data: '/home/x/.local/share/contentlab/data', cache: '/home/x/.cache/contentlab', projects: '/home/x/Content Lab' });
  expect(installedPaths({ env: { APPDATA: 'C:\\R', LOCALAPPDATA: 'C:\\L' }, platform: 'win32', home: 'C:\\U' }).data).toContain('ContentLab');
  expect(serverRoots({ env: { CONTENTLAB_INSTALLED: '1' }, repositoryRoot: '/repo', platform: 'linux', home: '/home/x' })).toMatchObject({ dataDirectory: linux.data, renderCacheDirectory: '/home/x/.cache/contentlab/render' });
  expect(serverRoots({ env: {}, repositoryRoot: '/repo' }).dataDirectory).toBe('/repo/.contentlab');
});

test('atualização assinada instala lado a lado, preserva dados e permite voltar', async () => {
  const root = await temp(); const home = path.join(root, 'home'); const targets = linuxTargets({ env: {}, home });
  const v1 = await bundle(root, '1.0.0'); const v2 = await bundle(root, '1.1.0');
  await installLinux({ source: v1.dir, targets });
  await mkdir(targets.data, { recursive: true }); await writeFile(path.join(targets.data, 'settings.json'), '{"meu":"dado"}');
  const { publicPem, privateKey } = keys();
  const manifest = { schema: 'contentlab-update-v1', channel: 'stable', version: '1.1.0', notes: 'Novidades', artifacts: { 'linux-x64': { url: `file://${v2.archive}`, sha256: v2.sha256, size: v2.size } } };
  manifest.signature = sign(null, Buffer.from(canonical(manifest)), privateKey).toString('base64');
  const service = new UpdateService({ appDirectory: targets.app, currentVersion: '1.0.0', publicKey: publicPem, feedUrl: 'https://updates.example/contentlab', target: 'linux-x64', fetchImpl: feed(manifest), download: copyDownload });
  expect(await service.check()).toMatchObject({ available: true, version: '1.1.0', notes: 'Novidades' });
  expect(await service.apply()).toMatchObject({ status: 'installed', version: '1.1.0', previous: '1.0.0', restartRequired: true });
  expect(await readlink(path.join(targets.app, 'current'))).toBe(path.join('versions', '1.1.0'));
  expect(JSON.parse(await readFile(path.join(targets.data, 'settings.json'), 'utf8'))).toEqual({ meu: 'dado' });
  expect(await service.rollback()).toMatchObject({ version: '1.0.0', previous: '1.1.0' });
  expect(await readlink(path.join(targets.app, 'current'))).toBe(path.join('versions', '1.0.0'));
});

test('manifesto adulterado, sem chave ou pacote com hash errado são recusados', async () => {
  const root = await temp(); const targets = linuxTargets({ env: {}, home: path.join(root, 'home') });
  const v1 = await bundle(root, '1.0.0'); const v2 = await bundle(root, '1.1.0'); await installLinux({ source: v1.dir, targets });
  const { publicPem, privateKey } = keys();
  const manifest = { schema: 'contentlab-update-v1', channel: 'stable', version: '1.1.0', notes: '', artifacts: { 'linux-x64': { url: `file://${v2.archive}`, sha256: v2.sha256, size: v2.size } } };
  manifest.signature = sign(null, Buffer.from(canonical(manifest)), privateKey).toString('base64');
  const tampered = { ...manifest, artifacts: { 'linux-x64': { ...manifest.artifacts['linux-x64'], url: 'https://evil.example/x.tar.gz' } } };
  const make = (extra = {}) => new UpdateService({ appDirectory: targets.app, currentVersion: '1.0.0', publicKey: publicPem, feedUrl: 'https://u.example/', target: 'linux-x64', download: copyDownload, ...extra });
  await expect(make({ fetchImpl: feed(tampered) }).check()).rejects.toMatchObject({ code: 'BAD_SIGNATURE' });
  await expect(make({ publicKey: null, fetchImpl: feed(manifest) }).check()).rejects.toMatchObject({ code: 'NO_SIGNING_KEY' });
  await expect(make().installArchive({ archive: v2.archive, version: '1.1.0', sha256: 'f'.repeat(64) })).rejects.toMatchObject({ code: 'CHECKSUM_MISMATCH' });
  await expect(make().installArchive({ archive: v2.archive, version: '9.9.9', sha256: v2.sha256 })).rejects.toMatchObject({ code: 'VERSION_MISMATCH' });
  expect(await readlink(path.join(targets.app, 'current'))).toBe(path.join('versions', '1.0.0'));
  await expect(new UpdateService({ appDirectory: null, currentVersion: '1.0.0' }).check()).rejects.toMatchObject({ code: 'NOT_INSTALLED' });
});

test('desinstalar remove só o que foi escolhido e projetos exigem frase exata', async () => {
  const root = await temp(); const targets = linuxTargets({ env: {}, home: path.join(root, 'home') });
  const v1 = await bundle(root, '1.0.0'); await installLinux({ source: v1.dir, targets });
  await mkdir(targets.projects, { recursive: true }); await writeFile(path.join(targets.projects, 'roteiro.txt'), 'meu vídeo');
  await mkdir(targets.tools, { recursive: true }); await writeFile(path.join(targets.tools, 'modelo.bin'), 'x');
  await expect(uninstallLinux({ targets, projects: true, confirmProjects: 'sim' })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
  const result = await uninstallLinux({ targets });
  expect(result.kept).toEqual(['cacheAndModels', 'settings', 'projects']);
  await expect(lstat(path.join(targets.binDir, 'contentlab'))).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(lstat(targets.app)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readFile(path.join(targets.projects, 'roteiro.txt'), 'utf8')).toBe('meu vídeo');
  expect(await readFile(path.join(targets.tools, 'modelo.bin'), 'utf8')).toBe('x');
});
