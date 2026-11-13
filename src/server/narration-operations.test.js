import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { LocalApplicationService } from './local-application-service.js';
import { createContentLabServer } from './http-server.js';
import { measureAudio, scenesFromScript, treatmentFilters } from '../audio/narration-service.js';
import { mkdir, writeFile } from 'node:fs/promises';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const exists = target => stat(target).then(() => true, () => false);
const ALL = ['ffmpeg', 'ffprobe', 'zenity', 'yt-dlp', 'whisper-cli', 'whisper-large-v3', 'voxcpm2'];
const plan = { status: 'ready', device: 'cpu', threads: 4, memoryLimitBytes: 8 * 1024 ** 3, memoryGuard: 'none', reasons: [], estimate: { realtimeFactor: 30, source: 'medido' } };
function fakeSetup({ ready = ALL } = {}) {
  return { toolsDirectory: '/x', status: async () => ({ items: ALL.map(id => ({ id, label: id, ready: ready.includes(id) })) }), toolPath: async name => name, modelPath: () => '/x/model', jobs: () => [], voicePlan: async () => plan, recordCalibration: async () => {} };
}
/** Voz simulada: gera um tom com a duração aproximada da fala, respeitando cancelamento. */
function fakeVoice(calls, { delay = 0 } = {}) {
  return async () => ({ generate: async ({ text, profile, output, signal }) => {
    calls.push({ text, profile: profile.id });
    if (delay) await new Promise((resolve, reject) => { const timer = setTimeout(resolve, delay); signal?.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('Cancelado'), { code: 'CANCELLED' })); }); });
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=300:duration=${Math.max(1, text.length / 15)}`, '-ar', '48000', '-ac', '1', '-y', output]);
    return { path: output };
  } });
}
async function setup({ ready, voice } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-narration-')); roots.push(root);
  const calls = [];
  const service = new LocalApplicationService({ dataDirectory: path.join(root, 'data'), setup: fakeSetup({ ready }), voice: voice || fakeVoice(calls) });
  const project = await service.createProject({ title: 'Narração', type: 'long', aspectRatio: '16:9' });
  return { root, service, project, calls };
}
function tone(root, name, { frequency = 440, duration = 2, volume = 0.5 } = {}) {
  const file = path.join(root, name);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${duration}`, '-af', `volume=${volume}`, '-ar', '44100', '-ac', '2', file]);
  return file;
}
async function writeScript(service, project, script) {
  const details = await service.inspectProject(project.path);
  await service.runProjectAction({ path: project.path, baseRevision: details.project.revision, action: { type: 'creative.update', creative: { ...details.project.creative, script: { ...details.project.creative.script, ...script } } } });
}

test('takes importados preservam o original e aceitam renomear, cortar, reordenar e excluir', async () => {
  const { root, service, project } = await setup();
  const a = tone(root, 'gancho.wav'); const b = tone(root, 'corpo.mp3', { frequency: 330, duration: 3 });
  const imported = await service.narrationImport({ path: project.path, sources: [a, b, path.join(root, 'ausente.wav')] });
  expect(imported).toMatchObject({ imported: 2, failed: 1 });
  let { narration } = await service.narrationState({ path: project.path });
  const [first, second] = narration.takes;
  expect(first).toMatchObject({ name: 'gancho', origin: 'import', durationSeconds: expect.closeTo(2, 1), trim: null });
  const store = path.join(project.path, 'narration');
  expect(await readFile(path.join(store, first.original))).toEqual(await readFile(a));
  expect(await measureAudio({}, path.join(store, first.file))).toMatchObject({ wav48kMono: true, sampleRate: 48000, channels: 1 });

  ({ narration } = await service.narrationUpdateTake({ path: project.path, baseRevision: narration.revision, takeId: first.id, name: 'Abertura', trim: { start: 0.5, end: 1.5 } }));
  expect(narration.takes[0]).toMatchObject({ name: 'Abertura', trim: { start: 0.5, end: 1.5 } });
  await expect(service.narrationUpdateTake({ path: project.path, baseRevision: narration.revision - 1, takeId: first.id, name: 'X' })).rejects.toMatchObject({ code: 'NARRATION_CONFLICT' });
  await expect(service.narrationUpdateTake({ path: project.path, baseRevision: narration.revision, takeId: first.id, trim: { start: 0, end: 9 } })).rejects.toThrow(/Corte inválido/);
  ({ narration } = await service.narrationReorder({ path: project.path, baseRevision: narration.revision, order: [second.id, first.id] }));
  expect(narration.takes.map(take => take.id)).toEqual([second.id, first.id]);
  ({ narration } = await service.narrationDeleteTake({ path: project.path, baseRevision: narration.revision, takeId: second.id }));
  expect(narration.takes).toHaveLength(1);
  expect(await exists(path.join(store, 'takes', second.id))).toBe(false);
  expect(await readFile(a)).toBeTruthy();
});

test('preview A/B e montagem tratada geram WAV 48 kHz mono medido e vinculado ao projeto', async () => {
  const { root, service, project } = await setup();
  await service.narrationImport({ path: project.path, sources: [tone(root, 'a.wav', { volume: 0.1, duration: 4 }), tone(root, 'b.wav', { frequency: 300, volume: 0.1, duration: 4 })] });
  const { narration } = await service.narrationState({ path: project.path });
  const ids = narration.takes.map(take => take.id);
  await service.narrationUpdateTake({ path: project.path, baseRevision: narration.revision, takeId: ids[0], trim: { start: 1, end: 3 } });
  const treatment = { aiDenoise: false, removeBreaths: false, trimPauses: false, compress: true, normalize: true, targetLufs: -16 };
  expect(treatmentFilters(treatment).join(',')).toMatch(/^acompressor=/);
  await expect(service.narrationPreview({ path: project.path, takeIds: ids, treatment: { ...treatment, aiDenoise: true } })).rejects.toMatchObject({ code: 'DEPENDENCY_MISSING' });
  const preview = await service.narrationPreview({ path: project.path, takeIds: ids, treatment });
  expect(preview.original.measures.durationSeconds).toBeCloseTo(6, 0);
  expect(preview.treated.measures.integratedLufs).toBeGreaterThan(preview.original.measures.integratedLufs + 3);
  const file = await service.narrationFile({ path: project.path, preview: preview.treated.file });
  expect(file.contentType).toBe('audio/wav');

  const job = await service.narrationAssemble({ path: project.path, takeIds: ids, treatment });
  const done = await service.mediaOps.jobs.waitFor(job.id);
  expect(done.state).toBe('completed');
  expect(done.result.measures).toMatchObject({ wav48kMono: true, durationSeconds: expect.closeTo(6, 0) });
  expect(done.result.measures.integratedLufs).toBeGreaterThan(-19);
  expect(done.result.measures.truePeakDb).toBeLessThan(0);
  const media = (await service.inspectProject(project.path)).project.media;
  expect(media).toEqual([expect.objectContaining({ id: done.result.mediaId, kind: 'audio', rights: 'owned', name: 'Narração montada' })]);
  const state = await service.narrationState({ path: project.path });
  expect(state.narration.assembled).toMatchObject({ takeIds: ids, mediaId: done.result.mediaId, treatment: { aiDenoise: false, normalize: true } });
});

test('gravação enviada pelo navegador vira take; perfil exige consentimento, texto e amostra válida', async () => {
  const { root, service, project } = await setup();
  const server = createContentLabServer({ application: service });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const body = await readFile(tone(root, 'mic.wav', { duration: 5 }));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/narration/upload?path=${encodeURIComponent(project.path)}&name=mic.wav&origin=recording`, { method: 'POST', headers: { 'x-contentlab-client': '1' }, body });
    expect(response.status).toBe(201);
    const { take } = await response.json();
    expect(take).toMatchObject({ origin: 'recording', name: expect.stringMatching(/^Gravação/) });
    const base = { path: project.path, takeId: take.id, name: 'Minha voz', holder: 'Daniel', referenceText: 'Olá, este é o texto lido.' };
    await expect(service.voiceProfileCreate({ ...base, consent: false })).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    await expect(service.voiceProfileCreate({ ...base, consent: true, referenceText: ' ' })).rejects.toMatchObject({ code: 'REFERENCE_TEXT_REQUIRED' });
    const { profile } = await service.voiceProfileCreate({ ...base, consent: true });
    expect(profile).toMatchObject({ name: 'Minha voz', consent: { granted: true, holder: 'Daniel' }, durationSeconds: expect.closeTo(5, 0), model: 'voxcpm2' });
    expect(profile.samplePath).toBeUndefined();
    await service.narrationImport({ path: project.path, sources: [tone(root, 'curto.wav', { duration: 1 })] });
    const short = (await service.narrationState({ path: project.path })).narration.takes.at(-1);
    await expect(service.voiceProfileCreate({ ...base, takeId: short.id, consent: true })).rejects.toThrow(/3 a 60 segundos/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('voz clonada fica bloqueada sem VoxCPM2 instalado', async () => {
  const { root, service, project } = await setup({ ready: ALL.filter(id => id !== 'voxcpm2') });
  await writeScript(service, project, { hook: 'Olá.' });
  const profile = await makeProfile(service, project, root);
  await expect(service.voiceGenerate({ path: project.path, profileId: profile.id })).rejects.toMatchObject({ code: 'DEPENDENCY_MISSING' });
});

test('gera por cena em fila, reaproveita cache e só refaz cenas cujo texto mudou', async () => {
  const { root, service, project, calls } = await setup();
  await writeScript(service, project, { hook: 'Você já reparou nisso?', development: 'Primeiro ponto do vídeo.\n\nSegundo ponto do vídeo.', payoff: '', visual: 'Não narrar isto.' });
  expect(scenesFromScript((await service.inspectProject(project.path)).project.creative.script).map(scene => scene.id)).toEqual(['hook-1', 'development-1', 'development-2']);
  const profile = await makeProfile(service, project, root);
  let done = await service.mediaOps.jobs.waitFor((await service.voiceGenerate({ path: project.path, profileId: profile.id })).id);
  expect(done).toMatchObject({ state: 'completed', result: { generated: 3, cached: 0 }, progress: { done: 3, total: 3 } });
  done = await service.mediaOps.jobs.waitFor((await service.voiceGenerate({ path: project.path, profileId: profile.id })).id);
  expect(done.result).toMatchObject({ generated: 0, cached: 3 });
  expect(calls).toHaveLength(3);

  await writeScript(service, project, { development: 'Primeiro ponto do vídeo.\n\nSegundo ponto, reescrito.' });
  let state = await service.narrationState({ path: project.path });
  expect(state.narration.takes.filter(take => take.stale).map(take => take.sceneId)).toEqual(['development-2']);
  expect(state.scenes.find(scene => scene.id === 'development-2').generated[profile.id]).toBeNull();
  done = await service.mediaOps.jobs.waitFor((await service.voiceGenerate({ path: project.path, profileId: profile.id })).id);
  expect(done.result).toMatchObject({ generated: 1, cached: 2 });
  expect(calls.at(-1).text).toBe('Segundo ponto, reescrito.');
  state = await service.narrationState({ path: project.path });
  expect(state.narration.takes.filter(take => take.origin === 'generated')).toHaveLength(4);
  expect(state.narration.takes.filter(take => take.origin === 'generated').every(take => take.durationSeconds > 0.5)).toBe(true);
});

test('geração pode ser cancelada e não roda duas ao mesmo tempo', async () => {
  const calls = [];
  const { root, service, project } = await setup({ voice: fakeVoice(calls, { delay: 2000 }) });
  await writeScript(service, project, { hook: 'Uma cena longa o bastante.' });
  const profile = await makeProfile(service, project, root);
  const job = await service.voiceGenerate({ path: project.path, profileId: profile.id });
  await expect(service.voiceGenerate({ path: project.path, profileId: profile.id })).rejects.toMatchObject({ code: 'VOICE_BUSY' });
  await new Promise(resolve => setTimeout(resolve, 100));
  service.cancelJob({ jobId: job.id });
  expect((await service.mediaOps.jobs.waitFor(job.id)).state).toBe('cancelled');
  expect((await service.narrationState({ path: project.path })).narration.takes.filter(take => take.origin === 'generated')).toHaveLength(0);
});

test('excluir perfil mostra relatório e remove takes gerados e a montagem que os usa', async () => {
  const { root, service, project } = await setup();
  await writeScript(service, project, { hook: 'Cena para apagar.' });
  const profile = await makeProfile(service, project, root);
  await service.mediaOps.jobs.waitFor((await service.voiceGenerate({ path: project.path, profileId: profile.id })).id);
  const state = await service.narrationState({ path: project.path });
  const generated = state.narration.takes.find(take => take.origin === 'generated');
  const assembled = await service.mediaOps.jobs.waitFor((await service.narrationAssemble({ path: project.path, takeIds: [generated.id], treatment: { aiDenoise: false, removeBreaths: false, trimPauses: false } })).id);
  expect(assembled.state).toBe('completed');

  const report = await service.voiceProfileReport({ profileId: profile.id });
  expect(report).toMatchObject({ takes: 1, projects: [{ path: project.path, assembled: true, mediaId: assembled.result.mediaId, takes: [{ id: generated.id }] }] });
  expect(report.bytes).toBeGreaterThan(1000);
  await expect(service.voiceProfileDelete({ profileId: profile.id })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
  const result = await service.voiceProfileDelete({ profileId: profile.id, confirm: true });
  expect(result).toMatchObject({ deleted: true, failures: [] });
  const after = await service.narrationState({ path: project.path });
  expect(after.profiles).toEqual([]);
  expect(after.narration.takes.map(take => take.origin)).toEqual(['import']);
  expect(after.narration.assembled).toBeNull();
  expect((await service.inspectProject(project.path)).project.media).toEqual([]);
  expect(await exists(path.join(project.path, 'narration', 'takes', generated.id))).toBe(false);
});

async function makeProfile(service, project, root) {
  await service.narrationImport({ path: project.path, sources: [tone(root, `amostra-${Date.now()}.wav`, { duration: 5 })] });
  const take = (await service.narrationState({ path: project.path })).narration.takes.at(-1);
  const { narration } = await service.narrationState({ path: project.path });
  await service.narrationUpdateTake({ path: project.path, baseRevision: narration.revision, takeId: take.id, name: 'Amostra' });
  const { profile } = await service.voiceProfileCreate({ path: project.path, takeId: take.id, name: 'Minha voz', holder: 'Daniel', consent: true, referenceText: 'Texto lido.' });
  return profile;
}

test('outra geração de voz em outro processo vivo bloqueia a nova', async () => {
  const { root, service, project } = await setup();
  await writeScript(service, project, { hook: 'Cena.' });
  const profile = await makeProfile(service, project, root);
  const lock = path.join(root, 'data', 'voices', '.generation');
  await mkdir(lock, { recursive: true });
  await writeFile(path.join(lock, '.contentlab.lock'), JSON.stringify({ pid: process.ppid, hostname: os.hostname(), operation: 'geração de voz', startedAt: '2026-11-11T00:00:00Z' }));
  await expect(service.voiceGenerate({ path: project.path, profileId: profile.id })).rejects.toMatchObject({ code: 'VOICE_BUSY' });
  await writeFile(path.join(lock, '.contentlab.lock'), JSON.stringify({ pid: 999999, hostname: os.hostname(), operation: 'geração de voz', startedAt: '2026-11-11T00:00:00Z' }));
  expect((await service.mediaOps.jobs.waitFor((await service.voiceGenerate({ path: project.path, profileId: profile.id })).id)).state).toBe('completed');
  expect(await exists(path.join(lock, '.contentlab.lock'))).toBe(false);
});
