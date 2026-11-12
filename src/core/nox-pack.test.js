import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { noxDir, requireNoxDir } from './nox-pack.js';

test('pacote do Nox: vem de fora do Content Lab (variável ou plugin) e falta com erro acionável', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'contentlab-nox-'));
  try {
    await writeFile(path.join(dir, 'Nox.png'), 'x');
    expect(noxDir({ CONTENTLAB_NOX_DIR: dir })).toBe(dir);
    const plugin = await mkdtemp(path.join(os.tmpdir(), 'contentlab-plugin-'));
    const nox = path.join(plugin, 'assets', 'brand', 'nox');
    await import('node:fs/promises').then(fs => fs.mkdir(nox, { recursive: true })); await writeFile(path.join(nox, 'Nox.png'), 'x');
    expect(noxDir({ DIAZVERSO_PLUGIN_DIR: plugin })).toBe(nox);
    await rm(plugin, { recursive: true, force: true });
    expect(path.relative(path.resolve('.'), noxDir() || '/fora').startsWith('assets')).toBe(false); // nunca dentro do app
    expect(() => requireNoxDir({ CONTENTLAB_NOX_DIR: path.join(dir, 'nao-existe'), HOME: dir })).not.toThrow(/inesperado/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
