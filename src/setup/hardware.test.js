import { expect, test } from 'vitest';
import { detectHardware, planVoiceRuntime, topApps } from './hardware.js';

const GiB = 1024 ** 3;
const meminfo = (total, available) => `MemTotal: ${total * 1024 * 1024} kB\nMemFree: 1 kB\nMemAvailable: ${available * 1024 * 1024} kB\nSwapTotal: 2097148 kB\n`;
function fakeRun(outputs) {
  return async (command, args) => {
    const key = [command, ...args].join(' ');
    const match = Object.keys(outputs).find(prefix => key.startsWith(prefix));
    if (!match) throw Object.assign(new Error('não encontrado'), { code: 'ENOENT' });
    return { stdout: outputs[match] };
  };
}
const profile = (overrides = {}) => ({ platform: 'linux', arch: 'x64', cpu: { model: 'CPU', threads: 12, flags: ['avx2'] }, memory: { totalBytes: 15.5 * GiB, availableBytes: 13 * GiB, swapBytes: 2 * GiB }, gpus: [], memoryGuard: 'systemd', ...overrides });

test('detecta esta máquina: Ryzen AVX2, RX 580 sem ROCm e limite via systemd', async () => {
  const files = { '/proc/meminfo': meminfo(15.5, 13), '/proc/cpuinfo': 'model name\t: AMD Ryzen 5 5500\nflags\t\t: fpu sse avx avx2 fma\n' };
  const run = fakeRun({ 'systemd-run --version': 'systemd 255', lspci: '01:00.0 VGA compatible controller: Advanced Micro Devices, Inc. [AMD/ATI] Polaris 20 XL [Radeon RX 580 2048SP] (rev ef)\n' });
  const hardware = await detectHardware({ run, read: async file => files[file], platform: 'linux', arch: 'x64' });
  expect(hardware).toMatchObject({ memory: { totalBytes: 15.5 * GiB, availableBytes: 13 * GiB, swapBytes: 2147479552 }, cpu: { flags: ['avx2'] }, memoryGuard: 'systemd', gpus: [{ vendor: 'amd', name: 'Radeon RX 580 2048SP', rocm: false }] });
  const plan = planVoiceRuntime(hardware);
  expect(plan).toMatchObject({ status: 'ready', device: 'cpu', torchBuild: 'cpu', threads: 9, estimate: { source: 'referência' } });
  expect(plan.torch.packages).toEqual(['torch==2.15.0', 'torchaudio==2.11.1', 'torchcodec==0.17.0']);
  expect(plan.memoryLimitBytes).toBe(12.5 * GiB);
  expect(plan.warnings.join(' ')).toMatch(/Radeon RX 580 2048SP não tem suporte do ROCm.*bfloat16/);
});

test('detecta NVIDIA com versão CUDA do driver e escolhe a build compatível', async () => {
  const run = fakeRun({ 'nvidia-smi --query-gpu': 'NVIDIA GeForce RTX 4070, 12282, 580.82\n', 'nvidia-smi': '| NVIDIA-SMI 580.82   Driver Version: 580.82   CUDA Version: 13.0 |' });
  const hardware = await detectHardware({ run, read: async () => '', platform: 'linux', arch: 'x64' });
  expect(hardware.gpus[0]).toMatchObject({ vendor: 'nvidia', vramBytes: 12282 * 1024 * 1024, cuda: [13, 0] });
  expect(planVoiceRuntime(hardware)).toMatchObject({ device: 'cuda', torchBuild: 'cu130', estimate: { realtimeFactor: null } });
  expect(planVoiceRuntime(profile({ gpus: [{ vendor: 'nvidia', name: 'RTX 3060', vramBytes: 12 * GiB, cuda: [12, 6] }] }))).toMatchObject({ device: 'cuda', torchBuild: 'cu126' });
});

test('NVIDIA com pouca VRAM ou driver antigo cai para CPU com aviso', () => {
  const small = planVoiceRuntime(profile({ gpus: [{ vendor: 'nvidia', name: 'GTX 1650', vramBytes: 4 * GiB, cuda: [12, 8] }] }));
  expect(small).toMatchObject({ device: 'cpu', torchBuild: 'cpu' });
  expect(small.warnings[0]).toMatch(/GTX 1650 tem 4 GB de VRAM/);
  expect(planVoiceRuntime(profile({ gpus: [{ vendor: 'nvidia', name: 'RTX 2080', vramBytes: 8 * GiB, cuda: [11, 8] }] })).warnings[0]).toMatch(/atualize para CUDA 12.6/);
});

test('AMD com ROCm suportado e Apple Silicon usam GPU (marcados como não validados)', () => {
  expect(planVoiceRuntime(profile({ gpus: [{ vendor: 'amd', name: 'RX 7900 XTX', rocm: true, architectures: ['gfx1100'] }] }))).toMatchObject({ device: 'cuda', torchBuild: 'rocm7.1' });
  const apple = planVoiceRuntime(profile({ platform: 'darwin', arch: 'arm64', memoryGuard: 'none', gpus: [{ vendor: 'apple', name: 'Apple Silicon (MPS)' }] }));
  expect(apple).toMatchObject({ device: 'mps', torchBuild: 'mps' });
  expect(apple.warnings.join(' ')).toMatch(/não validada.*Sem limite rígido/);
});

test('pouca RAM total recusa; RAM total suficiente mas ocupada pede para fechar programas', () => {
  const small = planVoiceRuntime(profile({ memory: { totalBytes: 8 * GiB, availableBytes: 6 * GiB } }));
  expect(small.status).toBe('unsupported');
  expect(small.reasons[0]).toMatch(/necessários cerca de 13 GB de RAM no total; este computador tem 8 GB/);
  const busy = planVoiceRuntime(profile({ memory: { totalBytes: 15.5 * GiB, availableBytes: 7 * GiB } }));
  expect(busy).toMatchObject({ status: 'needs-free-memory', memoryLimitBytes: Math.round(11.5 * GiB) });
  expect(busy.reasons[0]).toMatch(/Feche programas/);
});

test('limite e núcleos acompanham a máquina; estimativa usa a medição quando existe', () => {
  const big = planVoiceRuntime(profile({ cpu: { threads: 32, flags: ['avx2', 'avx512_bf16'] }, memory: { totalBytes: 64 * GiB, availableBytes: 50 * GiB } }));
  expect(big).toMatchObject({ threads: 24, memoryLimitBytes: 49.5 * GiB });
  expect(big.warnings.join(' ')).not.toMatch(/bfloat16/);
  expect(planVoiceRuntime(profile(), { calibration: { device: 'cpu', realtimeFactor: 27.3 } }).estimate).toEqual({ realtimeFactor: 27.3, source: 'medido' });
  expect(planVoiceRuntime(profile(), { calibration: { device: 'cuda', realtimeFactor: 0.4 } }).estimate.source).toBe('referência');
});

test('sugere fechar os programas que mais usam RAM, sem contar o sistema nem o Content Lab', () => {
  const ps = ['2000000 ChatGPT', '1500000 ChatGPT', '2900000 brave', '900000 node', '300000 gnome-shell', '100000 gedit'].join('\n');
  expect(topApps(ps).map(app => app.name)).toEqual(['ChatGPT', 'brave']);
  expect(topApps(ps)[0].bytes).toBe(3500000 * 1024);
  expect(topApps(null)).toEqual([]);
});
