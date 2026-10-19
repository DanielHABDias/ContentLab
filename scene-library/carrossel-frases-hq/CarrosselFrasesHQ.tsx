import {HQComicPage, type HQComicPageOptions} from './HQComicPage';
import React from 'react';
import {AbsoluteFill,cancelRender,continueRender,delayRender,useCurrentFrame,useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Phrase={text:string;at:number;color?:string};
type Props=HQBackgroundOptions & {phrases:Phrase[];fontFamily?:HQFont;align?:'left'|'right';
  activeColor?:string;inactiveColor?:string;inactiveOpacity?:number;inactiveScale?:number;
  activeBandColor?:string;activeBandOpacity?:number;
  motionDuration?:number;textScale?:number;assets?:{bangers?:string;anton?:string}};
type Layout={lines:string[];size:number;height:number};
const clampCarousel=(v:number)=>Math.max(0,Math.min(1,v));
const smoothCarousel=(v:number)=>{const t=clampCarousel(v);return t*t*(3-2*t);};

export function validateCarousel(phrases:Phrase[],duration:number,motionDuration:number){
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Duração da cena deve ser positiva.');
  if(!Number.isFinite(motionDuration)||motionDuration<0)throw new Error('motionDuration deve ser não negativo.');
  if(!Array.isArray(phrases)||!phrases.length)throw new Error('Informe phrases com pelo menos uma frase.');
  phrases.forEach((p,i)=>{
    if(typeof p.text!=='string'||!p.text.trim()||!Number.isFinite(p.at)||p.at<0||p.at>=duration)throw new Error('Frase precisa de text e at dentro da cena.');
    if(i&&p.at<=phrases[i-1].at)throw new Error('at deve ser estritamente crescente.');
    if(i&&p.at-phrases[i-1].at<motionDuration-1e-7)throw new Error('Intervalo entre chegadas deve ser >= motionDuration.');
    if(!i&&p.at>0&&p.at<motionDuration-1e-7)throw new Error('Primeiro at deve ser 0 ou >= motionDuration.');
    if(p.color&&!/^#[a-f\d]{6}$/i.test(p.color))throw new Error('Cor da frase deve usar #RRGGBB.');
  });
}

// at is ARRIVAL, not the start of the transition: words are ready when spoken.
export function carouselPosition(phrases:Phrase[],time:number,motionDuration:number){
  let current=-1;
  for(let i=0;i<phrases.length;i++){
    const at=phrases[i].at;
    if(time>=at){current=i;continue;}
    if(motionDuration>0&&time>=at-motionDuration)return i-1+smoothCarousel((time-at+motionDuration)/motionDuration);
    break;
  }
  return current;
}

export function carouselTextLayout(ctx:CanvasRenderingContext2D,text:string,family:HQFont,width:number,height:number,maximum:number):Layout{
  const wrap=(size:number)=>{
    ctx.font=`${size}px ${family}`;const lines:string[]=[];
    for(const paragraph of text.normalize('NFC').toLocaleUpperCase('pt-BR').split('\n')){
      let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){
        if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;
      }lines.push(line);
    }return lines;
  };
  let lo=1,hi=maximum;
  for(let i=0;i<20;i++){const size=(lo+hi)/2,lines=wrap(size);if(lines.length<=2&&lines.length*size*1.12<=height&&lines.every(l=>ctx.measureText(l).width<=width))lo=size;else hi=size;}
  const lines=wrap(lo);if(lines.length>2)throw new Error('Use frases curtas: no máximo duas linhas por frase.');
  return {lines,size:lo,height:lines.length*lo*1.12};
}

export default function CarrosselFrasesHQ({phrases,fontFamily='Bangers',align='left',activeColor='#F4C542',inactiveColor='#9698A2',inactiveOpacity=.38,inactiveScale=.60,
  activeBandColor='#A0A0A0',activeBandOpacity=.12,motionDuration=.45,textScale=1,backgroundStyle='halftone',backgroundColor='#10131E',backgroundOpacity=100,paperTone='light',gridBackgroundColor='#10101A',gridLineColor='#858595',assets={}}:Props){
  const {width:w,height:h,fps,durationInFrames}=useVideoConfig(),frame=useCurrentFrame();
  validateCarousel(phrases,durationInFrames/fps,motionDuration);
  if(!['left','right'].includes(align))throw new Error('align: left ou right.');
  if(![activeColor,inactiveColor].every(c=>/^#[a-f\d]{6}$/i.test(c)))throw new Error('Cores devem usar #RRGGBB.');
  if(!/^#[a-f\d]{6}$/i.test(activeBandColor))throw new Error('activeBandColor deve usar #RRGGBB.');
  if(!Number.isFinite(activeBandOpacity)||activeBandOpacity<0||activeBandOpacity>1)throw new Error('activeBandOpacity: 0–1.');
  if(!Number.isFinite(inactiveOpacity)||inactiveOpacity<0||inactiveOpacity>1)throw new Error('inactiveOpacity: 0–1.');
  if(!Number.isFinite(inactiveScale)||inactiveScale<.3||inactiveScale>.85)throw new Error('inactiveScale: 0.3–0.85.');
  if(!Number.isFinite(textScale)||textScale<.25||textScale>1)throw new Error('textScale: 0.25–1.');
  const url=resolveHQFont(fontFamily,assets),textW=w*.84,maximum=Math.min(h*.20,w*.19)*textScale;
  const [prepared,setPrepared]=React.useState<{signature:string;layouts:Layout[]}|null>(null);
  const [handle]=React.useState(()=>delayRender('Preparando Carrossel de Frases HQ'));
  const signature=JSON.stringify({phrases,fontFamily,url,w,h,textScale});
  React.useEffect(()=>{let live=true;loadFont({family:fontFamily,url}).then(()=>{
    const ctx=document.createElement('canvas').getContext('2d');if(!ctx)throw new Error('Canvas indisponível.');
    const layouts=phrases.map(p=>carouselTextLayout(ctx,p.text,fontFamily,textW,h*.24,maximum));
    if(live)setPrepared({signature,layouts});continueRender(handle);
  }).catch(cancelRender);return()=>{live=false;};},[signature,handle]);
  const cursor=carouselPosition(phrases,frame/fps,motionDuration);
  const blendColor=(from:string,to:string,p:number)=>{const a=from.slice(1).match(/../g)!.map(x=>parseInt(x,16)),b=to.slice(1).match(/../g)!.map(x=>parseInt(x,16));return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*p)).join(',')})`;};
  return <AbsoluteFill style={{overflow:'hidden',pointerEvents:'none'}}>
    <HQBackground backgroundStyle={backgroundStyle} backgroundColor={backgroundColor} backgroundOpacity={backgroundOpacity} paperTone={paperTone} gridBackgroundColor={gridBackgroundColor} gridLineColor={gridLineColor}/>
    <div data-active-band style={{position:'absolute',left:0,top:h*.36,width:w,height:h*.28,backgroundColor:activeBandColor,opacity:activeBandOpacity}}/>
    {prepared?.signature===signature&&phrases.map((phrase,i)=>{
      const slot=i-cursor;if(slot>2||slot< -2)return null;
      const layout=prepared.layouts[i],focus=clampCarousel(1-Math.abs(slot)),scale=inactiveScale+(1-inactiveScale)*focus;
      const gap=h*.045,smallH=layout.height*inactiveScale;
      const yAt=(n:number)=>n>=2?-smallH:n===1?h/3-gap-smallH/2:n===0?h/2:n===-1?2*h/3+gap+smallH/2:h+smallH;
      const lower=Math.floor(slot),mix=slot-lower,cy=yAt(lower)+(yAt(lower+1)-yAt(lower))*mix;
      const edge=clampCarousel(2-Math.abs(slot)),opacity=(inactiveOpacity+(1-inactiveOpacity)*focus)*edge;
      const ink=blendColor(inactiveColor,phrase.color??activeColor,focus);
      return <div key={i} data-phrase={i} style={{position:'absolute',left:w*.08,top:cy-layout.height/2,width:textW,height:layout.height,
        scale,transformOrigin:align==='left'?'left center':'right center',fontFamily,fontSize:layout.size,lineHeight:1.12,
        textAlign:align,color:ink,opacity,whiteSpace:'pre',textShadow:fontFamily==='Anton'?'none':`0 ${Math.min(w,h)*.005}px 0 #080A11`,
        WebkitTextStroke:fontFamily==='Anton'?undefined:`${Math.min(w,h)*.0012}px #080A11`,paintOrder:'stroke fill'}}>{layout.lines.join('\n')}</div>;
    })}
  </AbsoluteFill>;
}

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
  if(backgroundStyle==='halftone'||backgroundStyle==='solid'){
    const step=Math.min(width,height)*.018,dot=Math.min(width,height)*.003;
    return <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{position:'absolute',inset:0,pointerEvents:'none',opacity:backgroundOpacity/100}}>
      <defs><pattern id={`${uid}print`} width={step} height={step} patternUnits="userSpaceOnUse"><circle cx={step/2} cy={step/2} r={dot} fill="#080A11" opacity=".24"/></pattern></defs>
      <rect width={width} height={height} fill={backgroundColor}/>
      {backgroundStyle==='halftone'&&<rect width={width} height={height} fill={`url(#${uid}print)`}/>}
    </svg>;
  }
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
