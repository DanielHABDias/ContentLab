import React from 'react';
import {AbsoluteFill, Freeze, OffthreadVideo, useCurrentFrame, useVideoConfig, delayRender, continueRender, cancelRender} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Clip = {asset: string; title?: string; subtitle?: string; sourceStart?: number; hold?: number; crt?: boolean};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; clips: Clip[]; direction?: 'forward' | 'reverse'; backgroundColor?: string; accentColor?: string; textColor?: string;
  startDelay?: number; moveDuration?: number; enterDuration?: number; enterLast?: boolean; assets?: Record<string, string>};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {const p = clamp(v); return p * p * (3 - 2 * p);};
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

export default function LinhaDoTempoHQ({fontFamily="Bangers", backgroundStyle="halftone", backgroundOpacity=100, paperTone="light", gridBackgroundColor="#10101A", gridLineColor="#858595", clips, direction = 'forward', backgroundColor = '#E8C64F', accentColor = '#2676E8', textColor = '#FFFFFF',
  startDelay = .3, moveDuration = .8, enterDuration = 1.05, enterLast = true, assets = {}}: Props) {
  const fontUrl=resolveHQFont(fontFamily,assets);
  const {width: w, height: h, fps, durationInFrames} = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const horizontal = w > h;
  const u = Math.min(w, h) / 1080;
  if (!Array.isArray(clips) || !clips.length) throw new Error('Informe pelo menos um clip.');
  if (!['forward', 'reverse'].includes(direction)) throw new Error('direction deve ser forward ou reverse.');
  if (![backgroundColor, accentColor, textColor].every(c => /^#[a-f\d]{6}$/i.test(c))) throw new Error('Use cores #RRGGBB.');
  if (!Number.isFinite(startDelay) || startDelay < 0 || !Number.isFinite(moveDuration) || moveDuration <= 0 || !Number.isFinite(enterDuration) || enterDuration <= 0) throw new Error('Tempos de movimento inválidos.');
  clips.forEach(c => {
    if (!assets[c.asset]) throw new Error(`Asset ausente: ${c.asset}`);
    if (!Number.isFinite(c.hold ?? 2) || (c.hold ?? 2) < .35 || !Number.isFinite(c.sourceStart ?? 0) || (c.sourceStart ?? 0) < 0) throw new Error('hold deve ser >= .35 e sourceStart >= 0.');
  });
  if (!fontUrl) throw new Error('Informe fontUrl.');
  const [fontHandle] = React.useState(() => delayRender('Carregando Bangers da linha do tempo'));
  React.useEffect(() => {loadFont({family: fontFamily, url: fontUrl})
    .then(() => continueRender(fontHandle)).catch(cancelRender);}, [fontUrl, fontHandle]);
  const indices = clips.map((_, i) => i);
  if (direction === 'reverse') indices.reverse();
  let cursor = startDelay;
  const schedule = indices.map((index, order) => {
    const at = cursor;
    const end = at + (clips[index].hold ?? 2);
    cursor = end + (order < clips.length - 1 ? moveDuration : 0);
    return {index, at, end};
  });
  const last = schedule[schedule.length - 1];
  const minimum = last.end + (enterLast ? enterDuration : 0);
  if (minimum > durationInFrames / fps + 1 / fps) throw new Error(`Cena curta: requer pelo menos ${minimum.toFixed(3)} segundos.`);
  const activeOrder = Math.max(0, schedule.findLastIndex(c => t >= c.at));
  const current = schedule[activeOrder];
  const next = schedule[activeOrder + 1];
  const spacing = w * (horizontal ? .78 : 1.08);
  const travel = next ? ease((t - current.end) / moveDuration) : 0;
  const camera = mix(current.index * spacing, (next?.index ?? current.index) * spacing, travel);
  const zoom = enterLast ? ease((t - last.end) / enterDuration) : 0;
  const lineY = h * (horizontal ? .72 : .59);
  const cw = w * (horizontal ? .55 : .84);
  const ch = h * (horizontal ? .55 : .30);
  const top = lineY - ch - h * .055;
  const origin = w / 2 - camera;
  const progressStart = direction === 'forward' ? 0 : camera;
  const progressEnd = direction === 'forward' ? camera : (clips.length - 1) * spacing;

  return <AbsoluteFill style={{overflow: 'hidden', fontFamily: fontFamily}}>
    <HQBackground {...{backgroundStyle,backgroundColor,backgroundOpacity,paperTone,gridBackgroundColor,gridLineColor}}>
      <AbsoluteFill style={{opacity: .24 * (1 - zoom), backgroundImage: `radial-gradient(#080A11 ${3 * u}px, transparent ${3.8 * u}px)`, backgroundSize: `${19 * u}px ${19 * u}px`}} />
    </HQBackground>
    <AbsoluteFill style={{translate: `${Math.sin(t * .8) * 3 * u * (1 - zoom)}px ${Math.sin(t) * 4 * u * (1 - zoom)}px`, rotate: `${Math.sin(t * .6) * .18 * (1 - zoom)}deg`}}>
      <div style={{position: 'absolute', left: origin - w, top: lineY - 8 * u, width: (clips.length - 1) * spacing + 2 * w, height: 16 * u, background: '#FAF7E9', border: `${4 * u}px solid #080A11`, boxSizing: 'border-box', opacity: 1 - zoom}} />
      <div style={{position: 'absolute', left: origin + progressStart, top: lineY - 4 * u, width: Math.max(0, progressEnd - progressStart), height: 8 * u, background: accentColor, opacity: 1 - zoom}} />
      {schedule.map((cue, order) => {
        const c = clips[cue.index];
        const final = order === schedule.length - 1;
        const expanding = final ? zoom : 0;
        const reveal = ease((t - cue.at) / .3);
        const leave = !final ? ease((t - (cue.end - .24)) / .24) : 0;
        const light = reveal * (1 - leave);
        const elapsed = Math.max(0, Math.min(t, final && enterLast ? durationInFrames / fps : cue.end - (final ? 0 : .24)) - cue.at);
        const x = origin + cue.index * spacing;
        return <React.Fragment key={cue.index}>
          <div style={{position: 'absolute', left: x - 18 * u, top: lineY - 18 * u, width: 36 * u, height: 36 * u, borderRadius: '50%', background: t >= cue.at ? accentColor : '#FAF7E9', border: `${5 * u}px solid #080A11`, boxSizing: 'border-box', opacity: 1 - zoom}} />
          <div style={{position: 'absolute', left: x - cw / 2, top: lineY + 43 * u, width: cw, textAlign: 'center', opacity: reveal * (1 - zoom), color: textColor,
            fontFamily: fontFamily, textTransform: 'uppercase', background: 'transparent',
            textShadow: fontFamily === 'Anton' ? 'none' : `${4 * u}px ${5 * u}px 0 #080A11, ${7 * u}px ${9 * u}px ${2 * u}px #080A1180`}}>
            <div style={{fontSize: (horizontal ? 72 : 94) * u, lineHeight: 1.05, overflowWrap: 'anywhere'}}>{c.title}</div>
            <div style={{fontSize: (horizontal ? 38 : 49) * u, marginTop: 14 * u, overflowWrap: 'anywhere'}}>{c.subtitle}</div>
          </div>
          <div style={{position: 'absolute', left: mix(x - cw / 2, 0, expanding), top: mix(top + (1 - reveal) * 40 * u, 0, expanding), width: mix(cw, w, expanding), height: mix(ch, h, expanding), boxSizing: 'border-box', border: `${8 * u * (1 - expanding)}px solid ${accentColor}`, background: '#080A11', overflow: 'hidden', opacity: reveal * (final ? 1 : 1 - zoom), zIndex: final && zoom > 0 ? 20 : 2, boxShadow: `${11 * u * (1 - expanding)}px ${13 * u * (1 - expanding)}px 0 #080A11`}}>
            <AbsoluteFill style={{filter: `grayscale(${1 - light}) brightness(${.32 + .68 * light})`}}>
              <Freeze frame={Math.round(elapsed * fps)}><OffthreadVideo src={assets[c.asset]} muted trimBefore={Math.round((c.sourceStart ?? 0) * fps)} style={{position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center'}} /></Freeze>
              {c.crt && <AbsoluteFill style={{backgroundImage: `radial-gradient(circle, transparent 45%, #0006 100%), repeating-linear-gradient(to bottom, #0004 0px, #0004 ${u}px, #FFFFFF08 ${2 * u}px, transparent ${4 * u}px)`}} />}
            </AbsoluteFill>
          </div>
        </React.Fragment>;
      })}
      <div style={{position: 'absolute', left: w / 2 - 9 * u, top: lineY - 9 * u, width: 18 * u, height: 18 * u, borderRadius: '50%', background: '#FFFFFF', opacity: (1 - zoom) * ease((t - startDelay) / .2), zIndex: 5}} />
    </AbsoluteFill>
  </AbsoluteFill>;
}

// Fundos HQ v2 — implementação embutida para manter cada TSX independente.
type HQBackgroundOptions = {
  backgroundStyle?: 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
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
