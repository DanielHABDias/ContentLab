import { mkdir, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { NarrationStore, VOICE_PRESETS, VoiceProfileStore, VoxCPMVoice, generationKey, measureAudio, normalizeTreatment, renderParts, scenesFromScript, treatmentFilters } from '../audio/narration-service.js';
import os from 'node:os';
import { processAlive, readLock, withProjectLock } from '../core/project-lock.js';
import { LifecycleError } from './project-lifecycle.js';
import { readProjectDirectory } from './project-registry.js';

const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.webm', '.mp4', '.mov', '.mkv'];
const MAX_UPLOAD = 2 * 1024 ** 3;
const PREVIEW_SECONDS = 20;

/**
 * Narração e voz (F17): takes gravados/importados, cortes e ordem não destrutivos,
 * tratamento com preview, montagem medida e voz clonada VoxCPM2 em fila por cena,
 * com cache e consentimento obrigatório. Usa a mesma fila de jobs da mídia.
 */
export class NarrationOperations {
  constructor(app, { voice = null } = {}) {
    this.app = app;
    this.voiceFactory = voice || (async () => new VoxCPMVoice({ ...app.setup.voiceRuntime('voxcpm2'), planner: () => app.setup.voicePlan(), onMeasured: value => app.setup.recordCalibration('voxcpm2', value) }));
  }

  get jobs() { return this.app.mediaOps.jobs; }
  get profiles() { return new VoiceProfileStore(path.join(this.app.dataDirectory, 'voices')); }
  get tools() { return { ffmpeg: this.app.media?.ffmpeg || 'ffmpeg', ffprobe: this.app.media?.ffprobe || 'ffprobe' }; }

  async #store(directory) { await readProjectDirectory(directory); return new NarrationStore(directory); }

  /** Estado completo da tela: sessão, cenas do roteiro (com cache/obsoleto), perfis e presets. */
  async state({ path: directory }) {
    const project = await readProjectDirectory(directory);
    const store = new NarrationStore(directory);
    const session = await store.read();
    const profiles = await this.profiles.list();
    const scenes = scenesFromScript(project.creative?.script);
    const takes = session.takes.map(take => {
      if (take.origin !== 'generated') return take;
      const scene = scenes.find(item => item.id === take.sceneId);
      const profile = profiles.find(item => item.id === take.profileId);
      return { ...take, stale: !scene || !profile || generationKey({ profile, text: scene.text }) !== take.cacheKey };
    });
    return {
      narration: { ...session, takes },
      scenes: scenes.map(scene => ({ ...scene, generated: Object.fromEntries(profiles.map(profile => [profile.id, takes.find(take => take.origin === 'generated' && take.cacheKey === generationKey({ profile, text: scene.text }))?.id || null])) })),
      profiles: profiles.map(publicProfile),
      presets: Object.entries(VOICE_PRESETS).map(([id, value]) => ({ id, ...value })),
      previewSeconds: PREVIEW_SECONDS,
    };
  }

  async importFiles({ path: directory, sources = [] }) {
    if (!Array.isArray(sources) || !sources.length || sources.length > 50 || sources.some(source => typeof source !== 'string')) throw new Error('Escolha de 1 a 50 arquivos de áudio');
    await this.app.requireFeature('narration.treatment');
    const store = await this.#store(directory);
    return await this.app.activities.track(directory, 'importação de takes', async () => {
      const results = [];
      for (const source of sources) {
        try {
          const take = await store.createTake({ source, name: path.parse(source).name, origin: 'import', ...this.tools });
          await store.mutate(undefined, session => { session.takes.push(take); });
          results.push({ source, status: 'imported', takeId: take.id });
        } catch (error) { results.push({ source, status: 'failed', error: error.message }); }
      }
      return { results, imported: results.filter(item => item.status === 'imported').length, failed: results.filter(item => item.status === 'failed').length };
    });
  }

  /** Gravação do microfone (ou arquivo arrastado) enviada pelo navegador. */
  async upload({ path: directory, name, origin = 'recording', stream, size }) {
    await this.app.requireFeature('narration.treatment');
    const store = await this.#store(directory);
    if (!(size > 0) || size > MAX_UPLOAD) throw new Error('Envie um áudio de até 2 GB');
    const safeName = path.basename(String(name || 'gravacao.webm')).replace(/[^\w.\- ]+/g, '_').slice(-120) || 'gravacao.webm';
    if (!AUDIO_EXTENSIONS.includes(path.extname(safeName).toLowerCase())) throw new Error('Formato de áudio não suportado');
    const staging = path.join(store.root, 'staging', randomUUID());
    await mkdir(staging, { recursive: true });
    const file = path.join(staging, safeName);
    try {
      let received = 0;
      stream.on('data', chunk => { received += chunk.length; if (received > size) stream.destroy(new Error('Tamanho maior que o anunciado')); });
      await pipeline(stream, createWriteStream(file, { mode: 0o600 }));
      if (received !== size) throw new Error('Envio incompleto');
      return await this.app.activities.track(directory, 'gravação de take', async () => {
        const take = await store.createTake({ source: file, name: origin === 'recording' ? `Gravação ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : path.parse(safeName).name, origin: origin === 'recording' ? 'recording' : 'import', moveSource: true, ...this.tools });
        const { session } = await store.mutate(undefined, value => { value.takes.push(take); });
        return { take, revision: session.revision };
      });
    } finally { await rm(staging, { recursive: true, force: true }); }
  }

  /** Renomeia ou corta (início/fim em segundos) sem tocar no arquivo. `trim: null` desfaz o corte. */
  async updateTake({ path: directory, baseRevision, takeId, name, trim }) {
    const store = await this.#store(directory);
    const { session } = await store.mutate(baseRevision, value => {
      const take = requireTake(value, takeId);
      if (name !== undefined) { if (!String(name).trim()) throw new Error('Nome vazio'); take.name = String(name).trim().slice(0, 80); }
      if (trim !== undefined) {
        if (trim === null) take.trim = null;
        else {
          const start = Number(trim.start); const end = Number(trim.end);
          if (!(start >= 0) || !(end > start) || end > take.durationSeconds + 0.01) throw new Error(`Corte inválido: use de 0 a ${take.durationSeconds.toFixed(2)} s`);
          if (end - start < 0.1) throw new Error('O corte precisa de ao menos 0,1 s');
          take.trim = { start: round(start), end: round(Math.min(end, take.durationSeconds)) };
        }
      }
    });
    return { narration: session };
  }

  async reorder({ path: directory, baseRevision, order }) {
    const store = await this.#store(directory);
    const { session } = await store.mutate(baseRevision, value => {
      if (!Array.isArray(order) || order.length !== value.takes.length || new Set(order).size !== order.length) throw new Error('A nova ordem deve conter todos os takes uma vez');
      value.takes = order.map(id => requireTake(value, id));
    });
    return { narration: session };
  }

  async deleteTake({ path: directory, baseRevision, takeId }) {
    const store = await this.#store(directory);
    const { session } = await store.mutate(baseRevision, async value => {
      requireTake(value, takeId);
      value.takes = value.takes.filter(take => take.id !== takeId);
      if (value.assembled?.takeIds.includes(takeId)) value.assembled = { ...value.assembled, outdated: true };
    });
    await store.removeTakeFiles(takeId);
    return { narration: session };
  }

  /** Preview A/B dos primeiros segundos: sem tratamento e com tratamento, ambos medidos. */
  async preview({ path: directory, takeIds, treatment }) {
    await this.app.requireFeature('narration.treatment');
    const store = await this.#store(directory);
    const session = await store.read();
    const settings = normalizeTreatment(treatment);
    const parts = this.#parts(store, session, takeIds);
    const key = createHash('sha256').update(JSON.stringify({ parts, settings })).digest('hex').slice(0, 24);
    return await this.app.activities.track(directory, 'preview de narração', async () => {
      const before = await renderParts(this.tools.ffmpeg, parts, path.join(store.root, 'previews', `${key}-original.wav`), { limitSeconds: PREVIEW_SECONDS });
      const after = await renderParts(this.tools.ffmpeg, parts, path.join(store.root, 'previews', `${key}-tratado.wav`), { filters: treatmentFilters(settings), limitSeconds: PREVIEW_SECONDS });
      return { treatment: settings, original: { file: path.basename(before), measures: await measureAudio(this.tools, before) }, treated: { file: path.basename(after), measures: await measureAudio(this.tools, after) } };
    });
  }

  /**
   * Monta os takes na ordem, aplica o tratamento, valida WAV 48 kHz mono e
   * vincula o resultado ao projeto como mídia de áudio (direitos: própria).
   */
  async assemble({ path: directory, baseRevision, takeIds, treatment }) {
    await this.app.requireFeature('narration.treatment');
    const store = await this.#store(directory);
    const session = await store.read();
    if (baseRevision !== undefined && baseRevision !== session.revision) throw Object.assign(new Error(`A narração mudou (revisão ${session.revision}); recarregue antes de montar`), { code: 'NARRATION_CONFLICT' });
    const settings = normalizeTreatment(treatment);
    const ids = takeIds?.length ? takeIds : session.takes.map(take => take.id);
    const parts = this.#parts(store, session, ids);
    return this.jobs.start({ kind: 'narration.assemble', projectPath: directory, label: `Montar narração (${ids.length} take${ids.length === 1 ? '' : 's'})`, run: ({ signal, progress }) => this.app.activities.track(directory, 'montagem de narração', async activitySignal => {
      progress({ phase: 'Montando e tratando', done: 0, total: 3 });
      const output = await renderParts(this.tools.ffmpeg, parts, path.join(store.root, 'assembled', `narracao-${Date.now()}.wav`), { filters: treatmentFilters(settings), signal: AbortSignal.any([signal, activitySignal]) });
      progress({ phase: 'Medindo', done: 1 });
      const measures = await measureAudio(this.tools, output);
      if (!measures.wav48kMono) throw new Error('A montagem não saiu em WAV 48 kHz mono');
      progress({ phase: 'Vinculando ao projeto', done: 2 });
      const attached = await this.app.mediaOps.attach(directory, await this.app.media.importFile(output), { rights: 'owned', source: { type: 'file', value: output }, name: 'Narração montada' });
      const previous = (await store.read()).assembled;
      await store.mutate(undefined, value => { value.treatment = settings; value.assembled = { file: path.relative(store.root, output), takeIds: ids, treatment: settings, measures, mediaId: attached.mediaId, createdAt: new Date().toISOString() }; });
      if (previous?.file && previous.file !== path.relative(store.root, output)) await rm(store.resolve(previous.file), { force: true });
      return { mediaId: attached.mediaId, measures };
    }, { cancellable: true }) });
  }

  /** Arquivo de áudio para ouvir na interface: take, preview, montagem ou amostra do perfil. */
  async file({ path: directory, takeId, preview, assembled, profileId, original }) {
    let target;
    if (profileId) target = (await this.profiles.read(profileId)).samplePath;
    else {
      const store = await this.#store(directory);
      const session = await store.read();
      if (takeId) { const take = requireTake(session, takeId); target = store.resolve(original ? take.original : take.file); }
      else if (preview) { if (!/^[a-f0-9]{24}-(original|tratado)\.wav$/.test(preview)) throw new Error('Preview inválido'); target = path.join(store.root, 'previews', preview); }
      else if (assembled && session.assembled) target = store.resolve(session.assembled.file);
    }
    if (!target) throw Object.assign(new Error('Arquivo não encontrado'), { code: 'ENOENT' });
    const info = await stat(target);
    const types = { '.wav': 'audio/wav', '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.flac': 'audio/flac' };
    return { file: target, size: info.size, contentType: types[path.extname(target).toLowerCase()] || 'application/octet-stream' };
  }

  /** Cria perfil a partir de um take do projeto (gravado lendo o texto de referência). */
  async createProfile({ path: directory, takeId, name, holder, consent, referenceText }) {
    const store = await this.#store(directory);
    const take = requireTake(await store.read(), takeId);
    const profile = await this.profiles.create({ name, holder, consent, referenceText, samplePath: store.resolve(take.file), ...this.tools });
    return { profile: publicProfile(profile) };
  }

  async voicePlan() {
    const plan = await this.app.setup.voicePlan();
    return { plan };
  }

  /**
   * Gera as cenas do roteiro com a voz do perfil, uma por vez, em um único job.
   * Cenas já geradas com o mesmo texto/perfil/modelo vêm do cache.
   */
  async generate({ path: directory, profileId, sceneIds }) {
    await this.app.requireFeature('voice.synthetic');
    const project = await readProjectDirectory(directory);
    const profile = await this.profiles.read(profileId);
    if (!profile.consent?.granted || !profile.consent?.holder) throw Object.assign(new Error('Perfil sem consentimento do titular'), { code: 'CONSENT_REQUIRED' });
    const all = scenesFromScript(project.creative?.script);
    const scenes = sceneIds?.length ? sceneIds.map(id => all.find(scene => scene.id === id) || (() => { throw new Error(`Cena desconhecida: ${id}`); })()) : all;
    if (!scenes.length) throw new Error('O roteiro não tem texto para narrar (abertura, desenvolvimento ou payoff)');
    if (this.jobs.list().some(job => job.kind === 'voice.generate' && job.state === 'running')) throw new LifecycleError('VOICE_BUSY', 'Já existe uma geração de voz em andamento; aguarde ou cancele');
    // Uma geração por computador também entre processos (interface, CLI e MCP): cada uma pode usar a RAM quase toda.
    const lockDirectory = path.join(this.app.dataDirectory, 'voices', '.generation');
    await mkdir(lockDirectory, { recursive: true });
    const owner = await readLock(lockDirectory);
    if (owner && !owner.corrupt && owner.pid !== process.pid && (owner.hostname !== os.hostname() || processAlive(owner.pid))) throw voiceBusy(owner);
    const store = new NarrationStore(directory);
    const voice = await this.voiceFactory();
    const plan = await this.app.setup.voicePlan();
    const factor = plan.estimate?.realtimeFactor || null;
    return this.jobs.start({ kind: 'voice.generate', projectPath: directory, label: `Gerar voz: ${scenes.length} cena${scenes.length === 1 ? '' : 's'}`, run: ({ signal, progress }) => this.app.activities.track(directory, 'geração de voz', activitySignal => withProjectLock(lockDirectory, 'geração de voz', async () => {
      const combined = AbortSignal.any([signal, activitySignal]);
      const results = [];
      for (const [index, scene] of scenes.entries()) {
        if (combined.aborted) throw Object.assign(new Error('Cancelado'), { code: 'CANCELLED' });
        const cacheKey = generationKey({ profile, text: scene.text });
        const existing = (await store.read()).takes.find(take => take.cacheKey === cacheKey);
        if (existing) { results.push({ sceneId: scene.id, status: 'cached', takeId: existing.id }); continue; }
        const estimateSeconds = factor ? Math.round(estimateSpeech(scene.text) * factor) : null;
        progress({ done: index, total: scenes.length, phase: `${scene.label}${estimateSeconds ? ` · cerca de ${minutes(estimateSeconds)}` : ''}` });
        const cacheFile = path.join(store.root, 'generated', `${cacheKey}.wav`);
        if (!(await stat(cacheFile).catch(() => null))) { await mkdir(path.dirname(cacheFile), { recursive: true }); await voice.generate({ text: scene.text, profile, output: cacheFile, signal: combined }); }
        const take = await store.createTake({ source: cacheFile, name: `Voz · ${scene.label}`, origin: 'generated', signal: combined, extra: { sceneId: scene.id, profileId: profile.id, cacheKey, model: VoxCPMVoice.model }, ...this.tools });
        await store.mutate(undefined, value => { value.takes.push(take); });
        await rm(cacheFile, { force: true });
        results.push({ sceneId: scene.id, status: 'generated', takeId: take.id });
      }
      progress({ done: scenes.length, total: scenes.length });
      return { results, generated: results.filter(item => item.status === 'generated').length, cached: results.filter(item => item.status === 'cached').length };
    }).catch(error => { throw error.code === 'PROJECT_LOCKED' ? voiceBusy(error.details.owner) : error; }), { cancellable: true }) });
  }

  /** O que some ao excluir o perfil: takes gerados e montagens que os usam, por projeto conhecido. */
  async profileReport({ profileId }) {
    const profile = await this.profiles.read(profileId);
    const projects = [];
    for (const card of await this.app.registry.list({ withSize: false })) {
      if (card.status && card.status !== 'ready') continue;
      const store = new NarrationStore(card.path);
      const session = await store.read().catch(() => null);
      const takes = session?.takes.filter(take => take.profileId === profileId) || [];
      if (!takes.length) continue;
      let bytes = 0;
      for (const take of takes) bytes += (await stat(store.resolve(take.file)).catch(() => ({ size: 0 }))).size + (await stat(store.resolve(take.original)).catch(() => ({ size: 0 }))).size;
      const assembled = Boolean(session.assembled?.takeIds.some(id => takes.some(take => take.id === id)));
      projects.push({ path: card.path, title: card.title, takes: takes.map(take => ({ id: take.id, name: take.name })), bytes, assembled, mediaId: assembled ? session.assembled.mediaId : null });
    }
    return { profile: publicProfile(profile), projects, takes: projects.reduce((sum, item) => sum + item.takes.length, 0), bytes: projects.reduce((sum, item) => sum + item.bytes, 0) };
  }

  async deleteProfile({ profileId, confirm }) {
    const report = await this.profileReport({ profileId });
    if (confirm !== true) throw new LifecycleError('CONFIRMATION_REQUIRED', 'Confirme a exclusão do perfil e dos áudios gerados', report);
    if (this.jobs.list().some(job => job.kind === 'voice.generate' && job.state === 'running')) throw new LifecycleError('VOICE_BUSY', 'Cancele a geração de voz antes de excluir o perfil');
    const failures = [];
    for (const item of report.projects) {
      try {
        const store = new NarrationStore(item.path);
        const ids = item.takes.map(take => take.id);
        let assembledFile = null;
        await store.mutate(undefined, value => {
          value.takes = value.takes.filter(take => !ids.includes(take.id));
          if (value.assembled?.takeIds.some(id => ids.includes(id))) { assembledFile = value.assembled.file; value.assembled = null; }
        });
        for (const id of ids) await store.removeTakeFiles(id);
        if (assembledFile) await rm(store.resolve(assembledFile), { force: true });
        if (item.mediaId) {
          const project = await readProjectDirectory(item.path);
          if (project.media.some(media => media.id === item.mediaId)) await this.app.mediaOps.remove({ path: item.path, baseRevision: project.revision, mediaId: item.mediaId, detachUsages: true });
        }
      } catch (error) { failures.push({ path: item.path, error: error.message }); }
    }
    if (!failures.length) await this.profiles.remove(profileId);
    return { ...report, deleted: !failures.length, failures };
  }

  #parts(store, session, takeIds) {
    if (!Array.isArray(takeIds) || !takeIds.length) throw new Error('Selecione ao menos um take');
    return takeIds.map(id => { const take = requireTake(session, id); return { file: store.resolve(take.file), start: take.trim?.start || 0, end: take.trim?.end || 0 }; });
  }
}

function voiceBusy(owner) { return new LifecycleError('VOICE_BUSY', `Outra geração de voz está rodando neste computador (PID ${owner.pid}); aguarde ou cancele por lá`, { owner }); }
function publicProfile(profile) {
  const { id, name, referenceText, consent, measures, model, createdAt } = profile;
  return { id, name, referenceText, consent, durationSeconds: measures?.durationSeconds ?? null, model, createdAt };
}
function requireTake(session, id) { const take = session.takes.find(item => item.id === id); if (!take) throw new Error(`Take desconhecido: ${id}`); return take; }
function round(value) { return Math.round(value * 1000) / 1000; }
/** Duração falada aproximada em PT-BR (~15 caracteres por segundo). */
export function estimateSpeech(text) { return Math.max(1, text.length / 15); }
function minutes(seconds) { return seconds < 90 ? `${seconds} s` : `${Math.round(seconds / 60)} min`; }
