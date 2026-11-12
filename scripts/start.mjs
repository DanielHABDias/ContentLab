#!/usr/bin/env node
// Abre o Content Lab com um comando: compila a interface se preciso, sobe o servidor
// (interface + API no mesmo processo) em segundo plano, abre o navegador e libera o terminal.
// Para desligar: botão "Desligar" no app, ou `npm run app:stop`.
//   npm run app            [--no-browser] [--rebuild]
//   npm run app:stop       [--force]   (interrompe trabalho em andamento)
//   npm run app:status
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, open, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = ['stop', 'status'].find(name => args.includes(name)) || 'start';
const port = Number(process.env.CONTENTLAB_PORT || 4173);
const url = `http://127.0.0.1:${port}/`;
const dataDirectory = process.env.CONTENTLAB_DATA_DIR || path.join(root, '.contentlab');
const pidFile = path.join(dataDirectory, 'contentlab.pid');
const logFile = path.join(dataDirectory, 'logs', 'server.log');
const headers = { 'content-type': 'application/json', 'x-contentlab-client': '1' };

const running = async () => { try { return (await fetch(`${url}api/v1/health`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const openBrowser = () => { const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'; try { spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref(); } catch { /* sem navegador padrão */ } };

async function newestMtime(directory) {
  let newest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, await newestMtime(full));
    else if (/\.(jsx?|css|html)$/.test(entry.name) && !/\.test\./.test(entry.name)) newest = Math.max(newest, (await stat(full)).mtimeMs);
  }
  return newest;
}

async function needsBuild() {
  if (args.includes('--rebuild')) return true;
  try { const built = (await stat(path.join(root, 'dist', 'index.html'))).mtimeMs; return Math.max(await newestMtime(path.join(root, 'src', 'ui')), (await stat(path.join(root, 'src', 'main.jsx'))).mtimeMs, (await stat(path.join(root, 'index.html'))).mtimeMs) > built; }
  catch { return true; }
}

if (command === 'status') {
  console.log(await running() ? `Content Lab aberto em ${url}` : 'Content Lab está desligado.');
} else if (command === 'stop') {
  if (!(await running())) { console.log('Content Lab já está desligado.'); await rm(pidFile, { force: true }); process.exit(0); }
  const response = await fetch(`${url}api/v1/server/shutdown`, { method: 'POST', headers, body: JSON.stringify({ force: args.includes('--force') }) });
  const value = await response.json().catch(() => ({}));
  if (response.status === 409) { console.log(`Há trabalho em andamento:\n${value.details.work.map(item => `  • ${item.label}${item.resumes ? ' (continua ao abrir de novo)' : ''}`).join('\n')}\nUse "npm run app:stop -- --force" para interromper e desligar.`); process.exit(3); }
  for (let attempt = 0; attempt < 40 && await running(); attempt += 1) await sleep(250);
  console.log(await running() ? 'O servidor não respondeu ao desligamento.' : 'Content Lab desligado.');
} else {
  if (await running()) { console.log(`Content Lab já está aberto: ${url}`); if (!args.includes('--no-browser')) openBrowser(); process.exit(0); }
  if (await needsBuild()) { console.log('Compilando a interface…'); execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--silent'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] }); }
  await mkdir(path.dirname(logFile), { recursive: true });
  const log = await open(logFile, 'a');
  await log.write(`\n--- ${new Date().toISOString()} iniciando ---\n`);
  const child = spawn(process.execPath, [path.join(root, 'src', 'server', 'http-server.js')], { cwd: root, detached: true, stdio: ['ignore', log.fd, log.fd], env: { ...process.env, CONTENTLAB_PORT: String(port), CONTENTLAB_PID_FILE: pidFile }, windowsHide: true });
  child.unref(); await log.close();
  let ready = false;
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) { await sleep(250); ready = await running(); if (child.exitCode != null) break; }
  if (!ready) { console.error(`O servidor não abriu. Últimas linhas de ${logFile}:\n${(await readFile(logFile, 'utf8')).trim().split('\n').slice(-6).join('\n')}`); process.exit(1); }
  console.log(`Content Lab aberto em ${url}\nPode fechar este terminal. Para desligar: botão "Desligar" no app ou "npm run app:stop".\nLog: ${path.relative(root, logFile)}`);
  if (!args.includes('--no-browser')) openBrowser();
}
