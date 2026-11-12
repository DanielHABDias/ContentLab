import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, link, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { readProjectDirectory } from './project-registry.js';
import { NarrationStore, scenesFromScript } from '../audio/narration-service.js';
import { wrap } from '../render/ffmpeg-graph.js';
import { sanitizeProps } from '../render/remotion-component-runtime.js';
import { missingStageArtifacts } from '../core/workflow.js';
import { SCENES_TRACK, scenesTrack } from './edit-operations.js';
import { BUNDLED_COMPONENTS } from '../timeline/components/catalog.js';

const run = promisify(execFile);
const FONTS = ['/usr/share/fonts/truetype/inter-zorin-os/Inter-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', '/Library/Fonts/Arial Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf'];
const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const THUMB_SIZES = { '16:9': [1280, 720], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const PALETTE = ['#15151d', '#0f2a3d', '#2a1420', '#1d2a10', '#22182e'];
/** Chamada curta: a primeira frase, cortada em palavra inteira (com reticências) se passar do limite. */
export function headline(text, max) {
  const first = sentences(text)[0] || '';
  if (first.length <= max) return first;
  const cut = first.slice(0, max + 1); const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut.slice(0, max)).replace(/[,;:\s]+$/, '')}…`;
}
const sentences = text => String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
const srtTime = seconds => { const ms = Math.max(0, Math.round(seconds * 1000)); const h = Math.floor(ms / 3_600_000); const m = Math.floor(ms / 60_000) % 60; const s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
/** Legendas de até 2 linhas; pedaço final muito curto (ex.: "nele.") junta-se ao anterior. */
export function captionChunks(sentence) {
  const chunks = wrap(sentence, 42).split('\n').reduce((list, line, index) => { if (index % 2 === 0) list.push(line); else list[list.length - 1] += `\n${line}`; return list; }, []);
  if (chunks.length > 1 && chunks.at(-1).length < 14) { const tail = chunks.pop(); chunks[chunks.length - 1] += ` ${tail}`; }
  return chunks;
}
/** Áreas seguras de Shorts 9:16 (margens conservadoras; a legenda termina em ~78% da altura). */
export const SHORTS_SAFE_AREA = { top: 0.125, right: 0.148, bottom: 0.224, left: 0.089 };
const YEAR = /\b(1[0-9]{3}|20[0-9]{2})\b/;
const fxId = () => `fx_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
const PALETTES = [['#15233b', '#ff435a'], ['#18243c', '#ffcf3f'], ['#2a1420', '#ffcf3f'], ['#1d1626', '#27a8ff'], ['#202a1a', '#d8ff48']];

/**
 * Plano automático de cenas HQ a partir do roteiro: abertura no gancho, encerramento no payoff,
 * linha do tempo quando o trecho tem datas, cartões quando há várias frases curtas e frase em destaque no resto.
 * É um ponto de partida: o agente ou a pessoa pode trocar qualquer cena.
 */
export function planScenes(scenes, { title = '' } = {}) {
  return scenes.map((scene, index) => {
    const [background, accent] = PALETTES[index % PALETTES.length];
    const parts = sentences(scene.text);
    if (index === 0) return { sceneId: scene.id, componentId: 'hq_abertura', props: { title: headline(scene.text, 64), kicker: headline(title, 28), background, accent } };
    if (index === scenes.length - 1 && scenes.length > 1) return { sceneId: scene.id, componentId: 'hq_chamada', props: { text: headline(parts.at(-1) || scene.text, 70), subtext: '', background, accent } };
    const dated = parts.filter(part => YEAR.test(part));
    if (dated.length >= 2) return { sceneId: scene.id, componentId: 'hq_linha_tempo', props: { title: '', items: dated.slice(0, 5).map(part => `${part.match(YEAR)[1]} | ${headline(part.replace(YEAR, '').replace(/^[\s,.:;-]*(em|no ano de)?\s*/i, ''), 46)}`).join('\n'), background, accent } };
    if (parts.length >= 3) return { sceneId: scene.id, componentId: 'hq_cartoes', props: { title: '', items: parts.slice(0, 4).map(part => headline(part, 48)).join('\n'), background, accent, card: '#f6f3ea' } };
    const strongest = [...parts].sort((a, b) => Math.abs(a.length - 90) - Math.abs(b.length - 90))[0] || scene.text;
    return { sceneId: scene.id, componentId: 'hq_citacao', props: { text: headline(strongest, 150), author: '', highlight: '', background, accent } };
  });
}

const clipId = () => `clip_${randomUUID().replaceAll('-', '').slice(0, 10)}`;

/**
 * Produção assistida (interface, CLI e MCP): slides do roteiro, thumbnails A/B,
 * montagem automática da timeline, espera por aprovação e pasta de entrega.
 * Tudo grava pelo núcleo (mídias com direitos `owned`, edições com histórico).
 */
export class ProductionOperations {
  constructor(app) { this.app = app; }
  get ffmpeg() { return this.app.media?.ffmpeg || 'ffmpeg'; }

  async #font() { const found = FONTS.find(candidate => existsSync(candidate)); if (found) return found; try { const { stdout } = await run('fc-match', ['-f', '%{file}', 'sans:bold'], { timeout: 5000 }); return stdout.trim() || null; } catch { return null; } }

  /** Desenha um cartão de texto (slide ou thumbnail) com FFmpeg; fundo de um frame/imagem ou cor sólida. */
  async #card({ width, height, lines, background = null, seekSeconds = 0, color = '#15151d', style = 'dark', label = '', output }) {
    const font = await this.#font();
    if (!font) throw new Error('Nenhuma fonte encontrada para desenhar texto (instale fontes DejaVu ou Inter)');
    const directory = await mkdtemp(path.join(os.tmpdir(), 'contentlab-card-'));
    try {
      const size = Math.round(Math.min(width, height) * (style === 'slide' ? 0.068 : 0.105));
      const spacing = Math.round(size * (style === 'B' ? 1.6 : 1.22));
      const total = lines.length * spacing;
      // Slides ficam no terço de cima: a legenda da fala ocupa a parte de baixo do quadro.
      const top = style === 'B' ? Math.round(height * 0.1) : style === 'A' ? Math.round(height - total - height * 0.1) : Math.round(height * (height > width ? 0.2 : 0.24));
      const filters = [`scale=${width}:${height}:force_original_aspect_ratio=increase`, `crop=${width}:${height}`, 'setsar=1'];
      if (background) filters.push('eq=brightness=-0.12:saturation=1.15');
      if (style === 'A') filters.push(`drawbox=x=0:y=${Math.round(height * 0.52)}:w=iw:h=${Math.round(height * 0.48)}:color=black@0.55:t=fill`);
      if (style === 'slide') filters.push(`drawbox=x=${Math.round(width * 0.08)}:y=${top - Math.round(size * 0.9)}:w=${Math.round(width * 0.12)}:h=${Math.max(6, Math.round(size * 0.12))}:color=#d8ff48:t=fill`);
      for (const [index, line] of lines.entries()) {
        const file = path.join(directory, `l${index}.txt`); await writeFile(file, line);
        const escaped = file.replaceAll('\\', '/').replaceAll(':', '\\:');
        const fontPath = font.replaceAll('\\', '/').replaceAll(':', '\\:');
        const look = style === 'B' ? `fontcolor=#09090d:box=1:boxcolor=#d8ff48:boxborderw=${Math.round(size * 0.22)}` : style === 'slide' ? 'fontcolor=#f5f3ef' : `fontcolor=white:borderw=${Math.max(2, Math.round(size * 0.06))}:bordercolor=black`;
        filters.push(`drawtext=fontfile='${fontPath}':textfile='${escaped}':fontsize=${size}:${look}:x=${style === 'slide' ? Math.round(width * 0.08) : '(w-text_w)/2'}:y=${top + index * spacing}`);
      }
      if (label) { const file = path.join(directory, 'label.txt'); await writeFile(file, label); filters.push(`drawtext=fontfile='${font.replaceAll(':', '\\:')}':textfile='${file.replaceAll(':', '\\:')}':fontsize=${Math.round(size * 0.42)}:fontcolor=#9898aa:x=${Math.round(width * 0.08)}:y=${Math.round(height * 0.08)}`); }
      const gradient = style === 'A' || style === 'B' ? `gradients=s=${width}x${height}:c0=${color}:c1=${style === 'A' ? '#27a8ff' : '#ff3f57'}:x0=0:y0=0:x1=${width}:y1=${height}:nb_colors=2` : `color=c=${color}:s=${width}x${height}`;
      const input = background ? [...(seekSeconds ? ['-ss', String(seekSeconds)] : []), '-i', background] : ['-f', 'lavfi', '-i', gradient];
      await mkdir(path.dirname(output), { recursive: true });
      await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...input, '-frames:v', '1', '-vf', filters.join(','), output], { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
      return output;
    } finally { await rm(directory, { recursive: true, force: true }); }
  }

  async #attachGenerated(directory, file, name, role) {
    const imported = await this.app.media.importFile(file);
    const result = await this.app.mediaOps.attach(directory, imported, { rights: 'owned', source: { type: 'generated', value: name }, name, role });
    await rm(file, { force: true });
    return result;
  }

  /** Um slide por cena do roteiro (texto sobre fundo), para vídeos sem filmagem própria. */
  async slides({ path: directory }) {
    await this.app.requireFeature('media.import');
    const project = await readProjectDirectory(directory);
    const scenes = scenesFromScript(project.creative?.script);
    if (!scenes.length) throw new Error('Escreva o roteiro antes de gerar slides');
    const [width, height] = SIZES[project.aspectRatio] || SIZES['16:9'];
    const perLine = project.aspectRatio === '9:16' ? 18 : 30;
    const staging = await mkdtemp(path.join(os.tmpdir(), 'contentlab-slides-'));
    const created = [];
    try {
      for (const [index, scene] of scenes.entries()) {
        const text = headline(scene.text, project.aspectRatio === '9:16' ? 60 : 80);
        const file = path.join(staging, `slide-${index + 1}.png`);
        await this.#card({ width, height, lines: wrap(text, perLine).split('\n').slice(0, 4), color: PALETTE[index % PALETTE.length], style: 'slide', label: `${project.title} · ${scene.label}`, output: file });
        const result = await this.#attachGenerated(directory, file, `Slide ${index + 1} · ${scene.label}`, 'slide');
        created.push({ sceneId: scene.id, mediaId: result.mediaId, status: result.status });
      }
    } finally { await rm(staging, { recursive: true, force: true }); }
    return { slides: created };
  }

  /**
   * Thumbnails A e B: título sobre um frame do vídeo (ou cor), em dois estilos para teste A/B.
   * Grava em `creative.packaging.thumbnailA/B` (A também vira a thumbnail principal).
   */
  async thumbnails({ path: directory, variants }) {
    await this.app.requireFeature('media.import');
    const project = await readProjectDirectory(directory);
    const packaging = project.creative.packaging;
    const list = (variants?.length ? variants : [{ label: 'A', title: packaging.titleA }, { label: 'B', title: packaging.titleB || packaging.titleA }]).slice(0, 2);
    if (list.some(item => !String(item.title || '').trim())) throw new Error('Escreva os títulos A/B (ou informe o texto de cada thumbnail)');
    const [width, height] = THUMB_SIZES[project.aspectRatio] || THUMB_SIZES['16:9'];
    const content = project.media.filter(item => ['video', 'image'].includes(item.kind) && !['thumbnail'].includes(item.role));
    const staging = await mkdtemp(path.join(os.tmpdir(), 'contentlab-thumbs-'));
    const result = {};
    try {
      for (const [index, variant] of list.entries()) {
        const label = variant.label === 'B' || index === 1 ? 'B' : 'A';
        // Fundo: o frame escolhido ou a primeira mídia própria; slides já têm texto, então viram fundo liso.
        const source = variant.mediaId ? project.media.find(item => item.id === variant.mediaId) : content.find(item => item.role !== 'slide') || null;
        const background = source ? await this.app.resolveMediaPath(source) : null;
        const seconds = source?.kind === 'video' ? Number(variant.frameSeconds ?? Math.min(3, (source.metadata?.durationSeconds || 0) / 3)) : 0;
        const text = String(variant.text || variant.title).toUpperCase().slice(0, 70);
        const file = path.join(staging, `thumb-${label}.png`);
        await this.#card({ width, height, lines: wrap(text, project.aspectRatio === '9:16' ? 12 : 20).split('\n').slice(0, 3), background, seekSeconds: seconds, color: label === 'A' ? '#0f2a3d' : '#2a1420', style: label, output: file });
        const attached = await this.#attachGenerated(directory, file, `Thumbnail ${label}`, 'thumbnail');
        result[`thumbnail${label}`] = attached.mediaId;
      }
    } finally { await rm(staging, { recursive: true, force: true }); }
    const fresh = await readProjectDirectory(directory);
    const next = { ...fresh.creative, packaging: { ...fresh.creative.packaging, ...result, thumbnailMediaId: result.thumbnailA || fresh.creative.packaging.thumbnailMediaId } };
    const updated = await this.app.runProjectAction({ path: directory, baseRevision: fresh.revision, action: { type: 'creative.update', creative: next } });
    return { ...result, revision: updated.project.revision };
  }

  /** Janela de tempo de cada cena do roteiro dentro da narração montada (segundos). */
  #windows(project, session, total) {
    const scenes = scenesFromScript(project.creative?.script);
    const takes = (session.assembled?.takeIds || []).map(id => session.takes.find(take => take.id === id)).filter(Boolean);
    const durations = takes.map(take => (take.trim ? take.trim.end - take.trim.start : take.durationSeconds) || 0);
    const sum = durations.reduce((acc, value) => acc + value, 0);
    const scale = sum > 0 ? total / sum : 1; let offset = 0;
    return takes.map((take, position) => { const scene = scenes.find(item => item.id === take.sceneId) || scenes[position]; const window = { scene, start: offset, length: durations[position] * scale }; offset += window.length; return window; }).filter(item => item.scene);
  }

  /**
   * Trilha musical e efeitos sonoros originais, sintetizados com FFmpeg (sem samples de terceiros,
   * direitos próprios). A trilha tem a duração da narração montada (ou `seconds`).
   */
  async audioLibrary({ path: directory, music = true, sfx = true, seconds }) {
    await this.app.requireFeature('media.import');
    const project = await readProjectDirectory(directory);
    const session = await new NarrationStore(directory).read().catch(() => ({}));
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    const length = Math.max(5, Math.min(3600, Number(seconds) || Math.ceil((narration?.metadata?.durationSeconds || 60) + 2)));
    const staging = await mkdtemp(path.join(os.tmpdir(), 'contentlab-audio-'));
    const created = {};
    const make = async (name, args) => { const file = path.join(staging, `${name}.wav`); await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args, '-ar', '48000', '-ac', '2', file], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 }); return file; };
    try {
      if (music) {
        // Progressão lenta (i–VI–III–VII) com acorde suave e pulso leve; envelope evita cliques nas trocas.
        const step = 'if(lt(mod(t,16),4),0,if(lt(mod(t,16),8),-4,if(lt(mod(t,16),12),3,-2)))';
        const f = `110*pow(2,(${step})/12)`; const env = 'min(1,min(mod(t,4)*3,(4-mod(t,4))*3))';
        const expr = `${env}*(0.10*sin(2*PI*${f}*t)+0.06*sin(2*PI*${f}*1.189*t)+0.06*sin(2*PI*${f}*1.498*t)+0.035*sin(2*PI*${f}*2*t)*(0.5+0.5*sin(2*PI*0.25*t))+0.03*sin(2*PI*${f}*3*t)*exp(-5*mod(t,0.5)))`;
        const file = await make('trilha', ['-f', 'lavfi', '-i', `aevalsrc='${expr}':s=48000:d=${length}`, '-af', `lowpass=f=1800,aecho=0.8:0.6:120|240:0.25|0.15,afade=t=in:d=2,afade=t=out:st=${length - 3}:d=3,volume=1.6`]);
        created.music = (await this.#attachGenerated(directory, file, 'Trilha original (gerada)', 'music')).mediaId;
      }
      if (sfx) {
        const effects = {
          whoosh: ['-f', 'lavfi', '-i', 'anoisesrc=c=pink:d=0.7:a=0.6', '-af', 'highpass=f=300,lowpass=f=4000,afade=t=in:d=0.35:curve=exp,afade=t=out:st=0.35:d=0.35'],
          ding: ['-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*1318.5*t)*exp(-5*t)+0.25*sin(2*PI*2637*t)*exp(-8*t)':s=48000:d=1.2"],
          boom: ['-f', 'lavfi', '-i', "aevalsrc='0.9*sin(2*PI*(48+40*exp(-12*t))*t)*exp(-3.5*t)':s=48000:d=1.4", '-af', 'lowpass=f=400'],
          riser: ['-f', 'lavfi', '-i', "aevalsrc='0.3*sin(2*PI*(180*t+260*t*t))*min(1,t/1.6)':s=48000:d=1.8", '-af', 'afade=t=out:st=1.6:d=0.2'],
        };
        created.sfx = {};
        for (const [name, args] of Object.entries(effects)) created.sfx[name] = (await this.#attachGenerated(directory, await make(name, args), `SFX ${name} (gerado)`, 'sfx')).mediaId;
      }
    } finally { await rm(staging, { recursive: true, force: true }); }
    return { ...created, seconds: length, rights: 'owned' };
  }

  /** Plano de cenas sugerido (sem gravar): uma cena HQ por trecho do roteiro. */
  async sceneSuggestions({ path: directory }) {
    const project = await readProjectDirectory(directory);
    const scenes = scenesFromScript(project.creative?.script);
    if (!scenes.length) throw new Error('Escreva o roteiro antes de planejar as cenas');
    return { scenes: planScenes(scenes, { title: project.creative?.packaging?.titleA || project.title }).map((item, index) => ({ ...item, label: scenes[index].label, text: scenes[index].text })), components: BUNDLED_COMPONENTS.map(({ id, label, use, propsSchema }) => ({ id, label, use, props: Object.keys(propsSchema) })) };
  }

  /**
   * Monta a timeline: narração na trilha de áudio, mídias visuais (ou slides) cobrindo a duração,
   * cenas HQ por trecho do roteiro (`scenes: 'auto'` ou lista), trilha com ducking e SFX nas trocas,
   * e legendas sincronizadas por cena. Em 9:16 aplica as áreas seguras de Shorts. Substitui a montagem anterior.
   */
  async assemble({ path: directory, captions = true, captionStyle = 'legenda', scenes = null, music = false, musicVolume = 0.35, sfx = false, shortsSafeArea = true }) {
    const project = await readProjectDirectory(directory);
    const session = await new NarrationStore(directory).read();
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    if (!narration) throw Object.assign(new Error('Monte a narração antes (gere e use “montar narração”)'), { code: 'NARRATION_MISSING' });
    const total = narration.metadata?.durationSeconds;
    if (!(total > 0)) throw new Error('Duração da narração desconhecida');
    const fps = project.timeline.fps; const totalFrames = Math.round(total * fps);
    const windows = this.#windows(project, session, total);
    const plan = scenes === 'auto' || scenes === true ? planScenes(windows.map(item => item.scene), { title: project.creative?.packaging?.titleA || project.title }) : Array.isArray(scenes) ? scenes : [];
    const all = project.media.filter(item => ['video', 'image'].includes(item.kind) && item.role !== 'thumbnail');
    const visuals = all.some(item => item.role !== 'slide') ? all.filter(item => item.role !== 'slide') : all;
    if (!visuals.length && !plan.length) throw Object.assign(new Error('Sem mídia visual: importe vídeos/imagens, gere slides do roteiro ou use cenas HQ'), { code: 'VISUAL_MISSING' });
    if (visuals.some(item => item.rights === 'pending')) throw Object.assign(new Error('Confirme os direitos das mídias antes de montar'), { code: 'RIGHTS_PENDING' });
    const musicMedia = music ? project.media.filter(item => item.role === 'music').at(-1) : null;
    if (music && !musicMedia) throw Object.assign(new Error('Gere a trilha antes (biblioteca de áudio) ou importe uma música com direitos'), { code: 'MUSIC_MISSING' });
    const sfxMedia = name => project.media.find(item => item.role === 'sfx' && item.source?.value === `SFX ${name} (gerado)`);

    const commands = [];
    if (shortsSafeArea && project.aspectRatio === '9:16') commands.push({ op: 'timeline.update', safeArea: SHORTS_SAFE_AREA });
    for (const track of project.timeline.tracks) if (['visual_main', 'audio_main', SCENES_TRACK, 'audio_music', 'audio_sfx'].includes(track.id)) for (const clip of track.clips) commands.push({ op: 'clip.remove', trackId: track.id, clipId: clip.id });
    const base = { fit: 'cover', anchor: 'center', keyframes: {}, sourceInFrame: 0, style: 'legenda' };
    commands.push({ op: 'clip.add', trackId: 'audio_main', clip: { ...base, id: clipId(), type: 'media', sourceId: narration.id, name: 'Narração', startFrame: 0, durationInFrames: totalFrames, effects: [], volume: 1 } });
    if (visuals.length) {
      const slot = Math.max(fps * 3, Math.round(totalFrames / visuals.length));
      let cursor = 0; let index = 0;
      while (cursor < totalFrames) {
        const media = visuals[index % visuals.length];
        const available = media.kind === 'image' ? Infinity : Math.floor((media.metadata?.durationSeconds || 0) * fps);
        const length = Math.min(totalFrames - cursor, slot, available);
        if (length >= 1) { commands.push({ op: 'clip.add', trackId: 'visual_main', clip: { ...base, id: clipId(), type: 'media', sourceId: media.id, name: media.name || media.id, startFrame: cursor, durationInFrames: length, effects: [{ id: fxId(), type: 'fade-in', enabled: true, params: { seconds: 0.3 } }], volume: media.kind === 'video' ? 0 : 1 } }); cursor += length; }
        index += 1;
        if (index > visuals.length * 500) break;
      }
    }
    let sceneClips = 0;
    if (plan.length) {
      if (!project.timeline.tracks.some(track => track.id === SCENES_TRACK)) commands.push({ op: 'track.add', track: scenesTrack() });
      const manifests = new Map((await this.app.components.list()).map(item => [item.id, item]));
      for (const [position, item] of plan.entries()) {
        const window = windows.find(entry => entry.scene.id === item.sceneId) || (Number.isInteger(item.index) ? windows[item.index] : windows[position]);
        const manifest = manifests.get(item.componentId);
        if (!window || !manifest) throw Object.assign(new Error(`Cena inválida: ${item.sceneId || position} → ${item.componentId}`), { code: 'SCENE_INVALID' });
        const startFrame = Math.round(window.start * fps); const end = position === plan.length - 1 && window === windows.at(-1) ? totalFrames : Math.round((window.start + window.length) * fps);
        if (end - startFrame < 1) continue;
        commands.push({ op: 'clip.add', trackId: SCENES_TRACK, clip: { ...base, id: clipId(), type: 'component', componentId: item.componentId, componentProps: sanitizeProps(manifest.propsSchema, item.props || {}), name: manifest.label, startFrame, durationInFrames: end - startFrame, fit: 'stretch', effects: [], volume: 1 } });
        sceneClips += 1;
      }
    }
    if (musicMedia || sfx) {
      const ensure = (id, name) => { if (!project.timeline.tracks.some(track => track.id === id)) commands.push({ op: 'track.add', track: { id, kind: 'audio', name, muted: false, locked: false, clips: [] } }); };
      if (musicMedia) ensure('audio_music', 'Trilha');
      if (sfx) ensure('audio_sfx', 'Efeitos sonoros');
      if (musicMedia) {
        const available = Math.floor((musicMedia.metadata?.durationSeconds || 0) * fps); let cursor = 0;
        while (cursor < totalFrames && available > fps) { const length = Math.min(available, totalFrames - cursor); commands.push({ op: 'clip.add', trackId: 'audio_music', clip: { ...base, id: clipId(), type: 'media', sourceId: musicMedia.id, name: 'Trilha', startFrame: cursor, durationInFrames: length, effects: [{ id: fxId(), type: 'duck', enabled: true, params: { level: 0.3 } }, ...(cursor + length >= totalFrames ? [{ id: fxId(), type: 'fade-out', enabled: true, params: { seconds: 2 } }] : [])], volume: Math.min(1, Math.max(0, Number(musicVolume) || 0.35)) } }); cursor += length; }
      }
      if (sfx) {
        const whoosh = sfxMedia('whoosh'); const ding = sfxMedia('ding');
        if (!whoosh) throw Object.assign(new Error('Gere os efeitos sonoros antes (biblioteca de áudio)'), { code: 'SFX_MISSING' });
        // Os efeitos ficam fora do ducking (seção de "voz"), então entram em volume baixo.
        for (const window of windows.slice(1)) { const at = Math.max(0, Math.round((window.start - 0.25) * fps)); const length = Math.min(Math.round(0.7 * fps), totalFrames - at); if (length > 0) commands.push({ op: 'clip.add', trackId: 'audio_sfx', clip: { ...base, id: clipId(), type: 'media', sourceId: whoosh.id, name: 'Whoosh', startFrame: at, durationInFrames: length, effects: [], volume: 0.22 } }); }
        if (ding && windows.length > 1) { const at = Math.round((windows.at(-1).start + 0.5) * fps); const length = Math.min(Math.round(1.2 * fps), totalFrames - at); if (length > 0) commands.push({ op: 'clip.add', trackId: 'audio_sfx', clip: { ...base, id: clipId(), type: 'media', sourceId: ding.id, name: 'Ding', startFrame: at, durationInFrames: length, effects: [], volume: 0.2 } }); }
      }
    }
    let details = await this.app.editOps.edit({ path: directory, baseRevision: project.revision, commands, label: 'Montagem automática' });
    const summary = { durationSeconds: total, visualClips: commands.filter(item => item.trackId === 'visual_main').length, sceneClips, music: Boolean(musicMedia), sfx: Boolean(sfx), safeArea: shortsSafeArea && project.aspectRatio === '9:16' ? 'shorts' : 'default' };
    if (!captions) return { revision: details.project.revision, ...summary };

    const cues = [];
    for (const window of windows) {
      const parts = sentences(window.scene.text).flatMap(captionChunks);
      const characters = parts.reduce((sum, part) => sum + part.length, 0) || 1;
      let local = window.start;
      for (const part of parts) { const span = window.length * (part.length / characters); cues.push({ start: local, end: local + span - 0.05, text: part }); local += span; }
    }
    if (cues.length) {
      const srt = cues.map((cue, position) => `${position + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join('\n');
      details = await this.app.editOps.captions({ path: directory, baseRevision: details.project.revision, srtText: srt, srtName: 'roteiro.srt', style: captionStyle });
    }
    return { revision: details.project.revision, ...summary, captions: cues.length };
  }

  /** Capítulos (um por trecho do roteiro) a partir dos tempos reais da narração montada. */
  async chapters({ path: directory }) {
    const project = await readProjectDirectory(directory);
    const session = await new NarrationStore(directory).read().catch(() => ({}));
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    if (!narration?.metadata?.durationSeconds) return { chapters: [], verified: false };
    const windows = this.#windows(project, session, narration.metadata.durationSeconds);
    const stamp = seconds => { const s = Math.floor(seconds); const h = Math.floor(s / 3600); const m = Math.floor(s / 60) % 60; return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s % 60).padStart(2, '0')}`; };
    const chapters = windows.map((window, index) => ({ time: index === 0 ? 0 : window.start, stamp: stamp(index === 0 ? 0 : window.start), title: headline(window.scene.text, 48).replace(/[.!?…]+$/, '') }));
    return { chapters, verified: true };
  }

  /** Resumo para agentes: etapa atual, o que falta, estado de cada etapa e próximos passos. */
  async summary({ path: directory }) {
    const project = await readProjectDirectory(directory);
    const active = project.stages.find(stage => ['active', 'changes_requested', 'invalidated'].includes(stage.state)) || null;
    const openRequests = (project.changeRequests || []).filter(item => item.status === 'open');
    return {
      id: project.id, title: project.title, type: project.type, aspectRatio: project.aspectRatio, mode: project.mode, revision: project.revision,
      currentStage: active ? { id: active.id, state: active.state, revision: active.revision, missing: missingStageArtifacts(project, active.id) } : null,
      stages: project.stages.map(stage => ({ id: stage.id, state: stage.state })),
      changeRequests: openRequests.map(item => ({ stageId: item.stageId, reason: item.reason, author: item.author })),
      creative: project.creative,
      media: project.media.map(item => ({ id: item.id, kind: item.kind, role: item.role || 'content', name: item.name, rights: item.rights, durationSeconds: item.metadata?.durationSeconds ?? null })),
      timeline: project.timeline.tracks.map(track => ({ id: track.id, kind: track.kind, clips: track.clips.length })),
      done: project.stages.every(stage => stage.state === 'approved'),
    };
  }

  /**
   * Espera a pessoa decidir uma etapa no app (aprovar ou pedir mudança). Responde assim que o
   * estado muda ou ao fim do tempo, com `waiting: true` para o agente chamar de novo.
   */
  async waitForDecision({ path: directory, stageId, timeoutSeconds = 50, signal }) {
    const limit = Math.min(Math.max(Number(timeoutSeconds) || 50, 1), 600) * 1000;
    const until = Date.now() + limit;
    const initial = await readProjectDirectory(directory);
    const target = stageId || initial.stages.find(stage => ['active', 'changes_requested', 'invalidated'].includes(stage.state))?.id;
    if (!target) return { stageId: null, decision: 'all_approved', waiting: false };
    const startState = initial.stages.find(stage => stage.id === target)?.state;
    const startRequests = (initial.changeRequests || []).filter(item => item.stageId === target).length;
    while (Date.now() < until && !signal?.aborted) {
      const project = await readProjectDirectory(directory);
      const stage = project.stages.find(item => item.id === target);
      const requests = (project.changeRequests || []).filter(item => item.stageId === target);
      if (stage.state === 'approved') return { stageId: target, decision: 'approved', waiting: false, revision: project.revision };
      if (requests.length > startRequests || (stage.state === 'changes_requested' && startState !== 'changes_requested')) return { stageId: target, decision: 'changes_requested', reason: requests.at(-1)?.reason || null, waiting: false, revision: project.revision };
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return { stageId: target, decision: null, waiting: true, message: 'Ainda aguardando a decisão no Content Lab; chame de novo.' };
  }

  /** Pasta `output/entrega/`: roteiro, títulos e descrição, thumbnails A/B e o vídeo final mais recente. */
  async deliverable({ path: directory }) {
    const project = await readProjectDirectory(directory);
    const target = path.join(path.resolve(directory), 'output', 'entrega');
    await mkdir(target, { recursive: true });
    const { brief, script, packaging } = project.creative;
    await writeFile(path.join(target, 'roteiro.md'), `# ${project.title}\n\n## Ideia\n\n- Tese: ${brief.thesis}\n- Público: ${brief.audience}\n- Promessa: ${brief.promise}\n\n## Abertura\n\n${script.hook}\n\n## Desenvolvimento\n\n${script.development}\n\n## Payoff\n\n${script.payoff}\n`);
    const { chapters } = project.type === 'long' ? await this.chapters({ path: directory }) : { chapters: [] };
    const chapterText = chapters.length >= 3 ? `\n## Capítulos\n\n${chapters.map(item => `${item.stamp} ${item.title}`).join('\n')}\n` : '';
    await writeFile(path.join(target, 'embalagem.md'), `# Embalagem\n\n- Título A: ${packaging.titleA}\n- Título B: ${packaging.titleB}\n\n## Descrição\n\n${packaging.description}\n${chapterText}\n## Tags\n\n${packaging.tags}\n\n## SEO\n\n${packaging.seo}\n`);
    const files = ['roteiro.md', 'embalagem.md'];
    for (const label of ['A', 'B']) {
      const media = project.media.find(item => item.id === packaging[`thumbnail${label}`]);
      const source = media && await this.app.resolveMediaPath(media);
      if (source) { const name = `thumbnail-${label}${path.extname(source) || '.png'}`; await copyFile(source, path.join(target, name)); files.push(name); }
    }
    const renders = (await this.app.listRenderJobs({ path: directory })).jobs.filter(job => job.state === 'completed' && job.output && existsSync(job.output));
    const latest = renders.sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))[0];
    if (latest) { const name = `video${path.extname(latest.output)}`; const destination = path.join(target, name); await rm(destination, { force: true }); await link(latest.output, destination).catch(() => copyFile(latest.output, destination)); files.push(name); }
    const checks = this.#checks(project, latest && await this.#probe(latest.output), latest, files, chapters);
    await writeFile(path.join(target, 'verificacao.md'), `# Verificação da entrega\n\n${checks.map(item => `- [${item.ok ? 'x' : ' '}] **${item.label}:** ${item.detail}`).join('\n')}\n\nA publicação é manual: o Content Lab não envia nada para redes sociais. Assista ao vídeo inteiro antes de publicar.\n`);
    files.push('verificacao.md');
    return { directory: target, files, video: latest?.output || null, chapters, checks, complete: checks.every(item => item.ok) };
  }

  /** Itens conferidos de verdade (estado salvo e ffprobe do render), sem presumir aprovação. */
  async #probe(file) {
    try {
      const { stdout } = await run(this.app.media?.ffprobe || 'ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], { timeout: 30_000 });
      const data = JSON.parse(stdout); const video = data.streams.find(item => item.codec_type === 'video');
      return { width: video?.width, height: video?.height, duration: Number(data.format?.duration), audio: data.streams.some(item => item.codec_type === 'audio') };
    } catch { return null; }
  }

  #checks(project, inspection, latest, files, chapters) {
    const stage = id => project.stages.find(item => item.id === id)?.state === 'approved';
    const pending = project.media.filter(item => item.rights === 'pending');
    const captions = project.timeline.tracks.filter(track => track.kind === 'caption').reduce((sum, track) => sum + track.clips.length, 0);
    return [
      { id: 'script', label: 'Roteiro', ok: stage('script'), detail: stage('script') ? 'aprovado' : 'etapa ainda não aprovada' },
      { id: 'packaging', label: 'Títulos e thumbnails A/B', ok: stage('packaging') && files.includes('thumbnail-A.png') && files.includes('thumbnail-B.png'), detail: `${files.filter(name => name.startsWith('thumbnail-')).length}/2 thumbnails${stage('packaging') ? ', embalagem aprovada' : ', embalagem não aprovada'}` },
      { id: 'rights', label: 'Direitos das mídias', ok: pending.length === 0, detail: pending.length ? `${pending.length} mídia(s) com direitos pendentes` : `${project.media.length} mídia(s) próprias ou licenciadas` },
      { id: 'render', label: 'Vídeo final', ok: Boolean(latest && inspection?.audio), detail: latest ? (inspection ? `${inspection.width}×${inspection.height}, ${Number(inspection.duration || 0).toFixed(1)} s, conferido com ffprobe` : 'render concluído') : 'sem render concluído' },
      { id: 'captions', label: 'Legendas', ok: captions > 0, detail: captions ? `${captions} legenda(s) na timeline, sincronizadas por cena` : 'sem legendas' },
      ...(project.type === 'long' ? [{ id: 'chapters', label: 'Capítulos', ok: chapters.length >= 3, detail: chapters.length >= 3 ? `${chapters.length} capítulos dos tempos da narração` : 'menos de 3 trechos: sem capítulos' }] : []),
      { id: 'review', label: 'Aprovação final', ok: stage('review'), detail: stage('review') ? 'aprovada' : 'aguardando sua aprovação' },
    ];
  }
}
