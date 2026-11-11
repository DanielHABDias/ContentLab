import { lstat, mkdir, rm, stat } from 'node:fs/promises';
import { MIGRATABLE, ROOT_KINDS, SettingsStore, StorageService, sizeOf, validateFolder } from './storage-service.js';
import os from 'node:os';
import path from 'node:path';
import { idSchema } from '../core/contracts.js';
import { LOCK_FILE, withProjectLock } from '../core/project-lock.js';
import { FEATURES, featureBlock } from '../core/capabilities.js';
import { SetupService } from '../setup/setup-service.js';
import { MediaOperations } from './media-operations.js';
import { NarrationOperations } from './narration-operations.js';
import { ActivityTracker, LifecycleError, SystemOpener, SystemTrash } from './project-lifecycle.js';
import { ProjectRegistry, readProjectDirectory } from './project-registry.js';
import { ProjectStore } from '../core/project-store.js';
import { createWorkflow } from '../core/workflow.js';
import { PackageService } from '../package/package-service.js';
import { NativeDialog } from './native-dialog.js';
import { AgentService } from '../core/agent-service.js';
import { randomUUID } from 'node:crypto';
import { MediaService } from '../media/media-service.js';
import { FfmpegRenderer } from '../render/ffmpeg-renderer.js';

export class LocalApplicationService {
  constructor({ dataDirectory, dialog = new NativeDialog(), packages = new PackageService(), media = null, renderer = null, trash = new SystemTrash(), opener = new SystemOpener(), activities = new ActivityTracker(), setup = null, toolsDirectory = null, transcriber = null, voice = null }) {
    this.dataDirectory = path.resolve(dataDirectory);
    this.projectsDirectory = path.join(this.dataDirectory, 'projects');
    this.registry = new ProjectRegistry(this.dataDirectory, { scanRoots: () => [this.projectsDirectory] });
    this.injected = { media: Boolean(media), renderer: Boolean(renderer), setup: Boolean(setup) };
    this.defaults = { roots: { projects: this.projectsDirectory, media: path.join(this.dataDirectory, 'media'), renderCache: path.join(this.dataDirectory, 'render'), tools: path.resolve(toolsDirectory || path.join(this.dataDirectory, 'tools')), renderOutput: null }, limits: { cacheMaxBytes: null, minFreeBytes: 2 * 1024 ** 3 } };
    this.mediaOps = new MediaOperations(this, { transcriber });
    this.narrationOps = new NarrationOperations(this, { voice });
    this.settingsStore = new SettingsStore(this.dataDirectory, this.defaults);
    this.settings = { revision: 0, roots: { ...this.defaults.roots }, limits: { ...this.defaults.limits } };
    this.storage = new StorageService({
      context: async () => ({ roots: this.settings.roots, limits: this.settings.limits, projects: await this.registry.list(), readProject: readProjectDirectory }),
      onMigrated: ({ kind, target }) => this.#migrated(kind, target),
    });
    this.dialog = dialog;
    this.packages = packages;
    this.media = media || new MediaService(path.join(this.dataDirectory, 'media'));
    this.renderer = renderer || new FfmpegRenderer(path.join(this.dataDirectory, 'render'));
    this.trash = trash;
    this.opener = opener;
    this.activities = activities;
    this.setup = setup || new SetupService({ toolsDirectory: toolsDirectory || path.join(this.dataDirectory, 'tools') });
  }

  /** Carrega as configurações uma vez e aplica as raízes aos serviços. */
  ready() { this.readyPromise ||= this.settingsStore.read().then(settings => this.#apply(settings)); return this.readyPromise; }

  #apply(settings) {
    this.settings = { revision: settings.revision, roots: settings.roots, limits: settings.limits };
    this.settingsRecovered = settings.recoveredFrom || null;
    this.projectsDirectory = settings.roots.projects;
    if (!this.injected.media) this.media = new MediaService(settings.roots.media);
    if (!this.injected.renderer) this.renderer = new FfmpegRenderer(settings.roots.renderCache);
    if (!this.injected.setup && this.setup.toolsDirectory !== settings.roots.tools) this.setup = new SetupService({ toolsDirectory: settings.roots.tools });
    return this.settings;
  }

  // ---- Configurações e armazenamento (F15) ----

  async getSettings() {
    await this.ready();
    const roots = await Promise.all(ROOT_KINDS.map(async kind => {
      const value = this.settings.roots[kind];
      if (!value) return [kind, { path: null, exists: null }];
      const info = await stat(value).catch(() => null);
      return [kind, { path: value, exists: Boolean(info?.isDirectory()), isDefault: value === this.defaults.roots[kind] }];
    }));
    return { revision: this.settings.revision, roots: Object.fromEntries(roots), limits: this.settings.limits, defaults: this.defaults, migratable: MIGRATABLE, recoveredFrom: this.settingsRecovered, registryRecovery: this.registry.lastRecovery };
  }

  async validateFolder({ path: folder }) { return await validateFolder(folder); }

  /**
   * Muda raízes/limites com revisão otimista. Nunca move dados: se a raiz atual
   * de um item migrável tem conteúdo, exige escolher migrar ou começar vazia.
   */
  async updateSettings({ baseRevision, roots = {}, limits = {}, emptyRoots = [] }) {
    await this.ready();
    if (baseRevision !== this.settings.revision) throw new LifecycleError('SETTINGS_CONFLICT', `Configurações mudaram em outra janela (revisão ${this.settings.revision}); recarregue`);
    const next = { revision: this.settings.revision + 1, roots: { ...this.settings.roots }, limits: { ...this.settings.limits } };
    for (const [kind, value] of Object.entries(roots)) {
      if (!ROOT_KINDS.includes(kind)) throw new Error(`Raiz desconhecida: ${kind}`);
      if (kind === 'renderOutput' && value === null) { next.roots.renderOutput = null; continue; }
      const checked = await validateFolder(value);
      if (checked.path === this.settings.roots[kind]) continue;
      if (MIGRATABLE.includes(kind)) {
        const used = await sizeOf(this.settings.roots[kind]);
        if (used > 0 && !emptyRoots.includes(kind)) throw new LifecycleError('MIGRATION_DECISION_REQUIRED', `A pasta atual tem ${used} bytes. Migre os dados ou confirme começar com a nova pasta vazia (os dados antigos ficam onde estão).`, { kind, usedBytes: used });
      }
      next.roots[kind] = checked.path;
    }
    for (const [key, value] of Object.entries(limits)) {
      if (!(key in this.defaults.limits)) throw new Error(`Limite desconhecido: ${key}`);
      if (!(value === null || (Number.isInteger(value) && value >= 0))) throw new Error('Limites devem ser bytes inteiros ou vazio');
      next.limits[key] = value;
    }
    this.#apply({ ...(await this.settingsStore.write(next)) });
    return await this.getSettings();
  }

  async #migrated(kind, target) {
    const next = { revision: this.settings.revision + 1, roots: { ...this.settings.roots, [kind]: target }, limits: this.settings.limits };
    if (kind === 'tools') await this.setup.relocate?.(target);
    this.#apply(await this.settingsStore.write(next));
  }

  async storageUsage() { await this.ready(); return await this.storage.usage(); }
  async storageOrphans() { await this.ready(); return await this.storage.orphans(); }
  async storageCleanup(input) { await this.ready(); if (this.activities.any()) throw new LifecycleError('PROJECT_BUSY', 'Aguarde terminar as operações em andamento antes de limpar'); return await this.storage.cleanup(input); }
  async planMigration(input) { await this.ready(); return await this.storage.planMigration(input); }
  async startMigration(input) {
    await this.ready();
    return await this.storage.startMigration({ ...input, busy: kind => [...(this.activities.any() ? ['operações de projeto'] : []), ...(kind === 'tools' && this.setup.jobs().some(job => ['running', 'queued'].includes(job.state)) ? ['instalações de dependências'] : [])] });
  }
  storageJobs() { return { jobs: this.storage.jobs() }; }
  cancelMigration({ jobId }) { return this.storage.cancel(jobId); }
  async backupRegistry() { return await this.registry.backup(); }
  async listRegistryBackups() { return { backups: await this.registry.listBackups() }; }
  async restoreRegistry({ name }) { return await this.registry.restoreBackup(name); }

  /** Relocaliza um projeto movido: o novo caminho precisa conter o mesmo projeto. */
  async relocateProject({ path: previous, newPath }) {
    if (!newPath) throw new Error('Escolha a pasta onde o projeto está agora');
    const project = await readProjectDirectory(newPath);
    const entry = (await this.registry.list({ withSize: false })).find(item => item.path === path.resolve(previous));
    if (!entry) throw new Error('Projeto não está nos Recentes');
    if (entry.id !== project.id) throw new LifecycleError('PROJECT_MISMATCH', `A pasta escolhida contém “${project.id}”, não “${entry.id}”`);
    await this.registry.relocate(previous, newPath, { id: project.id, title: project.title });
    return await this.registerProject(newPath);
  }

  /** Mídia é endereçada por hash: se o caminho gravado sumiu, procura no cache atual. */
  async resolveMediaPath(item) {
    if (await stat(item.uri).then(() => true, () => false)) return item.uri;
    const candidate = path.join(this.media.root, 'objects', item.sha256.slice(0, 2), `${item.sha256}${path.extname(item.uri)}`);
    return await stat(candidate).then(() => candidate, () => null);
  }

  async health() {
    await this.ready();
    await mkdir(this.projectsDirectory, { recursive: true });
    return { status: 'ready', api: 'contentlab-local-v1', dataDirectory: this.dataDirectory };
  }

  async listProjects() { await this.ready(); return await this.registry.list(); }

  async inspectProject(directory) {
    const project = await readProjectDirectory(directory);
    const history = await this.#history(directory);
    const mediaStatus = await Promise.all(project.media.map(async item => { const resolved = await this.resolveMediaPath(item); return { id: item.id, available: Boolean(resolved), ...(resolved && resolved !== item.uri ? { resolvedPath: resolved } : {}) }; }));
    return { project, history, mediaStatus, path: path.resolve(directory) };
  }

  async registerProject(directory) {
    const opened = await this.registry.open(directory);
    const details = await this.inspectProject(directory);
    return { ...details, card: opened.card };
  }

  async chooseDirectory(options) { return { path: await this.dialog.chooseDirectory(options) }; }
  async choosePackage(options) { return { path: await this.dialog.choosePackage(options) }; }
  async chooseMedia(options) { const value = await this.dialog.chooseMedia(options); return options?.multiple ? { paths: value ? value.split('\n').filter(Boolean) : [] } : { path: value }; }

  async createProject({ title, type, aspectRatio, mode = 'review', parentDirectory }) {
    if (!title?.trim()) throw new Error('Informe o título do projeto');
    await this.ready();
    const id = await this.#availableId(parentDirectory || this.projectsDirectory, slug(title));
    const root = path.resolve(parentDirectory || this.projectsDirectory);
    const project = {
      schema: 'contentlab-project-v1', id, title: title.trim(), type, aspectRatio, mode, revision: 1,
      stages: createWorkflow(), media: [],
      timeline: { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio, safeArea: { top: .05, right: .05, bottom: aspectRatio === '9:16' ? .15 : .08, left: .05 }, tracks: [
        { id: 'visual_main', kind: 'visual', name: 'Principal', muted: false, locked: false, clips: [] },
        { id: 'audio_main', kind: 'audio', name: 'Áudio', muted: false, locked: false, clips: [] },
        { id: 'captions_main', kind: 'caption', name: 'Legendas', muted: false, locked: false, clips: [] },
      ] },
    };
    await new ProjectStore(root).create(project);
    return await this.registerProject(path.join(root, id));
  }

  async importPackage({ packagePath, parentDirectory }) {
    if (!packagePath) throw new Error('Nenhum pacote foi escolhido');
    await this.ready();
    const root = path.resolve(parentDirectory || this.projectsDirectory);
    const extension = path.extname(packagePath).toLowerCase();
    const inspection = extension === '.contentlab' ? await this.packages.inspect(packagePath) : await this.packages.inspectZip(packagePath);
    const rawProject = extension === '.contentlab'
      ? inspection.manifest.entries.find(entry => entry.path === 'project.json') && null
      : inspection.project;
    let id = rawProject?.id;
    if (!id) {
      const { mkdtemp, rm, readFile } = await import('node:fs/promises');
      const os = await import('node:os');
      const temporary = await mkdtemp(path.join(os.tmpdir(), 'contentlab-inspect-'));
      try { await this.packages.restore(packagePath, temporary); id = JSON.parse(await readFile(path.join(temporary, 'project.json'), 'utf8')).id; }
      finally { await rm(temporary, { recursive: true, force: true }); }
    }
    const available = await this.#availableId(root, id);
    if (available !== id) throw new Error(`Já existe um projeto chamado ${id} no destino`);
    const destination = path.join(root, id);
    if (extension === '.contentlab') await this.packages.restore(packagePath, destination);
    else await this.packages.restoreZip(packagePath, destination);
    return await this.registerProject(destination);
  }

  async runProjectAction({ path: directory, baseRevision, action }) {
    const absolute = path.resolve(directory);
    return await this.activities.track(absolute, 'escrita', async () => {
      const project = await readProjectDirectory(absolute);
      if (project.revision !== baseRevision) throw new Error(`Conflito de revisão: esperado ${baseRevision}, atual ${project.revision}`);
      const store = new ProjectStore(path.dirname(absolute));
      const agent = new AgentService(store);
      await agent.run({ schema: 'contentlab-operation-v1', operationId: `op_${randomUUID().replaceAll('-', '')}`, projectId: project.id, baseRevision, dryRun: false, actions: [action] });
      return await this.registerProject(absolute);
    });
  }

  // ---- Ciclo de vida do projeto (F13) ----

  async revealProject({ path: directory }) {
    const absolute = path.resolve(directory);
    await readProjectDirectory(absolute);
    await this.opener.reveal(absolute);
    return { revealed: absolute };
  }

  /** Tira o projeto dos Recentes sem tocar na pasta. */
  async forgetProject({ path: directory }) {
    const result = await this.registry.remove(directory);
    return { ...result, path: path.resolve(directory) };
  }

  /** Muda somente o título; ID e pasta são preservados. */
  async renameProject({ path: directory, baseRevision, title }) {
    if (!title?.trim()) throw new Error('Informe o novo título');
    return await this.runProjectAction({ path: directory, baseRevision, action: { type: 'project.update', title: title.trim() } });
  }

  /** Muda ID e pasta numa operação separada, atômica e validada. */
  async changeProjectId({ path: directory, baseRevision, id }) {
    const absolute = path.resolve(directory);
    if (!idSchema.safeParse(id).success) throw new LifecycleError('INVALID_ID', 'ID inválido: use de 3 a 64 caracteres minúsculos, números, _ ou -, começando por letra');
    this.activities.assertIdle(absolute, 'mudar o ID');
    const project = await readProjectDirectory(absolute);
    const parent = path.dirname(absolute);
    const target = path.join(parent, id);
    await this.activities.track(absolute, 'mudança de ID', async () => {
      const next = await new ProjectStore(parent).changeId(project.id, baseRevision, id);
      await this.registry.relocate(absolute, target, { id: next.id, title: next.title });
    });
    return await this.registerProject(target);
  }

  /** Nova pasta, novo ID e revisão 1; mídia continua referenciada pelo hash. */
  async duplicateProject({ path: directory, title }) {
    const absolute = path.resolve(directory);
    const source = await readProjectDirectory(absolute);
    const parent = path.dirname(absolute);
    const nextTitle = title?.trim() || `${source.title} (cópia)`;
    const id = await this.#availableId(parent, slug(nextTitle));
    const copy = { ...structuredClone(source), id, title: nextTitle, revision: 1 };
    await new ProjectStore(parent).create(copy, { duplicatedFrom: { id: source.id, path: absolute, revision: source.revision } });
    return await this.registerProject(path.join(parent, id));
  }

  async exportProject({ path: directory, outputDirectory, format = 'contentlab', includeRenders = false }) {
    const absolute = path.resolve(directory);
    if (!outputDirectory) throw new Error('Escolha a pasta de destino da exportação');
    if (!['contentlab', 'zip'].includes(format)) throw new Error('Formato de exportação inválido');
    const project = await readProjectDirectory(absolute);
    const target = path.resolve(outputDirectory);
    if (target === absolute || target.startsWith(`${absolute}${path.sep}`)) throw new Error('Escolha um destino fora da pasta do projeto');
    const extension = format === 'zip' ? 'zip' : 'contentlab';
    const output = await availableFile(path.join(target, `${project.id}-r${project.revision}.${extension}`));
    const include = relative => relative !== LOCK_FILE && (includeRenders || !(relative === 'output' || relative.startsWith('output/')));
    return await this.activities.track(absolute, 'exportação', async () => {
      const result = format === 'zip' ? await this.packages.exportZip(absolute, output, { include }) : await this.packages.exportContentLab(absolute, output, { include });
      return { path: result.path, size: result.size, files: result.files, format };
    });
  }

  listActivities({ path: directory }) { return { activities: this.activities.list(directory) }; }
  cancelActivities({ path: directory }) { return this.activities.cancel(directory); }

  /**
   * Exclusão segura: confirmação pelo ID exato, bloqueio com operação ativa,
   * lixeira recuperável por padrão e permanente só com backup ou dupla confirmação.
   */
  async deleteProject({ path: directory, confirmation, mode = 'trash', backupPath = null, permanentConfirmation = null }) {
    const absolute = path.resolve(directory);
    if ((await lstat(absolute)).isSymbolicLink()) throw new Error('Por segurança, links simbólicos não são excluídos; remova-o dos Recentes');
    const project = await readProjectDirectory(absolute);
    if ([path.resolve('/'), os.homedir(), this.dataDirectory, this.projectsDirectory].includes(absolute)) throw new Error('Caminho protegido não pode ser excluído');
    if (confirmation !== project.id) throw new LifecycleError('CONFIRMATION_REQUIRED', `Digite exatamente “${project.id}” para confirmar`);
    this.activities.assertIdle(absolute, 'excluir o projeto');
    const summary = { id: project.id, title: project.title, path: absolute };
    if (mode === 'trash') {
      // A trava confirma que nenhum outro processo (CLI/MCP) está gravando; é
      // removida antes de mover para a lixeira para não voltar junto na restauração.
      await this.activities.track(absolute, 'exclusão', () => withProjectLock(absolute, 'exclusão', async () => { await rm(path.join(absolute, LOCK_FILE), { force: true }); await this.trash.trash(absolute); }));
      await this.registry.remove(absolute);
      return { ...summary, deleted: true, method: 'trash', restorable: true };
    }
    if (mode !== 'permanent') throw new Error('Modo de exclusão inválido');
    if (permanentConfirmation !== `EXCLUIR ${project.id}`) throw new LifecycleError('PERMANENT_CONFIRMATION_REQUIRED', `Para excluir sem lixeira, digite “EXCLUIR ${project.id}”`);
    if (backupPath) {
      const backup = path.resolve(backupPath);
      if (backup.startsWith(`${absolute}${path.sep}`)) throw new Error('O backup não pode ficar dentro da pasta que será excluída');
      if (backup.endsWith('.contentlab')) await this.packages.inspect(backup); else await this.packages.inspectZip(backup);
    }
    await this.activities.track(absolute, 'exclusão', () => withProjectLock(absolute, 'exclusão', () => rm(absolute, { recursive: true })));
    await this.registry.remove(absolute);
    return { ...summary, deleted: true, method: 'permanent', restorable: Boolean(backupPath), backupPath: backupPath ? path.resolve(backupPath) : null };
  }

  /** Restaura da lixeira para o local original e valida o projeto. */
  async restoreProject({ path: directory }) {
    const absolute = path.resolve(directory);
    await this.trash.restore(absolute);
    return await this.registerProject(absolute);
  }

  async importMedia({ path: directory, baseRevision, source, rights = 'pending' }) {
    if (!source) throw new Error('Nenhum arquivo foi escolhido');
    await this.requireFeature('media.import');
    const project = await readProjectDirectory(directory);
    if (project.revision !== baseRevision) throw new Error(`Conflito de revisão: esperado ${baseRevision}, atual ${project.revision}`);
    const imported = await this.activities.track(directory, 'importação de mídia', () => this.media.importFile(source));
    const result = await this.mediaOps.attach(directory, imported, { rights, source: { type: 'file', value: path.resolve(source) } });
    return { ...(await this.registerProject(directory)), importResult: result };
  }

  // ---- Mídia completa (F16) ----
  importMediaFiles(input) { return this.mediaOps.importFiles(input); }
  importMediaUrl(input) { return this.mediaOps.importUrl(input); }
  importMediaUpload(input) { return this.mediaOps.importUpload(input); }
  mediaUsage(input) { return this.mediaOps.usage(input); }
  removeMedia(input) { return this.mediaOps.remove(input); }
  createMediaCut(input) { return this.mediaOps.createCut(input); }
  removeMediaCut(input) { return this.mediaOps.removeCut(input); }
  mediaFile(input) { return this.mediaOps.file(input); }
  transcribeMedia(input) { return this.mediaOps.transcribe(input); }
  mediaTranscript(input) { return this.mediaOps.transcript(input); }
  saveMediaTranscript(input) { return this.mediaOps.saveTranscript(input); }
  searchTranscripts(input) { return this.mediaOps.search(input); }
  listJobs(input) { return this.mediaOps.listJobs(input); }
  cancelJob(input) { return this.mediaOps.cancelJob(input); }

  narrationState(input) { return this.narrationOps.state(input); }
  narrationImport(input) { return this.narrationOps.importFiles(input); }
  narrationUpload(input) { return this.narrationOps.upload(input); }
  narrationUpdateTake(input) { return this.narrationOps.updateTake(input); }
  narrationReorder(input) { return this.narrationOps.reorder(input); }
  narrationDeleteTake(input) { return this.narrationOps.deleteTake(input); }
  narrationPreview(input) { return this.narrationOps.preview(input); }
  narrationAssemble(input) { return this.narrationOps.assemble(input); }
  narrationFile(input) { return this.narrationOps.file(input); }
  voiceProfileCreate(input) { return this.narrationOps.createProfile(input); }
  voiceProfileReport(input) { return this.narrationOps.profileReport(input); }
  voiceProfileDelete(input) { return this.narrationOps.deleteProfile(input); }
  voiceGenerate(input) { return this.narrationOps.generate(input); }
  voicePlan() { return this.narrationOps.voicePlan(); }

  /** Capacidades para as telas de etapa, derivadas do mesmo catálogo do setup. */
  async diagnostics() {
    await this.ready();
    const status = await this.setup.status();
    return { capabilities: status.items.filter(item => item.id !== 'node').map(item => ({ id: item.id, label: item.label, ready: item.ready, required: item.required, ...(item.ready ? { version: item.detected } : { solution: item.installable ? 'Instale em Dependências.' : item.systemCommand ? `Instale com: ${item.systemCommand}` : item.manualSteps || item.reason || 'Indisponível.' }) })) };
  }

  /** Recusa a operação quando faltam dependências, indicando quais instalar. */
  async requireFeature(featureId) {
    await this.ready();
    const missing = featureBlock(featureId, (await this.setup.status()).items);
    if (missing.length) throw new LifecycleError('DEPENDENCY_MISSING', `Para ${FEATURES[featureId].label.toLowerCase()}, instale: ${missing.map(item => item.label).join(', ')}`, { feature: featureId, missing: missing.map(item => item.id) });
  }

  async setupStatus() { await this.ready(); return this.setup.status(); }
  async setupInstall(input) { await this.ready(); return this.setup.install(input); }
  setupJobs() { return { jobs: this.setup.jobs() }; }
  setupPause({ jobId }) { return this.setup.pause(jobId); }
  setupResume({ jobId }) { return this.setup.resume(jobId); }
  setupCancel({ jobId }) { return this.setup.cancel(jobId); }
  async setupOnboarding({ choice }) { return { onboarding: await this.setup.setOnboarding(choice) }; }

  async renderProject({ path: directory, outputDirectory }) {
    await this.requireFeature('render');
    await this.ready();
    const stored = await readProjectDirectory(directory);
    const project = { ...stored, media: await Promise.all(stored.media.map(async item => ({ ...item, uri: (await this.resolveMediaPath(item)) || item.uri }))) };
    const targetDirectory = outputDirectory ? path.resolve(outputDirectory) : this.settings.roots.renderOutput || path.join(path.resolve(directory), 'output');
    await mkdir(targetDirectory, { recursive: true });
    const output = path.join(targetDirectory, `${project.id}-r${project.revision}.mp4`);
    return await this.activities.track(directory, 'render', signal => this.renderer.render(project, { output, signal }), { cancellable: true });
  }

  async #availableId(root, preferred) {
    const { stat } = await import('node:fs/promises');
    for (let index = 0; index < 1000; index += 1) {
      const candidate = index ? `${preferred}_${index + 1}` : preferred;
      try { await stat(path.join(path.resolve(root), candidate)); }
      catch (error) { if (error.code === 'ENOENT') return candidate; throw error; }
    }
    throw new Error('Não foi possível gerar um ID disponível');
  }

  async #history(directory) {
    const { readFile } = await import('node:fs/promises');
    try {
      const contents = await readFile(path.join(path.resolve(directory), 'history.ndjson'), 'utf8');
      return contents.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)).reverse();
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
}

async function availableFile(preferred) {
  const extension = path.extname(preferred);
  const base = preferred.slice(0, -extension.length);
  for (let index = 0; index < 1000; index += 1) {
    const candidate = index ? `${base}-${index + 1}${extension}` : preferred;
    try { await lstat(candidate); } catch (error) { if (error.code === 'ENOENT') return candidate; throw error; }
  }
  throw new Error('Não foi possível gerar um nome de arquivo disponível');
}

function slug(value) {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 58);
  const safe = /^[a-z]/.test(normalized) ? normalized : `projeto_${normalized}`;
  return safe.length >= 3 ? safe : `projeto_${Date.now().toString(36)}`;
}
