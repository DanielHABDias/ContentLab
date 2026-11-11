#!/usr/bin/env node
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AgentService } from '../core/agent-service.js';
import { ProjectStore } from '../core/project-store.js';
import { PackageService } from '../package/package-service.js';

const root = process.env.CONTENTLAB_DATA_DIR || path.resolve('.contentlab/projects');
const service = new AgentService(new ProjectStore(root));
const packages = new PackageService();
const server = new McpServer({ name: 'content-lab', version: '2.0.0' });
const reply = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });

server.registerTool('project_inspect', { description: 'Inspeciona um projeto local em formato compacto.', inputSchema: { projectId: z.string() } }, async ({ projectId }) => reply(await service.inspect(projectId)));
server.registerTool('project_create', { description: 'Cria um projeto validado. Não sobrescreve IDs existentes.', inputSchema: { project: z.record(z.string(), z.unknown()) } }, async ({ project }) => reply(await service.create(project)));
server.registerTool('project_run', { description: 'Pré-visualiza ou aplica um lote atômico e idempotente de operações.', inputSchema: { operation: z.record(z.string(), z.unknown()) } }, async ({ operation }) => reply(await service.run(operation)));
server.registerTool('package_export', { description: 'Exporta um diretório como .contentlab deduplicado ou ZIP padrão.', inputSchema: { source: z.string(), output: z.string(), format: z.enum(['contentlab', 'zip']).default('contentlab'), level: z.number().int().min(0).max(9).default(6) } }, async ({ source, output, format, level }) => reply(format === 'zip' ? await packages.exportZip(source, output, { level }) : await packages.exportContentLab(source, output, { level })));
server.registerTool('package_inspect', { description: 'Valida e resume o manifesto de um pacote .contentlab.', inputSchema: { packagePath: z.string() } }, async ({ packagePath }) => reply(await packages.inspect(packagePath)));
server.registerTool('package_restore', { description: 'Restaura com segurança um pacote .contentlab sem sobrescrever arquivos.', inputSchema: { packagePath: z.string(), destination: z.string() } }, async ({ packagePath, destination }) => reply(await packages.restore(packagePath, destination)));

await server.connect(new StdioServerTransport());
