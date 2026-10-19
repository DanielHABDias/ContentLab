import {HQComicPage, type HQComicPageOptions} from './HQComicPage';
import React from 'react';
import {AbsoluteFill, Img, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Card = {asset: string; title: string; caption?: string; at?: number; cardColor?: string; accentColor?: string};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; title: string; subtitle?: string; items: Card[]; columns?: number;
  backgroundColor?: string; cardColor?: string; textColor?: string; cardTextColor?: string; accentColor?: string;
  startDelay?: number; stagger?: number; entryDuration?: number; textDuration?: number; stackOffset?: number;
  assets?: Record<string, string>};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
type TextLayout = {lines: string[]; size: number};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => 1 - Math.pow(1 - clamp(v), 3);

export function gallerySlot(index: number, columns: number) {
  return {column: index % columns, layer: Math.floor(index / columns)};
}
export function galleryDepth(index: number, columns: number, starts: number[], time: number, entryDuration: number) {
  let depth = 0;
  for (let next = index + columns; next < starts.length; next += columns) depth += ease((time - starts[next]) / entryDuration);
  return Math.min(3, depth);
}

function fit(text: string, width: number, height: number, max: number, fontFamily:HQFont='Bangers'): TextLayout {
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
  let low = 1, high = max;
  for (let i = 0; i < 18; i++) {
    const size = (low + high) / 2;const lines = wrap(size);
    if (lines.length <= 2 && lines.length * size * 1.08 <= height && lines.every(line => ctx.measureText(line).width <= width)) low = size;
    else high = size;
  }
  return {lines: wrap(low), size: low};
}
async function boundsFor(src: string): Promise<Bounds> {
  const image = new Image();image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {image.onload = () => resolve();image.onerror = () => reject(new Error('Imagem inválida: ' + src));image.src = src;});
  const canvas = document.createElement('canvas');canvas.width = image.naturalWidth;canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');if (!ctx) throw new Error('Canvas indisponível.');ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3] > 12) {
    x0 = Math.min(x0, x);y0 = Math.min(y0, y);x1 = Math.max(x1, x);y1 = Math.max(y1, y);
  }
  if (x1 < 0) throw new Error('Imagem totalmente transparente.');
  return {x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, sourceWidth: canvas.width, sourceHeight: canvas.height};
}

export default function GaleriaCartasHQ({fontFamily="Bangers", backgroundStyle="halftone", backgroundOpacity=100, paperTone="light", gridBackgroundColor="#10101A", gridLineColor="#858595", title, subtitle = '', items, columns,
  backgroundColor = '#1B2943', cardColor = '#F6EDD8', textColor = '#FFFFFF', cardTextColor = '#111723', accentColor = '#F4C542',
  startDelay = .25, stagger = 1.1, entryDuration = .65, textDuration = .2, stackOffset = 16, assets = {}}: Props) {
  const fontUrl=resolveHQFont(fontFamily,assets);
  const {width: w, height: h, fps, durationInFrames} = useVideoConfig();
  const t = useCurrentFrame() / fps;const horizontal = w > h;const u = Math.min(w, h) / 1080;
  if (!title?.trim() || !Array.isArray(items) || !items.length) throw new Error('Informe title e ao menos um item.');
  if (!fontUrl) throw new Error('Informe fontUrl.');
  const requestedColumns = columns ?? (horizontal ? 3 : 2);
  if (!Number.isInteger(requestedColumns) || requestedColumns < 1 || requestedColumns > 4) throw new Error('columns deve ser de 1 a 4.');
  const count = Math.min(requestedColumns, items.length);
  if (![backgroundColor, cardColor, textColor, cardTextColor, accentColor, ...items.flatMap(item => [item.cardColor ?? cardColor, item.accentColor ?? accentColor])].every(color => /^#[a-f\d]{6}$/i.test(color))) throw new Error('Cores devem usar #RRGGBB.');
  if (![startDelay, stagger, entryDuration, textDuration, stackOffset].every(Number.isFinite) || startDelay < 0 || stagger < 0 || entryDuration <= 0 || textDuration <= 0 || stackOffset < 0 || stackOffset > 24) throw new Error('Tempos inválidos ou stackOffset fora de 0–24.');
  const starts = items.map((item, i) => item.at ?? startDelay + i * stagger);
  items.forEach((item, i) => {
    if (!item.title?.trim() || !assets[item.asset]) throw new Error('Cada carta requer title e uma chave asset existente.');
    if (!Number.isFinite(starts[i]) || starts[i] < 0 || starts[i] + entryDuration + textDuration > durationInFrames / fps + 1e-8) throw new Error('A entrada da carta e de seu texto precisa caber na cena.');
    if (i && starts[i] < starts[i - 1]) throw new Error('Os horários at devem seguir a ordem dos itens.');
    if (i >= count && starts[i] < starts[i - count] + entryDuration + textDuration - 1e-8) throw new Error('Uma carta não pode encobrir outra antes de sua entrada e texto terminarem.');
  });
  const gap = w * .035;
  const cw = (w * .86 - gap * (count - 1)) / count;
  const ch = Math.min(h * .58, cw * 1.95);
  const top = h * (subtitle.trim() ? .29 : .25);
  const [prepared, setPrepared] = React.useState<{bounds: Bounds[]; labels: TextLayout[]; captions: TextLayout[]; heading: TextLayout; sub: TextLayout} | null>(null);
  const [handle] = React.useState(() => delayRender('Preparando galeria de cartas HQ'));
  const signature = JSON.stringify({items, assets, title, subtitle, cw, ch, w, h});
  React.useEffect(() => {
    Promise.all([loadFont({family: fontFamily, url: fontUrl}), Promise.all(items.map(item => boundsFor(assets[item.asset])))])
      .then(([, bounds]) => {
        setPrepared({bounds,
          labels: items.map(item => fit(item.title.normalize('NFC').toLocaleUpperCase('pt-BR'), cw * .86, ch * .15, 65 * u, fontFamily)),
          captions: items.map(item => fit((item.caption ?? '').toLocaleUpperCase('pt-BR'), cw * .86, ch * .08, 32 * u, fontFamily)),
          heading: fit(title.toLocaleUpperCase('pt-BR'), w * .86, h * .105, 100 * u, fontFamily),
          sub: fit(subtitle.toLocaleUpperCase('pt-BR'), w * .86, h * .045, 38 * u, fontFamily)});
        continueRender(handle);
      }).catch(cancelRender);
  }, [signature, fontFamily, fontUrl, handle]);
  return <AbsoluteFill style={{overflow: 'hidden',  fontFamily: fontFamily}}>
    <HQBackground {...{backgroundStyle,backgroundColor,backgroundOpacity,paperTone,gridBackgroundColor,gridLineColor}}>
      <AbsoluteFill style={{opacity: .18, backgroundImage: `radial-gradient(#080A11 ${3.2 * u}px, transparent ${3.8 * u}px)`, backgroundSize: `${19 * u}px ${19 * u}px`}} />
    </HQBackground>
    {prepared && <>
      <div style={{position: 'absolute', zIndex: 2, left: '7%', top: '6%', width: '86%', color: textColor,
        textShadow: fontFamily === 'Anton' ? 'none' : `${4 * u}px ${6 * u}px 0 #080A11`, fontSize: prepared.heading.size, lineHeight: 1.08, whiteSpace: 'pre'}}>{prepared.heading.lines.join('\n')}</div>
      {subtitle.trim() && <div style={{position: 'absolute', zIndex: 2, left: '7%', top: '17.5%', width: '86%', color: textColor,
        fontSize: prepared.sub.size, lineHeight: 1.08, opacity: .8, whiteSpace: 'pre'}}>{prepared.sub.lines.join('\n')}</div>}
      <div style={{position: 'absolute', left: '7%', top: subtitle.trim() ? '24%' : '20%', width: '86%', height: 4 * u, background: accentColor}} />
      <AbsoluteFill style={{zIndex: 1}}>{items.map((item, i) => {
        if (t < starts[i]) return null;
        const {column} = gallerySlot(i, count);const progress = ease((t - starts[i]) / entryDuration);
        const depth = galleryDepth(i, count, starts, t, entryDuration);
        const bx = w * .07 + column * (cw + gap);
        const dx = depth * stackOffset * u * (column % 2 ? 1 : -1);
        const dy = depth * stackOffset * u;
        const color = item.accentColor ?? accentColor;
        const bounds = prepared.bounds[i];const pictureW = cw * .86, pictureH = ch * .65;
        const size = Math.min(pictureW / bounds.width, pictureH / bounds.height);
        const iw = bounds.width * size, ih = bounds.height * size;
        const contentOpacity = 1 - clamp(depth);
        const labelP = ease((t - starts[i] - entryDuration) / textDuration);
        return <div key={i} style={{position: 'absolute', left: bx + dx, top: top + dy, width: cw, height: ch, zIndex: i + 1,
          translate: `0 ${(1 - progress) * (h + ch)}px`, scale: 1 - depth * .025, rotate: `${depth * (column % 2 ? .8 : -.8)}deg`,
          boxSizing: 'border-box', background: item.cardColor ?? cardColor, border: `${6 * u}px solid #080A11`, boxShadow: `${10 * u}px ${12 * u}px 0 #080A11`, transformOrigin: 'center'}}>
          <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 8 * u, background: color}} />
          <AbsoluteFill style={{opacity: .08, backgroundImage: `radial-gradient(#080A11 ${2 * u}px, transparent ${2.5 * u}px)`, backgroundSize: `${15 * u}px ${15 * u}px`}} />
          <AbsoluteFill style={{opacity: contentOpacity}}>
            <div style={{position: 'absolute', left: 14 * u, top: 16 * u, background: color, color: '#080A11', padding: `${3 * u}px ${9 * u}px`, fontSize: 27 * u}}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{position: 'absolute', left: (cw - iw) / 2, top: ch * .07 + (pictureH - ih) / 2, width: iw, height: ih, overflow: 'hidden'}}>
              <Img src={assets[item.asset]} style={{position: 'absolute', left: -bounds.x * size, top: -bounds.y * size,
                width: bounds.sourceWidth * size, height: bounds.sourceHeight * size, maxWidth: 'none'}} />
            </div>
            <div style={{position: 'absolute', left: '7%', top: '75%', width: '86%', opacity: labelP, color: cardTextColor,
              fontSize: prepared.labels[i].size, lineHeight: 1.08, whiteSpace: 'pre', textShadow: fontFamily === 'Anton' ? 'none' : `${1.5 * u}px ${2 * u}px 0 #00000022`}}>{prepared.labels[i].lines.join('\n')}</div>
            {item.caption && <div style={{position: 'absolute', left: '7%', top: '91%', width: '86%', color: cardTextColor, opacity: labelP * .8,
              fontSize: prepared.captions[i].size, lineHeight: 1.08, whiteSpace: 'pre'}}>{prepared.captions[i].lines.join('\n')}</div>}
          </AbsoluteFill>
        </div>;
      })}</AbsoluteFill>
    </>}
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
