import { expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './mcp-server.js';

test('MCP expõe o fluxo completo e explica quando o app está fechado', async () => {
  process.env.CONTENTLAB_PORT = '1';
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(); await server.connect(serverSide);
  const client = new Client({ name: 't', version: '1' }); await client.connect(clientSide);
  const names = (await client.listTools()).tools.map(tool => tool.name);
  for (const name of ['contentlab_start', 'contentlab_stop', 'project_create', 'project_flow_set', 'creative_write', 'stage_wait_decision', 'stage_approve', 'media_generate_slides', 'narration_generate', 'narration_assemble', 'timeline_auto_assemble', 'thumbnails_generate', 'render_start', 'job_wait', 'deliverable_build', 'project_export']) expect(names).toContain(name);
  expect(client.getInstructions()).toMatch(/stage_wait_decision/);
  expect(client.getInstructions()).toMatch(/pauseAt/);
  const status = await client.callTool({ name: 'contentlab_status', arguments: {} });
  expect(JSON.parse(status.content[0].text)).toMatchObject({ running: false });
  const offline = await client.callTool({ name: 'project_get', arguments: { path: '/x' } });
  expect(offline.isError).toBe(true); expect(JSON.parse(offline.content[0].text).code).toBe('APP_OFFLINE');
  const cloned = await client.callTool({ name: 'narration_generate', arguments: { path: '/x', engine: 'cloned' } });
  expect(JSON.parse(cloned.content[0].text).code).toBe('PROFILE_REQUIRED');
  await client.close();
});
