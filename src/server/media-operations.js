import { mkdir, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { mediaUsages } from '../core/agent-service.js';
import { PortugueseTranscriber } from '../media/media-service.js';
import { TranscriptStore, searchSegments, segmentsFromWhisper } from '../media/transcript-store.js';
import { JobQueue } from './job-queue.js';
import { LifecycleError } from './project-lifecycle.js';
import { readProjectDirectory } from './project-registry.js';

const MEDIA_TYPES = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const MAX_UPLOAD = 4 * 1024 ** 3;

/** Operações de mídia (F16), sempre pelo núcleo versionado do projeto. */
export class MediaOperations {
  constructor(app, { transcriber = null } = {}) {
    this.app = app;
    this.jobs = new JobQueue();
    this.transcriberFactory = transcriber || (async () => new PortugueseTranscriber({ binary: await app.setup.toolPath('whisper-cli'), modelPath: app.setup.modelPath('whisper-large-v3') }));
  }

  /** Vincula um arquivo já no cache ao projeto, sem duplicar o mesmo conteúdo. */
  async attach(directory, imported, { rights = 'pending', source, name, role }) {
    const project = await readProjectDirectory(directory);
    const duplicate = project.media.find(item => item.sha256 === imported.hash);
    if (duplicate) return { status: 'duplicate', mediaId: duplicate.id, name: duplicate.name || path.basename(duplicate.uri) };
    const media = { id: imported.id, kind: kindOf(imported), uri: imported.path, sha256: imported.hash, rights, name: name || path.basename(source?.value || imported.path), source, ...(role ? { role } : {}), importedAt: new Date().toISOString(), metadata: summarize(imported.metadata), cuts: [], transcript: null };
    await this.app.runProjectAction({ path: directory, baseRevision: project.revision, action: { type: 'media.add', media } });
    return { status: 'imported', mediaId: media.id, name: media.name };
  }

  async importFiles({ path: directory, sources = [], rights = 'pending' }) {
    if (!Array.isArray(sources) || !sources.length || sources.length > 200 || sources.some(source => typeof source !== 'string')) throw new Error('Escolha de 1 a 200 arquivos');
    await this.app.requireFeature('media.import');
    await readProjectDirectory(directory);
    return this.jobs.start({ kind: 'media.import', projectPath: directory, label: `Importar ${sources.length} arquivo(s)`, run: ({ signal, progress }) => this.app.activities.track(directory, 'importação de mídia', async activitySignal => {
      const combined = AbortSignal.any([signal, activitySignal]);
      const results = [];
      for (const [index, source] of sources.entries()) {
        if (combined.aborted) throw abortError();
        progress({ done: index, total: sources.length, phase: `Importando ${path.basename(source)}` });
        try { results.push({ source, ...(await this.attach(directory, await this.app.media.importFile(source), { rights, source: { type: 'file', value: path.resolve(source) } })) }); }
        catch (error) { results.push({ source, status: 'failed', error: error.message }); }
      }
      progress({ done: sources.length, total: sources.length });
      return { results, imported: results.filter(item => item.status === 'imported').length, duplicates: results.filter(item => item.status === 'duplicate').length, failed: results.filter(item => item.status === 'failed').length };
    }, { cancellable: true }) });
  }

  /** Recebe um arquivo arrastado na interface (o navegador não expõe o caminho). */
  async importUpload({ path: directory, name, stream, size, rights = 'pending' }) {
    await this.app.requireFeature('media.import');
    await readProjectDirectory(directory);
    if (!(size > 0) || size > MAX_UPLOAD) throw new Error('Envie um arquivo de até 4 GB');
    const safeName = path.basename(String(name || 'arquivo')).replace(/[^\w.\- ]+/g, '_').slice(-120) || 'arquivo';
    if (!MEDIA_TYPES[path.extname(safeName).toLowerCase()]) throw new Error('Formato não suportado');
    const staging = path.join(this.app.media.root, 'staging', `upload-${randomUUID()}`);
    await mkdir(staging, { recursive: true });
    const file = path.join(staging, safeName);
    try {
      let received = 0;
      stream.on('data', chunk => { received += chunk.length; if (received > size || received > MAX_UPLOAD) stream.destroy(new Error('Tamanho maior que o anunciado')); });
      await pipeline(stream, createWriteStream(file, { mode: 0o600 }));
      if (received !== size) throw new Error('Envio incompleto');
      return await this.app.activities.track(directory, 'importação de mídia', async () => this.attach(directory, await this.app.media.importFile(file), { rights, source: { type: 'upload', value: safeName }, name: safeName }));
    } finally { await rm(staging, { recursive: true, force: true }); }
  }

  async importUrl({ path: directory, url, rights, rightsConfirmed }) {
    await this.app.requireFeature('media.url');
    await readProjectDirectory(directory);
    if (!['owned', 'licensed', 'authorized'].includes(rights) || rightsConfirmed !== true) throw new LifecycleError('RIGHTS_REQUIRED', 'Informe os direitos sobre o vídeo e confirme que pode usá-lo');
    try { if (new URL(url).protocol !== 'https:') throw new Error(); } catch { throw new LifecycleError('INVALID_URL', 'Use um link HTTPS válido'); }
    const ytDlp = await this.app.setup.toolPath('yt-dlp');
    return this.jobs.start({ kind: 'media.url', projectPath: directory, label: `Baixar ${new URL(url).hostname}`, run: ({ signal, progress }) => this.app.activities.track(directory, 'download de mídia', async activitySignal => {
      progress({ phase: 'Baixando com yt-dlp' });
      const imported = await this.app.media.importUrl(url, { signal: AbortSignal.any([signal, activitySignal]), ytDlp });
      progress({ phase: 'Vinculando ao projeto' });
      return await this.attach(directory, imported, { rights, source: { type: 'url', value: url } });
    }, { cancellable: true }) });
  }

  async usage({ path: directory, mediaId }) { return mediaUsages(await readProjectDirectory(directory), mediaId); }

  async remove({ path: directory, baseRevision, mediaId, detachUsages = false }) {
    const details = await this.app.runProjectAction({ path: directory, baseRevision, action: { type: 'media.remove', mediaId, detachUsages } });
    await rm(path.join(path.resolve(directory), 'transcripts', mediaId), { recursive: true, force: true });
    return details;
  }

  async createCut({ path: directory, baseRevision, mediaId, start, end, name = 'corte' }) {
    await this.app.requireFeature('media.import');
    const project = await readProjectDirectory(directory);
    const media = mediaOf(project, mediaId);
    if (!['video', 'audio'].includes(media.kind)) throw new Error('Cortes só valem para vídeo e áudio');
    const source = await this.app.resolveMediaPath(media);
    if (!source) throw new Error('Arquivo da mídia não encontrado');
    if (!(Number(start) >= 0) || !(Number(end) > Number(start))) throw new Error('O fim do corte deve ser depois do início');
    const cut = await this.app.activities.track(directory, 'corte de mídia', () => this.app.media.cut(source, { start: Number(start), end: Number(end), name }));
    return await this.app.runProjectAction({ path: directory, baseRevision, action: { type: 'media.cut.add', mediaId, cut: { id: `cut_${cut.hash.slice(0, 12)}`, name: String(name).slice(0, 80) || 'corte', start: Number(start), end: Number(end), uri: cut.path, createdAt: new Date().toISOString() } } });
  }

  async removeCut({ path: directory, baseRevision, mediaId, cutId }) { return await this.app.runProjectAction({ path: directory, baseRevision, action: { type: 'media.cut.remove', mediaId, cutId } }); }

  /** Arquivo para preview: só mídias do projeto, só formatos de mídia conhecidos. */
  async file({ path: directory, mediaId, cutId }) {
    const project = await readProjectDirectory(directory);
    const media = mediaOf(project, mediaId);
    const target = cutId ? media.cuts.find(cut => cut.id === cutId)?.uri : await this.app.resolveMediaPath(media);
    if (!target) throw Object.assign(new Error('Arquivo não encontrado'), { code: 'ENOENT' });
    const contentType = MEDIA_TYPES[path.extname(target).toLowerCase()];
    if (!contentType) throw new Error('Formato sem preview');
    const info = await stat(target);
    return { file: target, size: info.size, contentType };
  }

  async transcribe({ path: directory, mediaId, force = false }) {
    await this.app.requireFeature('transcription');
    const project = await readProjectDirectory(directory);
    const media = mediaOf(project, mediaId);
    if (!['video', 'audio'].includes(media.kind)) throw new Error('Só vídeo e áudio podem ser transcritos');
    const store = new TranscriptStore(directory);
    const key = { sha256: media.sha256, model: PortugueseTranscriber.model, language: 'pt' };
    const meta = await store.meta(mediaId);
    if (!force && meta && meta.sha256 === key.sha256 && meta.model === key.model && meta.language === key.language) return { status: 'unchanged', segments: meta.segments };
    if (this.jobs.list({ projectPath: directory }).some(job => job.kind === 'transcription' && job.state === 'running' && job.result === null && job.label.endsWith(mediaId))) throw new LifecycleError('TRANSCRIPTION_RUNNING', 'Esta mídia já está sendo transcrita');
    const source = await this.app.resolveMediaPath(media);
    if (!source) throw new Error('Arquivo da mídia não encontrado');
    const transcriber = await this.transcriberFactory();
    return this.jobs.start({ kind: 'transcription', projectPath: directory, label: `Transcrever ${mediaId}`, run: ({ signal, progress }) => this.app.activities.track(directory, 'transcrição', async activitySignal => {
      const output = await transcriber.transcribe(source, { signal: AbortSignal.any([signal, activitySignal]), onProgress: value => progress({ phase: value.phase, done: value.percent, total: 100 }) });
      const segments = segmentsFromWhisper(output.json);
      await store.saveRaw(mediaId, { segments, srt: output.srt, key });
      const current = await readProjectDirectory(directory);
      await this.app.runProjectAction({ path: directory, baseRevision: current.revision, action: { type: 'media.transcript.set', mediaId, transcript: { status: 'raw', model: key.model, language: key.language, segments: segments.length, updatedAt: new Date().toISOString() } } });
      return { segments: segments.length };
    }, { cancellable: true }) });
  }

  async transcript({ path: directory, mediaId }) {
    const value = await new TranscriptStore(directory).read(mediaId);
    if (!value) return { transcript: null };
    return { transcript: { ...value, srt: new TranscriptStore(directory).srt(value.current) } };
  }

  async saveTranscript({ path: directory, mediaId, baseRevision, segments }) {
    const project = await readProjectDirectory(directory);
    mediaOf(project, mediaId);
    const saved = await new TranscriptStore(directory).saveRevision(mediaId, { baseRevision, segments });
    const media = mediaOf(project, mediaId);
    await this.app.runProjectAction({ path: directory, baseRevision: project.revision, action: { type: 'media.transcript.set', mediaId, transcript: { ...(media.transcript || { model: PortugueseTranscriber.model, language: 'pt' }), status: 'revised', segments: saved.segments.length, updatedAt: new Date().toISOString() } } });
    return saved;
  }

  async search({ path: directory, query }) {
    if (!String(query || '').trim()) return { results: [] };
    const project = await readProjectDirectory(directory);
    const store = new TranscriptStore(directory);
    const results = [];
    for (const media of project.media.filter(item => item.transcript)) {
      const value = await store.read(media.id);
      for (const segment of searchSegments(value?.current || [], String(query))) results.push({ mediaId: media.id, name: media.name || path.basename(media.uri), ...segment });
    }
    return { results: results.slice(0, 200) };
  }

  listJobs({ path: directory } = {}) { return { jobs: this.jobs.list({ projectPath: directory }) }; }
  cancelJob({ jobId }) { return this.jobs.cancel(jobId); }
}

function mediaOf(project, mediaId) { const media = project.media.find(item => item.id === mediaId); if (!media) throw new Error(`Mídia desconhecida: ${mediaId}`); return media; }
function abortError() { return Object.assign(new Error('Cancelado'), { code: 'CANCELLED' }); }

export function kindOf(imported) {
  const streams = imported.metadata?.streams || [];
  const extension = path.extname(imported.path).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (streams.some(stream => stream.codec_type === 'video')) return 'video';
  if (streams.some(stream => stream.codec_type === 'audio')) return 'audio';
  return 'image';
}

export function summarize(metadata = {}) {
  const streams = metadata.streams || [];
  const video = streams.find(stream => stream.codec_type === 'video');
  const audio = streams.find(stream => stream.codec_type === 'audio');
  const number = value => (value === undefined || value === null || Number.isNaN(Number(value)) ? null : Number(value));
  return { durationSeconds: number(metadata.format?.duration), sizeBytes: number(metadata.format?.size), width: number(video?.width), height: number(video?.height), videoCodec: video?.codec_name || null, audioCodec: audio?.codec_name || null, sampleRate: number(audio?.sample_rate) };
}
