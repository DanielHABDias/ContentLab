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
