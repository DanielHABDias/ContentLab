import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

/** Fila de render persistente: o payload fica no disco para retomada/repetição, mas nunca sai na API. */
export class RenderQueue {
  constructor(file, renderer, { keep = 100 } = {}) { this.file = path.resolve(file); this.renderer = renderer; this.keep = keep; this.jobs = []; this.controllers = new Map(); this.running = false; this.saving = Promise.resolve(); this.restored = false; }

  async restore() {
    if (this.restored) return this.list();
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')); this.jobs = Array.isArray(raw) ? raw : raw.jobs;
      if (!Array.isArray(this.jobs)) throw new Error('Fila de render inválida');
      for (const job of this.jobs) { if (!job.state && job.status) { job.state = job.status; delete job.status; } if (job.state === 'running') { job.state = 'queued'; job.progress = 0; job.phase = 'Retomado após interrupção'; this.#log(job, 'Execução interrompida voltou para a fila'); } }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    this.restored = true; await this.#save(); void this.#drain(); return this.list();
  }

  async enqueue(project, options, { projectPath, presetId = 'full-hd' } = {}) {
    await this.restore();
    const now = new Date().toISOString();
    const job = { id: `render_${randomUUID().replaceAll('-', '').slice(0, 12)}`, kind: 'render', projectId: project.id, projectPath: path.resolve(projectPath || options.projectPath || '.'), projectRevision: project.revision, presetId, state: 'queued', phase: 'Na fila', progress: 0, attempt: 1, createdAt: now, updatedAt: now, finishedAt: null, output: null, error: null, code: null, logs: [{ at: now, message: 'Render adicionado à fila' }], payload: { project, options: { ...options, projectPath: undefined } } };
    this.jobs.push(job); this.#trim(); await this.#save(); void this.#drain(); return publicJob(job);
  }

  list({ projectPath } = {}) { const filter = projectPath ? path.resolve(projectPath) : null; return this.jobs.filter(job => !filter || job.projectPath === filter).map(publicJob).reverse(); }
  /** Desligar: interrompe o render em andamento (encerrando o FFmpeg) e o mantém na fila para retomar. */
  async suspend() {
    this.suspending = true;
    for (const controller of this.controllers.values()) controller.abort();
    const until = Date.now() + 8000;
    while (this.running && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 50));
    await this.saving;
  }
  get(id) { const job = this.jobs.find(item => item.id === id); if (!job) throw unknown(); return publicJob(job); }

  async cancel(id) {
    const job = this.jobs.find(item => item.id === id); if (!job) throw unknown();
    if (job.state === 'queued') { job.state = 'cancelled'; job.phase = 'Cancelado'; job.finishedAt = new Date().toISOString(); this.#log(job, 'Cancelado antes de iniciar'); }
    else if (job.state === 'running') { job.cancelRequested = true; job.phase = 'Cancelando…'; this.#log(job, 'Cancelamento solicitado'); this.controllers.get(id)?.abort(); }
    await this.#save(); return publicJob(job);
  }

  async retry(id) {
    const job = this.jobs.find(item => item.id === id); if (!job) throw unknown();
    if (!TERMINAL.has(job.state)) throw Object.assign(new Error('Só é possível repetir um render encerrado'), { code: 'JOB_RUNNING' });
    job.state = 'queued'; job.phase = 'Na fila'; job.progress = 0; job.error = null; job.code = null; job.cancelRequested = false; job.finishedAt = null; job.attempt += 1; this.#log(job, `Nova tentativa ${job.attempt}`); await this.#save(); void this.#drain(); return publicJob(job);
  }

  async wait(id) { while (true) { const job = this.jobs.find(item => item.id === id); if (!job) throw unknown(); if (TERMINAL.has(job.state)) { await this.saving; return publicJob(job); } await new Promise(resolve => setTimeout(resolve, 20)); } }

  async #drain() {
    if (this.running) return; this.running = true;
    try {
      for (const job of this.jobs) {
        if (this.suspending) break;
        if (job.state !== 'queued') continue;
        if (!job.payload?.project || !job.payload?.options?.output) { job.state = 'failed'; job.error = 'Payload do render não está disponível'; job.code = 'RENDER_PAYLOAD_MISSING'; job.finishedAt = new Date().toISOString(); await this.#save(); continue; }
        const controller = new AbortController(); this.controllers.set(job.id, controller); job.state = 'running'; job.phase = 'Preparando'; job.updatedAt = new Date().toISOString(); this.#log(job, `Tentativa ${job.attempt} iniciada`); await this.#save();
        try {
          const result = await this.renderer.render(job.payload.project, { ...job.payload.options, signal: controller.signal, onProgress: value => { job.progress = value.progress; job.phase = value.phase; job.updatedAt = new Date().toISOString(); void this.#save(); } });
          job.state = job.cancelRequested ? 'cancelled' : result.status; job.output = job.state === 'completed' ? result.output : null; job.progress = job.state === 'completed' ? 1 : job.progress; job.phase = job.state === 'completed' ? 'Concluído e validado' : 'Cancelado'; this.#log(job, job.phase);
        } catch (error) { job.state = controller.signal.aborted ? 'cancelled' : 'failed'; job.error = controller.signal.aborted ? null : error.message; job.code = error.code || null; job.phase = controller.signal.aborted ? 'Cancelado' : 'Falhou'; this.#log(job, job.error || job.phase); }
        finally { if (this.suspending && !job.cancelRequested) { job.state = 'queued'; job.phase = 'Continua ao abrir o Content Lab'; job.progress = 0; job.error = null; job.finishedAt = null; this.#log(job, 'Interrompido ao desligar; volta para a fila'); } else job.finishedAt = new Date().toISOString(); job.updatedAt = new Date().toISOString(); this.controllers.delete(job.id); await this.#save(); }
      }
    } finally { this.running = false; }
  }

  #log(job, message) { job.logs ||= []; job.logs.push({ at: new Date().toISOString(), message: String(message).slice(0, 500) }); job.logs = job.logs.slice(-30); }
  #trim() { const terminal = this.jobs.filter(job => TERMINAL.has(job.state)); const remove = terminal.slice(0, Math.max(0, terminal.length - this.keep)); this.jobs = this.jobs.filter(job => !remove.includes(job)); }
  async #save() {
    const snapshot = `${JSON.stringify({ schema: 'contentlab-render-queue-v1', jobs: this.jobs }, null, 2)}\n`;
    this.saving = this.saving.then(async () => { await mkdir(path.dirname(this.file), { recursive: true }); const temporary = `${this.file}.${randomUUID()}.tmp`; await writeFile(temporary, snapshot, { mode: 0o600 }); await rename(temporary, this.file); });
    return await this.saving;
  }
}

function publicJob({ payload, cancelRequested, ...job }) { return structuredClone(job); }
function unknown() { return Object.assign(new Error('Job de render desconhecido'), { code: 'UNKNOWN_JOB' }); }
