import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { AgentService } from '../core/agent-service.js';
import { ProjectStore } from '../core/project-store.js';
import { createWorkflow } from '../core/workflow.js';
import { FfmpegRenderer } from '../render/ffmpeg-renderer.js';
import { PackageService } from '../package/package-service.js';

const roots = []; afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

test('E2E: projeto, agente, render, pacote e restauração', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-e2e-')); roots.push(root); const projects = path.join(root, 'projects'); const store = new ProjectStore(projects); const agent = new AgentService(store);
  const project = { schema: 'contentlab-project-v1', id: 'e2e_project', title: 'E2E', type: 'short', aspectRatio: '9:16', mode: 'review', revision: 1, stages: createWorkflow(), media: [], timeline: { schema: 'contentlab-timeline-v1', fps: 24, durationInFrames: 24, aspectRatio: '9:16', safeArea: { top: .08, right: .05, bottom: .15, left: .05 }, tracks: [{ id: 'visual_main', kind: 'visual', name: 'Principal', muted: false, locked: false, clips: [] }] } };
  await agent.create(project);
  const preview = await agent.run({ schema: 'contentlab-operation-v1', operationId: 'e2e_preview', projectId: 'e2e_project', baseRevision: 1, dryRun: true, actions: [{ type: 'clip.add', trackId: 'visual_main', clip: { id: 'e2e_layer', type: 'shape', startFrame: 0, durationInFrames: 24 } }] }); expect(preview.status).toBe('preview');
  const applied = await agent.run({ schema: 'contentlab-operation-v1', operationId: 'e2e_apply', projectId: 'e2e_project', baseRevision: 1, dryRun: false, actions: [{ type: 'clip.add', trackId: 'visual_main', clip: { id: 'e2e_layer', type: 'shape', startFrame: 0, durationInFrames: 24 } }] }); expect(applied.revision).toBe(2);
  const current = await store.read('e2e_project'); const render = path.join(root, 'final.mp4'); const rendered = await new FfmpegRenderer(path.join(root, 'render')).render(current, { output: render }); expect(rendered.status).toBe('completed');
  const projectDirectory = path.join(projects, 'e2e_project'); await writeFile(path.join(projectDirectory, 'final.mp4'), await readFile(render)); const packagePath = path.join(root, 'e2e.contentlab'); const packages = new PackageService(); await packages.exportContentLab(projectDirectory, packagePath); const restored = path.join(root, 'restored'); await packages.restore(packagePath, restored); expect(JSON.parse(await readFile(path.join(restored, 'project.json'), 'utf8')).revision).toBe(2); expect((await stat(path.join(restored, 'final.mp4'))).size).toBeGreaterThan(1000);
});
