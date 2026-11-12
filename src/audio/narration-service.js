import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sha256File } from '../media/media-service.js';

const run = promisify(execFile);

/** Presets do antigo Voice Studio: tom em semitons (rubberband, formantes preservados) e reforço de graves. */
export const VOICE_PRESETS = {
  original: { label: 'Original', pitch: 0, bass: 0 },
  warm: { label: 'Quente', pitch: -0.5, bass: 3 },
  gentle: { label: 'Suave', pitch: 0.5, bass: 1 },
  balanced: { label: 'Equilibrada', pitch: 0, bass: 1.5 },
  deep: { label: 'Grave', pitch: -1.5, bass: 4 },
};

export const DEFAULT_TREATMENT = { trimSilence: true, denoise: true, highpass: true, compress: true, normalize: true, targetLufs: -16, preset: 'original' };

export function normalizeTreatment(input = {}) {
  const value = { ...DEFAULT_TREATMENT, ...input };
  for (const key of ['trimSilence', 'denoise', 'highpass', 'compress', 'normalize']) value[key] = Boolean(value[key]);
  value.targetLufs = Number(value.targetLufs);
  if (!(value.targetLufs >= -24 && value.targetLufs <= -10)) throw new Error('Loudness alvo deve ficar entre -24 e -10 LUFS');
  if (!VOICE_PRESETS[value.preset]) throw new Error(`Preset de voz desconhecido: ${value.preset}`);
  return { trimSilence: value.trimSilence, denoise: value.denoise, highpass: value.highpass, compress: value.compress, normalize: value.normalize, targetLufs: value.targetLufs, preset: value.preset };
}

/** Cadeia FFmpeg do tratamento, na ordem: silêncio → ruído → high-pass → preset → compressão → loudness. */
export function treatmentFilters(input) {
  const settings = normalizeTreatment(input);
  const filters = [];
  if (settings.trimSilence) { const edge = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15'; filters.push(edge, 'areverse', edge, 'areverse'); }
  if (settings.denoise) filters.push('afftdn=nf=-25');
  if (settings.highpass) filters.push('highpass=f=80');
  const preset = VOICE_PRESETS[settings.preset];
  if (preset.pitch) filters.push(`rubberband=pitch=${round(2 ** (preset.pitch / 12), 5)}:formant=preserved`);
  if (preset.bass) filters.push(`bass=g=${preset.bass}:f=110`);
  if (settings.compress) filters.push('acompressor=threshold=-18dB:ratio=2.5:attack=12:release=120');
  if (settings.normalize) filters.push(`loudnorm=I=${settings.targetLufs}:TP=-1.5:LRA=11`);
  return filters;
}

const WAV_OUT = ['-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '1'];

/** Converte qualquer áudio/vídeo em WAV PCM 48 kHz mono. */
export async function toWav(ffmpeg, source, target, { signal } = {}) {
  await ffmpegRun(ffmpeg, ['-i', path.resolve(source), '-vn', ...WAV_OUT, '-y', target], { signal, target });
}

/**
 * Monta trechos (com corte não destrutivo) e aplica filtros em um único passo.
 * `parts`: [{ file, start?, end? }]. `limitSeconds` gera só o começo (preview).
 */
export async function renderParts(ffmpeg, parts, output, { filters = [], limitSeconds = null, signal } = {}) {
  if (!parts.length) throw new Error('Selecione ao menos um take');
  const inputs = parts.flatMap(part => ['-i', part.file]);
  const chains = parts.map((part, index) => {
    const trim = part.end > 0 ? `atrim=start=${round(part.start || 0)}:end=${round(part.end)},` : part.start > 0 ? `atrim=start=${round(part.start)},` : '';
    return `[${index}:a]${trim}asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=mono[p${index}]`;
  });
  const joined = `${parts.map((_, index) => `[p${index}]`).join('')}concat=n=${parts.length}:v=0:a=1[joined]`;
  const tail = filters.length ? `;[joined]${filters.join(',')}[out]` : ';[joined]anull[out]';
  const target = path.resolve(output);
  await mkdir(path.dirname(target), { recursive: true });
  await ffmpegRun(ffmpeg, [...inputs, '-filter_complex', `${chains.join(';')};${joined}${tail}`, '-map', '[out]', ...(limitSeconds ? ['-t', String(limitSeconds)] : []), ...WAV_OUT, '-y', target], { signal, target });
  return target;
}

/** Duração, formato, pico verdadeiro e loudness integrado (EBU R128). */
export async function measureAudio({ ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' }, file) {
  const { stdout } = await run(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration,format_name', '-of', 'json', path.resolve(file)], { timeout: 60_000 });
  const probe = JSON.parse(stdout); const stream = probe.streams?.[0];
  if (!stream) throw new Error('Arquivo sem áudio');
  const { stderr } = await run(ffmpeg, ['-hide_banner', '-nostats', '-i', path.resolve(file), '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { timeout: 30 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  const lufs = [...stderr.matchAll(/\bI:\s+(-?[\d.]+|-inf) LUFS/g)].at(-1)?.[1];
  const peak = [...stderr.matchAll(/Peak:\s+(-?[\d.]+|-inf) dBFS/g)].at(-1)?.[1];
  const number = value => (value === undefined || value === '-inf' ? null : Number(value));
  const measures = { durationSeconds: round(Number(probe.format?.duration || 0)), codec: stream.codec_name, sampleRate: Number(stream.sample_rate), channels: Number(stream.channels), container: probe.format?.format_name || null, integratedLufs: number(lufs), truePeakDb: number(peak) };
  measures.wav48kMono = measures.codec === 'pcm_s16le' && measures.sampleRate === 48000 && measures.channels === 1 && /wav/.test(measures.container || '');
  return measures;
}

/** Cenas narráveis do roteiro: parágrafos da abertura, desenvolvimento e payoff (direção visual e fontes não são narradas). */
export const SCENE_SECTIONS = { hook: 'Abertura', development: 'Desenvolvimento', payoff: 'Payoff' };
export function scenesFromScript(script = {}) {
  const scenes = [];
  for (const [section, label] of Object.entries(SCENE_SECTIONS)) {
    const paragraphs = String(script[section] || '').split(/\n\s*\n/).map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
    for (const [index, text] of paragraphs.entries()) scenes.push({ id: `${section}-${index + 1}`, section, label: `${label} ${index + 1}`, text, characters: text.length });
  }
  return scenes;
}

/** Chave de cache de uma cena gerada: muda se texto, perfil, amostra ou modelo mudarem. */
export function generationKey({ model = 'voxcpm2', profile, text }) {
  return createHash('sha256').update(JSON.stringify({ model, profile: profile.id, sample: profile.sampleSha256, reference: profile.referenceText, text: text.trim() })).digest('hex').slice(0, 32);
}

const EMPTY = () => ({ schema: 'contentlab-narration-v1', revision: 0, takes: [], treatment: { ...DEFAULT_TREATMENT }, assembled: null });

/**
 * Sessão de narração do projeto em `<projeto>/narration/`: takes com original
 * preservado, cortes não destrutivos, ordem, tratamento e montagem. Revisão
 * otimista no manifesto; escritas serializadas no processo.
 */
export class NarrationStore {
  static #queues = new Map();

  constructor(projectDirectory) { this.root = path.join(path.resolve(projectDirectory), 'narration'); this.manifest = path.join(this.root, 'narration.json'); }

  async read() {
    try { return { ...EMPTY(), ...JSON.parse(await readFile(this.manifest, 'utf8')) }; }
    catch (error) { if (error.code === 'ENOENT') return EMPTY(); throw error; }
  }

  /** Aplica `change(session)` com conferência de revisão; devolve a sessão salva. */
  async mutate(baseRevision, change) {
    const previous = NarrationStore.#queues.get(this.manifest) || Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const session = await this.read();
      if (baseRevision !== undefined && baseRevision !== null && baseRevision !== session.revision) throw Object.assign(new Error(`A narração mudou (revisão ${session.revision}); recarregue antes de salvar`), { code: 'NARRATION_CONFLICT' });
      const result = await change(session);
      session.revision += 1;
      await mkdir(this.root, { recursive: true });
      const temporary = `${this.manifest}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
      await rename(temporary, this.manifest);
      return { session, result };
    });
    NarrationStore.#queues.set(this.manifest, next);
    try { return await next; } finally { if (NarrationStore.#queues.get(this.manifest) === next) NarrationStore.#queues.delete(this.manifest); }
  }

  resolve(relative) {
    const target = path.resolve(this.root, relative);
    if (!target.startsWith(`${this.root}${path.sep}`)) throw new Error('Caminho fora da narração');
    return target;
  }

  takeDirectory(id) { if (!/^take_[a-z0-9]{6,32}$/.test(id)) throw new Error('ID de take inválido'); return path.join(this.root, 'takes', id); }

  /**
   * Cria um take: guarda o original como veio e um WAV 48 kHz mono de trabalho.
   * `extra` (perfil, cena, chave) marca takes de voz gerada.
   */
  async createTake({ source, name, origin, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', signal, extra = {}, moveSource = false }) {
    const id = `take_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const directory = this.takeDirectory(id);
    await mkdir(directory, { recursive: true });
    try {
      const extension = (path.extname(source).toLowerCase().match(/^\.[a-z0-9]{1,5}$/) || ['.bin'])[0];
      const original = path.join(directory, `original${extension}`);
      if (moveSource) await rename(source, original).catch(async () => { await copyFile(source, original); await rm(source, { force: true }); });
      else await copyFile(path.resolve(source), original);
      const work = path.join(directory, 'take.wav');
      await toWav(ffmpeg, original, work, { signal });
      const measures = await measureAudio({ ffmpeg, ffprobe }, work);
      if (!(measures.durationSeconds > 0.05)) throw new Error('Áudio vazio ou curto demais');
      return { id, name: String(name || 'Take').slice(0, 80), origin, original: path.relative(this.root, original), file: path.relative(this.root, work), sha256: await sha256File(work), durationSeconds: measures.durationSeconds, trim: null, createdAt: new Date().toISOString(), ...extra };
    } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
  }

  async removeTakeFiles(id) { await rm(this.takeDirectory(id), { recursive: true, force: true }); }
}

/** Perfis de voz globais (`<dados>/voices/<id>/`), sempre com consentimento do titular. */
export class VoiceProfileStore {
  constructor(root) { this.root = path.resolve(root); }

  #dir(id) { if (!/^voice_[a-z0-9]{6,32}$/.test(id)) throw new Error('ID de perfil inválido'); return path.join(this.root, id); }

  async create({ name, holder, consent, referenceText, samplePath, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' }) {
    if (consent !== true || !String(holder || '').trim()) throw Object.assign(new Error('Consentimento explícito do titular é obrigatório'), { code: 'CONSENT_REQUIRED' });
    if (!String(referenceText || '').trim()) throw Object.assign(new Error('Digite exatamente o texto lido na amostra'), { code: 'REFERENCE_TEXT_REQUIRED' });
    if (!String(name || '').trim()) throw new Error('Dê um nome ao perfil');
    const info = await stat(path.resolve(samplePath)).catch(() => null);
    if (!info?.isFile()) throw new Error('Amostra inválida');
    const id = `voice_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const directory = this.#dir(id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      const sample = path.join(directory, 'sample.wav');
      await toWav(ffmpeg, samplePath, sample);
      const measures = await measureAudio({ ffmpeg, ffprobe }, sample);
      if (measures.durationSeconds < 3 || measures.durationSeconds > 60) throw new Error(`A amostra deve ter de 3 a 60 segundos (tem ${measures.durationSeconds.toFixed(1)} s)`);
      if (measures.integratedLufs === null || measures.integratedLufs < -50) throw new Error('A amostra está silenciosa demais');
      const value = { schema: 'contentlab-voice-profile-v1', id, name: String(name).trim().slice(0, 80), samplePath: sample, sampleSha256: await sha256File(sample), referenceText: String(referenceText).trim(), consent: { granted: true, holder: String(holder).trim().slice(0, 120), grantedAt: new Date().toISOString(), statement: 'O titular autorizou o uso da própria voz para gerar narrações neste computador.' }, measures, model: 'voxcpm2', createdAt: new Date().toISOString() };
      await writeFile(path.join(directory, 'profile.json'), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
      return value;
    } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
  }

  async read(id) {
    try { return JSON.parse(await readFile(path.join(this.#dir(id), 'profile.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') throw Object.assign(new Error('Perfil de voz não encontrado'), { code: 'UNKNOWN_PROFILE' }); throw error; }
  }

  async list() {
    const entries = await readdir(this.root, { withFileTypes: true }).catch(() => []);
    const profiles = [];
    for (const entry of entries.filter(item => item.isDirectory() && item.name.startsWith('voice_'))) { try { profiles.push(await this.read(entry.name)); } catch { /* perfil incompleto é ignorado */ } }
    return profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async remove(id) { await rm(this.#dir(id), { recursive: true, force: true }); }
}

async function ffmpegRun(ffmpeg, args, { signal, target }) {
  try { await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { timeout: 6 * 60 * 60_000, maxBuffer: 8 * 1024 * 1024, signal }); }
  catch (error) {
    await rm(target, { force: true });
    if (signal?.aborted) throw Object.assign(new Error('Cancelado'), { code: 'CANCELLED' });
    throw new Error(`Falha de áudio: ${`${error.stderr || error.message}`.trim().split(/\r?\n/).slice(-2).join(' ')}`);
  }
}

function round(value, digits = 3) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }

/**
 * Voz clonada com VoxCPM2. Cada geração usa o plano de hardware do momento:
 * dispositivo, núcleos e teto de memória sem swap (Linux: systemd-run), com
 * prioridade baixa. Estourar o teto encerra só a geração, nunca o sistema.
 */
export const STANDARD_VOICES = [
  { id: 'pm_alex', label: 'Alex (masculina)' },
  { id: 'pf_dora', label: 'Dora (feminina)' },
  { id: 'pm_santa', label: 'Santa (masculina, grave)' },
];

/** Perfil "virtual" da narração padrão: entra na mesma chave de cache das cenas. */
export function standardProfile(voice = 'pm_alex', speed = 1) {
  if (!STANDARD_VOICES.some(item => item.id === voice)) throw Object.assign(new Error(`Voz padrão desconhecida: ${voice}`), { code: 'INVALID_VOICE' });
  const rate = Number(speed);
  if (!(rate >= 0.5 && rate <= 2)) throw Object.assign(new Error('Velocidade da narração deve ficar entre 0,5 e 2'), { code: 'INVALID_VOICE' });
  return { id: `standard-${voice}-${rate}`, sampleSha256: 'kokoro-82m-v1.0', referenceText: '', voice, speed: rate };
}

/** Narração padrão (Kokoro-82M, PT-BR, sem clonagem). Leve: CPU, sem limite de memória especial. */
export class KokoroVoice {
  static model = 'kokoro';
  constructor({ runner = 'contentlab-tts', modelPath, spawnFile = execFile } = {}) { this.runner = runner; this.modelPath = modelPath; this.spawnFile = spawnFile; }
  async generate({ text, voice = 'pm_alex', speed = 1, output, signal }) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'contentlab-tts-'));
    try {
      const textFile = path.join(directory, 'texto.txt');
      await writeFile(textFile, String(text).trim());
      const threads = Math.max(1, Math.min(8, os.cpus().length - 2));
      await new Promise((resolve, reject) => this.spawnFile(this.runner, ['--model', this.modelPath, '--voice', voice, '--speed', String(speed), '--lang', 'pt-br', '--text-file', textFile, '--output', path.resolve(output), '--threads', String(threads)], { timeout: 60 * 60_000, maxBuffer: 4 * 1024 * 1024, signal }, (error, stdout, stderr) => {
        if (!error) return resolve(stdout);
        if (error.code === 'ENOENT') return reject(Object.assign(new Error('Narração padrão não instalada: instale em Dependências'), { code: 'DEPENDENCY_MISSING' }));
        let message = error.message; try { message = JSON.parse(String(stderr).trim().split('\n').pop()).error || message; } catch { /* texto livre */ }
        reject(Object.assign(new Error(`Narração padrão falhou: ${message}`), { code: signal?.aborted ? 'CANCELLED' : 'VOICE_FAILED' }));
      }));
      return { output: path.resolve(output) };
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
}

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

