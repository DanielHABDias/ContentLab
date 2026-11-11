import { appendFile, lstat, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseProject } from './contracts.js';
import { LOCK_FILE, withProjectLock } from './project-lock.js';

export class ProjectStore {
  constructor(root) { this.root = path.resolve(root); }

  async create(project, event = {}) {
    const parsed = parseProject(project);
    const directory = this.#directory(parsed.id);
    try { await readFile(path.join(directory, 'project.json')); throw new Error(`Projeto já existe: ${parsed.id}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(path.join(directory, 'versions'), { recursive: true });
    await this.#commit(directory, parsed, { ...event, type: 'project.created' });
    return parsed;
  }

  /**
   * Muda ID e pasta numa operação separada: valida, renomeia a pasta e grava a
   * nova revisão; qualquer falha devolve a pasta ao nome original.
   */
  async changeId(projectId, expectedRevision, nextId) {
    const source = this.#directory(projectId);
    const target = this.#directory(nextId);
    if (projectId === nextId) throw new Error('O novo ID é igual ao atual');
    return await withProjectLock(source, 'mudança de ID', () => this.#changeId(projectId, expectedRevision, nextId, source, target));
  }

  async #changeId(projectId, expectedRevision, nextId, source, target) {
    const current = await this.read(projectId);
    if (current.revision !== expectedRevision) throw new Error(`Conflito de revisão: esperado ${expectedRevision}, atual ${current.revision}`);
    try { await lstat(target); throw new Error(`Já existe uma pasta chamada ${nextId}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const next = parseProject({ ...structuredClone(current), id: nextId, revision: current.revision + 1 });
    await rename(source, target);
    try { await this.#commit(target, next, { type: 'project.id_changed', from: projectId, to: nextId }); }
    catch (error) { await rename(target, source).catch(() => {}); throw error; }
    // A trava viajou com a pasta renomeada; a pasta de origem não existe mais.
    await rm(path.join(target, LOCK_FILE), { force: true });
    return next;
  }

  async read(projectId) {
    return parseProject(JSON.parse(await readFile(path.join(this.#directory(projectId), 'project.json'), 'utf8')));
  }

  async update(projectId, expectedRevision, mutate, event) {
    const directory = this.#directory(projectId);
    return await withProjectLock(directory, event?.type || 'escrita', async () => {
      const current = await this.read(projectId);
      if (current.revision !== expectedRevision) throw new Error(`Conflito de revisão: esperado ${expectedRevision}, atual ${current.revision}`);
      const next = parseProject(await mutate(structuredClone(current)));
      if (next.id !== current.id || next.revision !== current.revision + 1) throw new Error('Atualização deve preservar o ID e incrementar uma revisão');
      await this.#commit(directory, next, event);
      return next;
    });
  }

  async history(projectId) {
    const data = await readFile(path.join(this.#directory(projectId), 'history.ndjson'), 'utf8');
    return data.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  }

  #directory(projectId) {
    if (!/^[a-z][a-z0-9_-]{2,63}$/.test(projectId)) throw new Error('ID de projeto inválido');
    const directory = path.resolve(this.root, projectId);
    if (!directory.startsWith(`${this.root}${path.sep}`)) throw new Error('Projeto fora da raiz');
    return directory;
  }

  async #commit(directory, project, event) {
    await mkdir(path.join(directory, 'versions'), { recursive: true });
    const serialized = `${JSON.stringify(project, null, 2)}\n`;
    const temporary = path.join(directory, `.project-${randomUUID()}.tmp`);
    await writeFile(temporary, serialized, { mode: 0o600 });
    const handle = await open(temporary, 'r');
    await handle.sync();
    await handle.close();
    await rename(temporary, path.join(directory, 'project.json'));
    await writeFile(path.join(directory, 'versions', `${String(project.revision).padStart(6, '0')}.json`), serialized, { flag: 'wx', mode: 0o600 });
    await appendFile(path.join(directory, 'history.ndjson'), `${JSON.stringify({ id: randomUUID(), at: new Date().toISOString(), revision: project.revision, ...event })}\n`, { mode: 0o600 });
  }
}
