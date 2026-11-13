import { expect, test, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './mcp-server.js';

test('MCP expõe o fluxo completo e explica quando o app está fechado', async () => {
  process.env.CONTENTLAB_PORT = '1';
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(); await server.connect(serverSide);
  const client = new Client({ name: 't', version: '1' }); await client.connect(clientSide);
  const names = (await client.listTools()).tools.map(tool => tool.name);
  for (const name of ['contentlab_start', 'contentlab_open', 'contentlab_stop', 'project_create', 'project_flow_set', 'creative_write', 'script_get', 'script_edit', 'stage_wait_decision', 'stage_approve', 'media_generate_slides', 'narration_generate', 'narration_assemble', 'timeline_auto_assemble', 'thumbnails_generate', 'render_start', 'job_wait', 'deliverable_build', 'project_export']) expect(names).toContain(name);
  expect(client.getInstructions()).toMatch(/stage_wait_decision/);
  expect(client.getInstructions()).toMatch(/narrationBy começa null/);
  const status = await client.callTool({ name: 'contentlab_status', arguments: {} });
  expect(JSON.parse(status.content[0].text)).toMatchObject({ running: false });
  const offline = await client.callTool({ name: 'project_get', arguments: { path: '/x' } });
  expect(offline.isError).toBe(true); expect(JSON.parse(offline.content[0].text).code).toBe('APP_OFFLINE');
  const cloned = await client.callTool({ name: 'narration_generate', arguments: { path: '/x' } });
  expect(cloned.isError).toBe(true); expect(JSON.parse(cloned.content[0].text).code).toBe('APP_OFFLINE');
  const options = (await client.listTools()).tools.find(item => item.name === 'narration_generate');
  expect(Object.keys(options.inputSchema.properties)).toEqual(['path', 'profileId']);
  await client.close();
});


test('MCP edita só um bloco com revisão otimista e dry-run sem perder fontes ou capítulos', async () => {
  let project = { revision: 7, creative: { brief: {}, packaging: {}, script: { sources: 'Fonte preservada', chapters: [{ id: 'origin', title: 'Origem', blocks: [{ id: 'speech', type: 'narration', title: '', text: 'Antes.' }, { id: 'clip', type: 'scene', title: '', text: 'Som original.' }] }] } } };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    const input = JSON.parse(options.body);
    if (url.endsWith('/projects/action')) { expect(input.baseRevision).toBe(project.revision); project = { ...project, revision: project.revision + 1, creative: input.action.creative }; }
    return { ok: true, json: async () => ({ project }) };
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(); await server.connect(serverSide);
  const client = new Client({ name: 'edit', version: '1' }); await client.connect(clientSide);
  const call = async (name, args) => { const result = await client.callTool({ name, arguments: args }); return JSON.parse(result.content[0].text); };
  try {
    expect(await call('script_get', { path: '/x' })).toMatchObject({ revision: 7, sources: 'Fonte preservada' });
    const args = { path: '/x', baseRevision: 7, operations: [{ op: 'block.update', blockId: 'speech', changes: { text: 'Depois.' } }] };
    expect(await call('script_edit', { ...args, dryRun: true })).toMatchObject({ revision: 7, dryRun: true });
    expect(project.creative.script.chapters[0].blocks[0].text).toBe('Antes.');
    expect(await call('script_edit', args)).toMatchObject({ revision: 8 });
    expect(project.creative.script.chapters[0].blocks.map(block => block.text)).toEqual(['Depois.', 'Som original.']);
    expect(project.creative.script.sources).toBe('Fonte preservada');
    expect(await call('script_edit', args)).toMatchObject({ code: 'REVISION_CONFLICT' });
  } finally { await client.close(); fetcher.mockRestore(); }
});
