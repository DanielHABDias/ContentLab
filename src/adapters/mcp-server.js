#!/usr/bin/env node
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AgentService } from '../core/agent-service.js';
import { ProjectStore } from '../core/project-store.js';

const root = process.env.CONTENTLAB_DATA_DIR || path.resolve('.contentlab/projects');
const service = new AgentService(new ProjectStore(root));
const server = new McpServer({ name: 'content-lab', version: '2.0.0' });
const reply = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });

server.registerTool('project_inspect', { description: 'Inspeciona um projeto local em formato compacto.', inputSchema: { projectId: z.string() } }, async ({ projectId }) => reply(await service.inspect(projectId)));
server.registerTool('project_create', { description: 'Cria um projeto validado. Não sobrescreve IDs existentes.', inputSchema: { project: z.record(z.string(), z.unknown()) } }, async ({ project }) => reply(await service.create(project)));
server.registerTool('project_run', { description: 'Pré-visualiza ou aplica um lote atômico e idempotente de operações.', inputSchema: { operation: z.record(z.string(), z.unknown()) } }, async ({ operation }) => reply(await service.run(operation)));

await server.connect(new StdioServerTransport());
