import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { LocalApplicationService } from './local-application-service.js';
import { createContentLabServer } from './http-server.js';
import { PortugueseTranscriber } from '../media/media-service.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const exists = target => stat(target).then(() => true, () => false);
const ALL = ['ffmpeg', 'ffprobe', 'zenity', 'yt-dlp', 'whisper-cli', 'whisper-large-v3', 'voxcpm2'];
function fakeSetup({ ready = ALL, tools = {} } = {}) {
  return { toolsDirectory: '/x', status: async () => ({ items: ALL.map(id => ({ id, label: id, ready: ready.includes(id) })) }), toolPath: async name => tools[name] || name, modelPath: () => '/x/model.bin', jobs: () => [] };
}
async function setup(options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-media-')); roots.push(root);
  const service = new LocalApplicationService({ dataDirectory: path.join(root, 'data'), setup: fakeSetup(options.setup), transcriber: options.transcriber });
  const project = await service.createProject({ title: 'Mídia completa', type: 'long', aspectRatio: '16:9' });
  return { root, service, project };
}
function tone(root, name, frequency = 440, duration = 1) {
  const file = path.join(root, name);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${duration}`, file]);
  return file;
}
const inspect = (service, project) => service.inspectProject(project.path).then(details => details.project);

test('importa vários arquivos com progresso, evita duplicata por hash e reporta inválidos', async () => {
  const { root, service, project } = await setup();
  const a = tone(root, 'a.wav'); const copy = path.join(root, 'mesmo-conteudo.wav'); await writeFile(copy, await readFile(a));
  const b = tone(root, 'b.wav', 880, 2); const broken = path.join(root, 'quebrado.mp4'); await writeFile(broken, 'não é vídeo');
  const job = await service.importMediaFiles({ path: project.path, sources: [a, copy, b, broken], rights: 'owned' });
  const done = await service.mediaOps.jobs.waitFor(job.id);
  expect(done).toMatchObject({ state: 'completed', progress: { done: 4, total: 4 }, result: { imported: 2, duplicates: 1, failed: 1 } });
  expect(done.result.results[3]).toMatchObject({ status: 'failed', error: expect.stringMatching(/Mídia inválida/) });
  const media = (await inspect(service, project)).media;
  expect(media).toHaveLength(2);
  expect(media.find(item => item.name === 'b.wav')).toMatchObject({ kind: 'audio', rights: 'owned', source: { type: 'file', value: b }, metadata: { durationSeconds: expect.closeTo(2, 1), sampleRate: 44100, audioCodec: 'pcm_s16le' }, cuts: [], transcript: null });
});

test('importação múltipla pode ser cancelada', async () => {
  const { root, service, project } = await setup();
  const sources = Array.from({ length: 6 }, (_, index) => tone(root, `t${index}.wav`, 300 + index * 50));
  const job = await service.importMediaFiles({ path: project.path, sources });
  service.cancelJob({ jobId: job.id });
  await expect(service.mediaOps.jobs.waitFor(job.id)).resolves.toMatchObject({ state: 'cancelled' });
  expect((await inspect(service, project)).media.length).toBeLessThan(6);
});

test('remover mídia em uso exige confirmação e desassocia thumbnail e clips', async () => {
  const { root, service, project } = await setup();
  let details = await service.importMedia({ path: project.path, baseRevision: 1, source: tone(root, 'a.wav'), rights: 'owned' });
  const mediaId = details.project.media[0].id;
  const creative = structuredClone(details.project.creative); creative.packaging.thumbnailMediaId = mediaId;
  details = await service.runProjectAction({ path: project.path, baseRevision: 2, action: { type: 'creative.update', creative } });
  details = await service.runProjectAction({ path: project.path, baseRevision: 3, action: { type: 'clip.add', trackId: 'audio_main', clip: { id: 'clip_a', type: 'media', startFrame: 0, durationInFrames: 30, sourceId: mediaId } } });
  expect(await service.mediaUsage({ path: project.path, mediaId })).toMatchObject({ thumbnail: true, clips: [{ trackId: 'audio_main', clipId: 'clip_a' }], total: 2 });
  await expect(service.removeMedia({ path: project.path, baseRevision: 4, mediaId })).rejects.toMatchObject({ code: 'MEDIA_IN_USE', message: expect.stringMatching(/thumbnail e 1 clip/) });
  const removed = await service.removeMedia({ path: project.path, baseRevision: 4, mediaId, detachUsages: true });
  expect(removed.project.media).toEqual([]);
  expect(removed.project.creative.packaging.thumbnailMediaId).toBeNull();
  expect(removed.project.timeline.tracks.flatMap(track => track.clips)).toEqual([]);
});

test('URL exige direitos, recusa playlist e rede local, e importa com yt-dlp do .tools', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-url-')); roots.push(root);
  const sample = tone(root, 'origem.wav');
  const ytDlp = path.join(root, 'yt-dlp');
  await writeFile(ytDlp, `#!/bin/sh\nwhile [ "$1" != "-o" ]; do shift; done\ntarget="$2"\ncp '${sample}' "$(dirname "$target")/source.wav"\n`, { mode: 0o755 });
  const service = new LocalApplicationService({ dataDirectory: path.join(root, 'data'), setup: fakeSetup({ tools: { 'yt-dlp': ytDlp } }) });
  const project = await service.createProject({ title: 'Com URL', type: 'long', aspectRatio: '16:9' });
  await expect(service.importMediaUrl({ path: project.path, url: 'https://exemplo.com/v', rights: 'pending', rightsConfirmed: true })).rejects.toMatchObject({ code: 'RIGHTS_REQUIRED' });
  await expect(service.importMediaUrl({ path: project.path, url: 'http://exemplo.com/v', rights: 'owned', rightsConfirmed: true })).rejects.toMatchObject({ code: 'INVALID_URL' });
  for (const url of ['https://www.youtube.com/playlist?list=PL123', 'https://127.0.0.1/video']) {
    const job = await service.importMediaUrl({ path: project.path, url, rights: 'owned', rightsConfirmed: true });
    await expect(service.mediaOps.jobs.waitFor(job.id)).resolves.toMatchObject({ state: 'failed', error: expect.stringMatching(/Playlists|locais/) });
  }
  const job = await service.importMediaUrl({ path: project.path, url: 'https://exemplo.com/meu-video', rights: 'licensed', rightsConfirmed: true });
  await expect(service.mediaOps.jobs.waitFor(job.id)).resolves.toMatchObject({ state: 'completed', result: { status: 'imported' } });
  expect((await inspect(service, project)).media[0]).toMatchObject({ rights: 'licensed', source: { type: 'url', value: 'https://exemplo.com/meu-video' } });
  const blocked = new LocalApplicationService({ dataDirectory: path.join(root, 'data2'), setup: fakeSetup({ ready: ['ffmpeg', 'ffprobe'] }) });
  const other = await blocked.createProject({ title: 'Sem yt-dlp', type: 'long', aspectRatio: '16:9' });
  await expect(blocked.importMediaUrl({ path: other.path, url: 'https://exemplo.com/v', rights: 'owned', rightsConfirmed: true })).rejects.toMatchObject({ code: 'DEPENDENCY_MISSING' });
});

test('cortes não destrutivos ficam em cache e respeitam a duração', async () => {
  const { root, service, project } = await setup();
  const source = tone(root, 'longo.wav', 440, 2);
  const details = await service.importMedia({ path: project.path, baseRevision: 1, source, rights: 'owned' });
  const mediaId = details.project.media[0].id;
  const cut = await service.createMediaCut({ path: project.path, baseRevision: 2, mediaId, start: 0.5, end: 1.5, name: 'meio' });
  const [created] = cut.project.media[0].cuts;
  expect(created).toMatchObject({ name: 'meio', start: 0.5, end: 1.5 });
  expect(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', created.uri]).toString())).toBeCloseTo(1, 0);
  expect(await stat(source)).toBeTruthy();
  await expect(service.createMediaCut({ path: project.path, baseRevision: 3, mediaId, start: 1, end: 9 })).rejects.toThrow(/duração/);
  const removed = await service.removeMediaCut({ path: project.path, baseRevision: 3, mediaId, cutId: created.id });
  expect(removed.project.media[0].cuts).toEqual([]);
});

test('upload via HTTP e preview com Range servem só mídia do projeto', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-http-media-')); roots.push(root);
  const server = createContentLabServer({ dataDirectory: path.join(root, 'data'), toolsDirectory: path.join(root, 'tools') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const created = await (await fetch(`${base}/projects/create`, { method: 'POST', headers: { 'x-contentlab-client': '1' }, body: JSON.stringify({ title: 'Upload', type: 'long', aspectRatio: '16:9' }) })).json();
    const body = await readFile(tone(root, 'arrastado.wav'));
    const upload = await fetch(`${base}/media/upload?path=${encodeURIComponent(created.path)}&name=arrastado.wav&rights=owned`, { method: 'POST', body, headers: { 'x-contentlab-client': '1', 'content-type': 'application/octet-stream' } });
    expect(upload.status).toBe(201);
    const result = await upload.json();
    expect(result).toMatchObject({ status: 'imported', name: 'arrastado.wav' });
    const file = `${base}/media/file?path=${encodeURIComponent(created.path)}&media=${result.mediaId}`;
    const partial = await fetch(file, { headers: { range: 'bytes=0-99' } });
    expect(partial.status).toBe(206);
    expect(partial.headers.get('content-range')).toBe(`bytes 0-99/${body.length}`);
    expect((await partial.arrayBuffer()).byteLength).toBe(100);
    const full = await fetch(file);
    expect(full.headers.get('content-type')).toBe('audio/wav');
    expect((await full.arrayBuffer()).byteLength).toBe(body.length);
    expect((await fetch(`${base}/media/file?path=${encodeURIComponent(created.path)}&media=media_inexistente`)).status).toBe(400);
    const bad = await fetch(`${base}/media/upload?path=${encodeURIComponent(created.path)}&name=script.sh`, { method: 'POST', headers: { 'x-contentlab-client': '1' }, body: 'echo' });
    expect((await bad.json()).error).toMatch(/Formato não suportado/);
  } finally { server.close(); }
});

const whisperJson = { transcription: [{ offsets: { from: 0, to: 1500 }, text: ' Olá mundo' }, { offsets: { from: 1500, to: 3000 }, text: ' teste de busca' }] };
function fakeTranscriber(calls) { return async () => ({ transcribe: async (file, { onProgress }) => { calls.push(file); onProgress({ phase: 'Transcrevendo', percent: 50 }); return { model: 'whisper-large-v3', language: 'pt', json: whisperJson, srt: '1\n00:00:00,000 --> 00:00:01,500\nOlá mundo\n' }; } }); }

test('transcrição é idempotente, a revisão preserva a saída bruta e a busca acha texto e timecode', async () => {
  const calls = [];
  const { root, service, project } = await setup({ transcriber: fakeTranscriber(calls) });
  const details = await service.importMedia({ path: project.path, baseRevision: 1, source: tone(root, 'fala.wav'), rights: 'owned' });
  const mediaId = details.project.media[0].id;
  const job = await service.transcribeMedia({ path: project.path, mediaId });
  await expect(service.mediaOps.jobs.waitFor(job.id)).resolves.toMatchObject({ state: 'completed', result: { segments: 2 } });
  expect((await inspect(service, project)).media[0].transcript).toMatchObject({ status: 'raw', model: 'whisper-large-v3', language: 'pt', segments: 2 });
  await expect(service.transcribeMedia({ path: project.path, mediaId })).resolves.toEqual({ status: 'unchanged', segments: 2 });
  expect(calls).toHaveLength(1);
  const { transcript } = await service.mediaTranscript({ path: project.path, mediaId });
  expect(transcript).toMatchObject({ revision: 0, revised: null, raw: [{ start: 0, end: 1.5, text: 'Olá mundo' }, { start: 1.5, end: 3, text: 'teste de busca' }] });
  const saved = await service.saveMediaTranscript({ path: project.path, mediaId, baseRevision: 0, segments: [{ start: 0, end: 1.5, text: 'Olá, mundo!' }, transcript.raw[1]] });
  expect(saved.revision).toBe(1);
  await expect(service.saveMediaTranscript({ path: project.path, mediaId, baseRevision: 0, segments: transcript.raw })).rejects.toMatchObject({ code: 'TRANSCRIPT_CONFLICT' });
  await expect(service.saveMediaTranscript({ path: project.path, mediaId, baseRevision: 1, segments: [{ start: 2, end: 1, text: 'x' }] })).rejects.toThrow(/tempo inválido/);
  const reread = (await service.mediaTranscript({ path: project.path, mediaId })).transcript;
  expect(reread.raw[0].text).toBe('Olá mundo');
  expect(reread.current[0].text).toBe('Olá, mundo!');
  expect(reread.srt).toContain('00:00:00,000 --> 00:00:01,500\nOlá, mundo!');
  expect((await inspect(service, project)).media[0].transcript.status).toBe('revised');
  expect((await service.searchTranscripts({ path: project.path, query: 'ola' })).results).toMatchObject([{ mediaId, text: 'Olá, mundo!' }]);
  expect((await service.searchTranscripts({ path: project.path, query: '0:02' })).results).toMatchObject([{ start: 1.5, text: 'teste de busca' }]);
  const forced = await service.transcribeMedia({ path: project.path, mediaId, force: true });
  await service.mediaOps.jobs.waitFor(forced.id);
  expect(calls).toHaveLength(2);
});

test('transcrição sem runtime é bloqueada; whisper-cli reporta progresso e pode ser cancelado', async () => {
  const blocked = await setup({ setup: { ready: ['ffmpeg', 'ffprobe'] } });
  const details = await blocked.service.importMedia({ path: blocked.project.path, baseRevision: 1, source: tone(blocked.root, 'a.wav'), rights: 'owned' });
  await expect(blocked.service.transcribeMedia({ path: blocked.project.path, mediaId: details.project.media[0].id })).rejects.toMatchObject({ code: 'DEPENDENCY_MISSING' });

  const root = blocked.root;
  const model = path.join(root, 'model.bin'); await writeFile(model, 'pesos');
  const binary = path.join(root, 'whisper-cli');
  await writeFile(binary, `#!/bin/sh
[ "$1" = "--help" ] && { echo "usage: whisper-cli"; exit 0; }
while [ $# -gt 0 ]; do [ "$1" = "-of" ] && out="$2"; shift; done
echo "whisper_print_progress_callback: progress =  40%" >&2
[ -n "$WHISPER_SLOW" ] && sleep 30
printf '%s' '${JSON.stringify(whisperJson)}' > "$out.json"
printf '1\\n00:00:00,000 --> 00:00:01,500\\nOlá mundo\\n' > "$out.srt"
`, { mode: 0o755 });
  const transcriber = new PortugueseTranscriber({ binary, modelPath: model });
  const progress = [];
  const output = await transcriber.transcribe(tone(root, 'b.wav'), { onProgress: value => progress.push(value) });
  expect(output.json.transcription).toHaveLength(2);
  expect(progress).toContainEqual({ phase: 'Transcrevendo', percent: 40 });
  process.env.WHISPER_SLOW = '1';
  try {
    const controller = new AbortController();
    const running = transcriber.transcribe(tone(root, 'c.wav'), { signal: controller.signal, onProgress: value => { if (value.percent === 40) controller.abort(); } });
    await expect(running).rejects.toMatchObject({ code: 'CANCELLED' });
  } finally { delete process.env.WHISPER_SLOW; }
});
