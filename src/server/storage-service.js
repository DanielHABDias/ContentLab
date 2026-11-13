import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, rmdir, stat, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { voiceMode } from '../core/voice-modes.js';
import { LifecycleError } from './project-lifecycle.js';

const SETTINGS_SCHEMA = 'contentlab-settings-v1';
export const ROOT_KINDS = ['projects', 'media', 'renderCache', 'tools', 'renderOutput'];
/** Raízes cujo conteúdo pode ser migrado. Projetos são pastas independentes: mudar a raiz só afeta projetos novos. */
export const MIGRATABLE = ['media', 'renderCache', 'tools'];
/** Partes não relocáveis da pasta de ferramentas (venv guarda caminhos absolutos). */
const TOOLS_NOT_RELOCATABLE = ['venvs', 'bin/contentlab-voice', 'src'];

export class SettingsStore {
  constructor(dataDirectory, defaults) {
    this.file = path.join(path.resolve(dataDirectory), 'settings.json');
    this.defaults = defaults;
  }

  async read() {
    for (const candidate of [this.file, `${this.file}.bak`]) {
      try {
        const value = JSON.parse(await readFile(candidate, 'utf8'));
        if (value.schema !== SETTINGS_SCHEMA) throw new Error('schema');
        return { ...normalize(value, this.defaults), recoveredFrom: candidate === this.file ? null : 'backup' };
      } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError) && error.message !== 'schema') throw error; }
    }
    return { ...normalize({}, this.defaults), recoveredFrom: null };
  }

  async write(settings) {
    const value = normalize(settings, this.defaults);
    const serialized = `${JSON.stringify({ schema: SETTINGS_SCHEMA, revision: value.revision, roots: value.roots, limits: value.limits, voice: value.voice }, null, 2)}\n`;
    await mkdir(path.dirname(this.file), { recursive: true });
    await copyFile(this.file, `${this.file}.bak`).catch(error => { if (error.code !== 'ENOENT') throw error; });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, serialized, { mode: 0o600 });
    await rename(temporary, this.file);
    return value;
  }
}

function normalize(value, defaults) {
  const roots = { ...defaults.roots };
  for (const kind of ROOT_KINDS) if (typeof value.roots?.[kind] === 'string' && path.isAbsolute(value.roots[kind])) roots[kind] = path.resolve(value.roots[kind]);
  if (value.roots && value.roots.renderOutput === null) roots.renderOutput = null;
  const limits = { ...defaults.limits };
  for (const key of Object.keys(defaults.limits)) { const number = value.limits?.[key]; if (number === null || (Number.isInteger(number) && number >= 0)) limits[key] = number; }
  return { revision: Number.isInteger(value.revision) ? value.revision : 0, roots, limits, voice: { mode: voiceMode(value.voice?.mode).id } };
}

/** Testa uma pasta antes de aceitá-la: absoluta, criável, gravável e legível. */
export async function validateFolder(target, { statfsImpl = statfs } = {}) {
  if (typeof target !== 'string' || !path.isAbsolute(target)) throw new LifecycleError('INVALID_FOLDER', 'Escolha um caminho absoluto');
  const absolute = path.resolve(target);
  const existing = await lstat(absolute).catch(() => null);
  if (existing?.isSymbolicLink()) throw new LifecycleError('INVALID_FOLDER', 'Links simbólicos não são aceitos como raiz');
  if (existing && !existing.isDirectory()) throw new LifecycleError('INVALID_FOLDER', 'O caminho escolhido é um arquivo');
  try { await mkdir(absolute, { recursive: true }); } catch (error) { throw new LifecycleError('INVALID_FOLDER', `Não foi possível criar a pasta: ${error.code || error.message}`); }
  const probe = path.join(absolute, `.contentlab-write-test-${randomUUID()}`);
  try {
    await writeFile(probe, 'contentlab');
    if (await readFile(probe, 'utf8') !== 'contentlab') throw new Error('leitura divergente');
  } catch (error) { throw new LifecycleError('INVALID_FOLDER', `A pasta não aceita escrita: ${error.code || error.message}`); }
  finally { await rm(probe, { force: true }); }
  const info = await statfsImpl(absolute).catch(() => null);
  const entries = (await readdir(absolute)).filter(name => !name.startsWith('.contentlab-write-test-'));
  return { path: absolute, writable: true, created: !existing, empty: entries.length === 0, freeBytes: info ? Number(info.bavail) * Number(info.bsize) : null };
}

export async function walkFiles(root, { exclude = () => false } = {}) {
  const files = [];
  const pending = [''];
  while (pending.length) {
    const relative = pending.pop();
    let names = [];
    try { names = await readdir(path.join(root, relative)); } catch { continue; }
    for (const name of names) {
      const child = relative ? `${relative}/${name}` : name;
      if (exclude(child)) continue;
      const info = await lstat(path.join(root, child)).catch(() => null);
      if (!info || info.isSymbolicLink()) continue;
      if (info.isDirectory()) pending.push(child); else files.push({ relative: child, size: info.size });
    }
  }
  return files;
}

export async function sizeOf(root, options) { return (await walkFiles(root, options)).reduce((sum, file) => sum + file.size, 0); }

async function sha256(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }

/**
 * Uso de disco, limpeza segura e migração assistida entre raízes.
 * `context()` devolve as raízes atuais e os projetos conhecidos.
 */
export class StorageService {
  #jobs = new Map();

  constructor({ context, onMigrated, statfsImpl = statfs }) { this.context = context; this.onMigrated = onMigrated; this.statfs = statfsImpl; }

  async usage() {
    const { roots, projects, limits } = await this.context();
    const ready = projects.filter(project => project.status === 'ready');
    const outputs = await Promise.all(ready.map(project => sizeOf(path.join(project.path, 'output'))));
    const categories = {
      projects: { bytes: ready.reduce((sum, project) => sum + (project.sizeBytes || 0), 0), count: ready.length, path: roots.projects },
      renders: { bytes: outputs.reduce((sum, value) => sum + value, 0), path: 'output/ de cada projeto' },
      objects: { bytes: await sizeOf(path.join(roots.media, 'objects')), path: path.join(roots.media, 'objects') },
      cuts: { bytes: await sizeOf(path.join(roots.media, 'cuts')), path: path.join(roots.media, 'cuts') },
      staging: { bytes: await sizeOf(path.join(roots.media, 'staging')), path: path.join(roots.media, 'staging') },
      renderCache: { bytes: await sizeOf(roots.renderCache), path: roots.renderCache },
      models: { bytes: await sizeOf(path.join(roots.tools, 'models')), path: path.join(roots.tools, 'models') },
      tools: { bytes: await sizeOf(roots.tools, { exclude: relative => relative === 'models' }), path: roots.tools },
    };
    const derivedBytes = categories.cuts.bytes + categories.staging.bytes + categories.renderCache.bytes;
    const free = await this.statfs(roots.projects).catch(() => null);
    const freeBytes = free ? Number(free.bavail) * Number(free.bsize) : null;
    const warnings = [];
    if (limits.cacheMaxBytes != null && derivedBytes > limits.cacheMaxBytes) warnings.push({ code: 'CACHE_LIMIT', message: 'O cache derivado passou do limite configurado; limpe derivados.' });
    if (limits.minFreeBytes != null && freeBytes != null && freeBytes < limits.minFreeBytes) warnings.push({ code: 'LOW_DISK', message: 'Espaço livre abaixo do mínimo configurado.' });
    const unknown = projects.filter(project => project.status !== 'ready').length;
    return { categories, derivedBytes, freeBytes, warnings, unanalyzedProjects: unknown };
  }

  /**
   * Objetos de mídia sem referência em nenhum projeto conhecido. Projetos
   * ausentes/inválidos impedem garantir que algo é órfão: o resultado avisa.
   */
  async orphans() {
    const { roots, projects, readProject } = await this.context();
    const referenced = new Set();
    for (const project of projects.filter(item => item.status === 'ready')) for (const media of (await readProject(project.path)).media) referenced.add(media.sha256);
    const files = await walkFiles(path.join(roots.media, 'objects'));
    const orphans = files.map(file => ({ ...file, hash: path.basename(file.relative).split('.')[0] })).filter(file => /^[a-f0-9]{64}$/.test(file.hash) && !referenced.has(file.hash));
    return { orphans, bytes: orphans.reduce((sum, file) => sum + file.size, 0), unanalyzedProjects: projects.filter(project => project.status !== 'ready').length };
  }

  /** Por padrão remove só derivados. Objetos exigem lista explícita e são reconferidos agora. */
  async cleanup({ derived = true, partialDownloads = false, orphanHashes = [] } = {}) {
    const { roots } = await this.context();
    const removed = []; let bytes = 0;
    const drop = async (target, label) => { const size = await sizeOf(target).catch(() => 0) || (await stat(target).then(info => info.size, () => 0)); await rm(target, { recursive: true, force: true }); removed.push(label); bytes += size; };
    if (derived) {
      await drop(path.join(roots.media, 'cuts'), 'cortes');
      await drop(path.join(roots.media, 'staging'), 'downloads temporários de mídia');
      for (const name of await readdir(roots.renderCache).catch(() => [])) await drop(path.join(roots.renderCache, name), `cache de render ${name}`);
      await drop(path.join(roots.tools, 'src'), 'código-fonte de compilação');
    }
    if (partialDownloads) for (const file of await walkFiles(roots.tools)) if (file.relative.endsWith('.partial')) await drop(path.join(roots.tools, file.relative), file.relative);
    if (orphanHashes.length) {
      const { orphans } = await this.orphans();
      const allowed = new Map(orphans.map(file => [file.hash, file]));
      const refused = orphanHashes.filter(hash => !allowed.has(hash));
      if (refused.length) throw new LifecycleError('MEDIA_IN_USE', `Alguns objetos passaram a ser usados por projetos e não foram removidos: ${refused.map(hash => hash.slice(0, 12)).join(', ')}`, { refused });
      for (const hash of orphanHashes) { const file = allowed.get(hash); await drop(path.join(roots.media, 'objects', file.relative), `objeto ${hash.slice(0, 12)}`); await rm(path.join(roots.media, 'index', `${hash}.json`), { force: true }); }
    }
    return { removed, bytes };
  }

  async planMigration({ kind, target }) {
    if (!MIGRATABLE.includes(kind)) throw new LifecycleError('NOT_MIGRATABLE', 'Projetos são pastas independentes: mudar a raiz só afeta projetos novos');
    const { roots } = await this.context();
    const source = roots[kind];
    const destination = path.resolve(target);
    if (destination === source) throw new LifecycleError('INVALID_FOLDER', 'O destino é a pasta atual');
    if (destination.startsWith(`${source}${path.sep}`) || source.startsWith(`${destination}${path.sep}`)) throw new LifecycleError('INVALID_FOLDER', 'Origem e destino não podem estar um dentro do outro');
    const folder = await validateFolder(destination, { statfsImpl: this.statfs });
    const skipped = kind === 'tools' ? TOOLS_NOT_RELOCATABLE : [];
    const files = await walkFiles(source, { exclude: relative => skipped.some(prefix => relative === prefix || relative.startsWith(`${prefix}/`)) || relative.endsWith('.partial') });
    const conflicts = [];
    for (const file of files) { const existing = await stat(path.join(destination, file.relative)).catch(() => null); if (existing && existing.size !== file.size) conflicts.push(file.relative); }
    const bytes = files.reduce((sum, file) => sum + file.size, 0);
    return { kind, source, target: destination, files: files.length, bytes, freeBytes: folder.freeBytes, sufficient: folder.freeBytes == null || folder.freeBytes > bytes, conflicts, notRelocatable: skipped.length ? 'O ambiente Python da voz clonada não é relocável e precisará ser reinstalado (os pesos são copiados); o código-fonte de compilação não é copiado.' : null };
  }

  async startMigration({ kind, target, removeSource = false, busy = () => [] }) {
    const plan = await this.planMigration({ kind, target });
    if (!plan.sufficient) throw new LifecycleError('INSUFFICIENT_SPACE', 'Espaço insuficiente no destino');
    if (plan.conflicts.length) throw new LifecycleError('MIGRATION_CONFLICT', `O destino já tem arquivos diferentes: ${plan.conflicts.slice(0, 3).join(', ')}`, { conflicts: plan.conflicts });
    const activities = busy(kind);
    if (activities.length) throw new LifecycleError('PROJECT_BUSY', `Aguarde terminar: ${activities.join(', ')}`);
    if ([...this.#jobs.values()].some(job => job.state === 'running')) throw new LifecycleError('MIGRATION_RUNNING', 'Já existe uma migração em andamento');
    const job = { id: `migration_${randomUUID().slice(0, 8)}`, kind, source: plan.source, target: plan.target, state: 'running', phase: 'Copiando', copied: 0, total: plan.bytes, files: plan.files, error: null, controller: new AbortController(), removeSource };
    this.#jobs.set(job.id, job);
    job.promise = this.#migrate(job).catch(error => { job.state = job.controller.signal.aborted ? 'cancelled' : 'failed'; job.error = error.message; job.phase = 'Revertido: nada foi alterado na origem nem nas configurações'; });
    return publicJob(job);
  }

  async #migrate(job) {
    const skipped = job.kind === 'tools' ? TOOLS_NOT_RELOCATABLE : [];
    const files = await walkFiles(job.source, { exclude: relative => skipped.some(prefix => relative === prefix || relative.startsWith(`${prefix}/`)) || relative.endsWith('.partial') });
    const created = [];
    try {
      for (const file of files) {
        if (job.controller.signal.aborted) throw new Error('Migração cancelada');
        const from = path.join(job.source, file.relative); const to = path.join(job.target, file.relative);
        const existing = await stat(to).catch(() => null);
        if (!existing) { await mkdir(path.dirname(to), { recursive: true }); await copyFile(from, `${to}.migrating`); await rename(`${to}.migrating`, to); created.push(to); }
        job.phase = 'Verificando cópias';
        if (await sha256(from) !== await sha256(to)) throw new Error(`Cópia divergente: ${file.relative}`);
        job.phase = 'Copiando'; job.copied += file.size;
      }
      job.phase = 'Aplicando nova pasta';
      await this.onMigrated({ kind: job.kind, source: job.source, target: job.target });
    } catch (error) {
      for (const file of created.reverse()) await rm(file, { force: true });
      await removeEmptyDirectories(job.target);
      throw error;
    }
    if (job.removeSource) {
      job.phase = 'Removendo origem verificada';
      for (const file of files) await rm(path.join(job.source, file.relative), { force: true });
      await removeEmptyDirectories(job.source);
    }
    job.state = 'completed'; job.phase = job.removeSource ? 'Migrado; origem removida' : 'Migrado; a origem foi mantida';
  }

  jobs() { return [...this.#jobs.values()].map(publicJob); }
  cancel(jobId) { const job = this.#jobs.get(jobId); if (!job) throw new LifecycleError('UNKNOWN_JOB', 'Migração desconhecida'); job.controller.abort(); return publicJob(job); }
  async waitFor(jobId) { const job = this.#jobs.get(jobId); await job.promise; return publicJob(job); }
}

async function removeEmptyDirectories(root) {
  const visit = async directory => {
    for (const name of await readdir(directory).catch(() => [])) { const child = path.join(directory, name); if ((await lstat(child).catch(() => null))?.isDirectory()) await visit(child); }
    if (directory !== root) await rmdir(directory).catch(() => {});
  };
  await visit(root);
}

function publicJob(job) { const { id, kind, source, target, state, phase, copied, total, files, error, removeSource } = job; return { id, kind, source, target, state, phase, copied, total, files, error, removeSource }; }
