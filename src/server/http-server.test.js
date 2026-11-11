import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { createContentLabServer } from './http-server.js';

const resources = [];
afterEach(async () => { for (const resource of resources.splice(0)) { if (resource.close) await new Promise(resolve => resource.close(resolve)); else await rm(resource, { recursive: true, force: true }); } });

test('API local inicia vazia, sem projetos de demonstração', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-http-')); resources.push(root);
  const server = createContentLabServer({ dataDirectory: root, staticDirectory: path.join(root, 'dist') }); resources.unshift(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const health = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`).then(response => response.json());
  const projects = await fetch(`http://127.0.0.1:${address.port}/api/v1/projects`).then(response => response.json());
  expect(health.status).toBe('ready');
  expect(projects).toEqual({ projects: [] });
});
