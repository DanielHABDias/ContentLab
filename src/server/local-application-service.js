import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ProjectRegistry, readProjectDirectory } from './project-registry.js';

export class LocalApplicationService {
  constructor({ dataDirectory }) {
    this.dataDirectory = path.resolve(dataDirectory);
    this.projectsDirectory = path.join(this.dataDirectory, 'projects');
    this.registry = new ProjectRegistry(this.dataDirectory);
  }

  async health() {
    await mkdir(this.projectsDirectory, { recursive: true });
    return { status: 'ready', api: 'contentlab-local-v1', dataDirectory: this.dataDirectory };
  }

  async listProjects() { return await this.registry.list(); }

  async inspectProject(directory) {
    const project = await readProjectDirectory(directory);
    const history = await this.#history(directory);
    return { project, history, path: path.resolve(directory) };
  }

  async registerProject(directory) {
    const opened = await this.registry.open(directory);
    const details = await this.inspectProject(directory);
    return { ...details, card: opened.card };
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
