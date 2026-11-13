// @vitest-environment node
import { expect, test } from 'vitest';
import { impact, planMotion, timeSentences } from './motion-planner.js';
import { motionPlanSchema, MOTION_SCENES } from '../core/contracts.js';
import { MOTION_KIT } from '../motion/kit-catalog.js';
import { mediaRefs } from '../render/motion-renderer.js';
import { missingStageArtifacts } from '../core/workflow.js';
import { TEST_POSES } from '../test/character-fixture.js';

/** Catálogo do personagem de teste (pose → { tons }), como fica em project.character.poses. */
const POSES = Object.fromEntries(Object.entries(TEST_POSES).map(([name, pose]) => [name, { arquivos: [`${name}.png`], gesto: pose.gesto, tons: pose.tons }]));

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

test('thumbnail do kit: still real 1280×720 com mídia da obra, texto e o personagem do projeto', async () => {
  const { mkdtemp, rm, readFile } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const os = await import('node:os'); const path = await import('node:path');
  const { MotionRenderer } = await import('../render/motion-renderer.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'contentlab-thumb-test-'));
  try {
    const image = path.join(dir, 'obra.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=800x600', '-frames:v', '1', image]);
    const { makeCharacterPack } = await import('../test/character-fixture.js');
    const pack = await makeCharacterPack(path.join(dir, 'boneco'));
    const character = { schema: 'contentlab-character-v1', name: 'Boneco', tons: {}, poses: POSES, files: Object.fromEntries(Object.keys(POSES).map(name => [`${name}.png`, `pose_${name}`])), importedAt: '2026-01-01' };
    const media = [{ id: 'obra', kind: 'image', uri: image }, ...Object.keys(POSES).map(name => ({ id: `pose_${name}`, kind: 'image', role: 'character', uri: path.join(pack, `${name}.png`) }))];
    const files = await new MotionRenderer(dir).thumbnails({ media, character }, { directory: path.join(dir, 'out'), variants: [{ label: 'A', texto: 'O HERÓI *CHATO*', midia: 'media:obra', humor: 'tedio' }] });
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

test('plano automático: pergunta sobre a cena vira aparte do personagem com ícone, e o personagem de corpo inteiro é raro', () => {
  const w = (id, text, start, length) => ({ scene: { id, label: id, text }, start, length });
  const plan = planMotion({ windows: [
    w('hook-1', 'Esse herói nunca perdeu. E esse é o problema.', 0, 5),
    w('development-1', 'Olha esse escudo. Aguenta qualquer coisa. Pra que torcer se ele sempre vence? A muralha cai. O raio não ajuda. Ele pode morrer agora.', 5, 16),
    w('payoff-1', 'Fraqueza cria a história. Qual herói te ensinou isso?', 21, 6),
  ], media: [{ id: 'm_escudo', name: 'escudo.png', kind: 'image' }, { id: 'm_muralha', name: 'muralha.png', kind: 'image' }], end: 28, poses: POSES });
  expect(motionPlanSchema.safeParse(plan).success).toBe(true);
  const aparte = plan.beats.find(beat => beat.scene === 'aparte');
  expect(aparte.props.midia).toMatch(/^media:m_/);
  expect(MOTION_KIT.cenas.aparte.icones).toContain(aparte.props.falas[0].icone);
  expect(plan.beats.some(beat => beat.scene === 'aparte' && beat.props.falas.some(fala => fala.icone === 'caveira'))).toBe(true); // "pode morrer"
  expect(plan.beats.filter(beat => beat.scene === 'personagem').length).toBeLessThanOrEqual(1);
});

test('plano automático: poses no aparte, fundos variados, cena sozinha, caixinhas e recorte citado', () => {
  const w = (id, text, start, length) => ({ scene: { id, label: id, text }, start, length });
  const plan = planMotion({ windows: [
    w('hook-1', 'O Superman nunca perdeu. E esse é o problema.', 0, 5),
    w('development-1', 'Olha esse escudo enorme. Aguenta tudo. Pra mim, isso mata a história. A muralha cai. O escudo racha. A moeda da sorte não salva ninguém. Ele pode perder tudo agora. O escudo some. A muralha volta.', 5, 26),
    w('payoff-1', 'Fraqueza cria a história. Qual herói te ensinou isso?', 31, 6),
  ], media: [{ id: 'm_escudo', name: 'escudo.png', kind: 'image' }, { id: 'm_muralha', name: 'muralha.png', kind: 'image' }, { id: 'm_moeda', name: 'recorte-moeda.png', kind: 'image' }], end: 38, poses: POSES });
  expect(motionPlanSchema.safeParse(plan).success).toBe(true);
  const aparte = plan.beats.find(beat => beat.scene === 'aparte');
  expect(Object.keys(POSES)).toContain(aparte.props.falas[0].pose);
  expect(plan.beats.some(beat => beat.scene === 'evidencia' && beat.props.cheia)).toBe(true);
  expect(plan.beats.some(beat => JSON.stringify(beat.props).includes('m_moeda'))).toBe(false); // recorte não vira cena
  const extras = plan.beats.flatMap(beat => beat.extras || []);
  expect(extras.some(extra => extra.tipo === 'recorte' && extra.midia === 'media:m_moeda')).toBe(true);
  expect(extras.filter(extra => extra.tipo === 'caixinha').map(extra => extra.preset)).toEqual(expect.arrayContaining(['inscricao', 'like', 'opiniao']));
  const bgs = plan.beats.map(beat => `${beat.props.fundo || ''}${beat.props.tom || ''}`);
  for (let i = 1; i < bgs.length; i += 1) if (bgs[i]) expect(bgs[i]).not.toBe(bgs[i - 1]);
  expect(mediaRefs(plan)).toContain('m_moeda');
});

test('plano automático: o personagem troca de pose enquanto fala, passa por todas as poses do catálogo e a legenda segue o formato', () => {
  const poses = POSES;
  const w = (id, text, start, length) => ({ scene: { id, label: id, text }, start, length });
  const lines = ['Pra mim, esse é o melhor vilão.', 'Ele perdeu tudo e ninguém ligou?', 'Sério, que absurdo!', 'Mas calma, tem um detalhe.', 'Pouca gente sabe desse bastidor.', 'E aí que está a lição.', 'Ele venceu no fim, campeão.', 'Isso foi um erro enorme.', 'Funciona perfeito, genial.', 'Eu não concordo, é forçado.', 'Ele morreu e foi triste.', 'Olha esse detalhe aqui.'];
  const windows = [w('hook-1', 'O vilão mais odiado tinha razão.', 0, 4), ...Array.from({ length: 36 }, (_, i) => w(`development-${i}`, lines[i % lines.length], 4 + i * 3, 3)), w('payoff-1', 'Qual vilão te convenceu?', 112, 4)];
  const media = [{ id: 'm_a', name: 'cena-a.png', kind: 'image' }, { id: 'm_b', name: 'cena-b.png', kind: 'image' }];
  const report = {};
  const plan = planMotion({ windows, media, end: 117, poses, report });
  expect(motionPlanSchema.safeParse(plan).success).toBe(true);
  const apartes = plan.beats.filter(beat => beat.scene === 'aparte');
  expect(apartes.some(beat => beat.props.falas.length >= 3)).toBe(true); // várias poses dentro da mesma fala
  for (const beat of apartes) for (let i = 1; i < beat.props.falas.length; i += 1) expect(beat.props.falas[i].pose).not.toBe(beat.props.falas[i - 1].pose);
  const shown = new Set(plan.beats.flatMap(beat => [...(beat.props.falas || []), ...(beat.props.poses || [])].map(item => item.pose)));
  expect(report.posesFaltando).toEqual([]);
  for (const name of Object.keys(poses)) expect(shown.has(name)).toBe(true);
  // 16:9: legenda só no gancho e nos apartes; 9:16: o tempo todo (fora das cenas que já são o texto).
  for (const beat of plan.beats) if (beat.at >= 6 && beat.scene !== 'aparte') expect(beat.legenda).toBe(false);
  expect(apartes.every(beat => beat.legenda !== false)).toBe(true);
  const short = planMotion({ windows: windows.slice(0, 12), media, end: 40, poses, vertical: true });
  expect(short.beats.filter(beat => beat.scene === 'evidencia').every(beat => beat.legenda !== false)).toBe(true);
});

test('poses do personagem: cada PNG do pacote vai para a pasta pública com tamanho, pose e tons; sem personagem, nada', async () => {
  const { mkdtemp, rm, stat } = await import('node:fs/promises');
  const os = await import('node:os'); const path = await import('node:path');
  const { stageCharacter } = await import('../render/motion-renderer.js');
  const { makeCharacterPack } = await import('../test/character-fixture.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'contentlab-poses-test-'));
  try {
    const pack = await makeCharacterPack(path.join(dir, 'pack'));
    const poses = { ...POSES, apontando: { ...POSES.apontando, arquivos: ['apontando.png', 'apontando-b.png'] } };
    const files = { 'parado.png': 'p1', 'pensando.png': 'p2', 'apontando.png': 'p3', 'apontando-b.png': 'p4' };
    const media = Object.entries(files).map(([file, id]) => ({ id, kind: 'image', role: 'character', uri: path.join(pack, file) }));
    const result = await stageCharacter({ media, character: { poses, files } }, path.join(dir, 'public'));
    expect(result.poses.parado).toEqual({ src: 'public:personagem/parado.png', w: 460, h: 640, pose: 'parado' });
    expect(result.poses['apontando-b']).toMatchObject({ pose: 'apontando' }); // variante da mesma pose
    expect(result.tons.apontando).toEqual(TEST_POSES.apontando.tons);
    expect((await stat(path.join(dir, 'public/personagem/apontando-b.png'))).isFile()).toBe(true);
    expect(await stageCharacter({ media: [], character: null }, path.join(dir, 'vazio'))).toEqual({ poses: {}, tons: {} });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('plano automático sem personagem: sem aparte, sem a cena personagem e sem humor', () => {
  const w = (id, text, start, length) => ({ scene: { id, label: id, text }, start, length });
  const report = {};
  const plan = planMotion({ windows: [
    w('hook-1', 'O Superman nunca perdeu. E esse é o problema.', 0, 5),
    w('development-1', 'Pra mim, isso mata a história. Sério, que absurdo! Ele perdeu tudo e ninguém ligou? Olha esse escudo. Haha, que piada.', 5, 20),
    w('payoff-1', 'Qual herói te ensinou isso?', 25, 5),
  ], media: [{ id: 'm_escudo', name: 'escudo.png', kind: 'image' }, { id: 'm_muralha', name: 'muralha.png', kind: 'image' }], end: 31, report });
  expect(motionPlanSchema.safeParse(plan).success).toBe(true);
  expect(plan.beats.some(beat => ['aparte', 'personagem'].includes(beat.scene))).toBe(false);
  expect(plan.beats.some(beat => beat.props.humor)).toBe(false);
  expect(report.posesFaltando).toEqual([]);
  expect(plan.beats.at(-1).props.titulo).toBeUndefined(); // CTA sem nome de canal fixo
});

// Migração de projetos antigos (a cena do personagem se chamava nox).
test('migração: plano antigo com a cena nox vira personagem na leitura', () => {
  const parsed = motionPlanSchema.parse({ schema: 'contentlab-motion-v1', beats: [{ id: 'a', scene: 'nox', at: 0, duration: 2, props: { humor: 'feliz' } }] });
  expect(parsed.beats[0].scene).toBe('personagem');
  expect(MOTION_SCENES).not.toContain('nox');
});
