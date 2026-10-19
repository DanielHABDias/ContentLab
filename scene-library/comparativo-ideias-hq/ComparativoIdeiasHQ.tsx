import {HQComicPage, type HQComicPageOptions} from './HQComicPage';
import React from 'react';
import {AbsoluteFill, Img, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Item = {asset: string; text: string; at?: number};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; items: Item[]; title?: string; backgroundColor?: string; textColor?: string;
  startDelay?: number; stagger?: number; entryDuration?: number; textDuration?: number; assets?: Record<string, string>};
type Slot = {x: number; y: number; width: number; height: number; fromX: number; fromY: number};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
type TextLayout = {lines: string[]; size: number};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {const p = clamp(v);return 1 - Math.pow(1 - p, 3);};

export function comparisonLayout(count: number, w: number, h: number, hasTitle = false): Slot[] {
  if (![2, 3, 4].includes(count)) throw new Error('Comparativo requer de 2 a 4 itens.');
  const horizontal = w > h;
  const top = hasTitle ? .20 : .09;
  const bottom = .91;
  const make = (x: number, y: number, width: number, height: number, fromX: number, fromY: number) => ({x: x * w, y: y * h, width: width * w, height: height * h, fromX, fromY});
  if (horizontal && count < 4) {
    const gap = .045;const width = (.86 - gap * (count - 1)) / count;
    return Array.from({length: count}, (_, i) => make(.07 + i * (width + gap), top, width, bottom - top,
      i === 0 ? -1 : i === count - 1 ? 1 : 0, count === 3 && i === 1 ? -1 : 0));
  }
  if (!horizontal && count === 2) {
    const height = (bottom - top - .045) / 2;
    return [make(.09, top, .82, height, 0, -1), make(.09, top + height + .045, .82, height, 0, 1)];
  }
  const height = (bottom - top - .055) / 2;
  if (!horizontal && count === 3) return [make(.20, top, .60, height, 0, -1),
    make(.07, top + height + .055, .40, height, -1, 1), make(.53, top + height + .055, .40, height, 1, 1)];
  return Array.from({length: 4}, (_, i) => make(i % 2 ? .53 : .07, top + Math.floor(i / 2) * (height + .055), .40, height,
    i % 2 ? 1 : -1, i < 2 ? -1 : 1));
}

function fitText(text: string, width: number, height: number, maximum: number, fontFamily:HQFont='Bangers'): TextLayout {
  const ctx = document.createElement('canvas').getContext('2d');if (!ctx) throw new Error('Canvas indisponível.');
  const wrap = (size: number) => {
    ctx.font = `${size}px ${fontFamily}`;
    const lines: string[] = [];let line = '';
    for (const word of text.split(/\s+/)) {
      if (ctx.measureText(word).width > width) {
        if (line) {lines.push(line);line = '';}
        for (const char of Array.from(word)) {
          if (line && ctx.measureText(line + char).width > width) {lines.push(line);line = '';}
          line += char;
        }
      } else if (line && ctx.measureText(line + ' ' + word).width > width) {lines.push(line);line = word;}
      else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);return lines;
  };
  let low = 1, high = maximum;
  for (let i = 0; i < 18; i++) {
    const size = (low + high) / 2;const lines = wrap(size);
    if (lines.length <= 3 && lines.length * size * 1.08 <= height && lines.every(line => ctx.measureText(line).width <= width)) low = size;
    else high = size;
  }
  return {lines: wrap(low), size: low};
}

async function imageBounds(src: string): Promise<Bounds> {
  const image = new Image();image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {image.onload = () => resolve();image.onerror = () => reject(new Error('Falha ao carregar imagem: ' + src));image.src = src;});
  const canvas = document.createElement('canvas');canvas.width = image.naturalWidth;canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');if (!ctx) throw new Error('Canvas indisponível.');
  ctx.drawImage(image, 0, 0);const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (rgba[(y * canvas.width + x) * 4 + 3] > 12) {
    x0 = Math.min(x0, x);y0 = Math.min(y0, y);x1 = Math.max(x1, x);y1 = Math.max(y1, y);
  }
  if (x1 < 0) throw new Error('Imagem totalmente transparente.');
  return {x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, sourceWidth: canvas.width, sourceHeight: canvas.height};
}

export default function ComparativoIdeiasHQ({fontFamily="Bangers", backgroundStyle="halftone", backgroundOpacity=100, paperTone="light", gridBackgroundColor="#10101A", gridLineColor="#858595", items, title = '', backgroundColor = '#D6AD42', textColor = '#FFFFFF',
  startDelay = .15, stagger = .45, entryDuration = .6, textDuration = .25, assets = {}}: Props) {
  const fontUrl=resolveHQFont(fontFamily,assets);
  const {width: w, height: h, fps, durationInFrames} = useVideoConfig();
  const t = useCurrentFrame() / fps;
  if (!Array.isArray(items) || ![2, 3, 4].includes(items.length)) throw new Error('Informe items com 2, 3 ou 4 imagens.');
  if (!fontUrl) throw new Error('Informe fontUrl.');
  if (![backgroundColor, textColor].every(c => /^#[a-f\d]{6}$/i.test(c))) throw new Error('Cores devem usar #RRGGBB.');
  if (![startDelay, stagger, entryDuration, textDuration].every(Number.isFinite) || startDelay < 0 || stagger < 0 || entryDuration <= 0 || textDuration <= 0) throw new Error('Tempos inválidos.');
  const starts = items.map((item, i) => item.at ?? startDelay + i * stagger);
  items.forEach((item, i) => {
    if (!item.text?.trim() || !assets[item.asset]) throw new Error('Cada item precisa de text e uma chave asset existente.');
    if (!Number.isFinite(starts[i]) || starts[i] < 0 || starts[i] + entryDuration + textDuration > durationInFrames / fps + 1e-8) throw new Error('Imagem e texto devem terminar de entrar antes do fim da cena.');
  });
  const slots = comparisonLayout(items.length, w, h, Boolean(title.trim()));
  const unit = Math.min(w, h) / 1080;
  const [prepared, setPrepared] = React.useState<{bounds: Bounds[]; labels: TextLayout[]; heading: TextLayout | null} | null>(null);
  const [handle] = React.useState(() => delayRender('Preparando comparativo de ideias'));
  const signature = JSON.stringify({items, assets, w, h, title});
  React.useEffect(() => {
    Promise.all([loadFont({family: fontFamily, url: fontUrl}), Promise.all(items.map(item => imageBounds(assets[item.asset])))])
      .then(([, bounds]) => {
        const labels = items.map((item, i) => fitText(item.text.normalize('NFC').toLocaleUpperCase('pt-BR').trim(), slots[i].width * .94, slots[i].height * .25,
          Math.min(88 * unit, slots[i].width * .16), fontFamily));
        const heading = title.trim() ? fitText(title.toLocaleUpperCase('pt-BR'), w * .84, h * .10, 94 * unit, fontFamily) : null;
        setPrepared({bounds, labels, heading});continueRender(handle);
      }).catch(cancelRender);
  }, [signature, fontFamily, fontUrl, handle]);
  const textStyle: React.CSSProperties = {fontFamily: fontFamily, color: textColor, lineHeight: 1.08, whiteSpace: 'pre',
    WebkitTextStroke: fontFamily === 'Anton' ? '0px transparent' : `${1.5 * unit}px #080A11`, textShadow: fontFamily === 'Anton' ? 'none' : `${5 * unit}px ${7 * unit}px 0 #080A11`};
  return <AbsoluteFill style={{ overflow: 'hidden'}}>
    <HQBackground {...{backgroundStyle,backgroundColor,backgroundOpacity,paperTone,gridBackgroundColor,gridLineColor}}>
      <AbsoluteFill style={{opacity: .17, backgroundImage: `radial-gradient(#080A11 ${3.2 * unit}px, transparent ${3.8 * unit}px)`, backgroundSize: `${19 * unit}px ${19 * unit}px`}} />
    </HQBackground>
    {prepared?.heading && <div style={{...textStyle, position: 'absolute', left: '8%', top: '6%', width: '84%', textAlign: 'center', fontSize: prepared.heading.size}}>{prepared.heading.lines.join('\n')}</div>}
    {prepared && items.map((item, i) => {
      const slot = slots[i];const box = prepared.bounds[i];const label = prepared.labels[i];
      const progress = ease((t - starts[i]) / entryDuration);
      const labelP = ease((t - starts[i] - entryDuration) / textDuration);
      const imageH = slot.height * .69;
      const size = Math.min(slot.width * .92 / box.width, imageH / box.height);
      const imageW = box.width * size;const visibleH = box.height * size;
      return <React.Fragment key={i}>
        <div style={{position: 'absolute', left: slot.x + (slot.width - imageW) / 2, top: slot.y + (imageH - visibleH) / 2,
          width: imageW, height: visibleH, overflow: 'hidden', opacity: t < starts[i] ? 0 : 1,
          translate: `${slot.fromX * (w + slot.width) * (1 - progress)}px ${slot.fromY * (h + slot.height) * (1 - progress)}px`}}>
          <Img src={assets[item.asset]} style={{position: 'absolute', left: -box.x * size, top: -box.y * size,
            width: box.sourceWidth * size, height: box.sourceHeight * size, maxWidth: 'none'}} />
        </div>
        <div style={{...textStyle, position: 'absolute', left: slot.x + slot.width * .03, top: slot.y + slot.height * .74,
          width: slot.width * .94, height: slot.height * .25, display: 'flex', justifyContent: 'center', alignItems: 'center',
          textAlign: 'center', fontSize: label.size, opacity: labelP, translate: `0 ${(1 - labelP) * 12 * unit}px`}}>{label.lines.join('\n')}</div>
      </React.Fragment>;
    })}
  </AbsoluteFill>;
}

// Fundos HQ v2 — fundos procedurais embutidos; página PNG via HQComicPage.tsx.
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
export function hqGridOffset(time:number){return ((time*28)%84+84)%84;}
export function hqPaperPose(time:number){return Math.floor(Math.max(0,time)*6)%8;}
function HQBackground({backgroundStyle='halftone',backgroundColor='#2459C9',backgroundOpacity=100,paperTone='light',gridBackgroundColor='#10101A',gridLineColor='#858595',children}:HQBackgroundOptions & {children?:React.ReactNode}){
  const frame=useCurrentFrame();const {fps,width,height}=useVideoConfig();const t=frame/fps;
  if(backgroundStyle==='comic_page')return <HQComicPage opacity={backgroundOpacity}/>;
  const uid=React.useId().replace(/:/g,'');
  if(!['halftone','solid','stars','film','paper','grid'].includes(backgroundStyle))throw new Error('backgroundStyle: halftone, solid, stars, film, paper ou grid.');
  if(!Number.isFinite(backgroundOpacity)||backgroundOpacity<0||backgroundOpacity>100)throw new Error('backgroundOpacity deve ser 0–100 (%).');
  if(!/^#[0-9a-f]{6}$/i.test(backgroundColor))throw new Error('backgroundColor deve usar #RRGGBB.');
  if(!['light','dark'].includes(paperTone))throw new Error('paperTone: light ou dark.');
  if(![gridBackgroundColor,gridLineColor].every(c=>/^#[0-9a-f]{6}$/i.test(c)))throw new Error('Cores da grade devem usar #RRGGBB.');
  if(backgroundStyle==='halftone'||backgroundStyle==='solid')return <AbsoluteFill style={{pointerEvents:'none',backgroundColor,opacity:backgroundOpacity/100}}>{backgroundStyle==='halftone'&&(children??<AbsoluteFill style={{opacity:.24,backgroundImage:`radial-gradient(#080A11 ${Math.min(width,height)*.003}px, transparent ${Math.min(width,height)*.0036}px)`,backgroundSize:`${Math.min(width,height)*.018}px ${Math.min(width,height)*.018}px`}}/>)}</AbsoluteFill>;
  const H=1000,W=1000*width/height;
  const rand=(n:number)=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
  const dots=<pattern id={`${uid}dots`} width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.7" fill="#000000" opacity=".16"/></pattern>;
  let content:React.ReactNode;
  if(backgroundStyle==='stars'){
    content=<><rect width={W} height={H} fill="#080B13"/>{Array.from({length:270},(_,i)=>{
      const phase=(rand(i+5)+t*.025)%1,z=.18+phase*.82;
      const x=W/2+(rand(i+700)-.5)*W*2.25*z,y=H/2+(rand(i+1300)-.5)*H*2.25*z;
      const r=(1+rand(i+1700)*5)*z,opacity=Math.min(1,phase*8,(1-phase)*10);
      return <g key={i} opacity={opacity}><circle cx={x+1.4} cy={y+1.4} r={r+1} fill="#000000"/><circle cx={x} cy={y} r={r} fill={i%6===0?'#CCD6ED':'#FFF8E6'}/>{r>3.5&&<path d={`M ${x-r*.4} ${y-r*.5} l ${r*.6} 0`} stroke="white" strokeWidth={1.1}/>}</g>;
    })}<rect width={W} height={H} fill={`url(#${uid}dots)`} opacity=".22"/></>;
  }else if(backgroundStyle==='film'){
    const tick=Math.floor(t*12);
    content=<><rect width={W} height={H} fill="#10100F"/><rect width={W} height={H} fill="#E3DDC8" opacity={.015+rand(tick+2400)*.018}/>
      {Array.from({length:7},(_,i)=>{const x=rand(i+2500)*W+(rand(tick+i*17)-.5)*4;return <path key={i} d={`M ${x} -10 Q ${x+6} 350 ${x-3} 660 T ${x+4} 1010`} fill="none" stroke="#DDD6BC" strokeWidth={i%3===0?1.6:.7} opacity={.12+rand(tick+i)*.16}/>;})}
      {Array.from({length:70},(_,i)=>{const x=rand(tick*71+i+3000)*W,y=rand(tick*73+i+5000)*H;return <path key={i} d={`M ${x} ${y} q 6 -5 3 -12 t 5 -5`} fill="none" stroke="#EFE9CF" strokeWidth={.7+rand(i)*1.4} opacity={.08+rand(i+17)*.22}/>;})}
      <rect width={W} height={H} fill={`url(#${uid}dots)`}/><rect width={W} height={H} fill={`url(#${uid}vignette)`}/></>;
  }else if(backgroundStyle==='paper'){
    const dark=paperTone==='dark',step=135,pose=hqPaperPose(t);
    const cols=Math.ceil(W/step)+1,rows=9;
    const vertex=(x:number,y:number)=>({x:x*step+(x>0&&x<cols? (rand(x+y*31+pose*103)-.5)*90:0),y:y*step+(y>0&&y<rows?(rand(x+y*47+80+pose*103)-.5)*85:0)});
    content=<><rect width={W} height={H} fill={dark?'#252936':'#EEE9DD'}/>
      <g>
      {Array.from({length:cols*rows},(_,i)=>{const x=i%cols,y=Math.floor(i/cols),a=vertex(x,y),b=vertex(x+1,y),c=vertex(x+1,y+1),d=vertex(x,y+1);return <g key={i}>
        <polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`} fill={rand(i+91)>.5?'#FFFFFF':'#000000'} opacity={dark?.035+rand(i)*.08:.025+rand(i)*.10}/>
        <polygon points={`${a.x},${a.y} ${c.x},${c.y} ${d.x},${d.y}`} fill={rand(i+711)>.5?'#FFFFFF':'#000000'} opacity={dark?.03+rand(i+30)*.07:.02+rand(i+30)*.09}/>
        <path d={`M ${a.x} ${a.y} L ${c.x} ${c.y}`} stroke={dark?'#090D17':'#706B62'} strokeWidth="1.1" opacity=".15"/>
        <path d={`M ${a.x+2} ${a.y} L ${c.x+2} ${c.y}`} stroke="#FFFFFF" strokeWidth="1.6" opacity={dark?.045:.28}/>
      </g>;})}</g><rect width={W} height={H} fill={`url(#${uid}dots)`} opacity={dark?.55:.30}/></>;
  }else{
    const spacing=84,shiftX=hqGridOffset(t),shiftY=0;
    content=<><rect width={W} height={H} fill={gridBackgroundColor}/>
      <g stroke={gridLineColor} strokeWidth="2" opacity=".62">
        {Array.from({length:Math.ceil(W/spacing)+3},(_,i)=><path key={`x${i}`} d={`M ${(i-1)*spacing+shiftX} -20 L ${(i-1)*spacing+shiftX} 1020`}/>)}
        {Array.from({length:15},(_,i)=><path key={`y${i}`} d={`M -20 ${(i-1)*spacing+shiftY} L ${W+20} ${(i-1)*spacing+shiftY}`}/>)}
      </g><rect width={W} height={H} fill={`url(#${uid}dots)`} opacity=".45"/>
      <rect width={W} height={H} fill={`url(#${uid}vignette)`} opacity=".28"/></>;
  }
  return <AbsoluteFill style={{pointerEvents:'none',overflow:'hidden',opacity:backgroundOpacity/100}}><svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{position:'absolute',inset:0}}>
    <defs>{dots}<radialGradient id={`${uid}vignette`}><stop offset="35%" stopColor="#000000" stopOpacity="0"/><stop offset="100%" stopColor="#000000" stopOpacity=".75"/></radialGradient></defs>{content}
  </svg></AbsoluteFill>;
}

type HQFont = 'Bangers' | 'Anton';
export function resolveHQFont(family:HQFont, assets:{bangers?:string;anton?:string}){
  if(family!=='Bangers'&&family!=='Anton')throw new Error('fontFamily deve ser Bangers ou Anton.');
  const key=family==='Anton'?'anton':'bangers';
  if(!assets[key])throw new Error(`Informe customComponent.assets.${key} para a fonte ${family}.`);
  return assets[key]!;
}
