#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AgentService } from '../core/agent-service.js';
import { ProjectStore } from '../core/project-store.js';
import { PackageService } from '../package/package-service.js';

const [command, argument] = process.argv.slice(2);
const root = process.env.CONTENTLAB_DATA_DIR || path.resolve('.contentlab/projects');
const service = new AgentService(new ProjectStore(root));
const packages = new PackageService();

async function input() {
  if (!argument) throw new Error('Informe um ID de projeto ou arquivo JSON');
  return JSON.parse(await readFile(path.resolve(argument), 'utf8'));
}

try {
  let result;
  if (command === 'project.create') result = await service.create(await input());
  else if (command === 'project.inspect') result = await service.inspect(argument);
  else if (command === 'project.run') result = await service.run(await input());
  else if (command === 'package.export') { const request = await input(); result = request.format === 'zip' ? await packages.exportZip(request.source, request.output, { level: request.level }) : await packages.exportContentLab(request.source, request.output, { level: request.level }); }
  else if (command === 'package.inspect') result = await packages.inspect(argument);
  else if (command === 'package.restore') { const request = await input(); result = await packages.restore(request.packagePath, request.destination); }
  else throw new Error('Comando inválido. Use project.create, project.inspect, project.run ou package.*');
  process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
} catch (error) {
  process.stderr.write(`Content Lab: ${error.message}\n`);
  process.stdout.write(`${JSON.stringify({ ok: false, error: { code: error.code || 'CONTENTLAB_ERROR', message: error.message, ...(error.details ? { details: error.details } : {}) } })}\n`);
  process.exitCode = 1;
}
