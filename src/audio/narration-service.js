import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export class NarrationService {
  constructor(root, { ffmpeg = 'ffmpeg' } = {}) { this.root = path.resolve(root); this.ffmpeg = ffmpeg; }

  async createSession(projectId) {
    const session = { schema: 'contentlab-narration-v1', projectId, revision: 1, takes: [] };
    await this.#save(projectId, session);
    return session;
  }

  async read(projectId) { return JSON.parse(await readFile(this.#manifest(projectId), 'utf8')); }

  async addTake(projectId, source, { label = 'Take', scriptRange = null } = {}) {
    const session = await this.read(projectId);
    const id = `take_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const directory = path.join(this.root, projectId, 'takes'); await mkdir(directory, { recursive: true });
    const target = path.join(directory, `${id}.wav`);
    await this.#audio(source, target, ['-ar', '48000', '-ac', '1']);
    session.takes.push({ id, label, path: target, scriptRange, createdAt: new Date().toISOString() });
    session.revision += 1; await this.#save(projectId, session); return session.takes.at(-1);
  }

  async trimTake(projectId, takeId, { start, end }) {
    if (!(start >= 0) || !(end > start)) throw new Error('Intervalo inválido');
    const session = await this.read(projectId); const take = requireTake(session, takeId);
    const temporary = `${take.path}.trim.wav`;
    await this.#audio(take.path, temporary, ['-ss', String(start), '-to', String(end), '-ar', '48000', '-ac', '1']);
    await rm(take.path); const { rename } = await import('node:fs/promises'); await rename(temporary, take.path);
    session.revision += 1; await this.#save(projectId, session); return take;
  }

  async deleteTake(projectId, takeId) {
    const session = await this.read(projectId); const take = requireTake(session, takeId);
    await rm(take.path, { force: true }); session.takes = session.takes.filter(item => item.id !== takeId); session.revision += 1; await this.#save(projectId, session); return session;
  }

  async assemble(projectId, takeIds, output) {
    const session = await this.read(projectId); const takes = takeIds.map(id => requireTake(session, id));
    if (!takes.length) throw new Error('Selecione ao menos um take');
    const list = path.join(this.root, projectId, `.concat-${randomUUID()}.txt`);
    await writeFile(list, takes.map(take => `file '${take.path.replaceAll("'", "'\\''")}'`).join('\n'));
    try { await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '1', '-y', path.resolve(output)], { timeout: 30 * 60_000 }); }
    finally { await rm(list, { force: true }); }
    return { path: path.resolve(output), takes: takeIds };
  }

  async treat(input, output, { denoise = true, targetLufs = -16 } = {}) {
    const filters = [];
    if (denoise) filters.push('afftdn=nf=-25');
    filters.push('highpass=f=70', 'acompressor=threshold=-18dB:ratio=2.5:attack=12:release=120', `loudnorm=I=${targetLufs}:TP=-1.5:LRA=9`);
    await this.#audio(input, path.resolve(output), ['-af', filters.join(','), '-ar', '48000', '-ac', '1']);
    return { path: path.resolve(output), filters, targetLufs };
  }

  async #audio(source, target, options) { try { await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', path.resolve(source), ...options, '-y', target], { timeout: 30 * 60_000, maxBuffer: 4 * 1024 * 1024 }); } catch (error) { await rm(target, { force: true }); throw new Error(`Falha de áudio: ${error.stderr || error.message}`); } }
  #manifest(projectId) { return path.join(this.root, projectId, 'narration.json'); }
  async #save(projectId, value) { const directory = path.join(this.root, projectId); await mkdir(directory, { recursive: true }); await writeFile(this.#manifest(projectId), `${JSON.stringify(value, null, 2)}\n`); }
}

export class VoiceProfileStore {
  constructor(root) { this.root = path.resolve(root); }
  async create({ name, samplePath, referenceText, consent }) {
    if (!consent?.granted || !consent?.holder || !consent?.grantedAt) throw new Error('Consentimento explícito do titular é obrigatório');
    if (!referenceText?.trim()) throw new Error('O texto lido na amostra é obrigatório');
    const info = await stat(path.resolve(samplePath)); if (!info.isFile()) throw new Error('Amostra inválida');
    const id = `voice_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const value = { schema: 'contentlab-voice-profile-v1', id, name, samplePath: path.resolve(samplePath), referenceText, consent, model: 'voxcpm2' };
    await mkdir(this.root, { recursive: true }); await writeFile(path.join(this.root, `${id}.json`), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); return value;
  }
}

/**
 * Voz clonada com VoxCPM2. Cada geração usa o plano de hardware do momento:
 * dispositivo, núcleos e teto de memória sem swap (Linux: systemd-run), com
 * prioridade baixa. Estourar o teto encerra só a geração, nunca o sistema.
 */
export class VoxCPMVoice {
  static model = 'voxcpm2';
  constructor({ runner = 'contentlab-voice', modelPath, planner, onMeasured = async () => {}, spawnFile = execFile, platform = process.platform } = {}) {
    this.runner = runner; this.modelPath = modelPath; this.planner = planner; this.onMeasured = onMeasured; this.spawnFile = spawnFile; this.platform = platform;
  }

  async diagnose() {
    try { await run(this.runner, ['--version'], { timeout: 10_000 }); }
    catch (error) { return { ready: false, model: VoxCPMVoice.model, issues: [error.code === 'ENOENT' ? 'VoxCPM2 não instalado' : `VoxCPM2 indisponível: ${error.message}`] }; }
    return this.modelPath ? { ready: true, model: VoxCPMVoice.model, issues: [] } : { ready: false, model: VoxCPMVoice.model, issues: ['Pesos do VoxCPM2 não configurados'] };
  }

  /** Comando final com os limites do plano. Exposto para teste. */
  command(plan, args) {
    const base = [this.runner, ...args];
    if (this.platform === 'linux' && plan.memoryGuard === 'systemd') return ['systemd-run', ['--user', '--scope', '--quiet', '-p', `MemoryMax=${plan.memoryLimitBytes}`, '-p', 'MemorySwapMax=0', 'nice', '-n', '15', ...base]];
    if (this.platform !== 'win32') return ['nice', ['-n', '15', ...base]];
    return [base[0], base.slice(1)];
  }

  async generate({ text, profile, output, signal }) {
    if (!profile?.consent?.granted) throw Object.assign(new Error('Perfil sem consentimento válido do titular da voz'), { code: 'CONSENT_REQUIRED' });
    if (!profile.referenceText?.trim()) throw Object.assign(new Error('O perfil precisa do texto exato lido na amostra'), { code: 'REFERENCE_TEXT_REQUIRED' });
    if (!text?.trim()) throw new Error('Texto vazio');
    const status = await this.diagnose(); if (!status.ready) throw Object.assign(new Error(status.issues.join('; ')), { code: 'DEPENDENCY_MISSING', details: { missing: ['voxcpm2'] } });
    const plan = await this.planner();
    if (plan.status !== 'ready') throw Object.assign(new Error(plan.reasons.join(' ') || 'Recursos insuficientes'), { code: plan.status === 'unsupported' ? 'HARDWARE_UNSUPPORTED' : 'NEEDS_FREE_MEMORY', details: { plan } });
    const target = path.resolve(output);
    await mkdir(path.dirname(target), { recursive: true });
    const args = ['--model', this.modelPath, '--device', plan.device, '--threads', String(plan.threads), '--reference', profile.samplePath, '--reference-text', profile.referenceText, '--text', text, '--output', target];
    const [command, commandArgs] = this.command(plan, args);
    let stdout;
    const options = { timeout: 6 * 60 * 60_000, maxBuffer: 16 * 1024 * 1024, signal, env: { ...process.env, OMP_NUM_THREADS: String(plan.threads), MKL_NUM_THREADS: String(plan.threads), HF_HUB_OFFLINE: '1' } };
    try { ({ stdout } = await new Promise((resolve, reject) => this.spawnFile(command, commandArgs, options, (error, out, err) => (error ? reject(Object.assign(error, { stdout: out, stderr: err })) : resolve({ stdout: out, stderr: err }))))); }
    catch (error) {
      await rm(`${target}.partial.wav`, { force: true });
      if (signal?.aborted) throw Object.assign(new Error('Geração de voz cancelada'), { code: 'CANCELLED' });
      if (error.code === 137 || error.signal === 'SIGKILL') throw Object.assign(new Error(`A geração passou do limite de memória (${Math.round(plan.memoryLimitBytes / 1024 ** 3)} GB) e foi encerrada sem afetar o sistema. Feche programas e tente de novo.`), { code: 'MEMORY_LIMIT', details: { plan } });
      throw new Error(`Falha na geração de voz: ${`${error.stderr || error.message}`.trim().split(/\r?\n/).slice(-2).join(' ')}`);
    }
    const result = JSON.parse(`${stdout}`.trim().split(/\r?\n/).at(-1));
    await this.onMeasured({ device: plan.device, realtimeFactor: result.realtimeFactor });
    return { path: target, model: VoxCPMVoice.model, device: plan.device, seconds: result.generationSeconds, audioSeconds: result.audioSeconds, realtimeFactor: result.realtimeFactor };
  }
}

function requireTake(session, id) { const take = session.takes.find(item => item.id === id); if (!take) throw new Error(`Take desconhecido: ${id}`); return take; }
