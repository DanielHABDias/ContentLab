// @vitest-environment node
import { expect, test } from 'vitest';
import { impact, planMotion, timeSentences } from './motion-planner.js';
import { motionPlanSchema, MOTION_SCENES } from '../core/contracts.js';
import { MOTION_KIT } from '../motion/kit-catalog.js';
import { mediaRefs } from '../render/motion-renderer.js';
import { missingStageArtifacts } from '../core/workflow.js';

const window = (id, text, start, length) => ({ scene: { id, label: id, text }, start, length });
const windows = [
  window('hook-1', 'Imagina um herói que nunca perde. Seria perfeito?', 0, 5),
  window('development-1', 'O Batman de 1940 já tinha medo. Em 1986, 90% dos leitores queriam um herói falho. O escudo pesa demais.', 5, 12),
  window('payoff-1', 'Uma fraqueza cria a história. Qual herói te ensinou isso?', 17, 6),
];

test('frases ganham tempo dentro da janela do trecho (sem palavras: proporcional)', () => {
  const timed = timeSentences(windows);
  expect(timed[0]).toMatchObject({ start: 0, role: 'hook' });
  expect(timed.at(-1).end).toBeCloseTo(23, 1);
  for (let i = 1; i < timed.length; i += 1) expect(timed[i].start).toBeGreaterThanOrEqual(timed[i - 1].start);
});

test('plano automático: gancho em palavras gigantes, número contando, imagem citada pelo nome, CTA e ritmo', () => {
  const plan = planMotion({ windows, media: [{ id: 'media_batman', name: 'batman-1940.jpg', kind: 'image' }, { id: 'media_escudo', name: 'escudo.png', kind: 'image' }], end: 24 });
  expect(motionPlanSchema.safeParse(plan).success).toBe(true);
  expect(plan.beats[0].scene).toBe('titulo');
  expect(plan.beats.at(-1).scene).toBe('cta');
  expect(plan.beats.some(beat => beat.scene === 'numero' && beat.props.valor === 90)).toBe(true);
  const batman = plan.beats.find(beat => JSON.stringify(beat.props).includes('media:media_batman'));
  expect(batman.at).toBeGreaterThanOrEqual(5);
  expect(Math.max(...plan.beats.slice(0, -1).map(beat => beat.duration))).toBeLessThanOrEqual(4.1);
  for (let i = 1; i < plan.beats.length; i += 1) expect(plan.beats[i].at).toBeCloseTo(plan.beats[i - 1].at + plan.beats[i - 1].duration, 1);
  for (let i = 2; i < plan.beats.length; i += 1) expect(new Set(plan.beats.slice(i - 2, i + 1).map(beat => beat.scene)).size).toBeGreaterThan(1);
  expect(mediaRefs(plan)).toEqual(expect.arrayContaining(['media_batman']));
});

test('contrato recusa beats sobrepostos, cena desconhecida e ids repetidos', () => {
  const beat = (id, at, duration, scene = 'titulo') => ({ id, scene, at, duration, props: { palavras: ['A'] } });
  expect(motionPlanSchema.safeParse({ schema: 'contentlab-motion-v1', beats: [beat('a', 0, 2), beat('b', 1, 2)] }).success).toBe(false);
  expect(motionPlanSchema.safeParse({ schema: 'contentlab-motion-v1', beats: [beat('a', 0, 2, 'inventada')] }).success).toBe(false);
  expect(motionPlanSchema.safeParse({ schema: 'contentlab-motion-v1', beats: [beat('a', 0, 2), beat('a', 2, 2)] }).success).toBe(false);
});

test('catálogo do kit cobre todas as cenas do contrato e o modo composição satisfaz as etapas de edição', () => {
  expect(Object.keys(MOTION_KIT.cenas).sort()).toEqual([...MOTION_SCENES].sort());
  const project = { media: [], creative: {}, timeline: { tracks: [] }, motion: { beats: [{ id: 'a' }], narration: false } };
  expect(missingStageArtifacts(project, 'edit')).toEqual([]);
  expect(missingStageArtifacts(project, 'narration')).toEqual([]);
  expect(missingStageArtifacts({ ...project, motion: null }, 'edit')).not.toEqual([]);
});

test('palavras de impacto priorizam nomes e números', () => {
  expect(impact('O Batman de 1940 já tinha medo')).toEqual(['BATMAN', '1940', 'MEDO']);
});

test('thumbnail do kit: still real 1280×720 com mídia da obra, texto e Nox', async () => {
  const { mkdtemp, rm, readFile } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const os = await import('node:os'); const path = await import('node:path');
  const { MotionRenderer } = await import('../render/motion-renderer.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'contentlab-thumb-test-'));
  try {
    const image = path.join(dir, 'obra.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=800x600', '-frames:v', '1', image]);
    const files = await new MotionRenderer(dir).thumbnails({ media: [{ id: 'obra', kind: 'image', uri: image }] }, { directory: path.join(dir, 'out'), variants: [{ label: 'A', texto: 'O HERÓI *CHATO*', midia: 'media:obra', humor: 'tedio' }] });
    const png = await readFile(files[0].file);
    expect(png.readUInt32BE(16)).toBe(1280); expect(png.readUInt32BE(20)).toBe(720);
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 180_000);

test('cenas 3D: painéis no espaço renderizam com WebGL (swangle) num still real', async () => {
  const { mkdtemp, rm, readFile } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const os = await import('node:os'); const path = await import('node:path');
  const { MotionRenderer } = await import('../render/motion-renderer.js');
  expect(MOTION_KIT.cenas.paineis3d && MOTION_KIT.cenas.aparte).toBeTruthy();
  expect(MOTION_SCENES).toEqual(expect.arrayContaining(Object.keys(MOTION_KIT.cenas)));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'contentlab-3d-test-'));
  try {
    const image = path.join(dir, 'obra.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=800x450', '-frames:v', '1', image]);
    const project = { aspectRatio: '16:9', media: [{ id: 'obra', kind: 'image', uri: image }], motionInputs: {}, motion: { schema: 'contentlab-motion-v1', narration: false, captions: false, music: null, beats: [{ id: 'p', scene: 'paineis3d', at: 0, duration: 2, props: { paineis: [{ midia: 'media:obra', rotulo: 'OBRA' }] }, sfx: [], flash: false }] } };
    const { files } = await new MotionRenderer(dir).stills(project, { seconds: [1.5], directory: dir, scale: 0.25 });
    const png = await readFile(files[0]);
    expect(png.readUInt32BE(16)).toBe(480);
    expect(png.length).toBeGreaterThan(20_000); // cena desenhada, não um quadro vazio
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 180_000);

test('plano automático: pergunta sobre a cena vira aparte do Nox com ícone, e o Nox de corpo inteiro é raro', () => {
  const w = (id, text, start, length) => ({ scene: { id, label: id, text }, start, length });
  const plan = planMotion({ windows: [
    w('hook-1', 'Esse herói nunca perdeu. E esse é o problema.', 0, 5),
    w('development-1', 'Olha esse escudo. Aguenta qualquer coisa. Pra que torcer se ele sempre vence? A muralha cai. O raio não ajuda. Ele pode morrer agora.', 5, 16),
    w('payoff-1', 'Fraqueza cria a história. Qual herói te ensinou isso?', 21, 6),
  ], media: [{ id: 'm_escudo', name: 'escudo.png', kind: 'image' }, { id: 'm_muralha', name: 'muralha.png', kind: 'image' }], end: 28 });
  expect(motionPlanSchema.safeParse(plan).success).toBe(true);
  const aparte = plan.beats.find(beat => beat.scene === 'aparte');
  expect(aparte.props.midia).toMatch(/^media:m_/);
  expect(MOTION_KIT.cenas.aparte.icones).toContain(aparte.props.falas[0].icone);
  expect(plan.beats.some(beat => beat.scene === 'aparte' && beat.props.falas.some(fala => fala.icone === 'caveira'))).toBe(true); // "pode morrer"
  expect(plan.beats.filter(beat => beat.scene === 'nox').length).toBeLessThanOrEqual(1);
});

test('plano automático: poses no aparte, fundos variados, cena sozinha, caixinhas e recorte citado', () => {
  const w = (id, text, start, length) => ({ scene: { id, label: id, text }, start, length });
  const plan = planMotion({ windows: [
    w('hook-1', 'O Superman nunca perdeu. E esse é o problema.', 0, 5),
    w('development-1', 'Olha esse escudo enorme. Aguenta tudo. Pra mim, isso mata a história. A muralha cai. O escudo racha. A moeda da sorte não salva ninguém. Ele pode perder tudo agora. O escudo some. A muralha volta.', 5, 26),
    w('payoff-1', 'Fraqueza cria a história. Qual herói te ensinou isso?', 31, 6),
  ], media: [{ id: 'm_escudo', name: 'escudo.png', kind: 'image' }, { id: 'm_muralha', name: 'muralha.png', kind: 'image' }, { id: 'm_moeda', name: 'recorte-moeda.png', kind: 'image' }], end: 38 });
  expect(motionPlanSchema.safeParse(plan).success).toBe(true);
  const aparte = plan.beats.find(beat => beat.scene === 'aparte');
  expect(MOTION_KIT.poses.lista).toContain(aparte.props.falas[0].pose);
  expect(plan.beats.some(beat => beat.scene === 'evidencia' && beat.props.cheia)).toBe(true);
  expect(plan.beats.some(beat => JSON.stringify(beat.props).includes('m_moeda'))).toBe(false); // recorte não vira cena
  const extras = plan.beats.flatMap(beat => beat.extras || []);
  expect(extras.some(extra => extra.tipo === 'recorte' && extra.midia === 'media:m_moeda')).toBe(true);
  expect(extras.filter(extra => extra.tipo === 'caixinha').map(extra => extra.preset)).toEqual(expect.arrayContaining(['inscricao', 'like', 'opiniao']));
  const bgs = plan.beats.map(beat => `${beat.props.fundo || ''}${beat.props.tom || ''}`);
  for (let i = 1; i < bgs.length; i += 1) if (bgs[i]) expect(bgs[i]).not.toBe(bgs[i - 1]);
  expect(mediaRefs(plan)).toContain('m_moeda');
});

test('poses do Nox: poses.json liga a pose ao PNG sem olhos e às posições dos olhos; PNG solto vale no formato antigo', async () => {
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const os = await import('node:os'); const path = await import('node:path');
  const { loadNoxPoses } = await import('../render/motion-renderer.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'contentlab-poses-test-'));
  try {
    for (const name of ['pensando.png', 'pensando-b.png', 'antiga.png']) execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black@0:s=400x640', '-frames:v', '1', path.join(dir, name)]);
    await writeFile(path.join(dir, 'poses.json'), JSON.stringify({ versao: 1, poses: {
      pensando: { arquivo: 'pensando.png', olhos: { esquerdo: [176, 199], direito: [280, 189], largura: 80 }, cobre: 'direito' },
      'pensando-b': { arquivo: 'pensando-b.png', pose: 'pensando', olhos: null },
      '../fora': { arquivo: 'pensando.png' }, sumida: { arquivo: 'nao-existe.png' },
    } }));
    const { poses, files } = await loadNoxPoses(dir, 'public:brand/poses/');
    expect(poses.pensando).toMatchObject({ src: 'public:brand/poses/pensando.png', w: 400, h: 640, pose: 'pensando', cobre: 'direito', olhos: { esquerdo: [176, 199], largura: 80 } });
    expect(poses['pensando-b']).toMatchObject({ pose: 'pensando', olhos: null });
    expect(poses.antiga).toBe('public:brand/poses/antiga.png');
    expect(Object.keys(poses).sort()).toEqual(['antiga', 'pensando', 'pensando-b']);
    expect(files.sort()).toEqual(['antiga.png', 'pensando-b.png', 'pensando.png']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
