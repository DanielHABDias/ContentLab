import {imageBoundsHQ} from './HQMotion';
import {HQComicPage, type HQComicPageOptions} from './HQComicPage';
import React from 'react';
import {AbsoluteFill, Img, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Phrase = {text: string; at: number; color?: string; size?: number};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; phrases: Phrase[]; imageSide?: 'left' | 'right'; label?: string;
  backgroundColor?: string; textColor?: string; mutedColor?: string; accentColor?: string; glowColor?: string;
  glowIntensity?: number; imageScale?: number; assets?: {image?: string; bangers?: string; anton?: string}};
type Line = {text: string; size: number; height: number};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};

export function phraseVisible(at: number, frame: number, fps: number) {
  return frame >= Math.ceil(at * fps - 1e-8);
}
export function phraseColor(index: number, muted: string, white: string, accent: string) {
  return [muted, white, accent][index % 3];
}

function wrap(text: string, size: number, width: number, ctx: CanvasRenderingContext2D, fontFamily:HQFont='Bangers') {
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
}
function textLayout(phrases: Phrase[], width: number, height: number, maximum: number, gap: number, fontFamily:HQFont='Bangers'): Line[] {
  const ctx = document.createElement('canvas').getContext('2d');if (!ctx) throw new Error('Canvas indisponível.');
  const calculate = (base: number) => phrases.map(phrase => {
    const size = base * (phrase.size ?? 1);
    const lines = wrap(phrase.text.normalize('NFC').toLocaleUpperCase('pt-BR').trim(), size, width, ctx, fontFamily);
    return {text: lines.join('\n'), size, height: lines.length * size * 1.04};
  });
  let low = 1, high = maximum;
  for (let i = 0; i < 18; i++) {
    const base = (low + high) / 2;
    const lines = calculate(base);
    if (lines.reduce((sum, line) => sum + line.height, 0) + Math.max(0, phrases.length - 1) * gap <= height) low = base;
    else high = base;
  }
  return calculate(low);
}
const imageBounds=imageBoundsHQ;

export default function ImagemFrasesHQ({fontFamily="Bangers", backgroundStyle="halftone", backgroundOpacity=100, paperTone="light", gridBackgroundColor="#10101A", gridLineColor="#858595", phrases, imageSide = 'right', label = '', backgroundColor = '#111522',
  textColor = '#FFFFFF', mutedColor = '#A6A9B1', accentColor = '#EF3F49', glowColor,
  glowIntensity = .65, imageScale = 1, assets = {}}: Props) {
  const fontUrl=resolveHQFont(fontFamily,assets);
  const {width: w, height: h, fps, durationInFrames} = useVideoConfig();
  const frame = useCurrentFrame();const horizontal = w > h;const u = Math.min(w, h) / 1080;
  if (!Array.isArray(phrases) || !phrases.length) throw new Error('Informe ao menos uma frase.');
  if (!assets.image || !fontUrl) throw new Error('Informe assets.image e fontUrl.');
  if (!['left', 'right'].includes(imageSide)) throw new Error('imageSide deve ser left ou right.');
  const glow = glowColor ?? accentColor;
  if (![backgroundColor, textColor, mutedColor, accentColor, glow, ...phrases.map(p => p.color ?? textColor)].every(c => /^#[a-f\d]{6}$/i.test(c))) throw new Error('Cores devem usar #RRGGBB.');
  if (!Number.isFinite(imageScale) || imageScale < .25 || imageScale > 1 || !Number.isFinite(glowIntensity) || glowIntensity < 0 || glowIntensity > 1) throw new Error('imageScale deve ser 0.25–1; glowIntensity 0–1.');
  phrases.forEach((phrase, i) => {
    if (!phrase.text?.trim() || !Number.isFinite(phrase.at) || phrase.at < 0 || Math.ceil(phrase.at * fps - 1e-8) >= durationInFrames || (i > 0 && phrase.at < phrases[i - 1].at)) throw new Error('Frases precisam de text e at ordenado dentro da cena.');
    if (!Number.isFinite(phrase.size ?? 1) || (phrase.size ?? 1) < .4 || (phrase.size ?? 1) > 1.5) throw new Error('size relativo da frase deve ser 0.4–1.5.');
  });
  const picture = horizontal ? {x: w * (imageSide === 'right' ? .59 : .07), y: h * .16, width: w * .34, height: h * .69}
    : {x: w * .16, y: h * .13, width: w * .68, height: h * .35};
  const textBox = horizontal ? {x: w * (imageSide === 'right' ? .07 : .47), y: h * .23, width: w * .46, height: h * .57}
    : {x: w * .10, y: h * .55, width: w * .80, height: h * .34};
  const gap = Math.min(18 * u, textBox.height * .18 / phrases.length);
  const [prepared, setPrepared] = React.useState<{bounds: Bounds; lines: Line[]; label: Line[]} | null>(null);
  const [handle] = React.useState(() => delayRender('Preparando imagem e frases HQ'));
  const signature = JSON.stringify({phrases, assets, w, h, label, imageSide});
  React.useEffect(() => {let live=true;
    Promise.all([loadFont({family: fontFamily, url: fontUrl}), imageBounds(assets.image!)]).then(([, bounds]) => {if(!live)return;
      setPrepared({bounds, lines: textLayout(phrases, textBox.width, textBox.height, horizontal ? 140 * u : 122 * u, gap, fontFamily),
        label: label.trim() ? textLayout([{text: label, at: 0}], w * .86, h * .04, 34 * u, 0, fontFamily) : []});
      continueRender(handle);
    }).catch(error=>{if(live)cancelRender(error);});return()=>{live=false;};}, [signature, fontFamily, fontUrl, handle]);
  const scale = prepared ? Math.min(picture.width / prepared.bounds.width, picture.height / prepared.bounds.height) * imageScale : 1;
  const iw = prepared ? prepared.bounds.width * scale : 0, ih = prepared ? prepared.bounds.height * scale : 0;
  let lineY = 0;
  return <AbsoluteFill style={{ overflow: 'hidden', fontFamily: fontFamily}}>
    <HQBackground {...{backgroundStyle,backgroundColor,backgroundOpacity,paperTone,gridBackgroundColor,gridLineColor}}>
      <AbsoluteFill style={{opacity: .10, backgroundImage: `radial-gradient(#FFFFFF ${2.3 * u}px, transparent ${3 * u}px)`, backgroundSize: `${18 * u}px ${18 * u}px`}} />
    </HQBackground>
    <div style={{position: 'absolute', left: picture.x - picture.width * .12, top: picture.y - picture.height * .08,
      width: picture.width * 1.24, height: picture.height * 1.16, opacity: glowIntensity,
      background: `radial-gradient(ellipse at center, ${glow}70 0%, ${glow}30 38%, ${glow}00 72%)`}} />
    {prepared && <>
      {prepared.label.length > 0 && <div style={{position: 'absolute', left: '7%', top: '6%', color: accentColor, fontSize: prepared.label[0].size, whiteSpace: 'pre', lineHeight: 1.04}}>{prepared.label[0].text}</div>}
      <div style={{position: 'absolute', left: picture.x + (picture.width - iw) / 2, top: picture.y + (picture.height - ih) / 2, width: iw, height: ih, overflow: 'hidden'}}>
        <Img src={assets.image} style={{position: 'absolute', left: -prepared.bounds.x * scale, top: -prepared.bounds.y * scale,
          width: prepared.bounds.sourceWidth * scale, height: prepared.bounds.sourceHeight * scale, maxWidth: 'none'}} />
      </div>
      <div style={{position: 'absolute', left: textBox.x, top: textBox.y, width: textBox.width, height: textBox.height}}>
        {phrases.map((phrase, i) => {
          const line = prepared.lines[i];const top = lineY;lineY += line.height + gap;
          return <div key={i} style={{position: 'absolute', top, left: 0, width: '100%', height: line.height,
            fontSize: line.size, whiteSpace: 'pre', lineHeight: 1.04, color: phrase.color ?? phraseColor(i, mutedColor, textColor, accentColor),
            textShadow: fontFamily === 'Anton' ? 'none' : `${4 * u}px ${6 * u}px 0 #080A11`, opacity: phraseVisible(phrase.at, frame, fps) ? 1 : 0}}>{line.text}</div>;
        })}
      </div>
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
  const uid=React.useId().replace(/:/g,'');
  const stars=React.useMemo(()=>backgroundStyle==='stars'&&backgroundOpacity>0?Array.from({length:270},(_,i)=>{
    const rand=(n:number)=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
    return {phase:rand(i+5),x:rand(i+700)-.5,y:rand(i+1300)-.5,radius:1+rand(i+1700)*5};
  }):[],[backgroundStyle,backgroundOpacity]);
  if(backgroundStyle==='comic_page')return <HQComicPage opacity={backgroundOpacity}/>;
  if(backgroundOpacity===0)return null;
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
    content=<><rect width={W} height={H} fill="#080B13"/>{stars.map((star,i)=>{
      const phase=(star.phase+t*.025)%1,z=.18+phase*.82;
      const x=W/2+star.x*W*2.25*z,y=H/2+star.y*H*2.25*z;
      const r=star.radius*z,opacity=Math.min(1,phase*8,(1-phase)*10);
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
