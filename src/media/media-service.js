import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { execFile } from 'node:child_process';
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

  async importUrl(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Somente URLs HTTPS são aceitas');
    const staging = path.join(this.root, 'staging', randomUUID());
    await mkdir(staging, { recursive: true });
    const target = path.join(staging, 'source.%(ext)s');
    try {
      await run(this.ytDlp, ['--no-playlist', '--max-filesize', '4G', '--restrict-filenames', '--merge-output-format', 'mp4', '-o', target, url], { timeout: 30 * 60_000, maxBuffer: 1024 * 1024 });
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(staging);
      if (files.length !== 1) throw new Error('O download não produziu uma mídia única');
      return await this.importFile(path.join(staging, files[0]));
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('yt-dlp não está disponível; execute a preparação de dependências');
      throw new Error(`Falha ao baixar mídia: ${error.stderr || error.message}`);
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
  constructor({ binary = 'whisper-cli', modelPath } = {}) { this.binary = binary; this.modelPath = modelPath; }
  async diagnose() {
    const issues = [];
    try { await run(this.binary, ['--help'], { timeout: 10_000 }); } catch (error) { if (error.code === 'ENOENT') issues.push(`Binário ${this.binary} ausente`); else if (!`${error.stderr}`.includes('usage')) issues.push(`Binário indisponível: ${error.message}`); }
    if (!this.modelPath || !(await exists(this.modelPath))) issues.push('Pesos whisper-large-v3 ausentes');
    return { ready: issues.length === 0, model: PortugueseTranscriber.model, issues };
  }
  async transcribe(audioPath, outputDirectory) {
    const status = await this.diagnose();
    if (!status.ready) throw new Error(status.issues.join('; '));
    await mkdir(outputDirectory, { recursive: true });
    const prefix = path.join(outputDirectory, 'transcript');
    await run(this.binary, ['-m', this.modelPath, '-f', path.resolve(audioPath), '-l', 'pt', '-ojf', '-osrt', '-of', prefix], { timeout: 6 * 60 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    return { model: PortugueseTranscriber.model, json: JSON.parse(await readFile(`${prefix}.json`, 'utf8')), srtPath: `${prefix}.srt` };
  }
}

async function sha256File(file) { const buffer = await readFile(file); return createHash('sha256').update(buffer).digest('hex'); }
async function exists(file) { try { await stat(file); return true; } catch { return false; } }
function safeExtension(file) { const extension = path.extname(file).toLowerCase(); return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '.bin'; }
function sanitize(value) { return value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'cut'; }
