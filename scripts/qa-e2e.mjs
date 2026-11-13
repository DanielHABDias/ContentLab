#!/usr/bin/env node
// QA E2E do release candidate: sobe o servidor real em pastas temporárias e percorre o fluxo
// pela mesma API HTTP da interface, com FFmpeg real, em 16:9 (longo) e 9:16 (Short).
// Inclui recuperação após `kill -9` durante render. Mídia de teste é gerada aqui (sem direitos de terceiros).
//   node scripts/qa-e2e.mjs [--keep]
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = await mkdtemp(path.join(os.tmpdir(), 'contentlab-qa-'));
const port = 4300 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}/api/v1`;
const env = { ...process.env, CONTENTLAB_PORT: String(port), CONTENTLAB_DATA_DIR: path.join(work, 'data'), CONTENTLAB_PROJECTS_DIR: path.join(work, 'projects'), CONTENTLAB_TOOLS_DIR: process.env.CONTENTLAB_TOOLS_DIR || path.join(root, '.tools'), XDG_DATA_HOME: path.join(work, 'xdg') };
const results = [];
let server;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function start() {
  server = spawn(process.execPath, [path.join(root, 'src/server/http-server.js')], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr.on('data', chunk => process.stderr.write(`[server] ${chunk}`));
  for (let attempt = 0; attempt < 50; attempt += 1) { try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* subindo */ } await sleep(200); }
  throw new Error('Servidor não subiu');
}
async function stop(signal = 'SIGTERM') { if (!server) return; const done = new Promise(resolve => server.once('exit', resolve)); server.kill(signal); await done; server = null; }
async function call(route, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${base}${route}`, { method, headers: { 'content-type': 'application/json', 'x-contentlab-client': '1' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`${route}: ${value.error || response.status}`), { code: value.code });
  return value;
}
async function waitJob(projectPath, jobId, timeoutMs = 180_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { jobs } = await call(`/jobs?path=${encodeURIComponent(projectPath)}`);
    const job = jobs.find(item => item.id === jobId);
    if (job && ['completed', 'failed', 'cancelled'].includes(job.state)) { if (job.state !== 'completed') throw new Error(`Job ${job.kind} ${job.state}: ${job.error || ''}`); return job; }
    await sleep(300);
  }
  throw new Error(`Job ${jobId} não terminou`);
}
async function waitRender(projectPath, jobId, timeoutMs = 300_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const job = (await call('/render/jobs', { path: projectPath })).jobs.find(item => item.id === jobId);
    if (job && ['completed', 'failed', 'cancelled'].includes(job.state)) { if (job.state !== 'completed') throw new Error(`Render ${job.state}: ${job.error || ''}`); return job; }
    await sleep(500);
  }
  throw new Error('Render não terminou');
}
async function step(name, run) {
  const started = Date.now();
  try { const detail = await run(); results.push({ name, status: 'ok', ms: Date.now() - started, detail: detail || '' }); console.log(`✔ ${name}${detail ? ` — ${detail}` : ''}`); }
  catch (error) { results.push({ name, status: 'falhou', ms: Date.now() - started, detail: error.message }); console.log(`✘ ${name} — ${error.message}`); }
}
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' }));
const ffmpeg = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

async function scenario({ label, type, ratio, width, height, seconds }) {
  const media = path.join(work, 'media', label); await import('node:fs/promises').then(fs => fs.mkdir(media, { recursive: true }));
  const video = path.join(media, `cena-${label}.mp4`); const voice = path.join(media, `voz-${label}.wav`);
  ffmpeg(['-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=30:duration=${seconds}`, '-f', 'lavfi', '-i', `sine=frequency=330:duration=${seconds}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video]);
  ffmpeg(['-f', 'lavfi', '-i', `sine=frequency=220:duration=${seconds - 1}`, '-af', 'volume=0.3', '-ar', '44100', voice]);
  let project; let projectPath; let assembledId; let renderOutput;
  const fresh = async () => { const details = await call('/projects/open', { path: projectPath }); project = details.project; return details; };

  await step(`${label}: criar projeto ${type} ${ratio}`, async () => { const created = await call('/projects/create', { title: `QA ${label}`, type, aspectRatio: ratio }); project = created.project; projectPath = created.path; return projectPath.replace(work, '…'); });
  await step(`${label}: configurar (modo e título)`, async () => { await call('/projects/action', { path: projectPath, baseRevision: project.revision, action: { type: 'project.update', title: `QA ${label} final`, mode: 'review' } }); const details = await fresh(); if (details.project.title !== `QA ${label} final`) throw new Error('título não persistiu'); return `revisão ${project.revision}`; });
  await step(`${label}: importar mídia com direitos`, async () => { const job = await call('/media/import-files', { path: projectPath, sources: [video], rights: 'owned' }); const done = await waitJob(projectPath, job.id); if (done.result.imported !== 1) throw new Error(JSON.stringify(done.result)); await fresh(); return `${project.media.length} mídia(s)`; });
  await step(`${label}: importar e montar narração`, async () => {
    const imported = await call('/narration/import', { path: projectPath, sources: [voice] });
    const state = await call('/narration/state', { path: projectPath });
    const takes = state.session?.takes || state.takes || [];
    const job = await call('/narration/assemble', { path: projectPath, baseRevision: state.session?.revision ?? state.revision, takeIds: takes.map(take => take.id) });
    const done = await waitJob(projectPath, job.id);
    await fresh(); assembledId = done.result?.mediaId || project.media.find(item => item.kind === 'audio')?.id;
    const info = project.media.find(item => item.id === assembledId);
    if (!info) throw new Error(`narração montada não entrou no catálogo (${JSON.stringify(imported).slice(0, 120)})`);
    return `${info.name}`;
  });
  await step(`${label}: timeline (vídeo, narração, legendas, desfazer/refazer)`, async () => {
    const videoId = project.media.find(item => item.kind === 'video').id;
    let details = await call('/edit/add-media', { path: projectPath, baseRevision: project.revision, trackId: 'visual_main', mediaId: videoId, startFrame: 0 });
    details = await call('/edit/add-media', { path: projectPath, baseRevision: details.project.revision, trackId: 'audio_main', mediaId: assembledId, startFrame: 15 });
    const srt = `1\n00:00:00,500 --> 00:00:02,500\nAção! Edição em ${ratio}\n\n2\n00:00:03,000 --> 00:00:04,500\nLegenda com acentuação: ç ã é\n`;
    details = await call('/edit/captions', { path: projectPath, baseRevision: details.project.revision, srtText: srt, srtName: 'qa.srt', style: 'destaque' });
    const before = JSON.stringify(details.project.timeline);
    details = await call('/edit/undo', { path: projectPath, baseRevision: details.project.revision });
    details = await call('/edit/redo', { path: projectPath, baseRevision: details.project.revision });
    if (JSON.stringify(details.project.timeline) !== before) throw new Error('refazer não restaurou a timeline');
    project = details.project;
    return project.timeline.tracks.map(track => `${track.id}:${track.clips.length}`).join(' ');
  });
  await step(`${label}: prévia de frame pelo plano do render`, async () => { const frame = await call('/edit/frame', { path: projectPath, frame: 45, aspectRatio: ratio }); const response = await fetch(`${base}/edit/preview?name=${encodeURIComponent(frame.name)}`); if (!response.ok) throw new Error(`prévia ${response.status}`); const bytes = (await response.arrayBuffer()).byteLength; await writeFile(path.join(work, `frame-${label}.png`), Buffer.from(await (await fetch(`${base}/edit/preview?name=${encodeURIComponent(frame.name)}`)).arrayBuffer())); return `${bytes} bytes`; });
  await step(`${label}: render final e conferência ffprobe`, async () => {
    const job = await call('/render/start', { path: projectPath, presetId: 'hd' });
    const done = await waitRender(projectPath, job.id); renderOutput = done.output;
    const info = probe(renderOutput); const videoStream = info.streams.find(item => item.codec_type === 'video'); const audioStream = info.streams.find(item => item.codec_type === 'audio');
    const expected = ratio === '16:9' ? [1280, 720] : [720, 1280];
    if (videoStream.width !== expected[0] || videoStream.height !== expected[1]) throw new Error(`dimensão ${videoStream.width}x${videoStream.height}`);
    if (!audioStream) throw new Error('sem áudio');
    if (Math.abs(Number(info.format.duration) - seconds) > 0.6) throw new Error(`duração ${info.format.duration}`);
    ffmpeg(['-ss', '1.0', '-i', renderOutput, '-frames:v', '1', path.join(work, `render-${label}.png`)]);
    return `${videoStream.width}x${videoStream.height} ${videoStream.codec_name}/${audioStream.codec_name} ${Number(info.format.duration).toFixed(2)} s`;
  });
  await step(`${label}: aprovar etapa e histórico`, async () => { await fresh(); const active = project.stages.find(stage => ['active', 'changes_requested', 'invalidated'].includes(stage.state)); const details = await call('/projects/action', { path: projectPath, baseRevision: project.revision, action: { type: 'stage.request_changes', stageId: active.id, reason: 'QA: pedido de mudança' } }); project = details.project; if (!(project.changeRequests || []).some(item => item.reason === 'QA: pedido de mudança')) throw new Error('pedido de mudança não registrado'); return `${details.history.length} eventos, ${project.changeRequests.length} pedido(s)`; });
  await step(`${label}: exportar .contentlab, importar e reabrir`, async () => {
    const exported = await call('/projects/export', { path: projectPath, outputDirectory: path.join(work, 'exports'), format: 'contentlab' });
    const file = exported.path || exported.output || exported.package;
    const imported = await call('/packages/import', { packagePath: file, parentDirectory: path.join(work, 'restored') });
    const reopened = await call('/projects/open', { path: imported.path });
    if (reopened.project.revision !== project.revision) throw new Error(`revisão ${reopened.project.revision} ≠ ${project.revision}`);
    if (JSON.stringify(reopened.project.timeline) !== JSON.stringify(project.timeline)) throw new Error('timeline diferente após restaurar');
    return `${path.basename(file)} → revisão ${reopened.project.revision}`;
  });
  return { projectPath, renderOutput };
}

try {
  await start();
  await step('primeira execução: lista vazia e dependências essenciais', async () => { const { projects } = await call('/projects'); if (projects.length) throw new Error('não está vazia'); const status = await call('/setup/status'); if (!status.essentialsReady) throw new Error('essenciais ausentes'); return `${status.items.filter(item => item.ready).length}/${status.items.length} prontas`; });
  const long = await scenario({ label: 'longo', type: 'long', ratio: '16:9', width: 1280, height: 720, seconds: 6 });
  await scenario({ label: 'short', type: 'short', ratio: '9:16', width: 720, height: 1280, seconds: 5 });

  await step('recuperação: kill -9 durante render, reinício retoma o job', async () => {
    const job = await call('/render/start', { path: long.projectPath, presetId: 'full-hd' });
    await sleep(700); await stop('SIGKILL'); await start();
    const done = await waitRender(long.projectPath, job.id);
    const leftovers = (await readdir(path.dirname(done.output))).filter(name => name.includes('.partial'));
    if (leftovers.length) throw new Error(`temporários sobrando: ${leftovers.join(', ')}`);
    return `job retomado, tentativa ${done.attempt ?? 1}`;
  });
  await step('recuperação: projeto íntegro e reaberto após kill -9', async () => { const details = await call('/projects/open', { path: long.projectPath }); JSON.parse(await readFile(path.join(long.projectPath, 'project.json'), 'utf8')); return `revisão ${details.project.revision}`; });
  await step('recuperação: kill -9 durante importação não deixa mídia pela metade', async () => {
    const big = path.join(work, 'media', 'grande.mp4'); ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=40', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', big]);
    const details = await call('/projects/open', { path: long.projectPath }); const before = details.project.media.length;
    await call('/media/import-files', { path: long.projectPath, sources: [big], rights: 'owned' }); await sleep(150); await stop('SIGKILL'); await start();
    const after = (await call('/projects/open', { path: long.projectPath })).project;
    const partial = after.media.filter(item => !item.sha256);
    if (partial.length) throw new Error('mídia sem hash registrada');
    const job = await call('/media/import-files', { path: long.projectPath, sources: [big], rights: 'owned' }); await waitJob(long.projectPath, job.id);
    return `antes ${before}, depois do kill ${after.media.length}, após repetir ${(await call('/projects/open', { path: long.projectPath })).project.media.length}`;
  });
} finally {
  await stop();
  const failed = results.filter(item => item.status !== 'ok');
  const report = ['# QA E2E — release candidate', '', `Executado em ${new Date().toISOString()} · Node ${process.version} · ${os.platform()} ${os.arch()}`, '', '| Etapa | Resultado | Tempo | Detalhe |', '| --- | --- | --- | --- |', ...results.map(item => `| ${item.name} | ${item.status} | ${(item.ms / 1000).toFixed(1)} s | ${String(item.detail).replaceAll('|', '/')} |`), '', `**${results.length - failed.length}/${results.length} etapas ok.**`, ''].join('\n');
  await mkdir(path.join(root, '.contentlab', 'qa'), { recursive: true });
  await writeFile(path.join(root, '.contentlab', 'qa', 'QA_E2E_RC.md'), report);
  console.log(`\n${results.length - failed.length}/${results.length} ok · relatório .contentlab/qa/QA_E2E_RC.md · artefatos ${process.argv.includes('--keep') ? work : '(removidos)'}`);
  if (!process.argv.includes('--keep')) await rm(work, { recursive: true, force: true });
  process.exitCode = failed.length ? 1 : 0;
}
