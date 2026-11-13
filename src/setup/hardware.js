import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';

import { PROTECTED_PROCESSES } from '../system/apps.js';

const execFileAsync = promisify(execFile);
const GiB = 1024 ** 3;

/**
 * Requisitos do VoxCPM2. CPU: pico medido em 2026-11-11 (bf16, 8 threads,
 * Ryzen 12 threads AVX2) foi 11,1 GB e ~28,6 s por segundo de áudio. GPU:
 * ~8 GB de VRAM segundo o cartão do modelo (não validado neste projeto).
 */
export const VOXCPM2_REQUIREMENTS = {
  cpu: { memoryBytes: Math.round(11.5 * GiB), referenceRealtimeFactor: 28.6, referenceThreads: 8 },
  gpu: { vramBytes: 8 * GiB, hostMemoryBytes: 6 * GiB },
};

/** Builds do PyTorch. Só a de CPU foi validada com o VoxCPM2 neste projeto. */
export const TORCH_BUILDS = {
  cpu: { index: 'https://download.pytorch.org/whl/cpu', packages: ['torch==2.15.0', 'torchaudio==2.11.1', 'torchcodec==0.17.0'], validated: true },
  cu130: { index: 'https://download.pytorch.org/whl/cu130', packages: ['torch', 'torchaudio', 'torchcodec'], validated: false, minimumCuda: [13, 0] },
  cu128: { index: 'https://download.pytorch.org/whl/cu128', packages: ['torch', 'torchaudio', 'torchcodec'], validated: false, minimumCuda: [12, 8] },
  cu126: { index: 'https://download.pytorch.org/whl/cu126', packages: ['torch', 'torchaudio', 'torchcodec'], validated: false, minimumCuda: [12, 6] },
  'rocm7.1': { index: 'https://download.pytorch.org/whl/rocm7.1', packages: ['torch', 'torchaudio', 'torchcodec'], validated: false },
  mps: { index: null, packages: ['torch', 'torchaudio', 'torchcodec'], validated: false },
};

/** Arquiteturas AMD com suporte oficial do ROCm 7.x (Polaris/gfx803 não está aqui). */
const ROCM_ARCHITECTURES = ['gfx908', 'gfx90a', 'gfx942', 'gfx950', 'gfx1030', 'gfx1100', 'gfx1101', 'gfx1102', 'gfx1150', 'gfx1151', 'gfx1200', 'gfx1201'];

async function tryRun(run, command, args) {
  try { const { stdout } = await run(command, args, { timeout: 8_000, maxBuffer: 2 * 1024 * 1024 }); return `${stdout}`; } catch { return null; }
}

const defaultRun = async (command, args, options) => { const { stdout } = await execFileAsync(command, args, options); return { stdout }; };

/** Lê o hardware relevante para modelos de IA locais. Nada é instalado ou alterado. */
export async function detectHardware({ run = defaultRun, read = file => readFile(file, 'utf8'), platform = process.platform, arch = process.arch } = {}) {
  const profile = {
    platform, arch,
    cpu: { model: os.cpus()[0]?.model?.trim() || 'desconhecido', threads: typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length, flags: [] },
    memory: { totalBytes: os.totalmem(), availableBytes: os.freemem(), swapBytes: null },
    gpus: [],
    memoryGuard: 'none',
  };
  if (platform === 'linux') {
    const meminfo = await read('/proc/meminfo').catch(() => '');
    const kb = key => { const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+) kB`, 'm')); return match ? Number(match[1]) * 1024 : null; };
    profile.memory = { totalBytes: kb('MemTotal') ?? profile.memory.totalBytes, availableBytes: kb('MemAvailable') ?? profile.memory.availableBytes, swapBytes: kb('SwapTotal') };
    const cpuinfo = await read('/proc/cpuinfo').catch(() => '');
    const flags = cpuinfo.match(/^flags\s*:\s*(.*)$/m)?.[1].split(/\s+/) || [];
    profile.cpu.flags = ['avx2', 'avx512f', 'avx512_bf16', 'amx_bf16'].filter(flag => flags.includes(flag));
    if (await tryRun(run, 'systemd-run', ['--version'])) profile.memoryGuard = 'systemd';
  }
  if (platform === 'linux' || platform === 'darwin') profile.memory.topApps = topApps(await tryRun(run, 'ps', ['-eo', 'rss=,comm=']));
  const nvidia = await tryRun(run, 'nvidia-smi', ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits']);
  if (nvidia) {
    const header = await tryRun(run, 'nvidia-smi', []);
    const cuda = header?.match(/CUDA Version:\s*(\d+)\.(\d+)/);
    for (const line of nvidia.trim().split(/\r?\n/).filter(Boolean)) {
      const [name, memory, driver] = line.split(',').map(value => value.trim());
      profile.gpus.push({ vendor: 'nvidia', name, vramBytes: Number(memory) * 1024 * 1024, driver, cuda: cuda ? [Number(cuda[1]), Number(cuda[2])] : null });
    }
  }
  if (platform === 'linux') {
    const rocminfo = await tryRun(run, 'rocminfo', []);
    const architectures = [...new Set(rocminfo?.match(/gfx[0-9a-f]+/g) || [])];
    const lspci = await tryRun(run, 'lspci', []);
    for (const line of (lspci || '').split(/\r?\n/).filter(entry => /VGA|3D|Display/.test(entry) && /AMD|ATI/.test(entry))) {
      profile.gpus.push({ vendor: 'amd', name: [...line.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]).filter(value => !/AMD\/ATI/.test(value)).at(-1) || line.split(': ').at(-1), rocm: architectures.length > 0, architectures });
    }
  }
  if (platform === 'darwin' && arch === 'arm64') profile.gpus.push({ vendor: 'apple', name: 'Apple Silicon (MPS)', unifiedMemory: true });
  return profile;
}

/**
 * Decide onde e com quais limites o VoxCPM2 roda. Resultado:
 * - status `ready`: pode gerar agora;
 * - `needs-free-memory`: o computador comporta, mas falta RAM livre agora;
 * - `unsupported`: o computador não comporta (motivo em `reasons`).
 */
export function planVoiceRuntime(profile, { calibration = null, requirements = VOXCPM2_REQUIREMENTS } = {}) {
  const reasons = []; const warnings = [];
  const total = profile.memory.totalBytes; const available = profile.memory.availableBytes;
  const reserve = Math.max(1.5 * GiB, total * 0.1);
  const threads = Math.max(1, profile.cpu.threads - Math.max(2, Math.round(profile.cpu.threads / 4)));
  let device = 'cpu'; let build = 'cpu'; let needed = requirements.cpu.memoryBytes;

  const nvidia = profile.gpus.filter(gpu => gpu.vendor === 'nvidia').sort((a, b) => b.vramBytes - a.vramBytes)[0];
  const amd = profile.gpus.find(gpu => gpu.vendor === 'amd');
  const apple = profile.gpus.find(gpu => gpu.vendor === 'apple');
  if (nvidia) {
    const cudaBuild = ['cu130', 'cu128', 'cu126'].find(key => nvidia.cuda && compare(nvidia.cuda, TORCH_BUILDS[key].minimumCuda) >= 0);
    if (nvidia.vramBytes < requirements.gpu.vramBytes) warnings.push(`${nvidia.name} tem ${gb(nvidia.vramBytes)} de VRAM; o VoxCPM2 pede cerca de ${gb(requirements.gpu.vramBytes)}. Usando CPU.`);
    else if (!cudaBuild) warnings.push(`Driver NVIDIA com CUDA ${nvidia.cuda?.join('.') || 'desconhecido'}; atualize para CUDA 12.6+ para usar a GPU. Usando CPU.`);
    else { device = 'cuda'; build = cudaBuild; needed = requirements.gpu.hostMemoryBytes; }
  } else if (amd) {
    const supported = amd.architectures?.find(name => ROCM_ARCHITECTURES.includes(name));
    if (supported) { device = 'cuda'; build = 'rocm7.1'; needed = requirements.gpu.hostMemoryBytes; warnings.push(`GPU AMD ${supported} via ROCm (não validado neste projeto).`); }
    else warnings.push(`${amd.name} não tem suporte do ROCm${amd.architectures?.length ? ` (${amd.architectures.join(', ')})` : ''}. Usando CPU.`);
  } else if (apple) { device = 'mps'; build = 'mps'; needed = requirements.gpu.hostMemoryBytes; }

  if (device === 'cpu') {
    if (!profile.cpu.flags.includes('avx2') && profile.platform === 'linux') warnings.push('Processador sem AVX2: a geração em CPU será muito lenta.');
    if (!profile.cpu.flags.includes('avx512_bf16') && !profile.cpu.flags.includes('amx_bf16')) warnings.push('Sem aceleração bfloat16 no processador: a voz leva vários segundos por segundo de áudio.');
  }
  if (!TORCH_BUILDS[build].validated) warnings.push(`Build PyTorch ${build} ainda não validada com o VoxCPM2 neste projeto.`);
  if (profile.memoryGuard !== 'systemd') warnings.push('Sem limite rígido de memória neste sistema: feche outros programas antes de gerar.');

  const ceiling = total - reserve;
  let status = 'ready';
  if (ceiling < needed) { status = 'unsupported'; reasons.push(`São necessários cerca de ${gb(needed + reserve)} de RAM no total; este computador tem ${gb(total)}.`); }
  else if (available < needed) {
    status = 'needs-free-memory';
    const apps = (profile.memory.topApps || []).map(app => `${app.name} (${gb(app.bytes)})`);
    reasons.push(`Feche programas: a geração precisa de ${gb(needed)} livres e há ${gb(available)} agora.${apps.length ? ` Os que mais usam memória agora: ${apps.join(', ')}.` : ''}`);
  }

  const memoryLimitBytes = Math.min(ceiling, Math.max(needed, Math.min(available - 0.5 * GiB, ceiling)));
  const measured = calibration?.device === device && calibration?.realtimeFactor > 0 ? calibration : null;
  const estimate = measured
    ? { realtimeFactor: measured.realtimeFactor, source: 'medido' }
    : device === 'cpu'
      ? { realtimeFactor: round(requirements.cpu.referenceRealtimeFactor * (requirements.cpu.referenceThreads / threads)), source: 'referência' }
      : { realtimeFactor: null, source: 'desconhecido até a primeira geração' };
  return { engine: 'voxcpm2', status, device, torchBuild: build, torch: TORCH_BUILDS[build], threads, memoryLimitBytes: Math.round(memoryLimitBytes), memoryGuard: profile.memoryGuard, requiredBytes: needed, availableBytes: available, estimate, reasons, warnings };
}


/** Programas que mais ocupam RAM agora (somando processos de mesmo nome), a partir de `ps`. */
export function topApps(output, limit = 3) {
  if (!output) return [];
  const totals = new Map();
  for (const line of String(output.stdout ?? output).split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const name = match[2].split('/').pop().trim();
    if (PROTECTED_PROCESSES.test(name)) continue;
    totals.set(name, (totals.get(name) || 0) + Number(match[1]) * 1024);
  }
  return [...totals].map(([name, bytes]) => ({ name, bytes })).filter(app => app.bytes >= 300 * 1024 ** 2).sort((a, b) => b.bytes - a.bytes).slice(0, limit);
}

function compare(a, b) { return a[0] - b[0] || a[1] - b[1]; }
function round(value) { return Math.round(value * 10) / 10; }
export function gb(bytes) { return `${(bytes / GiB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`; }
