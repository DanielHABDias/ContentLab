import { open, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const LOCK_FILE = '.contentlab.lock';
const held = new Map(); // diretório → { count, operation } (reentrante no mesmo processo)

export class ProjectLockedError extends Error {
  constructor(owner) {
    super(`Projeto em uso por outro processo (${owner.operation || 'operação'}, PID ${owner.pid} em ${owner.hostname}, desde ${owner.startedAt}). Aguarde terminar e tente de novo.`);
    this.code = 'PROJECT_LOCKED';
    this.details = { owner };
  }
}

/**
 * Trava de escrita por projeto, válida entre processos (interface, CLI e MCP).
 * Uma trava cujo processo não existe mais (encerramento inesperado) é
 * recuperada: os temporários deixados na pasta são removidos antes de seguir.
 */
export async function withProjectLock(directory, operation, task, { isAlive = processAlive } = {}) {
  const absolute = path.resolve(directory);
  const current = held.get(absolute);
  if (current) { current.count += 1; try { return await task(); } finally { current.count -= 1; } }
  const recovered = await acquire(absolute, operation, isAlive);
  const entry = { count: 1, operation };
  held.set(absolute, entry);
  try { return await task({ recovered }); }
  finally {
    held.delete(absolute);
    await rm(path.join(absolute, LOCK_FILE), { force: true });
  }
}

export async function readLock(directory) {
  try { return JSON.parse(await readFile(path.join(path.resolve(directory), LOCK_FILE), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; return { pid: null, hostname: null, corrupt: true }; }
}

async function acquire(directory, operation, isAlive) {
  const file = path.join(directory, LOCK_FILE);
  const owner = { pid: process.pid, hostname: os.hostname(), operation, startedAt: new Date().toISOString() };
  let recovered = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(file, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(owner)}\n`);
      await handle.close();
      return recovered;
    } catch (error) {
      if (error.code === 'ENOENT') throw Object.assign(new Error('Pasta do projeto não encontrada'), { code: 'ENOENT' });
      if (error.code !== 'EEXIST') throw error;
      const existing = await readLock(directory);
      const stale = existing && (existing.corrupt || (existing.hostname === os.hostname() && !isAlive(existing.pid)));
      if (!stale) throw new ProjectLockedError(existing || { pid: '?', hostname: '?', startedAt: '?' });
      recovered = { previous: existing, removedTemporaries: await cleanTemporaries(directory) };
      await rm(file, { force: true });
    }
  }
  throw new ProjectLockedError(await readLock(directory));
}

async function cleanTemporaries(directory) {
  const names = await readdir(directory).catch(() => []);
  const temporaries = names.filter(name => /^\.project-.*\.tmp$/.test(name));
  await Promise.all(temporaries.map(name => rm(path.join(directory, name), { force: true })));
  return temporaries;
}

export function processAlive(pid) {
  if (!Number.isInteger(pid)) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}
