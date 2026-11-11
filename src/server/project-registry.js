import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { parseProject } from '../core/contracts.js';

export class ProjectRegistry {
  constructor(dataDirectory) {
    this.dataDirectory = path.resolve(dataDirectory);
    this.file = path.join(this.dataDirectory, 'recent-projects.json');
  }

  async list() {
    const entries = await this.#read();
    const projects = [];
    const valid = [];
    for (const entry of entries) {
      try {
        const project = await readProjectDirectory(entry.path);
        projects.push(toCard(project, entry.path, entry.openedAt));
        valid.push(entry);
      } catch {
        // A recent item is a convenience index, never a source of truth.
      }
    }
    if (valid.length !== entries.length) await this.#write(valid);
    return projects;
  }

  async open(directory) {
    const absolute = path.resolve(directory);
    const project = await readProjectDirectory(absolute);
    const entries = (await this.#read()).filter(entry => entry.path !== absolute);
    const openedAt = new Date().toISOString();
    entries.unshift({ path: absolute, openedAt });
    await this.#write(entries.slice(0, 50));
    return { project, card: toCard(project, absolute, openedAt) };
  }

  async remove(directory) {
    const absolute = path.resolve(directory);
    await this.#write((await this.#read()).filter(entry => entry.path !== absolute));
  }

  async #read() {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      return Array.isArray(value?.projects) ? value.projects.filter(entry => typeof entry?.path === 'string') : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw new Error(`Registro de projetos inválido: ${error.message}`);
    }
  }

  async #write(projects) {
    await mkdir(this.dataDirectory, { recursive: true });
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

export function toCard(project, directory, openedAt = null) {
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
  };
}
