import { execFileSync, spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('doctor retorna diagnóstico estruturado e não inventa recursos opcionais', () => {
  const result = spawnSync(process.execPath, ['scripts/bootstrap.mjs', '--check'], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.ready).toBe(true);
  expect(report.results.find(item => item.id === 'ffmpeg').ready).toBe(true);
  expect(report.results.find(item => item.id === 'whisper-large-v3').ready).toBe(false);
});
