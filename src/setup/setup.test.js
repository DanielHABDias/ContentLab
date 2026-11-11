import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { downloadVerified } from './downloader.js';
import { SetupService } from './setup-service.js';
import { defaultCatalog } from './dependency-catalog.js';

const cleanups = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

const payload = randomBytes(256 * 1024);
const digest = createHash('sha256').update(payload).digest('hex');
const exists = target => stat(target).then(() => true, () => false);

async function temp() { const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-setup-')); cleanups.push(() => rm(root, { recursive: true, force: true })); return root; }

/** Servidor local com Range e falhas controladas. */
async function fileServer(options = {}) {
  const log = [];
  const server = createServer((request, response) => {
    const range = request.headers.range?.match(/bytes=(\d+)-/);
    const start = range && !options.ignoreRange ? Number(range[1]) : 0;
    log.push({ range: request.headers.range || null, start });
    const body = (options.body || payload).subarray(start);
    response.writeHead(start ? 206 : 200, { 'content-length': body.length });
    if (options.dropAfter && log.length === 1) { response.write(body.subarray(0, options.dropAfter)); setTimeout(() => response.destroy(), 20); return; }
    if (options.slow) { let offset = 0; const timer = setInterval(() => { if (offset >= body.length || response.destroyed) { clearInterval(timer); response.end(); return; } response.write(body.subarray(offset, offset + 8192)); offset += 8192; }, 5); response.on('close', () => clearInterval(timer)); return; }
    response.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return { url: `http://127.0.0.1:${server.address().port}/file`, log };
}

const local = { allowHttpHosts: ['127.0.0.1'] };
const bigDisk = async () => ({ bavail: 10n ** 12n, bsize: 1n });

test('baixa, verifica SHA-256 e promove sem deixar parcial; segunda vez não baixa', async () => {
  const root = await temp(); const server = await fileServer();
  const destination = path.join(root, 'bin', 'tool');
  await expect(downloadVerified({ url: server.url, destination, sha256: digest, size: payload.length, executable: true, ...local })).resolves.toMatchObject({ status: 'installed' });
  expect(await readFile(destination)).toEqual(payload);
  expect((await stat(destination)).mode & 0o111).toBeTruthy();
  expect(await exists(`${destination}.partial`)).toBe(false);
  await expect(downloadVerified({ url: server.url, destination, sha256: digest, size: payload.length, ...local })).resolves.toMatchObject({ status: 'already-installed' });
  expect(server.log).toHaveLength(1);
});

test('checksum incorreto descarta o parcial e não instala', async () => {
  const root = await temp(); const server = await fileServer({ body: Buffer.from(payload).fill(1, 0, 10) });
  const destination = path.join(root, 'model.bin');
  await expect(downloadVerified({ url: server.url, destination, sha256: digest, size: payload.length, ...local })).rejects.toMatchObject({ code: 'CHECKSUM_MISMATCH' });
  expect(await exists(destination)).toBe(false);
  expect(await exists(`${destination}.partial`)).toBe(false);
});

test('queda de rede preserva o parcial e a retomada usa Range sem recomeçar', async () => {
  const root = await temp(); const server = await fileServer({ dropAfter: 100_000 });
  const destination = path.join(root, 'model.bin');
  await expect(downloadVerified({ url: server.url, destination, sha256: digest, size: payload.length, ...local })).rejects.toMatchObject({ code: 'NETWORK', details: { resumable: true } });
  const kept = (await stat(`${destination}.partial`)).size;
  expect(kept).toBeGreaterThan(0);
  expect(await exists(destination)).toBe(false);
  await expect(downloadVerified({ url: server.url, destination, sha256: digest, size: payload.length, ...local })).resolves.toMatchObject({ status: 'installed' });
  expect(server.log[1]).toEqual({ range: `bytes=${kept}-`, start: kept });
  expect(await readFile(destination)).toEqual(payload);
});

test('servidor que ignora Range recomeça do zero sem corromper', async () => {
  const root = await temp(); const server = await fileServer({ ignoreRange: true });
  const destination = path.join(root, 'model.bin');
  await writeFile(`${destination}.partial`, payload.subarray(0, 5000));
  await expect(downloadVerified({ url: server.url, destination, sha256: digest, size: payload.length, ...local })).resolves.toMatchObject({ status: 'installed' });
  expect(await readFile(destination)).toEqual(payload);
});

test('pouco disco falha antes de baixar com instrução acionável', async () => {
  const root = await temp(); const server = await fileServer();
  const destination = path.join(root, 'model.bin');
  await expect(downloadVerified({ url: server.url, destination, sha256: digest, size: payload.length, statfsImpl: async () => ({ bavail: 10, bsize: 4096 }), ...local })).rejects.toMatchObject({ code: 'INSUFFICIENT_SPACE', message: expect.stringMatching(/necessários/) });
  expect(server.log).toHaveLength(0);
  expect(await exists(`${destination}.partial`)).toBe(false);
});

test('recusa HTTP externo e artefato sem checksum', async () => {
  const root = await temp();
  await expect(downloadVerified({ url: 'http://example.com/x', destination: path.join(root, 'x'), sha256: digest, size: 1 })).rejects.toMatchObject({ code: 'INSECURE_URL' });
  await expect(downloadVerified({ url: 'https://example.com/x', destination: path.join(root, 'x'), sha256: 'abc', size: 1 })).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
});

// ---- SetupService ----

function catalogWith(url) {
  return defaultCatalog().map(item => item.id === 'whisper-large-v3' ? { ...item, artifacts: { any: { url, size: payload.length, sha256: digest } } } : item);
}

function fakeRun(available = []) {
  return async (command, args) => {
    if (available.includes(command)) return { stdout: `${command} versão de teste\n`, stderr: '' };
    throw Object.assign(new Error('não encontrado'), { code: 'ENOENT' });
  };
}

async function service(root, url, extra = {}) {
  const osRelease = path.join(root, 'os-release');
  await writeFile(osRelease, 'PRETTY_NAME="Zorin OS 18"\nID=zorin\nID_LIKE="ubuntu debian"\n');
  return new SetupService({ toolsDirectory: path.join(root, 'tools'), catalog: catalogWith(url), platform: 'linux', arch: 'x64', nodeVersion: 'v24.1.0', run: fakeRun(['ffmpeg', 'ffprobe']), statfsImpl: bigDisk, osRelease, download: options => downloadVerified({ ...options, statfsImpl: bigDisk, ...local }), ...extra });
}

test('diagnóstico separa essenciais de IA e sugere comando do sistema', async () => {
  const root = await temp(); const setup = await service(root, 'http://127.0.0.1:1/x');
  const status = await setup.status();
  expect(status.platform).toMatchObject({ os: 'linux', packageManager: 'apt', distro: 'Zorin OS 18' });
  expect(status.essentialsReady).toBe(false);
  const byId = Object.fromEntries(status.items.map(item => [item.id, item]));
  expect(byId.ffmpeg).toMatchObject({ ready: true, group: 'essential' });
  expect(byId.zenity).toMatchObject({ ready: false, required: true, systemCommand: 'sudo apt install zenity' });
  expect(byId['whisper-large-v3']).toMatchObject({ ready: false, group: 'ai', installable: true, consent: true, downloadBytes: payload.length, license: expect.any(String), origin: expect.stringMatching(/^https:/) });
  expect(byId['chatterbox-pt-br']).toMatchObject({ ready: false, installable: true, kind: 'python' });
  expect(status.onboarding).toEqual({ completedAt: null, dismissedAt: null });
});

test('exige consentimento e recusa itens que não são instaláveis', async () => {
  const root = await temp(); const setup = await service(root, 'http://127.0.0.1:1/x');
  await expect(setup.install({ ids: ['whisper-large-v3'] })).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  await expect(setup.install({ ids: ['ffmpeg'] })).rejects.toMatchObject({ code: 'NOT_INSTALLABLE' });
  expect(setup.jobs()).toEqual([]);
});

test('instala, registra estado e a segunda inicialização não baixa novamente', async () => {
  const root = await temp(); const server = await fileServer();
  const setup = await service(root, server.url);
  const [job] = await setup.install({ ids: ['whisper-large-v3'], consent: ['whisper-large-v3'] });
  await expect(setup.waitFor(job.id)).resolves.toMatchObject({ state: 'completed', phase: 'Instalado e verificado', received: payload.length });
  const state = JSON.parse(await readFile(path.join(root, 'tools', 'setup-state.json'), 'utf8'));
  expect(state.items['whisper-large-v3']).toMatchObject({ sha256: digest, size: payload.length });
  const restarted = await service(root, server.url);
  expect((await restarted.status()).items.find(item => item.id === 'whisper-large-v3')).toMatchObject({ ready: true, managed: true });
  const [again] = await restarted.install({ ids: ['whisper-large-v3'], consent: ['whisper-large-v3'] });
  await expect(restarted.waitFor(again.id)).resolves.toMatchObject({ state: 'completed', phase: 'Já estava instalado' });
  expect(server.log).toHaveLength(1);
});

test('checksum novo no catálogo pede atualização em vez de aceitar a versão antiga', async () => {
  const root = await temp(); const server = await fileServer();
  const setup = await service(root, server.url);
  const [job] = await setup.install({ ids: ['whisper-large-v3'], consent: ['whisper-large-v3'] }); await setup.waitFor(job.id);
  const changed = new SetupService({ ...setup, toolsDirectory: setup.toolsDirectory, catalog: catalogWith(server.url).map(item => item.id === 'whisper-large-v3' ? { ...item, artifacts: { any: { url: server.url, size: payload.length, sha256: 'f'.repeat(64) } } } : item), platform: 'linux', arch: 'x64', run: fakeRun([]), statfsImpl: bigDisk });
  expect((await changed.status()).items.find(item => item.id === 'whisper-large-v3')).toMatchObject({ ready: false, installable: true, problem: expect.stringMatching(/atualize/) });
});

test('pausar preserva progresso, retomar conclui e cancelar remove o parcial', async () => {
  const root = await temp(); const server = await fileServer({ slow: true });
  const setup = await service(root, server.url);
  const [job] = await setup.install({ ids: ['whisper-large-v3'], consent: ['whisper-large-v3'] });
  await new Promise(resolve => { const timer = setInterval(() => { if (setup.jobs()[0].received > 20_000) { clearInterval(timer); resolve(); } }, 5); });
  setup.pause(job.id);
  await expect(setup.waitFor(job.id)).resolves.toMatchObject({ state: 'paused' });
  const partial = path.join(root, 'tools', 'models', 'ggml-large-v3.bin.partial');
  expect((await stat(partial)).size).toBeGreaterThan(0);
  const resumed = setup.resume(job.id);
  await expect(setup.waitFor(resumed.id)).resolves.toMatchObject({ state: 'completed' });
  expect(server.log.at(-1).range).toMatch(/^bytes=\d+-$/);

  const other = await temp(); const slow = await fileServer({ slow: true });
  const second = await service(other, slow.url);
  const [cancelJob] = await second.install({ ids: ['whisper-large-v3'], consent: ['whisper-large-v3'] });
  await new Promise(resolve => { const timer = setInterval(() => { if (second.jobs()[0].received > 0) { clearInterval(timer); resolve(); } }, 5); });
  await expect(second.cancel(cancelJob.id)).resolves.toMatchObject({ state: 'cancelled' });
  expect(await exists(path.join(other, 'tools', 'models', 'ggml-large-v3.bin.partial'))).toBe(false);
  expect(await exists(path.join(other, 'tools', 'models', 'ggml-large-v3.bin'))).toBe(false);
});

test('compilação falha com instrução quando faltam ferramentas e recusa commit divergente', async () => {
  const root = await temp();
  const setup = await service(root, 'http://127.0.0.1:1/x');
  const [job] = await setup.install({ ids: ['whisper-cli'], consent: ['whisper-cli'] });
  await expect(setup.waitFor(job.id)).resolves.toMatchObject({ state: 'failed', code: 'BUILD_TOOLS_MISSING', error: expect.stringMatching(/sudo apt install git cmake build-essential/) });

  const calls = [];
  const run = async (command, args) => { calls.push([command, ...args].join(' ')); if (command === 'git' && args.includes('rev-parse')) { if (calls.some(call => call.startsWith('git clone'))) return { stdout: 'deadbeef\n', stderr: '' }; throw new Error('sem repo'); } return { stdout: 'ok', stderr: '' }; };
  const tampered = await service(root, 'http://127.0.0.1:1/x', { run });
  const [build] = await tampered.install({ ids: ['whisper-cli'], consent: ['whisper-cli'] });
  await expect(tampered.waitFor(build.id)).resolves.toMatchObject({ state: 'failed', code: 'CHECKSUM_MISMATCH' });
  expect(calls.some(call => call.startsWith('cmake -S') || call.startsWith('cmake --build'))).toBe(false);
  expect(await exists(path.join(root, 'tools', 'bin', 'whisper-cli'))).toBe(false);
});

test('“Agora não” é lembrado entre inicializações', async () => {
  const root = await temp(); const setup = await service(root, 'http://127.0.0.1:1/x');
  await setup.setOnboarding('dismissed');
  expect((await (await service(root, 'http://127.0.0.1:1/x')).status()).onboarding.dismissedAt).toEqual(expect.any(String));
});

// ---- Chatterbox (ambiente Python isolado) ----

function pythonRun({ python = '3.12', pip = true, verify = true, calls = [] } = {}) {
  return async (command, args) => {
    calls.push([path.basename(command), ...args].join(' '));
    if (command === 'python3' && args[0] === '-c') { if (!python) throw Object.assign(new Error('não encontrado'), { code: 'ENOENT' }); return { stdout: `${python}\n`, stderr: '' }; }
    if (command === 'python') throw Object.assign(new Error('não encontrado'), { code: 'ENOENT' });
    if (command === 'python3' && args[1] === 'venv') { const { mkdir } = await import('node:fs/promises'); await mkdir(path.join(args[2], 'bin'), { recursive: true }); await writeFile(path.join(args[2], 'bin', 'python'), '#!/bin/sh\nprintf "%s|" "$CONTENTLAB_CHATTERBOX_MODEL" "$@"\n', { mode: 0o755 }); return { stdout: '', stderr: '' }; }
    if (args.includes('pip')) { if (!pip) throw Object.assign(new Error('pip'), { stderr: 'linha 1\nlinha 2\nERROR: No matching distribution found for torch==2.6.0' }); return { stdout: '', stderr: '' }; }
    if (args.includes('--fetch-weights')) return { stdout: '{"ok": true}', stderr: '' };
    if (args.includes('--check')) { if (!verify) throw Object.assign(new Error('check'), { stderr: 'ModuleNotFoundError: No module named torch' }); return { stdout: '{"ok": true}', stderr: '' }; }
    if (command === 'contentlab-chatterbox') throw Object.assign(new Error('não encontrado'), { code: 'ENOENT' });
    return { stdout: 'ok', stderr: '' };
  };
}

async function chatterboxSetup(root, run, downloads = []) {
  const repo = path.join(root, 'repo'); const { mkdir } = await import('node:fs/promises');
  await mkdir(path.join(repo, 'tools', 'chatterbox'), { recursive: true }); await writeFile(path.join(repo, 'tools', 'chatterbox', 'contentlab_chatterbox.py'), '# adaptador\n');
  return new SetupService({ toolsDirectory: path.join(root, "pasta d'Ferramentas"), platform: 'linux', arch: 'x64', run, statfsImpl: bigDisk, osRelease: path.join(root, 'nada'), repositoryRoot: repo, download: async options => { downloads.push(options); await mkdir(path.dirname(options.destination), { recursive: true }); await writeFile(options.destination, 'wheel'); return { status: 'installed', path: options.destination }; } });
}

test('Chatterbox é instalável: wheel verificado, venv isolado, pesos fixados e comando funcional', async () => {
  const root = await temp(); const calls = []; const downloads = [];
  const setup = await chatterboxSetup(root, pythonRun({ calls }), downloads);
  const item = (await setup.status()).items.find(entry => entry.id === 'chatterbox-pt-br');
  expect(item).toMatchObject({ kind: 'python', installable: true, consent: true, ready: false, downloadBytes: 6 * 1024 ** 3 });
  const [job] = await setup.install({ ids: ['chatterbox-pt-br'], consent: ['chatterbox-pt-br'] });
  await expect(setup.waitFor(job.id)).resolves.toMatchObject({ state: 'completed', phase: 'Instalado e verificado' });
  expect(downloads[0]).toMatchObject({ sha256: '83782500e3ad4e7c919132e9d7eb8755f29f57c5bde5ec48c655ca23a4eb113c', size: 108543 });
  expect(calls.some(call => call.includes('--fetch-weights') && call.includes('5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18'))).toBe(true);
  const shim = path.join(setup.toolsDirectory, 'bin', 'contentlab-chatterbox');
  const { execFileSync } = await import('node:child_process');
  const output = execFileSync(shim, ['--text', "olá 'mundo'"], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  expect(output).toBe(`${path.join(setup.toolsDirectory, 'models', 'chatterbox')}|${path.join(setup.toolsDirectory, 'venvs', 'chatterbox', 'contentlab_chatterbox.py')}|--text|olá 'mundo'|`);
  expect((await setup.status()).items.find(entry => entry.id === 'chatterbox-pt-br')).toMatchObject({ ready: true, managed: true });
  const pipCalls = calls.filter(call => call.includes('-m pip install')).length;
  const [again] = await setup.install({ ids: ['chatterbox-pt-br'], consent: ['chatterbox-pt-br'] });
  await expect(setup.waitFor(again.id)).resolves.toMatchObject({ phase: 'Já estava instalado' });
  expect(calls.filter(call => call.includes('-m pip install')).length).toBe(pipCalls);
});

test('Chatterbox sem Python, com pip falho ou verificação falha não fica instalado', async () => {
  const root = await temp();
  const noPython = await chatterboxSetup(root, pythonRun({ python: null }));
  const [first] = await noPython.install({ ids: ['chatterbox-pt-br'], consent: ['chatterbox-pt-br'] });
  await expect(noPython.waitFor(first.id)).resolves.toMatchObject({ state: 'failed', code: 'PYTHON_MISSING' });
  const oldPython = await chatterboxSetup(root, pythonRun({ python: '3.8' }));
  const [second] = await oldPython.install({ ids: ['chatterbox-pt-br'], consent: ['chatterbox-pt-br'] });
  await expect(oldPython.waitFor(second.id)).resolves.toMatchObject({ code: 'PYTHON_MISSING' });
  const pipFails = await chatterboxSetup(root, pythonRun({ pip: false }));
  const [third] = await pipFails.install({ ids: ['chatterbox-pt-br'], consent: ['chatterbox-pt-br'] });
  await expect(pipFails.waitFor(third.id)).resolves.toMatchObject({ code: 'PIP_FAILED', error: expect.stringMatching(/No matching distribution/) });
  const verifyFails = await chatterboxSetup(root, pythonRun({ verify: false }));
  const [fourth] = await verifyFails.install({ ids: ['chatterbox-pt-br'], consent: ['chatterbox-pt-br'] });
  await expect(verifyFails.waitFor(fourth.id)).resolves.toMatchObject({ code: 'VERIFY_FAILED' });
  const bin = path.join(verifyFails.toolsDirectory, 'bin');
  expect(await exists(path.join(bin, 'contentlab-chatterbox'))).toBe(false);
  expect(await exists(path.join(bin, 'contentlab-chatterbox.partial'))).toBe(false);
});
