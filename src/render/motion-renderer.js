import { copyFile, link, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { pauseTotal } from '../motion/kit/pausas.js';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { cleanMetadata } from './clean-metadata.js';
import { pngSize } from '../core/character-pack.js';

const run = promisify(execFile);
const here = import.meta.url.startsWith('file:') ? path.dirname(fileURLToPath(import.meta.url)) : path.join(process.cwd(), 'src/render');
export const KIT_ENTRY = path.resolve(here, '../motion/kit/index.ts');
const KIT_ASSETS = path.resolve(here, '../../assets/kit');
const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const LOUDNESS_TARGET = -14;
/** Cenas 3D (Three.js) precisam de WebGL no Chrome headless: ANGLE sobre SwiftShader funciona sem GPU. */
const SCENES_3D = new Set(['paineis3d']);
const chromium = plan => (plan.beats.some(beat => SCENES_3D.has(beat.scene)) ? { gl: 'swangle' } : {});

/**
 * Render do modo composição: o plano de motion (beats do kit) vira um único vídeo Remotion.
 * Prepara a pasta pública (fonte, SFX, poses do personagem do projeto e só as mídias citadas), resolve `media:<id>`, renderiza com
 * narração, legenda por palavra e trilha com ducking, e normaliza o áudio para −14 LUFS com limitador.
 */
/**
 * Personagem do projeto (`project.character`, importado com character_import): copia os PNGs das poses para a
 * pasta pública e devolve `{ poses: arquivo → { src, w, h, pose }, tons: pose → tons }` para o kit. Sem personagem, vazio.
 */
export async function stageCharacter(project, publicDir) {
  const character = project.character; const poses = {}; const tons = {};
  if (!character) return { poses, tons };
  for (const [pose, entry] of Object.entries(character.poses)) {
    tons[pose] = entry.tons || [];
    for (const file of entry.arquivos) {
      const item = project.media.find(media => media.id === character.files[file]);
      if (!item?.uri) continue;
      const size = await pngSize(item.uri).catch(() => null); if (!size) continue;
      await place(item.uri, path.join(publicDir, 'personagem', file));
      poses[file.slice(0, -4)] = { src: `public:personagem/${file}`, ...size, pose };
    }
  }
  return { poses, tons };
}

export class MotionRenderer {
  constructor(root, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' } = {}) { this.root = path.resolve(root); this.ffmpeg = ffmpeg; this.ffprobe = ffprobe; this.bundles = new Map(); }

  /** Frames de prévia (PNG) em segundos escolhidos, sem áudio: para o agente conferir o visual antes do render. */
  async stills(project, { seconds, directory, scale = 0.5 }) {
    return this.render(project, { stills: { seconds, directory }, scale, output: null });
  }

  /**
   * Thumbnails do kit (`KitThumb`, 1280×720 ou o tamanho pedido): cada variante é um still com a mídia
   * da obra, até 4 palavras em Anton e, se houver, o personagem do projeto na pose do humor. Devolve um PNG por variante em `directory`.
   */
  async thumbnails(project, { variants, directory, width = 1280, height = 720 }) {
    const work = await mkdtemp(path.join(os.tmpdir(), 'contentlab-thumb-')); const publicDir = path.join(work, 'public');
    try {
      await place(path.join(KIT_ASSETS, 'fonts/Anton-Regular.ttf'), path.join(publicDir, 'brand/Anton-Regular.ttf'));
      const personagem = await stageCharacter(project, publicDir);
      const assets = await this.#stageMedia(project, mediaRefs({ beats: variants.map(variant => ({ props: variant })) }), publicDir);
      const { bundle } = await import('@remotion/bundler'); const { renderStill, selectComposition } = await import('@remotion/renderer');
      const serveUrl = await bundle({ entryPoint: KIT_ENTRY, outDir: path.join(work, 'bundle'), publicDir, enableCaching: true, onProgress: () => {} });
      await mkdir(directory, { recursive: true }); const files = [];
      for (const { label, ...variant } of variants) {
        const inputProps = { ...variant, assets, personagem, width, height };
        const composition = await selectComposition({ serveUrl, id: 'KitThumb', inputProps, logLevel: 'error' });
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
      // Largura e altura deixam a cena enquadrar imagem vertical sem cortar o rosto.
      const { width, height } = item.metadata || {};
      assets[id] = { src: `public:${file}`, kind: item.kind === 'video' ? 'video' : 'image', ...(width && height ? { w: width, h: height } : {}) };
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
      await place(path.join(KIT_ASSETS, 'fonts/Anton-Regular.ttf'), path.join(publicDir, 'brand/Anton-Regular.ttf'));
      const personagem = await stageCharacter(project, publicDir);
      const used = new Set(plan.beats.flatMap(beat => beat.sfx || []).map(cue => cue.name));
      for (const name of used) await place(path.join(KIT_ASSETS, 'sfx', `${name}.wav`), path.join(publicDir, 'sfx', `${name}.wav`));
      const assets = await this.#stageMedia(project, mediaRefs(plan), publicDir);
      let narration = null; let music = null;
      if (plan.narration !== false && inputs.narration) { await place(inputs.narration, path.join(publicDir, 'media', `narracao${path.extname(inputs.narration)}`)); narration = `public:media/narracao${path.extname(inputs.narration)}`; }
      if (plan.music && inputs.music) { await place(inputs.music, path.join(publicDir, 'media', `trilha${path.extname(inputs.music)}`)); music = `public:media/trilha${path.extname(inputs.music)}`; }
      if (plan.beats.some(beat => beat.scene === 'telafinal')) await place(path.join(KIT_ASSETS, 'backgrounds/comic-page.png'), path.join(publicDir, 'assets/kit/backgrounds/comic-page.png'));
      const end = Math.max(...plan.beats.map(beat => beat.at + beat.duration), (inputs.narrationSeconds || 0) + pauseTotal(plan.pausas));
      const props = { plan: { fps, width: even(width * scale), height: even(height * scale), duration: end, beats: plan.beats, captions: plan.captions, musicVolume: plan.music?.volume, duck: plan.music?.duck, musicPause: plan.music?.pausa, musicFade: plan.music?.fade, musicStart: plan.music?.inicio, musicParts: plan.music?.trechos || [], pausas: plan.pausas || [] }, assets, narration, music, personagem, words: plan.narration !== false ? inputs.words || [] : [] };
      const scaled = scale === 1 ? props : { ...props, plan: { ...props.plan, width, height } };

      const { bundle } = await import('@remotion/bundler'); const { renderMedia, selectComposition, makeCancelSignal } = await import('@remotion/renderer');
      onProgress({ phase: 'Preparando o kit de motion', progress: 0.03 });
      const serveUrl = await bundle({ entryPoint: KIT_ENTRY, outDir: path.join(work, 'bundle'), publicDir, enableCaching: true, onProgress: () => {} });
      const inputProps = scaled;
      const chromiumOptions = chromium(plan);
      const composition = await selectComposition({ serveUrl, id: 'KitMotion', inputProps, chromiumOptions, logLevel: 'error' });
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
