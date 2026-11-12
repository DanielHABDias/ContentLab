import { expect, test, vi } from 'vitest';
import { NativeDialog } from './native-dialog.js';

const fake = stdout => vi.fn(async () => ({ stdout }));

test('linux usa zenity com filtro e separa seleção múltipla', async () => {
  const execute = fake('/a.mp4\n/b.wav\n');
  const dialog = new NativeDialog({ execute, platform: 'linux' });
  expect(await dialog.chooseMedia({ multiple: true })).toBe('/a.mp4\n/b.wav');
  const [command, args] = execute.mock.calls[0];
  expect(command).toBe('zenity');
  expect(args).toEqual(expect.arrayContaining(['--multiple', expect.stringMatching(/^--file-filter=Mídias \| \*\.mp4/)]));
});

test('windows usa PowerShell STA sem shell e escapa aspas do título', async () => {
  const execute = fake('C:\\Users\\x\\Vídeos\r\n');
  const dialog = new NativeDialog({ execute, platform: 'win32' });
  expect(await dialog.chooseDirectory({ title: "Pasta d'água" })).toBe('C:\\Users\\x\\Vídeos');
  const [command, args, options] = execute.mock.calls[0];
  expect(command).toBe('powershell');
  expect(args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-STA']);
  expect(args[4]).toContain("'Pasta d''água'");
  expect(options.windowsHide).toBe(true);
  await dialog.choosePackage();
  expect(execute.mock.calls[1][1][4]).toContain("'Pacotes Content Lab|*.contentlab;*.zip'");
});

test('macOS usa AppleScript e trata cancelamento como null', async () => {
  const execute = vi.fn(async () => { throw Object.assign(new Error('execution error: User canceled. (-128)'), { code: 1 }); });
  const dialog = new NativeDialog({ execute, platform: 'darwin' });
  expect(await dialog.chooseMedia({ multiple: true })).toBeNull();
  const [command, args] = execute.mock.calls[0];
  expect(command).toBe('osascript');
  expect(args[1]).toContain('with multiple selections allowed');
  expect(args[1]).toContain('of type {"mp4"');
});

test('sistema sem seletor explica alternativa e ferramenta ausente vira mensagem acionável', async () => {
  const other = new NativeDialog({ execute: fake(''), platform: 'freebsd' });
  expect(other.support()).toMatchObject({ available: false });
  await expect(other.chooseDirectory()).rejects.toThrow(/digite o caminho/);
  const missing = new NativeDialog({ execute: vi.fn(async () => { throw Object.assign(new Error('spawn'), { code: 'ENOENT' }); }), platform: 'linux' });
  await expect(missing.chooseDirectory()).rejects.toThrow('instale zenity');
});
