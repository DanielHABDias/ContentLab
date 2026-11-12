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
import { missingStageArtifacts } from '../core/workflow.js';

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

  /**
   * Monta a timeline: narração montada na trilha de áudio, mídias visuais (ou slides)
   * cobrindo a duração e legendas do roteiro sincronizadas por cena. Substitui a montagem anterior.
   */
  async assemble({ path: directory, captions = true, captionStyle = 'legenda' }) {
    const project = await readProjectDirectory(directory);
    const session = await new NarrationStore(directory).read();
    const narration = session.assembled?.mediaId && project.media.find(item => item.id === session.assembled.mediaId);
    if (!narration) throw Object.assign(new Error('Monte a narração antes (gere e use “montar narração”)'), { code: 'NARRATION_MISSING' });
    const total = narration.metadata?.durationSeconds;
    if (!(total > 0)) throw new Error('Duração da narração desconhecida');
    const fps = project.timeline.fps; const totalFrames = Math.round(total * fps);
    const all = project.media.filter(item => ['video', 'image'].includes(item.kind) && item.role !== 'thumbnail');
    const visuals = all.some(item => item.role !== 'slide') ? all.filter(item => item.role !== 'slide') : all;
    if (!visuals.length) throw Object.assign(new Error('Sem mídia visual: importe vídeos/imagens ou gere slides do roteiro'), { code: 'VISUAL_MISSING' });
    if (visuals.some(item => item.rights === 'pending')) throw Object.assign(new Error('Confirme os direitos das mídias antes de montar'), { code: 'RIGHTS_PENDING' });

    const commands = [];
    for (const track of project.timeline.tracks) if (['visual_main', 'audio_main'].includes(track.id)) for (const clip of track.clips) commands.push({ op: 'clip.remove', trackId: track.id, clipId: clip.id });
    commands.push({ op: 'clip.add', trackId: 'audio_main', clip: { id: clipId(), type: 'media', sourceId: narration.id, name: 'Narração', startFrame: 0, durationInFrames: totalFrames, fit: 'cover', anchor: 'center', keyframes: {}, effects: [], sourceInFrame: 0, volume: 1, style: 'legenda' } });
    const slot = Math.max(fps * 3, Math.round(totalFrames / visuals.length));
    let cursor = 0; let index = 0;
    while (cursor < totalFrames) {
      const media = visuals[index % visuals.length];
      const available = media.kind === 'image' ? Infinity : Math.floor((media.metadata?.durationSeconds || 0) * fps);
      const length = Math.min(totalFrames - cursor, slot, available);
      if (length >= 1) { commands.push({ op: 'clip.add', trackId: 'visual_main', clip: { id: clipId(), type: 'media', sourceId: media.id, name: media.name || media.id, startFrame: cursor, durationInFrames: length, fit: 'cover', anchor: 'center', keyframes: {}, effects: [{ id: `fx_${randomUUID().replaceAll('-', '').slice(0, 10)}`, type: 'fade-in', enabled: true, params: { seconds: 0.3 } }], sourceInFrame: 0, volume: media.kind === 'video' ? 0 : 1, style: 'legenda' } }); cursor += length; }
      index += 1;
      if (index > visuals.length * 500) break;
    }
    let details = await this.app.editOps.edit({ path: directory, baseRevision: project.revision, commands, label: 'Montagem automática' });
    if (!captions) return { revision: details.project.revision, durationSeconds: total, visualClips: commands.filter(item => item.trackId === 'visual_main').length };

    const scenes = scenesFromScript(project.creative?.script);
    const takes = (session.assembled.takeIds || []).map(id => session.takes.find(take => take.id === id)).filter(Boolean);
    const durations = takes.map(take => (take.trim ? take.trim.end - take.trim.start : take.durationSeconds) || 0);
    const scale = durations.reduce((sum, value) => sum + value, 0) > 0 ? total / durations.reduce((sum, value) => sum + value, 0) : 1;
    const cues = []; let offset = 0;
    for (const [position, take] of takes.entries()) {
      const scene = scenes.find(item => item.id === take.sceneId) || scenes[position];
      const length = durations[position] * scale;
      const parts = scene ? sentences(scene.text).flatMap(captionChunks) : [];
      const characters = parts.reduce((sum, part) => sum + part.length, 0) || 1;
      let local = offset;
      for (const part of parts) { const span = length * (part.length / characters); cues.push({ start: local, end: local + span - 0.05, text: part }); local += span; }
      offset += length;
    }
    if (cues.length) {
      const srt = cues.map((cue, position) => `${position + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join('\n');
      details = await this.app.editOps.captions({ path: directory, baseRevision: details.project.revision, srtText: srt, srtName: 'roteiro.srt', style: captionStyle });
    }
    return { revision: details.project.revision, durationSeconds: total, visualClips: commands.filter(item => item.trackId === 'visual_main').length, captions: cues.length };
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
    await writeFile(path.join(target, 'embalagem.md'), `# Embalagem\n\n- Título A: ${packaging.titleA}\n- Título B: ${packaging.titleB}\n\n## Descrição\n\n${packaging.description}\n\n## Tags\n\n${packaging.tags}\n\n## SEO\n\n${packaging.seo}\n`);
    const files = ['roteiro.md', 'embalagem.md'];
    for (const label of ['A', 'B']) {
      const media = project.media.find(item => item.id === packaging[`thumbnail${label}`]);
      const source = media && await this.app.resolveMediaPath(media);
      if (source) { const name = `thumbnail-${label}${path.extname(source) || '.png'}`; await copyFile(source, path.join(target, name)); files.push(name); }
    }
    const renders = (await this.app.listRenderJobs({ path: directory })).jobs.filter(job => job.state === 'completed' && job.output && existsSync(job.output));
    const latest = renders.sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))[0];
    if (latest) { const name = `video${path.extname(latest.output)}`; const destination = path.join(target, name); await rm(destination, { force: true }); await link(latest.output, destination).catch(() => copyFile(latest.output, destination)); files.push(name); }
    return { directory: target, files, video: latest?.output || null, complete: Boolean(latest) && files.includes('thumbnail-A.png') };
  }
}

