import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { FfmpegRenderer } from './ffmpeg-renderer.js';
import { compileRenderPlan, previewFrame } from './render-plan.js';
import { RenderQueue } from './render-queue.js';

const roots = []; afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
async function root() { const value = await mkdtemp(path.join(os.tmpdir(), 'contentlab-render-')); roots.push(value); return value; }
function project(ratio = '16:9') { return { id: `render_${ratio.replace(':','_')}`, revision: 1, media: [], timeline: { schema: 'contentlab-timeline-v1', fps: 24, durationInFrames: 24, aspectRatio: ratio, safeArea: { top: .05, right: .05, bottom: .1, left: .05 }, tracks: [{ id: 'visual_main', kind: 'visual', name: 'Principal', muted: false, locked: false, clips: [{ id: 'layer_color', type: 'shape', startFrame: 0, durationInFrames: 24, fit: 'cover', anchor: 'center', keyframes: { opacity: [{ frame: 0, value: 0 }, { frame: 12, value: 1 }] }, effects: [] }] }] } }; }

test('preview usa o mesmo plano e interpola keyframe', () => { const plan = compileRenderPlan(project().timeline); const preview = previewFrame(plan, 6); expect(preview.layers[0].opacity).toBe(.5); expect(preview.canvas).toEqual(plan.canvas); });

test.each([['16:9', 1920, 1080], ['9:16', 1080, 1920]])('renderiza e valida %s com áudio', async (ratio, width, height) => { const directory = await root(); const renderer = new FfmpegRenderer(directory); const output = path.join(directory, `${ratio.replace(':','-')}.mp4`); const result = await renderer.render(project(ratio), { output }); expect(result.status).toBe('completed'); const video = result.inspection.streams.find(stream => stream.codec_type === 'video'); expect([video.width, video.height]).toEqual([width, height]); expect(result.inspection.streams.some(stream => stream.codec_type === 'audio')).toBe(true); expect((await stat(output)).size).toBeGreaterThan(1000); const cached = await renderer.render(project(ratio), { output: path.join(directory, `cached-${ratio.replace(':','-')}.mp4`) }); expect(cached.cached).toBe(true); });

test('fila persiste progresso, conclusão e restaura jobs', async () => { const directory = await root(); const file = path.join(directory, 'jobs.json'); const queue = new RenderQueue(file, new FfmpegRenderer(directory)); const job = await queue.enqueue(project('16:9'), { output: path.join(directory, 'queued.mp4') }); const finished = await queue.wait(job.id); expect(finished.status).toBe('completed'); const restored = new RenderQueue(file, new FfmpegRenderer(directory)); expect((await restored.restore())[0].status).toBe('completed'); });
