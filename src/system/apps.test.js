import { expect, test } from 'vitest';
import { AppsService, groupProcesses } from './apps.js';

const PS = ['101 2000000 ChatGPT', '102 1500000 ChatGPT', '201 2900000 brave', '301 900000 node', '302 300000 gnome-shell', '401 400000 claude', '501 100000 gedit'].join('\n');

test('agrupa por programa e esconde sistema, Content Lab e Claude Code', () => {
  const groups = groupProcesses(PS);
  expect(groups.map(app => app.name)).toEqual(['ChatGPT', 'brave', 'gedit']);
  expect(groups[0]).toMatchObject({ bytes: 3500000 * 1024, pids: [101, 102], kind: 'app' });
  expect(groups[1].kind).toBe('browser');
});

function fakeService(initial) {
  let output = initial; const killed = [];
  const service = new AppsService({ platform: 'linux', uid: 1000, sleep: async () => {}, run: async () => ({ stdout: output }), kill: (pid, signal) => { killed.push([pid, signal]); output = output.split('\n').filter(line => !line.startsWith(`${pid} `)).join('\n'); } });
  return { service, killed };
}

test('lista só programas grandes e fecha com SIGTERM; força com SIGKILL', async () => {
  const { service, killed } = fakeService(PS);
  expect((await service.list()).apps.map(app => app.name)).toEqual(['ChatGPT', 'brave']);
  expect(await service.close({ name: 'ChatGPT' })).toMatchObject({ closed: true, freedBytes: 3500000 * 1024, remaining: 0 });
  expect(killed).toEqual([[101, 'SIGTERM'], [102, 'SIGTERM']]);
  await service.close({ name: 'brave', force: true });
  expect(killed.at(-1)).toEqual([201, 'SIGKILL']);
});

test('recusa programas protegidos e plataformas sem suporte', async () => {
  const { service, killed } = fakeService(PS);
  await expect(service.close({ name: 'node' })).rejects.toMatchObject({ code: 'APP_PROTECTED' });
  await expect(service.close({ name: 'claude' })).rejects.toMatchObject({ code: 'APP_PROTECTED' });
  expect(killed).toEqual([]);
  await expect(new AppsService({ platform: 'win32' }).close({ name: 'x' })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
});

test('programa que não responde fica marcado como aberto', async () => {
  const service = new AppsService({ platform: 'linux', uid: 1000, sleep: async () => {}, run: async () => ({ stdout: PS }), kill: () => {} });
  expect(await service.close({ name: 'ChatGPT' })).toMatchObject({ closed: false, remaining: 2 });
});
