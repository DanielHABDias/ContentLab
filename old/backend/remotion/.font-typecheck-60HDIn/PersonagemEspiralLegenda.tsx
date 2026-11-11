import React from 'react';
import {AbsoluteFill, Img, delayRender, continueRender, cancelRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';
import type {Caption} from '@remotion/captions';

type Word = {word?: string; text?: string; start: number; end: number};
type Props = {fontFamily?: HQFont; 
  assets?: {character?: string; bangers?: string; anton?: string};
  backgroundVariant?: 'espiral' | 'crescente';
  captions?: Caption[]; words?: Word[]; transcriptOffset?: number;
  entryDuration?: number; entryDelay?: number; characterScale?: number;
  headAnchor?: {x: number; y: number}; sway?: number; maxWords?: number;
  captionColor?: string; highlightColors?: string[];
};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
const clamp = (v: number) => Math.max(0, Math.min(1, v));

// Procedural spiral: no background video, texture file or companion module needed.
function Spiral({variant, time, width, height}: {variant: 'espiral' | 'crescente'; time: number; width: number; height: number}) {
  const canvas = React.useRef<HTMLCanvasElement>(null);
  // Draw at low resolution, then enlarge with nearest-neighbor sampling.
  // The stepped edges belong to the spiral itself, not just a texture overlay.
  const pixel = Math.max(2, Math.min(width, height) / 180);
  const columns = Math.ceil(width / pixel);
  const rows = Math.ceil(height / pixel);
  React.useLayoutEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível para a espiral pixelada.');
    const pixels = ctx.createImageData(columns, rows);
    const radius = Math.hypot(width, height) / 2;
    const rotation = time * (variant === 'crescente' ? -.09 : .075);
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const dx = (x + .5) / columns * width - width / 2;
      const dy = (y + .5) / rows * height - height / 2;
      const distance = Math.hypot(dx, dy) / radius;
      // Broad, gentle curves: rotate the shape without folding the bands.
      const bend = (variant === 'crescente' ? .55 : .42) * Math.pow(distance, .85)
        + .02 * Math.sin(distance * 5) * distance;
      const dark = Math.sin((Math.atan2(dy, dx) - bend - rotation) * 10) > 0;
      const grain = ((x * 137 + y * 53 + x * y * 7) % 19) - 9;
      const value = Math.max(0, Math.min(255, (dark ? (variant === 'crescente' ? 52 : 8) : 226) + grain));
      const i = (y * columns + x) * 4;
      pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }, [columns, rows, width, height, variant, time]);
  return <>
    <canvas ref={canvas} width={columns} height={rows} style={{position: 'absolute', width: '100%', height: '100%', imageRendering: 'pixelated'}} />
    <AbsoluteFill style={{opacity: .32, backgroundImage: 'radial-gradient(#000 0.75px, transparent 1.15px)', backgroundSize: '3px 3px'}} />
    <AbsoluteFill style={{backgroundImage: 'radial-gradient(ellipse at center, transparent 14%, #0002 48%, #000B 100%)'}} />
  </>;
}

export default function PersonagemEspiralLegenda({fontFamily="Bangers", assets = {}, backgroundVariant = 'espiral', captions, words,
  transcriptOffset = 0, entryDuration = .6, entryDelay = 0, characterScale = 1,
  headAnchor = {x: .5, y: .3}, sway = .65, maxWords = 5,
  captionColor = '#FFFFFF', highlightColors = ['#175AE8', '#F22932', '#111111']}: Props) {
  const fontUrl=resolveHQFont(fontFamily,assets);
  const {width: w, height: h, fps, durationInFrames} = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const duration = durationInFrames / fps;
  if (!assets.character || !fontUrl) throw new Error('Informe assets.character (PNG transparente) e fontUrl.');
  if (!['espiral', 'crescente'].includes(backgroundVariant)) throw new Error('backgroundVariant deve ser espiral ou crescente.');
  if (![entryDuration, characterScale].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(entryDelay) || entryDelay < 0 || entryDelay + entryDuration > duration) throw new Error('Entrada e escala inválidas ou entrada maior que a cena.');
  if (![headAnchor.x, headAnchor.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1) || !Number.isFinite(sway) || sway < 0) throw new Error('headAnchor usa coordenadas de 0 a 1; sway deve ser >= 0.');
  if (!Number.isInteger(maxWords) || maxWords < 1 || maxWords > 8) throw new Error('maxWords deve ser de 1 a 8.');
  if (!Number.isFinite(transcriptOffset) || transcriptOffset < 0) throw new Error('transcriptOffset deve ser >= 0.');
  if (!highlightColors.length || ![captionColor, ...highlightColors].every(c => /^#[a-f\d]{6}$/i.test(c))) throw new Error('Informe cores #RRGGBB e ao menos uma cor de destaque.');
  if (captions !== undefined && words !== undefined) throw new Error('Use captions OU words, não os dois.');
  const cues: Caption[] = captions ?? (words ?? []).filter(word => word.end > transcriptOffset && word.start < transcriptOffset + duration).map(word => ({
    text: word.word ?? word.text ?? '', startMs: Math.max(0, word.start - transcriptOffset) * 1000,
    endMs: Math.min(duration, word.end - transcriptOffset) * 1000, timestampMs: null, confidence: null,
  }));
  cues.forEach((cue, i) => {
    if (!cue.text?.trim() || !Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs) || cue.startMs < 0 || cue.endMs <= cue.startMs || cue.endMs > duration * 1000 + 1 || (i > 0 && cue.startMs < cues[i - 1].endMs)) throw new Error('Legendas requerem palavras ordenadas, sem sobreposição e dentro da cena.');
  });
  const [bounds, setBounds] = React.useState<Bounds | null>(null);
  const [handle] = React.useState(() => delayRender('Preparando personagem e legenda'));
  React.useEffect(() => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    const ready = new Promise<Bounds>((resolve, reject) => {
      image.onload = () => {try {
        const canvas = document.createElement('canvas');canvas.width = image.naturalWidth;canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');if (!ctx) throw new Error('Canvas indisponível.');
        ctx.drawImage(image, 0, 0);const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (rgba[(y * canvas.width + x) * 4 + 3] > 12) {
          x0 = Math.min(x0, x);y0 = Math.min(y0, y);x1 = Math.max(x1, x);y1 = Math.max(y1, y);
        }
        if (x1 < 0) throw new Error('PNG totalmente transparente.');
        resolve({x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, sourceWidth: canvas.width, sourceHeight: canvas.height});
      } catch (error) {reject(error);}};
      image.onerror = () => reject(new Error('Não foi possível carregar o PNG do personagem.'));
      image.src = assets.character!;
    });
    Promise.all([ready, loadFont({family: fontFamily, url: fontUrl})]).then(([box]) => {setBounds(box);continueRender(handle);}).catch(cancelRender);
  }, [assets.character,fontUrl,fontFamily,handle]);
  const p = clamp((t - entryDelay) / entryDuration);
  const arrival = 1 - Math.pow(1 - p, 4);
  const baseHeight = bounds ? Math.min(h * 1.4, w * .92 * bounds.height / bounds.width) : h * 1.4;
  const charH = baseHeight * characterScale;
  const charW = bounds ? charH * bounds.width / bounds.height : 0;
  const scale = bounds ? charH / bounds.height : 1;
  const unit = Math.min(w, h) / 1080;
  // Rotate around the head anchor, keeping it at the spiral's vanishing point.
  const angle = Math.sin(t * 2.1) * sway * arrival;
  const pages: Caption[][] = [];
  for (const cue of cues) {
    const previous = pages.at(-1);
    if (!previous || previous.length >= maxWords || previous.at(-1)!.pageBreakAfter || cue.startMs - previous.at(-1)!.endMs > 600) pages.push([cue]);
    else previous.push(cue);
  }
  const page = pages.find(group => t * 1000 >= group[0].startMs && t * 1000 < group.at(-1)!.endMs);
  return <AbsoluteFill style={{overflow: 'hidden', background: '#080808'}}>
    <Spiral variant={backgroundVariant} time={t} width={w} height={h} />
    {bounds && <div style={{position: 'absolute', left: w / 2 - charW * headAnchor.x,
      top: h / 2 - charH * headAnchor.y, width: charW, height: charH,
      translate: `0 ${(1 - arrival) * (h + charH)}px`, rotate: `${angle}deg`,
      transformOrigin: `${headAnchor.x * 100}% ${headAnchor.y * 100}%`}}>
      <Img src={assets.character} style={{position: 'absolute', left: -bounds.x * scale, top: -bounds.y * scale,
        width: bounds.sourceWidth * scale, height: bounds.sourceHeight * scale, maxWidth: 'none'}} />
    </div>}
    {page && <div style={{position: 'absolute', left: '8%', width: '84%', bottom: h * .075,
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${8 * unit}px ${12 * unit}px`,
      fontFamily: fontFamily, fontSize: (w > h ? 65 : 76) * unit, lineHeight: 1.15,
      color: captionColor, textTransform: 'uppercase', textShadow: fontFamily === 'Anton' ? 'none' : `${3 * unit}px ${4 * unit}px ${3 * unit}px #000`,
      WebkitTextStroke: fontFamily === 'Anton' ? '0px transparent' : `${1.3 * unit}px #000`, zIndex: 10}}>
      {page.map((cue, i) => {
        const active = t * 1000 >= cue.startMs && t * 1000 < cue.endMs;
        return <span key={`${cue.startMs}-${i}`} style={{background: active ? highlightColors[i % highlightColors.length] : 'transparent',
          padding: `${4 * unit}px ${10 * unit}px`, borderRadius: 10 * unit, overflowWrap: 'anywhere', maxWidth: '100%'}}>{cue.text.trim()}</span>;
      })}
    </div>}
  </AbsoluteFill>;
}

type HQFont = 'Bangers' | 'Anton';
export function resolveHQFont(family:HQFont, assets:{bangers?:string;anton?:string}){
  if(family!=='Bangers'&&family!=='Anton')throw new Error('fontFamily deve ser Bangers ou Anton.');
  const key=family==='Anton'?'anton':'bangers';
  if(!assets[key])throw new Error(`Informe customComponent.assets.${key} para a fonte ${family}.`);
  return assets[key]!;
}
