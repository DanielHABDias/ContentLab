import React from 'react';
import {
  AbsoluteFill, Freeze, Img, OffthreadVideo, cancelRender, continueRender, delayRender,
  interpolateColors, useCurrentFrame, useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Panel = {asset: string; label?: string; sourceStart?: number; crt?: boolean; mediaType?:'video'|'image'; fit?:'cover'|'contain'; at?:number; accentColor?:string; backgroundColor?:string};
type Focus = {panel: number; at: number; until: number};
type Entry = {panel: number; at: number; duration?: number};
type Props = HQBackgroundOptions & {fontFamily?: HQFont;
  panels: Panel[];
  focus: Focus[];
  enter?: Entry;
  backgroundColor?: string;
  accentColor?: string;
  panelLayout?: 'grid'|'asymmetric'|'split'|'parallax';
  parallaxDuration?:number;
  splitColors?: [string,string];
  dividerColor?:string;
  heading?:string;
  headingColor?:string;
  entryDuration?:number;
  assets?: Record<string, string>;
};
type Interval = {at: number; until: number};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {const t = clamp(n); return t * t * (3 - 2 * t);};
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

// Playback advances only during this panel's active intervals, then freezes in place.
export function intervalsFor(panel: number, focus: Focus[], enter: Entry | undefined, end: number): Interval[] {
  const intervals = focus.filter(cue => cue.panel === panel).map(cue => ({
    at: cue.at, until: Math.min(cue.until, enter?.at ?? end, end),
  })).filter(cue => cue.until > cue.at);
  if (enter?.panel === panel) intervals.push({at: enter.at, until: end});
  intervals.sort((a, b) => a.at - b.at);
  const merged: Interval[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval.at <= last.until) last.until = Math.max(last.until, interval.until);
    else merged.push({...interval});
  }
  return merged;
}

function TileVideo({src, sourceStart, elapsed, crt, unit,fit='cover'}: {
  src: string; sourceStart: number; elapsed: number; crt: boolean; unit: number;fit?:'cover'|'contain';
}) {
  const {fps} = useVideoConfig();
  return <>
    <Freeze frame={Math.round(elapsed * fps)}>
      <OffthreadVideo src={src} muted trimBefore={Math.round(sourceStart * fps)}
        style={{position: 'absolute', width: '100%', height: '100%', objectFit: fit, objectPosition: 'center'}} />
    </Freeze>
    {crt && <AbsoluteFill style={{pointerEvents: 'none',
      backgroundImage: `radial-gradient(circle at center, transparent 45%, #0006 100%), repeating-linear-gradient(to bottom, #0004 0px, #0004 ${unit}px, #FFFFFF08 ${2 * unit}px, transparent ${4 * unit}px)`,
      backgroundSize: `100% 100%, 100% ${4 * unit}px`}} />}
  </>;
}

export function parallaxCamera(time:number,focus:Focus[],duration:number){
  let position=0;
  for(const cue of focus){if(time<cue.at)break;const next=cue.panel-1;position=mix(position,next,ease((time-cue.at)/duration));}
  return position;
}
export function panelGeometry(w:number,h:number,layout:'grid'|'asymmetric'|'split'|'parallax',index:number){
  if(layout==='parallax')return {x:w*(w>h?.21:.14),y:h*(w>h?.24:.30),width:w*(w>h?.58:.72),height:h*(w>h?.60:.40),angle:0};
  if(layout==='split')return w>h?{x:w*(index===0?.055:.555),y:h*.28,width:w*.39,height:h*.57,angle:index===0?-1:1}:{x:w*.10,y:h*(index===0?.16:.59),width:w*.80,height:h*.29,angle:index===0?-1:1};
  if(layout==='asymmetric')return w>h?(index===0?{x:w*.07,y:h*.23,width:w*.57,height:h*.64,angle:-2}:{x:w*.68,y:h*.32,width:w*.25,height:h*.48,angle:2}):(index===0?{x:w*.08,y:h*.16,width:w*.84,height:h*.37,angle:-1.4}:{x:w*.20,y:h*.59,width:w*.72,height:h*.27,angle:1.8});
  const horizontal=w>h,tileH=h*(horizontal?.36:.38),yTop=h*(horizontal?.10:.09),yGap=h*(horizontal?.055:.04);
  return {x:w*(.055+(index%2)*.46),y:yTop+Math.floor(index/2)*(tileH+yGap),width:w*.43,height:tileH,angle:0};
}
export function validatePanelLayout(panels:Panel[],layout:string,duration:number,entryDuration:number,heading:string){
  if(!['grid','asymmetric','split','parallax'].includes(layout))throw new Error('panelLayout: grid, asymmetric, split ou parallax.');
  const count=layout==='grid'?4:2;
  if(!Array.isArray(panels)||(layout==='parallax'?(panels.length<2||panels.length>4):panels.length!==count))throw new Error(`panelLayout ${layout} requer ${layout==='parallax'?'2 a 4':count} panels.`);
  if(typeof heading!=='string'||heading.length>80)throw new Error('heading: texto com até 80 caracteres.');
  if(layout!=='grid'&&(!Number.isFinite(entryDuration)||entryDuration<=0||entryDuration>duration))throw new Error('entryDuration deve ser positiva e caber na cena.');
  panels.forEach((p,i)=>{
    if(!['video','image'].includes(p.mediaType??'video'))throw new Error('mediaType: video ou image.');
    if(!['cover','contain'].includes(p.fit??'cover'))throw new Error('fit: cover ou contain.');
    if(p.accentColor&&!/^#[a-f\d]{6}$/i.test(p.accentColor))throw new Error('accentColor do painel: #RRGGBB.');
    if(p.backgroundColor&&!/^#[a-f\d]{6}$/i.test(p.backgroundColor))throw new Error('backgroundColor do painel: #RRGGBB.');
    if(layout!=='grid'){const at=p.at??i*.55;if(!Number.isFinite(at)||at<0||at+entryDuration>duration+1e-8)throw new Error('Entrada do painel precisa caber na cena.');}
  });
}

export default function PaginaHQCenas({fontFamily="Bangers", backgroundStyle="halftone", backgroundOpacity=100, paperTone="light", gridBackgroundColor="#10101A", gridLineColor="#858595", panels, focus, enter, backgroundColor = '#E8C64F', accentColor = '#2676E8', panelLayout='grid',parallaxDuration=.65,splitColors=['#D92F45','#2459C9'],dividerColor='#111723',heading='',headingColor='#111723',entryDuration=.55,assets = {}}: Props) {
  const fontUrl=panels?.some(p=>p.label)||(panelLayout!=='grid'&&heading)?resolveHQFont(fontFamily,assets):'';
  const {width: w, height: h, fps, durationInFrames} = useVideoConfig();
  const frame = useCurrentFrame();
  const time = frame / fps;
  const duration = durationInFrames / fps;
  const horizontal = w > h;
  const unit = Math.min(w, h) / 1080;
  validatePanelLayout(panels,panelLayout,duration,entryDuration,heading);
  const panelCount=panels.length,asymmetric=panelLayout!=='grid',split=panelLayout==='split',parallax=panelLayout==='parallax';
  if(parallax&&(!Number.isFinite(parallaxDuration)||parallaxDuration<=0||parallaxDuration>duration))throw new Error('parallaxDuration deve ser positiva e caber na cena.');
  if(split&&(!Array.isArray(splitColors)||splitColors.length!==2||!splitColors.every(c=>/^#[a-f\d]{6}$/i.test(c))||!/^#[a-f\d]{6}$/i.test(dividerColor)))throw new Error('splitColors: duas cores #RRGGBB; dividerColor: #RRGGBB.');
  if (!Array.isArray(focus)) throw new Error('PaginaHQCenas requer focus com os tempos de destaque.');
  if (!/^#[0-9a-fA-F]{6}$/.test(backgroundColor) || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
    throw new Error('As cores devem usar #RRGGBB.');
  }
  const ordered = [...focus].sort((a, b) => a.at - b.at);
  ordered.forEach((cue, index) => {
    if (!Number.isInteger(cue.panel) || cue.panel < 1 || cue.panel > panelCount || !Number.isFinite(cue.at) || !Number.isFinite(cue.until) || cue.at < 0 || cue.until <= cue.at || cue.until > duration + 1 / fps) {
      throw new Error(`focus requer panel de 1 a ${panelCount} e at/until válidos dentro da cena.`);
    }
    if (index && cue.at < ordered[index - 1].until) throw new Error('Os intervalos de focus não podem se sobrepor.');
    if(parallax&&cue.until-cue.at<parallaxDuration-1e-8)throw new Error('Cada focus deve durar ao menos parallaxDuration.');
  });
  if (enter && (!Number.isInteger(enter.panel) || enter.panel < 1 || enter.panel > panelCount || !Number.isFinite(enter.at) || enter.at < 0 || !Number.isFinite(enter.duration ?? 1.1) || (enter.duration ?? 1.1) <= 0 || enter.at + (enter.duration ?? 1.1) > duration + 1 / fps)) {
    throw new Error(`enter deve apontar para panel de 1 a ${panelCount} e terminar dentro da cena.`);
  }
  panels.forEach(panel => {
    if (!assets[panel.asset]) throw new Error(`Asset ausente: ${panel.asset}`);
    if (!Number.isFinite(panel.sourceStart ?? 0) || (panel.sourceStart ?? 0) < 0) throw new Error('sourceStart deve ser um tempo positivo ou zero.');
  });
  if(!/^#[a-f\d]{6}$/i.test(headingColor))throw new Error('headingColor: #RRGGBB.');
  const labels = panels.some(panel => panel.label)||(asymmetric&&Boolean(heading));
  if (labels && !fontUrl) throw new Error('Informe fontUrl para usar etiquetas nos quadros.');
  const [fontHandle] = React.useState(() => labels ? delayRender('Carregando etiquetas da página HQ') : null);
  React.useEffect(() => {
    if (fontHandle === null) return;
    loadFont({family: fontFamily, url: fontUrl})
      .then(() => continueRender(fontHandle)).catch(error => cancelRender(error));
  }, [fontHandle, fontUrl, fontFamily]);

  const zoom = enter ? ease((time - enter.at) / (enter.duration ?? 1.1)) : 0;
  const drift = 1 - zoom;
  const boardX = Math.sin(time * .7) * w * .003 * drift;
  const boardY = Math.sin(time * .9 + .4) * h * .004 * drift;
  const boardAngle = Math.sin(time * .6) * .25 * drift;
  const target = enter && time >= enter.at ? enter.panel : null;
  const camera=parallax?parallaxCamera(Math.min(time,enter?.at??duration),ordered,parallaxDuration):0;

  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <HQBackground {...{backgroundStyle,backgroundColor,backgroundOpacity,paperTone,gridBackgroundColor,gridLineColor}}>
      <AbsoluteFill style={{opacity: .23 * (1 - zoom), backgroundImage: `radial-gradient(#080A11 ${3 * unit}px, transparent ${3.7 * unit}px)`,
      backgroundSize: `${19 * unit}px ${19 * unit}px`}} />
    </HQBackground>
    {split&&<AbsoluteFill style={{pointerEvents:'none',opacity:backgroundOpacity/100*(1-zoom)}}>
      {splitColors.map((color,i)=>{const reveal=ease((time-(panels[i].at??i*.55))/entryDuration);return <div key={i} style={{position:'absolute',left:horizontal?`${i*50}%`:0,top:horizontal?0:`${i*50}%`,width:horizontal?'50%':'100%',height:horizontal?'100%':'50%',backgroundColor:color,backgroundImage:`radial-gradient(#080A1138 ${3*unit}px, transparent ${3.7*unit}px)`,backgroundSize:`${19*unit}px ${19*unit}px`,clipPath:horizontal?`inset(0 ${i===0?(1-reveal)*100:0}% 0 ${i===1?(1-reveal)*100:0}%)`:`inset(${i===1?(1-reveal)*100:0}% 0 ${i===0?(1-reveal)*100:0}% 0)`}}/>;})}
      <div style={{position:'absolute',left:horizontal?'calc(50% - 4px)':'5%',top:horizontal?'22%':'calc(50% - 4px)',width:horizontal?8*unit:'90%',height:horizontal?'70%':8*unit,background:dividerColor,transformOrigin:horizontal?'top':'left',transform: `${horizontal?'scaleY':'scaleX'}(${ease((time-Math.max(...panels.map((p,i)=>(p.at??i*.55)+entryDuration)))/.35)})`}}/>
    </AbsoluteFill>}
    <AbsoluteFill style={{translate: `${boardX}px ${boardY}px`, rotate: `${boardAngle}deg`}}>
      {panels.map((panel, index) => {
        const number = index + 1;
        const ranges = intervalsFor(number, ordered, enter, duration);
        const elapsed = ranges.reduce((sum, range) => sum + Math.max(0, Math.min(time, range.until) - range.at), 0);
        const active = ranges.find(range => range.at <= time && time < range.until);
        const previous = ranges.filter(range => range.until <= time).at(-1);
        const light = asymmetric&&ordered.length===0&&!enter?1:active ? ease((time - active.at) / .24) : previous ? 1 - ease((time - previous.until) / .24) : 0;
        const selected = target === number;
        const expand = selected ? zoom : 0;
        const base=panelGeometry(w,h,panelLayout,index),relative=index-camera,depth=Math.min(3,Math.abs(relative));
        const layerScale=parallax?1-depth*.12:1;
        const tileW=base.width*layerScale,tileH=base.height*layerScale;
        const x=parallax?base.x+(base.width-tileW)/2+relative*w*.18:base.x;
        const y=parallax?base.y+(base.height-tileH)/2+depth*h*.025:base.y;
        const angle=parallax?relative*4:base.angle;
        const border = 8 * unit * (1 - expand);
        const arrival = asymmetric?ease((time-(panel.at??index*.55))/entryDuration):ease(time / .38);
        return <div key={number} style={{position: 'absolute', left: mix(x, 0, expand), top: mix(y, 0, expand),
          width: mix(tileW, w, expand), height: mix(tileH, h, expand), zIndex: selected ? 200 : parallax?100-Math.round(depth*20):active ? 3 : 1,
          boxSizing: 'border-box', overflow: 'hidden', border: `${border}px solid ${interpolateColors(light, [0, 1], ['#F5EFDE', asymmetric?(panel.accentColor??accentColor):accentColor])}`,
          background: asymmetric?(panel.backgroundColor??'#F5EFDE'):'#080A11', opacity: selected ? arrival : arrival * (1 - zoom),
          boxShadow: `${10 * unit * (1 - expand)}px ${13 * unit * (1 - expand)}px 0 #080A11`,
          translate: split?`${horizontal?(index===0?-1:1)*(1-arrival)*w*.20:0}px ${horizontal?0:(index===0?-1:1)*(1-arrival)*h*.18}px`:`0 ${(1 - arrival) * (asymmetric?90:35) * unit}px`,rotate:asymmetric?`${angle*(1-expand)}deg`:undefined}}>
          <AbsoluteFill style={{filter: `grayscale(${1 - light}) brightness(${.26 + .74 * light})`}}>
            {panel.mediaType==='image'?<><Img src={assets[panel.asset]} style={{position:'absolute',width:'100%',height:'100%',objectFit:panel.fit??'cover'}}/>{panel.crt&&<AbsoluteFill style={{pointerEvents:'none',backgroundImage:`repeating-linear-gradient(to bottom, #0004 0px, #0004 ${unit}px, transparent ${4*unit}px)`}}/>}</>:<TileVideo src={assets[panel.asset]} sourceStart={panel.sourceStart ?? 0} elapsed={elapsed} crt={panel.crt ?? false} unit={unit} fit={panel.fit}/>}
          </AbsoluteFill>
          {panel.label && <div style={{position: 'absolute', left: 16 * unit, bottom: 13 * unit,
            padding: `${7 * unit}px ${14 * unit}px`, background: '#080A11', color: '#FFFFFF',
            fontFamily: fontFamily, fontSize: asymmetric?Math.min((horizontal?46:44)*unit,tileW*.82/Math.max(1,panel.label.length*.58)):(horizontal ? 36 : 31) * unit,
            opacity: (1 - expand) * (.45 + .55 * light)}}>{panel.label.toLocaleUpperCase('pt-BR')}</div>}
        </div>;
      })}
    </AbsoluteFill>
    {asymmetric&&heading&&<div style={{position:'absolute',left:w*.08,right:w*.08,top:h*.06,color:headingColor,fontFamily,fontSize:Math.min(58*unit,w*.82/Math.max(1,heading.length*.58)),textTransform:'uppercase',lineHeight:1.15,borderBottom:`${5*unit}px solid ${accentColor}`,paddingBottom:14*unit,opacity:1-zoom}}>{heading}</div>}
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
