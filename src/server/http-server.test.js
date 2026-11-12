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

test('API recusa outros sites, DNS rebinding e escrita sem cliente identificado', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-http-')); resources.push(root);
  const server = createContentLabServer({ dataDirectory: root, staticDirectory: path.join(root, 'dist') }); resources.unshift(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const create = headers => fetch(`${base}/api/v1/projects/create`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ title: 'X', type: 'long', aspectRatio: '16:9', parentDirectory: path.join(root, 'w') }) });
  const evil = await create({ origin: 'https://site-malicioso.example', 'x-contentlab-client': '1' });
  expect(evil.status).toBe(403); expect((await evil.json()).code).toBe('FORBIDDEN_ORIGIN');
  expect((await create({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  expect((await create({})).status).toBe(403);
  const { request } = await import('node:http');
  const rebinding = await new Promise((resolve, reject) => { const call = request(`${base}/api/v1/projects`, { headers: { host: 'atacante.example:80' } }, resolve); call.on('error', reject); call.end(); });
  expect(rebinding.statusCode).toBe(403); rebinding.resume();
  const ok = await create({ origin: base, 'x-contentlab-client': '1' });
  expect(ok.status).toBe(201);
  expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
  const page = await fetch(`${base}/`);
  expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
});
