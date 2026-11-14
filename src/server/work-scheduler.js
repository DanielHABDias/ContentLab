/** One FIFO execution slot shared by all projects and processing types. */
export class WorkScheduler {
  constructor() { this.pending = []; this.active = null; this.paused = 0; }

  run({ id, signal, run, onStart = () => {} }) {
    return new Promise((resolve, reject) => {
      const task = { id, signal, run, onStart, resolve, reject };
      task.abort = () => {
        const index = this.pending.indexOf(task);
        if (index < 0) return;
        this.pending.splice(index, 1); signal.removeEventListener('abort', task.abort);
        reject(aborted()); this.drain();
      };
      if (signal?.aborted) { reject(aborted()); return; }
      signal?.addEventListener('abort', task.abort, { once: true });
      this.pending.push(task); this.drain();
    });
  }

  pause() { this.paused += 1; }
  resume() { this.paused = Math.max(0, this.paused - 1); this.drain(); }
  position(id) { if (this.active?.id === id) return 0; const index = this.pending.findIndex(task => task.id === id); return index < 0 ? null : index + 1; }

  drain() {
    if (this.active || this.paused) return;
    const task = this.pending.shift(); if (!task) return;
    this.active = task; task.signal?.removeEventListener('abort', task.abort);
    Promise.resolve().then(() => { if (task.signal?.aborted) throw aborted(); return task.onStart(); })
      .then(() => { if (task.signal?.aborted) throw aborted(); return task.run(); }).then(task.resolve, task.reject)
      .finally(() => { this.active = null; this.drain(); });
  }
}
const aborted = () => Object.assign(new Error('Trabalho cancelado'), { code: 'CANCELLED' });
