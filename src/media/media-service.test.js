import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import { MediaService, PortugueseTranscriber } from './media-service.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
async function root() { const value = await mkdtemp(path.join(os.tmpdir(), 'contentlab-media-')); roots.push(value); return value; }

test('importação por conteúdo reutiliza o mesmo objeto', async () => {
  const directory = await root();
  const source = path.join(directory, 'tone.wav');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', source]);
  const service = new MediaService(path.join(directory, 'cache'));
  const first = await service.importFile(source);
  const second = await service.importFile(source);
  expect(second.path).toBe(first.path);
  expect(second.hash).toBe(first.hash);
});

test('múltiplos cortes são cacheados sem alterar a fonte', async () => {
  const directory = await root();
  const source = path.join(directory, 'source.mp4');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:d=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', source]);
  const original = await readFile(source);
  const service = new MediaService(path.join(directory, 'cache'));
  const first = await service.cut(source, { start: 0, end: 1, name: 'abertura' });
  const reused = await service.cut(source, { start: 0, end: 1, name: 'abertura' });
  const second = await service.cut(source, { start: 1, end: 2, name: 'meio' });
  expect(reused.reused).toBe(true);
  expect(second.path).not.toBe(first.path);
  expect(await readFile(source)).toEqual(original);
});

test('limpeza explícita preserva originais por padrão', async () => {
  const directory = await root();
  const source = path.join(directory, 'tone.wav'); await writeFile(source, 'not-media');
  const cache = path.join(directory, 'cache'); await writeFile(path.join(directory, 'keep'), 'ok');
  const service = new MediaService(cache);
  expect((await service.clear()).removed).toEqual(['cuts']);
  expect((await stat(path.join(directory, 'keep'))).isFile()).toBe(true);
});

test('transcritor mantém modelo único e diagnostica instalação ausente', async () => {
  const result = await new PortugueseTranscriber({ binary: 'contentlab-whisper-ausente' }).diagnose();
  expect(result.model).toBe('whisper-large-v3');
  expect(result.ready).toBe(false);
  expect(result.issues.join(' ')).toMatch(/ausente/i);
});
