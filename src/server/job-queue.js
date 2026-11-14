import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { WorkScheduler } from './work-scheduler.js';

/**
 * Jobs longos por projeto (importação, URL, transcrição) com progresso,
 * cancelamento e resultado real. Mantém só os últimos jobs encerrados.
 */
export class JobQueue {
  #jobs = new Map();

  constructor({ keep = 100, scheduler = new WorkScheduler(), file = null } = {}) { this.keep = keep; this.scheduler = scheduler; this.file = file; this.saving = Promise.resolve(); this.restored = false; }

  async restore() {
    if (this.restored || !this.file) return;
    try {
      const { jobs } = JSON.parse(await readFile(this.file, 'utf8'));
      for (const saved of jobs || []) {
        if (['queued', 'running'].includes(saved.state)) { saved.state = 'failed'; saved.error = 'Trabalho interrompido ao fechar o Content Lab. Envie novamente pelo projeto.'; saved.code = 'INTERRUPTED'; saved.finishedAt = new Date().toISOString(); saved.progress.phase = 'Interrompido'; }
        this.#jobs.set(saved.id, { ...saved, controller: new AbortController(), promise: Promise.resolve() });
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    this.restored = true; await this.#save();
  }

  start({ kind, projectPath, label, run }) {
    const job = { id: `job_${randomUUID().slice(0, 8)}`, kind, label, projectPath: path.resolve(projectPath), state: 'queued', progress: { done: 0, total: null, phase: 'Na fila' }, result: null, error: null, code: null, createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, controller: new AbortController() };
    this.#jobs.set(job.id, job);
    const progress = update => { job.progress = { ...job.progress, ...update }; };
    job.promise = this.scheduler.run({ id: job.id, signal: job.controller.signal, onStart: () => { job.state = 'running'; job.startedAt = new Date().toISOString(); job.progress.phase = 'Preparando'; void this.#save(); }, run: () => run({ signal: job.controller.signal, progress }) })
      .then(result => { job.state = job.controller.signal.aborted ? 'cancelled' : 'completed'; job.result = result ?? null; job.progress = { ...job.progress, phase: job.state === 'completed' ? 'Concluído' : 'Cancelado' }; })
      .catch(error => {
        if (job.controller.signal.aborted) { job.state = 'cancelled'; job.progress = { ...job.progress, phase: 'Cancelado' }; return; }
        job.state = 'failed'; job.error = error.message; job.code = error.code || null; job.progress = { ...job.progress, phase: 'Falhou' };
      })
      .finally(() => { job.finishedAt = new Date().toISOString(); this.#trim(); return this.#save(); });
    void this.#save(); return publicJob(job);
  }

  list({ projectPath } = {}) {
    const filter = projectPath ? path.resolve(projectPath) : null;
    return [...this.#jobs.values()].filter(job => !filter || job.projectPath === filter).map(publicJob).reverse();
  }

  cancel(jobId) {
    const job = this.#jobs.get(jobId);
    if (!job) throw Object.assign(new Error('Job desconhecido'), { code: 'UNKNOWN_JOB' });
    if (['queued', 'running'].includes(job.state)) { const queued = job.state === 'queued'; job.controller.abort(); if (queued) { job.state = 'cancelled'; job.progress.phase = 'Cancelado'; job.finishedAt = new Date().toISOString(); } else job.progress.phase = 'Cancelando…'; }
    void this.#save(); return publicJob(job);
  }

  clearHistory() { const finished = [...this.#jobs.values()].filter(job => ['completed', 'failed', 'cancelled'].includes(job.state)); for (const job of finished) this.#jobs.delete(job.id); void this.#save(); return finished.length; }

  async waitFor(jobId) { const job = this.#jobs.get(jobId); await job.promise; return publicJob(job); }

  async flush() { await this.saving; }

  #save() {
    if (!this.file) return Promise.resolve();
    this.saving = this.saving.then(async () => { const temporary = `${this.file}.${randomUUID()}.tmp`; await mkdir(path.dirname(this.file), { recursive: true }); await writeFile(temporary, JSON.stringify({ jobs: this.list().reverse() }), { mode: 0o600 }); await rename(temporary, this.file); });
    return this.saving;
  }

  #trim() {
    const finished = [...this.#jobs.values()].filter(job => ['completed', 'failed', 'cancelled'].includes(job.state));
    for (const job of finished.slice(0, Math.max(0, finished.length - this.keep))) this.#jobs.delete(job.id);
  }
}

function publicJob(job) {
  const { id, kind, label, projectPath, state, progress, result, error, code, createdAt, startedAt, finishedAt } = job;
  return { id, kind, label, projectPath, state, progress, result, error, code, createdAt, startedAt, finishedAt };
}
