import React from 'react';
import {AbsoluteFill, Img, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Node = {id:string; text?:string; asset?:string; x?:number; y?:number; color?:string};
type Step = {node:string; from?:string; hold:number; moveDuration?:number; connect?:boolean};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; nodes:Node[]; steps:Step[]; backgroundColor?:string; cardColor?:string; textColor?:string;
  lineColor?:string; zoomOutDuration?:number; assets?:Record<string,string>};
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export function buildTimeline(nodes:Node[], steps:Step[], zoomOutDuration:number) {
  if(!nodes.length || !steps.length) throw new Error('Informe nodes e steps.');
  const ids=new Set(nodes.map(n=>n.id));
  if(ids.size!==nodes.length || nodes.some(n=>!n.id || (!n.text?.trim()&&!n.asset))) throw new Error('Cada nó precisa de id único e texto ou imagem.');
  nodes.forEach(n=>{if((n.x===undefined)!==(n.y===undefined) || (n.x!==undefined&&(!Number.isFinite(n.x)||!Number.isFinite(n.y))))throw new Error('Informe x e y juntos, em coordenadas finitas.');});
  let cursor=0;const seen=new Set<string>();
  const result=steps.map((s,i)=>{
    const move=i===0?0:(s.moveDuration??.85);
    if(!ids.has(s.node)||!Number.isFinite(s.hold)||s.hold<=0||!Number.isFinite(move)||move<0)throw new Error('Etapas precisam de nó existente, hold positivo e moveDuration não negativo.');
    const from=i===0?undefined:(s.from??steps[i-1].node);
    if(from&&!seen.has(from))throw new Error('from deve apontar para um nó já apresentado.');
    const start=cursor,arrival=start+move;cursor=arrival+s.hold;seen.add(s.node);
    return {...s,from,start,arrival,end:cursor,move};
  });
  if(seen.size!==nodes.length)throw new Error('Todos os nós precisam ser visitados em steps.');
  if(!Number.isFinite(zoomOutDuration)||zoomOutDuration<=0)throw new Error('zoomOutDuration deve ser positivo.');
  return {steps:result,overviewAt:cursor,minimumDuration:cursor+zoomOutDuration};
}

export default function BrainstormHQ({fontFamily="Bangers", backgroundStyle="halftone", backgroundOpacity=100, paperTone="light", gridBackgroundColor="#10101A", gridLineColor="#858595", nodes,steps,backgroundColor='#18243C',cardColor='#FFF5D7',textColor='#FFFFFF',lineColor='#FF435A',zoomOutDuration=1.4,assets={}}:Props){
  const fontUrl=resolveHQFont(fontFamily,assets);
  const {width:w,height:h,fps,durationInFrames}=useVideoConfig();const t=useCurrentFrame()/fps;
  const timeline=buildTimeline(nodes,steps,zoomOutDuration);
  if(timeline.minimumDuration>durationInFrames/fps+1e-6)throw new Error(`Cena curta: mínimo ${timeline.minimumDuration.toFixed(2)}s; reserve também tempo para contemplar o mapa.`);
  if(!fontUrl)throw new Error('Informe fontUrl.');
  const [ready,setReady]=React.useState(false);
  const [handle]=React.useState(()=>delayRender('Carregando Bangers'));
  React.useEffect(()=>{loadFont({family:fontFamily,url:fontUrl}).then(()=>{setReady(true);continueRender(handle);}).catch(cancelRender);},[fontUrl,fontFamily,handle]);
  const portrait=h>w;
  const boxes=nodes.map((n,i)=>({...n,x:n.x??(portrait?(i%2)*580:(i%3)*580),y:n.y??(portrait?Math.floor(i/2)*490:Math.floor(i/3)*490),width:400,height:n.asset?(n.text?390:330):210}));
  const box=(id:string)=>boxes.find(n=>n.id===id)!;
  const fit=(n:typeof boxes[number])=>Math.min(w*.76/n.width,h*.74/n.height);
  const bounds={left:Math.min(...boxes.map(n=>n.x-225)),right:Math.max(...boxes.map(n=>n.x+225)),top:Math.min(...boxes.map(n=>n.y-n.height/2-30)),bottom:Math.max(...boxes.map(n=>n.y+n.height/2+30))};
  const first=box(steps[0].node);let cx=first.x,cy=first.y,scale=fit(first);
  timeline.steps.forEach((s,i)=>{if(!i||t<s.start)return;const a=box(steps[i-1].node),b=box(s.node),p=s.move===0?1:smooth((t-s.start)/s.move);cx=a.x+(b.x-a.x)*p;cy=a.y+(b.y-a.y)*p;scale=fit(a)+(fit(b)-fit(a))*p;});
  if(t>=timeline.overviewAt){const p=smooth((t-timeline.overviewAt)/zoomOutDuration);cx+=((bounds.left+bounds.right)/2-cx)*p;cy+=((bounds.top+bounds.bottom)/2-cy)*p;scale+=(Math.min(w*.88/(bounds.right-bounds.left),h*.84/(bounds.bottom-bounds.top))-scale)*p;}
  const uid=React.useId().replace(/:/g,'');
  return <AbsoluteFill style={{overflow:'hidden',fontFamily:fontFamily}}>
    <HQBackground {...{backgroundStyle,backgroundColor,backgroundOpacity,paperTone,gridBackgroundColor,gridLineColor}}>
      <AbsoluteFill style={{opacity:.15,backgroundImage:'radial-gradient(#FFFFFF 1.6px, transparent 2px)',backgroundSize:'12px 12px'}}/>
    </HQBackground>
    <div style={{position:'absolute',left:0,top:0,transformOrigin:'0 0',transform:`translate(${w/2}px,${h/2}px) scale(${scale}) translate(${-cx}px,${-cy}px)`}}>
      <svg style={{position:'absolute',overflow:'visible',width:1,height:1}}>
        {timeline.steps.map((s,i)=>{if(!i||s.connect===false||t<s.start||s.from===s.node)return null;const a=box(s.from!),b=box(s.node);const p=s.move===0?1:smooth((t-s.start)/s.move);const d=`M ${a.x} ${a.y} C ${a.x+(b.x-a.x)*.5} ${a.y}, ${a.x+(b.x-a.x)*.5} ${b.y}, ${b.x} ${b.y}`;return <g key={i}><defs><mask id={`${uid}-${i}`} maskUnits="userSpaceOnUse" x={Math.min(a.x,b.x)-500} y={Math.min(a.y,b.y)-500} width={Math.abs(a.x-b.x)+1000} height={Math.abs(a.y-b.y)+1000}><path d={d} fill="none" stroke="white" strokeWidth={22} pathLength={1} strokeDasharray="1" strokeDashoffset={1-p}/></mask></defs><path d={d} fill="none" stroke="#080A10" strokeWidth={13} mask={`url(#${uid}-${i})`}/><path d={d} fill="none" stroke={lineColor} strokeWidth={7} strokeDasharray="17 12" mask={`url(#${uid}-${i})`}/></g>;})}
      </svg>
      {boxes.map(n=>{const debut=timeline.steps.find(s=>s.node===n.id)!;if(t<debut.start)return null;const p=debut.move===0?1:smooth((t-debut.start)/Math.max(.15,debut.move));const color=n.color??cardColor;if(n.asset&&!assets[n.asset])throw new Error(`Asset ausente: ${n.asset}`);return <div key={n.id} style={{position:'absolute',left:n.x-200,top:n.y-n.height/2,width:400,height:n.height,boxSizing:'border-box',border:'6px solid #080A10',background:color,boxShadow:'12px 14px 0 #080A10',opacity:p,transform:`scale(${.86+.14*p})`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:22,gap:16}}>
        {n.asset&&<Img src={assets[n.asset]} style={{width:'100%',height:n.text?245:270,objectFit:'contain',minHeight:0}}/>}
        {n.text&&<div style={{color:textColor,fontSize:Math.min(55,220/Math.sqrt(Math.max(1,n.text.length/4))),textTransform:'uppercase',textAlign:'center',lineHeight:1.1,overflowWrap:'anywhere',textShadow:fontFamily === 'Anton' ? 'none' : '3px 4px 0 #080A10',WebkitTextStroke:fontFamily === 'Anton' ? '0px transparent' : '.7px #080A10',opacity:ready?1:0}}>{n.text}</div>}
      </div>;})}
    </div>
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
