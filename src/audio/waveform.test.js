import { afterEach, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { audioWaveform } from './waveform.js';
const roots = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
test('ondas vêm do áudio real: distingue silêncio de fala e compartilha o resultado em cache', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-wave-')); roots.push(root);
  const file = path.join(root, 'teste.wav');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=400:duration=2', '-af', "volume=enable='lt(t,1)':volume=0", file]);
  const [a, b] = await Promise.all([audioWaveform(file), audioWaveform(file)]);
  expect(a).toBe(b); expect(a.duration).toBeCloseTo(2, 1); expect(a.peaks).toHaveLength(4000);
  expect(Math.max(...a.peaks.slice(0, 1800))).toBe(0);
  expect(Math.max(...a.peaks.slice(2400))).toBeGreaterThan(0.9);
  expect(await audioWaveform(file)).toBe(a);
});
