#!/usr/bin/env node
// Diagnóstico e instalação pelo terminal, usando o mesmo catálogo do assistente.
//   --check            JSON (padrão de `npm run doctor`)
//   --text             diagnóstico legível
//   --install <ids>    instala itens de .tools/; exige --accept após ler origem/licença/tamanho
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SetupService } from '../src/setup/setup-service.js';
import { formatSize } from '../src/setup/downloader.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolsDirectory = process.env.CONTENTLAB_TOOLS_DIR || path.join(repositoryRoot, '.tools');
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--')) || '--check';
const setup = new SetupService({ toolsDirectory });
const status = await setup.status();

if (mode === '--install') {
  const ids = args.filter(arg => !arg.startsWith('--'));
  const items = ids.map(id => status.items.find(item => item.id === id));
  if (!ids.length || items.some(item => !item)) { console.error(`Informe ids válidos: ${status.items.filter(item => item.installable).map(item => item.id).join(', ')}`); process.exit(2); }
  for (const item of items) console.log(`${item.label} ${item.version || ''}\n  origem: ${item.origin}\n  licença: ${item.license}\n  tamanho: ${item.downloadBytes ? formatSize(item.downloadBytes) : 'desconhecido'}\n  destino: ${item.destination}`);
  console.log(`  espaço livre: ${status.freeBytes == null ? 'desconhecido' : formatSize(status.freeBytes)}`);
  if (!args.includes('--accept')) { console.error('\nNada foi baixado. Repita com --accept para confirmar origem, licença e tamanho.'); process.exit(3); }
  const jobs = await setup.install({ ids, consent: ids });
  let failed = false;
  for (const job of jobs) {
    const timer = setInterval(() => { const current = setup.jobs().find(item => item.id === job.id); if (current?.total) process.stderr.write(`\r${current.label}: ${current.phase} ${Math.round(100 * current.received / current.total)}%   `); }, 1000);
    const result = await setup.waitFor(job.id); clearInterval(timer);
    process.stderr.write('\n');
    console.log(`${result.label}: ${result.state === 'completed' ? result.phase : `${result.error} (${result.code})`}`);
    if (result.state !== 'completed') failed = true;
  }
  process.exit(failed ? 1 : 0);
}

const results = status.items.map(item => ({ id: item.id, label: item.label, group: item.group, ready: item.ready, required: item.required, ...(item.detected ? { version: item.detected } : {}), ...(item.ready ? {} : { problem: item.problem, solution: solution(item) }) }));
const report = { ready: status.essentialsReady, mode, platform: status.platform, toolsDirectory: status.toolsDirectory, freeBytes: status.freeBytes, results };

if (mode === '--text') {
  console.log(`Content Lab — diagnóstico (${status.platform.distro}, ${status.platform.os}-${status.platform.arch})`);
  for (const group of ['essential', 'ai']) {
    console.log(`\n${group === 'essential' ? 'Essenciais' : 'Recursos de IA (opcionais)'}`);
    for (const item of results.filter(entry => entry.group === group)) console.log(`  ${item.ready ? '✓' : item.required ? '✗' : '○'} ${item.label}${item.ready ? ` — ${item.version || 'pronto'}` : ` — ${item.problem}. ${item.solution}`}`);
  }
  console.log(`\n${report.ready ? 'Pronto para uso.' : 'Faltam dependências essenciais.'} Ferramentas locais: ${status.toolsDirectory}`);
} else {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
if (!report.ready) process.exitCode = 1;

function solution(item) {
  if (item.installable) return `Instale pelo assistente ou com: npm run doctor -- --install ${item.id} --accept`;
  if (item.systemCommand) return `Instale com: ${item.systemCommand}`;
  if (item.manualSteps) return item.manualSteps;
  return item.reason || 'Instale pelo gerenciador do sistema.';
}
