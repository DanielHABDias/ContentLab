import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class RenderQueue {
  constructor(file, renderer) { this.file = path.resolve(file); this.renderer = renderer; this.jobs = []; this.controllers = new Map(); this.running = false; this.saving = Promise.resolve(); }
  async restore() { try { this.jobs = JSON.parse(await readFile(this.file, 'utf8')).map(job => job.status === 'running' ? { ...job, status: 'queued', progress: 0 } : job); } catch (error) { if (error.code !== 'ENOENT') throw error; } return this.jobs; }
  async enqueue(project, options) { const job = { id: `render_${randomUUID().replaceAll('-', '').slice(0, 12)}`, projectId: project.id, projectRevision: project.revision, status: 'queued', progress: 0, createdAt: new Date().toISOString(), project, options }; this.jobs.push(job); await this.#save(); void this.#drain(); return publicJob(job); }
  list() { return this.jobs.map(publicJob); }
  async cancel(id) { const job = this.jobs.find(item => item.id === id); if (!job) throw new Error('Job desconhecido'); if (job.status === 'queued') job.status = 'cancelled'; this.controllers.get(id)?.abort(); await this.#save(); return publicJob(job); }
  async wait(id) { while (true) { const job = this.jobs.find(item => item.id === id); if (!job) throw new Error('Job desconhecido'); if (['completed', 'failed', 'cancelled'].includes(job.status)) { await this.saving; return publicJob(job); } await new Promise(resolve => setTimeout(resolve, 20)); } }
  async #drain() { if (this.running) return; this.running = true; try { for (const job of this.jobs) { if (job.status !== 'queued') continue; const controller = new AbortController(); this.controllers.set(job.id, controller); job.status = 'running'; await this.#save(); try { const result = await this.renderer.render(job.project, { ...job.options, signal: controller.signal, onProgress: value => { job.progress = value.progress; job.phase = value.phase; void this.#save(); } }); job.status = result.status; job.output = result.output; job.progress = result.status === 'completed' ? 1 : job.progress; } catch (error) { job.status = 'failed'; job.error = error.message; } finally { delete job.project; this.controllers.delete(job.id); await this.#save(); } } } finally { this.running = false; } }
  async #save() {
    const snapshot = `${JSON.stringify(this.jobs, null, 2)}\n`;
    this.saving = this.saving.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot);
      await rename(temporary, this.file);
    });
    return await this.saving;
  }
}
function publicJob({ project, options, ...job }) { return job; }
