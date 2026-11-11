import { lstat, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { idSchema } from '../core/contracts.js';
import { SetupService } from '../setup/setup-service.js';
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
  constructor({ dataDirectory, dialog = new NativeDialog(), packages = new PackageService(), media = null, renderer = null, trash = new SystemTrash(), opener = new SystemOpener(), activities = new ActivityTracker(), setup = null, toolsDirectory = null }) {
    this.dataDirectory = path.resolve(dataDirectory);
    this.projectsDirectory = path.join(this.dataDirectory, 'projects');
    this.registry = new ProjectRegistry(this.dataDirectory);
    this.dialog = dialog;
    this.packages = packages;
    this.media = media || new MediaService(path.join(this.dataDirectory, 'media'));
    this.renderer = renderer || new FfmpegRenderer(path.join(this.dataDirectory, 'render'));
    this.trash = trash;
    this.opener = opener;
    this.activities = activities;
    this.setup = setup || new SetupService({ toolsDirectory: toolsDirectory || path.join(this.dataDirectory, 'tools') });
  }

  async health() {
    await mkdir(this.projectsDirectory, { recursive: true });
    return { status: 'ready', api: 'contentlab-local-v1', dataDirectory: this.dataDirectory };
  }

  async listProjects() { return await this.registry.list(); }

  async inspectProject(directory) {
    const project = await readProjectDirectory(directory);
    const history = await this.#history(directory);
    const { stat } = await import('node:fs/promises');
    const mediaStatus = await Promise.all(project.media.map(async item => { try { await stat(item.uri); return { id: item.id, available: true }; } catch { return { id: item.id, available: false }; } }));
    return { project, history, mediaStatus, path: path.resolve(directory) };
  }

  async registerProject(directory) {
    const opened = await this.registry.open(directory);
    const details = await this.inspectProject(directory);
    return { ...details, card: opened.card };
  }

  async chooseDirectory(options) { return { path: await this.dialog.chooseDirectory(options) }; }
  async choosePackage(options) { return { path: await this.dialog.choosePackage(options) }; }
  async chooseMedia(options) { return { path: await this.dialog.chooseMedia(options) }; }

  async createProject({ title, type, aspectRatio, mode = 'review', parentDirectory }) {
    if (!title?.trim()) throw new Error('Informe o título do projeto');
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
    const include = relative => includeRenders || !(relative === 'output' || relative.startsWith('output/'));
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
      await this.activities.track(absolute, 'exclusão', () => this.trash.trash(absolute));
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
    await this.activities.track(absolute, 'exclusão', () => rm(absolute, { recursive: true }));
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
    const imported = await this.activities.track(directory, 'importação de mídia', () => this.media.importFile(source));
    const streams = imported.metadata?.streams || [];
    const extension = path.extname(imported.path).toLowerCase();
    const kind = streams.some(stream => stream.codec_type === 'video') ? (['.png', '.jpg', '.jpeg', '.webp'].includes(extension) ? 'image' : 'video') : streams.some(stream => stream.codec_type === 'audio') ? 'audio' : 'image';
    return await this.runProjectAction({ path: directory, baseRevision, action: { type: 'media.add', media: { id: imported.id, kind, uri: imported.path, sha256: imported.hash, rights } } });
  }

  /** Capacidades para as telas de etapa, derivadas do mesmo catálogo do setup. */
  async diagnostics() {
    const status = await this.setup.status();
    return { capabilities: status.items.filter(item => item.id !== 'node').map(item => ({ id: item.id, label: item.label, ready: item.ready, required: item.required, ...(item.ready ? { version: item.detected } : { solution: item.installable ? 'Instale em Dependências.' : item.systemCommand ? `Instale com: ${item.systemCommand}` : item.manualSteps || item.reason || 'Indisponível.' }) })) };
  }

  setupStatus() { return this.setup.status(); }
  setupInstall(input) { return this.setup.install(input); }
  setupJobs() { return { jobs: this.setup.jobs() }; }
  setupPause({ jobId }) { return this.setup.pause(jobId); }
  setupResume({ jobId }) { return this.setup.resume(jobId); }
  setupCancel({ jobId }) { return this.setup.cancel(jobId); }
  async setupOnboarding({ choice }) { return { onboarding: await this.setup.setOnboarding(choice) }; }

  async renderProject({ path: directory, outputDirectory }) {
    const project = await readProjectDirectory(directory);
    const targetDirectory = outputDirectory ? path.resolve(outputDirectory) : path.join(path.resolve(directory), 'output');
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
