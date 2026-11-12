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

test('desligar recusa sem confirmação quando há trabalho e encerra quando confirmado', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-http-')); resources.push(root);
  let work = [{ kind: 'render', label: 'Render x', resumes: true }]; let prepared = 0; let stopped = 0;
  const application = { activeWork: async () => ({ work }), prepareShutdown: async () => { prepared += 1; } };
  const server = createContentLabServer({ dataDirectory: root, staticDirectory: path.join(root, 'dist'), application, onShutdown: () => { stopped += 1; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`; const headers = { 'content-type': 'application/json', 'x-contentlab-client': '1' };
  expect((await (await fetch(`${base}/server/work`)).json()).work).toHaveLength(1);
  const refused = await fetch(`${base}/server/shutdown`, { method: 'POST', headers, body: '{}' });
  expect(refused.status).toBe(409); expect((await refused.json()).code).toBe('WORK_IN_PROGRESS'); expect(prepared).toBe(0);
  const evil = await fetch(`${base}/server/shutdown`, { method: 'POST', headers: { ...headers, origin: 'https://evil.example' }, body: '{"force":true}' });
  expect(evil.status).toBe(403);
  const accepted = await fetch(`${base}/server/shutdown`, { method: 'POST', headers, body: '{"force":true}' });
  expect(accepted.status).toBe(202);
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(prepared).toBe(1); expect(stopped).toBe(1); expect(server.listening).toBe(false);
});

test('documentação do kit: lista sons e poses e só serve arquivos do catálogo', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-http-')); resources.push(root);
  const server = createContentLabServer({ dataDirectory: root, staticDirectory: path.join(root, 'dist') }); resources.unshift(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const docs = await fetch(`${base}/api/v1/brand/docs`).then(response => response.json());
  expect(docs.sfx.map(item => item.name)).toEqual(expect.arrayContaining(['whoosh', 'sino', 'tapa-eco']));
  expect(docs.sfx.every(item => item.available && item.use)).toBe(true);
  expect(docs.poses).toHaveLength(21); expect(docs.poses.find(pose => pose.id === 'apontando').files).toContain('apontando-b.png');
  expect(docs.captions.join(' ')).toMatch(/Short.*o tempo todo/);
  const sound = await fetch(`${base}/api/v1/brand/file?kind=sfx&name=sino`);
  expect(sound.status).toBe(200); expect(sound.headers.get('content-type')).toBe('audio/wav'); expect(Buffer.from(await sound.arrayBuffer()).subarray(0, 4).toString()).toBe('RIFF');
  const pose = await fetch(`${base}/api/v1/brand/file?kind=pose&name=apontando-b`);
  expect(pose.status).toBe(200); expect(pose.headers.get('content-type')).toBe('image/png'); await pose.arrayBuffer();
  for (const query of ['kind=sfx&name=../../package', 'kind=sfx&name=nao-existe', 'kind=pose&name=catalogo', 'kind=fonts&name=Anton-Regular']) expect((await fetch(`${base}/api/v1/brand/file?${query}`)).status).toBe(400);
  expect((await fetch(`${base}/api/v1/brand/docs`, { headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(403);
});
