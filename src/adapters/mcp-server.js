#!/usr/bin/env node
// MCP do Content Lab: o agente comanda o app real (mesmo núcleo, pastas e Recentes da interface)
// pela API local. Trabalhos longos (narração, render, importação) devolvem um jobId na hora;
// o agente chama `job_wait` até terminar, e a pessoa acompanha tudo no app.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.env.CONTENTLAB_PORT || 4173);
const base = `http://127.0.0.1:${port}/api/v1`;
const headers = { 'content-type': 'application/json', 'x-contentlab-client': '1' };
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class AppError extends Error { constructor(message, code, details) { super(message); this.code = code; this.details = details; } }
async function api(route, body, { method = body === undefined ? 'GET' : 'POST' } = {}) {
  let response;
  try { response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new AppError('O Content Lab não está aberto. Use a ferramenta contentlab_start.', 'APP_OFFLINE'); }
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new AppError(value.error || `Falha ${response.status}`, value.code || null, value.details);
  return value;
}
async function running() { try { return (await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } }
const text = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
const failure = error => ({ isError: true, content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: error.code || null, details: error.details || null }) }] });
const tool = (server, name, description, inputSchema, handler) => server.registerTool(name, { description, inputSchema }, async (args, extra) => { try { return text(await handler(args, extra)); } catch (error) { return failure(error); } });

const projectPath = z.string().describe('Caminho da pasta do projeto (campo `path` de project_create/project_list).');
const stageId = z.enum(['brief', 'script', 'packaging', 'media', 'narration', 'edit', 'review']);

async function summary(path) { return api('/production/summary', { path }); }
async function currentStage(path, wanted) { const value = await summary(path); const stage = wanted ? value.stages.find(item => item.id === wanted) : value.currentStage; if (!stage) throw new AppError('Não há etapa ativa: o projeto está concluído', 'NO_ACTIVE_STAGE'); return { value, stageId: stage.id }; }
async function openProject(path) { return api('/projects/open', { path }); }

async function findJob(path, jobId) {
  if (jobId.startsWith('render_')) { const job = (await api('/render/jobs', { path })).jobs.find(item => item.id === jobId); return job && { id: job.id, kind: 'render', state: job.state, progress: job.progress, phase: job.phase, error: job.error, output: job.output }; }
  const job = (await api(`/jobs?path=${encodeURIComponent(path)}`)).jobs.find(item => item.id === jobId);
  return job && { id: job.id, kind: job.kind, state: job.state, progress: job.progress, phase: job.progress?.phase, error: job.error, result: job.result };
}

export function createMcpServer() {
  const server = new McpServer({ name: 'content-lab', version: '2.1.0' }, { instructions: [
    'Content Lab produz vídeos localmente (ideia → roteiro → embalagem → mídia → narração → edição → render). Nunca publica nada.',
    'Fluxo típico: contentlab_start → project_create → creative_write (brief) → aprovar/aguardar → creative_write (script) → … → media_generate_slides ou media_import_files → narration_generate + job_wait → narration_assemble + job_wait → timeline_auto_assemble → thumbnails_generate → render_start + job_wait → deliverable_build → project_export.',
    'Em cada etapa: preencha o que project_get indica como `missing`. Se o projeto está em modo `review`, chame stage_wait_decision e espere a pessoa aprovar no app; só use stage_approve com userApproved=true quando a pessoa aprovar no chat. Em modo `autonomous` (a pessoa pediu para não aprovar), use stage_approve direto.',
    'Trabalhos longos devolvem jobId: chame job_wait repetidamente (cada chamada espera até timeoutSeconds) e avise a pessoa do progresso. A voz clonada é lenta (~30 s por segundo de fala em CPU); a narração padrão é rápida.',
  ].join('\n') });

  tool(server, 'contentlab_status', 'Diz se o Content Lab está aberto, a versão, dependências prontas, vozes e perfis disponíveis.', {}, async () => {
    if (!(await running())) return { running: false, hint: 'Use contentlab_start para abrir o app.' };
    const [about, setup] = await Promise.all([api('/about'), api('/setup/status')]);
    const ready = id => setup.items.find(item => item.id === id)?.ready || false;
    const profiles = (await api('/narration/profiles-list', {}).catch(() => ({ profiles: [] }))).profiles;
    return { running: true, url: `http://127.0.0.1:${port}/`, version: about.app.version, essentialsReady: setup.essentialsReady, narration: { standard: ready('kokoro'), standardVoices: ['pm_alex', 'pf_dora', 'pm_santa'], cloned: ready('voxcpm2'), profiles }, transcription: ready('whisper-cli') && ready('whisper-large-v3'), urlImport: ready('yt-dlp'), missingOptional: setup.items.filter(item => !item.ready && !item.required).map(item => ({ id: item.id, label: item.label })) };
  });

  tool(server, 'contentlab_start', 'Abre o Content Lab em segundo plano (interface + API) se ainda não estiver aberto. Não abre o navegador a menos que openBrowser=true.', { openBrowser: z.boolean().default(false) }, async ({ openBrowser }) => {
    if (await running()) return { running: true, alreadyRunning: true, url: `http://127.0.0.1:${port}/` };
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'start.mjs'), ...(openBrowser ? [] : ['--no-browser'])], { cwd: root, stdio: 'ignore', env: { ...process.env, CONTENTLAB_PORT: String(port) } });
    await new Promise(resolve => child.on('exit', resolve));
    for (let attempt = 0; attempt < 40 && !(await running()); attempt += 1) await sleep(250);
    if (!(await running())) throw new AppError('O Content Lab não abriu; veja .contentlab/logs/server.log', 'START_FAILED');
    return { running: true, url: `http://127.0.0.1:${port}/` };
  });

  tool(server, 'contentlab_stop', 'Desliga o Content Lab. Sem force, recusa e lista o trabalho em andamento.', { force: z.boolean().default(false) }, async ({ force }) => api('/server/shutdown', { force }));

  tool(server, 'project_list', 'Lista os projetos dos Recentes (título, tipo, etapa, caminho).', {}, async () => ({ projects: (await api('/projects')).projects.map(item => ({ id: item.id, title: item.title, type: item.type, aspectRatio: item.aspectRatio, stage: item.stage, status: item.status, path: item.path })) }));

  tool(server, 'project_create', 'Cria um projeto real (aparece nos Recentes do app). mode "review" espera aprovação humana a cada etapa; "autonomous" deixa o agente aprovar.', {
    title: z.string().min(1).max(120), type: z.enum(['long', 'short']), aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(), mode: z.enum(['review', 'autonomous']).default('review'),
  }, async ({ title, type, aspectRatio, mode }) => { const created = await api('/projects/create', { title, type, aspectRatio: aspectRatio || (type === 'short' ? '9:16' : '16:9'), mode }); return { path: created.path, id: created.project.id, revision: created.project.revision, mode: created.project.mode, aspectRatio: created.project.aspectRatio }; });

  tool(server, 'project_get', 'Resumo do projeto: etapa atual e o que falta, estados das etapas, pedidos de mudança, textos, mídias e timeline.', { path: projectPath }, async ({ path }) => summary(path));

  tool(server, 'creative_write', 'Escreve/atualiza ideia (brief), roteiro (script) e embalagem (packaging). Campos omitidos são mantidos.', {
    path: projectPath,
    brief: z.object({ thesis: z.string(), audience: z.string(), promise: z.string(), notes: z.string() }).partial().optional(),
    script: z.object({ hook: z.string().describe('Abertura'), development: z.string().describe('Desenvolvimento; parágrafos separados por linha em branco viram cenas'), payoff: z.string().describe('Fechamento') }).partial().optional(),
    packaging: z.object({ titleA: z.string(), titleB: z.string(), description: z.string(), tags: z.string(), seo: z.string() }).partial().optional(),
  }, async ({ path, brief, script, packaging }) => {
    const { project } = await openProject(path);
    const creative = structuredClone(project.creative);
    if (brief) creative.brief = { ...creative.brief, ...brief };
    if (script) creative.script = { ...creative.script, ...script };
    if (packaging) creative.packaging = { ...creative.packaging, ...packaging };
    const updated = await api('/projects/action', { path, baseRevision: project.revision, action: { type: 'creative.update', creative } });
    return { revision: updated.project.revision, currentStage: (await summary(path)).currentStage };
  });

  tool(server, 'stage_approve', 'Aprova a etapa atual (ou stageId). Permitido se o projeto está em modo "autonomous" ou se a pessoa aprovou explicitamente no chat (userApproved=true).', { path: projectPath, stageId: stageId.optional(), userApproved: z.boolean().default(false) }, async ({ path, stageId: wanted, userApproved }) => {
    const { project } = await openProject(path);
    if (project.mode !== 'autonomous' && !userApproved) throw new AppError('Projeto em modo revisão: espere a pessoa aprovar no app (stage_wait_decision) ou peça a aprovação no chat', 'APPROVAL_REQUIRED');
    const { stageId: target } = await currentStage(path, wanted);
    const stage = project.stages.find(item => item.id === target);
    const updated = await api('/projects/action', { path, baseRevision: project.revision, action: { type: 'stage.approve', stageId: target, expectedRevision: stage.revision, author: project.mode === 'autonomous' ? 'agente (modo autônomo, MCP)' : 'usuário (aprovado no chat, MCP)' } });
    const next = updated.project.stages.find(item => ['active', 'changes_requested', 'invalidated'].includes(item.state));
    return { approved: target, revision: updated.project.revision, nextStage: next?.id || null, done: !next };
  });

  tool(server, 'stage_request_changes', 'Registra um pedido de mudança na etapa atual (ou stageId).', { path: projectPath, stageId: stageId.optional(), reason: z.string().min(1) }, async ({ path, stageId: wanted, reason }) => {
    const { project } = await openProject(path); const { stageId: target } = await currentStage(path, wanted);
    const updated = await api('/projects/action', { path, baseRevision: project.revision, action: { type: 'stage.request_changes', stageId: target, reason, author: 'agente (MCP)' } });
    return { stageId: target, revision: updated.project.revision };
  });

  tool(server, 'stage_wait_decision', 'Espera a pessoa aprovar ou pedir mudança na etapa (no app). Retorna ao decidir ou após timeoutSeconds com waiting=true; chame de novo.', { path: projectPath, stageId: stageId.optional(), timeoutSeconds: z.number().int().min(1).max(600).default(50) }, async ({ path, stageId: wanted, timeoutSeconds }) => api('/production/wait', { path, stageId: wanted, timeoutSeconds }));

  tool(server, 'media_import_files', 'Importa arquivos locais (vídeo, áudio, imagem). rights: owned (é seu), licensed, authorized; nunca declare direitos que a pessoa não confirmou.', { path: projectPath, files: z.array(z.string()).min(1).max(200), rights: z.enum(['owned', 'licensed', 'authorized', 'pending']) }, async ({ path, files, rights }) => { const job = await api('/media/import-files', { path, sources: files, rights }); return { jobId: job.id, hint: 'Use job_wait.' }; });

  tool(server, 'media_import_url', 'Baixa mídia de uma URL (yt-dlp). Exige que a pessoa tenha confirmado os direitos.', { path: projectPath, url: z.string().url(), rights: z.enum(['owned', 'licensed', 'authorized']), rightsConfirmedByUser: z.literal(true) }, async ({ path, url, rights }) => { const job = await api('/media/import-url', { path, url, rights, rightsConfirmed: true }); return { jobId: job.id, hint: 'Use job_wait.' }; });

  tool(server, 'media_generate_slides', 'Gera um slide (imagem com texto) por cena do roteiro, para vídeos sem filmagem própria.', { path: projectPath }, async ({ path }) => api('/production/slides', { path }));

  tool(server, 'voice_options', 'Vozes disponíveis: narração padrão (Kokoro: pm_alex, pf_dora, pm_santa) e perfis de voz clonada com consentimento.', {}, async () => {
    const setup = await api('/setup/status'); const ready = id => setup.items.find(item => item.id === id)?.ready || false;
    const profiles = (await api('/narration/profiles-list', {}).catch(() => ({ profiles: [] }))).profiles;
    return { standard: { ready: ready('kokoro'), voices: [{ id: 'pm_alex', label: 'Alex (masculina)' }, { id: 'pf_dora', label: 'Dora (feminina)' }, { id: 'pm_santa', label: 'Santa (masculina, grave)' }], install: ready('kokoro') ? null : 'Instale "Narração padrão (Kokoro)" em Dependências' }, cloned: { ready: ready('voxcpm2'), profiles, note: profiles.length ? 'Lenta em CPU (~30 s por segundo de fala).' : 'Sem perfil: a pessoa precisa gravar a voz em Narração → Gravar minha voz.' } };
  });

  tool(server, 'narration_generate', 'Gera a narração das cenas do roteiro. engine "standard" (Kokoro, rápido) ou "cloned" (voz da pessoa, exige profileId). Devolve jobId.', {
    path: projectPath, engine: z.enum(['standard', 'cloned']).default('standard'), voice: z.enum(['pm_alex', 'pf_dora', 'pm_santa']).default('pm_alex'), speed: z.number().min(0.5).max(2).default(1), profileId: z.string().optional(),
  }, async ({ path, engine, voice, speed, profileId }) => {
    if (engine === 'cloned' && !profileId) throw new AppError('Informe profileId (veja voice_options)', 'PROFILE_REQUIRED');
    const job = await api('/narration/generate', engine === 'cloned' ? { path, engine, profileId } : { path, engine, voice, speed });
    return { jobId: job.id, label: job.label, hint: 'Use job_wait; depois narration_assemble.' };
  });

  tool(server, 'narration_assemble', 'Junta os takes gerados mais recentes (um por cena, na ordem do roteiro) numa narração tratada (WAV 48 kHz, loudness medido). Devolve jobId.', { path: projectPath, preset: z.enum(['original', 'warm', 'gentle', 'balanced', 'deep']).default('original') }, async ({ path, preset }) => {
    const state = await api('/narration/state', { path });
    const generated = state.narration.takes.filter(take => take.origin === 'generated' && !take.stale);
    const bySceneLatest = new Map(); for (const take of generated) bySceneLatest.set(take.sceneId, take);
    const takeIds = state.scenes.map(scene => bySceneLatest.get(scene.id)?.id).filter(Boolean);
    if (!takeIds.length) throw new AppError('Nenhuma cena narrada ainda: use narration_generate', 'NARRATION_MISSING');
    const job = await api('/narration/assemble', { path, baseRevision: state.narration.revision, takeIds, treatment: { preset } });
    return { jobId: job.id, scenes: takeIds.length, hint: 'Use job_wait; depois timeline_auto_assemble.' };
  });

  tool(server, 'timeline_auto_assemble', 'Monta a timeline: narração montada no áudio, mídias visuais (ou slides) cobrindo a duração e legendas do roteiro sincronizadas por cena. Pode desfazer no app.', { path: projectPath, captions: z.boolean().default(true), captionStyle: z.enum(['legenda', 'destaque', 'titulo']).default('legenda') }, async ({ path, captions, captionStyle }) => api('/production/assemble', { path, captions, captionStyle }));

  tool(server, 'thumbnails_generate', 'Gera as thumbnails A e B (título sobre frame do vídeo, dois estilos) e grava na embalagem. Sem variants usa os títulos A/B.', { path: projectPath, variants: z.array(z.object({ label: z.enum(['A', 'B']), title: z.string().min(1), text: z.string().optional().describe('Texto curto na imagem; padrão = título'), mediaId: z.string().optional(), frameSeconds: z.number().nonnegative().optional() })).max(2).optional() }, async ({ path, variants }) => api('/production/thumbnails', { path, variants }));

  tool(server, 'render_start', 'Renderiza o vídeo final (fila persistente: sobrevive a reinícios). preset full-hd ou hd. Devolve jobId.', { path: projectPath, preset: z.enum(['full-hd', 'hd']).default('full-hd') }, async ({ path, preset }) => { const job = await api('/render/start', { path, presetId: preset }); return { jobId: job.id, hint: 'Use job_wait.' }; });

  tool(server, 'job_wait', 'Espera um job (narração, montagem, importação ou render) terminar, até timeoutSeconds. Se ainda estiver rodando, devolve o progresso com waiting=true: chame de novo.', { path: projectPath, jobId: z.string(), timeoutSeconds: z.number().int().min(1).max(600).default(50) }, async ({ path, jobId, timeoutSeconds }, extra) => {
    const until = Date.now() + timeoutSeconds * 1000; let last = null;
    while (Date.now() < until && !extra?.signal?.aborted) {
      last = await findJob(path, jobId);
      if (!last) throw new AppError(`Job desconhecido: ${jobId} (o app foi reiniciado? jobs de render continuam; outros precisam ser iniciados de novo)`, 'UNKNOWN_JOB');
      const token = extra?._meta?.progressToken;
      if (token !== undefined && extra.sendNotification) { const value = typeof last.progress === 'number' ? last.progress : last.progress?.total ? last.progress.done / last.progress.total : 0; await extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: Math.round(value * 100), total: 100, message: last.phase || last.state } }).catch(() => {}); }
      if (TERMINAL.has(last.state)) return { ...last, waiting: false };
      await sleep(1000);
    }
    return { ...last, waiting: true, message: 'Ainda em andamento; chame job_wait de novo.' };
  });

  tool(server, 'deliverable_build', 'Monta output/entrega/ no projeto: roteiro.md, embalagem.md (títulos A/B, descrição, tags), thumbnails A/B e o vídeo final.', { path: projectPath }, async ({ path }) => api('/production/deliverable', { path }));

  tool(server, 'project_export', 'Exporta o projeto como .contentlab ou ZIP (opcionalmente com o vídeo renderizado).', { path: projectPath, format: z.enum(['zip', 'contentlab']).default('zip'), outputDirectory: z.string(), includeRenders: z.boolean().default(true) }, async ({ path, format, outputDirectory, includeRenders }) => api('/projects/export', { path, format, outputDirectory, includeRenders }));

  tool(server, 'project_run', 'Avançado: aplica uma ação validada do núcleo (ex.: timeline.edit, project.update). Use as ferramentas específicas quando existirem.', { path: projectPath, action: z.record(z.string(), z.unknown()) }, async ({ path, action }) => { const { project } = await openProject(path); const updated = await api('/projects/action', { path, baseRevision: project.revision, action }); return { revision: updated.project.revision }; });

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await createMcpServer().connect(new StdioServerTransport());
}
