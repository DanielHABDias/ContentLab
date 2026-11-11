import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

/**
 * Transcrições por mídia em `<projeto>/transcripts/<mediaId>/`:
 * - raw.json / raw.srt: saída do Whisper, nunca reescrita por revisões;
 * - revised.json: correções do usuário (texto e tempos), versionadas por `revision`;
 * - meta.json: chave de idempotência (SHA-256 da mídia + modelo + idioma).
 */
export class TranscriptStore {
  constructor(projectDirectory) { this.root = path.join(path.resolve(projectDirectory), 'transcripts'); }

  #dir(mediaId) {
    if (!/^[a-z][a-z0-9_-]{2,63}$/.test(mediaId)) throw new Error('ID de mídia inválido');
    return path.join(this.root, mediaId);
  }

  async meta(mediaId) { return await readJson(path.join(this.#dir(mediaId), 'meta.json')); }

  async saveRaw(mediaId, { segments, srt, key }) {
    const directory = this.#dir(mediaId);
    await mkdir(directory, { recursive: true });
    await atomic(path.join(directory, 'raw.json'), `${JSON.stringify({ schema: 'contentlab-transcript-v1', segments }, null, 2)}\n`);
    await atomic(path.join(directory, 'raw.srt'), srt);
    await atomic(path.join(directory, 'meta.json'), `${JSON.stringify({ ...key, segments: segments.length, createdAt: new Date().toISOString() }, null, 2)}\n`);
  }

  async read(mediaId) {
    const directory = this.#dir(mediaId);
    const raw = await readJson(path.join(directory, 'raw.json'));
    if (!raw) return null;
    const revised = await readJson(path.join(directory, 'revised.json'));
    return { raw: raw.segments, revised: revised?.segments || null, revision: revised?.revision || 0, meta: await this.meta(mediaId), current: revised?.segments || raw.segments };
  }

  /** Salva correções sem tocar na saída bruta; recusa revisão desatualizada. */
  async saveRevision(mediaId, { baseRevision, segments }) {
    const current = await this.read(mediaId);
    if (!current) throw new Error('Esta mídia ainda não foi transcrita');
    if (baseRevision !== current.revision) throw Object.assign(new Error(`A transcrição mudou (revisão ${current.revision}); recarregue antes de salvar`), { code: 'TRANSCRIPT_CONFLICT' });
    const clean = validateSegments(segments);
    const revision = current.revision + 1;
    await atomic(path.join(this.#dir(mediaId), 'revised.json'), `${JSON.stringify({ schema: 'contentlab-transcript-v1', revision, segments: clean, updatedAt: new Date().toISOString() }, null, 2)}\n`);
    return { revision, segments: clean };
  }

  srt(segments) { return toSrt(segments); }
}

export function validateSegments(segments) {
  if (!Array.isArray(segments) || segments.length > 20_000) throw new Error('Lista de trechos inválida');
  return segments.map((segment, index) => {
    const start = Number(segment.start); const end = Number(segment.end); const text = String(segment.text ?? '').trim();
    if (!(start >= 0) || !(end > start)) throw new Error(`Trecho ${index + 1}: tempo inválido`);
    if (index && start < Number(segments[index - 1].start)) throw new Error(`Trecho ${index + 1}: fora de ordem`);
    if (text.length > 2000) throw new Error(`Trecho ${index + 1}: texto longo demais`);
    return { start: round(start), end: round(end), text };
  });
}

/** Converte a saída JSON completa do whisper.cpp (`-ojf`) em trechos em segundos. */
export function segmentsFromWhisper(json) {
  return (json.transcription || []).map(item => ({ start: round((item.offsets?.from ?? 0) / 1000), end: round((item.offsets?.to ?? 0) / 1000), text: String(item.text || '').trim() })).filter(segment => segment.text && segment.end > segment.start);
}

export function toSrt(segments) {
  return segments.map((segment, index) => `${index + 1}\n${timecode(segment.start)} --> ${timecode(segment.end)}\n${segment.text}\n`).join('\n');
}

export function timecode(seconds) {
  const ms = Math.round(seconds * 1000);
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

/** "83", "1:23", "01:02:03" ou "1:23,5" → segundos; texto livre → null. */
export function parseTimecode(value) {
  const match = String(value).trim().match(/^(?:(\d+):)?(?:(\d{1,2}):)?(\d{1,2}(?:[.,]\d+)?)$/);
  if (!match) return null;
  const parts = [match[1], match[2], match[3]].filter(part => part !== undefined).map(part => Number(String(part).replace(',', '.')));
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function normalize(text) { return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

/** Busca por texto (sem acento/caixa) ou por timecode. */
export function searchSegments(segments, query) {
  const seconds = parseTimecode(query);
  if (seconds !== null) return segments.filter(segment => segment.start <= seconds && seconds < segment.end + 0.001);
  const needle = normalize(query.trim());
  if (needle.length < 2) return [];
  return segments.filter(segment => normalize(segment.text).includes(needle));
}

function round(value) { return Math.round(value * 1000) / 1000; }
async function readJson(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function atomic(file, contents) { const temporary = `${file}.${randomUUID()}.tmp`; await writeFile(temporary, contents, { mode: 0o600 }); await rename(temporary, file); }

/** Lê SRT (UTF-8, com ou sem BOM) em trechos validados. */
export function parseSrt(text) {
  const blocks = String(text).replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/);
  const segments = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const index = lines.findIndex(line => line.includes('-->'));
    if (index < 0) continue;
    const [from, to] = lines[index].split('-->').map(part => part.trim().split(/\s+/)[0]);
    const start = parseTimecode(from); const end = parseTimecode(to);
    const content = lines.slice(index + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (start !== null && end !== null && content) segments.push({ start, end, text: content });
  }
  if (!segments.length) throw new Error('SRT sem legendas válidas');
  return validateSegments(segments.sort((a, b) => a.start - b.start));
}
