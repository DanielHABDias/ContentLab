import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { NarrationService, VoiceProfileStore, VoxCPMVoice } from './narration-service.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
async function setup() { const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-audio-')); roots.push(root); const a = path.join(root, 'a.wav'); const b = path.join(root, 'b.wav'); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=1', a]); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1', b]); return { root, a, b, service: new NarrationService(path.join(root, 'narration')) }; }

test('organiza, corta, exclui e monta takes independentes', async () => {
  const { root, a, b, service } = await setup(); await service.createSession('project_audio');
  const first = await service.addTake('project_audio', a, { label: 'Gancho' }); const second = await service.addTake('project_audio', b, { label: 'Corpo' });
  await service.trimTake('project_audio', first.id, { start: 0, end: .5 });
  const output = path.join(root, 'narration.wav'); await service.assemble('project_audio', [first.id, second.id], output);
  expect((await stat(output)).size).toBeGreaterThan(1000);
  await service.deleteTake('project_audio', second.id); expect((await service.read('project_audio')).takes).toHaveLength(1);
});

test('tratamento gera áudio inteligível sem substituir origem', async () => {
  const { root, a, service } = await setup(); const output = path.join(root, 'treated.wav'); const before = await readFile(a);
  const result = await service.treat(a, output, { denoise: true, targetLufs: -16 });
  expect(result.filters.join()).toMatch(/loudnorm/); expect(await readFile(a)).toEqual(before); expect((await stat(output)).size).toBeGreaterThan(1000);
});

test('perfil de voz exige consentimento verificável', async () => {
  const { root, a } = await setup(); const store = new VoiceProfileStore(path.join(root, 'voices'));
  await expect(store.create({ name: 'Sem consentimento', samplePath: a, referenceText: 'Texto' })).rejects.toThrow(/consentimento/i);
  const profile = await store.create({ name: 'Daniel', samplePath: a, referenceText: 'Texto de referência', consent: { granted: true, holder: 'Daniel', grantedAt: '2026-11-11T00:00:00Z' } });
  expect(profile.model).toBe('voxcpm2');
});

const plan = (overrides = {}) => ({ status: 'ready', device: 'cpu', threads: 9, memoryLimitBytes: 12 * 1024 ** 3, memoryGuard: 'systemd', reasons: [], ...overrides });
const consented = (samplePath, extra = {}) => ({ samplePath, referenceText: 'Olá, eu sou o Daniel.', consent: { granted: true, holder: 'Daniel', grantedAt: '2026-11-11T00:00:00Z' }, ...extra });
async function runner(root) { const file = path.join(root, 'contentlab-voice'); await writeFile(file, '#!/bin/sh\necho "contentlab-voice 1"\n', { mode: 0o755 }); return file; }

test('VoxCPM2 diagnostica runtime ausente', async () => {
  const status = await new VoxCPMVoice({ runner: 'contentlab-voice-ausente', modelPath: '/x' }).diagnose();
  expect(status).toMatchObject({ model: 'voxcpm2', ready: false, issues: ['VoxCPM2 não instalado'] });
});

test('VoxCPM2 gera com teto de memória sem swap, núcleos do plano e calibra a velocidade', async () => {
  const { root, a } = await setup(); const calls = []; const measured = [];
  const spawnFile = (command, args, options, callback) => { calls.push({ command, args, env: options.env }); callback(null, '{"ok": true, "audioSeconds": 4.5, "generationSeconds": 123, "realtimeFactor": 27.3}\n', ''); };
  const voice = new VoxCPMVoice({ runner: await runner(root), modelPath: '/modelos/voxcpm2', planner: async () => plan(), onMeasured: async value => measured.push(value), spawnFile, platform: 'linux' });
  const result = await voice.generate({ text: 'Texto novo', profile: consented(a), output: path.join(root, 'saida', 'voz.wav') });
  expect(result).toMatchObject({ model: 'voxcpm2', device: 'cpu', realtimeFactor: 27.3 });
  expect(calls[0].command).toBe('systemd-run');
  expect(calls[0].args.slice(0, 8)).toEqual(['--user', '--scope', '--quiet', '-p', `MemoryMax=${12 * 1024 ** 3}`, '-p', 'MemorySwapMax=0', 'nice']);
  expect(calls[0].args).toEqual(expect.arrayContaining(['--threads', '9', '--device', 'cpu', '--reference-text', 'Olá, eu sou o Daniel.', '--text', 'Texto novo']));
  expect(calls[0].env).toMatchObject({ OMP_NUM_THREADS: '9', HF_HUB_OFFLINE: '1' });
  expect(measured).toEqual([{ device: 'cpu', realtimeFactor: 27.3 }]);
});

test('VoxCPM2 recusa sem consentimento, sem texto da amostra e sem memória livre; limite estourado vira erro claro', async () => {
  const { root, a } = await setup(); let calls = 0;
  const killed = (command, args, options, callback) => { calls += 1; callback(Object.assign(new Error('Killed'), { code: null, signal: 'SIGKILL' }), '', ''); };
  const voice = (planned, spawnFile = killed) => new VoxCPMVoice({ runner: path.join(root, 'contentlab-voice'), modelPath: '/m', planner: async () => planned, spawnFile, platform: 'linux' });
  await runner(root);
  await expect(voice(plan()).generate({ text: 'x', profile: { ...consented(a), consent: { granted: false } }, output: path.join(root, 'o.wav') })).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  await expect(voice(plan()).generate({ text: 'x', profile: consented(a, { referenceText: '' }), output: path.join(root, 'o.wav') })).rejects.toMatchObject({ code: 'REFERENCE_TEXT_REQUIRED' });
  await expect(voice(plan({ status: 'needs-free-memory', reasons: ['Feche programas'] })).generate({ text: 'x', profile: consented(a), output: path.join(root, 'o.wav') })).rejects.toMatchObject({ code: 'NEEDS_FREE_MEMORY', message: 'Feche programas' });
  await expect(voice(plan({ status: 'unsupported', reasons: ['RAM insuficiente'] })).generate({ text: 'x', profile: consented(a), output: path.join(root, 'o.wav') })).rejects.toMatchObject({ code: 'HARDWARE_UNSUPPORTED' });
  expect(calls).toBe(0);
  await expect(voice(plan()).generate({ text: 'x', profile: consented(a), output: path.join(root, 'o.wav') })).rejects.toMatchObject({ code: 'MEMORY_LIMIT', message: expect.stringMatching(/limite de memória \(12 GB\).*sem afetar o sistema/) });
});

test('sem systemd usa só prioridade baixa', () => {
  const voice = new VoxCPMVoice({ runner: 'contentlab-voice', platform: 'darwin' });
  expect(voice.command(plan({ memoryGuard: 'none' }), ['--x'])).toEqual(['nice', ['-n', '15', 'contentlab-voice', '--x']]);
});
