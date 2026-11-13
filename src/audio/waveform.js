import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const run = promisify(execFile);
const cache = new Map();
const pending = new Map();

/** Envelope real do áudio, calculado em fluxo: memória constante mesmo em gravações longas. */
export async function audioWaveform(file, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' } = {}) {
  const info = await stat(file);
  const key = `${file}:${info.size}:${info.mtimeMs}`;
  if (cache.has(key)) return cache.get(key);
  if (pending.has(key)) return pending.get(key);
  const work = (async () => {
    const { stdout } = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file], { timeout: 30_000 });
    const duration = Number(JSON.parse(stdout).format?.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Áudio sem duração válida');
    const bins = 4000; const peaks = new Float32Array(bins);
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpeg, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let sample = 0; let tail = Buffer.alloc(0); let message = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Tempo esgotado ao ler as ondas do áudio')); }, 300_000);
      child.stdout.on('data', chunk => {
        const bytes = tail.length ? Buffer.concat([tail, chunk]) : chunk;
        const end = bytes.length - bytes.length % 4;
        for (let i = 0; i < end; i += 4) {
          const bin = Math.min(bins - 1, Math.floor(sample++ / (duration * 8000) * bins));
          const value = Math.abs(bytes.readFloatLE(i));
          if (Number.isFinite(value)) peaks[bin] = Math.max(peaks[bin], value);
        }
        tail = bytes.subarray(end);
      });
      child.stderr.on('data', data => { message = `${message}${data}`.slice(-2000); });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', code => { clearTimeout(timer); code === 0 && sample ? resolve() : reject(new Error(`Não foi possível ler as ondas do áudio: ${message}`)); });
    });
    const maximum = Math.max(...peaks, 0.001);
    const result = { duration, peaks: Array.from(peaks, value => Math.round(value / maximum * 1000) / 1000) };
    cache.set(key, result);
    if (cache.size > 24) cache.delete(cache.keys().next().value);
    return result;
  })();
  pending.set(key, work);
  try { return await work; } finally { pending.delete(key); }
}
