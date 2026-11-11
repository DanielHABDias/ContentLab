import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export class MediaService {
  constructor(root, tools = {}) {
    this.root = path.resolve(root);
    this.ffmpeg = tools.ffmpeg || 'ffmpeg';
    this.ffprobe = tools.ffprobe || 'ffprobe';
    this.ytDlp = tools.ytDlp || 'yt-dlp';
  }

  async importFile(source) {
    const absolute = path.resolve(source);
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error('A origem precisa ser um arquivo');
    const hash = await sha256File(absolute);
    const extension = safeExtension(absolute);
    const directory = path.join(this.root, 'objects', hash.slice(0, 2));
    const target = path.join(directory, `${hash}${extension}`);
    await mkdir(directory, { recursive: true });
    try { await stat(target); } catch (error) { if (error.code !== 'ENOENT') throw error; await copyFile(absolute, target); }
    const metadata = await this.probe(target);
    await this.#writeIndex(hash, { hash, path: target, source: absolute, size: info.size, metadata });
    return { id: `media_${hash.slice(0, 16)}`, hash, path: target, reused: absolute !== target && await exists(target), metadata };
  }

  async importUrl(url, { signal, ytDlp = this.ytDlp } = {}) {
    let parsed;
    try { parsed = new URL(url); } catch { throw Object.assign(new Error('URL inválida'), { code: 'INVALID_URL' }); }
    if (parsed.protocol !== 'https:') throw Object.assign(new Error('Somente URLs HTTPS são aceitas'), { code: 'INVALID_URL' });
    if (/(^|\.)(localhost|local)$/.test(parsed.hostname) || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(parsed.hostname) || parsed.hostname === '[::1]') throw Object.assign(new Error('Endereços locais ou de rede interna não são aceitos'), { code: 'INVALID_URL' });
    if (parsed.pathname.startsWith('/playlist') || (parsed.searchParams.has('list') && !parsed.searchParams.has('v'))) throw Object.assign(new Error('Playlists não são aceitas; use o link de um único vídeo'), { code: 'PLAYLIST_REFUSED' });
    const staging = path.join(this.root, 'staging', randomUUID());
    await mkdir(staging, { recursive: true });
    const target = path.join(staging, 'source.%(ext)s');
    try {
      await runAbortable(ytDlp, ['--no-playlist', '--max-filesize', '4G', '--restrict-filenames', '--merge-output-format', 'mp4', '-o', target, '--', url], { signal, timeout: 30 * 60_000 });
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(staging);
      if (files.length !== 1) throw new Error('O download não produziu uma mídia única');
      return await this.importFile(path.join(staging, files[0]));
    } catch (error) {
      if (error.code === 'ENOENT') throw Object.assign(new Error('yt-dlp não está disponível; instale em Dependências'), { code: 'DEPENDENCY_MISSING', details: { missing: ['yt-dlp'] } });
      if (error.code === 'CANCELLED') throw error;
      throw new Error(`Falha ao baixar mídia: ${error.message}`);
    } finally { await rm(staging, { recursive: true, force: true }); }
  }

  async cut(mediaPath, { start, end, name = 'cut' }) {
    if (!(start >= 0) || !(end > start)) throw new Error('Intervalo de corte inválido');
    const source = path.resolve(mediaPath);
    const hash = createHash('sha256').update(`${await sha256File(source)}:${start}:${end}`).digest('hex');
    const directory = path.join(this.root, 'cuts', hash.slice(0, 2));
    const target = path.join(directory, `${sanitize(name)}-${hash.slice(0, 12)}.mp4`);
    await mkdir(directory, { recursive: true });
    if (await exists(target)) return { path: target, hash, reused: true };
    try { await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-ss', String(start), '-to', String(end), '-i', source, '-map', '0:v?', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', target], { timeout: 30 * 60_000, maxBuffer: 4 * 1024 * 1024 }); }
    catch (error) { await rm(target, { force: true }); throw new Error(`Falha no corte: ${error.stderr || error.message}`); }
    return { path: target, hash, reused: false };
  }

  async probe(file) {
    try { const { stdout } = await run(this.ffprobe, ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,sample_rate', '-of', 'json', file], { timeout: 20_000 }); return JSON.parse(stdout); }
    catch (error) { if (error.code === 'ENOENT') throw new Error('FFprobe não está disponível'); throw new Error(`Mídia inválida: ${error.stderr || error.message}`); }
  }

  async clear({ cuts = true, objects = false } = {}) {
    const removed = [];
    if (cuts) { await rm(path.join(this.root, 'cuts'), { recursive: true, force: true }); removed.push('cuts'); }
    if (objects) { await rm(path.join(this.root, 'objects'), { recursive: true, force: true }); removed.push('objects'); }
    return { removed };
  }

  async #writeIndex(hash, value) { const directory = path.join(this.root, 'index'); await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, `${hash}.json`), `${JSON.stringify(value, null, 2)}\n`); }
}

export class PortugueseTranscriber {
  static model = 'whisper-large-v3';
  constructor({ binary = 'whisper-cli', modelPath, ffmpeg = 'ffmpeg', threads = Math.max(1, os.cpus().length - 2) } = {}) { this.binary = binary; this.modelPath = modelPath; this.ffmpeg = ffmpeg; this.threads = threads; }

  async diagnose() {
    const issues = [];
    try { await run(this.binary, ['--help'], { timeout: 10_000 }); } catch (error) { if (error.code === 'ENOENT') issues.push(`Binário ${this.binary} ausente`); else if (!`${error.stderr}${error.stdout}`.toLowerCase().includes('usage')) issues.push(`Binário indisponível: ${error.message}`); }
    if (!this.modelPath || !(await exists(this.modelPath))) issues.push('Pesos whisper-large-v3 ausentes');
    return { ready: issues.length === 0, model: PortugueseTranscriber.model, issues };
  }

  /** Transcreve em PT-BR. Retorna trechos em segundos e o SRT do Whisper. */
  async transcribe(mediaPath, { signal, onProgress = () => {} } = {}) {
    const status = await this.diagnose();
    if (!status.ready) throw Object.assign(new Error(status.issues.join('; ')), { code: 'DEPENDENCY_MISSING', details: { missing: ['whisper-cli', 'whisper-large-v3'] } });
    const work = await mkdtemp(path.join(os.tmpdir(), 'contentlab-whisper-'));
    try {
      onProgress({ phase: 'Preparando áudio', percent: 0 });
      const wav = path.join(work, 'audio.wav');
      await runAbortable(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', path.resolve(mediaPath), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], { signal });
      onProgress({ phase: 'Transcrevendo', percent: 0 });
      const prefix = path.join(work, 'transcript');
      await runAbortable(this.binary, ['-m', this.modelPath, '-f', wav, '-l', 'pt', '-t', String(this.threads), '-pp', '-ojf', '-osrt', '-of', prefix], { signal, onStderr: text => { const match = [...text.matchAll(/progress\s*=\s*(\d+)%/g)].at(-1); if (match) onProgress({ phase: 'Transcrevendo', percent: Number(match[1]) }); } });
      const json = JSON.parse(await readFile(`${prefix}.json`, 'utf8'));
      return { model: PortugueseTranscriber.model, language: 'pt', json, srt: await readFile(`${prefix}.srt`, 'utf8') };
    } finally { await rm(work, { recursive: true, force: true }); }
  }
}

/** Executa um processo externo com cancelamento e leitura incremental de stderr. */
function runAbortable(command, args, { signal, onStderr = () => {}, timeout = 6 * 60 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = ''; let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
    const abort = () => { child.kill('SIGTERM'); finish(Object.assign(new Error('Cancelado'), { name: 'AbortError', code: 'CANCELLED' })); };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error(`${path.basename(command)} excedeu o tempo limite`)); }, timeout);
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', () => {});
    child.stderr.on('data', chunk => { const text = chunk.toString(); stderr = (stderr + text).slice(-8000); onStderr(text); });
    child.on('error', error => finish(error.code === 'ENOENT' ? Object.assign(new Error(`${command} não encontrado`), { code: 'ENOENT' }) : error));
    child.on('close', code => (code === 0 ? finish(null, { stderr }) : finish(Object.assign(new Error(`${path.basename(command)} falhou: ${stderr.trim().split(/\r?\n/).slice(-2).join(' ')}`), { code: 'PROCESS_FAILED' }))));
  });
}

async function sha256File(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
async function exists(file) { try { await stat(file); return true; } catch { return false; } }
function safeExtension(file) { const extension = path.extname(file).toLowerCase(); return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '.bin'; }
function sanitize(value) { return value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'cut'; }
