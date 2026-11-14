import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ProductionOperations } from './production-operations.js';

test('lista prévias, renders e thumbnails, serve só arquivos de output e abre as pastas', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cl-outputs-'));
  await mkdir(path.join(root, 'output', 'previas'), { recursive: true }); await mkdir(path.join(root, 'output', 'thumbnails'));
  await writeFile(path.join(root, 'output', 'previas', 'previa-00105.png'), 'png'); await writeFile(path.join(root, 'output', 'video-r1.mp4'), 'mp4');
  await writeFile(path.join(root, 'output', 'thumbnails', 'thumbnail-A.png'), 'png'); await writeFile(path.join(root, 'segredo.json'), '{}');
  const revealed = [];
  const ops = Object.create(ProductionOperations.prototype); ops.app = { opener: { reveal: async target => revealed.push(target) } };
  const outputs = await ops.outputs({ path: root });
  expect(outputs.previews).toMatchObject([{ name: path.join('previas', 'previa-00105.png'), second: 10.5 }]);
  expect(outputs.renders.map(item => item.name)).toEqual(['video-r1.mp4']);
  expect(outputs.thumbnails.map(item => item.name)).toEqual([path.join('thumbnails', 'thumbnail-A.png')]);
  expect(await ops.outputFile({ path: root, name: 'video-r1.mp4' })).toMatchObject({ contentType: 'video/mp4', size: 3 });
  await expect(ops.outputFile({ path: root, name: '../segredo.json' })).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' });
  await ops.revealOutput({ path: root, folder: 'thumbnails' });
  expect(revealed).toEqual([path.join(root, 'output', 'thumbnails')]);
  await expect(ops.revealOutput({ path: root, folder: 'entrega' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
