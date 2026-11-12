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
const FLOW_STAGES = ['brief', 'script', 'packaging', 'media', 'narration', 'edit', 'review'];
const stageId = z.enum(FLOW_STAGES);

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
    'Modo composição (padrão do canal): o vídeo inteiro é uma composição Remotion do kit de motion Diazverso, no ritmo do RunnyIA (troca a cada 1,5–3 s, câmera sempre em movimento, Nox com expressões, palavras gigantes, cenas da obra em painéis HQ, som em cada troca). Leia motion_kit. Fluxo: importe CENAS DAS OBRAS citadas (imagens/vídeos com direitos confirmados, nomes de arquivo descritivos como batman-1940.jpg ajudam a casar com a fala) e uma trilha licenciada (media_import_files com role music); narração + narration_transcribe; motion_plan_auto; motion_preview e abra os PNG; ajuste com motion_plan_set (mais evidência da obra onde a fala cita algo, menos texto genérico); render_start. Vídeo sem narração: escreva os beats direto em motion_plan_set com narration=false. Não invente falas canônicas de personagens.',
    'Fluxo típico: contentlab_start → project_create → creative_write (brief) → aprovar/aguardar → creative_write (script) → … → media_import_files (imagens do assunto; trilha licenciada com role music) → narration_generate + job_wait → narration_assemble + job_wait → narration_transcribe + job_wait → motion_plan_auto → motion_preview → motion_plan_set (ajustes) → thumbnails_generate → render_start + job_wait → deliverable_build → project_export.',
    'Antes de project_create, combine o fluxo com a pessoa (uma pergunta só): tudo automático (mode autonomous), parar em etapas para revisar no app (autonomous + pauseAt, por exemplo ["script", "narration", "review"]) ou aprovar cada etapa (review); e se a narração é voz de IA ou a pessoa grava a própria voz (narrationBy creator). Nas pausas, avise no chat o que revisar e espere com stage_wait_decision. Com narrationBy creator, não gere voz: peça para gravar e montar no app, espere e rode narration_transcribe.',
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

  const flowFields = {
    mode: z.enum(['review', 'autonomous']).describe('"review": a pessoa aprova cada etapa; "autonomous": o agente aprova, exceto nas etapas de pauseAt'),
    pauseAt: z.array(z.enum(FLOW_STAGES)).describe('Etapas em que o agente para e espera a pessoa revisar no app, mesmo no modo autônomo'),
    narrationBy: z.enum(['ai', 'creator']).describe('"creator": a pessoa grava a própria voz no app (Narração → Gravar e Montar narração); o agente não gera voz'),
  };
  const flowOf = project => ({ mode: project.mode, pauseAt: project.pauseAt || [], narrationBy: project.narrationBy || 'ai' });

  tool(server, 'project_create', 'Cria um projeto real (aparece nos Recentes do app) com o fluxo combinado com a pessoa: tudo automático, parar em etapas escolhidas (pauseAt) ou aprovar cada etapa; e quem grava a narração.', {
    title: z.string().min(1).max(120), type: z.enum(['long', 'short']), aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
    mode: flowFields.mode.default('review'), pauseAt: flowFields.pauseAt.default([]), narrationBy: flowFields.narrationBy.default('ai'),
  }, async ({ title, type, aspectRatio, mode, pauseAt, narrationBy }) => { const created = await api('/projects/create', { title, type, aspectRatio: aspectRatio || (type === 'short' ? '9:16' : '16:9'), mode, pauseAt, narrationBy }); return { path: created.path, id: created.project.id, revision: created.project.revision, ...flowOf(created.project), aspectRatio: created.project.aspectRatio }; });

  tool(server, 'project_flow_set', 'Muda o fluxo combinado de um projeto: modo, etapas de pausa e quem grava a narração. Use quando a pessoa mudar de ideia no meio.', { path: projectPath, mode: flowFields.mode.optional(), pauseAt: flowFields.pauseAt.optional(), narrationBy: flowFields.narrationBy.optional() }, async ({ path, ...changes }) => {
    const { project } = await openProject(path);
    const updated = await api('/projects/action', { path, baseRevision: project.revision, action: { type: 'project.update', ...Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) } });
    return { revision: updated.project.revision, ...flowOf(updated.project) };
  });

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
    if (!userApproved && (project.pauseAt || []).includes(target)) throw new AppError(`A pessoa pediu para revisar a etapa "${target}": avise no chat e espere com stage_wait_decision`, 'PAUSE_POINT');
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

  tool(server, 'media_import_files', 'Importa arquivos locais (vídeo, áudio, imagem). rights: owned (é seu), licensed, authorized; nunca declare direitos que a pessoa não confirmou.', { path: projectPath, files: z.array(z.string()).min(1).max(200), rights: z.enum(['owned', 'licensed', 'authorized', 'pending']), role: z.enum(['content', 'music', 'sfx']).optional().describe('music para a trilha licenciada (ex.: YouTube Audio Library); content para imagens/vídeos do assunto') }, async ({ path, files, rights, role }) => { const job = await api('/media/import-files', { path, sources: files, rights, role }); return { jobId: job.id, hint: 'Use job_wait.' }; });

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
    const { project } = await openProject(path);
    if (project.narrationBy === 'creator') throw new AppError('A pessoa vai gravar a própria voz: peça para gravar e montar a narração no app (Narração) e espere com stage_wait_decision; depois rode narration_transcribe', 'CREATOR_RECORDS');
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

  tool(server, 'motion_kit', 'Kit de motion Diazverso (modo composição, o jeito principal de montar vídeos): regras de ritmo, cenas com props e exemplos, humores do Nox, SFX e fundos. Leia antes de escrever ou ajustar beats.', {}, async () => api('/production/motion-kit', {}));

  tool(server, 'motion_plan_auto', 'Gera o roteiro em beats do vídeo inteiro: frases do roteiro nos tempos reais da narração (rode narration_transcribe antes), cenas da obra citadas pelo nome quando são ditas, Nox reagindo, números contando, palavras gigantes no gancho, CTA no fim e SFX em cada troca. Grava no projeto e devolve o plano e avisos. Depois revise com motion_preview e ajuste com motion_plan_set.', { path: projectPath, music: z.boolean().default(true).describe('Usa a trilha importada (papel music) com ducking') }, async args => api('/production/motion-auto', args));

  tool(server, 'motion_plan_get', 'Plano de motion atual do projeto (beats) e a revisão.', { path: projectPath }, async args => api('/production/motion-plan', args));

  tool(server, 'motion_plan_set', 'Grava o roteiro em beats escrito ou ajustado pelo agente (contrato contentlab-motion-v1, validado). Beats contíguos em segundos: { id, scene, at, duration, props, sfx: [{ name, at, volume }], flash, legenda }. Mídias como "media:<id>". plan=null volta para a timeline de clips.', {
    path: projectPath,
    plan: z.object({ beats: z.array(z.object({ id: z.string(), scene: z.string(), at: z.number(), duration: z.number(), props: z.record(z.string(), z.any()).default({}), sfx: z.array(z.object({ name: z.string(), at: z.number().default(0), volume: z.number().default(0.5) })).default([]), flash: z.boolean().optional(), legenda: z.boolean().optional() })).min(1), narration: z.boolean().default(true), captions: z.boolean().default(true), music: z.object({ volume: z.number().default(0.5), duck: z.number().default(0.25) }).nullable().default({ volume: 0.5, duck: 0.25 }) }).nullable(),
    baseRevision: z.number().int().optional(),
  }, async args => api('/production/motion-set', args));

  tool(server, 'motion_preview', 'Renderiza frames de prévia (PNG) do plano atual em output/previas/ — por padrão um por beat; ou nos segundos pedidos. Abra as imagens para conferir legibilidade, sobreposição e se cada cena mostra o assunto, antes do render final.', { path: projectPath, seconds: z.array(z.number().min(0)).max(24).optional() }, async args => api('/production/motion-preview', args));

  tool(server, 'narration_transcribe', 'Transcreve a narração montada com Whisper (local) para legendas palavra a palavra. Devolve jobId (use job_wait); leva cerca de 3× a duração do áudio em CPU.', { path: projectPath, force: z.boolean().default(false) }, async args => api('/production/transcribe-narration', args));

  tool(server, 'scene_list', 'Cenas HQ do plugin Diazverso disponíveis (props e uso) e um plano sugerido: um beat visual por frase, cada um com imagem do assunto (media:<id>) ou o Nox. Mostra as imagens do projeto que podem entrar e avisos. Use antes de timeline_auto_assemble.', { path: projectPath.optional() }, async ({ path }) => {
    const { components } = await api('/edit/components', {});
    const catalog = components.map(item => ({ id: item.id, label: item.label, use: item.use, props: Object.fromEntries(Object.entries(item.propsSchema).map(([key, spec]) => [key, `${spec.type}${spec.type === 'text' ? ' (uma linha por item)' : spec.type === 'json' && spec.default !== undefined ? ` (exemplo: ${JSON.stringify(spec.default).slice(0, 300)})` : ''}`])) }));
    if (!path) return { components: catalog };
    const suggested = await api('/production/scenes', { path });
    return { components: catalog, suggestion: suggested.scenes, evidence: suggested.evidence, timing: suggested.timing, warnings: suggested.warnings };
  });

  tool(server, 'scene_add', 'Adiciona uma cena HQ (componente) na trilha de cenas, num intervalo em segundos. Para montar todas de uma vez prefira timeline_auto_assemble com scenes.', { path: projectPath, componentId: z.string(), props: z.record(z.string(), z.any()).default({}), startSeconds: z.number().min(0), durationSeconds: z.number().positive().max(600) }, async ({ path, componentId, props, startSeconds, durationSeconds }) => {
    const { project } = await openProject(path); const fps = project.timeline.fps;
    const result = await api('/edit/add-component', { path, baseRevision: project.revision, trackId: 'visual_scenes', componentId, componentProps: props, startFrame: Math.round(startSeconds * fps), durationInFrames: Math.max(1, Math.round(durationSeconds * fps)) });
    return { revision: result.project?.revision ?? result.revision };
  });

  tool(server, 'audio_library', 'Gera efeitos sonoros ORIGINAIS (whoosh, ding, boom, riser; direitos próprios) e uma trilha sintetizada que serve só de RASCUNHO: para a entrega, importe uma faixa licenciada com papel música.', { path: projectPath, music: z.boolean().default(true), sfx: z.boolean().default(true), seconds: z.number().int().min(5).max(3600).optional().describe('Duração da trilha; padrão: a da narração montada') }, async args => api('/production/audio', args));

  tool(server, 'timeline_auto_assemble', 'Monta a timeline: narração no áudio, mídias/slides, cenas HQ por trecho do roteiro (scenes "auto" ou lista), trilha com ducking sob a voz, SFX nas trocas de cena e legendas sincronizadas. Em 9:16 aplica as áreas seguras de Shorts. Pode desfazer no app.', {
    path: projectPath, captions: z.boolean().default(true), captionStyle: z.enum(['legenda', 'destaque', 'titulo']).default('legenda'),
    scenes: z.union([z.literal('auto'), z.array(z.object({ sceneId: z.string().describe('id do trecho (ex.: hook-1, development-2) — veja scene_list'), componentId: z.string(), props: z.record(z.string(), z.any()).default({}), start: z.number().min(0).optional().describe('início em segundos (beat); sem ele, a cena cobre o trecho inteiro'), length: z.number().positive().optional() }))]).optional().describe('Cenas: "auto" usa o plano sugerido (um beat por frase com imagem); uma lista (como a de scene_list) define cada beat. Omitido: sem cenas.'),
    captionMode: z.enum(['auto', 'words', 'phrases']).default('auto').describe('auto: palavra a palavra se a narração foi transcrita (narration_transcribe), senão por frase'),
    music: z.boolean().default(false).describe('Usa a trilha (gere com audio_library ou importe com papel music)'), musicVolume: z.number().min(0).max(1).default(0.35), sfx: z.boolean().default(false),
  }, async args => api('/production/assemble', args));

  tool(server, 'chapters_get', 'Capítulos do vídeo longo a partir dos tempos reais da narração montada (um por trecho do roteiro).', { path: projectPath }, async ({ path }) => api('/production/chapters', { path }));

  tool(server, 'thumbnails_generate', 'Gera as thumbnails A e B com o kit Diazverso (style "kit", padrão): limpas, com fundo preto ou branco e o personagem em destaque (mídia da obra; PNG transparente vira recorte), até 4 palavras em Anton (*palavra* fica amarela; "/" quebra a linha), Nox com a expressão do vídeo, selo opcional e duas mídias em VS. Grava na embalagem e devolve versões de 320 px em output/previas para conferir no tamanho do celular. A e B devem ter ângulos diferentes. style "simple" usa o título sobre um frame.', {
    path: projectPath, style: z.enum(['kit', 'simple']).default('kit'),
    variants: z.array(z.object({
      label: z.enum(['A', 'B']), title: z.string().optional(), text: z.string().optional().describe('Até 4 palavras; complementa o título, não repete'),
      mediaId: z.string().optional().describe('Assunto dominante (mídia da obra com direitos)'), mediaIdB: z.string().optional().describe('Segunda mídia: layout VS'),
      humor: z.enum(['bravo', 'feliz', 'surpreso', 'tedio', 'confuso', 'piscada', 'determinado', 'triste']).optional().describe('Nox com essa expressão; omita para sem Nox'),
      side: z.enum(['esquerda', 'direita']).optional().describe('Lado do texto'), tone: z.enum(['amarelo', 'vermelho', 'azul']).optional(), badge: z.string().max(18).optional().describe('Selo curto, ex.: "HQ 1986"'),
      background: z.enum(['preto', 'branco', 'cena']).optional().describe('preto (padrão) ou branco: fundo liso e limpo com o personagem em destaque; cena: a mídia ocupa a imagem toda'),
      frameSeconds: z.number().nonnegative().optional(),
    })).max(2).optional(),
  }, async ({ path, style, variants }) => api('/production/thumbnails', { path, style, variants }));

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

  tool(server, 'deliverable_build', 'Monta output/entrega/ no projeto: roteiro.md, embalagem.md (títulos A/B, descrição, capítulos, tags), thumbnails A/B, o vídeo final e verificacao.md (o que foi conferido e o que falta). Devolve checks.', { path: projectPath }, async ({ path }) => api('/production/deliverable', { path }));

  tool(server, 'project_export', 'Exporta o projeto como .contentlab ou ZIP (opcionalmente com o vídeo renderizado).', { path: projectPath, format: z.enum(['zip', 'contentlab']).default('zip'), outputDirectory: z.string(), includeRenders: z.boolean().default(true) }, async ({ path, format, outputDirectory, includeRenders }) => api('/projects/export', { path, format, outputDirectory, includeRenders }));

  tool(server, 'project_run', 'Avançado: aplica uma ação validada do núcleo (ex.: timeline.edit, project.update). Use as ferramentas específicas quando existirem.', { path: projectPath, action: z.record(z.string(), z.unknown()) }, async ({ path, action }) => { const { project } = await openProject(path); const updated = await api('/projects/action', { path, baseRevision: project.revision, action }); return { revision: updated.project.revision }; });

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await createMcpServer().connect(new StdioServerTransport());
}
