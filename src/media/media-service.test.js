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

test('áudio longo usa janelas independentes com sobreposição e tempos absolutos sem duplicar a borda', async () => {
  const directory = await root(); const source = path.join(directory, 'fala.wav');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '65', '-c:a', 'pcm_s16le', source]);
  const original = await readFile(source); const commands = []; const progress = []; let window = 0;
  const samples = [
    [{ text: 'Primeira', start: 1, end: 1.4 }, { text: 'borda', start: 29.8, end: 30.4 }],
    [{ text: 'borda', start: 1.8, end: 2.4 }, { text: 'meio', start: 12, end: 12.5 }, { text: 'limite', start: 31.9, end: 32.2 }],
    [{ text: 'limite', start: 1.9, end: 2.2 }, { text: 'fim', start: 6, end: 6.5 }],
  ];
  const execute = async (binary, args, options) => {
    commands.push({ binary, args });
    if (binary === 'fake-whisper') {
      const prefix = args[args.indexOf('-of') + 1];
      await writeFile(`${prefix}.json`, JSON.stringify({ transcription: samples[window++].map(w => ({ text: w.text, offsets: { from: w.start * 1000, to: w.end * 1000 }, tokens: [{ text: ` ${w.text}`, offsets: { from: w.start * 1000, to: w.end * 1000 } }] })) }));
      options.onStderr('progress = 50%');
    } else await writeFile(args.at(-1), args.includes('-vn') ? original : Buffer.alloc(0));
  };
  const transcriber = new PortugueseTranscriber({ binary: 'fake-whisper', execute });
  transcriber.diagnose = async () => ({ ready: true });
  const output = await transcriber.transcribe(source, { onProgress: p => progress.push(p.percent) });
  const { wordsFromWhisper } = await import('./transcript-store.js');
  const words = wordsFromWhisper(output.json);
  expect(words.map(w => w.text)).toEqual(['Primeira', 'borda', 'meio', 'limite', 'fim']);
  expect(words.map(w => w.start)).toEqual([1, 29.8, 40, 59.9, 64]);
  expect(output.srt).toContain('00:01:04,000');
  expect(commands.filter(c => c.binary === 'fake-whisper')).toHaveLength(3);
  expect(commands.filter(c => c.binary === 'fake-whisper').every(c => c.args[c.args.indexOf('-mc') + 1] === '0')).toBe(true);
  expect(commands.filter(c => c.args.includes('-ss')).map(c => c.args[c.args.indexOf('-ss') + 1])).toEqual(['0', '28', '58']);
  expect(progress.at(-1)).toBe(100); expect(progress).toEqual([...progress].sort((a, b) => a - b));
  expect(await readFile(source)).toEqual(original);
  const temporary = commands[0].args.at(-1);
  await expect(stat(temporary)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('reconhecimento em loop é sinalizado sem aceitar uma transcrição pronta', async () => {
  const { hasRunawayRepetition } = await import('./transcript-store.js');
  const phrase = 'Ele está aqui para ser o melhor'.split(' ').map(text => ({ text }));
  expect(hasRunawayRepetition(Array.from({ length: 10 }, () => phrase).flat())).toBe(true);
  expect(hasRunawayRepetition([...phrase, ...phrase])).toBe(false);
  expect(hasRunawayRepetition([{ text: 'Não.' }, { text: 'Não.' }])).toBe(false);
});
