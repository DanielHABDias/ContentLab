import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { compileRenderPlan, missingSources } from './render-plan.js';
import { buildFfmpegArgs } from './ffmpeg-graph.js';
import { MotionRenderer } from './motion-renderer.js';
import { cleanMetadata } from './clean-metadata.js';

const run = promisify(execFile);
const ANTON = import.meta.url.startsWith('file:') ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/kit/fonts/Anton-Regular.ttf') : path.join(process.cwd(), 'assets/brand/fonts/Anton-Regular.ttf');
const FONT_CANDIDATES = [ANTON, '/usr/share/fonts/truetype/inter-zorin-os/Inter-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', '/Library/Fonts/Arial Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf'];

/**
 * Render real a partir do `RenderPlan`: camadas visuais com enquadramento,
 * textos/legendas, mistura de áudio, fades e opacidade. Preview (frame ou
 * trecho) usa exatamente o mesmo grafo, só com janela e escala diferentes.
 */
export class FfmpegRenderer {
  constructor(root, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', fontFile = null, componentRuntime = null } = {}) { this.root = path.resolve(root); this.ffmpeg = ffmpeg; this.ffprobe = ffprobe; this.fontFile = fontFile; this.componentRuntime = componentRuntime; }

  async #font() {
    if (this.fontFile) return this.fontFile;
    const found = FONT_CANDIDATES.find(candidate => existsSync(candidate));
    if (found) return (this.fontFile = found);
    try { const { stdout } = await run('fc-match', ['-f', '%{file}', 'sans:bold'], { timeout: 5000 }); if (stdout.trim()) return (this.fontFile = stdout.trim()); } catch { /* sem fontconfig */ }
    return null;
  }

  #plan(project, aspectRatio) {
    const plan = compileRenderPlan(project.timeline, project.media, { aspectRatio });
    const missing = missingSources(plan, existsSync);
    if (missing.length) throw Object.assign(new Error(`Mídia ausente para ${missing.length} clip(s): ${missing.slice(0, 5).join(', ')}. Reimporte ou remova os clips.`), { code: 'MEDIA_MISSING', details: { clips: missing } });
    return plan;
  }

  async #run(plan, options, { signal, onProgress = () => {}, total }) {
    const textDirectory = await mkdtemp(path.join(this.root, 'text-'));
    try {
      if (plan.layers.some(layer => layer.type === 'component')) {
        if (!this.componentRuntime) throw Object.assign(new Error('Runtime Remotion não configurado'), { code: 'COMPONENT_RENDER_FAILED' });
        await this.componentRuntime.prepare(plan, { signal, onProgress });
      }
      const args = await buildFfmpegArgs(plan, { ...options, fontFile: await this.#font(), textDirectory });
      await runFfmpeg(this.ffmpeg, args, { signal, onTime: seconds => onProgress({ phase: 'rendering', progress: total ? Math.min(0.99, seconds / total) : null }) });
    } finally { await rm(textDirectory, { recursive: true, force: true }); }
  }

  async render(project, { output, signal, onProgress = () => {}, scale = 1 }) {
    // Modo composição: o plano de motion é renderizado inteiro pelo kit Remotion (a timeline de clips fica de fora).
    if (project.motion?.beats?.length) { this.motion ||= new MotionRenderer(this.root, { ffmpeg: this.ffmpeg, ffprobe: this.ffprobe }); await mkdir(path.dirname(output), { recursive: true }); return this.motion.render(project, { output, signal, onProgress, scale }); }
    await mkdir(this.root, { recursive: true });
    const plan = this.#plan(project);
    if (!(scale > 0 && scale <= 1)) throw new Error('Escala de render inválida');
    const cache = path.join(this.root, 'cache', `${plan.fingerprint}-${String(scale).replace('.', '_')}.mp4`); await mkdir(path.dirname(cache), { recursive: true });
    if (await exists(cache)) { await cleanMetadata(this, cache, output); return { status: 'completed', output: path.resolve(output), cached: true, plan, inspection: await this.inspect(output, plan, { scale }) }; }
    const temporary = `${cache}.partial.mp4`;
    onProgress({ phase: 'rendering', progress: 0 });
    try {
      const manyClips = plan.layers.filter(layer => ['media', 'component'].includes(layer.type)).length > 32;
      if (manyClips && plan.duration > 60) await this.#renderSegments(plan, { output: temporary, scale, signal, onProgress });
      else await this.#run(plan, { output: temporary, scale }, { signal, onProgress, total: plan.duration });
      await rename(temporary, cache); await cleanMetadata(this, cache, output);
    }
    catch (error) { await rm(temporary, { force: true }); if (error.name === 'AbortError') return { status: 'cancelled', output: null, plan }; throw error.code ? error : new Error(`Render falhou: ${lastLines(error.stderr || error.message)}`); }
    onProgress({ phase: 'validating', progress: 0.99 }); const inspection = await this.inspect(output, plan, { scale }); onProgress({ phase: 'completed', progress: 1 });
    return { status: 'completed', output: path.resolve(output), cached: false, plan, inspection };
  }

  async #renderSegments(plan, { output, scale, signal, onProgress }) {
    const directory = await mkdtemp(path.join(this.root, 'segments-')); const parts = [];
    try {
      for (let from = 0, index = 0; from < plan.duration; from += 60, index += 1) {
        const to = Math.min(plan.duration, from + 60); const part = path.join(directory, `part-${String(index).padStart(4, '0')}.mp4`); parts.push(part);
        await this.#run(plan, { from, to, scale, output: part }, { signal, total: to - from, onProgress: update => onProgress({ phase: `rendering segment ${index + 1}/${Math.ceil(plan.duration / 60)}`, progress: update.progress == null ? null : Math.min(.98, (from + update.progress * (to - from)) / plan.duration) }) });
      }
      const list = path.join(directory, 'concat.txt'); await writeFile(list, parts.map(file => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'));
      await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', '-y', output], { signal, timeout: 60 * 60_000, maxBuffer: 4 * 1024 * 1024 });
    } finally { await rm(directory, { recursive: true, force: true }); }
  }

  /** PNG de um frame pelo mesmo grafo do render (opcionalmente em outra proporção). */
  async renderFrame(project, { frame, output, aspectRatio, scale = 0.5 }) {
    await mkdir(this.root, { recursive: true });
    const plan = this.#plan(project, aspectRatio);
    const time = Math.min(Math.max(0, frame), plan.durationInFrames - 1) / plan.fps;
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    try { await this.#run(plan, { from: time, to: time + 1 / plan.fps, scale, output: path.resolve(output), still: true }, {}); }
    catch (error) { throw error.code ? error : new Error(`Preview falhou: ${lastLines(error.stderr || error.message)}`); }
    return { output: path.resolve(output), plan, time };
  }

  /** Trecho curto com áudio e vídeo sincronizados, em resolução reduzida. */
  async renderPreview(project, { from = 0, seconds = 5, output, aspectRatio, scale = 0.5, signal }) {
    await mkdir(this.root, { recursive: true });
    const plan = this.#plan(project, aspectRatio);
    const start = Math.min(Math.max(0, from), Math.max(0, plan.duration - 1 / plan.fps));
    const to = Math.min(plan.duration, start + seconds);
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    try { await this.#run(plan, { from: start, to, scale, output: path.resolve(output) }, { signal, total: to - start }); }
    catch (error) { await rm(output, { force: true }); if (error.name === 'AbortError') return { status: 'cancelled' }; throw error.code ? error : new Error(`Preview falhou: ${lastLines(error.stderr || error.message)}`); }
    return { status: 'completed', output: path.resolve(output), from: start, to, plan };
  }

  async inspect(file, plan, { scale = 1 } = {}) {
    const { stdout } = await run(this.ffprobe, ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height', '-of', 'json', path.resolve(file)], { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
    const data = JSON.parse(stdout); const video = data.streams.find(stream => stream.codec_type === 'video'); const audio = data.streams.find(stream => stream.codec_type === 'audio');
    if (!video || !audio) throw new Error('Render sem vídeo ou áudio');
    if (video.width !== Math.round(plan.canvas.width * scale) || video.height !== Math.round(plan.canvas.height * scale)) throw new Error('Dimensões divergentes');
    if (Math.abs(Number(data.format.duration) - plan.duration) > 0.2) throw new Error(`Duração divergente: ${Number(data.format.duration).toFixed(2)} s, esperado ${plan.duration.toFixed(2)} s`);
    if (Number(data.format.size) < 1024) throw new Error('Arquivo de render pequeno demais');
    return data;
  }
}

/** Executa o FFmpeg com cancelamento e progresso (`-progress pipe:1`). */
function runFfmpeg(command, args, { signal, onTime = () => {}, timeout = Number(process.env.CONTENTLAB_RENDER_TIMEOUT_MS) || 6 * 60 * 60_000 }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelado', 'AbortError')); return; }
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = ''; let buffer = '';
    child.stdout.on('data', chunk => { buffer += chunk; const lines = buffer.split('\n'); buffer = lines.pop(); for (const line of lines) { const match = line.match(/^out_time_us=(\d+)/); if (match) onTime(Number(match[1]) / 1e6); } });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16_000); });
    let timedOut = false; let killer = null;
    const stop = () => { child.kill('SIGTERM'); killer = setTimeout(() => child.kill('SIGKILL'), 5000); killer.unref?.(); };
    const abort = () => stop();
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeout); timer.unref?.();
    const cleanup = () => { clearTimeout(timer); clearTimeout(killer); signal?.removeEventListener('abort', abort); };
    signal?.addEventListener('abort', abort, { once: true });
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', code => {
      cleanup();
      if (timedOut) reject(Object.assign(new Error('FFmpeg excedeu o tempo limite do render'), { code: 'TIMEOUT', stderr }));
      else if (signal?.aborted) reject(new DOMException('Cancelado', 'AbortError'));
      else if (code === 0) resolve();
      else reject(Object.assign(new Error(`FFmpeg saiu com código ${code}`), { stderr }));
    });
  });
}

function lastLines(text) { return `${text}`.trim().split(/\r?\n/).slice(-3).join(' '); }
async function exists(file) { try { await stat(file); return true; } catch { return false; } }
