import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { FfmpegRenderer } from './ffmpeg-renderer.js';
import { compileRenderPlan } from './render-plan.js';
import { opacityExpression, wrap } from './ffmpeg-graph.js';

const roots = []; afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const ffmpeg = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args, '-y']);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-comp-')); roots.push(root);
  const red = path.join(root, 'vermelho.mp4'); const blue = path.join(root, 'azul.mp4'); const logo = path.join(root, 'logo.png'); const voice = path.join(root, 'voz.wav');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=red:s=640x360:r=30:d=3', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', red]);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=30:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', blue]);
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=lime:s=200x200', '-frames:v', '1', logo]);
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=500:duration=4', '-ar', '48000', '-ac', '1', voice]);
  const media = [
    { id: 'media_red', kind: 'video', uri: red, sha256: 'a', metadata: { durationSeconds: 3, audioCodec: 'aac' } },
    { id: 'media_blue', kind: 'video', uri: blue, sha256: 'b', metadata: { durationSeconds: 3, audioCodec: null } },
    { id: 'media_logo', kind: 'image', uri: logo, sha256: 'c', metadata: {} },
    { id: 'media_voice', kind: 'audio', uri: voice, sha256: 'd', metadata: { durationSeconds: 4 } },
  ];
  const clip = (id, extra) => ({ id, type: 'media', fit: 'cover', anchor: 'center', keyframes: {}, effects: [], sourceInFrame: 0, volume: 1, style: 'legenda', ...extra });
  const timeline = { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 120, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .08, left: .05 }, tracks: [
    { id: 'visual_main', kind: 'visual', name: 'Principal', muted: false, locked: false, clips: [clip('clip_red', { sourceId: 'media_red', startFrame: 0, durationInFrames: 60, sourceInFrame: 15 }), clip('clip_blue', { sourceId: 'media_blue', startFrame: 60, durationInFrames: 60 })] },
    { id: 'visual_over', kind: 'visual', name: 'Sobreposição', muted: false, locked: false, clips: [clip('clip_logo', { sourceId: 'media_logo', startFrame: 30, durationInFrames: 60, fit: 'contain', anchor: 'right', layout: { '16:9': { x: .95, y: .1, width: .2, height: .2 } }, effects: [{ id: 'fx_in', type: 'fade-in', enabled: true, params: { seconds: .2 } }] })] },
    { id: 'audio_main', kind: 'audio', name: 'Áudio', muted: false, locked: false, clips: [clip('clip_voice', { sourceId: 'media_voice', startFrame: 0, durationInFrames: 120, volume: .8 })] },
    { id: 'captions_main', kind: 'caption', name: 'Legendas', muted: false, locked: false, clips: [{ id: 'cap_one', type: 'caption', startFrame: 0, durationInFrames: 45, text: 'Legenda de teste com acentuação: ação, você.', style: 'legenda', fit: 'cover', anchor: 'center', keyframes: {}, effects: [], sourceInFrame: 0, volume: 1 }] },
  ] };
  return { root, project: { id: 'comp', revision: 1, media, timeline }, renderer: new FfmpegRenderer(path.join(root, 'render')) };
}

function pixel(file, x, y) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `crop=1:1:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  return [...raw.subarray(0, 3)];
}

test('render final compõe clips em sequência, sobreposição, áudio e legenda e passa no FFprobe', async () => {
  const { root, project, renderer } = await fixture();
  const result = await renderer.render(project, { output: path.join(root, 'final.mp4') });
  expect(result.status).toBe('completed');
  const duration = Number(result.inspection.format.duration);
  expect(duration).toBeCloseTo(4, 0);
  expect(result.inspection.streams.find(stream => stream.codec_type === 'video')).toMatchObject({ width: 1920, height: 1080 });
  const at = seconds => { const file = path.join(root, `f${seconds}.png`); ffmpeg(['-ss', String(seconds), '-i', result.output, '-frames:v', '1', file]); return file; };
  expect(pixel(at(0.5), 960, 300)[0]).toBeGreaterThan(200);
  expect(pixel(at(3), 960, 300)[2]).toBeGreaterThan(200);
  expect(pixel(at(1.5), 1650, 200)[1]).toBeGreaterThan(200);
  expect(pixel(at(0.5), 1650, 200)[0]).toBeGreaterThan(200);
}, 60_000);

test('frame de preview usa o mesmo grafo e mostra a mesma camada do render', async () => {
  const { root, project, renderer } = await fixture();
  const red = await renderer.renderFrame(project, { frame: 15, output: path.join(root, 'p1.png'), scale: 0.5 });
  const blue = await renderer.renderFrame(project, { frame: 75, output: path.join(root, 'p2.png'), scale: 0.5 });
  expect(pixel(red.output, 480, 150)[0]).toBeGreaterThan(200);
  expect(pixel(blue.output, 480, 150)[2]).toBeGreaterThan(200);
  expect(pixel(blue.output, 825, 100)[1]).toBeGreaterThan(200);
  const vertical = await renderer.renderFrame(project, { frame: 15, output: path.join(root, 'p3.png'), aspectRatio: '9:16', scale: 0.25 });
  const size = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', vertical.output]).toString().trim();
  expect(size).toBe('270,480');
  expect(project.timeline.aspectRatio).toBe('16:9');
}, 60_000);

test('trecho de preview sai com áudio e vídeo sincronizados na resolução reduzida', async () => {
  const { root, project, renderer } = await fixture();
  const preview = await renderer.renderPreview(project, { from: 1, seconds: 2, output: path.join(root, 'trecho.mp4'), scale: 0.5 });
  const data = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,duration', '-of', 'json', preview.output]).toString());
  expect(Number(data.format.duration)).toBeCloseTo(2, 0);
  expect(data.streams.find(stream => stream.codec_type === 'video')).toMatchObject({ width: 960, height: 540 });
  const audio = data.streams.find(stream => stream.codec_type === 'audio'); const video = data.streams.find(stream => stream.codec_type === 'video');
  expect(Math.abs(Number(audio.duration) - Number(video.duration))).toBeLessThan(0.1);
}, 60_000);

test('mídia ausente vira erro claro antes do FFmpeg', async () => {
  const { root, project, renderer } = await fixture();
  project.media[1].uri = path.join(root, 'sumiu.mp4');
  await expect(renderer.render(project, { output: path.join(root, 'x.mp4') })).rejects.toMatchObject({ code: 'MEDIA_MISSING', details: { clips: ['clip_blue'] } });
});

test('projeto longo compila rápido e só a janela pedida entra no grafo', async () => {
  const { project } = await fixture();
  const clips = Array.from({ length: 2000 }, (_, index) => ({ id: `cap_${index}`, type: 'caption', startFrame: index * 90, durationInFrames: 80, text: `Fala ${index}`, style: 'legenda', fit: 'cover', anchor: 'center', keyframes: {}, effects: [], sourceInFrame: 0, volume: 1 }));
  project.timeline.tracks[3].clips = clips; project.timeline.durationInFrames = 2000 * 90;
  const started = performance.now();
  const plan = compileRenderPlan(project.timeline, project.media);
  expect(performance.now() - started).toBeLessThan(500);
  expect(plan.duration).toBe(6000);
  expect(opacityExpression([{ time: 0, value: 0 }, { time: 1, value: 1 }], 0)).toMatch(/^if\(lt\(T,0\.0000\),0/);
  expect(wrap('uma frase longa que precisa quebrar em linhas', 12).split('\n').length).toBeGreaterThan(2);
});
