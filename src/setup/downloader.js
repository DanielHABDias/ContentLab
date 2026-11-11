import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, open, rename, rm, stat, statfs } from 'node:fs/promises';
import path from 'node:path';

export class SetupError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; this.details = details; }
}

const SPACE_MARGIN = 64 * 1024 * 1024;

/**
 * Baixa um arquivo verificado. Nunca expõe arquivo parcial como instalado:
 * grava em `<destino>.partial`, retoma com Range, confere tamanho e SHA-256 e
 * só então promove com rename atômico. Cancelamento preserva o parcial para
 * retomada; checksum incorreto apaga o parcial.
 */
export async function downloadVerified({ url, destination, sha256, size, executable = false, signal, onProgress = () => {}, fetchImpl = fetch, statfsImpl = statfs, allowHttpHosts = [] }) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && allowHttpHosts.includes(parsed.hostname))) throw new SetupError('INSECURE_URL', 'Somente downloads HTTPS são permitidos');
  if (!/^[a-f0-9]{64}$/.test(sha256 || '') || !Number.isInteger(size) || size <= 0) throw new SetupError('INVALID_ARTIFACT', 'Artefato sem tamanho e SHA-256 fixados');
  const target = path.resolve(destination);
  const partial = `${target}.partial`;
  await mkdir(path.dirname(target), { recursive: true });

  if (await verifiedFile(target, size, sha256)) return { status: 'already-installed', path: target, size };

  let offset = await stat(partial).then(info => info.size, () => 0);
  if (offset > size) { await rm(partial, { force: true }); offset = 0; }

  const fsInfo = await statfsImpl(path.dirname(target));
  const available = Number(fsInfo.bavail) * Number(fsInfo.bsize);
  const needed = size - offset + SPACE_MARGIN;
  if (available < needed) throw new SetupError('INSUFFICIENT_SPACE', `Espaço insuficiente: são necessários ${formatSize(needed)} e há ${formatSize(available)} livres em ${path.dirname(target)}`, { needed, available });

  const hash = createHash('sha256');
  if (offset) await hashInto(partial, hash);

  if (offset < size) {
    let response;
    try { response = await fetchImpl(url, { headers: offset ? { range: `bytes=${offset}-` } : {}, signal, redirect: 'follow' }); }
    catch (error) { throw networkOrCancel(error, signal, offset); }
    if (offset && response.status === 200) {
      // Servidor ignorou o Range: recomeça do zero em vez de concatenar dados errados.
      await response.body?.cancel().catch(() => {});
      await rm(partial, { force: true });
      return await downloadVerified({ url, destination, sha256, size, executable, signal, onProgress, fetchImpl, statfsImpl, allowHttpHosts });
    }
    if (!(response.status === 200 || response.status === 206)) throw new SetupError('NETWORK', `Download recusado pelo servidor (HTTP ${response.status})`, { resumable: offset > 0, received: offset });
    const handle = await open(partial, offset ? 'a' : 'w', 0o600);
    let received = offset;
    try {
      for await (const chunk of response.body) {
        received += chunk.length;
        if (received > size) throw new SetupError('SIZE_MISMATCH', 'O servidor enviou mais dados que o tamanho fixado');
        hash.update(chunk);
        await handle.write(chunk);
        onProgress({ received, total: size });
      }
      await handle.sync();
    } catch (error) {
      await handle.close();
      if (error instanceof SetupError) { await rm(partial, { force: true }); throw error; }
      throw networkOrCancel(error, signal, received);
    }
    await handle.close();
    if (received < size) throw new SetupError('NETWORK', `Conexão interrompida em ${formatSize(received)} de ${formatSize(size)}; é possível retomar`, { resumable: true, received });
  }

  const digest = hash.digest('hex');
  if (digest !== sha256) { await rm(partial, { force: true }); throw new SetupError('CHECKSUM_MISMATCH', 'O arquivo baixado não confere com o SHA-256 fixado e foi descartado', { expected: sha256, actual: digest }); }
  if (executable) await chmod(partial, 0o755);
  await rename(partial, target);
  return { status: 'installed', path: target, size };
}

export async function verifiedFile(file, size, sha256) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile() || info.size !== size) return false;
  const hash = createHash('sha256');
  await hashInto(file, hash);
  return hash.digest('hex') === sha256;
}

async function hashInto(file, hash) {
  for await (const chunk of createReadStream(file)) hash.update(chunk);
}

function networkOrCancel(error, signal, received) {
  if (signal?.aborted) return new SetupError('CANCELLED', 'Download interrompido; o progresso foi preservado', { resumable: true, received, reason: signal.reason });
  return new SetupError('NETWORK', `Falha de rede: ${error.cause?.code || error.message}`, { resumable: received > 0, received });
}

export function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes; let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}
