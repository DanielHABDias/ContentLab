import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { VoiceProfileStore, VoxCPMVoice, editPlan, finishFilters, measureAudio, normalizeTreatment, renderParts, scenesFromScript, treatParts, treatmentFilters } from './narration-service.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
async function setup() { const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-audio-')); roots.push(root); const a = path.join(root, 'a.wav'); const b = path.join(root, 'b.wav'); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=4', a]); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1', b]); return { root, a, b }; }

test('monta trechos com corte não destrutivo em WAV 48 kHz mono', async () => {
  const { root, a, b } = await setup(); const before = await readFile(a);
  const output = await renderParts('ffmpeg', [{ file: a, start: 1, end: 2.5 }, { file: b }], path.join(root, 'out', 'montagem.wav'));
  expect(await measureAudio({}, output)).toMatchObject({ wav48kMono: true, durationSeconds: expect.closeTo(2.5, 1) });
  expect(await readFile(a)).toEqual(before);
});

test('tratamento valida parâmetros, aceita o formato antigo e mede loudness e pico', async () => {
  const { root, a } = await setup();
  expect(() => normalizeTreatment({ targetLufs: -5 })).toThrow(/LUFS/);
  expect(() => normalizeTreatment({ maxPauseSeconds: 5 })).toThrow(/Pausa/);
  expect(normalizeTreatment({ denoise: false, trimSilence: false, preset: 'warm' })).toMatchObject({ aiDenoise: false, trimPauses: false });
  const off = { aiDenoise: false, removeBreaths: false, trimPauses: false, compress: false, normalize: false };
  expect(treatmentFilters(off)).toEqual([]);
  expect(treatmentFilters({ ...off, aiDenoise: true, compress: true }).join(',')).toMatch(/^highpass=f=70:poles=2,acompressor=/);
  expect(finishFilters({ normalize: true, targetLufs: -16 }, -26)).toEqual(['volume=10dB', expect.stringMatching(/^alimiter/)]);
  await expect(treatParts('ffmpeg', [{ file: a }], path.join(root, 'x.wav'), { aiDenoise: true })).rejects.toMatchObject({ code: 'DEPENDENCY_MISSING' });
  const { target: treated } = await treatParts('ffmpeg', [{ file: a }], path.join(root, 'tratado.wav'), { ...off, compress: true, normalize: true, targetLufs: -16 });
  const measures = await measureAudio({}, treated);
  expect(measures.integratedLufs).toBeCloseTo(-16, 0);
  expect(measures.truePeakDb).toBeLessThanOrEqual(-1);
});

test('plano de edição encurta pausas e silencia o que fica entre as falas', () => {
  const speech = [{ start: 0.5, end: 2 }, { start: 5, end: 6 }];
  const both = editPlan(speech, 7, { maxPauseSeconds: 0.4 });
  expect(both.pieces).toEqual([{ silence: 0.2 }, { start: 0.42, end: 2.14 }, { silence: 0.4 }, { start: 4.92, end: 6.14 }, { silence: 0.2 }]);
  expect(both.removedSeconds).toBeCloseTo(7 - (0.2 + 1.72 + 0.4 + 1.22 + 0.2), 2);
  const keepBreaths = editPlan(speech, 7, { removeBreaths: false, maxPauseSeconds: 0.4 });
  expect(keepBreaths.pieces[2]).toEqual({ start: 2.14, end: 2.54 });
  expect(editPlan(speech, 7, { removeBreaths: false, trimPauses: false })).toBeNull();
  expect(editPlan([], 7, {})).toBeNull();
});

test('roteiro vira cenas só com o que é narrado', () => {
  expect(scenesFromScript({ hook: 'Oi.', development: 'A\n\nB', payoff: '  ', visual: 'Câmera', sources: 'x' }).map(scene => scene.label)).toEqual(['Abertura 1', 'Desenvolvimento 1', 'Desenvolvimento 2']);
});

test('direção visual entre colchetes não entra no texto falado', () => {
  const [scene] = scenesFromScript({ hook: 'Imagina um herói que nunca perde. [titulo]\nEm 1938, ele levantava um carro. [evidencia: action-comics-1.jpg]\n[aparte: surpreso]' });
  expect(scene.text).toBe('Imagina um herói que nunca perde. Em 1938, ele levantava um carro.');
  expect(scene.lines).toEqual([{ text: 'Imagina um herói que nunca perde.', direction: 'titulo' }, { text: 'Em 1938, ele levantava um carro.', direction: 'evidencia: action-comics-1.jpg' }]);
});

test('perfil de voz exige consentimento verificável', async () => {
  const { root, a } = await setup(); const store = new VoiceProfileStore(path.join(root, 'voices'));
  await expect(store.create({ name: 'Sem consentimento', holder: 'Daniel', samplePath: a, referenceText: 'Texto' })).rejects.toThrow(/consentimento/i);
  const profile = await store.create({ name: 'Daniel', holder: 'Daniel', consent: true, samplePath: a, referenceText: 'Texto de referência' });
  expect(profile).toMatchObject({ model: 'voxcpm2', consent: { granted: true, holder: 'Daniel' } });
  expect(await store.list()).toHaveLength(1);
  await store.remove(profile.id); expect(await store.list()).toEqual([]);
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

test('Q8 usa o motor nativo, a mesma referência e só promove o WAV depois de validar', async () => {
  const { root, a } = await setup(); const calls = [];
  const base = path.join(root, 'base.gguf'); const acoustic = path.join(root, 'acoustic.gguf');
  await writeFile(base, 'weights'); await writeFile(acoustic, 'weights');
  const spawnFile = (command, args, options, callback) => {
    calls.push({ command, args });
    const output = args[args.indexOf('--output') + 1];
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', a, '-ar', '48000', '-ac', '1', output]);
    callback(null, '', 'WAV saved');
  };
  const voice = new VoxCPMVoice({ runtime: 'native', runner: await runner(root), modelPath: base, acousticPath: acoustic, planner: async () => plan(), spawnFile, platform: 'linux' });
  const output = path.join(root, 'q8.wav');
  expect(await voice.generate({ text: 'Texto novo', profile: consented(a), output })).toMatchObject({ model: 'voxcpm2-q8-v1', audioSeconds: 4 });
  expect(calls[0].args).toEqual(expect.arrayContaining(['--cpu', '--stream', '--prompt-wav', a, '--prompt-text', 'Olá, eu sou o Daniel.', base, acoustic]));
  expect((await stat(output)).size).toBeGreaterThan(100);
  await expect(stat(`${output}.partial.wav`)).rejects.toMatchObject({ code: 'ENOENT' });
});
