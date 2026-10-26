import {imageBoundsHQ} from './HQMotion';
import {HQComicPage, type HQComicPageOptions} from './HQComicPage';
import React from 'react';
import {AbsoluteFill, Img, delayRender, continueRender, cancelRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';
import type {Caption} from '@remotion/captions';

type Word = {word?: string; text?: string; start: number; end: number};
type Props = HQComicPageOptions & {fontFamily?: HQFont;
  assets?: {character?: string; bangers?: string; anton?: string};
  backgroundVariant?: 'espiral' | 'crescente';
  captions?: Caption[]; words?: Word[]; transcriptOffset?: number;
  entryDuration?: number; entryDelay?: number; characterScale?: number;
  headAnchor?: {x: number; y: number}; sway?: number; maxWords?: number;
  captionColor?: string; highlightColors?: string[];
};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function spiralField(columns:number,rows:number,width:number,height:number,variant:string){
  const phase=new Float64Array(columns*rows),grain=new Int16Array(columns*rows),radius=Math.hypot(width,height)/2;
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const dx=(x+.5)/columns*width-width/2,dy=(y+.5)/rows*height-height/2,d=Math.hypot(dx,dy)/radius;
    const bend=(variant==='crescente'?.55:.42)*Math.pow(d,.85)+.02*Math.sin(d*5)*d,i=y*columns+x;
    phase[i]=(Math.atan2(dy,dx)-bend)*10;grain[i]=((x*137+y*53+x*y*7)%19)-9;
  }return {phase,grain};
}
// Procedural spiral: no background video, texture file or companion module needed.
function Spiral({variant, time, width, height}: {variant: 'espiral' | 'crescente'; time: number; width: number; height: number}) {
  const canvas = React.useRef<HTMLCanvasElement>(null);
  // Draw at low resolution, then enlarge with nearest-neighbor sampling.
  // The stepped edges belong to the spiral itself, not just a texture overlay.
  const pixel = Math.max(2, Math.min(width, height) / 180);
  const columns = Math.ceil(width / pixel);
  const rows = Math.ceil(height / pixel);
  const field=React.useMemo(()=>spiralField(columns,rows,width,height,variant),[columns,rows,width,height,variant]);
  const buffer=React.useRef<ImageData|null>(null);
  React.useLayoutEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível para a espiral pixelada.');
    const pixels=buffer.current?.width===columns&&buffer.current?.height===rows?buffer.current:ctx.createImageData(columns,rows);buffer.current=pixels;
    const rotation=time*(variant==='crescente'?-.09:.075)*10;
    for(let i=0;i<field.phase.length;i++){
      const dark=Math.sin(field.phase[i]-rotation)>0;
      const value=Math.max(0,Math.min(255,(dark?(variant==='crescente'?52:8):226)+field.grain[i]));
      const j=i*4;pixels.data[j]=value;pixels.data[j+1]=value;pixels.data[j+2]=value;pixels.data[j+3]=255;
    }
    ctx.putImageData(pixels, 0, 0);
  }, [columns, rows, field, variant, time]);
  return <>
    <canvas ref={canvas} width={columns} height={rows} style={{position: 'absolute', width: '100%', height: '100%', imageRendering: 'pixelated'}} />
    <AbsoluteFill style={{opacity: .32, backgroundImage: 'radial-gradient(#000 0.75px, transparent 1.15px)', backgroundSize: '3px 3px'}} />
    <AbsoluteFill style={{backgroundImage: 'radial-gradient(ellipse at center, transparent 14%, #0002 48%, #000B 100%)'}} />
  </>;
}

export default function PersonagemEspiralLegenda({backgroundStyle, backgroundOpacity=100, fontFamily="Bangers", assets = {}, backgroundVariant = 'espiral', captions, words,
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
  const cues=React.useMemo(()=>{const value:Caption[] = captions ?? (words ?? []).filter(word => word.end > transcriptOffset && word.start < transcriptOffset + duration).map(word => ({
    text: word.word ?? word.text ?? '', startMs: Math.max(0, word.start - transcriptOffset) * 1000,
    endMs: Math.min(duration, word.end - transcriptOffset) * 1000, timestampMs: null, confidence: null,
  }));
  value.forEach((cue, i) => {
    if (!cue.text?.trim() || !Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs) || cue.startMs < 0 || cue.endMs <= cue.startMs || cue.endMs > duration * 1000 + 1 || (i > 0 && cue.startMs < value[i - 1].endMs)) throw new Error('Legendas requerem palavras ordenadas, sem sobreposição e dentro da cena.');
  });
  return value;},[captions,words,transcriptOffset,duration]);
  const [bounds, setBounds] = React.useState<Bounds | null>(null);
  const [handle] = React.useState(() => delayRender('Preparando personagem e legenda'));
  React.useEffect(() => {
    let live=true;
    const ready=imageBoundsHQ(assets.character!);
    Promise.all([ready, loadFont({family: fontFamily, url: fontUrl})]).then(([box]) => {if(live)setBounds(box);continueRender(handle);}).catch(cancelRender);
    return()=>{live=false;};
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
  const pages=React.useMemo(()=>{const groups:Caption[][] = [];
  for (const cue of cues) {
    const previous = groups.at(-1);
    if (!previous || previous.length >= maxWords || previous.at(-1)!.pageBreakAfter || cue.startMs - previous.at(-1)!.endMs > 600) groups.push([cue]);
    else previous.push(cue);
  }
  return groups;},[cues,maxWords]);
  const page = pages.find(group => t * 1000 >= group[0].startMs && t * 1000 < group.at(-1)!.endMs);
  return <AbsoluteFill style={{overflow: 'hidden', background: backgroundStyle==='comic_page'?'transparent':'#080808'}}>
    {backgroundStyle==='comic_page'?<HQComicPage opacity={backgroundOpacity}/>:<Spiral variant={backgroundVariant} time={t} width={w} height={h} />}
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
