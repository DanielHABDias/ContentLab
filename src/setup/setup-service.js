import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, chmod, mkdir, readFile, rename, rm, stat, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CATALOG_VERSION, appliesTo, artifactFor, defaultCatalog } from './dependency-catalog.js';
import { SetupError, downloadVerified } from './downloader.js';
import { detectHardware, planVoiceRuntime } from './hardware.js';

const execFileAsync = promisify(execFile);
const STATE_SCHEMA = 'contentlab-setup-v1';
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INSTALLABLE = ['download', 'build', 'python'];

async function defaultRun(command, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(command, args, { timeout: 10_000, maxBuffer: 8 * 1024 * 1024, ...options });
  return { stdout: `${stdout}`, stderr: `${stderr}` };
}

/**
 * Setup progressivo: detecta, explica e instala dependências em `.tools/`,
 * sem tocar no sistema e sem baixar nada sem consentimento explícito.
 */
export class SetupService {
  #jobs = new Map();

  constructor({ toolsDirectory, catalog = defaultCatalog(), platform = process.platform, arch = process.arch, nodeVersion = process.version, run = defaultRun, download = downloadVerified, statfsImpl = statfs, osRelease = '/etc/os-release', env = process.env, repositoryRoot = REPOSITORY_ROOT, detectHardware: detect = () => detectHardware({ platform }) }) {
    this.toolsDirectory = path.resolve(toolsDirectory);
    this.stateFile = path.join(this.toolsDirectory, 'setup-state.json');
    this.catalog = catalog.filter(item => appliesTo(item, platform));
    this.platform = platform; this.arch = arch; this.nodeVersion = nodeVersion;
    this.run = run; this.download = download; this.statfs = statfsImpl; this.osRelease = osRelease; this.env = env; this.repositoryRoot = repositoryRoot; this.detectHardware = detect;
  }

  /** Caminho do executável: primeiro `.tools/bin`, depois o PATH do sistema. */
  async toolPath(name) {
    const local = path.join(this.toolsDirectory, 'bin', this.platform === 'win32' ? `${name}.exe` : name);
    return await stat(local).then(() => local, () => name);
  }

  modelPath(id) {
    const item = this.catalog.find(entry => entry.id === id);
    return item?.destination ? path.join(this.toolsDirectory, item.destination) : null;
  }

  async status() {
    const state = await this.#readState();
    const distro = await this.#distro();
    const hardware = await this.detectHardware().catch(() => null);
    const plan = hardware ? planVoiceRuntime(hardware, { calibration: state.calibration?.voxcpm2 || null }) : null;
    const items = await Promise.all(this.catalog.map(async item => {
      const inspected = await this.#inspect(item, state);
      if (item.runtime !== 'voice' || !plan) return inspected;
      const recorded = state.items[item.id];
      const withRuntime = { ...inspected, runtime: plan };
      if (plan.status === 'unsupported') return { ...withRuntime, ready: false, installable: false, problem: 'Este computador não comporta o modelo', reason: plan.reasons.join(' ') };
      if (inspected.ready && recorded?.torchBuild && recorded.torchBuild !== plan.torchBuild) return { ...withRuntime, ready: false, installable: true, problem: `Instalado para ${recorded.device}; reinstale para usar ${plan.device}` };
      return withRuntime;
    }));
    const fsInfo = await this.statfs(await nearestExisting(this.toolsDirectory)).catch(() => null);
    return {
      schema: 'contentlab-setup-status-v1', catalogVersion: CATALOG_VERSION,
      platform: { os: this.platform, arch: this.arch, ...distro },
      hardware,
      toolsDirectory: this.toolsDirectory,
      freeBytes: fsInfo ? Number(fsInfo.bavail) * Number(fsInfo.bsize) : null,
      essentialsReady: items.filter(item => item.required).every(item => item.ready),
      onboarding: state.onboarding,
      items,
      jobs: this.jobs(),
    };
  }

  async setOnboarding(choice) {
    if (!['completed', 'dismissed', 'reset'].includes(choice)) throw new Error('Escolha de onboarding inválida');
    const state = await this.#readState();
    state.onboarding = choice === 'reset' ? { completedAt: null, dismissedAt: null } : { ...state.onboarding, [`${choice}At`]: new Date().toISOString() };
    await this.#writeState(state);
    return state.onboarding;
  }

  /** Enfileira instalações. Itens que exigem consentimento precisam estar em `consent`. */
  async install({ ids = [], consent = [] } = {}) {
    await this.#distro();
    const items = ids.map(id => this.catalog.find(item => item.id === id) || (() => { throw new SetupError('UNKNOWN_ITEM', `Dependência desconhecida: ${id}`); })());
    const missingConsent = items.filter(item => item.consent && !consent.includes(item.id));
    if (missingConsent.length) throw new SetupError('CONSENT_REQUIRED', `Confirme origem, licença e tamanho antes de instalar: ${missingConsent.map(item => item.label).join(', ')}`, { ids: missingConsent.map(item => item.id) });
    for (const item of items) if (!INSTALLABLE.includes(item.kind)) throw new SetupError('NOT_INSTALLABLE', `${item.label} não é instalado pelo Content Lab; veja as instruções exibidas`, { id: item.id });
    return items.map(item => {
      const active = [...this.#jobs.values()].find(job => job.itemId === item.id && ['queued', 'running'].includes(job.state));
      return active ? publicJob(active) : publicJob(this.#start(item));
    });
  }

  /**
   * Após migrar `.tools/` para `target`: reescreve caminhos do estado e descarta
   * instalações não relocáveis (ambiente Python), que voltam a pedir instalação.
   */
  async relocate(target) {
    const state = await this.#readState();
    const dropped = [];
    for (const [id, entry] of Object.entries(state.items)) {
      const item = this.catalog.find(candidate => candidate.id === id);
      if (!item || item.kind === 'python') { delete state.items[id]; dropped.push(id); continue; }
      if (entry.path) entry.path = path.join(target, path.relative(this.toolsDirectory, entry.path));
    }
    const relocated = new SetupService({ toolsDirectory: target, catalog: this.catalog, platform: this.platform, arch: this.arch, run: this.run, download: this.download, statfsImpl: this.statfs, osRelease: this.osRelease, env: this.env, repositoryRoot: this.repositoryRoot, detectHardware: this.detectHardware });
    await relocated.#writeState(state);
    return { dropped };
  }

  jobs() { return [...this.#jobs.values()].map(publicJob); }

  pause(jobId) { const job = this.#job(jobId); if (job.state !== 'running') throw new SetupError('INVALID_STATE', 'Só é possível pausar um download em andamento'); job.controller.abort('pause'); return publicJob(job); }

  async cancel(jobId) {
    const job = this.#job(jobId);
    if (job.state === 'running') { job.cancelRequested = true; job.controller.abort('cancel'); await job.promise; }
    if (['paused', 'failed', 'queued', 'cancelled'].includes(job.state)) { await this.#discardPartial(job.item); job.state = 'cancelled'; job.phase = 'Cancelado; arquivos parciais removidos'; }
    return publicJob(job);
  }

  /** Retoma pausado ou repete falho, aproveitando o parcial válido. */
  resume(jobId) {
    const job = this.#job(jobId);
    if (!['paused', 'failed', 'cancelled'].includes(job.state)) throw new SetupError('INVALID_STATE', 'Este job não pode ser retomado agora');
    this.#jobs.delete(jobId);
    return publicJob(this.#start(job.item, job.id));
  }

  async waitFor(jobId) { const job = this.#job(jobId); await job.promise; return publicJob(job); }

  #job(jobId) { const job = this.#jobs.get(jobId); if (!job) throw new SetupError('UNKNOWN_JOB', 'Job de instalação desconhecido'); return job; }

  #start(item, id = `setup_${randomUUID().slice(0, 8)}`) {
    const job = { id, itemId: item.id, item, state: 'running', phase: 'Preparando', received: 0, total: artifactFor(item, this.platform, this.arch)?.size || null, error: null, code: null, controller: new AbortController(), startedAt: new Date().toISOString(), finishedAt: null };
    this.#jobs.set(id, job);
    job.promise = (item.kind === 'build' ? this.#build(item, job) : item.kind === 'python' ? this.#python(item, job) : this.#fetch(item, job))
      .then(async result => { job.state = 'completed'; job.phase = result.status === 'already-installed' ? 'Já estava instalado' : 'Instalado e verificado'; await this.#record(item, result); })
      .catch(error => {
        if (job.controller.signal.aborted && job.controller.signal.reason === 'pause') { job.state = 'paused'; job.phase = 'Pausado; o progresso foi preservado'; return; }
        if (job.cancelRequested) { job.state = 'cancelled'; return; }
        job.state = 'failed'; job.code = error.code || 'FAILED'; job.error = error.message; job.phase = 'Falhou';
      })
      .finally(() => { job.finishedAt = new Date().toISOString(); });
    return job;
  }

  async #fetch(item, job) {
    const artifact = artifactFor(item, this.platform, this.arch);
    if (!artifact) throw new SetupError('UNSUPPORTED_PLATFORM', `${item.label} não tem download oficial para ${this.platform}-${this.arch}`);
    job.phase = 'Baixando';
    return await this.download({ ...artifact, destination: path.join(this.toolsDirectory, item.destination), executable: item.executable, signal: job.controller.signal, onProgress: ({ received, total }) => { job.received = received; job.total = total; } });
  }

  async #build(item, job) {
    const signal = job.controller.signal;
    const missing = [];
    for (const requirement of item.buildRequirements || []) {
      const [command, args] = requirement === 'c++' ? ['c++', ['--version']] : [requirement, ['--version']];
      try { await this.run(command, args, { signal }); } catch { missing.push(requirement); }
    }
    if (missing.length) throw new SetupError('BUILD_TOOLS_MISSING', `Ferramentas de compilação ausentes: ${missing.join(', ')}. Instale-as com: ${this.#systemCommand(item) || 'o gerenciador do sistema'}`, { missing });
    const target = path.join(this.toolsDirectory, item.destination);
    const existing = await this.#readState();
    if (existing.items[item.id]?.commit === item.source.commit && await stat(target).then(() => true, () => false)) return { status: 'already-installed', path: target };
    const sourceDirectory = path.join(this.toolsDirectory, 'src', `${item.id}-${item.version}`);
    const head = async () => (await this.run('git', ['-C', sourceDirectory, 'rev-parse', 'HEAD'], { signal })).stdout.trim();
    let current = await head().catch(() => null);
    if (current !== item.source.commit) {
      job.phase = 'Baixando código-fonte';
      await rm(sourceDirectory, { recursive: true, force: true });
      await mkdir(path.dirname(sourceDirectory), { recursive: true });
      await this.run('git', ['clone', '--depth', '1', '--branch', item.source.tag, item.source.repository, sourceDirectory], { signal, timeout: 30 * 60_000 });
      current = await head();
    }
    if (current !== item.source.commit) { await rm(sourceDirectory, { recursive: true, force: true }); throw new SetupError('CHECKSUM_MISMATCH', `Código-fonte não confere com o commit fixado (${item.source.commit.slice(0, 12)})`); }
    job.phase = 'Compilando (pode levar alguns minutos)';
    const buildDirectory = path.join(sourceDirectory, 'build');
    await this.run('cmake', ['-S', sourceDirectory, '-B', buildDirectory, '-DCMAKE_BUILD_TYPE=Release', '-DWHISPER_BUILD_TESTS=OFF', '-DWHISPER_BUILD_EXAMPLES=ON'], { signal, timeout: 30 * 60_000 });
    await this.run('cmake', ['--build', buildDirectory, '--config', 'Release', '--target', 'whisper-cli', '-j'], { signal, timeout: 60 * 60_000 });
    const built = path.join(buildDirectory, 'bin', 'whisper-cli');
    await stat(built).catch(() => { throw new SetupError('BUILD_FAILED', 'A compilação terminou sem gerar whisper-cli'); });
    job.phase = 'Verificando binário';
    await mkdir(path.dirname(target), { recursive: true });
    const partial = `${target}.partial`;
    await copyFile(built, partial); await chmod(partial, 0o755);
    try { await this.run(partial, ['--help'], { signal }); }
    catch (error) { if (!`${error.stderr || ''}${error.stdout || ''}`.toLowerCase().includes('usage')) { await rm(partial, { force: true }); throw new SetupError('BUILD_FAILED', `O binário compilado não executa: ${error.message}`); } }
    await rename(partial, target);
    return { status: 'installed', path: target, commit: item.source.commit };
  }

  async #python(item, job) {
    const signal = job.controller.signal;
    const [minMajor, minMinor] = item.python.minimum;
    const [maxMajor, maxMinor] = item.python.maximumExclusive || [99, 0];
    const plan = item.runtime === 'voice' ? await this.voicePlan() : null;
    if (plan?.status === 'unsupported') throw new SetupError('HARDWARE_UNSUPPORTED', `Este computador não comporta ${item.label}: ${plan.reasons.join(' ')}`, { plan });
    let python = null;
    for (const candidate of ['python3.12', 'python3.11', 'python3.10', 'python3', 'python']) {
      try {
        const { stdout } = await this.run(candidate, ['-c', 'import sys, venv, ensurepip; print("%d.%d" % sys.version_info[:2])'], { signal });
        const [major, minor] = stdout.trim().split('.').map(Number);
        const aboveMinimum = major > minMajor || (major === minMajor && minor >= minMinor);
        const belowMaximum = major < maxMajor || (major === maxMajor && minor < maxMinor);
        if (aboveMinimum && belowMaximum) { python = candidate; break; }
      } catch { /* tenta o próximo */ }
    }
    if (!python) throw new SetupError('PYTHON_MISSING', `É necessário Python ${minMajor}.${minMinor} a ${maxMajor}.${maxMinor - 1} com venv. Instale com: ${this.#systemCommand(item) || 'o gerenciador do sistema'}`);
    const target = path.join(this.toolsDirectory, item.destination);
    const recorded = (await this.#readState()).items[item.id];
    if (recorded && this.#current(item, recorded) && (!plan || recorded.torchBuild === plan.torchBuild) && await stat(target).then(() => true, () => false)) return { status: 'already-installed', path: target, torchBuild: recorded.torchBuild, device: recorded.device };

    job.phase = 'Baixando pacote verificado';
    const wheel = path.join(this.toolsDirectory, 'cache', item.wheel.filename);
    await this.download({ ...item.wheel, destination: wheel, signal, onProgress: () => {} });

    const environment = path.join(this.toolsDirectory, item.environment);
    const environmentPython = path.join(environment, 'bin', 'python');
    if (!(await stat(environmentPython).then(() => true, () => false))) {
      job.phase = 'Criando ambiente Python isolado';
      await this.run(python, ['-m', 'venv', environment], { signal, timeout: 10 * 60_000 });
    }
    const pip = ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input'];
    if (plan) {
      job.phase = `Instalando PyTorch para ${plan.device === 'cpu' ? 'CPU' : plan.torchBuild} (pode levar vários minutos)`;
      try { await this.run(environmentPython, [...pip, ...plan.torch.packages, ...(plan.torch.index ? ['--index-url', plan.torch.index] : [])], { signal, timeout: 2 * 60 * 60_000, maxBuffer: 64 * 1024 * 1024 }); }
      catch (error) { if (signal.aborted) throw error; throw new SetupError('PIP_FAILED', `Falha ao instalar o PyTorch (${plan.torchBuild}): ${tail(error.stderr || error.message)}`); }
    }
    job.phase = 'Instalando o pacote e dependências (pode levar vários minutos)';
    try { await this.run(environmentPython, [...pip, wheel], { signal, timeout: 2 * 60 * 60_000, maxBuffer: 64 * 1024 * 1024 }); }
    catch (error) { if (signal.aborted) throw error; throw new SetupError('PIP_FAILED', `Falha ao instalar pacotes Python: ${tail(error.stderr || error.message)}`); }

    const adapter = path.join(environment, path.basename(item.adapter));
    await copyFile(path.join(this.repositoryRoot, item.adapter), adapter);
    const models = path.join(this.toolsDirectory, item.weights.destination);
    job.phase = 'Baixando pesos na revisão fixada';
    try { await this.run(environmentPython, [adapter, '--fetch-weights', '--model', models, '--revision', item.weights.revision], { signal, timeout: 2 * 60 * 60_000, maxBuffer: 16 * 1024 * 1024 }); }
    catch (error) { if (signal.aborted) throw error; throw new SetupError('NETWORK', `Falha ao baixar os pesos: ${tail(error.stderr || error.message)}`, { resumable: true }); }

    job.phase = 'Verificando instalação';
    await mkdir(path.dirname(target), { recursive: true });
    const partial = `${target}.partial`;
    const script = [
      '#!/bin/sh',
      `# Gerado pelo Content Lab: ${item.label} ${item.version}, pesos ${item.weights.revision}, PyTorch ${plan?.torchBuild || 'padrão'}`,
      `[ -n "$CONTENTLAB_VOICE_MODEL" ] || CONTENTLAB_VOICE_MODEL=${shellQuote(models)}`,
      'export CONTENTLAB_VOICE_MODEL HF_HUB_OFFLINE=1',
      `exec ${shellQuote(environmentPython)} ${shellQuote(adapter)} "$@"`,
      '',
    ].join('\n');
    await writeFile(partial, script, { mode: 0o755 });
    try { await this.run(partial, ['--check', '--model', models], { signal, timeout: 10 * 60_000 }); }
    catch (error) { await rm(partial, { force: true }); if (signal.aborted) throw error; throw new SetupError('VERIFY_FAILED', `A instalação não passou na verificação: ${tail(error.stderr || error.message)}`); }
    await rename(partial, target);
    return { status: 'installed', path: target, torchBuild: plan?.torchBuild || null, device: plan?.device || null };
  }

  /** Perfil de hardware atual e plano de execução da voz clonada. */
  async hardware() { return await this.detectHardware(); }

  async voicePlan() {
    const state = await this.#readState();
    return planVoiceRuntime(await this.detectHardware(), { calibration: state.calibration?.voxcpm2 || null });
  }

  /** Guarda a velocidade real medida, para estimativas futuras desta máquina. */
  async recordCalibration(engine, { device, realtimeFactor }) {
    if (!(realtimeFactor > 0)) return;
    const state = await this.#readState();
    const previous = state.calibration?.[engine];
    const value = previous?.device === device ? Math.round(((previous.realtimeFactor * previous.samples + realtimeFactor) / (previous.samples + 1)) * 10) / 10 : realtimeFactor;
    state.calibration = { ...state.calibration, [engine]: { device, realtimeFactor: value, samples: previous?.device === device ? previous.samples + 1 : 1, updatedAt: new Date().toISOString() } };
    await this.#writeState(state);
  }

  #current(item, recorded) {
    if (item.kind === 'build') return recorded.commit === item.source?.commit;
    if (item.kind === 'python') return recorded.version === item.version && recorded.sha256 === item.wheel.sha256 && recorded.revision === item.weights.revision;
    return recorded.sha256 === artifactFor(item, this.platform, this.arch)?.sha256;
  }

  async #discardPartial(item) {
    if (!item.destination) return;
    await rm(`${path.join(this.toolsDirectory, item.destination)}.partial`, { force: true });
  }

  async #record(item, result) {
    const state = await this.#readState();
    const artifact = artifactFor(item, this.platform, this.arch);
    state.items[item.id] = { version: item.version || null, sha256: artifact?.sha256 || item.wheel?.sha256 || null, size: artifact?.size || null, commit: item.source?.commit || null, revision: item.weights?.revision || null, torchBuild: result.torchBuild || null, device: result.device || null, path: result.path, installedAt: new Date().toISOString() };
    await this.#writeState(state);
  }

  async #inspect(item, state) {
    const base = { id: item.id, label: item.label, group: item.group, kind: item.kind, required: item.required, description: item.description, license: item.license, origin: item.origin, consent: Boolean(item.consent), version: item.version || null };
    const artifact = artifactFor(item, this.platform, this.arch);
    const destination = item.destination ? path.join(this.toolsDirectory, item.destination) : null;
    const info = { ...base, destination, downloadBytes: artifact?.size ?? item.estimatedBytes ?? null, sha256: artifact?.sha256 || null, source: item.source || null, systemCommand: this.#systemCommand(item), manualSteps: item.manualSteps || null, installable: false, reason: null };
    if (item.kind === 'runtime') {
      const major = Number(this.nodeVersion.replace(/^v/, '').split('.')[0]);
      return { ...info, ready: major >= item.minimumMajor, detected: this.nodeVersion, problem: major >= item.minimumMajor ? null : `Node ${this.nodeVersion} é antigo; instale Node.js ${item.minimumMajor} ou superior` };
    }
    const recorded = state.items[item.id];
    if (destination && recorded) {
      const present = await stat(destination).then(file => !recorded.size || file.size === recorded.size, () => false);
      const current = this.#current(item, recorded);
      if (present && current) return { ...info, ready: true, detected: `instalado em .tools (${recorded.version})`, location: destination, managed: true };
      if (present && !current) return { ...info, ready: false, installable: true, problem: 'Versão instalada difere da versão fixada; atualize', location: destination, managed: true };
    }
    if (item.detect) {
      try {
        const { stdout, stderr } = await this.run(item.detect.command, item.detect.args);
        return { ...info, ready: true, detected: firstLine(stdout || stderr), location: 'PATH do sistema' };
      } catch (error) {
        const usage = `${error.stdout || ''}${error.stderr || ''}`.toLowerCase().includes('usage');
        if (usage && error.code !== 'ENOENT') return { ...info, ready: true, detected: 'disponível', location: 'PATH do sistema' };
      }
    }
    if (item.kind === 'download') return artifact ? { ...info, ready: false, installable: true, problem: 'Não instalado' } : { ...info, ready: false, reason: `Sem download oficial para ${this.platform}-${this.arch}`, problem: 'Indisponível nesta plataforma' };
    if (item.kind === 'build' || item.kind === 'python') return { ...info, ready: false, installable: true, problem: 'Não instalado' };
    if (item.kind === 'manual') return { ...info, ready: false, reason: 'Instalação manual', problem: 'Não encontrado' };
    return { ...info, ready: false, problem: 'Não encontrado no sistema' };
  }

  #systemCommand(item) {
    if (!item.systemCommands) return null;
    const manager = this.platform === 'darwin' ? 'brew' : this.platform === 'win32' ? 'winget' : this.packageManager;
    return item.systemCommands[manager] || null;
  }

  #distroInfo = null;
  async #distro() { this.#distroInfo ||= this.#detectDistro(); return await this.#distroInfo; }

  async #detectDistro() {
    if (this.platform !== 'linux') { this.packageManager = this.platform === 'darwin' ? 'brew' : 'winget'; return { distro: this.platform, packageManager: this.packageManager }; }
    const contents = await readFile(this.osRelease, 'utf8').catch(() => '');
    const field = key => contents.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, 'm'))?.[1] || '';
    const family = `${field('ID')} ${field('ID_LIKE')}`;
    this.packageManager = /debian|ubuntu/.test(family) ? 'apt' : /fedora|rhel|centos/.test(family) ? 'dnf' : /arch/.test(family) ? 'pacman' : /suse/.test(family) ? 'zypper' : null;
    return { distro: field('PRETTY_NAME') || field('ID') || 'Linux', packageManager: this.packageManager };
  }

  async #readState() {
    try {
      const value = JSON.parse(await readFile(this.stateFile, 'utf8'));
      if (value.schema !== STATE_SCHEMA) throw new Error('schema');
      return { schema: STATE_SCHEMA, items: value.items || {}, calibration: value.calibration || {}, onboarding: { completedAt: null, dismissedAt: null, ...value.onboarding } };
    } catch (error) {
      if (error.code !== 'ENOENT' && error.message !== 'schema' && !(error instanceof SyntaxError)) throw error;
      return { schema: STATE_SCHEMA, items: {}, onboarding: { completedAt: null, dismissedAt: null } };
    }
  }

  async #writeState(state) {
    await mkdir(this.toolsDirectory, { recursive: true });
    const temporary = `${this.stateFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ ...state, schema: STATE_SCHEMA, catalogVersion: CATALOG_VERSION }, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.stateFile);
  }
}

function publicJob(job) {
  const { id, itemId, state, phase, received, total, error, code, startedAt, finishedAt } = job;
  return { id, itemId, label: job.item.label, state, phase, received, total, error, code, startedAt, finishedAt };
}

function tail(value) { return `${value}`.trim().split(/\r?\n/).slice(-3).join(' ').slice(-400); }
function shellQuote(value) { return `'${String(value).replaceAll("'", "'\\''")}'`; }

function firstLine(value) { return `${value}`.split(/\r?\n/).find(Boolean)?.slice(0, 180) || 'disponível'; }

async function nearestExisting(directory) {
  let current = directory;
  while (!(await stat(current).then(() => true, () => false))) { const parent = path.dirname(current); if (parent === current) break; current = parent; }
  return current;
}
