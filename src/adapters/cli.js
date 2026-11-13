#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AgentService } from '../core/agent-service.js';
import { ProjectStore } from '../core/project-store.js';
import { PackageService } from '../package/package-service.js';
import { readCharacterPack } from '../core/character-pack.js';

const [command, argument] = process.argv.slice(2);
const root = process.env.CONTENTLAB_DATA_DIR || path.resolve('.contentlab/projects');
const service = new AgentService(new ProjectStore(root));
const packages = new PackageService();

/** Chama a API local do app aberto (porta CONTENTLAB_PORT, padrão 4173). */
async function appApi(route, body) {
  const port = Number(process.env.CONTENTLAB_PORT || 4173);
  const response = await fetch(`http://127.0.0.1:${port}/api/v1${route}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-contentlab-client': '1' }, body: JSON.stringify(body) }).catch(() => null);
  if (!response) throw Object.assign(new Error('O Content Lab não está aberto: rode npm run app'), { code: 'APP_OFFLINE' });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(value.error || `Falha ${response.status}`), { code: value.code || 'CONTENTLAB_ERROR', details: value.details });
  return value;
}

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
  // Personagem: inspect valida a pasta sem o app; import usa o app aberto (o mesmo núcleo da interface e do MCP).
  else if (command === 'character.inspect') { const pack = await readCharacterPack(argument); result = { name: pack.name, poses: Object.keys(pack.poses).length, files: pack.files.map(item => item.file), ignored: pack.ignored }; }
  else if (command === 'character.import') result = await appApi('/character/import', await input());
  // Memória: lista os programas que mais usam RAM e fecha um pelo nome ({"name":"ChatGPT","force":false}).
  else if (command === 'system.apps') result = await appApi('/system/apps', {});
  else if (command === 'system.close-app') result = await appApi('/system/close-app', await input());
  else if (command === 'package.restore') { const request = await input(); result = await packages.restore(request.packagePath, request.destination); }
  else throw new Error('Comando inválido. Use project.create, project.inspect, project.run, character.inspect, character.import, system.apps, system.close-app ou package.*');
  process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
} catch (error) {
  process.stderr.write(`Content Lab: ${error.message}\n`);
  process.stdout.write(`${JSON.stringify({ ok: false, error: { code: error.code || 'CONTENTLAB_ERROR', message: error.message, ...(error.details ? { details: error.details } : {}) } })}\n`);
  process.exitCode = 1;
}
