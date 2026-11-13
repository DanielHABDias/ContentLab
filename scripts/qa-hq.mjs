#!/usr/bin/env node
// QA do modo clips com cenas HQ pelo MCP real (como um chat faria): imagens do assunto importadas (um
// personagem de teste e ícones do kit, direitos próprios), narração transcrita para legenda palavra a palavra, cenas
// HQ com um beat visual por frase, SFX e trilha de rascunho com ducking, capítulos; Short
// 1080×1920 com um diálogo do personagem escolhido pelo agente. Extrai frames e mede o áudio.
//   node scripts/qa-hq.mjs [--keep]
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { makeCharacterPack } from '../src/test/character-fixture.js';

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

async function produce({ title, type, brief, script, packaging, voice, scenes, shots, images }) {
  const created = await call('project_create', { title, type, mode: 'autonomous' }); const projectPath = created.path;
  note(`▶ ${title} (${type} ${created.aspectRatio})`);
  await call('creative_write', { path: projectPath, brief }); await approve(projectPath);
  await call('creative_write', { path: projectPath, script }); await approve(projectPath);
  await call('creative_write', { path: projectPath, packaging }); await approve(projectPath);
  const imported = await call('media_import_files', { path: projectPath, files: images, rights: 'owned' }); await waitJob(projectPath, imported.jobId, 'importação');
  note(`  ${images.length} imagens do assunto importadas (direitos próprios)`);
  const audio = await call('audio_library', { path: projectPath, seconds: 240 }); note(`  ${Object.keys(audio.sfx).length} SFX originais e trilha de rascunho (${audio.rights})`);
  await approve(projectPath); // mídia
  const job = await call('narration_generate', { path: projectPath, engine: 'standard', voice }); await waitJob(projectPath, job.jobId, 'narração');
  const assembled = await call('narration_assemble', { path: projectPath, preset: 'balanced' }); await waitJob(projectPath, assembled.jobId, 'montagem da narração');
  const transcribed = await call('narration_transcribe', { path: projectPath }); if (transcribed.jobId) await waitJob(projectPath, transcribed.jobId, 'transcrição');
  const listed = await call('scene_list', { path: projectPath });
  note(`  cenas disponíveis: ${listed.components.length}; ${listed.evidence.length} imagens; plano (${listed.timing}): ${listed.suggestion.map(item => `${item.componentId.replace('dv_', '')} ${item.length.toFixed(1)}s`).join(', ')}`);
  const plan = scenes === 'auto' ? 'auto' : scenes(listed.suggestion, listed.evidence);
  const timeline = await call('timeline_auto_assemble', { path: projectPath, scenes: plan, music: true, sfx: true });
  note(`  timeline: ${timeline.durationSeconds.toFixed(1)} s, ${timeline.sceneClips} cenas, ${timeline.images} imagens distintas, trilha=${timeline.music}, sfx=${timeline.sfx}, ${timeline.captions} legendas (${timeline.captionSync}), área segura ${timeline.safeArea}`);
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

// Imagens com direitos próprios: um personagem de teste (formas simples) e os ícones originais do kit rasterizados.
const brand = path.join(root, 'assets/kit');
const imageDir = path.join(work, 'imagens'); await mkdir(imageDir, { recursive: true });
const icons = ['escudo', 'lampada', 'balanca', 'caminho', 'mascara', 'raio'].map(name => { const out = path.join(imageDir, `${name}.png`); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-c:v', 'librsvg', '-width', '900', '-i', path.join(brand, 'graphics', `${name}.svg`), '-frames:v', '1', out]); return out; });
const heroi = path.join(await makeCharacterPack(path.join(work, 'personagem')), 'parado.png');

const results = [];
try {
  await call('contentlab_start');
  results.push(await produce({
    title: 'O escudo que pesava demais', type: 'long', voice: 'pm_alex', scenes: 'auto', images: [heroi, ...icons],
    shots: duration => Array.from({ length: 10 }, (_, index) => ((index + 0.5) * duration) / 10),
    brief: { thesis: 'Proteger tudo o tempo todo impede o herói de escolher o que realmente importa', audience: 'Fãs de heróis que gostam de entender escolhas', promise: 'Entender por que um herói precisa escolher o que proteger', notes: 'O herói participa da explicação' },
    script: {
      hook: 'O herói carregava um escudo enorme. Ele protegia tudo. E justamente por isso, não protegia nada direito.',
      development: 'Todo herói começa assim. Quer salvar todo mundo, ao mesmo tempo, sem perder ninguém. Parece nobre. Na prática, é uma promessa impossível.\n\nO escudo pesa. Cada pessoa nova é mais um peso. E um dia o herói percebeu que estava sempre atrasado, sempre cansado, sempre um passo atrás.\n\nFoi aí que veio a lâmpada. Ele não precisava de um escudo maior. Precisava escolher onde estar. Uma balança, não uma muralha.\n\nEscolher dói. Quem fica de fora cobra. Mas um herói que escolhe chega a tempo. Um herói que tenta tudo chega tarde em todo lugar.',
      payoff: 'Proteger não é segurar o mundo inteiro. É decidir o que vale o seu peso. E você, o que está carregando que não precisava?',
    },
    packaging: { titleA: 'O escudo que pesava demais', titleB: 'Por que herói precisa escolher', description: 'O herói aprende que proteger tudo é não proteger nada.', tags: 'heróis, escolhas', seo: 'herói escolhas responsabilidade' },
  }));
  results.push(await produce({
    title: 'O herói e a regra quebrada', type: 'short', voice: 'pf_dora', images: [heroi, icons[0], icons[4], icons[1], icons[5]],
    shots: duration => Array.from({ length: 8 }, (_, index) => Math.min(duration - 0.3, 0.6 + (index * duration) / 8)),
    // O agente troca o 3º beat por um diálogo: herói × a regra (ícone da máscara), com tempos dentro do beat.
    scenes: (suggestion, evidence) => suggestion.map((item, index) => index !== 2 ? item : { ...item, componentId: 'dv_dialogo_hq', props: {
      backgroundStyle: 'halftone', left: { asset: 'heroi', name: 'HERÓI', color: '#2676E8' }, right: { asset: 'regra', name: 'A REGRA', color: '#EF3F49' },
      turns: [{ speaker: 'left', text: 'POR QUE EU SIGO VOCÊ?', at: 0, duration: Math.floor(item.length * 10 / 2) / 10, animation: 'escrita', writeDuration: 0.6 }, { speaker: 'right', text: 'PORQUE SEMPRE FOI ASSIM.', at: Math.floor(item.length * 10 / 2) / 10, duration: Math.floor(item.length * 10 / 2) / 10 - 0.05, animation: 'none' }],
      assets: { heroi: evidence[0].ref, regra: evidence[2].ref, anton: 'brand:anton' } } }),
    brief: { thesis: 'Regras ajudam, mas seguir sem perguntar também é uma escolha', audience: 'Público de Shorts', promise: 'Uma ideia sobre regras e escolhas em um minuto', notes: 'Herói participa' },
    script: {
      hook: 'Toda regra que você segue foi a escolha de alguém. A pergunta é: ela ainda faz sentido?',
      development: 'O herói seguia uma regra antiga. Ninguém lembrava quem tinha criado. Todo mundo só obedecia, porque sempre foi assim.\n\nUm dia ele perguntou por quê. Silêncio. A regra protegia um problema que nem existia mais.\n\nSeguir é confortável. Você não erra sozinho. Escolher dá trabalho, porque o erro passa a ser seu. Mas é o único jeito de alguma coisa mudar.',
      payoff: 'Regra boa aguenta uma pergunta. Qual regra na sua vida você nunca questionou? Me conta nos comentários.',
    },
    packaging: { titleA: 'A regra que ninguém questionava', titleB: 'Seguir ou escolher?', description: 'Um minuto sobre regras e escolhas, com o herói.', tags: 'shorts, escolhas', seo: 'regras escolhas' },
  }));
} catch (error) {
  note(`✘ ${error.stack || error.message}`); process.exitCode = 1;
} finally {
  await call('contentlab_stop', { force: true }).catch(() => {});
  await client.close();
  const report = ['# QA das cenas HQ via MCP', '', `Executado em ${new Date().toISOString()} · ${os.platform()} ${os.arch()} · narração padrão Kokoro · legenda palavra a palavra (Whisper) · cenas HQ do Content Lab · imagens próprias (personagem de teste e ícones) · SFX originais e trilha de rascunho`, '', 'Teste técnico do fluxo com imagens próprias; a qualidade editorial final depende das imagens reais dos personagens e de uma trilha licenciada, escolhidas pelo criador.', '', '| Projeto | Formato | Duração | Cenas HQ | Loudness | Capítulos | Verificação |', '| --- | --- | --- | --- | --- | --- | --- |', ...results.map(item => `| ${item.title} | ${item.size} | ${item.duration.toFixed(1)} s | ${item.sceneClips} | ${item.lufs} LUFS | ${item.chapters.length} | ${item.delivery.checks.filter(check => check.ok).length}/${item.delivery.checks.length} |`), '', '## Registro', '', '```text', ...log, '```', ''].join('\n');
  await writeFile(path.join(root, 'docs', 'QA_HQ.md'), report);
  console.log(`\nRelatório: docs/QA_HQ.md · artefatos: ${process.argv.includes('--keep') ? work : '(removidos)'}`);
  if (!process.argv.includes('--keep')) await rm(work, { recursive: true, force: true });
}
