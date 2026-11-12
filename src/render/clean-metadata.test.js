import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { cleanMetadata } from './clean-metadata.js';

const tags = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', file], { encoding: 'utf8' })).format.tags || {};
const md5 = file => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v', '-f', 'md5', '-'], { encoding: 'utf8' }).trim();

test('vídeo final sai sem metadados (etiquetas, capítulos e assinatura do x264) e com a imagem idêntica', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'contentlab-meta-test-'));
  try {
    const input = path.join(dir, 'in.mp4'); const output = path.join(dir, 'out.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=10:duration=1', '-f', 'lavfi', '-i', 'sine=duration=1', '-c:v', 'libx264', '-c:a', 'aac', '-metadata', 'comment=Made with Remotion', '-metadata', 'title=segredo', '-shortest', input]);
    expect(tags(input).comment).toBe('Made with Remotion');
    await cleanMetadata({}, input, output);
    const after = tags(output);
    expect(after.comment).toBeUndefined(); expect(after.title).toBeUndefined(); expect(after.encoder).toBeUndefined();
    expect((await readFile(output)).includes('x264 - core')).toBe(false);
    expect(md5(output)).toBe(md5(input));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
