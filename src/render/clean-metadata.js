import { execFile } from 'node:child_process';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Último passo de todo vídeo final: copia áudio e vídeo sem recodificar e tira os metadados.
 * - etiquetas do contêiner (encoder, comment "Made with…", datas) e capítulos embutidos;
 * - a assinatura do encoder dentro do H.264 (SEI do x264 com versão e opções);
 * - moov no início (faststart), como o YouTube recomenda para envio.
 * Imagem e som ficam idênticos (cópia de stream).
 */
export async function cleanMetadata({ ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' }, input, output) {
  const target = path.resolve(output);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.clean.mp4`;
  const probe = await run(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', input]).then(r => r.stdout.trim()).catch(() => '');
  const sei = probe === 'h264' ? ['-bsf:v', 'filter_units=remove_types=6'] : [];
  try {
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0', '-c', 'copy', ...sei, '-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-movflags', '+faststart', temporary], { maxBuffer: 16 * 1024 * 1024 });
    await rename(temporary, target);
  } catch (error) { await rm(temporary, { force: true }); throw Object.assign(new Error(`Limpeza de metadados falhou: ${String(error.stderr || error.message).split('\n')[0]}`), { code: 'METADATA_CLEAN_FAILED' }); }
  return target;
}
