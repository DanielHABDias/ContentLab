#!/usr/bin/env node
// QA do fluxo de agente pelo MCP real (stdio), como um chat faria:
//  A) vídeo longo 16:9 em modo revisão: o agente produz cada etapa e ESPERA a aprovação humana
//     (simulada aqui clicando "Aprovar" pela API do app, depois de um pedido de mudança no roteiro);
//  B) 5 Shorts 9:16 em modo autônomo: o agente aprova sozinho e entrega tudo.
// Narração padrão (Kokoro), slides do roteiro, montagem, thumbnails A/B, render, entrega, ZIP,
// e reabertura do app para provar que tudo persiste. Usa pastas temporárias e porta própria.
//   node scripts/qa-mcp.mjs [--keep] [--shorts N]
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = await mkdtemp(path.join(os.tmpdir(), 'contentlab-mcp-'));
const port = String(4600 + Math.floor(Math.random() * 300));
const shortsCount = Number(process.argv[process.argv.indexOf('--shorts') + 1]) || 5;
const env = { ...process.env, CONTENTLAB_PORT: port, CONTENTLAB_DATA_DIR: path.join(work, 'data'), CONTENTLAB_PROJECTS_DIR: path.join(work, 'projetos'), CONTENTLAB_TOOLS_DIR: process.env.CONTENTLAB_TOOLS_DIR || path.join(root, '.tools'), XDG_DATA_HOME: path.join(work, 'xdg') };
const log = []; const started = Date.now();
const note = message => { const line = `[${((Date.now() - started) / 1000).toFixed(0).padStart(4)} s] ${message}`; log.push(line); console.log(line); };

const client = new Client({ name: 'qa-chat', version: '1' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'src/adapters/mcp-server.js')], env, cwd: root }));
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 700_000 });
  const value = JSON.parse(result.content[0].text);
  if (result.isError) throw Object.assign(new Error(`${name}: ${value.error}`), { code: value.code });
  return value;
}
async function waitJob(projectPath, jobId, label) {
  for (;;) { const job = await call('job_wait', { path: projectPath, jobId, timeoutSeconds: 120 }); if (!job.waiting) { if (job.state !== 'completed') throw new Error(`${label}: ${job.state} ${job.error || ''}`); return job; } note(`  … ${label}: ${job.phase || job.state}`); }
}
// "Humano": aprova pelo app (mesma API que o botão Aprovar usa) depois de alguns segundos.
const appApi = async (route, body) => { const response = await fetch(`http://127.0.0.1:${port}/api/v1${route}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-contentlab-client': '1' }, body: JSON.stringify(body) }); const value = await response.json(); if (!response.ok) throw new Error(value.error); return value; };
async function human(projectPath, decision, reason) {
  await new Promise(resolve => setTimeout(resolve, 2500));
  const { project } = await appApi('/projects/open', { path: projectPath });
  const stage = project.stages.find(item => ['active', 'changes_requested', 'invalidated'].includes(item.state));
  if (decision === 'approve') await appApi('/projects/action', { path: projectPath, baseRevision: project.revision, action: { type: 'stage.approve', stageId: stage.id, expectedRevision: stage.revision, author: 'Daniel (app)' } });
  else await appApi('/projects/action', { path: projectPath, baseRevision: project.revision, action: { type: 'stage.request_changes', stageId: stage.id, reason, author: 'Daniel (app)' } });
}
async function gate(projectPath, mode, { changes } = {}) {
  const current = (await call('project_get', { path: projectPath })).currentStage;
  if (current.missing.length) throw new Error(`Etapa ${current.id} incompleta: ${current.missing.join(', ')}`);
  if (mode === 'autonomous') { await call('stage_approve', { path: projectPath }); note(`  ✔ ${current.id} aprovada pelo agente (modo autônomo)`); return null; }
  const decision = human(projectPath, changes ? 'changes' : 'approve', changes);
  const result = await call('stage_wait_decision', { path: projectPath, timeoutSeconds: 60 });
  await decision;
  note(`  ⏸ ${current.id}: agente esperou → ${result.decision}${result.reason ? ` (“${result.reason}”)` : ''}`);
  return result;
}
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', file], { encoding: 'utf8' }));

async function produce({ title, type, mode, brief, script, packaging, voice, reviseScript }) {
  const created = await call('project_create', { title, type, mode }); const projectPath = created.path;
  note(`▶ ${title} (${type} ${created.aspectRatio}, modo ${mode})`);
  if (mode === 'review') { const blocked = await call('stage_approve', { path: projectPath }).catch(error => error.code); if (blocked !== 'APPROVAL_REQUIRED') throw new Error('agente aprovou sozinho em modo revisão'); note('  🔒 agente tentou aprovar sozinho em modo revisão → recusado (APPROVAL_REQUIRED)'); }
  await call('creative_write', { path: projectPath, brief }); await gate(projectPath, mode);
  await call('creative_write', { path: projectPath, script });
  if (reviseScript) {
    const decision = await gate(projectPath, mode, { changes: 'Abertura mais forte, com pergunta' });
    if (decision?.decision === 'changes_requested') { await call('creative_write', { path: projectPath, script: { hook: reviseScript } }); note('  ✎ agente reescreveu a abertura e reenviou'); }
  }
  await gate(projectPath, mode);
  await call('creative_write', { path: projectPath, packaging }); await gate(projectPath, mode);
  const slides = await call('media_generate_slides', { path: projectPath }); note(`  ${slides.slides.length} slides gerados`); await gate(projectPath, mode);
  const job = await call('narration_generate', { path: projectPath, engine: 'standard', voice }); await waitJob(projectPath, job.jobId, 'narração');
  const assembled = await call('narration_assemble', { path: projectPath, preset: 'balanced' }); await waitJob(projectPath, assembled.jobId, 'montagem da narração');
  const timeline = await call('timeline_auto_assemble', { path: projectPath, captionStyle: 'legenda' }); note(`  timeline: ${timeline.durationSeconds.toFixed(1)} s, ${timeline.visualClips} clips, ${timeline.captions} legendas`);
  await gate(projectPath, mode); // narração
  await gate(projectPath, mode); // edição
  await call('thumbnails_generate', { path: projectPath });
  const render = await call('render_start', { path: projectPath, preset: type === 'short' ? 'hd' : 'full-hd' }); const rendered = await waitJob(projectPath, render.jobId, 'render');
  await gate(projectPath, mode); // revisão e render
  const delivery = await call('deliverable_build', { path: projectPath });
  const zip = await call('project_export', { path: projectPath, format: 'zip', outputDirectory: path.join(work, 'exportados'), includeRenders: true });
  const info = probe(rendered.output); const video = info.streams.find(item => item.codec_type === 'video');
  const summary = await call('project_get', { path: projectPath });
  note(`  ✔ entregue: ${video.width}x${video.height} ${Number(info.format.duration).toFixed(1)} s · ${delivery.files.join(', ')} · etapas concluídas: ${summary.done}`);
  return { title, projectPath, output: rendered.output, duration: Number(info.format.duration), size: `${video.width}x${video.height}`, delivery, zip: zip.path || zip.output, done: summary.done };
}

const results = [];
try {
  note(`Status antes de abrir: ${JSON.stringify(await call('contentlab_status'))}`);
  await call('contentlab_start'); const status = await call('contentlab_status');
  note(`App aberto pelo agente: v${status.version}, narração padrão ${status.narration.standard ? 'pronta' : 'AUSENTE'}, voz clonada ${status.narration.cloned ? 'pronta' : 'não instalada'}`);
  const clone = await call('narration_generate', { path: '/nao/existe', engine: 'cloned' }).catch(error => error.code);
  note(`Voz clonada sem perfil → ${clone}`);

  results.push(await produce({
    title: 'Por que esquecemos os sonhos', type: 'long', mode: 'review', voice: 'pm_alex',
    brief: { thesis: 'O cérebro desliga a gravação de memória durante o sono REM', audience: 'Curiosos de ciência, 18 a 35 anos', promise: 'Entender em poucos minutos por que os sonhos somem ao acordar', notes: '' },
    script: {
      hook: 'Você acorda lembrando de um sonho incrível. Dois minutos depois, ele simplesmente desapareceu.',
      development: 'Durante o sono REM, a parte do cérebro que organiza memórias novas fica quase em silêncio. É como assistir a um filme com o gravador desligado.\n\nAlém disso, um neurotransmissor chamado noradrenalina, essencial para fixar lembranças, cai ao mínimo enquanto sonhamos. Sem ele, as cenas passam e não ficam.\n\nOs pesquisadores perceberam algo curioso: quem acorda devagar, sem alarme, lembra mais. O cérebro ganha alguns segundos para copiar o sonho para a memória de curto prazo.\n\nE existe um truque simples. Antes de abrir os olhos, fique parado e repita mentalmente a última cena. Depois anote tudo em um caderno ao lado da cama.',
      payoff: 'Esquecer os sonhos não é defeito, é economia de energia do cérebro. Mas agora você sabe como guardar os melhores. Conta nos comentários qual foi o sonho mais estranho que você já teve.',
    },
    reviseScript: 'Por que um sonho tão vívido some em dois minutos? A resposta está no gravador que o seu cérebro desliga toda noite.',
    packaging: { titleA: 'Por que você esquece os sonhos?', titleB: 'O gravador que seu cérebro desliga à noite', description: 'A ciência explica por que os sonhos somem ao acordar, e um truque simples para lembrar dos melhores.', tags: 'sonhos, ciência, cérebro, sono, memória', seo: 'por que esquecemos os sonhos sono REM memória' },
  }));

  const ideas = [
    ['O polvo tem três corações', 'Um polvo tem três corações e sangue azul.', 'Dois corações bombeiam sangue para as brânquias e o terceiro para o resto do corpo. O sangue é azul por causa do cobre, que transporta oxigênio no frio do fundo do mar.', 'Quando ele nada, o coração principal para. Por isso o polvo prefere rastejar. Segue para mais curiosidades.'],
    ['Mel não estraga', 'Arqueólogos encontraram mel de três mil anos ainda comestível.', 'O mel tem pouquíssima água e é ácido, então bactérias não conseguem sobreviver nele. As abelhas ainda adicionam uma enzima que produz um conservante natural.', 'Se o seu mel cristalizou, não estragou: é só aquecer em banho-maria. Salva esse vídeo.'],
    ['Por que o céu é azul', 'O céu não é azul por causa do mar.', 'A luz do sol tem todas as cores, mas o azul tem ondas curtas e se espalha muito mais no ar. Esse azul espalhado chega aos seus olhos de todas as direções.', 'No pôr do sol, a luz atravessa mais ar e o azul se perde, sobrando o laranja. Comenta qual cor você prefere.'],
    ['Bananas são radioativas', 'Toda banana é um pouquinho radioativa.', 'Ela tem potássio, e uma pequena parte do potássio natural emite radiação. Mas você precisaria comer milhões de bananas de uma vez para isso fazer mal.', 'Então pode comer tranquilo. O seu próprio corpo é mais radioativo que uma banana. Segue para mais.'],
    ['Formigas não dormem como nós', 'Uma formiga tira centenas de cochilos por dia.', 'Cada cochilo dura cerca de um minuto, somando umas quatro horas e meia. Assim a colônia nunca fica sem ninguém acordado para trabalhar.', 'A rainha, por outro lado, dorme bem mais e vive muitos anos. Qual curiosidade você quer no próximo?'],
  ].slice(0, shortsCount);
  const voices = ['pf_dora', 'pm_alex', 'pm_santa', 'pf_dora', 'pm_alex'];
  for (const [index, [title, hook, development, payoff]] of ideas.entries()) {
    results.push(await produce({ title, type: 'short', mode: 'autonomous', voice: voices[index], brief: { thesis: hook, audience: 'Público geral de Shorts', promise: 'Uma curiosidade em menos de um minuto', notes: '' }, script: { hook, development, payoff }, packaging: { titleA: title, titleB: `${title}?!`, description: `${hook} ${payoff}`, tags: 'curiosidades, shorts, ciência', seo: title.toLowerCase() } }));
  }

  note('Desligando o app pelo agente e abrindo de novo para provar que tudo persiste…');
  await call('contentlab_stop', { force: false }); await new Promise(resolve => setTimeout(resolve, 2000));
  note(`Depois de desligar: ${JSON.stringify(await call('contentlab_status'))}`);
  await call('contentlab_start');
  const listed = (await call('project_list')).projects;
  for (const item of results) { const again = await call('project_get', { path: item.projectPath }); item.persisted = listed.some(project => project.path === item.projectPath) && again.done; await stat(item.output); }
  note(`Após reabrir: ${results.filter(item => item.persisted).length}/${results.length} projetos nos Recentes, concluídos e com vídeo em disco`);
} catch (error) {
  note(`✘ ${error.message}`); process.exitCode = 1;
} finally {
  await call('contentlab_stop', { force: true }).catch(() => {});
  await client.close();
  const report = ['# QA do fluxo de agente via MCP', '', `Executado em ${new Date().toISOString()} · ${os.platform()} ${os.arch()} · narração padrão Kokoro`, '', '| Projeto | Formato | Duração | Entrega | Persistiu após reabrir |', '| --- | --- | --- | --- | --- |', ...results.map(item => `| ${item.title} | ${item.size} | ${item.duration.toFixed(1)} s | ${item.delivery.files.length} arquivos | ${item.persisted ? 'sim' : 'não'} |`), '', '## Log', '', '```', ...log, '```', ''].join('\n');
  await writeFile(path.join(root, 'docs', 'QA_MCP_AGENTE.md'), report);
  console.log(`\nRelatório: docs/QA_MCP_AGENTE.md · artefatos: ${process.argv.includes('--keep') ? work : '(removidos)'}`);
  if (!process.argv.includes('--keep')) await rm(work, { recursive: true, force: true });
}
