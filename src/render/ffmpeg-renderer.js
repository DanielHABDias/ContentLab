import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { compileRenderPlan } from './render-plan.js';

const run = promisify(execFile);

export class FfmpegRenderer {
  constructor(root, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' } = {}) { this.root = path.resolve(root); this.ffmpeg = ffmpeg; this.ffprobe = ffprobe; }

  async render(project, { output, signal, onProgress = () => {} }) {
    const plan = compileRenderPlan(project.timeline, project.media); const cache = path.join(this.root, 'cache', `${plan.fingerprint}.mp4`); await mkdir(path.dirname(cache), { recursive: true });
    if (await exists(cache)) { await copy(cache, output); return { status: 'completed', output: path.resolve(output), cached: true, plan }; }
    const temporary = `${cache}.partial.mp4`;
    const video = plan.layers.find(layer => layer.trackKind === 'visual' && layer.source);
    const audio = plan.layers.find(layer => layer.trackKind === 'audio' && layer.source);
    const args = ['-hide_banner', '-loglevel', 'error'];
    if (video) args.push('-stream_loop', '-1', '-i', video.source); else args.push('-f', 'lavfi', '-i', `color=c=0b0b10:s=${plan.canvas.width}x${plan.canvas.height}:r=${plan.fps}:d=${plan.duration}`);
    if (audio) args.push('-stream_loop', '-1', '-i', audio.source); else args.push('-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${plan.duration}`);
    const videoInput = '0:v'; const audioInput = '1:a';
    args.push('-t', String(plan.duration), '-map', videoInput, '-map', audioInput, '-vf', `scale=${plan.canvas.width}:${plan.canvas.height}:force_original_aspect_ratio=increase,crop=${plan.canvas.width}:${plan.canvas.height},setsar=1`);
    if (audio) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=9');
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', temporary);
    onProgress({ phase: 'rendering', progress: 0 });
    try { await runAbortable(this.ffmpeg, args, signal); await rename(temporary, cache); await copy(cache, output); }
    catch (error) { await rm(temporary, { force: true }); if (error.name === 'AbortError') return { status: 'cancelled', output: null, plan }; throw new Error(`Render falhou: ${error.stderr || error.message}`); }
    onProgress({ phase: 'validating', progress: .95 }); const inspection = await this.inspect(output, plan); onProgress({ phase: 'completed', progress: 1 });
    return { status: 'completed', output: path.resolve(output), cached: false, plan, inspection };
  }

  async inspect(file, plan) { const { stdout } = await run(this.ffprobe, ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height', '-of', 'json', path.resolve(file)]); const data = JSON.parse(stdout); const video = data.streams.find(stream => stream.codec_type === 'video'); const audio = data.streams.find(stream => stream.codec_type === 'audio'); if (!video || !audio) throw new Error('Render sem vídeo ou áudio'); if (video.width !== plan.canvas.width || video.height !== plan.canvas.height) throw new Error('Dimensões divergentes'); if (Math.abs(Number(data.format.duration) - plan.duration) > .2) throw new Error('Duração divergente'); return data; }
}

async function runAbortable(command, args, signal) { return await new Promise((resolve, reject) => { const child = execFile(command, args, { maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => error ? reject(Object.assign(error, { stderr })) : resolve({ stdout, stderr })); const abort = () => { child.kill('SIGTERM'); reject(new DOMException('Cancelado', 'AbortError')); }; if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true }); child.on('exit', () => signal?.removeEventListener('abort', abort)); }); }
async function exists(file) { try { await stat(file); return true; } catch { return false; } }
async function copy(source, target) { const { copyFile } = await import('node:fs/promises'); await mkdir(path.dirname(path.resolve(target)), { recursive: true }); await copyFile(source, path.resolve(target)); }
