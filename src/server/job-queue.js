import { randomUUID } from 'node:crypto';
import path from 'node:path';

/**
 * Jobs longos por projeto (importação, URL, transcrição) com progresso,
 * cancelamento e resultado real. Mantém só os últimos jobs encerrados.
 */
export class JobQueue {
  #jobs = new Map();

  constructor({ keep = 50 } = {}) { this.keep = keep; }

  start({ kind, projectPath, label, run }) {
    const job = { id: `job_${randomUUID().slice(0, 8)}`, kind, label, projectPath: path.resolve(projectPath), state: 'running', progress: { done: 0, total: null, phase: 'Preparando' }, result: null, error: null, code: null, startedAt: new Date().toISOString(), finishedAt: null, controller: new AbortController() };
    this.#jobs.set(job.id, job);
    const progress = update => { job.progress = { ...job.progress, ...update }; };
    job.promise = Promise.resolve()
      .then(() => run({ signal: job.controller.signal, progress }))
      .then(result => { job.state = 'completed'; job.result = result ?? null; job.progress = { ...job.progress, phase: 'Concluído' }; })
      .catch(error => {
        if (job.controller.signal.aborted) { job.state = 'cancelled'; job.progress = { ...job.progress, phase: 'Cancelado' }; return; }
        job.state = 'failed'; job.error = error.message; job.code = error.code || null; job.progress = { ...job.progress, phase: 'Falhou' };
      })
      .finally(() => { job.finishedAt = new Date().toISOString(); this.#trim(); });
    return publicJob(job);
  }

  list({ projectPath } = {}) {
    const filter = projectPath ? path.resolve(projectPath) : null;
    return [...this.#jobs.values()].filter(job => !filter || job.projectPath === filter).map(publicJob).reverse();
  }

  cancel(jobId) {
    const job = this.#jobs.get(jobId);
    if (!job) throw Object.assign(new Error('Job desconhecido'), { code: 'UNKNOWN_JOB' });
    if (job.state === 'running') job.controller.abort();
    return publicJob(job);
  }

  async waitFor(jobId) { const job = this.#jobs.get(jobId); await job.promise; return publicJob(job); }

  #trim() {
    const finished = [...this.#jobs.values()].filter(job => job.state !== 'running');
    for (const job of finished.slice(0, Math.max(0, finished.length - this.keep))) this.#jobs.delete(job.id);
  }
}

function publicJob(job) {
  const { id, kind, label, projectPath, state, progress, result, error, code, startedAt, finishedAt } = job;
  return { id, kind, label, projectPath, state, progress, result, error, code, startedAt, finishedAt };
}
