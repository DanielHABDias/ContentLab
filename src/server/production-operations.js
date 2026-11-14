import { scriptMarkdown } from '../core/script.js';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, link, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { readProjectDirectory } from './project-registry.js';
import { NarrationStore, scenesFromScript } from '../audio/narration-service.js';
import { TranscriptStore, validWordTimings } from '../media/transcript-store.js';
import { alignWindows, impact, planMotion } from './motion-planner.js';
import { narrationToVideo } from '../motion/kit/pausas.js';

/** Trilha da composição: a escolhida no plano (music.mediaId) ou a última importada com papel música. */
const musicFor = project => (project.motion?.music?.mediaId && project.media.find(item => item.id === project.motion.music.mediaId && item.role === 'music')) || project.media.filter(item => item.role === 'music').at(-1) || null;
import { MotionRenderer, mediaRefs as mediaRefsPlan } from '../render/motion-renderer.js';
import { motionPlanSchema } from '../core/contracts.js';
import { MOTION_KIT } from '../motion/kit-catalog.js';
import { wrap } from '../render/ffmpeg-graph.js';
import { mediaRefs, sanitizeProps } from '../render/remotion-component-runtime.js';
import { missingStageArtifacts } from '../core/workflow.js';
import { SCENES_TRACK, scenesTrack } from './edit-operations.js';
import { BUNDLED_COMPONENTS } from '../timeline/components/catalog.js';

const run = promisify(execFile);
const FONTS = ['/usr/share/fonts/truetype/inter-zorin-os/Inter-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', '/Library/Fonts/Arial Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf'];
const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const THUMB_SIZES = { '16:9': [1280, 720], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const round2 = value => Math.round(value * 100) / 100;
const fold = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
/**
 * Legenda palavra a palavra (padrão do kit): blocos de até 3 palavras e 18 caracteres, quebrando
 * depois de pontuação; cada bloco fica até a próxima palavra (sem piscar entre blocos curtos).
 */
export function wordCues(words, total = Infinity) {
  const cues = []; let block = [];
  const flush = next => { if (!block.length) return; const start = block[0].start; const natural = block.at(-1).end + 0.25; const end = Math.min(total, next ? Math.min(next.start, Math.max(natural, start + 0.3)) : natural); cues.push({ start, end: Math.max(start + 0.1, end - 0.02), text: block.map(word => word.text).join(' ') }); block = []; };
  words.forEach((word, index) => {
    const length = block.reduce((sum, item) => sum + item.text.length + 1, 0) + word.text.length;
    if (block.length && (block.length >= 3 || length > 18 || word.start - block.at(-1).end > 0.6)) flush(word);
    block.push(word);
    if (/[.!?…,;:]$/.test(word.text)) flush(words[index + 1]);
  });
  flush(null);
  return cues;
}

/** Caixa da cena no Short: largura toda, 64% de cima; a legenda fica abaixo, até a margem segura. */
export const SHORTS_SCENE_BOX = { x: 0, y: 0, width: 1, height: 0.64 };
export const SHORTS_SAFE_AREA = { top: 0.125, right: 0.148, bottom: 0.224, left: 0.089 };
const YEAR = /\b(1[0-9]{3}|20[0-9]{2})\b/;
const fxId = () => `fx_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
/** Imagens que mostram o assunto (não slides de texto nem thumbnails), com direitos resolvidos, na ordem de importação. */
export const evidenceImages = project => project.media.filter(item => item.kind === 'image' && !['slide', 'thumbnail', 'background', 'character'].includes(item.role) && item.rights !== 'pending');

/** Duração máxima de um beat visual (padrão do kit: troca a cada 2–5 s em Shorts, 4–8 s no longo). */
export const MAX_BEAT_SECONDS = { vertical: 4.5, horizontal: 7 };

/** Divide cada trecho do roteiro em beats visuais por frase, sem passar da duração máxima. */
export function planBeats(windows, { vertical = false } = {}) {
  const max = vertical ? MAX_BEAT_SECONDS.vertical : MAX_BEAT_SECONDS.horizontal;
  const beats = [];
  for (const window of windows) {
    const parts = sentences(window.scene.text); const characters = parts.reduce((sum, part) => sum + part.length, 0) || 1;
    let current = null; let cursor = window.start;
    for (const part of parts.length ? parts : [window.scene.text]) {
      const span = window.length * (part.length / characters);
      if (current && current.length + span > max) { beats.push(current); current = null; }
      current ||= { sceneId: window.scene.id, start: cursor, length: 0, text: '' };
      current.length += span; current.text = `${current.text} ${part}`.trim(); cursor += span;
    }
    if (current) beats.push(current);
  }
  return beats;
}

const STOP = new Set('a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que e é ou se mas mais muito como ao aos à às seu sua seus suas ele ela eles elas isso esse essa este esta foi era são ser ter tem tinha já não nem só também quando onde porque então depois antes até sobre entre estava estavam está estão ficou fica vai vão eram foram sendo havia pode podem faz fez coisa quer querem parece cada quem todo toda todos todas sempre nunca aqui agora assim dele dela você voce nada tudo algo alguém ninguém mesmo outro outra apenas ainda precisa precisava veio começa justamente direito prática alguma algum alguns algumas sua seu suas seus'.split(' '));
/** Até 3 palavras de impacto de uma frase (nomes próprios, números e palavras fortes), na ordem da fala. */
export function impactWords(text, limit = 3) {
  const words = String(text).replace(/[“”"()«»]/g, '').split(/\s+/).map(word => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
  const scored = words.map((word, index) => ({ word, index, score: (/^\p{N}/u.test(word) ? 3 : 0) + (index > 0 && /^\p{Lu}/u.test(word) ? 3 : 0) + (word.length >= 7 ? 2 : word.length >= 5 ? 1 : 0) - (STOP.has(word.toLowerCase()) ? 9 : 0) }));
  const picked = scored.filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).sort((a, b) => a.index - b.index).map(item => item.word);
  return (picked.length ? picked : words.slice(0, limit)).map(word => word.toUpperCase());
}
const round = value => Math.round(value * 100) / 100;
const ANTON = 'brand:anton';

/**
 * Plano automático do modo clips com as cenas HQ: um beat visual por frase (ou grupo
 * curto de frases), cada um com imagem do assunto (`media:<id>` das imagens do projeto, ou a página HQ
 * do kit quando não há imagem). Alterna imagem com frases, página HQ com dois painéis e galeria de cartas
 * para não repetir o mesmo componente. É ponto de partida: o agente ou a pessoa pode trocar cenas.
 */
export function planScenes(windows, { title = '', images = [], vertical = false } = {}) {
  const pool = images.map(item => (typeof item === 'string' ? { id: item, name: '' } : item)).map(item => ({ ...item, key: fold(String(item.name || '').replace(/\.[a-z0-9]+$/i, '')) }));
  let next = 0; let recent = new Set();
  // Imagem citada no texto do beat (pelo nome do arquivo) vem primeiro; depois rodízio, evitando repetir o beat anterior.
  const pickFor = text => {
    if (!pool.length) return 'brand:comic-page';
    const words = new Set(fold(text).split(/[^a-z0-9]+/).filter(word => word.length >= 3));
    const named = pool.find(item => item.key && !recent.has(item.id) && item.key.split(/[^a-z0-9]+/).some(word => word.length >= 3 && words.has(word)));
    let chosen = named;
    for (let tries = 0; !chosen && tries < pool.length; tries += 1) { const candidate = pool[next++ % pool.length]; if (!recent.has(candidate.id) || pool.length <= recent.size) chosen = candidate; }
    chosen ||= pool[next++ % pool.length];
    recent.add(chosen.id); return `media:${chosen.id}`;
  };
  const take = (count, text) => Array.from({ length: count }, () => pickFor(text));
  return planBeats(windows, { vertical }).map((beat, index, beats) => {
    recent = new Set([...recent].slice(-1));
    const words = impactWords(beat.text, 3);
    const phrases = words.map((text, position) => ({ text, at: round(0.15 + (beat.length * 0.6 * position) / Math.max(1, words.length)), size: position === 0 ? 1.1 : 0.85 }));
    const base = { sceneId: beat.sceneId, start: beat.start, length: beat.length, text: beat.text };
    const imageScene = side => ({ ...base, componentId: 'hq_imagem_frases_hq', props: { label: index === 0 ? headline(title, 28).toUpperCase() : '', imageSide: side, phrases, fontFamily: 'Anton', assets: { image: take(1, beat.text)[0], anton: ANTON } } });
    const kind = index === 0 || index === beats.length - 1 ? 0 : index % 4;
    if ((kind === 1 || (vertical && kind === 3)) && images.length >= 2 && beat.length >= (vertical ? 1.6 : 2.6)) {
      const half = round(beat.length / 2); const [a, b] = take(2, beat.text); const labels = impactWords(beat.text, 2);
      return { ...base, componentId: 'hq_pagina_hq_cenas', props: { panelLayout: 'parallax', panels: [{ asset: 'a', mediaType: 'image', label: labels[0] || '' }, { asset: 'b', mediaType: 'image', label: labels[1] || '' }], focus: [{ panel: 1, at: 0, until: half }, { panel: 2, at: half, until: round(beat.length) }], fontFamily: 'Anton', assets: { a, b, anton: ANTON } } };
    }
    if (kind === 3 && images.length >= 3 && beat.length >= 3.2 && !vertical) {
      const cards = take(3, beat.text); const titles = impactWords(beat.text, 3); while (titles.length < 3) titles.push(titles.at(-1) || 'HQ');
      const step = Math.min(0.9, (beat.length - 1) / 3);
      return { ...base, componentId: 'hq_galeria_cartas_hq', props: { title: headline(beat.text, 40).toUpperCase(), subtitle: '', columns: 3, items: cards.map((_, position) => ({ asset: `c${position}`, title: titles[position], caption: '', at: round(0.2 + position * step) })), fontFamily: 'Anton', assets: { ...Object.fromEntries(cards.map((card, position) => [`c${position}`, card])), anton: ANTON } } };
    }
    return imageScene(index % 2 === 0 ? 'right' : 'left');
  });
}

const clipId = () => `clip_${randomUUID().replaceAll('-', '').slice(0, 10)}`;

/**
 * Produção assistida (interface, CLI e MCP): slides do roteiro, thumbnails A/B,
 * montagem automática da timeline, espera por aprovação e pasta de entrega.
 * Tudo grava pelo núcleo (mídias com direitos `owned`, edições com histórico).
 */
export class ProductionOperations {
  constructor(app) { this.app = app; this.waiters = new Map(); }
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
  async thumbnails({ path: directory, variants, style = 'kit' }) {
    await this.app.requireFeature('media.import');
    if (style === 'kit') return this.#kitThumbnails(directory, variants);
    const project = await readProjectDirectory(directory);
    const packaging = project.creative.packaging;
    const list = (variants?.length ? variants : [{ label: 'A', title: packaging.titleA }, { label: 'B', title: packaging.titleB || packaging.titleA }]).slice(0, 2);
    if (list.some(item => !String(item.title || '').trim())) throw new Error('Escreva os títulos A/B (ou informe o texto de cada thumbnail)');
    const [width, height] = THUMB_SIZES[project.aspectRatio] || THUMB_SIZES['16:9'];
    const content = project.media.filter(item => ['video', 'image'].includes(item.kind) && !['thumbnail', 'background', 'character'].includes(item.role));
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
        const visible = path.join(path.resolve(directory), 'output', 'thumbnails'); await mkdir(visible, { recursive: true });
        await copyFile(file, path.join(visible, `thumbnail-${label}${path.extname(file) || '.png'}`));
        const attached = await this.#attachGenerated(directory, file, `Thumbnail ${label}`, 'thumbnail');
        result[`thumbnail${label}`] = attached.mediaId;
      }
    } finally { await rm(staging, { recursive: true, force: true }); }
    const fresh = await readProjectDirectory(directory);
    const next = { ...fresh.creative, packaging: { ...fresh.creative.packaging, ...result, thumbnailMediaId: result.thumbnailA || fresh.creative.packaging.thumbnailMediaId } };
    const updated = await this.app.runProjectAction({ path: directory, baseRevision: fresh.revision, action: { type: 'creative.update', creative: next } });
    return { ...result, revision: updated.project.revision };
  }

  /**
   * Thumbnails do kit de motion: mídia da obra dominante, até 4 palavras em Anton (*palavra* em amarelo),
   * o personagem do projeto (se houver) na pose do humor e selo opcional. Gera também a versão do tamanho do celular para conferir.
   */
  async #kitThumbnails(directory, variants) {
    const project = await readProjectDirectory(directory);
    const packaging = project.creative.packaging;
    const content = project.media.filter(item => ['video', 'image'].includes(item.kind) && !['thumbnail', 'background', 'slide', 'character'].includes(item.role));
    // Sem variantes: as palavras de impacto de cada título (até 3), a última em amarelo.
    const fromTitle = title => { const words = impact(title || '', 3); return words.length ? [...words.slice(0, -1), `*${words.at(-1)}*`].join(' ') : ''; };
    const humor = mood => (project.character ? mood : undefined);
    const list = (variants?.length ? variants : [{ label: 'A', text: fromTitle(packaging.titleA), humor: humor('surpreso') }, { label: 'B', text: fromTitle(packaging.titleB || packaging.titleA), humor: humor('determinado'), side: 'direita' }]).slice(0, 2);
    const kit = list.map((variant, index) => {
      const text = String(variant.text || variant.title || '').trim();
      if (!text) throw new Error('Informe o texto curto de cada thumbnail (até 4 palavras)');
      if (text.replace(/\*/g, '').split(/\s+/).filter(Boolean).length > 4) throw Object.assign(new Error(`Texto da thumbnail ${variant.label || index + 1} tem mais de 4 palavras: "${text}"`), { code: 'THUMB_TEXT_LONG' });
      const media = variant.mediaId || content[index % Math.max(1, content.length)]?.id;
      return { label: variant.label === 'B' || index === 1 ? 'B' : 'A', texto: text.toUpperCase().replace(/\s*\/\s*/g, '\n'), midia: media ? `media:${media}` : undefined, midiaB: variant.mediaIdB ? `media:${variant.mediaIdB}` : undefined, humor: variant.humor, lado: variant.side, tom: variant.tone, selo: variant.badge, fundo: variant.background, layout: variant.layout, foco: variant.focus, pose: variant.pose, zoom: variant.zoom, textura: variant.texture, midiaFundo: variant.backgroundMediaId ? `media:${variant.backgroundMediaId}` : undefined, alturaTexto: variant.textY };
    });
    const refs = kit.flatMap(item => [item.midia, item.midiaB, item.midiaFundo]).filter(Boolean).map(ref => ref.slice(6));
    const missing = refs.filter(id => !project.media.some(item => item.id === id));
    if (missing.length) throw Object.assign(new Error(`Mídia não está no projeto: ${missing.join(', ')}`), { code: 'MEDIA_MISSING' });
    const pending = refs.filter(id => project.media.find(item => item.id === id)?.rights === 'pending');
    if (pending.length) throw Object.assign(new Error(`Confirme os direitos antes de usar: ${pending.join(', ')}`), { code: 'RIGHTS_PENDING' });
    const resolved = { ...project, media: await Promise.all(project.media.map(async item => ({ ...item, uri: (await this.app.resolveMediaPath(item)) || item.uri }))) };
    const [width, height] = THUMB_SIZES[project.aspectRatio] || THUMB_SIZES['16:9'];
    const staging = await mkdtemp(path.join(os.tmpdir(), 'contentlab-kit-thumbs-'));
    const result = {}; const previews = [];
    try {
      const renderer = new MotionRenderer(path.join(this.app.dataDirectory, 'render'), { ffmpeg: this.ffmpeg });
      const files = await renderer.thumbnails(resolved, { variants: kit, directory: staging, width, height });
      const review = path.join(path.resolve(directory), 'output', 'previas'); await mkdir(review, { recursive: true });
      for (const { label, file } of files) {
        const small = path.join(review, `thumb-${label}-celular.png`);
        await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf', 'scale=320:-2:flags=lanczos', small], { timeout: 60_000 });
        previews.push(small);
        // Cópia visível na pasta do projeto (antes de vincular, que move o arquivo), para a pessoa abrir e subir no YouTube.
        const visible = path.join(path.resolve(directory), 'output', 'thumbnails'); await mkdir(visible, { recursive: true });
        await copyFile(file, path.join(visible, `thumbnail-${label}.png`));
        const attached = await this.#attachGenerated(directory, file, `Thumbnail ${label}`, 'thumbnail');
        result[`thumbnail${label}`] = attached.mediaId;
      }
    } finally { await rm(staging, { recursive: true, force: true }); }
    const fresh = await readProjectDirectory(directory);
    const next = { ...fresh.creative, packaging: { ...fresh.creative.packaging, ...result, thumbnailMediaId: result.thumbnailA || fresh.creative.packaging.thumbnailMediaId } };
    const updated = await this.app.runProjectAction({ path: directory, baseRevision: fresh.revision, action: { type: 'creative.update', creative: next } });
    return { ...result, phonePreviews: previews, revision: updated.project.revision, hint: 'Abra as versões de celular (320 px) e confira se o assunto e o texto se leem em 1 segundo.' };
  }

  /**
   * O que a edição já produziu, para a pessoa acompanhar no app: prévias (output/previas), vídeos
   * renderizados (output/*.mp4), thumbnails (output/thumbnails) e a pasta de entrega.
   */
  async outputs({ path: directory }) {
    const root = path.join(path.resolve(directory), 'output');
    const files = async (folder, pattern) => {
      const names = (await readdir(folder).catch(() => [])).filter(name => pattern.test(name));
      const items = await Promise.all(names.map(async name => { const info = await stat(path.join(folder, name)); return { name: path.relative(root, path.join(folder, name)), size: info.size, modifiedAt: info.mtime.toISOString() }; }));
      return items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    };
    const previews = (await files(path.join(root, 'previas'), /^previa-\d+\.png$/)).map(item => ({ ...item, second: Number(item.name.match(/(\d+)\.png$/)[1]) / 10 })).sort((a, b) => a.second - b.second);
    return { previews, renders: await files(root, /\.mp4$/i), thumbnails: await files(path.join(root, 'thumbnails'), /\.(png|jpe?g)$/i), delivery: existsSync(path.join(root, 'entrega')) };
  }

  /** Arquivo de output/ para ver no app (só imagem e vídeo, sem sair da pasta). */
  async outputFile({ path: directory, name }) {
    const root = path.join(path.resolve(directory), 'output');
    const file = path.resolve(root, String(name || ''));
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4' };
    if (!file.startsWith(root + path.sep) || !types[path.extname(file).toLowerCase()]) throw Object.assign(new Error('Arquivo fora da pasta de saída do projeto'), { code: 'FORBIDDEN_PATH' });
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) throw Object.assign(new Error('Arquivo não encontrado'), { code: 'NOT_FOUND' });
    return { file, size: info.size, contentType: types[path.extname(file).toLowerCase()] };
  }

  /** Abre no sistema a pasta de saída, de prévias, de thumbnails ou de entrega do projeto. */
  async revealOutput({ path: directory, folder = 'output' }) {
    const names = { output: '', previas: 'previas', thumbnails: 'thumbnails', entrega: 'entrega' };
    if (!(folder in names)) throw new Error('Pasta desconhecida');
    const target = path.join(path.resolve(directory), 'output', names[folder]);
    if (!existsSync(target)) throw Object.assign(new Error('Essa pasta ainda não existe'), { code: 'NOT_FOUND' });
    await this.app.opener.reveal(target);
    return { revealed: target };
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

  /**
   * Plano de cenas sugerido (sem gravar): beats visuais com imagem do assunto em cada um. Usa os tempos
   * reais da narração montada; sem ela, estima 15 caracteres por segundo. `evidence` lista as imagens que podem entrar.
   */
  async sceneSuggestions({ path: directory }) {
    const project = await readProjectDirectory(directory);
    const scenes = scenesFromScript(project.creative?.script);
    if (!scenes.length) throw new Error('Escreva o roteiro antes de planejar as cenas');
    const session = await new NarrationStore(directory).read().catch(() => ({}));
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    let windows;
    if (narration?.metadata?.durationSeconds) windows = this.#windows(project, session, narration.metadata.durationSeconds);
    else { let cursor = 0; windows = scenes.map(scene => { const window = { scene, start: cursor, length: Math.max(2, scene.text.length / 15) }; cursor += window.length; return window; }); }
    const evidence = evidenceImages(project);
    const plan = planScenes(windows, { title: project.creative?.packaging?.titleA || project.title, images: evidence.map(item => ({ id: item.id, name: item.name })), vertical: project.aspectRatio === '9:16' });
    return {
      scenes: plan.map(item => ({ ...item, start: round(item.start), length: round(item.length), label: scenes.find(scene => scene.id === item.sceneId)?.label })),
      evidence: evidence.map(item => ({ id: item.id, name: item.name, ref: `media:${item.id}` })),
      timing: narration ? 'narration' : 'estimated',
      warnings: evidence.length ? [] : ['Sem imagens do assunto: as cenas usam a página HQ do kit. Importe imagens do assunto antes de montar.'],
      components: BUNDLED_COMPONENTS.map(({ id, label, use, propsSchema }) => ({ id, label, use, props: Object.keys(propsSchema) })),
    };
  }

  /**
   * Monta a timeline: narração na trilha de áudio, mídias visuais (ou slides) cobrindo a duração,
   * cenas HQ por trecho do roteiro (`scenes: 'auto'` ou lista), trilha com ducking e SFX nas trocas,
   * e legendas sincronizadas por cena. Em 9:16 aplica as áreas seguras de Shorts. Substitui a montagem anterior.
   */
  async assemble({ path: directory, captions = true, captionStyle = 'legenda', captionMode = 'auto', scenes = null, music = false, musicVolume = 0.35, sfx = false, shortsSafeArea = true }) {
    const project = await readProjectDirectory(directory);
    const session = await new NarrationStore(directory).read();
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    if (!narration) throw Object.assign(new Error('Monte a narração antes (gere e use “montar narração”)'), { code: 'NARRATION_MISSING' });
    const total = narration.metadata?.durationSeconds;
    if (!(total > 0)) throw new Error('Duração da narração desconhecida');
    const fps = project.timeline.fps; const totalFrames = Math.round(total * fps);
    const windows = this.#windows(project, session, total);
    const all = project.media.filter(item => ['video', 'image'].includes(item.kind) && !['thumbnail', 'background', 'character'].includes(item.role));
    const evidence = evidenceImages(project);
    if ((scenes === 'auto' || scenes === true) && !evidence.length) throw Object.assign(new Error('O estilo HQ precisa de imagens do assunto: importe imagens dos personagens/obra com direitos confirmados (slides de texto não contam)'), { code: 'VISUAL_EVIDENCE_MISSING' });
    const plan = scenes === 'auto' || scenes === true ? planScenes(windows, { title: project.creative?.packaging?.titleA || project.title, images: evidence.map(item => ({ id: item.id, name: item.name })), vertical: project.aspectRatio === '9:16' }) : Array.isArray(scenes) ? scenes : [];
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
    // Short com cenas: a cena ocupa a parte de cima e o terço de baixo fica livre para a legenda.
    const sceneLayout = project.aspectRatio === '9:16' && plan.length ? { '9:16': SHORTS_SCENE_BOX } : undefined;
    if (sceneLayout) {
      const band = await this.#captionBand(directory, project);
      commands.push({ op: 'clip.add', trackId: 'visual_main', clip: { ...base, id: clipId(), type: 'media', sourceId: band, name: 'Faixa da legenda', startFrame: 0, durationInFrames: totalFrames, effects: [], volume: 0 } });
    }
    if (visuals.length && !sceneLayout) {
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
      let sceneEnd = 0;
      for (const [position, item] of plan.entries()) {
        const window = Number.isFinite(item.start) && Number.isFinite(item.length) ? { start: item.start, length: item.length } : windows.find(entry => entry.scene.id === item.sceneId) || (Number.isInteger(item.index) ? windows[item.index] : windows[position]);
        const manifest = manifests.get(item.componentId);
        if (!window || !manifest) throw Object.assign(new Error(`Cena inválida: ${item.sceneId || position} → ${item.componentId}`), { code: 'SCENE_INVALID' });
        const missing = mediaRefs(item.props || {}).filter(id => !project.media.some(media => media.id === id));
        if (missing.length) throw Object.assign(new Error(`Cena ${item.sceneId || position} usa mídia que não está no projeto: ${missing.join(', ')}`), { code: 'SCENE_INVALID' });
        // Tempos arredondados (ex.: vindos de scene_list) não podem sobrepor a cena anterior.
        const startFrame = Math.max(sceneEnd, Math.round(window.start * fps)); const end = position === plan.length - 1 ? totalFrames : Math.min(totalFrames, Math.round((window.start + window.length) * fps));
        if (end - startFrame < 1) continue;
        sceneEnd = end;
        commands.push({ op: 'clip.add', trackId: SCENES_TRACK, clip: { ...base, id: clipId(), type: 'component', componentId: item.componentId, componentProps: sanitizeProps(manifest.propsSchema, item.props || {}), name: manifest.label, startFrame, durationInFrames: end - startFrame, fit: 'stretch', ...(sceneLayout ? { layout: sceneLayout, anchor: 'top' } : {}), effects: [], volume: 1 } });
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
    // A faixa do Short entra como mídia gerada antes da edição: a revisão base é a atual.
    const baseRevision = sceneLayout ? (await readProjectDirectory(directory)).revision : project.revision;
    let details = await this.app.editOps.edit({ path: directory, baseRevision, commands, label: 'Montagem automática' });
    const summary = { durationSeconds: total, visualClips: commands.filter(item => item.trackId === 'visual_main').length, sceneClips, images: new Set(plan.flatMap(item => mediaRefs(item.props || {}))).size, music: Boolean(musicMedia), sfx: Boolean(sfx), safeArea: shortsSafeArea && project.aspectRatio === '9:16' ? 'shorts' : 'default' };
    if (!captions) return { revision: details.project.revision, ...summary };

    const words = captionMode === 'phrases' ? [] : await this.#narrationWords(directory, narration);
    if (captionMode === 'words' && !words.length) throw Object.assign(new Error('Transcreva a narração antes (narration_transcribe) para legenda palavra a palavra'), { code: 'WORDS_MISSING' });
    const cues = words.length ? wordCues(words, total) : [];
    if (!words.length) for (const window of windows) {
      const parts = sentences(window.scene.text).flatMap(captionChunks);
      const characters = parts.reduce((sum, part) => sum + part.length, 0) || 1;
      let local = window.start;
      for (const part of parts) { const span = window.length * (part.length / characters); cues.push({ start: local, end: local + span - 0.05, text: part }); local += span; }
    }
    if (cues.length) {
      const srt = cues.map((cue, position) => `${position + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join('\n');
      details = await this.app.editOps.captions({ path: directory, baseRevision: details.project.revision, srtText: srt, srtName: 'roteiro.srt', style: captionStyle });
    }
    return { revision: details.project.revision, ...summary, captions: cues.length, captionSync: words.length ? 'words' : 'phrases' };
  }

  /**
   * Fundo do Short com cenas: tinta da paleta do kit, meio-tom que cresce para baixo e linha amarela
   * na borda da cena, para a faixa da legenda não ficar lisa. Gerado localmente (direitos próprios), uma vez por projeto.
   */
  async #captionBand(directory, project) {
    const existing = project.media.find(item => item.role === 'background' && item.source?.value === 'Faixa da legenda (gerada)');
    if (existing) return existing.id;
    const [width, height] = SIZES['9:16']; const edge = Math.round(height * SHORTS_SCENE_BOX.height);
    const staging = await mkdtemp(path.join(os.tmpdir(), 'contentlab-band-'));
    try {
      const file = path.join(staging, 'faixa-legenda.png');
      const dots = `if(lt(hypot(mod(X+12*mod(floor(Y/24),2),24)-12,mod(Y,24)-12),1.5+4*clip((Y-${edge})/${height - edge},0,1)),58,14)`;
      await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `nullsrc=s=${width}x${height},format=gray`, '-vf', `geq=lum='${dots}',format=rgb24,colorchannelmixer=rr=0.9:gg=0.9:bb=1.2,drawbox=x=0:y=${edge}:w=iw:h=10:color=0xF5C518:t=fill,drawbox=x=0:y=${edge + 10}:w=iw:h=6:color=0x0B0B10:t=fill`, '-frames:v', '1', file], { timeout: 60_000 });
      const imported = await this.app.media.importFile(file);
      const result = await this.app.mediaOps.attach(directory, imported, { rights: 'owned', source: { type: 'generated', value: 'Faixa da legenda (gerada)' }, name: 'Faixa da legenda', role: 'background' });
      return result.mediaId;
    } finally { await rm(staging, { recursive: true, force: true }); }
  }

  /** Palavras com tempo da transcrição da narração montada (só se a transcrição é deste arquivo). */
  async #narrationWords(directory, narration) {
    const store = new TranscriptStore(directory);
    const meta = await store.meta(narration.id).catch(() => null);
    if (!meta || meta.sha256 !== narration.sha256 || meta.model !== 'whisper-large-v3') return [];
    const words = (await store.read(narration.id))?.words;
    return validWordTimings(words) ? words : [];
  }

  /** Transcreve a narração montada (Whisper) para legendas palavra a palavra. Devolve jobId. */
  async transcribeNarration({ path: directory, force = false }) {
    const project = await readProjectDirectory(directory);
    const session = await new NarrationStore(directory).read();
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    if (!narration || session.assembled.outdated) throw Object.assign(new Error('Monte a narração atual antes de transcrever'), { code: 'NARRATION_MISSING' });
    const running = this.app.mediaOps.jobs.list({ projectPath: directory }).find(job => job.kind === 'transcription' && job.state === 'running' && job.label.endsWith(narration.id));
    if (running) return { jobId: running.id, mediaId: narration.id };
    const result = await this.app.mediaOps.transcribe({ path: directory, mediaId: narration.id, force, requireWords: true });
    return result?.id ? { jobId: result.id, mediaId: narration.id } : { status: result.status, mediaId: narration.id };
  }

  /** Leitura paginada das palavras e tempos reais do áudio montado, para o agente editar. */
  async narrationTranscript({ path: directory, offset = 0, limit = 500 }) {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Use offset ≥ 0 e limit entre 1 e 1000');
    const project = await readProjectDirectory(directory);
    const session = await new NarrationStore(directory).read();
    const narration = project.media.find(item => item.id === session.assembled?.mediaId);
    if (!narration || session.assembled.outdated) throw Object.assign(new Error('Monte a narração atual antes de consultar os tempos'), { code: 'NARRATION_MISSING' });
    const words = await this.#narrationWords(directory, narration);
    if (!words.length) throw Object.assign(new Error('Gere a transcrição com narration_transcribe (a montagem não transcreve)'), { code: 'WORDS_MISSING' });
    return { mediaId: narration.id, model: 'whisper-large-v3', language: 'pt', total: words.length, offset, nextOffset: offset + limit < words.length ? offset + limit : null, words: words.slice(offset, offset + limit) };
  }

  /** Capítulos (um por trecho do roteiro) a partir dos tempos reais da narração montada. */
  async chapters({ path: directory }) {
    const project = await readProjectDirectory(directory);
    const session = await new NarrationStore(directory).read().catch(() => ({}));
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    if (!narration?.metadata?.durationSeconds) return { chapters: [], verified: false };
    // Tempos reais das palavras (Whisper) quando houver transcrição; sem ela, a estimativa pelo texto.
    const words = await this.#narrationWords(directory, narration).catch(() => []);
    const windows = alignWindows(this.#windows(project, session, narration.metadata.durationSeconds), words);
    const stamp = seconds => { const s = Math.floor(seconds); const h = Math.floor(s / 3600); const m = Math.floor(s / 60) % 60; return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s % 60).padStart(2, '0')}`; };
    const seen = new Set();
    const starts = windows.filter(window => {
      if (!window.scene.chapterId) return true;
      if (seen.has(window.scene.chapterId)) return false;
      seen.add(window.scene.chapterId); return true;
    });
    // Pausas da composição (trechos com áudio original) empurram os capítulos para frente no vídeo final.
    const at = window => (window.start ? narrationToVideo(window.start, project.motion?.pausas) : 0);
    const chapters = starts.map((window, index) => ({ time: index === 0 ? 0 : at(window), stamp: stamp(index === 0 ? 0 : at(window)), title: window.scene.chapterTitle || headline(window.scene.text, 48).replace(/[.!?…]+$/, '') }));
    // A tela final do vídeo longo vira o último capítulo (onde ficam os elementos finais do YouTube).
    const ending = project.motion?.beats?.find(beat => beat.scene === 'telafinal');
    if (ending && ending.at > (chapters.at(-1)?.time ?? 0) + 10) chapters.push({ time: ending.at, stamp: stamp(ending.at), title: 'Continue no canal' });
    return { chapters, verified: true, timing: words.length ? 'palavras' : 'estimativa' };
  }

  /** Resumo para agentes: etapa atual, o que falta, estado de cada etapa e próximos passos. */
  async summary({ path: directory }) {
    const project = await readProjectDirectory(directory);
    const active = project.stages.find(stage => ['active', 'changes_requested', 'invalidated'].includes(stage.state)) || null;
    const openRequests = (project.changeRequests || []).filter(item => item.status === 'open');
    return {
      id: project.id, title: project.title, type: project.type, aspectRatio: project.aspectRatio, mode: project.mode, pauseAt: project.pauseAt || [], narrationBy: project.narrationBy ?? null, revision: project.revision,
      currentStage: active ? { id: active.id, state: active.state, revision: active.revision, missing: missingStageArtifacts(project, active.id) } : null,
      stages: project.stages.map(stage => ({ id: stage.id, state: stage.state })),
      changeRequests: openRequests.map(item => ({ stageId: item.stageId, reason: item.reason, author: item.author })),
      creative: project.creative,
      media: project.media.map(item => ({ id: item.id, kind: item.kind, role: item.role || 'content', name: item.name, rights: item.rights, durationSeconds: item.metadata?.durationSeconds ?? null })),
      timeline: project.timeline.tracks.map(track => ({ id: track.id, kind: track.kind, clips: track.clips.length })),
      motion: project.motion ? { beats: project.motion.beats.length, durationSeconds: round2(Math.max(...project.motion.beats.map(beat => beat.at + beat.duration))), narration: project.motion.narration, source: project.motion.source } : null,
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
    const key = path.resolve(directory);
    const previous = this.waiters.get(key)?.stageId === target ? this.waiters.get(key) : null;
    const waiter = { stageId: target, since: previous?.since || new Date().toISOString(), active: (previous?.active || 0) + 1, lastSeen: Date.now() };
    this.waiters.set(key, waiter);
    try { return await this.#pollDecision(directory, initial, target, until, signal); }
    finally { waiter.active -= 1; waiter.lastSeen = Date.now(); }
  }

  /**
   * O que a interface mostra ao vivo: revisão em disco (para recarregar quando o agente muda o
   * projeto) e se o agente está esperando a decisão da pessoa numa etapa. Entre duas chamadas
   * seguidas do agente há uma folga curta, então a espera vale por alguns segundos depois de cada uma.
   */
  async live({ path: directory }) {
    const project = await readProjectDirectory(directory);
    const waiter = this.waiters.get(path.resolve(directory));
    const waiting = waiter && (waiter.active > 0 || Date.now() - waiter.lastSeen < 5000);
    const stage = waiting && project.stages.find(item => item.id === waiter.stageId);
    const agentWaiting = stage && stage.state !== 'approved' ? { stageId: waiter.stageId, since: waiter.since } : null;
    if (!waiting && waiter) this.waiters.delete(path.resolve(directory));
    return { revision: project.revision, agentWaiting };
  }

  async #pollDecision(directory, initial, target, until, signal) {
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
    await writeFile(path.join(target, 'roteiro.md'), `# ${project.title}\n\n## Ideia\n\n- Tese: ${brief.thesis}\n- Público: ${brief.audience}\n- Promessa: ${brief.promise}\n\n${scriptMarkdown(script)}\n`);
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
    const session = await new NarrationStore(directory).read().catch(() => ({}));
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    const byWord = Boolean(narration && (await this.#narrationWords(directory, narration)).length);
    const checks = this.#checks(project, latest && await this.#probe(latest.output), latest, files, chapters, byWord);
    await writeFile(path.join(target, 'verificacao.md'), `# Verificação da entrega\n\n${checks.map(item => `- [${item.ok ? 'x' : ' '}] **${item.label}${item.advisory ? ' (decisão sua)' : ''}:** ${item.detail}`).join('\n')}\n\nA publicação é manual: o Content Lab não envia nada para redes sociais. Assista ao vídeo inteiro antes de publicar.\n`);
    files.push('verificacao.md');
    return { directory: target, files, video: latest?.output || null, chapters, checks, complete: checks.every(item => item.ok || item.advisory) };
  }

  /** Itens conferidos de verdade (estado salvo e ffprobe do render), sem presumir aprovação. */
  async #probe(file) {
    try {
      const { stdout } = await run(this.app.media?.ffprobe || 'ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], { timeout: 30_000 });
      const data = JSON.parse(stdout); const video = data.streams.find(item => item.codec_type === 'video');
      return { width: video?.width, height: video?.height, duration: Number(data.format?.duration), audio: data.streams.some(item => item.codec_type === 'audio') };
    } catch { return null; }
  }

  // ---- Modo composição (kit de motion do Content Lab) ----

  /** Narração, tempos das palavras e trilha para o render da composição (caminhos já resolvidos). */
  async motionInputs(directory, project) {
    const session = await new NarrationStore(directory).read().catch(() => ({}));
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    const words = narration ? await this.#narrationWords(directory, narration) : [];
    const music = project.motion?.music ? musicFor(project) : null;
    return { narration: narration ? (await this.app.resolveMediaPath(narration)) || narration.uri : null, narrationSeconds: narration?.metadata?.durationSeconds || 0, words, music: music ? (await this.app.resolveMediaPath(music)) || music.uri : null };
  }

  /** Catálogo do kit para o agente: cenas, props, humores, pacote de personagem e SFX. */
  motionKit() { return MOTION_KIT; }

  async motionPlan({ path: directory }) { const project = await readProjectDirectory(directory); return { plan: project.motion, revision: project.revision }; }

  /**
   * Plano automático: frases do roteiro nos tempos reais da narração (palavras do Whisper), imagens/vídeos do
   * assunto na ordem de importação (citados pelo nome entram quando são citados). Sem narração montada,
   * estima 15 caracteres por segundo e gera um vídeo sem narração. Grava no projeto (apply=false só devolve).
   */
  async motionPlanAuto({ path: directory, apply = true, music = true }) {
    const project = await readProjectDirectory(directory);
    const scenes = scenesFromScript(project.creative?.script);
    if (!scenes.length) throw new Error('Escreva o roteiro antes de planejar o vídeo');
    const session = await new NarrationStore(directory).read().catch(() => ({}));
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    let windows; let words = [];
    if (narration?.metadata?.durationSeconds) {
      if (session.assembled.outdated) throw Object.assign(new Error('A narração mudou; monte e transcreva novamente antes da edição'), { code: 'NARRATION_MISSING' });
      words = await this.#narrationWords(directory, narration); windows = alignWindows(this.#windows(project, session, narration.metadata.durationSeconds), words);
      if (!words.length) throw Object.assign(new Error('Conclua a transcrição palavra por palavra da narração antes de editar'), { code: 'WORDS_MISSING' });
    }
    else { let cursor = 0; windows = scenes.map(scene => { const window = { scene, start: cursor, length: Math.max(2, scene.text.length / 15) }; cursor += window.length; return window; }); }
    const media = project.media.filter(item => ['image', 'video'].includes(item.kind) && !['slide', 'thumbnail', 'background', 'character'].includes(item.role) && item.rights !== 'pending').map(item => ({ id: item.id, name: item.name, kind: item.kind }));
    const poses = project.character?.poses || null; const report = {};
    const plan = planMotion({ windows, words, media, title: project.creative?.packaging?.titleA || project.title, end: narration?.metadata?.durationSeconds ? narration.metadata.durationSeconds + 0.8 : null, vertical: project.aspectRatio === '9:16', poses, report });
    plan.narration = Boolean(narration);
    plan.music = music && project.media.some(item => item.role === 'music') ? { volume: 0.5, duck: 0.25 } : null;
    const warnings = [
      ...(!narration ? ['Sem narração montada: tempos estimados e vídeo sem narração.'] : []),
      ...(narration && !words.length ? ['Narração sem transcrição: rode narration_transcribe para sincronizar beats e legenda por palavra.'] : []),
      ...(!media.length ? ['Sem imagens/vídeos da obra: o plano usa texto. Importe cenas das obras citadas (direitos confirmados).'] : []),
      ...(!poses ? ['Sem personagem no projeto: o plano não tem apartes nem a cena personagem. Se o vídeo tiver um, importe o pacote com character_import.'] : []),
      ...(!plan.music ? ['Sem trilha: importe uma faixa licenciada com papel music.'] : []),
      ...(project.aspectRatio !== '9:16' && report.posesFaltando?.length ? [`Poses do personagem que não apareceram: ${report.posesFaltando.join(', ')}. Encaixe-as em apartes de tom compatível (motion_plan_set).`] : []),
    ];
    if (!apply) return { plan, warnings, poses: report };
    const saved = await this.motionPlanSet({ path: directory, plan, source: 'auto' });
    return { ...saved, warnings, poses: report };
  }

  /** Prévia de frames do plano atual (PNG em output/previas/): o agente confere o visual antes do render. */
  async motionPreview({ path: directory, seconds }) {
    const stored = await readProjectDirectory(directory);
    if (!stored.motion?.beats?.length) throw Object.assign(new Error('Sem plano de motion: use motion_plan_auto ou motion_plan_set'), { code: 'MOTION_MISSING' });
    const project = { ...stored, media: await Promise.all(stored.media.map(async item => ({ ...item, uri: (await this.app.resolveMediaPath(item)) || item.uri }))) };
    project.motionInputs = await this.motionInputs(directory, project);
    const times = (seconds?.length ? seconds : stored.motion.beats.map(beat => beat.at + Math.min(beat.duration * 0.6, beat.duration - 0.1))).slice(0, 24);
    const renderer = new MotionRenderer(path.join(this.app.dataDirectory, 'render'), { ffmpeg: this.ffmpeg });
    const result = await renderer.stills(project, { seconds: times, directory: path.join(path.resolve(directory), 'output', 'previas') });
    return { files: result.files, seconds: times };
  }

  /** Grava o plano (validado pelo contrato) depois de conferir mídias citadas e direitos. */
  async motionPlanSet({ path: directory, plan, baseRevision, source = 'agent' }) {
    const project = await readProjectDirectory(directory);
    if (baseRevision !== undefined && baseRevision !== project.revision) throw Object.assign(new Error(`O projeto mudou (revisão ${project.revision}); leia o plano de novo`), { code: 'REVISION_CONFLICT' });
    if (plan === null) { const result = await this.app.runProjectAction({ path: directory, baseRevision: project.revision, action: { type: 'motion.set', motion: null } }); return { plan: null, revision: result.project.revision }; }
    const parsed = motionPlanSchema.safeParse({ ...plan, schema: 'contentlab-motion-v1', source: plan.source || source });
    if (!parsed.success) throw Object.assign(new Error(`Plano inválido: ${parsed.error.issues.slice(0, 5).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`), { code: 'MOTION_INVALID' });
    const refs = mediaRefsPlan(parsed.data);
    const missing = refs.filter(id => !project.media.some(item => item.id === id));
    if (missing.length) throw Object.assign(new Error(`Mídia citada não está no projeto: ${missing.join(', ')}`), { code: 'MOTION_INVALID' });
    const pending = refs.filter(id => project.media.find(item => item.id === id)?.rights === 'pending');
    if (pending.length) throw Object.assign(new Error(`Confirme os direitos antes de usar: ${pending.join(', ')}`), { code: 'RIGHTS_PENDING' });
    const result = await this.app.runProjectAction({ path: directory, baseRevision: project.revision, action: { type: 'motion.set', motion: parsed.data } });
    const beats = parsed.data.beats; const end = Math.max(...beats.map(beat => beat.at + beat.duration));
    return { revision: result.project.revision, beats: beats.length, durationSeconds: round2(end), averageBeat: round2(beats.reduce((sum, beat) => sum + beat.duration, 0) / beats.length), scenes: Object.fromEntries([...new Set(beats.map(beat => beat.scene))].map(scene => [scene, beats.filter(beat => beat.scene === scene).length])), media: refs.length, plan: parsed.data };
  }

  /** Toda cena HQ mostra uma imagem do assunto (mídia do projeto ou personagem), não só texto. */
  #visualCheck(project) {
    if (project.motion?.beats?.length) {
      const beats = project.motion.beats; const SUBJECT = new Set(['evidencia', 'pagina', 'personagem', 'ficha', 'comparacao', 'cta', 'numero', 'lista', 'formula']);
      const withSubject = beats.filter(beat => SUBJECT.has(beat.scene) || /"media:/.test(JSON.stringify(beat.props || {})) || beat.props?.humor);
      const distinct = new Set(beats.flatMap(beat => mediaRefs(beat.props || {}))).size;
      const longest = Math.max(...beats.map(beat => beat.duration)); const average = beats.reduce((sum, beat) => sum + beat.duration, 0) / beats.length;
      return { id: 'visual', label: 'Ritmo e imagem do assunto', ok: withSubject.length >= beats.length * 0.6 && longest <= 10 && average <= 6, detail: `${beats.length} beats (média ${average.toFixed(1)} s, maior ${longest.toFixed(1)} s); ${withSubject.length} com assunto ou personagem; ${distinct} mídia(s) da obra` };
    }
    const scenes = project.timeline.tracks.find(track => track.id === SCENES_TRACK)?.clips || [];
    if (!scenes.length) return { id: 'visual', label: 'Imagem do assunto em cada cena', ok: false, detail: 'sem cenas HQ na timeline' };
    const withImage = scenes.filter(clip => /"(media|brand):(?!anton|comic-page)[\w.-]+"/.test(JSON.stringify(clip.componentProps || {})));
    const distinct = new Set(scenes.flatMap(clip => mediaRefs(clip.componentProps || {}))).size;
    return { id: 'visual', label: 'Imagem do assunto em cada cena', ok: withImage.length === scenes.length && distinct > 0, detail: `${withImage.length}/${scenes.length} cenas com imagem; ${distinct} imagem(ns) distinta(s) do projeto` };
  }

  /** Trilha final precisa de licença registrada; a trilha sintetizada serve só de rascunho. */
  #musicCheck(project) {
    const ids = new Set(project.timeline.tracks.flatMap(track => track.clips).map(clip => clip.sourceId));
    const music = project.motion?.beats?.length ? (project.motion.music ? [musicFor(project)].filter(Boolean) : []) : project.media.filter(item => item.role === 'music' && ids.has(item.id));
    if (!music.length) return { id: 'music', label: 'Trilha licenciada', ok: false, detail: 'sem trilha: importe uma faixa licenciada (ex.: YouTube Audio Library) com papel música' };
    const generated = music.filter(item => item.source?.type === 'generated');
    return { id: 'music', label: 'Trilha licenciada', ok: !generated.length, detail: generated.length ? 'trilha sintetizada é rascunho: troque por faixa licenciada antes de publicar' : `${music.length} faixa(s) com licença registrada` };
  }

  #checks(project, inspection, latest, files, chapters, byWord = false) {
    const stage = id => project.stages.find(item => item.id === id)?.state === 'approved';
    const pending = project.media.filter(item => item.rights === 'pending');
    const motion = project.motion?.beats?.length ? project.motion : null;
    const captions = motion ? (motion.captions !== false && byWord ? 1 : 0) : project.timeline.tracks.filter(track => track.kind === 'caption').reduce((sum, track) => sum + track.clips.length, 0);
    return [
      { id: 'script', label: 'Roteiro', ok: stage('script'), detail: stage('script') ? 'aprovado' : 'etapa ainda não aprovada' },
      { id: 'packaging', label: 'Títulos e thumbnails A/B', ok: stage('packaging') && files.includes('thumbnail-A.png') && files.includes('thumbnail-B.png'), detail: `${files.filter(name => name.startsWith('thumbnail-')).length}/2 thumbnails${stage('packaging') ? ', embalagem aprovada' : ', embalagem não aprovada'}` },
      { id: 'rights', label: 'Direitos das mídias', ok: pending.length === 0, detail: pending.length ? `${pending.length} mídia(s) com direitos pendentes` : `${project.media.length} mídia(s) próprias ou licenciadas` },
      { id: 'render', label: 'Vídeo final', ok: Boolean(latest && inspection?.audio), detail: latest ? (inspection ? `${inspection.width}×${inspection.height}, ${Number(inspection.duration || 0).toFixed(1)} s, conferido com ffprobe` : 'render concluído') : 'sem render concluído' },
      this.#visualCheck(project),
      this.#musicCheck(project),
      ...(project.type === 'short' ? [{ id: 'duration', label: 'Duração do Short', advisory: true, ok: Number(inspection?.duration || 0) >= 60, detail: `${Number(inspection?.duration || 0).toFixed(1)} s; o canal prefere 60 s ou mais quando o conteúdo sustenta` }] : []),
      { id: 'captions', label: 'Legendas', ok: captions > 0, detail: motion ? (captions ? 'palavra a palavra na composição (tempos do Whisper)' : motion.narration === false ? 'vídeo sem narração: texto na tela faz o papel da legenda' : 'transcreva a narração (narration_transcribe) para a legenda por palavra') : captions ? `${captions} legenda(s) na timeline, sincronizadas ${byWord ? 'palavra a palavra (Whisper)' : 'por frase'}` : 'sem legendas', ...(motion?.narration === false ? { ok: true } : {}) },
      ...(project.type === 'long' ? [{ id: 'chapters', label: 'Capítulos', advisory: Number(inspection?.duration || 0) < 180, ok: chapters.length >= 3, detail: chapters.length >= 3 ? `${chapters.length} capítulos dos tempos da narração` : 'menos de 3 trechos: sem capítulos' }] : []),
      { id: 'review', label: 'Aprovação final', ok: stage('review'), detail: stage('review') ? 'aprovada' : 'aguardando sua aprovação' },
    ];
  }
}
