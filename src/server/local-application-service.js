import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ProjectRegistry, readProjectDirectory } from './project-registry.js';
import { ProjectStore } from '../core/project-store.js';
import { createWorkflow } from '../core/workflow.js';
import { PackageService } from '../package/package-service.js';
import { NativeDialog } from './native-dialog.js';
import { AgentService } from '../core/agent-service.js';
import { randomUUID } from 'node:crypto';
import { MediaService } from '../media/media-service.js';

export class LocalApplicationService {
  constructor({ dataDirectory, dialog = new NativeDialog(), packages = new PackageService(), media = null }) {
    this.dataDirectory = path.resolve(dataDirectory);
    this.projectsDirectory = path.join(this.dataDirectory, 'projects');
    this.registry = new ProjectRegistry(this.dataDirectory);
    this.dialog = dialog;
    this.packages = packages;
    this.media = media || new MediaService(path.join(this.dataDirectory, 'media'));
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
    const project = await readProjectDirectory(absolute);
    if (project.revision !== baseRevision) throw new Error(`Conflito de revisão: esperado ${baseRevision}, atual ${project.revision}`);
    const store = new ProjectStore(path.dirname(absolute));
    const agent = new AgentService(store);
    await agent.run({ schema: 'contentlab-operation-v1', operationId: `op_${randomUUID().replaceAll('-', '')}`, projectId: project.id, baseRevision, dryRun: false, actions: [action] });
    return await this.registerProject(absolute);
  }

  async importMedia({ path: directory, baseRevision, source, rights = 'pending' }) {
    if (!source) throw new Error('Nenhum arquivo foi escolhido');
    const imported = await this.media.importFile(source);
    const streams = imported.metadata?.streams || [];
    const extension = path.extname(imported.path).toLowerCase();
    const kind = streams.some(stream => stream.codec_type === 'video') ? (['.png', '.jpg', '.jpeg', '.webp'].includes(extension) ? 'image' : 'video') : streams.some(stream => stream.codec_type === 'audio') ? 'audio' : 'image';
    return await this.runProjectAction({ path: directory, baseRevision, action: { type: 'media.add', media: { id: imported.id, kind, uri: imported.path, sha256: imported.hash, rights } } });
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

function slug(value) {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 58);
  const safe = /^[a-z]/.test(normalized) ? normalized : `projeto_${normalized}`;
  return safe.length >= 3 ? safe : `projeto_${Date.now().toString(36)}`;
}
