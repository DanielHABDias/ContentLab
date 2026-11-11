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
    const value = { schema: 'contentlab-voice-profile-v1', id, name, samplePath: path.resolve(samplePath), referenceText, consent, model: 'chatterbox-multilingual-v3-pt-br' };
    await mkdir(this.root, { recursive: true }); await writeFile(path.join(this.root, `${id}.json`), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); return value;
  }
}

export class ChatterboxVoice {
  static model = 'chatterbox-multilingual-v3-pt-br';
  constructor({ runner = 'contentlab-chatterbox', modelPath } = {}) { this.runner = runner; this.modelPath = modelPath; }
  async diagnose() { try { await run(this.runner, ['--version'], { timeout: 10_000 }); } catch (error) { if (error.code === 'ENOENT') return { ready: false, model: ChatterboxVoice.model, issues: ['Runtime Chatterbox ausente'] }; } return { ready: Boolean(this.modelPath), model: ChatterboxVoice.model, issues: this.modelPath ? [] : ['Pesos PT-BR ausentes'] }; }
  async generate({ text, profile, output }) {
    if (!profile?.consent?.granted) throw new Error('Perfil sem consentimento válido');
    const status = await this.diagnose(); if (!status.ready) throw new Error(status.issues.join('; '));
    await run(this.runner, ['--model', this.modelPath, '--language', 'pt-br', '--reference', profile.samplePath, '--text', text, '--output', path.resolve(output)], { timeout: 6 * 60 * 60_000 });
    return { path: path.resolve(output), model: ChatterboxVoice.model };
  }
}

function requireTake(session, id) { const take = session.takes.find(item => item.id === id); if (!take) throw new Error(`Take desconhecido: ${id}`); return take; }
