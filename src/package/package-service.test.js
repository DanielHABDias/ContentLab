import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { ZipFile } from 'yazl';
import { createWriteStream } from 'node:fs';
import { PackageService } from './package-service.js';

const roots = []; afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
async function fixture() { const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-package-')); roots.push(root); const source = path.join(root, 'project'); await mkdir(path.join(source, 'assets'), { recursive: true }); await writeFile(path.join(source, 'project.json'), JSON.stringify({ title: 'Demo' })); const duplicate = Buffer.from('conteúdo repetido '.repeat(2000)); await writeFile(path.join(source, 'assets/a.txt'), duplicate); await writeFile(path.join(source, 'assets/b.txt'), duplicate); return { root, source }; }

test('exporta .contentlab deduplicado, inspeciona e restaura íntegro', async () => { const { root, source } = await fixture(); const service = new PackageService(); const output = path.join(root, 'demo.contentlab'); const result = await service.exportContentLab(source, output, { level: 9 }); expect(result.blobs).toBeLessThan(result.files); const inspection = await service.inspect(output); expect(inspection.manifest.schema).toBe('contentlab-package-v1'); const restored = path.join(root, 'restored'); await service.restore(output, restored); expect(await readFile(path.join(restored, 'assets/a.txt'))).toEqual(await readFile(path.join(source, 'assets/a.txt'))); expect(await readFile(path.join(restored, 'assets/b.txt'))).toEqual(await readFile(path.join(source, 'assets/b.txt'))); });

test('exporta ZIP padrão com nível configurável', async () => { const { root, source } = await fixture(); const service = new PackageService(); const result = await service.exportZip(source, path.join(root, 'delivery.zip'), { level: 1 }); expect(result.files).toBe(3); expect(result.size).toBeGreaterThan(100); });

test('rejeita pacote sem manifesto antes de escrever qualquer arquivo', async () => { const { root } = await fixture(); const malicious = path.join(root, 'bad.contentlab'); await new Promise((resolve, reject) => { const output = createWriteStream(malicious); const archive = new ZipFile(); output.on('close', resolve); output.on('error', reject); archive.outputStream.pipe(output); archive.addBuffer(Buffer.from('{}'), 'unexpected.json'); archive.end(); }); const target = path.join(root, 'target'); const service = new PackageService(); await expect(service.restore(malicious, target)).rejects.toThrow(/manifesto/i); await expect(stat(path.join(root, 'escape.json'))).rejects.toMatchObject({ code: 'ENOENT' }); });

test('não sobrescreve arquivos existentes na restauração', async () => { const { root, source } = await fixture(); const service = new PackageService(); const output = path.join(root, 'demo.contentlab'); await service.exportContentLab(source, output); const target = path.join(root, 'target'); await mkdir(target); await writeFile(path.join(target, 'project.json'), 'preservar'); await expect(service.restore(output, target)).rejects.toThrow(); expect(await readFile(path.join(target, 'project.json'), 'utf8')).toBe('preservar'); });
