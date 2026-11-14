#!/usr/bin/env node
/** Prévias isoladas dos componentes narrativos; nunca abre ou modifica projetos do usuário. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTION_KIT } from '../src/motion/kit-catalog.js';
import { narrativeEvents } from '../src/motion/kit/narrative/events.js';
import { MotionRenderer } from '../src/render/motion-renderer.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv.find(s => s.startsWith('--output='))?.slice(9) || path.join(root, 'output/narrative-preview'));
const selected = process.argv.find(s=>s.startsWith('--scenes='))?.slice(9).split(',');
const entries = Object.entries(MOTION_KIT.cenas).filter(([id,c]) => c.som?.eventos && (!selected || selected.includes(id)));
if(selected?.some(id=>!entries.some(([key])=>key===id))) throw new Error('Cena narrativa desconhecida em --scenes.');
const duration = Number(process.argv.find(s=>s.startsWith('--seconds='))?.slice(10) || 4);
const orientations = process.argv.includes('--horizontal') ? ['16:9'] : ['16:9','9:16'];
const withMedia = (value, i = 0) => Array.isArray(value) ? value.map((v, k) => withMedia(v, k)) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'midia' ? `media:demo${i % 3}` : withMedia(v, i)]).concat('titulo' in value && !('midia' in value) && !('pistas' in value) && !('origem' in value) && !('planos' in value) ? [['midia', `media:demo${i % 3}`]] : [])) : value;
const beats = entries.map(([scene, c], i) => ({ id: `demo${i}`, scene, at: i * duration, duration, props: withMedia(c.exemplo), legenda: false, flash: false, sfx: narrativeEvents(scene,c.exemplo,duration) }));
const media = ['escudo', 'lampada', 'balanca'].map((name, i) => ({ id: `demo${i}`, kind: 'image', uri: path.join(root, `assets/kit/graphics/${name}.svg`), metadata: { width: 1000, height: 1000 } }));
const renderer = new MotionRenderer(root);
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'beats.json'), JSON.stringify({ schema: 'contentlab-motion-v1', beats, narration: false, captions: false }, null, 2));
for (const aspectRatio of orientations) {
 const project = { aspectRatio, media, timeline: { fps: 30 }, motion: { schema: 'contentlab-motion-v1', beats, narration: false, captions: false } };
 const dir = path.join(out, aspectRatio.replace(':', 'x'));
 const seconds = beats.flatMap(b => [.04,.12,.24,.38,.52,.66,.8,.92].map(t => b.at + duration * t));
 await renderer.stills(project, { seconds, directory: dir, scale: .4 });
 console.log(`${aspectRatio}: ${seconds.length} frames em ${dir}`);
 if (process.argv.includes('--video')) await renderer.render(project, { output: path.join(out, `preview-${aspectRatio.replace(':', 'x')}.mp4`), scale: .5 });
}
