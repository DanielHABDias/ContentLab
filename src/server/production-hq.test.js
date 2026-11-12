import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { impactWords, MAX_BEAT_SECONDS, planBeats, planScenes, SHORTS_SAFE_AREA } from './production-operations.js';
import { compileRenderPlan } from '../render/render-plan.js';
import { buildFfmpegArgs } from '../render/ffmpeg-graph.js';
import { BUNDLED_COMPONENTS } from '../timeline/components/catalog.js';
import { ComponentRegistry, allowedComponentImports } from '../timeline/component-registry.js';
import os from 'node:os';
import { mkdtemp } from 'node:fs/promises';

const window = (id, text, start, length) => ({ scene: { id, label: id, text }, start, length });

test('plano Diazverso: um beat por frase com imagem do assunto e sem repetir componente', () => {
  const windows = [
    window('hook-1', 'Em 1996 a Marvel estava falida. O que aconteceu?', 0, 6),
    window('development-1', 'Em 1939 nasce a Timely. Em 1962 surge o Homem-Aranha. Stan Lee e Steve Ditko mudam tudo.', 6, 12),
    window('payoff-1', 'Perfeição não cria vínculo. Qual personagem te ensinou isso?', 18, 6),
  ];
  const beats = planBeats(windows, { vertical: false });
  expect(beats.every(beat => beat.length <= MAX_BEAT_SECONDS.horizontal + 0.01 || !beat.text.includes('. '))).toBe(true);
  expect(beats.at(-1).start + beats.at(-1).length).toBeCloseTo(24, 5);
  const plan = planScenes(windows, { title: 'A escolha', images: ['img1', 'img2', 'img3'] });
  expect(plan.length).toBe(beats.length);
  expect(plan[0]).toMatchObject({ componentId: 'dv_imagem_frases_hq', props: { assets: { image: 'media:img1', anton: 'brand:anton' } } });
  expect(plan.map(item => item.componentId)).toContain('dv_pagina_hq_cenas');
  for (const item of plan) expect(JSON.stringify(item.props)).toMatch(/media:img\d/);
  for (let index = 2; index < plan.length; index += 1) expect(new Set(plan.slice(index - 2, index + 1).map(item => item.componentId)).size).toBeGreaterThan(1);
  const nox = planScenes(windows, { images: [] });
  expect(nox.every(item => JSON.stringify(item.props).includes('brand:nox'))).toBe(true);
});

test('palavras de impacto: nomes, números e palavras fortes, sem artigos', () => {
  expect(impactWords('Em 1996 a Marvel estava falida.')).toEqual(['1996', 'MARVEL', 'FALIDA']);
  expect(impactWords('E o que aconteceu?', 3).length).toBeGreaterThan(0);
});

test('cenas embutidas: arquivo único, só React/Remotion, registráveis com props de várias linhas', async () => {
  const registry = new ComponentRegistry(await mkdtemp(path.join(os.tmpdir(), 'cl-components-')));
  for (const item of BUNDLED_COMPONENTS) {
    const source = await readFile(path.join(import.meta.dirname, '../timeline/components', item.file), 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) expect(allowedComponentImports.has(match[1])).toBe(true);
    const manifest = await registry.register({ id: item.id, label: item.label, exportName: item.exportName, propsSchema: item.propsSchema, source });
    expect(manifest.exportName).toBe(item.exportName);
    expect(item.use).toBeTruthy();
  }
  expect((await registry.list()).length).toBe(BUNDLED_COMPONENTS.length);
  await expect(registry.register({ id: 'ruim_tipo', source: 'export const A = () => null;', propsSchema: { a: { type: 'object' } } })).rejects.toThrow(/não permitido/);
});

const timeline = (tracks, aspectRatio = '16:9') => ({ schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio, safeArea: { top: 0.05, right: 0.05, bottom: 0.08, left: 0.05 }, tracks });
const clip = (id, extra) => ({ id, startFrame: 0, durationInFrames: 90, fit: 'cover', anchor: 'center', keyframes: {}, effects: [], sourceInFrame: 0, volume: 1, style: 'legenda', ...extra });

test('legendas ficam por cima das cenas mesmo quando a trilha de cenas é adicionada depois', () => {
  const plan = compileRenderPlan(timeline([
    { id: 'visual_main', kind: 'visual', name: 'V', muted: false, locked: false, clips: [] },
    { id: 'captions_main', kind: 'caption', name: 'L', muted: false, locked: false, clips: [clip('cap', { type: 'caption', text: 'Oi' })] },
    { id: 'visual_scenes', kind: 'visual', name: 'Cenas', muted: false, locked: false, clips: [clip('scene', { type: 'component', componentId: 'dv_texto_hq' })] },
  ]));
  expect(plan.layers.map(layer => layer.id)).toEqual(['scene', 'cap']);
});

test('trilha com duck abaixa sob a voz via sidechain; sem voz, mistura simples', async () => {
  const media = [{ id: 'voz', kind: 'audio', uri: '/tmp/voz.wav', sha256: 'a' }, { id: 'trilha', kind: 'audio', uri: '/tmp/trilha.wav', sha256: 'b' }];
  const tracks = [
    { id: 'audio_main', kind: 'audio', name: 'A', muted: false, locked: false, clips: [clip('v', { type: 'media', sourceId: 'voz' })] },
    { id: 'audio_bed', kind: 'audio', name: 'T', muted: false, locked: false, clips: [clip('m', { type: 'media', sourceId: 'trilha', volume: 0.35, effects: [{ id: 'fx1', type: 'duck', enabled: true, params: { level: 0.3 } }] })] },
  ];
  const plan = compileRenderPlan(timeline(tracks), media);
  expect(plan.layers.find(layer => layer.id === 'm')).toMatchObject({ duck: true, duckLevel: 0.3 });
  const args = await buildFfmpegArgs(plan, { output: '/tmp/x.mp4', fontFile: null, textDirectory: '/tmp' });
  const graph = args[args.indexOf('-filter_complex') + 1];
  expect(graph).toMatch(/\[bed\]\[key\]sidechaincompress=/);
  expect(graph).toMatch(/\[voice\]\[ducked\]amix=inputs=2/);
  const alone = await buildFfmpegArgs(compileRenderPlan(timeline([tracks[1]]), media), { output: '/tmp/x.mp4', fontFile: null, textDirectory: '/tmp' });
  expect(alone[alone.indexOf('-filter_complex') + 1]).not.toMatch(/sidechaincompress/);
});

test('área segura de Shorts põe a legenda acima de 78% da altura', () => {
  expect(1920 * (1 - SHORTS_SAFE_AREA.bottom)).toBeCloseTo(1490, -1);
  expect(SHORTS_SAFE_AREA.left * 1080).toBeCloseTo(96, -1);
});

test('imagem citada no texto do beat (pelo nome do arquivo) entra naquele beat', () => {
  const plan = planScenes([window('d', 'Foi aí que veio a lâmpada.', 0, 3)], { images: [{ id: 'a', name: 'escudo.png' }, { id: 'b', name: 'lampada.png' }] });
  expect(plan[0].props.assets.image).toBe('media:b');
});
