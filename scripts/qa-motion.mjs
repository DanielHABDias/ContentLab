#!/usr/bin/env node
// QA do modo composição pelo MCP real (como um chat faria):
//  A) vídeo narrado: roteiro → mídias da "obra" (próprias) → narração → transcrição → motion_plan_auto →
//     motion_preview → render → entrega;
//  B) o demo "herói perfeito" refeito pelo Content Lab: sem narração, beats escritos pelo agente (motion_plan_set);
//  C) Short 9:16 narrado com plano automático (cenas diagramadas para vertical, apartes do personagem).
// O personagem é de teste, neutro (formas simples, 3 poses), gerado aqui e importado com character_import.
// --only=ac roda só os cenários escolhidos.
// Extrai frames do vídeo final e mede o áudio.   node scripts/qa-motion.mjs [--keep]
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { makeCharacterPack } from '../src/test/character-fixture.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = await mkdtemp(path.join(os.tmpdir(), 'contentlab-motion-qa-'));
const port = String(4600 + Math.floor(Math.random() * 300));
const env = { ...process.env, CONTENTLAB_PORT: port, CONTENTLAB_DATA_DIR: path.join(work, 'data'), CONTENTLAB_PROJECTS_DIR: path.join(work, 'projetos'), CONTENTLAB_TOOLS_DIR: process.env.CONTENTLAB_TOOLS_DIR || path.join(root, '.tools'), XDG_DATA_HOME: path.join(work, 'xdg') };
const log = []; const started = Date.now();
const note = message => { const line = `[${((Date.now() - started) / 1000).toFixed(0).padStart(4)} s] ${message}`; log.push(line); console.log(line); };
const client = new Client({ name: 'qa-motion', version: '1' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'src/adapters/mcp-server.js')], env, cwd: root }));
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 1_800_000 });
  const value = JSON.parse(result.content[0].text);
  if (result.isError) throw Object.assign(new Error(`${name}: ${value.error}`), { code: value.code });
  return value;
}
async function waitJob(projectPath, jobId, label) { for (;;) { const job = await call('job_wait', { path: projectPath, jobId, timeoutSeconds: 120 }); if (!job.waiting) { if (job.state !== 'completed') throw new Error(`${label}: ${job.state} ${job.error || ''}`); return job; } note(`  … ${label}: ${job.phase || ''} ${typeof job.progress === 'number' ? `${Math.round(job.progress * 100)}%` : ''}`); } }
const approve = async projectPath => { const { currentStage } = await call('project_get', { path: projectPath }); if (currentStage?.missing?.length) throw new Error(`Etapa ${currentStage.id} incompleta: ${currentStage.missing.join(', ')}`); await call('stage_approve', { path: projectPath }); };
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', file], { encoding: 'utf8' }));
const loudness = file => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const sheet = async (video, out, every = 1) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-vf', `fps=1/${every},scale=w=320:h=320:force_original_aspect_ratio=decrease,tile=8x8`, '-frames:v', '1', out]);

// "Cenas da obra": mídias próprias com nomes descritivos (ícones do kit e um trecho de vídeo gerado) e o personagem de teste.
const brand = path.join(root, 'assets/kit');
const mediaDir = path.join(work, 'midias'); await mkdir(mediaDir, { recursive: true });
const icons = ['escudo', 'lampada', 'balanca', 'caminho', 'mascara', 'raio'].map(name => { const out = path.join(mediaDir, `${name}.png`); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-c:v', 'librsvg', '-width', '1000', '-i', path.join(brand, 'graphics', `${name}.svg`), '-frames:v', '1', out]); return out; });
const personagem = await makeCharacterPack(path.join(work, 'personagem'));
const heroi = path.join(mediaDir, 'heroi.png'); await copyFile(path.join(personagem, 'parado.png'), heroi);
const clip = path.join(mediaDir, 'muralha-caindo.mp4'); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1280x720:r=30:d=6', '-vf', 'hue=s=0.3,eq=contrast=1.3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip]);

const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7) || 'abc';
async function project({ title, brief, script, packaging, type = 'long' }) {
  const created = await call('project_create', { title, type, mode: 'autonomous' }); const projectPath = created.path;
  await call('creative_write', { path: projectPath, brief }); await approve(projectPath);
  await call('creative_write', { path: projectPath, script }); await approve(projectPath);
  await call('creative_write', { path: projectPath, packaging }); await approve(projectPath);
  return projectPath;
}
async function finish(projectPath, label) {
  await approve(projectPath); await approve(projectPath); // narração, edição (modo composição)
  await call('thumbnails_generate', { path: projectPath });
  const render = await call('render_start', { path: projectPath, preset: 'full-hd' }); const rendered = await waitJob(projectPath, render.jobId, 'render');
  await approve(projectPath);
  const delivery = await call('deliverable_build', { path: projectPath });
  const info = probe(rendered.output); const video = info.streams.find(item => item.codec_type === 'video');
  const audio = loudness(rendered.output); const lufs = audio.match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0]; const peak = audio.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0];
  const frames = path.join(work, `frames-${label}.png`); await sheet(rendered.output, frames);
  note(`  ✔ ${video.width}x${video.height} ${video.r_frame_rate} ${Number(info.format.duration).toFixed(1)} s, ${lufs} LUFS (pico ${peak} dBTP) · verificação: ${delivery.checks.map(item => `${item.id}=${item.ok ? 'ok' : 'pendente'}`).join(' ')}`);
  return { output: rendered.output, frames, duration: Number(info.format.duration), size: `${video.width}x${video.height}`, lufs, peak, delivery };
}

const results = [];
try {
  await call('contentlab_start');
  const kit = await call('motion_kit'); note(`kit: ${Object.keys(kit.cenas).length} cenas, ${kit.humores.length} humores, ${kit.sfx.length} SFX`);

  // A) Vídeo narrado, plano automático.
  if (only.includes('a')) {
  const a = await project({
    title: 'O escudo que pesava demais',
    brief: { thesis: 'Proteger tudo o tempo todo impede o herói de escolher o que importa', audience: 'Fãs de heróis', promise: 'Entender por que um herói precisa escolher o que proteger', notes: 'O herói participa' },
    script: {
      hook: 'Imagina um herói que protege tudo. O tempo todo. Parece incrível, né?',
      development: 'O herói carregava um escudo enorme. Cada pessoa nova era mais um peso. E um dia ele percebeu que chegava atrasado em todo lugar.\n\nFoi aí que veio a lâmpada. Ele não precisava de um escudo maior. Precisava escolher onde estar. Uma balança, não uma muralha.\n\nEm 2023, 87% das histórias mais lembradas tinham um herói obrigado a escolher. Escolher dói. Mas quem escolhe chega a tempo.',
      payoff: 'Proteger não é segurar o mundo inteiro. É decidir o que vale o seu peso. E você, o que está carregando que não precisava?',
    },
    packaging: { titleA: 'O escudo que pesava demais', titleB: 'Por que herói precisa escolher', description: 'O herói aprende que proteger tudo é não proteger nada.', tags: 'heróis, escolhas', seo: 'herói escolhas' },
  });
  note(`▶ A: ${path.basename(a)} (narrado, plano automático)`);
  const imported = await call('media_import_files', { path: a, files: [heroi, ...icons, clip], rights: 'owned' }); await waitJob(a, imported.jobId, 'importação');
  const charA = await call('character_import', { path: a, folder: personagem, rights: 'owned', rightsConfirmedByUser: true }); note(`  personagem: ${charA.name}, ${charA.poses} poses, ${charA.files} PNGs`);
  await call('audio_library', { path: a, seconds: 120 }); await approve(a);
  const narration = await call('narration_generate', { path: a, engine: 'standard', voice: 'pm_alex' }); await waitJob(a, narration.jobId, 'narração');
  const assembled = await call('narration_assemble', { path: a, preset: 'balanced' }); await waitJob(a, assembled.jobId, 'montagem da narração');
  const transcribed = await call('narration_transcribe', { path: a }); if (transcribed.jobId) await waitJob(a, transcribed.jobId, 'transcrição');
  const auto = await call('motion_plan_auto', { path: a });
  note(`  plano: ${auto.beats} beats em ${auto.durationSeconds} s (média ${auto.averageBeat} s) · cenas ${JSON.stringify(auto.scenes)} · ${auto.media} mídia(s) · avisos: ${auto.warnings.join(' | ') || 'nenhum'}`);
  const preview = await call('motion_preview', { path: a, seconds: [1, 6, 12, 20, 30] }); note(`  prévia: ${preview.files.length} frames`);
  results.push({ key: 'a-narrado', label: 'A narrado (plano automático)', ...(await finish(a, 'a')), previews: preview.files });
  }

  // B) O demo refeito pelo Content Lab: sem narração, beats do agente.
  if (only.includes('b')) {
  const b = await project({
    title: 'Por que um herói perfeito é chato',
    brief: { thesis: 'Uma fraqueza cria a história', audience: 'Fãs de heróis', promise: 'Entender por que heróis precisam de fraquezas', notes: 'Sem narração' },
    script: { hook: 'Imagina um herói que nunca perde.', development: 'Ele é perfeito. E o público perde o interesse. Tensão é o que ele quer vezes o que pode perder.\n\nDê a ele um limite, um custo e uma escolha.', payoff: 'Uma fraqueza não diminui o herói. Ela cria a história.' },
    packaging: { titleA: 'Por que um herói perfeito é chato', titleB: 'A fraqueza que cria a história', description: 'Um explicador sem narração.', tags: 'heróis', seo: 'herói fraqueza' },
  });
  note(`▶ B: ${path.basename(b)} (sem narração, beats do agente)`);
  const importedB = await call('media_import_files', { path: b, files: [icons[0], clip], rights: 'owned' }); await waitJob(b, importedB.jobId, 'importação');
  await call('character_import', { path: b, folder: personagem, rights: 'owned', rightsConfirmedByUser: true });
  await call('audio_library', { path: b, seconds: 70 }); await approve(b);
  const ids = (await call('project_get', { path: b })).media.reduce((map, item) => ({ ...map, [item.name]: item.id }), {});
  const s = (name, at = 0, volume = 0.5) => ({ name, at, volume });
  const beats = [
    { scene: 'titulo', duration: 3, props: { palavras: ['IMAGINA', 'UM HERÓI', 'QUE NUNCA PERDE.'] }, sfx: [s('impact', 0, 0.9), s('sub', 0, 0.6), s('swish', 1), s('glitch', 1.85, 0.6)] },
    { scene: 'ficha', duration: 4, props: { titulo: 'FICHA DO HERÓI #001', itens: [{ rotulo: 'FORÇA', valor: 100 }, { rotulo: 'VELOCIDADE', valor: 100 }, { rotulo: 'INTELIGÊNCIA', valor: 100 }, { rotulo: 'RISCO', valor: 0 }], carimbo: 'PERFEITO', humor: 'feliz' }, sfx: [s('whoosh'), s('pop', 0, 0.7), s('tick', 0.4), s('tick', 0.9), s('tick', 1.4), s('ding', 2.4), s('impact', 3, 0.6)] },
    { scene: 'personagem', duration: 3, props: { humor: 'piscada', texto: 'PERFEITO,', subtexto: 'NÉ?' }, sfx: [s('whoosh', 0, 0.6), s('pop', 0.2, 0.6)] },
    { scene: 'numero', duration: 4, props: { valor: 13, de: 100, sufixo: '%', rotulo: 'Interesse do público', tendencia: 'desce', fonte: 'simulação' }, sfx: [s('swish'), s('tick', 0.6, 0.35), s('tick', 1.2, 0.35), s('error', 2.6, 0.5)] },
    { scene: 'titulo', duration: 3, props: { palavras: ['MAS', 'POR QUÊ?'], fundo: 'branco' }, sfx: [s('impact', 0, 1), s('sub', 0, 0.7), s('pop', 1.5, 0.6)] },
    { scene: 'pagina', duration: 6, props: { paineis: [{ midia: `media:${ids['escudo.png']}`, rotulo: 'O VILÃO APARECE…' }, { humor: 'bravo', rotulo: '…E PERDE. EM 1 SEGUNDO.', onomatopeia: 'POW!' }, { humor: 'tedio', rotulo: 'FIM.' }], conclusao: 'SEM RISCO = SEM HISTÓRIA.' }, sfx: [s('camera'), s('camera', 1.3), s('impact', 1.5, 0.7), s('camera', 2.6)] },
    { scene: 'formula', duration: 8, props: { titulo: 'A FÓRMULA DA TENSÃO', termos: [{ rotulo: 'o que ele', valor: 'QUER' }, { rotulo: 'o que pode', valor: 'PERDER', vira: '0' }, { rotulo: 'resultado', valor: 'HISTÓRIA', vira: '0' }], carimbo: 'ZERO TENSÃO' }, sfx: [s('whoosh'), s('pop', 0.3), s('pop', 1.1), s('pop', 1.9), s('glitch', 3.2, 0.6), s('error', 3.6, 0.5), s('impact', 5.2, 0.9)] },
    { scene: 'lista', duration: 8, props: { titulo: 'COMO CONSERTAR?', subtitulo: 'dê a ele uma fraqueza.', prefixo: 'FRAQUEZA', itens: [{ titulo: 'UM LIMITE', texto: 'o que ele NÃO consegue fazer' }, { titulo: 'UM CUSTO', texto: 'vencer cobra alguma coisa' }, { titulo: 'UMA ESCOLHA', texto: 'salvar um = perder outro' }], conclusao: '= RISCO REAL' }, sfx: [s('whoosh'), s('swish', 0.5), s('swish', 2.2), s('swish', 3.9), s('impact', 5.8, 0.5)] },
    { scene: 'evidencia', duration: 4, props: { midia: `media:${ids['muralha-caindo.mp4']}`, rotulo: 'UMA MURALHA CAI', legenda: 'e a história começa.', humor: 'surpreso', tela: true }, sfx: [s('camera'), s('whoosh', 0.1)] },
    { scene: 'numero', duration: 5, props: { valor: 94, de: 13, sufixo: '%', rotulo: 'Interesse do público', tendencia: 'sobe', fonte: 'simulação', marcos: ['LIMITE', 'CUSTO', 'ESCOLHA'] }, sfx: [s('riser', 0, 0.35), s('ding', 1.6, 0.45), s('ding', 2.6, 0.45), s('ding', 3.6, 0.5)] },
    { scene: 'frase', duration: 5, props: { linhas: ['uma fraqueza', 'não diminui o herói.'], riscar: 'diminui', destaque: 'A HISTÓRIA.' }, sfx: [s('swish', 0, 0.4), s('glitch', 1.2, 0.4), s('impact', 2.75, 0.9), s('sub', 2.75, 0.7)] },
    { scene: 'cta', duration: 7, props: { pergunta: 'qual fraqueza deixa o seu herói favorito interessante?' }, sfx: [s('riser', -1.8, 0.5), s('impact', 0, 1), s('pop', 1.4, 0.6), s('ding', 3, 0.5)] },
  ];
  let at = 0; const plan = { narration: false, captions: false, music: { volume: 0.55, duck: 1 }, beats: beats.map((beat, i) => { const value = { id: `b${i + 1}`, at, ...beat }; at += beat.duration; return value; }) };
  const set = await call('motion_plan_set', { path: b, plan }); note(`  plano do agente: ${set.beats} beats em ${set.durationSeconds} s · cenas ${JSON.stringify(set.scenes)}`);
  results.push({ key: 'b-demo-refeito', label: 'B demo refeito (sem narração)', ...(await finish(b, 'b')) });
  }

  // C) Short 9:16 narrado, plano automático.
  if (only.includes('c')) {
  const c = await project({
    type: 'short',
    title: 'O herói que não podia perder',
    brief: { thesis: 'Sem risco não existe história', audience: 'Fãs de heróis', promise: 'Entender em 1 minuto por que herói precisa de fraqueza', notes: 'Short' },
    script: {
      hook: 'Esse herói nunca perdeu uma luta. E é exatamente esse o problema.',
      development: 'Olha esse escudo. Aguenta qualquer coisa. Legal, né?\n\nSó que quando nada pode dar errado, você para de se importar. Pra que torcer se ele sempre vence?\n\nAí a muralha cai. Pela primeira vez, ele pode perder. E de repente você não consegue parar de olhar.\n\nO raio não deixa ele mais forte. A lâmpada mostra a escolha. Salvar um, ou salvar outro?',
      payoff: 'Fraqueza não estraga o herói. Ela cria a história. Qual herói você só começou a gostar quando ele perdeu?',
    },
    packaging: { titleA: 'O herói que não podia perder', titleB: 'Por que herói invencível é chato', description: 'Por que fraqueza cria história.', tags: 'shorts, heróis', seo: 'herói fraqueza' },
  });
  note(`▶ C: ${path.basename(c)} (Short 9:16 narrado, plano automático)`);
  const importedC = await call('media_import_files', { path: c, files: [...icons, clip], rights: 'owned' }); await waitJob(c, importedC.jobId, 'importação');
  await call('character_import', { path: c, folder: personagem, rights: 'owned', rightsConfirmedByUser: true });
  await call('audio_library', { path: c, seconds: 80 }); await approve(c);
  const narrationC = await call('narration_generate', { path: c, engine: 'standard', voice: 'pm_alex' }); await waitJob(c, narrationC.jobId, 'narração');
  const assembledC = await call('narration_assemble', { path: c, preset: 'balanced' }); await waitJob(c, assembledC.jobId, 'montagem da narração');
  const transcribedC = await call('narration_transcribe', { path: c }); if (transcribedC.jobId) await waitJob(c, transcribedC.jobId, 'transcrição');
  const autoC = await call('motion_plan_auto', { path: c });
  note(`  plano: ${autoC.beats} beats em ${autoC.durationSeconds} s (média ${autoC.averageBeat} s) · cenas ${JSON.stringify(autoC.scenes)} · avisos: ${autoC.warnings.join(' | ') || 'nenhum'}`);
  const previewC = await call('motion_preview', { path: c }); note(`  prévia: ${previewC.files.length} frames`);
  results.push({ key: 'c-short', label: 'C Short 9:16 (plano automático)', ...(await finish(c, 'c')), previews: previewC.files });
  }
} catch (error) {
  note(`✘ ${error.stack || error.message}`); process.exitCode = 1;
} finally {
  await call('contentlab_stop', { force: true }).catch(() => {});
  await client.close();
  const keep = path.join(root, '.tools/qa-f29'); await mkdir(keep, { recursive: true });
  for (const item of results) { const dir = path.join(keep, item.key); await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true }); await copyFile(item.output, path.join(dir, 'video.mp4')); await copyFile(item.frames, path.join(dir, 'frames.png')); for (const file of item.previews || []) await copyFile(file, path.join(dir, path.basename(file))); for (const file of await readdir(item.delivery.directory)) if (file.endsWith('.md')) await copyFile(path.join(item.delivery.directory, file), path.join(dir, file)); }
  const report = ['# QA do modo composição via MCP', '', `Executado em ${new Date().toISOString()} · ${os.platform()} ${os.arch()} · kit de motion do Content Lab · personagem de teste neutro (3 poses)`, '', 'Mídias próprias com nomes descritivos fazem o papel das cenas das obras; num vídeo real entram imagens e trechos das obras citadas, com direitos confirmados.', '', '| Produção | Formato | Duração | Loudness | Pico | Verificação |', '| --- | --- | --- | --- | --- | --- |', ...results.map(item => `| ${item.label} | ${item.size} | ${item.duration.toFixed(1)} s | ${item.lufs} LUFS | ${item.peak} dBTP | ${item.delivery.checks.filter(check => check.ok).length}/${item.delivery.checks.length} |`), '', '## Registro', '', '```text', ...log, '```', ''].join('\n');
  await writeFile(path.join(root, 'docs', 'QA_MOTION.md'), report);
  console.log(`\nRelatório: docs/QA_MOTION.md · amostras: .tools/qa-f29 · artefatos: ${process.argv.includes('--keep') ? work : '(removidos)'}`);
  if (!process.argv.includes('--keep')) await rm(work, { recursive: true, force: true });
}
