import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { BUNDLED_COMPONENTS } from '../timeline/components/catalog.js';
/** Trilha das cenas HQ: acima do visual principal; legendas continuam por cima de tudo. */
export const SCENES_TRACK = 'visual_scenes';
export const scenesTrack = () => ({ id: SCENES_TRACK, kind: 'visual', name: 'Cenas', muted: false, locked: false, clips: [] });
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { CANVASES } from '../render/render-plan.js';
import { TranscriptStore, parseSrt } from '../media/transcript-store.js';
import { LifecycleError } from './project-lifecycle.js';
import { readProjectDirectory } from './project-registry.js';
import { sanitizeProps } from '../render/remotion-component-runtime.js';

const HISTORY_LIMIT = 30;
const PREVIEW_NAME = /^[a-z0-9_-]{3,64}-[a-f0-9]{16}-[0-9]+-(16x9|9x16|1x1|4x5)\.(png|mp4)$/;

/**
 * Edição da timeline (F18): comandos versionados pelo núcleo, desfazer/refazer
 * persistente em `<projeto>/timeline-history.json` (sobrevive a reabrir), preview
 * pelo mesmo grafo do render, legendas a partir de transcrição/SRT e troca de
 * proporção com confirmação.
 */
export class EditOperations {
  constructor(app) { this.app = app; }

  get previews() { return path.join(this.app.renderer.root, 'preview'); }

  async #history(directory) {
    try { return JSON.parse(await readFile(historyFile(directory), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { schema: 'contentlab-timeline-history-v1', undo: [], redo: [] }; throw error; }
  }

  async #saveHistory(directory, history) {
    const file = historyFile(directory); const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(history)}\n`, { mode: 0o600 }); await rename(temporary, file);
  }

  async #state(directory, details) {
    const history = await this.#history(directory);
    const current = hash(details.project.timeline);
    return { ...details, components: (await this.components()).components, edit: { canUndo: history.undo.at(-1)?.after === current, canRedo: history.redo.at(-1)?.after === current, undoLabel: history.undo.at(-1)?.label || null, redoLabel: history.redo.at(-1)?.label || null } };
  }

  async state({ path: directory }) { return await this.#state(directory, await this.app.inspectProject(directory)); }

  /** Aplica comandos; o estado anterior entra no desfazer e o refazer é limpo. */
  async edit({ path: directory, baseRevision, commands, label = 'Edição' }) {
    const before = await readProjectDirectory(directory);
    const details = await this.app.runProjectAction({ path: directory, baseRevision, action: { type: 'timeline.edit', commands } });
    const history = await this.#history(directory);
    history.undo.push({ label: String(label).slice(0, 80), before: before.timeline, after: hash(details.project.timeline) });
    history.undo = history.undo.slice(-HISTORY_LIMIT); history.redo = [];
    await this.#saveHistory(directory, history);
    return await this.#state(directory, details);
  }

  async undo({ path: directory, baseRevision }) { return await this.#step(directory, baseRevision, 'undo', 'redo'); }
  async redo({ path: directory, baseRevision }) { return await this.#step(directory, baseRevision, 'redo', 'undo'); }

  async #step(directory, baseRevision, from, to) {
    const project = await readProjectDirectory(directory);
    const history = await this.#history(directory);
    const entry = history[from].at(-1);
    if (!entry) throw new LifecycleError('NOTHING_TO_UNDO', from === 'undo' ? 'Nada para desfazer' : 'Nada para refazer');
    if (entry.after !== hash(project.timeline)) {
      history.undo = []; history.redo = []; await this.#saveHistory(directory, history);
      throw new LifecycleError('HISTORY_STALE', 'A timeline foi alterada fora deste histórico (CLI, agente ou outra janela); o desfazer foi reiniciado');
    }
    const details = await this.app.runProjectAction({ path: directory, baseRevision, action: { type: 'timeline.replace', timeline: entry.before, reason: from } });
    history[from].pop();
    history[to].push({ label: entry.label, before: project.timeline, after: hash(details.project.timeline) });
    await this.#saveHistory(directory, history);
    return await this.#state(directory, details);
  }

  /** Adiciona uma mídia (ou corte) do catálogo como clip, com duração da própria mídia. */
  async addMediaClip({ path: directory, baseRevision, trackId, mediaId, startFrame = 0 }) {
    const project = await readProjectDirectory(directory);
    const media = project.media.find(item => item.id === mediaId);
    if (!media) throw new Error(`Mídia desconhecida: ${mediaId}`);
    const fps = project.timeline.fps;
    const seconds = media.kind === 'image' ? 5 : media.metadata?.durationSeconds;
    if (!(seconds > 0)) throw new Error('Duração da mídia desconhecida; reimporte o arquivo');
    const clip = { id: `clip_${randomUUID().replaceAll('-', '').slice(0, 10)}`, type: 'media', sourceId: mediaId, name: media.name || mediaId, startFrame, durationInFrames: Math.max(1, Math.floor(seconds * fps)), fit: 'cover', anchor: 'center', keyframes: {}, effects: [], sourceInFrame: 0, volume: 1, style: 'legenda' };
    return await this.edit({ path: directory, baseRevision, commands: [{ op: 'clip.add', trackId, clip }], label: `Adicionar ${clip.name}` });
  }

  async components() {
    await this.app.ready();
    const uses = new Map(BUNDLED_COMPONENTS.map(item => [item.id, item.use]));
    return { components: (await this.app.components.list()).map(item => ({ ...item, use: uses.get(item.id) || null })) };
  }

  async addComponent({ path: directory, baseRevision, trackId = 'visual_main', componentId, componentProps = {}, startFrame = 0, durationInFrames }) {
    const project = await readProjectDirectory(directory); const manifest = await this.app.components.inspect(componentId);
    const props = sanitizeProps(manifest.propsSchema, componentProps); const duration = durationInFrames || project.timeline.fps * 3;
    const clip = { id: `component_${randomUUID().replaceAll('-', '').slice(0, 10)}`, type: 'component', componentId, componentProps: props, name: manifest.label, startFrame, durationInFrames: duration, fit: 'stretch', anchor: 'center', keyframes: {}, effects: [], sourceInFrame: 0, volume: 1, style: 'legenda' };
    const commands = [{ op: 'clip.add', trackId, clip }];
    if (trackId === SCENES_TRACK && !project.timeline.tracks.some(track => track.id === SCENES_TRACK)) commands.unshift({ op: 'track.add', track: scenesTrack() });
    return await this.edit({ path: directory, baseRevision, commands, label: `Adicionar ${manifest.label}` });
  }

  /** Legendas editáveis a partir da transcrição revisada de uma mídia ou de um SRT. */
  async captions({ path: directory, baseRevision, mediaId, srtPath, srtText, srtName = 'legendas.srt', startFrame = 0, style = 'legenda', trackId = 'captions_main' }) {
    const project = await readProjectDirectory(directory);
    let segments; let prefix;
    if (mediaId) {
      const transcript = await new TranscriptStore(directory).read(mediaId);
      if (!transcript) throw new Error('Esta mídia ainda não tem transcrição');
      segments = transcript.current; prefix = `cap_${mediaId.replace(/^media_/, '').slice(0, 10)}`;
    } else if (srtPath) {
      const info = await stat(srtPath).catch(() => null);
      if (!info?.isFile() || info.size > 5 * 1024 * 1024) throw new Error('Escolha um arquivo SRT de até 5 MB');
      segments = parseSrt(await readFile(srtPath, 'utf8')); prefix = `cap_srt_${createHash('sha256').update(srtPath).digest('hex').slice(0, 6)}`;
    } else if (typeof srtText === 'string') {
      if (Buffer.byteLength(srtText) > 900 * 1024) throw new Error('Escolha um arquivo SRT de até 900 KB');
      segments = parseSrt(srtText); prefix = `cap_srt_${createHash('sha256').update(`${srtName}\0${srtText}`).digest('hex').slice(0, 6)}`;
    } else throw new Error('Escolha a mídia transcrita ou um arquivo SRT');
    const fps = project.timeline.fps;
    const track = project.timeline.tracks.find(item => item.id === trackId && item.kind === 'caption');
    if (!track) throw new Error('Track de legendas desconhecida');
    const clips = [];
    for (const [index, segment] of segments.entries()) {
      const start = startFrame + Math.round(segment.start * fps);
      const nextStart = segments[index + 1] ? startFrame + Math.round(segments[index + 1].start * fps) : Infinity;
      const end = Math.min(startFrame + Math.round(segment.end * fps), nextStart);
      if (end > start) clips.push({ id: `${prefix}_${index}`, type: 'caption', name: `Legenda ${index + 1}`, text: segment.text, style, startFrame: start, durationInFrames: end - start, fit: 'cover', anchor: 'center', keyframes: {}, effects: [], sourceInFrame: 0, volume: 1 });
    }
    const removals = track.clips.filter(clip => clip.id.startsWith(`${prefix}_`)).map(clip => ({ op: 'clip.remove', trackId, clipId: clip.id }));
    const others = track.clips.filter(clip => !clip.id.startsWith(`${prefix}_`));
    const conflicts = clips.filter(clip => others.some(other => other.startFrame < clip.startFrame + clip.durationInFrames && clip.startFrame < other.startFrame + other.durationInFrames));
    if (conflicts.length) throw new Error(`${conflicts.length} legenda(s) cairiam sobre legendas existentes; remova-as ou escolha outro início`);
    return await this.edit({ path: directory, baseRevision, commands: [...removals, ...clips.map(clip => ({ op: 'clip.add', trackId, clip }))], label: `Legendas (${clips.length})` });
  }

  /**
   * Trocar a proporção do projeto: lista clips visuais sem enquadramento próprio
   * para a nova proporção e etapas aprovadas que serão reabertas; só aplica com
   * confirmação explícita.
   */
  async setAspectRatio({ path: directory, baseRevision, aspectRatio, confirm = false }) {
    if (!CANVASES[aspectRatio]) throw new Error('Proporção inválida');
    const project = await readProjectDirectory(directory);
    if (project.aspectRatio === aspectRatio) return await this.state({ path: directory });
    const withoutLayout = project.timeline.tracks.filter(track => track.kind === 'visual').flatMap(track => track.clips.filter(clip => !clip.layout?.[aspectRatio]).map(clip => clip.name || clip.id));
    const approved = project.stages.filter(stage => ['edit', 'review'].includes(stage.id) && stage.state === 'approved').map(stage => stage.id);
    const report = { from: project.aspectRatio, to: aspectRatio, clipsWithoutLayout: withoutLayout, reopens: approved };
    if (!confirm && (withoutLayout.length || approved.length)) throw new LifecycleError('CONFIRMATION_REQUIRED', 'Confirme a troca de proporção', report);
    const actions = [{ type: 'project.update', aspectRatio }];
    if (approved.includes('edit')) actions.push({ type: 'stage.reopen', stageId: 'edit', reason: `Proporção alterada de ${project.aspectRatio} para ${aspectRatio}` });
    else if (approved.includes('review')) actions.push({ type: 'stage.reopen', stageId: 'review', reason: `Proporção alterada de ${project.aspectRatio} para ${aspectRatio}` });
    const details = await this.app.runProjectAction({ path: directory, baseRevision, actions });
    const history = await this.#history(directory); history.undo = []; history.redo = []; await this.#saveHistory(directory, history);
    return { ...(await this.#state(directory, details)), report };
  }

  async #resolved(directory) {
    const stored = await readProjectDirectory(directory);
    return { ...stored, media: await Promise.all(stored.media.map(async item => ({ ...item, uri: (await this.app.resolveMediaPath(item)) || item.uri }))) };
  }

  #name(project, frame, ratio, extension) { return `${project.id}-${hash(project.timeline).slice(0, 16)}-${frame}-${ratio.replace(':', 'x')}.${extension}`; }

  /** Frame PNG do preview, com cache por versão da timeline. */
  async frame({ path: directory, frame = 0, aspectRatio }) {
    await this.app.requireFeature('render');
    const project = await this.#resolved(directory);
    const ratio = aspectRatio || project.aspectRatio;
    const name = this.#name(project, Math.max(0, Math.round(frame)), ratio, 'png');
    const output = path.join(this.previews, name);
    if (!(await stat(output).catch(() => null))) await this.app.renderer.renderFrame(project, { frame: Math.round(frame), output, aspectRatio: ratio, scale: ratio === '16:9' ? 0.5 : 0.4 });
    return { name, frame: Math.round(frame), aspectRatio: ratio };
  }

  /** Trecho com áudio, em fila, pelo mesmo grafo do render final. */
  async clip({ path: directory, frame = 0, seconds = 5, aspectRatio }) {
    await this.app.requireFeature('render');
    const project = await this.#resolved(directory);
    const ratio = aspectRatio || project.aspectRatio;
    const name = this.#name(project, Math.round(frame), ratio, 'mp4');
    const output = path.join(this.previews, name);
    await mkdir(this.previews, { recursive: true });
    return this.app.mediaOps.jobs.start({ kind: 'edit.preview', projectPath: directory, label: `Preview de ${Math.min(10, seconds)} s`, run: ({ signal, progress }) => this.app.activities.track(directory, 'preview', async activitySignal => {
      if (await stat(output).catch(() => null)) return { name };
      progress({ phase: 'Renderizando preview' });
      const result = await this.app.renderer.renderPreview(project, { from: Math.round(frame) / project.timeline.fps, seconds: Math.min(10, Math.max(1, seconds)), output, aspectRatio: ratio, scale: 0.5, signal: AbortSignal.any([signal, activitySignal]) });
      if (result.status === 'cancelled') throw Object.assign(new Error('Cancelado'), { code: 'CANCELLED' });
      return { name };
    }, { cancellable: true }) });
  }

  async previewFile({ name }) {
    if (!PREVIEW_NAME.test(String(name))) throw new Error('Preview inválido');
    const file = path.join(this.previews, name);
    const info = await stat(file);
    return { file, size: info.size, contentType: name.endsWith('.png') ? 'image/png' : 'video/mp4' };
  }
}

function historyFile(directory) { return path.join(path.resolve(directory), 'timeline-history.json'); }
export function hash(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
