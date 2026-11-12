import { copyFile, link, mkdir, mkdtemp, open, readdir, readFile, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { cleanMetadata } from './clean-metadata.js';

const run = promisify(execFile);
const here = import.meta.url.startsWith('file:') ? path.dirname(fileURLToPath(import.meta.url)) : path.join(process.cwd(), 'src/render');
export const KIT_ENTRY = path.resolve(here, '../motion/kit/index.ts');
const BRAND = path.resolve(here, '../../assets/brand');
const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const LOUDNESS_TARGET = -14;
/** Cenas 3D (Three.js) precisam de WebGL no Chrome headless: ANGLE sobre SwiftShader funciona sem GPU. */
const SCENES_3D = new Set(['paineis3d']);
const chromium = plan => (plan.beats.some(beat => SCENES_3D.has(beat.scene)) ? { gl: 'swangle' } : {});

/**
 * Render do modo composição: o plano de motion (beats do kit Diazverso) vira um único vídeo Remotion.
 * Prepara a pasta pública (marca, SFX e só as mídias citadas), resolve `media:<id>`, renderiza com
 * narração, legenda por palavra e trilha com ducking, e normaliza o áudio para −14 LUFS com limitador.
 */
const pngSize = async file => { const handle = await open(file, 'r'); try { const head = Buffer.alloc(24); await handle.read(head, 0, 24, 0); return head.toString('ascii', 12, 16) === 'IHDR' ? { w: head.readUInt32BE(16), h: head.readUInt32BE(20) } : null; } finally { await handle.close(); } };
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) ? value : null;

/**
 * Poses do Nox: `poses.json` (formato 1) liga cada pose ao PNG sem olhos e à posição dos olhos, que o kit
 * redesenha com o humor pedido (opcional). PNG solto, sem entrada no JSON, já traz os olhos desenhados e vale como está;
 * o sufixo `-2`, `-3`… (ou `-b`) faz dele variante da mesma pose, sorteada a cada fala.
 */
export async function loadNoxPoses(dir, prefix) {
  const names = (await readdir(dir).catch(() => [])).filter(name => /^[a-z0-9-]+\.png$/.test(name));
  const manifest = await readFile(path.join(dir, 'poses.json'), 'utf8').then(JSON.parse).catch(() => ({}));
  const poses = {}; const files = new Set();
  for (const [name, entry] of Object.entries(manifest.poses || {})) {
    const file = entry?.arquivo; if (!/^[a-z0-9-]+$/.test(name) || !names.includes(file)) continue;
    const size = await pngSize(path.join(dir, file)); if (!size) continue;
    const eyes = entry.olhos && point(entry.olhos.esquerdo) && point(entry.olhos.direito) ? { esquerdo: entry.olhos.esquerdo, direito: entry.olhos.direito, largura: Number(entry.olhos.largura) || undefined, largura_direito: Number(entry.olhos.largura_direito) || undefined, angulo: Number(entry.olhos.angulo) || 0 } : null;
    poses[name] = { src: `${prefix}${file}`, ...size, pose: typeof entry.pose === 'string' ? entry.pose : name, olhos: eyes, cobre: ['esquerdo', 'direito', 'ambos'].includes(entry.cobre) ? entry.cobre : 'nenhum' };
    files.add(file);
  }
  // PNG solto (sem entrada no JSON) já vem com os olhos desenhados; `pensando-2.png` é variante de `pensando`.
  for (const file of names) {
    if (files.has(file) || Object.values(manifest.poses || {}).some(entry => entry?.arquivo === file)) continue;
    const size = await pngSize(path.join(dir, file)); if (!size) continue;
    const name = file.slice(0, -4);
    poses[name] = { src: `${prefix}${file}`, ...size, pose: name.replace(/-(\d+|[a-z])$/, ''), olhos: null, cobre: 'nenhum' };
    files.add(file);
  }
  return { poses, files: [...files] };
}

export class MotionRenderer {
  constructor(root, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' } = {}) { this.root = path.resolve(root); this.ffmpeg = ffmpeg; this.ffprobe = ffprobe; this.bundles = new Map(); }

  /** Frames de prévia (PNG) em segundos escolhidos, sem áudio: para o agente conferir o visual antes do render. */
  async stills(project, { seconds, directory, scale = 0.5 }) {
    return this.render(project, { stills: { seconds, directory }, scale, output: null });
  }

  /**
   * Thumbnails do kit (`DiazversoThumb`, 1280×720 ou o tamanho pedido): cada variante é um still com a mídia
   * da obra, até 4 palavras em Anton e o Nox com expressão. Devolve um PNG por variante em `directory`.
   */
  async thumbnails(project, { variants, directory, width = 1280, height = 720 }) {
    const work = await mkdtemp(path.join(os.tmpdir(), 'contentlab-thumb-')); const publicDir = path.join(work, 'public');
    try {
      for (const [from, to] of [['fonts/Anton-Regular.ttf', 'brand/Anton-Regular.ttf'], ['nox/nox-sem-olhos.png', 'brand/nox-sem-olhos.png']]) await place(path.join(BRAND, from), path.join(publicDir, to));
      const assets = await this.#stageMedia(project, mediaRefs({ beats: variants.map(variant => ({ props: variant })) }), publicDir);
      const { bundle } = await import('@remotion/bundler'); const { renderStill, selectComposition } = await import('@remotion/renderer');
      const serveUrl = await bundle({ entryPoint: KIT_ENTRY, outDir: path.join(work, 'bundle'), publicDir, enableCaching: true, onProgress: () => {} });
      await mkdir(directory, { recursive: true }); const files = [];
      for (const { label, ...variant } of variants) {
        const inputProps = { ...variant, assets, width, height };
        const composition = await selectComposition({ serveUrl, id: 'DiazversoThumb', inputProps, logLevel: 'error' });
        const file = path.join(directory, `thumb-${label}.png`);
        await renderStill({ serveUrl, composition, frame: 0, output: file, inputProps, logLevel: 'error', overwrite: true });
        files.push({ label, file });
      }
      return files;
    } catch (error) {
      throw error.code ? error : Object.assign(new Error(`Thumbnail do kit falhou: ${String(error.message).split('\n').slice(0, 3).join(' ')}`), { code: 'MOTION_RENDER_FAILED' });
    } finally { await rm(work, { recursive: true, force: true }); }
  }

  /** Copia para a pasta pública só as mídias citadas e devolve o mapa id → { src: public:…, kind }. */
  async #stageMedia(project, ids, publicDir) {
    const assets = {};
    for (const id of ids) {
      const item = project.media.find(media => media.id === id);
      if (!item?.uri) throw Object.assign(new Error(`Mídia citada não está no projeto: ${id}`), { code: 'MEDIA_MISSING' });
      const file = `media/${id}${path.extname(item.uri).toLowerCase()}`; await place(item.uri, path.join(publicDir, file));
      assets[id] = { src: `public:${file}`, kind: item.kind === 'video' ? 'video' : 'image' };
    }
    return assets;
  }

  async render(project, { output, signal, onProgress = () => {}, scale = 1, stills = null }) {
    const plan = project.motion; const inputs = project.motionInputs || {};
    const [width, height] = SIZES[project.aspectRatio] || SIZES['16:9'];
    const fps = project.timeline?.fps || 30;
    const work = await mkdtemp(path.join(os.tmpdir(), 'contentlab-motion-')); const publicDir = path.join(work, 'public');
    try {
      onProgress({ phase: 'Preparando mídias', progress: 0.01 });
      await mkdir(path.join(publicDir, 'brand'), { recursive: true }); await mkdir(path.join(publicDir, 'sfx'), { recursive: true }); await mkdir(path.join(publicDir, 'media'), { recursive: true });
      for (const [from, to] of [['fonts/Anton-Regular.ttf', 'brand/Anton-Regular.ttf'], ['nox/nox-sem-olhos.png', 'brand/nox-sem-olhos.png'], ['nox/Nox.png', 'brand/Nox.png']]) await place(path.join(BRAND, from), path.join(publicDir, to));
      // Poses do Nox (stop motion) que existirem em assets/brand/nox/poses, com os olhos de poses.json.
      const { poses, files } = await loadNoxPoses(path.join(BRAND, 'nox', 'poses'), 'public:brand/poses/');
      for (const file of files) await place(path.join(BRAND, 'nox', 'poses', file), path.join(publicDir, 'brand', 'poses', file));
      const used = new Set(plan.beats.flatMap(beat => beat.sfx || []).map(cue => cue.name));
      for (const name of used) await place(path.join(BRAND, 'sfx', `${name}.wav`), path.join(publicDir, 'sfx', `${name}.wav`));
      const assets = await this.#stageMedia(project, mediaRefs(plan), publicDir);
      let narration = null; let music = null;
      if (plan.narration !== false && inputs.narration) { await place(inputs.narration, path.join(publicDir, 'media', `narracao${path.extname(inputs.narration)}`)); narration = `public:media/narracao${path.extname(inputs.narration)}`; }
      if (plan.music && inputs.music) { await place(inputs.music, path.join(publicDir, 'media', `trilha${path.extname(inputs.music)}`)); music = `public:media/trilha${path.extname(inputs.music)}`; }
      const end = Math.max(...plan.beats.map(beat => beat.at + beat.duration), inputs.narrationSeconds || 0);
      const props = { plan: { fps, width: even(width * scale), height: even(height * scale), duration: end, beats: plan.beats, captions: plan.captions, musicVolume: plan.music?.volume, duck: plan.music?.duck }, assets, narration, music, poses, words: plan.narration !== false ? inputs.words || [] : [] };
      const scaled = scale === 1 ? props : { ...props, plan: { ...props.plan, width, height } };

      const { bundle } = await import('@remotion/bundler'); const { renderMedia, selectComposition, makeCancelSignal } = await import('@remotion/renderer');
      onProgress({ phase: 'Preparando o kit de motion', progress: 0.03 });
      const serveUrl = await bundle({ entryPoint: KIT_ENTRY, outDir: path.join(work, 'bundle'), publicDir, enableCaching: true, onProgress: () => {} });
      const inputProps = scaled;
      const chromiumOptions = chromium(plan);
      const composition = await selectComposition({ serveUrl, id: 'DiazversoMotion', inputProps, chromiumOptions, logLevel: 'error' });
      if (stills) {
        const { renderStill } = await import('@remotion/renderer'); await mkdir(stills.directory, { recursive: true }); const files = [];
        for (const second of stills.seconds) { const file = path.join(stills.directory, `previa-${String(Math.round(second * 10)).padStart(5, '0')}.png`); await renderStill({ serveUrl, composition, frame: Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(second * fps))), output: file, inputProps, scale, chromiumOptions, logLevel: 'error' }); files.push(file); }
        return { status: 'completed', files };
      }
      const raw = path.join(work, 'raw.mp4');
      const { cancelSignal: cancel, cancel: stop } = makeCancelSignal(); signal?.addEventListener('abort', stop, { once: true });
      await renderMedia({ serveUrl, composition, codec: 'h264', crf: 18, outputLocation: raw, inputProps, scale, chromiumOptions, concurrency: Math.max(1, Math.min(6, os.cpus().length - 2)), logLevel: 'error', cancelSignal: cancel, onProgress: ({ progress }) => onProgress({ phase: 'Renderizando a composição', progress: 0.05 + progress * 0.85 }) });
      onProgress({ phase: 'Ajustando o volume', progress: 0.92 });
      const temporary = `${output}.partial.mp4`;
      await this.#loudness(raw, temporary);
      onProgress({ phase: 'Tirando os metadados', progress: 0.96 });
      await cleanMetadata(this, temporary, output); await rm(temporary, { force: true });
      onProgress({ phase: 'Conferindo o arquivo', progress: 0.98 });
      return { status: 'completed', output: path.resolve(output), cached: false, inspection: await this.inspect(output) };
    } catch (error) {
      if (signal?.aborted || /cancel/i.test(error.message)) return { status: 'cancelled', output: null };
      throw error.code ? error : Object.assign(new Error(`Render da composição falhou: ${String(error.message).split('\n').slice(0, 3).join(' ')}`), { code: 'MOTION_RENDER_FAILED' });
    } finally { await rm(work, { recursive: true, force: true }); }
  }

  /** Ganho para −14 LUFS (medido) e limitador de pico; sem áudio, só copia. */
  async #loudness(input, output) {
    const probe = await run(this.ffmpeg, ['-hide_banner', '-nostats', '-i', input, '-af', 'ebur128', '-f', 'null', '-'], { maxBuffer: 64 * 1024 * 1024 }).catch(error => error);
    const measured = Number(String(probe.stderr || '').match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0]);
    if (!Number.isFinite(measured) || measured < -70) { await copyFile(input, output); return; }
    const gain = Math.max(-12, Math.min(18, LOUDNESS_TARGET - measured));
    await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-c:v', 'copy', '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.7:attack=1:release=60:level=false`, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', output], { maxBuffer: 16 * 1024 * 1024 });
  }

  async inspect(file) {
    const { stdout } = await run(this.ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', file]);
    const value = JSON.parse(stdout); const video = value.streams.find(item => item.codec_type === 'video');
    return { width: video?.width, height: video?.height, fps: video?.r_frame_rate, duration: Number(value.format.duration), audio: value.streams.some(item => item.codec_type === 'audio') };
  }
}

/** IDs `media:<id>` citados em qualquer prop dos beats. */
export function mediaRefs(plan) {
  const found = new Set();
  const walk = value => { if (typeof value === 'string') { const match = /^media:([\w.-]+)$/.exec(value); if (match) found.add(match[1]); } else if (value && typeof value === 'object') Object.values(value).forEach(walk); };
  for (const beat of plan.beats) { walk(beat.props || {}); walk(beat.extras || []); }
  return [...found];
}

async function place(source, target) {
  if (!(await stat(source).catch(() => null))) throw Object.assign(new Error(`Arquivo ausente: ${path.basename(source)}`), { code: 'MEDIA_MISSING' });
  await mkdir(path.dirname(target), { recursive: true });
  try { await link(source, target); } catch { await copyFile(source, target); }
}
function even(value) { return Math.max(2, Math.round(value / 2) * 2); }
