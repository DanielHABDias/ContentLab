import { test, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RenderQueue } from './render-queue.js';

test('progress bursts coalesce project snapshots and persist the completed state', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'contentlab-queue-burst-'));
  try {
    let snapshots = 0;
    const project = { id: 'burst', revision: 1, toJSON() { snapshots += 1; return { id: 'burst', revision: 1, asset: 'x'.repeat(100_000) }; } };
    const file = path.join(directory, 'jobs.json');
    const output = path.join(directory, 'output.mp4');
    const renderer = { async render(_, { onProgress }) {
      for (let i = 0; i < 1000; i += 1) onProgress({ progress: i / 1000, phase: `frame ${i}` });
      return { status: 'completed', output };
    } };
    const queue = new RenderQueue(file, renderer);
    const job = await queue.enqueue(project, { output }, { projectPath: directory });
    await queue.wait(job.id);
    const stored = JSON.parse(await readFile(file, 'utf8')).jobs[0];
    expect(stored).toMatchObject({ state: 'completed', progress: 1, output });
    expect(snapshots).toBeLessThan(10);
    const restored = new RenderQueue(file, renderer);
    expect((await restored.restore())[0]).toMatchObject({ state: 'completed', progress: 1, output });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
