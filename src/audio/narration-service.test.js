import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import { ChatterboxVoice, NarrationService, VoiceProfileStore } from './narration-service.js';

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
  expect(profile.model).toBe('chatterbox-multilingual-v3-pt-br');
});

test('voz usa um modelo PT-BR e diagnostica runtime ausente', async () => {
  const status = await new ChatterboxVoice({ runner: 'contentlab-chatterbox-ausente' }).diagnose();
  expect(status.model).toBe('chatterbox-multilingual-v3-pt-br'); expect(status.ready).toBe(false);
});
