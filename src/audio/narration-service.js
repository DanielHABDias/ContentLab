import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sha256File } from '../media/media-service.js';

const run = promisify(execFile);

/**
 * Tratamento da narração, refeito do zero em cima de dois modelos locais:
 * - DeepFilterNet3 (`deep-filter`): remoção de ruído por IA, a 48 kHz, em CPU;
 * - Silero VAD (via whisper.cpp): separa fala de pausa, respiro e ruído entre frases.
 * Com eles: tira o ruído de fundo, silencia respiros, encurta pausas longas e deixa a voz
 * no volume certo. Os originais nunca são alterados.
 */
export const DEFAULT_TREATMENT = { aiDenoise: true, removeBreaths: true, trimPauses: true, maxPauseSeconds: 0.4, compress: true, normalize: true, targetLufs: -16 };

/** Aceita também o formato antigo (denoise/trimSilence/preset), salvo em narrações existentes. */
export function normalizeTreatment(input = {}) {
  const legacy = {};
  if ('denoise' in input && !('aiDenoise' in input)) legacy.aiDenoise = input.denoise;
  if ('trimSilence' in input && !('trimPauses' in input)) legacy.trimPauses = input.trimSilence;
  const value = { ...DEFAULT_TREATMENT, ...legacy, ...input };
  for (const key of ['aiDenoise', 'removeBreaths', 'trimPauses', 'compress', 'normalize']) value[key] = Boolean(value[key]);
  value.targetLufs = Number(value.targetLufs);
  if (!(value.targetLufs >= -24 && value.targetLufs <= -10)) throw new Error('Loudness alvo deve ficar entre -24 e -10 LUFS');
  value.maxPauseSeconds = Number(value.maxPauseSeconds);
  if (!(value.maxPauseSeconds >= 0.15 && value.maxPauseSeconds <= 2)) throw new Error('Pausa máxima deve ficar entre 0,15 e 2 s');
  return { aiDenoise: value.aiDenoise, removeBreaths: value.removeBreaths, trimPauses: value.trimPauses, maxPauseSeconds: value.maxPauseSeconds, compress: value.compress, normalize: value.normalize, targetLufs: value.targetLufs };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const DEFAULT_ANALYSIS = { noiseFloorDb: -60, speechLevelDb: -24 };

/** Forma da voz depois da limpeza: high-pass suave e compressão de locução relativa ao nível da fala. */
export function treatmentFilters(input, analysis = DEFAULT_ANALYSIS) {
  const settings = normalizeTreatment(input);
  const speech = Number.isFinite(analysis.speechLevelDb) ? analysis.speechLevelDb : DEFAULT_ANALYSIS.speechLevelDb;
  const filters = [];
  if (settings.aiDenoise) filters.push('highpass=f=70:poles=2');
  if (settings.compress) filters.push(`acompressor=threshold=${round(clamp(speech - 6, -40, -10), 1)}dB:ratio=2.5:attack=15:release=180:knee=4:makeup=1`);
  return filters;
}

/** Nível final: ganho linear medido até o alvo e limitador de pico (sem loudnorm dinâmico). */
export function finishFilters(input, measuredLufs) {
  const settings = normalizeTreatment(input);
  if (!settings.normalize || !Number.isFinite(measuredLufs)) return [];
  const gain = round(clamp(settings.targetLufs - measuredLufs, -30, 36), 2);
  return [`volume=${gain}dB`, 'alimiter=limit=0.79:attack=5:release=60:level=false'];
}

/** Piso de ruído (percentil 10) e nível da fala (percentil 90) em janelas de 50 ms, mais o loudness integrado. */
export async function analyzeVoice(ffmpeg, file, { signal } = {}) {
  const { stdout, stderr } = await run(ffmpeg, ['-hide_banner', '-nostats', '-i', path.resolve(file), '-af', 'aresample=48000,asetnsamples=n=2400:p=0,astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=RMS_level,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-,ebur128=framelog=quiet', '-f', 'null', '-'], { timeout: 30 * 60_000, maxBuffer: 64 * 1024 * 1024, signal });
  const levels = [...stdout.matchAll(/RMS_level=(-?[\d.]+)/g)].map(match => Number(match[1])).filter(Number.isFinite).sort((x, y) => x - y);
  const pick = ratio => (levels.length ? levels[Math.min(levels.length - 1, Math.floor(levels.length * ratio))] : null);
  const lufs = [...stderr.matchAll(/\bI:\s+(-?[\d.]+|-inf) LUFS/g)].at(-1)?.[1];
  return { noiseFloorDb: pick(0.1), speechLevelDb: pick(0.9), integratedLufs: lufs === undefined || lufs === '-inf' ? null : Number(lufs) };
}

/** Remove o ruído com o DeepFilterNet3 (atraso do modelo compensado). */
export async function aiDenoise(deepFilter, source, target, { signal } = {}) {
  const directory = `${path.resolve(target)}.df`;
  await mkdir(directory, { recursive: true });
  try {
    await run(deepFilter, ['--compensate-delay', '--output-dir', directory, path.resolve(source)], { timeout: 6 * 60 * 60_000, maxBuffer: 16 * 1024 * 1024, signal });
    await rename(path.join(directory, path.basename(source)), target);
  } catch (error) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelado'), { code: 'CANCELLED' });
    throw new Error(`Falha na limpeza por IA: ${`${error.stderr || error.message}`.trim().split(/\r?\n/).slice(-2).join(' ')}`);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

/** Trechos de fala (em segundos) detectados pelo Silero VAD. */
export async function speechSegments({ binary, model }, file, { signal } = {}) {
  const { stdout, stderr } = await run(binary, ['--vad-model', model, '--file', path.resolve(file), '--no-prints', '--vad-min-silence-duration-ms', '120', '--vad-speech-pad-ms', '30'], { timeout: 30 * 60_000, maxBuffer: 16 * 1024 * 1024, signal });
  // O exemplo do whisper.cpp imprime os tempos em centésimos de segundo.
  return [...`${stdout}\n${stderr}`.matchAll(/start = ([\d.]+), end = ([\d.]+)/g)].map(match => ({ start: Number(match[1]) / 100, end: Number(match[2]) / 100 })).filter(item => item.end > item.start);
}

/**
 * Plano de edição a partir dos trechos de fala: cada fala ganha uma folga curta, as pausas
 * longas viram `maxPauseSeconds` e, com `removeBreaths`, o que fica entre as falas
 * (respiro, estalo, ruído) vira silêncio.
 */
export function editPlan(segments, duration, input) {
  const settings = normalizeTreatment(input);
  if (!segments.length || !(settings.trimPauses || settings.removeBreaths)) return null;
  const PRE = 0.08; const POST = 0.14; const EDGE = 0.2;
  const spans = [];
  for (const segment of segments) {
    const start = clamp(segment.start - PRE, 0, duration); const end = clamp(segment.end + POST, 0, duration);
    const last = spans.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, end); else spans.push({ start, end });
  }
  const pieces = []; const gapLength = (length, limit) => (settings.trimPauses ? Math.min(length, limit) : length);
  const gap = (from, to, limit) => {
    const length = gapLength(to - from, limit);
    if (length < 0.01) return;
    pieces.push(settings.removeBreaths ? { silence: round(length) } : { start: round(from), end: round(from + length) });
  };
  gap(0, spans[0].start, EDGE);
  spans.forEach((span, index) => { pieces.push({ start: round(span.start), end: round(span.end) }); if (spans[index + 1]) gap(span.end, spans[index + 1].start, settings.maxPauseSeconds); });
  gap(spans.at(-1).end, duration, EDGE);
  const kept = pieces.reduce((sum, piece) => sum + (piece.silence ?? piece.end - piece.start), 0);
  return { pieces, removedSeconds: round(Math.max(0, duration - kept), 2) };
}

async function applyEdit(ffmpeg, source, target, plan, { signal }) {
  const fade = 0.012;
  const chains = plan.pieces.map((piece, index) => piece.silence !== undefined
    ? `aevalsrc=0:d=${piece.silence}:s=48000:c=mono[p${index}]`
    : `[0:a]atrim=start=${piece.start}:end=${piece.end},asetpts=PTS-STARTPTS,afade=t=in:d=${fade},afade=t=out:st=${round(Math.max(0, piece.end - piece.start - fade))}:d=${fade}[p${index}]`);
  const graph = `${chains.join(';')};${plan.pieces.map((_, index) => `[p${index}]`).join('')}concat=n=${plan.pieces.length}:v=0:a=1[out]`;
  await ffmpegRun(ffmpeg, ['-i', source, '-filter_complex', graph, '-map', '[out]', ...WAV_OUT, '-y', target], { signal, target });
}

/**
 * Tratamento completo: monta os trechos sem filtro (`rawOutput` = "sem tratamento" no preview),
 * limpa com IA, corta pausas e respiros pelo VAD, dá forma à voz e acerta o volume.
 * `ai`: { deepFilter, vad: { binary, model } } — caminhos dos modelos locais.
 */
export async function treatParts(ffmpeg, parts, output, settingsInput, { rawOutput, limitSeconds = null, signal, ai = {} } = {}) {
  const settings = normalizeTreatment(settingsInput);
  const target = path.resolve(output);
  const raw = path.resolve(rawOutput || `${target}.bruto.wav`);
  const temp = name => `${target}.${name}.wav`;
  const temps = [temp('limpo'), temp('editado'), temp('forma')];
  try {
    await renderParts(ffmpeg, parts, raw, { limitSeconds, signal });
    let current = raw;
    if (settings.aiDenoise) {
      if (!ai.deepFilter) throw Object.assign(new Error('Limpeza por IA indisponível: instale “Limpeza de voz com IA” em Dependências'), { code: 'DEPENDENCY_MISSING' });
      await aiDenoise(ai.deepFilter, current, temps[0], { signal }); current = temps[0];
    }
    let plan = null;
    if (settings.trimPauses || settings.removeBreaths) {
      if (!ai.vad?.binary || !ai.vad?.model) throw Object.assign(new Error('Detecção de pausas indisponível: instale “Whisper large-v3” em Dependências'), { code: 'DEPENDENCY_MISSING' });
      const duration = (await measureAudio({ ffmpeg, ffprobe: ai.ffprobe || 'ffprobe' }, current)).durationSeconds;
      plan = editPlan(await speechSegments(ai.vad, current, { signal }), duration, settings);
      if (plan) { await applyEdit(ffmpeg, current, temps[1], plan, { signal }); current = temps[1]; }
    }
    const analysis = await analyzeVoice(ffmpeg, current, { signal });
    const shaping = treatmentFilters(settings, analysis);
    if (shaping.length) { await ffmpegRun(ffmpeg, ['-i', current, '-af', shaping.join(','), ...WAV_OUT, '-y', temps[2]], { signal, target: temps[2] }); current = temps[2]; }
    const finish = finishFilters(settings, settings.normalize ? (await analyzeVoice(ffmpeg, current, { signal })).integratedLufs : null);
    await ffmpegRun(ffmpeg, ['-i', current, '-af', finish.length ? finish.join(',') : 'anull', ...WAV_OUT, '-y', target], { signal, target });
    return { target, analysis, removedSeconds: plan?.removedSeconds || 0 };
  } finally {
    await Promise.all(temps.map(file => rm(file, { force: true })));
    if (!rawOutput) await rm(raw, { force: true });
  }
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
    const paragraphs = String(script[section] || '').split(/\n\s*\n/).map(scriptLines).filter(lines => lines.length);
    for (const [index, lines] of paragraphs.entries()) {
      const text = lines.map(line => line.text).join(' ');
      scenes.push({ id: `${section}-${index + 1}`, section, label: `${label} ${index + 1}`, text, characters: text.length, lines });
    }
  }
  return scenes;
}

/**
 * Linhas faladas de um parágrafo do roteiro. A direção visual entre colchetes (ex.: "[evidencia: capa.jpg]")
 * guia a montagem e nunca é narrada, lida pela voz, legendada nem posta em slide.
 */
export function scriptLines(paragraph = '') {
  return String(paragraph).split(/\n/).map(raw => {
    const direction = [...raw.matchAll(/\[([^\]]*)\]/g)].map(match => match[1].trim()).filter(Boolean);
    const text = raw.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
    return { text, direction: direction.join('; ') || null };
  }).filter(line => line.text);
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

/**
 * Texto de leitura do perfil de voz (~150 palavras, cerca de 60 s em ritmo de narração).
 * Cobre os sons do PT-BR, com pergunta, exclamação, números e pausas, para o VoxCPM2
 * aprender entonação, e não só timbre. Quem gravar pode corrigir o texto se trocar palavras.
 */
export const VOICE_SAMPLE_TEXT = `Olá! Este é o meu perfil de voz para o Content Lab. Vou ler este texto com calma, do jeito que eu falo nos meus vídeos. Hoje o céu amanheceu limpo, e a cidade acordou devagar: o padeiro abriu a porta às seis e quinze, o ônibus passou lotado e alguém gritou lá da esquina. Você já reparou como cada lugar tem um som próprio? Na praia, as ondas quebram sem pressa; na floresta, os pássaros conversam entre os galhos; no centro, as buzinas não param nunca. Eu gosto de histórias que começam pequenas e crescem aos poucos. Um detalhe, uma pergunta, uma ideia que ninguém tinha percebido. Então eu pesquiso, escrevo, gravo e edito, até tudo fazer sentido. Será que vai dar certo? Às vezes dá, às vezes não. Mas cada vídeo me ensina alguma coisa nova. Obrigado por ouvir até aqui, e até a próxima!`;

/** Limite de gravação da amostra, em segundos: o VoxCPM2 recusa amostras acima de 60 s. */
export const VOICE_SAMPLE_LIMIT_SECONDS = 58;

/** Frase curta gerada com o perfil para a pessoa conferir como a voz clonada ficou. */
export const VOICE_CHECK_PHRASE = 'Testando a minha voz clonada no Content Lab. Será que ficou parecido? Fala comigo nos comentários!';

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

  /** Caminho da amostra "como ficou" (frase curta gerada com o próprio perfil). */
  checkSamplePath(id) { return path.join(this.#dir(id), 'check.wav'); }

  /** Registra no perfil a amostra gerada para conferência; não toca na amostra gravada. */
  async recordCheckSample(id, { phrase, measures }) {
    const profile = await this.read(id);
    const value = { ...profile, checkSample: { file: this.checkSamplePath(id), phrase, measures, generatedAt: new Date().toISOString() } };
    await writeFile(path.join(this.#dir(id), 'profile.json'), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    return value;
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
export class VoxCPMVoice {
  static model = 'voxcpm2';
  constructor({ runner = 'contentlab-voice', runtime = 'python', acousticPath, tools = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' }, modelPath, planner, onMeasured = async () => {}, spawnFile = execFile, platform = process.platform } = {}) {
    this.runner = runner; this.runtime = runtime; this.acousticPath = acousticPath; this.tools = tools; this.model = runtime === 'native' ? 'voxcpm2-q8-v1' : VoxCPMVoice.model; this.modelPath = modelPath; this.planner = planner; this.onMeasured = onMeasured; this.spawnFile = spawnFile; this.platform = platform;
  }

  async diagnose() {
    try {
      if (this.runtime === 'native') {
        for (const file of [this.runner, this.modelPath, this.acousticPath]) if (!file || !(await stat(file).catch(() => null))) throw new Error('Modo econômico não instalado');
      } else await run(this.runner, ['--version'], { timeout: 10_000 });
    }
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
    const status = await this.diagnose(); if (!status.ready) throw Object.assign(new Error(status.issues.join('; ')), { code: 'DEPENDENCY_MISSING', details: { missing: [this.runtime === 'native' ? 'voxcpm2-q8' : 'voxcpm2'] } });
    const plan = await this.planner();
    if (plan.status !== 'ready') throw Object.assign(new Error(plan.reasons.join(' ') || 'Recursos insuficientes'), { code: plan.status === 'unsupported' ? 'HARDWARE_UNSUPPORTED' : 'NEEDS_FREE_MEMORY', details: { plan } });
    const target = path.resolve(output);
    await mkdir(path.dirname(target), { recursive: true });
    const native = this.runtime === 'native';
    const nativeOutput = `${target}.partial.wav`;
    const args = native
      ? ['--cpu', '--stream', '--text', text, '--prompt-wav', profile.samplePath, '--prompt-text', profile.referenceText, '--output', nativeOutput, '--steps', '2000', this.modelPath, this.acousticPath]
      : ['--model', this.modelPath, '--device', plan.device, '--threads', String(plan.threads), '--reference', profile.samplePath, '--reference-text', profile.referenceText, '--text', text, '--output', target];
    const started = Date.now();
    const [command, commandArgs] = this.command(plan, args);
    let stdout;
    const options = { timeout: 6 * 60 * 60_000, maxBuffer: 16 * 1024 * 1024, signal, env: { ...process.env, OMP_NUM_THREADS: String(plan.threads), MKL_NUM_THREADS: String(plan.threads), HF_HUB_OFFLINE: '1' } };
    try { ({ stdout } = await new Promise((resolve, reject) => this.spawnFile(command, commandArgs, options, (error, out, err) => (error ? reject(Object.assign(error, { stdout: out, stderr: err })) : resolve({ stdout: out, stderr: err }))))); }
    catch (error) {
      await rm(`${target}.partial.wav`, { force: true });
      if (signal?.aborted) throw Object.assign(new Error('Geração de voz cancelada'), { code: 'CANCELLED' });
      if (error.code === 137 || (error.code === 143 && plan.memoryGuard === 'systemd') || error.signal === 'SIGKILL') throw Object.assign(new Error(`A geração passou do limite de memória (${Math.round(plan.memoryLimitBytes / 1024 ** 3)} GB) e foi encerrada sem afetar o sistema. Feche programas e tente de novo.`), { code: 'MEMORY_LIMIT', details: { plan } });
      throw new Error(`Falha na geração de voz: ${`${error.stderr || error.message}`.trim().split(/\r?\n/).slice(-2).join(' ')}`);
    }
    let result;
    if (native) {
      try {
        const measured = await measureAudio(this.tools, nativeOutput);
        if (!(measured.durationSeconds > 0) || measured.sampleRate !== 48000 || measured.channels !== 1) throw new Error('O modo econômico não gerou um WAV 48 kHz mono válido');
        await rename(nativeOutput, target);
        const seconds = (Date.now() - started) / 1000;
        result = { generationSeconds: seconds, audioSeconds: measured.durationSeconds, realtimeFactor: seconds / measured.durationSeconds };
      } catch (error) { await rm(nativeOutput, { force: true }); throw error; }
    } else result = JSON.parse(`${stdout}`.trim().split(/\r?\n/).at(-1));
    await this.onMeasured({ device: plan.device, realtimeFactor: result.realtimeFactor });
    return { path: target, model: this.model, device: plan.device, seconds: result.generationSeconds, audioSeconds: result.audioSeconds, realtimeFactor: result.realtimeFactor };
  }
}

