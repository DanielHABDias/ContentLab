import { expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WorkScheduler } from './work-scheduler.js';
import { JobQueue } from './job-queue.js';
import { RenderQueue } from '../render/render-queue.js';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('render, transcription, voice and WAV assembly share one FIFO slot across projects', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'contentlab-global-queue-'));
  const scheduler = new WorkScheduler(); const jobs = new JobQueue({ scheduler });
  const hold = deferred(); const started = []; let active = 0; let maximum = 0;
  const enter = async name => { active++; maximum = Math.max(maximum, active); started.push(name); if (name === 'render-one') await hold.promise; await tick(); active--; return { status: 'completed', output: '/ready.mp4' }; };
  const renders = new RenderQueue(path.join(directory, 'renders.json'), { render: project => enter(project.id) }, { scheduler });
  try {
    const first = await renders.enqueue({ id: 'render-one', revision: 1 }, { output: '/one.mp4' }, { projectPath: '/one' });
    await tick();
    const transcript = jobs.start({ kind: 'transcription', projectPath: '/two', label: 'Transcript', run: () => enter('transcription') });
    const second = await renders.enqueue({ id: 'render-two', revision: 1 }, { output: '/two.mp4' }, { projectPath: '/three' });
    const voice = jobs.start({ kind: 'voice.generate', projectPath: '/four', label: 'Voice', run: () => enter('voice') });
    const wav = jobs.start({ kind: 'narration.assemble', projectPath: '/five', label: 'WAV', run: () => enter('wav') });
    expect(started).toEqual(['render-one']); expect(jobs.list().every(job => job.state === 'queued')).toBe(true);
    expect(renders.get(second.id).state).toBe('queued'); hold.resolve();
    await Promise.all([renders.wait(first.id), renders.wait(second.id), jobs.waitFor(transcript.id), jobs.waitFor(voice.id), jobs.waitFor(wav.id)]);
    expect(maximum).toBe(1); expect(started).toEqual(['render-one', 'transcription', 'render-two', 'voice', 'wav']);
  } finally { hold.resolve(); await rm(directory, { recursive: true, force: true }); }
});

test('cancelling queued work never starts it; the active slot waits for actual shutdown', async () => {
  const scheduler = new WorkScheduler(); const jobs = new JobQueue({ scheduler });
  const hold = deferred(); const started = []; let abortSeen = false;
  const first = jobs.start({ kind: 'transcription', projectPath: '/one', label: 'One', run: async ({ signal }) => { started.push('one'); signal.addEventListener('abort', () => { abortSeen = true; }); await hold.promise; } });
  await tick();
  const cancelled = jobs.start({ kind: 'voice.generate', projectPath: '/two', label: 'Two', run: () => started.push('two') });
  const last = jobs.start({ kind: 'narration.assemble', projectPath: '/three', label: 'Three', run: () => started.push('three') });
  jobs.cancel(cancelled.id); jobs.cancel(first.id); await tick();
  expect(abortSeen).toBe(true); expect(started).toEqual(['one']); expect(jobs.list().find(job => job.id === last.id).state).toBe('queued');
  hold.resolve(); await Promise.all([jobs.waitFor(first.id), jobs.waitFor(cancelled.id), jobs.waitFor(last.id)]);
  expect(started).toEqual(['one', 'three']);
});

test('clear history preserves active and queued jobs and the latest finished render reference', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'contentlab-clear-queue-'));
  const scheduler = new WorkScheduler(); const jobs = new JobQueue({ scheduler }); const hold = deferred();
  const renders = new RenderQueue(path.join(directory, 'renders.json'), { render: async () => ({ status: 'completed', output: '/existing.mp4' }) }, { scheduler });
  try {
    const completed = await renders.enqueue({ id: 'finished', revision: 1 }, { output: '/existing.mp4' }, { projectPath: '/finished' }); await renders.wait(completed.id);
    const done = jobs.start({ kind: 'voice.generate', projectPath: '/done', label: 'Done', run: async () => {} }); await jobs.waitFor(done.id);
    const active = jobs.start({ kind: 'transcription', projectPath: '/active', label: 'Active', run: () => hold.promise }); await tick();
    const pending = jobs.start({ kind: 'voice.generate', projectPath: '/pending', label: 'Pending', run: async () => {} });
    expect(await renders.clearHistory()).toBe(1); expect(jobs.clearHistory()).toBe(1);
    expect(jobs.list().map(job => job.id)).toEqual([pending.id, active.id]);
    expect(renders.latest('/finished')).toMatchObject({ id: completed.id, output: '/existing.mp4' });
    expect(renders.latestCompleted('/finished').output).toBe('/existing.mp4');
    const restored = new RenderQueue(path.join(directory, 'renders.json'), {}); await restored.restore();
    expect(restored.list()).toEqual([]); expect(restored.latestCompleted('/finished').output).toBe('/existing.mp4');
    hold.resolve(); await Promise.all([jobs.waitFor(active.id), jobs.waitFor(pending.id)]);
  } finally { hold.resolve(); await rm(directory, { recursive: true, force: true }); }
});
