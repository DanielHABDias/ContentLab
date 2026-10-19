import {HQComicPage, type HQComicPageOptions} from './HQComicPage';
import React from 'react';
import {AbsoluteFill,Img,cancelRender,continueRender,delayRender,useCurrentFrame,useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Speaker='left'|'right';
type Participant={asset:string;name?:string;color?:string;scale?:number};
type Turn={speaker:Speaker;text:string;at:number;duration:number;animation?:'escrita'|'none';writeDuration?:number;textDelay?:number;textColor?:string};
type Props=HQBackgroundOptions & {left:Participant;right:Participant;turns:Turn[];fontFamily?:HQFont;
  textColor?:string;motionDuration?:number;highlightOpacity?:number;assets?:Record<string,string>};
type Bounds={x:number;y:number;width:number;height:number;sourceWidth:number;sourceHeight:number};
type TextLayout={lines:string[];size:number};
const clampDialogue=(x:number)=>Math.max(0,Math.min(1,x));
const easeDialogue=(x:number)=>{const p=clampDialogue(x);return p*p*(3-2*p);};

export function validateDialogue(turns:Turn[],duration:number,motionDuration:number){
  if(!Array.isArray(turns)||!turns.length)throw new Error('Informe turns com pelo menos uma fala.');
  if(!Number.isFinite(motionDuration)||motionDuration<0)throw new Error('motionDuration deve ser não negativo.');
  turns.forEach((turn,i)=>{
    if(!['left','right'].includes(turn.speaker)||!turn.text?.trim()||!Number.isFinite(turn.at)||turn.at<0||!Number.isFinite(turn.duration)||turn.duration<=0||turn.at+turn.duration>duration+1e-7||
      (i>0&&turn.at<turns[i-1].at+turns[i-1].duration-1e-7))throw new Error('Falas: speaker left/right, text, at/duration dentro da cena, ordenados e sem sobreposição.');
    if(!['escrita','none'].includes(turn.animation??'escrita'))throw new Error('animation deve ser escrita ou none.');
    const delay=turn.textDelay??0,write=turn.writeDuration??Math.min(1.2,Math.max(.01,(turn.duration-delay)*.55));
    if(!Number.isFinite(delay)||delay<0||delay>=turn.duration||!Number.isFinite(write)||write<=0||((turn.animation??'escrita')==='escrita'&&delay+write>turn.duration+1e-7))throw new Error('textDelay e writeDuration precisam caber na fala.');
    if(turn.textColor&&!/^#[a-f\d]{6}$/i.test(turn.textColor))throw new Error('textColor deve usar #RRGGBB.');
  });
}
export function dialogueWeights(turns:Turn[],time:number,motionDuration:number){
  const events=turns.flatMap(turn=>[{at:turn.at,order:1,left:turn.speaker==='left'?1:0,right:turn.speaker==='right'?1:0},{at:turn.at+turn.duration,order:0,left:0,right:0}]).sort((a,b)=>a.at-b.at||a.order-b.order);
  let origin={left:0,right:0},target={left:0,right:0},start=0;
  const sample=(at:number)=>{const p=motionDuration===0?1:easeDialogue((at-start)/motionDuration);return {left:origin.left+(target.left-origin.left)*p,right:origin.right+(target.right-origin.right)*p};};
  for(const event of events){if(event.at>time)break;origin=sample(event.at);target={left:event.left,right:event.right};start=event.at;}
  return sample(time);
}
export function dialogueTurnIndex(turns:Turn[],frame:number,fps:number){
  return turns.findIndex(turn=>frame>=Math.ceil(turn.at*fps-1e-8)&&frame<Math.ceil((turn.at+turn.duration)*fps-1e-8));
}
async function dialogueImageBounds(src:string):Promise<Bounds>{
  const image=new Image();image.crossOrigin='anonymous';
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Falha ao carregar participante: '+src));image.src=src;});
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas indisponível.');ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>12){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(x1<0)throw new Error('Imagem do participante totalmente transparente.');
  return {x:x0,y:y0,width:x1-x0+1,height:y1-y0+1,sourceWidth:canvas.width,sourceHeight:canvas.height};
}
function dialogueTextLayout(text:string,family:HQFont,width:number,height:number,maximum:number):TextLayout{
  const ctx=document.createElement('canvas').getContext('2d');if(!ctx)throw new Error('Canvas indisponível.');
  const wrap=(size:number)=>{ctx.font=`${size}px ${family}`;const lines:string[]=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);}return lines;};
  let low=1,high=maximum;for(let i=0;i<18;i++){const size=(low+high)/2,lines=wrap(size);if(lines.length*size*1.15<=height&&lines.every(line=>ctx.measureText(line).width<=width))low=size;else high=size;}
  return {lines:wrap(low),size:low};
}

export default function DialogoHQ({left,right,turns,fontFamily='Bangers',textColor='#FFFFFF',motionDuration=.45,highlightOpacity=85,
  backgroundStyle='halftone',backgroundColor='#10131E',backgroundOpacity=100,paperTone='light',gridBackgroundColor='#10101A',gridLineColor='#858595',assets={}}:Props){
  const {width:w,height:h,fps,durationInFrames}=useVideoConfig();const frame=useCurrentFrame(),time=frame/fps,portrait=h>w,u=Math.min(w,h)/1080;
  validateDialogue(turns,durationInFrames/fps,motionDuration);const fontUrl=resolveHQFont(fontFamily,assets);
  if(!left?.asset||!right?.asset||!assets[left.asset]||!assets[right.asset])throw new Error('Informe left/right.asset e os arquivos em customComponent.assets.');
  const colors=[left.color??'#2676E8',right.color??'#EF3F49'];
  if(![...colors,textColor].every(c=>/^#[a-f\d]{6}$/i.test(c)))throw new Error('Cores devem usar #RRGGBB.');
  if(!Number.isFinite(highlightOpacity)||highlightOpacity<0||highlightOpacity>100)throw new Error('highlightOpacity: 0–100%.');
  if(!Number.isFinite(backgroundOpacity)||backgroundOpacity<0||backgroundOpacity>100)throw new Error('backgroundOpacity: 0–100%.');
  for(const p of [left,right])if(!Number.isFinite(p.scale??1)||(p.scale??1)<.5||(p.scale??1)>1)throw new Error('scale de participante: 0.5–1.');
  const textWidth=w*(portrait?.78:.40),textHeight=h*(portrait?.29:.52);
  const [prepared,setPrepared]=React.useState<{bounds:Bounds[];texts:TextLayout[];names:TextLayout[]}|null>(null);
  const [handle]=React.useState(()=>delayRender('Preparando Diálogo HQ'));
  const signature=JSON.stringify({left,right,turns,fontFamily,fontUrl,w,h,assets});
  React.useEffect(()=>{Promise.all([loadFont({family:fontFamily,url:fontUrl}),dialogueImageBounds(assets[left.asset]),dialogueImageBounds(assets[right.asset])]).then(([,a,b])=>{
    setPrepared({bounds:[a,b],texts:turns.map(t=>dialogueTextLayout(t.text.normalize('NFC').toLocaleUpperCase('pt-BR'),fontFamily,textWidth,textHeight,(portrait?95:110)*u)),names:[left,right].map(p=>dialogueTextLayout((p.name??'').toLocaleUpperCase('pt-BR'),fontFamily,textWidth,h*.05,38*u))});continueRender(handle);
  }).catch(cancelRender);},[signature,handle]);
  const index=dialogueTurnIndex(turns,frame,fps),turn=index<0?undefined:turns[index],weights=dialogueWeights(turns,time,motionDuration);
  const isRight=turn?.speaker==='right',layout=index<0?undefined:prepared?.texts[index];
  const delay=turn?.textDelay??0,local=turn?time-turn.at:0;
  const write=turn?.writeDuration??Math.min(1.2,Math.max(.01,((turn?.duration??1)-delay)*.55));
  const progress=turn?(turn.animation==='none'?(local>=delay?1:0):clampDialogue((local-delay)/write)):0;
  const total=layout?.lines.reduce((a,line)=>a+Array.from(line).length,0)??0;const visible=turn?.animation==='none'?total:Math.floor(progress*total);let letter=0;
  return <AbsoluteFill style={{overflow:'hidden'}}>
    <AbsoluteFill style={{opacity:backgroundOpacity/100,pointerEvents:'none'}}>
      <HQBackground {...{backgroundStyle,backgroundColor,paperTone,gridBackgroundColor,gridLineColor}}/>
      {colors.map((color,i)=><AbsoluteFill key={i} style={{opacity:(i===0?weights.left:weights.right)*highlightOpacity/100,background:`linear-gradient(to ${i===0?'right':'left'}, ${color} 0%, ${color}B8 24%, ${color}00 72%)`}}/>)}
    </AbsoluteFill>
    {prepared&&[left,right].map((participant,i)=>{
      const active=i===0?weights.left:weights.right,b=prepared.bounds[i];
      const fit=Math.min(w*(portrait?.59:.38)/b.width,h*(portrait?.48:.92)/b.height)*(participant.scale??1)*(.88+.12*active);
      const iw=b.width*fit,ih=b.height*fit;
      const idleX=i===0?0:w,activeX=w*(portrait?(i===0?.29:.71):(i===0?.19:.81)),cx=idleX+(activeX-idleX)*active;
      return <div key={i} style={{position:'absolute',left:cx-iw/2,top:h*.98-ih,width:iw,height:ih,overflow:'hidden',zIndex:active>.5?2:1,filter:`grayscale(${1-active}) brightness(${.55+.45*active})`,opacity:.45+.55*active}}>
        <Img src={assets[participant.asset]} style={{position:'absolute',left:-b.x*fit,top:-b.y*fit,width:b.sourceWidth*fit,height:b.sourceHeight*fit,maxWidth:'none'}}/>
      </div>;
    })}
    {turn&&layout&&progress>0&&<div style={{position:'absolute',zIndex:3,left:portrait?w*.11:w*(isRight?.17:.43),top:h*(portrait?.11:.18),width:textWidth,fontFamily,textAlign:portrait?'center':'left',color:turn.textColor??textColor,textShadow:fontFamily==='Anton'?'none':`${4*u}px ${6*u}px 0 #080A11`,WebkitTextStroke:fontFamily==='Anton'?'0px transparent':`${1.2*u}px #080A11`}}>
      {prepared?.names[isRight?1:0].lines.some(l=>l.length>0)&&<div style={{fontSize:prepared.names[isRight?1:0].size,lineHeight:1.1,marginBottom:h*.035,color:colors[isRight?1:0],whiteSpace:'pre'}}>{prepared.names[isRight?1:0].lines.join('\n')}</div>}
      <div style={{fontSize:layout.size,lineHeight:1.15}}>{layout.lines.map((line,i)=><div key={i} style={{whiteSpace:'pre'}}>{Array.from(line).map((c,j)=><span key={j} style={{opacity:letter++<visible?1:0}}>{c}</span>)}</div>)}</div>
    </div>}
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
