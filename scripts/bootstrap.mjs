#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const mode = process.argv[2] || '--check';
const checks = [
  { id: 'node', command: process.execPath, args: ['--version'], required: true, solution: 'Instale Node.js 22 ou superior.' },
  { id: 'ffmpeg', command: 'ffmpeg', args: ['-version'], required: true, solution: 'Instale FFmpeg 6 ou superior pelo gerenciador do sistema.' },
  { id: 'ffprobe', command: 'ffprobe', args: ['-version'], required: true, solution: 'FFprobe deve acompanhar a instalação do FFmpeg.' },
  { id: 'yt-dlp', command: 'yt-dlp', args: ['--version'], required: false, solution: 'Necessário apenas para importar URLs.' },
  { id: 'whisper-large-v3', command: 'whisper-cli', args: ['--help'], required: false, solution: 'Prepare whisper.cpp e os pesos large-v3 para transcrição.' },
  { id: 'chatterbox-pt-br', command: 'contentlab-chatterbox', args: ['--version'], required: false, solution: 'Prepare o ambiente isolado Chatterbox V3 PT-BR para voz por IA.' },
];

const results = [];
for (const check of checks) results.push(await inspect(check));
const requiredMissing = results.filter(item => item.required && !item.ready);
const report = { ready: requiredMissing.length === 0, mode, results };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (mode === '--prepare' && results.some(item => !item.ready && !item.required)) process.stderr.write('Recursos opcionais não foram instalados automaticamente: pesos grandes e binários externos exigem origem/licença verificadas.\n');
if (requiredMissing.length) process.exitCode = 1;

async function inspect(check) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { const { stdout, stderr } = await run(check.command, check.args, { timeout: 10_000, maxBuffer: 1024 * 1024 }); return { id: check.id, ready: true, required: check.required, version: firstLine(stdout || stderr), attempts: attempt }; }
    catch (error) { lastError = error; if (!['ETIMEDOUT', 'EAGAIN', 'EBUSY'].includes(error.code)) break; }
  }
  return { id: check.id, ready: false, required: check.required, error: lastError?.code === 'ENOENT' ? 'não encontrado' : lastError?.message, solution: check.solution };
}
function firstLine(value) { return `${value}`.split(/\r?\n/).find(Boolean)?.slice(0, 180) || 'disponível'; }
