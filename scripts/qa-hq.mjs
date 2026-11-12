#!/usr/bin/env node
// QA do estilo HQ pelo MCP real (como um chat faria): vídeo longo 16:9 com cenas HQ automáticas,
// trilha com ducking, SFX e capítulos; Short 1080×1920 com cenas escolhidas pelo agente e áreas
// seguras. Extrai um frame do meio de cada cena para inspeção visual e mede o áudio.
//   node scripts/qa-hq.mjs [--keep]
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = await mkdtemp(path.join(os.tmpdir(), 'contentlab-hq-'));
const port = String(4600 + Math.floor(Math.random() * 300));
const env = { ...process.env, CONTENTLAB_PORT: port, CONTENTLAB_DATA_DIR: path.join(work, 'data'), CONTENTLAB_PROJECTS_DIR: path.join(work, 'projetos'), CONTENTLAB_TOOLS_DIR: process.env.CONTENTLAB_TOOLS_DIR || path.join(root, '.tools'), XDG_DATA_HOME: path.join(work, 'xdg') };
const log = []; const started = Date.now();
const note = message => { const line = `[${((Date.now() - started) / 1000).toFixed(0).padStart(4)} s] ${message}`; log.push(line); console.log(line); };
const client = new Client({ name: 'qa-hq', version: '1' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'src/adapters/mcp-server.js')], env, cwd: root }));
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 900_000 });
  const value = JSON.parse(result.content[0].text);
  if (result.isError) throw Object.assign(new Error(`${name}: ${value.error}`), { code: value.code });
  return value;
}
async function waitJob(projectPath, jobId, label) { for (;;) { const job = await call('job_wait', { path: projectPath, jobId, timeoutSeconds: 120 }); if (!job.waiting) { if (job.state !== 'completed') throw new Error(`${label}: ${job.state} ${job.error || ''}`); return job; } note(`  … ${label}: ${job.phase || ''}`); } }
const approve = async projectPath => { const { currentStage } = await call('project_get', { path: projectPath }); if (currentStage?.missing?.length) throw new Error(`Etapa ${currentStage.id} incompleta: ${currentStage.missing.join(', ')}`); await call('stage_approve', { path: projectPath }); };
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', file], { encoding: 'utf8' }));
const loudness = file => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;

async function produce({ title, type, brief, script, packaging, voice, scenes, shots }) {
  const created = await call('project_create', { title, type, mode: 'autonomous' }); const projectPath = created.path;
  note(`▶ ${title} (${type} ${created.aspectRatio})`);
  await call('creative_write', { path: projectPath, brief }); await approve(projectPath);
  await call('creative_write', { path: projectPath, script }); await approve(projectPath);
  await call('creative_write', { path: projectPath, packaging }); await approve(projectPath);
  const audio = await call('audio_library', { path: projectPath, seconds: 240 }); note(`  trilha e ${Object.keys(audio.sfx).length} SFX originais gerados (${audio.rights})`);
  await approve(projectPath); // mídia
  const job = await call('narration_generate', { path: projectPath, engine: 'standard', voice }); await waitJob(projectPath, job.jobId, 'narração');
  const assembled = await call('narration_assemble', { path: projectPath, preset: 'balanced' }); await waitJob(projectPath, assembled.jobId, 'montagem da narração');
  const listed = await call('scene_list', { path: projectPath });
  note(`  cenas disponíveis: ${listed.components.length}; plano sugerido: ${listed.suggestion.map(item => item.componentId).join(', ')}`);
  const plan = scenes === 'auto' ? 'auto' : scenes(listed.suggestion);
  const timeline = await call('timeline_auto_assemble', { path: projectPath, scenes: plan, music: true, sfx: true });
  note(`  timeline: ${timeline.durationSeconds.toFixed(1)} s, ${timeline.sceneClips} cenas HQ, trilha=${timeline.music}, sfx=${timeline.sfx}, ${timeline.captions} legendas, área segura ${timeline.safeArea}`);
  await approve(projectPath); await approve(projectPath); // narração, edição
  await call('thumbnails_generate', { path: projectPath });
  const render = await call('render_start', { path: projectPath, preset: 'full-hd' }); const rendered = await waitJob(projectPath, render.jobId, 'render');
  await approve(projectPath); // revisão
  const delivery = await call('deliverable_build', { path: projectPath });
  const info = probe(rendered.output); const video = info.streams.find(item => item.codec_type === 'video');
  const frames = path.join(work, 'frames', type); await mkdir(frames, { recursive: true });
  const project = await call('project_get', { path: projectPath });
  const chapters = type === 'long' ? (await call('chapters_get', { path: projectPath })).chapters : [];
  for (const [index, at] of shots(Number(info.format.duration)).entries()) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(at), '-i', rendered.output, '-frames:v', '1', '-vf', 'scale=iw/2:-2', '-y', path.join(frames, `${String(index + 1).padStart(2, '0')}-${at.toFixed(1)}s.png`)]);
  const lufs = loudness(rendered.output).match(/I:\s+(-?[\d.]+) LUFS/)?.[1];
  note(`  ✔ ${video.width}x${video.height} ${video.r_frame_rate} ${Number(info.format.duration).toFixed(1)} s, ${lufs} LUFS · entrega: ${delivery.files.join(', ')} · verificação: ${delivery.checks.map(item => `${item.id}=${item.ok ? 'ok' : 'pendente'}`).join(' ')} · capítulos: ${chapters.length} · concluído: ${project.done}`);
  return { title, type, projectPath, output: rendered.output, duration: Number(info.format.duration), size: `${video.width}x${video.height}`, lufs, delivery, chapters, frames, sceneClips: timeline.sceneClips };
}

const results = [];
try {
  await call('contentlab_start');
  results.push(await produce({
    title: 'A escolha que mudou a Marvel', type: 'long', voice: 'pm_alex', scenes: 'auto',
    shots: duration => Array.from({ length: 8 }, (_, index) => ((index + 0.5) * duration) / 8),
    brief: { thesis: 'Uma editora à beira da falência se salvou ao apostar em heróis com defeitos humanos', audience: 'Fãs de quadrinhos e de histórias de negócios', promise: 'Entender a escolha criativa que salvou a Marvel', notes: '' },
    script: {
      hook: 'Em 1996 a Marvel estava falida. Vinte anos depois, valia bilhões. O que aconteceu no meio?',
      development: 'Para entender, precisamos voltar ao começo. Em 1939 nasce a Timely Comics. Em 1961 surge o Quarteto Fantástico. Em 1962 o Homem-Aranha muda tudo.\n\nA aposta era simples. Heróis com problemas de verdade. Contas atrasadas, brigas em família, medo de falhar.\n\nOs leitores não queriam deuses perfeitos. Queriam alguém parecido com eles, que mesmo assim escolhesse fazer o certo.\n\nQuando a crise chegou, essa ideia virou o ativo mais valioso da empresa: personagens que as pessoas sentiam como amigos.',
      payoff: 'A lição vale para qualquer história: perfeição não cria vínculo, escolhas difíceis criam. Qual personagem te ensinou isso?',
    },
    packaging: { titleA: 'A escolha que salvou a Marvel', titleB: 'Heróis com defeito valem bilhões', description: 'Como uma editora falida se reergueu apostando em heróis humanos.', tags: 'marvel, quadrinhos, história, negócios', seo: 'história da marvel falência 1996 homem-aranha' },
  }));
  results.push(await produce({
    title: 'Nox e a regra quebrada', type: 'short', voice: 'pf_dora',
    shots: duration => [0.8, duration * 0.3, duration * 0.55, duration * 0.8, duration - 0.6],
    scenes: suggestion => suggestion.map((item, index) => index === 1 ? { sceneId: item.sceneId, componentId: 'hq_dialogo', props: { lines: 'Nox: E se a regra estiver errada?\nVocê: Então eu sigo a regra mesmo assim?\nNox: Ou faz uma escolha melhor.' } }
      : index === 2 ? { sceneId: item.sceneId, componentId: 'hq_comparativo', props: { leftTitle: 'Seguir', leftItems: 'Seguro\nPrevisível', rightTitle: 'Escolher', rightItems: 'Arriscado\nSeu', leftColor: '#27a8ff', rightColor: '#ff435a' } }
      : { sceneId: item.sceneId, componentId: item.componentId, props: item.props }),
    brief: { thesis: 'Regras ajudam, mas a escolha é sua', audience: 'Público de Shorts', promise: 'Uma ideia sobre escolhas em um minuto', notes: '' },
    script: { hook: 'Toda regra foi uma escolha de alguém.', development: 'O Nox encontrou uma regra que não fazia mais sentido. E perguntou o que ninguém perguntava.\n\nSeguir é confortável. Escolher dá trabalho, mas é a única forma de algo mudar.', payoff: 'Qual regra você seguiria até o fim?' },
    packaging: { titleA: 'A regra quebrada', titleB: 'Seguir ou escolher?', description: 'Um minuto sobre regras e escolhas.', tags: 'shorts, escolhas, nox', seo: 'regras escolhas' },
  }));
} catch (error) {
  note(`✘ ${error.stack || error.message}`); process.exitCode = 1;
} finally {
  await call('contentlab_stop', { force: true }).catch(() => {});
  await client.close();
  const report = ['# QA do estilo HQ via MCP', '', `Executado em ${new Date().toISOString()} · ${os.platform()} ${os.arch()} · narração padrão Kokoro · cenas Remotion · trilha e SFX gerados`, '', '| Projeto | Formato | Duração | Cenas HQ | Loudness | Capítulos | Verificação |', '| --- | --- | --- | --- | --- | --- | --- |', ...results.map(item => `| ${item.title} | ${item.size} | ${item.duration.toFixed(1)} s | ${item.sceneClips} | ${item.lufs} LUFS | ${item.chapters.length} | ${item.delivery.checks.filter(check => check.ok).length}/${item.delivery.checks.length} |`), '', '## Registro', '', '```text', ...log, '```', ''].join('\n');
  await writeFile(path.join(root, 'docs', 'QA_HQ.md'), report);
  console.log(`\nRelatório: docs/QA_HQ.md · artefatos: ${process.argv.includes('--keep') ? work : '(removidos)'}`);
  if (!process.argv.includes('--keep')) await rm(work, { recursive: true, force: true });
}
