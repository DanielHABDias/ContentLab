import { execFile } from 'node:child_process';
import { lstat, mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export class LifecycleError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/**
 * Lixeira recuperável do sistema. No Linux usa `gio trash`, que segue a
 * especificação freedesktop e permite restaurar ao local original.
 */
export class SystemTrash {
  constructor({ binary = 'gio', env = process.env } = {}) { this.binary = binary; this.env = env; }

  async trash(directory) {
    try { await run(this.binary, ['trash', '--', directory], { timeout: 60_000, env: this.env }); }
    catch (error) { throw new LifecycleError('TRASH_UNAVAILABLE', `Não foi possível mover para a lixeira: ${`${error.stderr || error.message}`.trim()}`); }
  }

  /**
   * Restaura lendo os `.trashinfo` (especificação freedesktop), sem depender do
   * daemon GVfs: procura na lixeira do usuário e na `.Trash-<uid>` do volume.
   */
  async restore(originalPath) {
    const original = path.resolve(originalPath);
    const matches = [];
    for (const { directory, topdir } of await this.#trashDirectories(original)) {
      let names = [];
      try { names = (await readdir(path.join(directory, 'info'))).filter(name => name.endsWith('.trashinfo')); } catch { continue; }
      for (const name of names) {
        const info = parseTrashInfo(await readFile(path.join(directory, 'info', name), 'utf8').catch(() => ''));
        if (!info.path) continue;
        const resolved = path.isAbsolute(info.path) ? info.path : path.join(topdir, info.path);
        if (resolved === original) matches.push({ directory, name: name.slice(0, -'.trashinfo'.length), deletedAt: info.deletedAt || '' });
      }
    }
    const latest = matches.sort((a, b) => a.deletedAt.localeCompare(b.deletedAt)).at(-1);
    if (!latest) throw new LifecycleError('NOT_IN_TRASH', 'O projeto não está mais na lixeira');
    try { await lstat(original); throw new LifecycleError('RESTORE_CONFLICT', 'Já existe uma pasta no local original; mova-a antes de restaurar'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(path.dirname(original), { recursive: true });
    await rename(path.join(latest.directory, 'files', latest.name), original);
    await rm(path.join(latest.directory, 'info', `${latest.name}.trashinfo`), { force: true });
  }

  async #trashDirectories(original) {
    const dataHome = this.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    const result = [{ directory: path.join(dataHome, 'Trash'), topdir: '/' }];
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    if (uid === null) return result;
    let topdir = path.dirname(original);
    try {
      const device = (await stat(topdir)).dev;
      while (path.dirname(topdir) !== topdir && (await stat(path.dirname(topdir))).dev === device) topdir = path.dirname(topdir);
    } catch { return result; }
    result.push({ directory: path.join(topdir, '.Trash', String(uid)), topdir }, { directory: path.join(topdir, `.Trash-${uid}`), topdir });
    return result;
  }
}

function parseTrashInfo(contents) {
  const value = key => contents.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
  const raw = value('Path');
  let decoded = null;
  try { decoded = raw ? decodeURIComponent(raw) : null; } catch { decoded = null; }
  return { path: decoded, deletedAt: value('DeletionDate') };
}

/** Abre uma pasta no gerenciador de arquivos do sistema. */
export class SystemOpener {
  constructor({ binary = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open' } = {}) { this.binary = binary; }
  async reveal(directory) {
    try { await run(this.binary, [directory], { timeout: 10_000 }); }
    catch (error) { if (this.binary === 'explorer' && error.code === 1) return; throw new Error(`Não foi possível abrir o gerenciador de arquivos: ${error.message}`); }
  }
}

/**
 * Registra operações de escrita/render em andamento por projeto, para impedir
 * exclusão/mudança de ID concorrente e permitir cancelar o que é cancelável.
 */
export class ActivityTracker {
  #active = new Map();

  async track(directory, kind, task, { cancellable = false } = {}) {
    const key = path.resolve(directory);
    const controller = cancellable ? new AbortController() : null;
    const entry = { id: `${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, kind, startedAt: new Date().toISOString(), cancellable, controller };
    const list = this.#active.get(key) || [];
    list.push(entry);
    this.#active.set(key, list);
    try { return await task(controller?.signal); }
    finally {
      const remaining = (this.#active.get(key) || []).filter(item => item !== entry);
      if (remaining.length) this.#active.set(key, remaining); else this.#active.delete(key);
    }
  }

  list(directory) {
    return (this.#active.get(path.resolve(directory)) || []).map(({ id, kind, startedAt, cancellable }) => ({ id, kind, startedAt, cancellable }));
  }

  cancel(directory) {
    const entries = this.#active.get(path.resolve(directory)) || [];
    const cancelled = entries.filter(entry => entry.controller && !entry.controller.signal.aborted);
    cancelled.forEach(entry => entry.controller.abort());
    return { cancelled: cancelled.length, remaining: entries.length - cancelled.length };
  }

  any() { return this.#active.size > 0; }

  assertIdle(directory, action) {
    const activities = this.list(directory);
    if (activities.length) throw new LifecycleError('PROJECT_BUSY', `Não é possível ${action} enquanto houver operação em andamento: ${activities.map(item => item.kind).join(', ')}`, { activities });
  }
}

export async function directorySize(root) {
  let total = 0;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    let names;
    try { names = await readdir(current); } catch { continue; }
    for (const name of names) {
      const absolute = path.join(current, name);
      const info = await lstat(absolute).catch(() => null);
      if (!info || info.isSymbolicLink()) continue;
      if (info.isDirectory()) pending.push(absolute); else total += info.size;
    }
  }
  return total;
}
