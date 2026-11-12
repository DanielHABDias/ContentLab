import { execFile } from 'node:child_process';
import { createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lstat, readdir, mkdir, readFile, readlink, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { downloadVerified, verifiedFile } from '../setup/downloader.js';
import { installedPaths } from '../server/app-paths.js';

const exec = promisify(execFile);
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export const CHANNELS = ['stable', 'beta'];

/** JSON canônico (chaves ordenadas) para assinar e verificar o manifesto. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function compareVersions(a, b) {
  const parse = value => { const [main, pre = ''] = value.split('-'); return { parts: main.split('.').map(Number), pre }; };
  const x = parse(a); const y = parse(b);
  for (let index = 0; index < 3; index += 1) if (x.parts[index] !== y.parts[index]) return x.parts[index] - y.parts[index];
  if (x.pre === y.pre) return 0; if (!x.pre) return 1; if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

export class UpdateError extends Error { constructor(code, message) { super(message); this.code = code; } }

/**
 * Atualização do app instalado. Cada versão fica em `versions/<v>/`; `current`
 * e `previous` são links trocados de forma atômica. Dados, modelos e projetos
 * ficam fora de `app/`, então atualizar ou voltar versão nunca toca neles.
 * O manifesto é assinado (Ed25519) e o pacote conferido por tamanho e SHA-256.
 */
export class UpdateService {
  constructor({ appDirectory, currentVersion, publicKey = null, feedUrl = null, target = `${process.platform}-${process.arch}`, download = downloadVerified, fetchImpl = fetch, run = exec, allowHttpHosts = [] }) {
    this.appDirectory = appDirectory ? path.resolve(appDirectory) : null;
    this.currentVersion = currentVersion; this.publicKey = publicKey; this.feedUrl = feedUrl; this.target = target;
    this.download = download; this.fetchImpl = fetchImpl; this.run = run; this.allowHttpHosts = allowHttpHosts;
  }

  static fromEnvironment({ repositoryRoot, env = process.env }) {
    const pkg = JSON.parse(String(readFileSyncSafe(path.join(repositoryRoot, 'package.json')) || '{"version":"0.0.0"}'));
    const installed = env.CONTENTLAB_INSTALLED === '1';
    const keyFile = path.join(repositoryRoot, 'packaging', 'release-public-key.pem');
    return new UpdateService({ appDirectory: installed ? (env.CONTENTLAB_APP_DIR || installedPaths({ env }).app) : null, currentVersion: pkg.version, publicKey: readFileSyncSafe(keyFile), feedUrl: env.CONTENTLAB_UPDATE_URL || null });
  }

  get #stateFile() { return path.join(this.appDirectory, 'update-state.json'); }
  async #state() { try { return JSON.parse(await readFile(this.#stateFile, 'utf8')); } catch { return { channel: 'stable', manual: false, feedUrl: null, lastCheck: null }; } }
  async #saveState(state) { await mkdir(this.appDirectory, { recursive: true }); const temporary = `${this.#stateFile}.tmp`; await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`); await rename(temporary, this.#stateFile); }
  #installed() { if (!this.appDirectory) throw new UpdateError('NOT_INSTALLED', 'Atualização só existe no app instalado; no modo desenvolvimento use git pull'); }

  async status() {
    if (!this.appDirectory) return { installed: false, version: this.currentVersion, reason: 'Modo desenvolvimento: atualize com git pull.' };
    const state = await this.#state();
    return { installed: true, version: this.currentVersion, channel: state.channel, manual: state.manual, feedUrl: state.feedUrl || this.feedUrl, lastCheck: state.lastCheck, previous: await linkVersion(path.join(this.appDirectory, 'previous')), signing: Boolean(this.publicKey) };
  }

  async configure({ channel, manual, feedUrl }) {
    this.#installed();
    const state = await this.#state();
    if (channel !== undefined) { if (!CHANNELS.includes(channel)) throw new UpdateError('INVALID_CHANNEL', `Canal inválido: ${channel}`); state.channel = channel; }
    if (manual !== undefined) state.manual = Boolean(manual);
    if (feedUrl !== undefined) { if (feedUrl && !/^https:\/\//.test(feedUrl)) throw new UpdateError('INSECURE_URL', 'O endereço de atualização precisa ser HTTPS'); state.feedUrl = feedUrl || null; }
    await this.#saveState(state); return this.status();
  }

  /** Lê e verifica o manifesto do canal; não baixa nada. */
  async check() {
    this.#installed();
    const state = await this.#state();
    const base = state.feedUrl || this.feedUrl;
    if (!base) throw new UpdateError('NO_FEED', 'Nenhum endereço de atualização configurado; use a atualização manual');
    const url = new URL(`${state.channel}.json`, base.endsWith('/') ? base : `${base}/`);
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new UpdateError('FEED_UNAVAILABLE', `Servidor de atualização respondeu ${response.status}`);
    const manifest = this.verifyManifest(await response.json());
    state.lastCheck = new Date().toISOString(); await this.#saveState(state);
    const artifact = manifest.artifacts[this.target];
    const available = Boolean(artifact) && compareVersions(manifest.version, this.currentVersion) > 0;
    return { available, current: this.currentVersion, version: manifest.version, channel: manifest.channel, notes: manifest.notes, size: artifact?.size ?? null, manifest };
  }

  verifyManifest(manifest) {
    if (!this.publicKey) throw new UpdateError('NO_SIGNING_KEY', 'Este build não tem chave pública de atualização; instale novas versões manualmente');
    if (manifest?.schema !== 'contentlab-update-v1' || !VERSION.test(manifest.version || '') || !CHANNELS.includes(manifest.channel) || typeof manifest.artifacts !== 'object') throw new UpdateError('INVALID_MANIFEST', 'Manifesto de atualização inválido');
    const { signature, ...signed } = manifest;
    const ok = typeof signature === 'string' && verify(null, Buffer.from(canonical(signed)), createPublicKey(this.publicKey), Buffer.from(signature, 'base64'));
    if (!ok) throw new UpdateError('BAD_SIGNATURE', 'Assinatura do manifesto não confere; a atualização foi recusada');
    return manifest;
  }

  /** Baixa, confere e instala lado a lado; a troca só acontece depois de tudo verificado. */
  async apply({ signal } = {}) {
    const result = await this.check();
    if (!result.available) return { status: 'up-to-date', version: this.currentVersion };
    const artifact = result.manifest.artifacts[this.target];
    const archive = path.join(this.appDirectory, 'downloads', `contentlab-${result.version}-${this.target}.tar.gz`);
    await this.download({ url: artifact.url, destination: archive, sha256: artifact.sha256, size: artifact.size, signal, allowHttpHosts: this.allowHttpHosts });
    return this.installArchive({ archive, version: result.version, sha256: artifact.sha256, size: artifact.size });
  }

  /** Atualização manual: pacote baixado pela pessoa, conferido pelo SHA-256 publicado. */
  async installArchive({ archive, version, sha256, size }) {
    this.#installed();
    if (!VERSION.test(version || '')) throw new UpdateError('INVALID_VERSION', 'Versão inválida');
    if (!(await verifiedFile(path.resolve(archive), size ?? (await stat(archive)).size, sha256))) throw new UpdateError('CHECKSUM_MISMATCH', 'O pacote não confere com o SHA-256 informado');
    const versions = path.join(this.appDirectory, 'versions');
    const target = path.join(versions, version); const staging = `${target}.partial`;
    await rm(staging, { recursive: true, force: true }); await mkdir(staging, { recursive: true });
    try {
      const { stdout } = await this.run('tar', ['-tzf', path.resolve(archive)], { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
      for (const entry of stdout.split('\n').filter(Boolean)) if (entry.startsWith('/') || entry.split('/').includes('..')) throw new UpdateError('UNSAFE_ARCHIVE', `Caminho inseguro no pacote: ${entry}`);
      await this.run('tar', ['-xzf', path.resolve(archive), '-C', staging, '--no-same-owner', '--strip-components=1'], { timeout: 15 * 60_000 });
      const pkg = JSON.parse(await readFile(path.join(staging, 'app', 'package.json'), 'utf8'));
      if (pkg.version !== version) throw new UpdateError('VERSION_MISMATCH', `O pacote contém ${pkg.version}, esperado ${version}`);
      await stat(path.join(staging, 'bin', 'contentlab'));
      await rm(target, { recursive: true, force: true }); await rename(staging, target);
    } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
    const current = await linkVersion(path.join(this.appDirectory, 'current'));
    if (current && current !== version) await swapLink(path.join(this.appDirectory, 'previous'), path.join('versions', current));
    await swapLink(path.join(this.appDirectory, 'current'), path.join('versions', version));
    await this.#prune([version, current].filter(Boolean));
    return { status: 'installed', version, previous: current, restartRequired: true };
  }

  /** Volta para a versão anterior mantida em disco. */
  async rollback() {
    this.#installed();
    const previous = await linkVersion(path.join(this.appDirectory, 'previous'));
    const current = await linkVersion(path.join(this.appDirectory, 'current'));
    if (!previous) throw new UpdateError('NO_PREVIOUS', 'Não há versão anterior para voltar');
    await stat(path.join(this.appDirectory, 'versions', previous, 'bin', 'contentlab'));
    await swapLink(path.join(this.appDirectory, 'current'), path.join('versions', previous));
    if (current) await swapLink(path.join(this.appDirectory, 'previous'), path.join('versions', current));
    return { status: 'rolled-back', version: previous, previous: current, restartRequired: true };
  }

  async #prune(keep) {
    for (const name of await readdir(path.join(this.appDirectory, 'versions')).catch(() => [])) if (!keep.includes(name)) await rm(path.join(this.appDirectory, 'versions', name), { recursive: true, force: true });
    await rm(path.join(this.appDirectory, 'downloads'), { recursive: true, force: true });
  }
}

async function linkVersion(link) { try { if (!(await lstat(link)).isSymbolicLink()) return null; return path.basename(await readlink(link)); } catch { return null; } }
async function swapLink(link, target) { const temporary = `${link}.${process.pid}.tmp`; await rm(temporary, { force: true }); await symlink(target, temporary); await rename(temporary, link); }
function readFileSyncSafe(file) { try { return readFileSync(file, 'utf8'); } catch { return null; } }
