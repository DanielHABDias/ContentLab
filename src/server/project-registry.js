import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { parseProject } from '../core/contracts.js';
import { directorySize } from './project-lifecycle.js';

export class ProjectRegistry {
  constructor(dataDirectory, { scanRoots = () => [] } = {}) {
    this.dataDirectory = path.resolve(dataDirectory);
    this.file = path.join(this.dataDirectory, 'recent-projects.json');
    this.backupsDirectory = path.join(this.dataDirectory, 'backups');
    this.scanRoots = scanRoots;
    this.lastRecovery = null;
  }

  /** Cópia datada do registro, para restauração manual. */
  async backup() {
    const entries = await this.#read();
    await mkdir(this.backupsDirectory, { recursive: true });
    const file = path.join(this.backupsDirectory, `recent-projects-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await writeFile(file, `${JSON.stringify({ schema: 'contentlab-recents-v1', projects: entries }, null, 2)}\n`, { mode: 0o600 });
    return { path: file, projects: entries.length };
  }

  async listBackups() {
    const names = (await readdir(this.backupsDirectory).catch(() => [])).filter(name => /^recent-projects-.*\.json$/.test(name)).sort().reverse();
    return names.map(name => ({ name, path: path.join(this.backupsDirectory, name) }));
  }

  /** Restaura um backup datado; a versão atual vira backup antes. */
  async restoreBackup(name) {
    if (!/^recent-projects-[\w-]+\.json$/.test(name)) throw new Error('Backup inválido');
    const value = JSON.parse(await readFile(path.join(this.backupsDirectory, name), 'utf8'));
    if (!Array.isArray(value?.projects)) throw new Error('Backup sem lista de projetos');
    await this.backup();
    await this.#write(value.projects.filter(entry => typeof entry?.path === 'string'));
    return { restored: value.projects.length };
  }

  /**
   * Recentes são um índice de conveniência: caminhos ausentes ou inválidos
   * continuam listados com aviso até o usuário removê-los, nunca são apagados.
   */
  async list({ withSize = true } = {}) {
    const entries = await this.#read();
    return await Promise.all(entries.map(async entry => {
      try {
        const project = await readProjectDirectory(entry.path);
        const modified = await stat(path.join(entry.path, 'project.json'));
        return toCard(project, entry.path, entry.openedAt, { modifiedAt: modified.mtime.toISOString(), sizeBytes: withSize ? await directorySize(entry.path) : null });
      } catch (error) {
        const status = error.code === 'ENOENT' && error.path === path.resolve(entry.path) ? 'missing' : 'invalid';
        return { id: entry.id || path.basename(entry.path), title: entry.title || path.basename(entry.path), path: entry.path, openedAt: entry.openedAt || null, status, problem: status === 'missing' ? 'Pasta não encontrada' : `Projeto inválido: ${error.message}` };
      }
    }));
  }

  async open(directory) {
    const absolute = path.resolve(directory);
    const project = await readProjectDirectory(absolute);
    const entries = (await this.#read()).filter(entry => entry.path !== absolute);
    const openedAt = new Date().toISOString();
    entries.unshift({ path: absolute, openedAt, id: project.id, title: project.title });
    await this.#write(entries.slice(0, 50));
    const modified = await stat(path.join(absolute, 'project.json'));
    return { project, card: toCard(project, absolute, openedAt, { modifiedAt: modified.mtime.toISOString(), sizeBytes: await directorySize(absolute) }) };
  }

  /** Remove somente a entrada do registro; a pasta do projeto nunca é tocada. */
  async remove(directory) {
    const absolute = path.resolve(directory);
    const entries = await this.#read();
    const remaining = entries.filter(entry => entry.path !== absolute);
    await this.#write(remaining);
    return { removed: entries.length - remaining.length };
  }

  async relocate(from, to, { id, title } = {}) {
    const source = path.resolve(from);
    const entries = (await this.#read()).map(entry => entry.path === source ? { ...entry, path: path.resolve(to), ...(id ? { id } : {}), ...(title ? { title } : {}) } : entry);
    await this.#write(entries);
  }

  async #read() {
    const parse = async file => {
      const value = JSON.parse(await readFile(file, 'utf8'));
      if (!Array.isArray(value?.projects)) throw new SyntaxError('lista ausente');
      return value.projects.filter(entry => typeof entry?.path === 'string');
    };
    try { return await parse(this.file); }
    catch (error) {
      if (error.code === 'ENOENT') return [];
      if (!(error instanceof SyntaxError)) throw error;
    }
    // Registro corrompido: preserva o arquivo e recupera sem perder projetos.
    const corrupted = path.join(this.dataDirectory, `recent-projects.corrupted-${Date.now()}.json`);
    await rename(this.file, corrupted).catch(() => {});
    let entries = null; let source = 'backup';
    try { entries = await parse(`${this.file}.bak`); } catch { entries = null; }
    if (!entries) { source = 'scan'; entries = await this.#scan(); }
    await this.#write(entries, { keepBackup: false });
    this.lastRecovery = { source, recovered: entries.length, corrupted, at: new Date().toISOString() };
    return entries;
  }

  async #scan() {
    const entries = [];
    for (const root of await this.scanRoots()) {
      for (const name of await readdir(root).catch(() => [])) {
        const directory = path.join(root, name);
        try { const project = await readProjectDirectory(directory); entries.push({ path: directory, openedAt: null, id: project.id, title: project.title }); } catch { /* não é projeto */ }
      }
    }
    return entries;
  }

  async #write(projects, { keepBackup = true } = {}) {
    await mkdir(this.dataDirectory, { recursive: true });
    if (keepBackup) await copyFile(this.file, `${this.file}.bak`).catch(error => { if (error.code !== 'ENOENT') throw error; });
    const temporary = path.join(this.dataDirectory, `.recent-${randomUUID()}.tmp`);
    await writeFile(temporary, `${JSON.stringify({ schema: 'contentlab-recents-v1', projects }, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.file);
  }
}

export async function readProjectDirectory(directory) {
  const absolute = path.resolve(directory);
  if (!(await stat(absolute)).isDirectory()) throw new Error('O caminho escolhido não é uma pasta');
  const project = parseProject(JSON.parse(await readFile(path.join(absolute, 'project.json'), 'utf8')));
  if (path.basename(absolute) !== project.id) throw new Error('A pasta do projeto deve ter o mesmo nome do ID em project.json');
  return project;
}

export function toCard(project, directory, openedAt = null, extra = {}) {
  const active = project.stages.find(stage => ['active', 'changes_requested'].includes(stage.state)) || project.stages.at(-1);
  const approved = project.stages.filter(stage => stage.state === 'approved').length;
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    aspectRatio: project.aspectRatio,
    mode: project.mode,
    revision: project.revision,
    stage: active?.id || 'brief',
    progress: Math.round((approved / Math.max(1, project.stages.length)) * 100),
    mediaCount: project.media.length,
    path: directory,
    openedAt,
    status: 'ready',
    modifiedAt: extra.modifiedAt || null,
    sizeBytes: extra.sizeBytes ?? null,
  };
}
