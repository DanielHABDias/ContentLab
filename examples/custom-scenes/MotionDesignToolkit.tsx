import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * Reusable, frame-deterministic motion recipes for local ContentLab TSX scenes.
 * Copy into PROJECT/custom-scenes/; choose a variant through customComponent.props.
 * These are ingredients, not a mandate to apply every effect in every scene.
 * The host edit_plan.json still owns narration, music, SFX and scene transitions.
 */
export type MotionTechnique =
  | 'kinetic_typography' | 'shape_morph' | 'stroke_draw' | 'spring_physics'
  | 'liquid_shapes' | 'particles' | 'data_vis' | 'parallax_25d'
  | 'glitch' | 'mask_reveal' | 'motion_blur'
  | 'transition_slide' | 'transition_whip' | 'transition_flip'
  | 'transition_zoom' | 'transition_curtain';
export type MotionToolkitProps = {
  variant?: MotionTechnique;
  title?: string;
  nextTitle?: string;
  values?: number[];
  color?: string;
  background?: string;
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (v: number) => {const x = clamp(v); return x*x*(3-2*x);};
const tween = (v: number, a: number, b: number) => smooth((v-a)/Math.max(0.001,b-a));
const mix = (a: number, b: number, p: number) => a+(b-a)*p;
const hash = (n: number) => {const x=Math.sin(n*127.1+31.7)*43758.5453;return x-Math.floor(x);};
const polar = (r: number, a: number) => ({x:Math.cos(a)*r,y:Math.sin(a)*r});
const textStyle: React.CSSProperties = {fontFamily:'Arial, sans-serif',fontWeight:900,lineHeight:0.94,letterSpacing:-5};

export default function MotionDesignToolkit({
  variant='kinetic_typography',title='MOTION DESIGN',nextTitle='PRÓXIMA IDEIA',
  values=[32,57,43,89,68],color='#F34F5E',background='#091321',
}: MotionToolkitProps){
  const frame=useCurrentFrame();
  const {fps,width,height,durationInFrames}=useVideoConfig();
  const t=frame/fps;
  const duration=durationInFrames/fps;
  const u=clamp(t/Math.max(0.001,duration));
  const enter=tween(u,.02,.28),hold=tween(u,.78,.98);
  const cx=width/2,cy=height/2;
  const unit=Math.min(width/1920,height/1080);
  const heading:React.CSSProperties={...textStyle,fontSize:Math.max(46,132*unit),color:'#F7FAFF',textAlign:'center'};
  const label=(word:string)=><div style={{...heading,padding:'0 40px'}}>{word}</div>;
  const scene:React.CSSProperties={background,overflow:'hidden',color:'#F7FAFF',display:'flex',justifyContent:'center',alignItems:'center'};
  const accent=color;

  if(variant==='kinetic_typography'){
    const glyphs=[...title];
    return <AbsoluteFill style={scene}>
      <div style={{display:'flex',justifyContent:'center',alignItems:'center',flexWrap:'wrap',maxWidth:'92%',gap:Math.max(2,5*unit)}}>
        {glyphs.map((c,i)=>{const p=tween(u,.08+i*.008,.24+i*.008);const overshoot=1+.13*Math.sin(Math.PI*p);return <span key={i} style={{...heading,whiteSpace:'pre',display:'inline-block',color:i%5===0?accent:'#FFFFFF',opacity:p,transform:`translateY(${(1-p)*120*unit}px) rotate(${(1-p)*-13}deg) scale(${mix(.55,1,p)*overshoot})`}}>{c===' '?'\u00A0':c}</span>;})}
      </div>
    </AbsoluteFill>;
  }
  if(variant==='shape_morph'){
    // Both shapes use exactly 12 ordered points; no SVG path parser or plugin required.
    const n=12,p=tween(u,.18,.68),radius=270*unit;
    const vertices=Array.from({length:n},(_,i)=>{
      const a=-Math.PI/2+2*Math.PI*i/n;
      const circle=polar(radius,a);
      const target=polar(radius*(i%2===0?1:.46),a);
      return {x:cx+mix(circle.x,target.x,p),y:cy+mix(circle.y,target.y,p)};
    });
    const points=vertices.map(v=>`${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ');
    return <AbsoluteFill style={scene}>
      <svg width={width} height={height} style={{position:'absolute',inset:0}}>
        <polygon points={points} fill={accent} stroke="#FFFFFF" strokeWidth={6*unit} strokeLinejoin="round"/>
        <circle cx={cx} cy={cy} r={95*unit} fill={background} opacity={.35*p}/>
      </svg>
      <div style={{position:'absolute',bottom:'8%',...heading,fontSize:55*unit}}>FORMA → OUTRA FORMA</div>
    </AbsoluteFill>;
  }
  if(variant==='stroke_draw'){
    const p=tween(u,.06,.68);
    return <AbsoluteFill style={scene}>
      <svg width={width} height={height} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0}} preserveAspectRatio="xMidYMid meet">
        <path d="M180 740 C480 200 730 880 1000 410 S1470 260 1750 520" fill="none" stroke={accent} strokeWidth="27" strokeLinecap="round" strokeDasharray="2400" strokeDashoffset={2400*(1-p)}/>
        <path d="M180 740 C480 200 730 880 1000 410 S1470 260 1750 520" fill="none" stroke="#F5F9FF" strokeWidth="5" strokeLinecap="round" strokeDasharray="2400" strokeDashoffset={2400*(1-p)}/>
        <circle cx="1750" cy="520" r={35*tween(u,.68,.83)} fill={accent}/>
      </svg>
      <div style={{position:'absolute',top:'10%',...heading,fontSize:70*unit}}>{title}</div>
    </AbsoluteFill>;
  }
  if(variant==='spring_physics'){
    const bounce=spring({frame:Math.max(0,frame-Math.round(.1*fps)),fps,from:0,to:1,config:{damping:9,mass:1,stiffness:140}});
    const bounceHeight=260*unit;
    // Damped rebound after initial drop, sampled analytically per frame.
    const seconds=Math.max(0,t-.1);
    const rebound=seconds<.5?mix(-bounceHeight,0,tween(seconds,0,.5)):-bounceHeight*Math.exp(-(seconds-.5)*2.35)*Math.abs(Math.sin((seconds-.5)*9));
    const y=cy+145*unit+rebound;
    return <AbsoluteFill style={scene}>
      <div style={{position:'absolute',left:'15%',right:'15%',top:cy+245*unit,height:6*unit,background:'#5E738D'}}/>
      <div style={{width:155*unit,height:155*unit,background:accent,borderRadius:'50%',position:'absolute',left:cx-77*unit,top:y-77*unit,transform:`scale(${1+.05*(bounce-1)})`,boxShadow:'0 0 50px #0008'}}/>
      <div style={{position:'absolute',left:cx-100*unit,top:cy+260*unit,width:200*unit,height:22*unit,borderRadius:'50%',background:'#020711',filter:'blur(12px)',opacity:clamp(.8+rebound/bounceHeight)}}/>
    </AbsoluteFill>;
  }
  if(variant==='liquid_shapes'){
    const blobs=[{x:-150*unit,y:0,r:270*unit,phase:0},{x:155*unit,y:25*unit,r:260*unit,phase:1.6}];
    return <AbsoluteFill style={scene}>
      <svg width={width} height={height} style={{position:'absolute',inset:0}}>
        <defs><linearGradient id="liquidGradient" x1="0" x2="1" y1="0" y2="1"><stop stopColor={accent}/><stop offset="1" stopColor="#356CE8"/></linearGradient></defs>
        {blobs.map((b,index)=>{
          const pts=Array.from({length:64},(_,i)=>{const a=2*Math.PI*i/64;const w=1+.09*Math.sin(3*a+2*t+b.phase)+.065*Math.sin(5*a-1.2*t+b.phase);return {x:cx+b.x+Math.sin(t*.75+b.phase)*72*unit+Math.cos(a)*b.r*w,y:cy+b.y+Math.cos(t*.65+b.phase)*50*unit+Math.sin(a)*b.r*w};});
          const path='M'+pts.map(v=>`${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' L')+' Z';
          return <path key={index} d={path} fill="url(#liquidGradient)" opacity={index===0?1:.8}/>;
        })}
      </svg>
      <div style={{position:'absolute',bottom:60*unit,...heading,fontSize:65*unit}}>{title}</div>
    </AbsoluteFill>;
  }
  if(variant==='particles'){
    return <AbsoluteFill style={scene}>
      <svg width={width} height={height} style={{position:'absolute',inset:0}}>
        {Array.from({length:90},(_,i)=>{
          const a=hash(i*2+1)*Math.PI*2,spd=(160+340*hash(i*7+3))*unit;
          const p=tween(u,.1,.75);const drift=p*spd;
          return <circle key={i} cx={cx+Math.cos(a)*drift} cy={cy+Math.sin(a)*drift} r={(3+8*hash(i*5+4))*unit} fill={i%4===0?'#FFFFFF':accent} opacity={Math.sin(Math.PI*p)*(.35+.65*hash(i+10))}/>;
        })}
      </svg>
      <div style={{...heading,opacity:enter,transform:`scale(${mix(.8,1,enter)})`}}>{title}</div>
    </AbsoluteFill>;
  }
  if(variant==='data_vis'){
    const normalized=values.slice(0,8).map(v=>Math.max(0,Math.min(100,Number.isFinite(v)?v:0)));
    const barW=Math.min(width*.68/Math.max(1,normalized.length),155*unit),gap=20*unit;
    const widthBars=normalized.length*(barW+gap)-gap;
    const bottom=height*.77,fullH=height*.47;
    return <AbsoluteFill style={scene}>
      <div style={{position:'absolute',top:'9%',...heading,fontSize:75*unit}}>{title}</div>
      <svg width={width} height={height} style={{position:'absolute',inset:0}}>
        {normalized.map((v,i)=>{
          const p=tween(u,.10+i*.035,.67+i*.035),h=v/100*fullH*p;
          const x=cx-widthBars/2+i*(barW+gap);
          return <g key={i}>
            <rect x={x} y={bottom-h} width={barW} height={Math.max(0,h)} rx={10*unit} fill={i===normalized.length-1?accent:'#487BCB'}/>
            <text x={x+barW/2} y={bottom-h-25*unit} textAnchor="middle" fill="#FFFFFF" fontWeight={800} fontSize={40*unit}>{Math.round(v*p)}%</text>
          </g>;
        })}
        <line x1={cx-widthBars/2-30*unit} x2={cx+widthBars/2+30*unit} y1={bottom} y2={bottom} stroke="#D9E7FF" strokeWidth={4*unit}/>
      </svg>
    </AbsoluteFill>;
  }
  if(variant==='parallax_25d'){
    const a=tween(u,.1,.85),angles=[-18,-8,5];
    return <AbsoluteFill style={{...scene,perspective:1200*unit}}>
      {angles.map((angle,i)=><div key={i} style={{position:'absolute',width:width*.43,height:height*.58,border:`${5*unit}px solid #DCE8FF`,borderRadius:28*unit,
        left:cx-width*.21+(i-1)*180*unit,top:cy-height*.29+(i-1)*20*unit,zIndex:i,
        background:i===0?'linear-gradient(145deg,#244366,#0E1726)':i===1?'linear-gradient(125deg,#3968A2,#18283E)':`linear-gradient(135deg,${accent},#602E54)`,
        boxShadow:'0 22px 55px #0009',transform:`translateX(${(i-1)*a*140*unit}px) translateZ(${i*90*unit}px) rotateY(${angle*a}deg)`,display:'grid',placeItems:'center'}}>
        <span style={{...heading,fontSize:70*unit}}>{['FUNDO','MEIO','FRENTE'][i]}</span></div>)}
    </AbsoluteFill>;
  }
  if(variant==='glitch'){
    const active=Math.sin(t*19)>0.45&&u>.14&&u<.83;
    const jitter=active?(hash(Math.floor(t*fps))-.5)*80*unit:0;
    return <AbsoluteFill style={scene}>
      <div style={{...heading,fontSize:150*unit,position:'absolute',transform:`translateX(${jitter}px)`}}>{title}</div>
      {active&&[0,1,2].map((i)=><div key={i} style={{...heading,fontSize:150*unit,position:'absolute',color:i===0?'#52E7FF':accent,
        clipPath:`inset(${22+i*21}% 0 ${56-i*20}% 0)`,transform:`translate(${jitter+(-1+i)*20*unit}px,${(i-1)*8*unit}px)`,opacity:.72}}>{title}</div>)}
    </AbsoluteFill>;
  }
  if(variant==='mask_reveal'){
    const p=tween(u,.05,.73),r=p*85;
    return <AbsoluteFill style={scene}>
      <div style={{position:'absolute',inset:0,background:accent,clipPath:`circle(${r}% at 50% 50%)`,display:'grid',placeItems:'center'}}>
        <div style={{...heading,color:background}}>{title}</div>
      </div>
      <div style={{position:'absolute',width:30*unit,height:30*unit,left:cx-15*unit,top:cy-15*unit,borderRadius:'50%',background:'#FFFFFF',opacity:1-p}}/>
    </AbsoluteFill>;
  }
  if(variant==='motion_blur'){
    const p=tween(u,.08,.64),x=mix(-width*.7,0,p);
    const velocity=(1-p)*p*25;
    return <AbsoluteFill style={scene}>
      {Array.from({length:5},(_,i)=><div key={i} style={{...heading,position:'absolute',opacity:i===0?1:velocity*.012,
        transform:`translateX(${x-(i*24*unit*velocity)}px)`,filter:i===0?`blur(${Math.min(9,velocity*.4)}px)`:'blur(12px)',color:i===0?'#FFFFFF':accent}}>{title}</div>)}
    </AbsoluteFill>;
  }

  // Transitions below are *inside a custom TSX scene*; they do not add
  // transitionOut enum values to the ContentLab engine.
  const p=tween(u,.24,.76);
  const old=label(title),next=label(nextTitle);
  const panel=(child:React.ReactNode,colorValue:string,transform?:string,clipPath?:string)=><div style={{position:'absolute',inset:0,background:colorValue,display:'grid',placeItems:'center',transform,clipPath}}>{child}</div>;
  if(variant==='transition_slide')return <AbsoluteFill style={scene}>{panel(old,background,`translateX(${-width*p}px)`)}{panel(next,accent,`translateX(${width*(1-p)}px)`)}</AbsoluteFill>;
  if(variant==='transition_whip')return <AbsoluteFill style={scene}>
    {panel(old,background,`translateX(${-width*p}px)`,undefined)}
    {panel(next,accent,`translateX(${width*(1-p)}px)`)}
    <div style={{position:'absolute',inset:0,backdropFilter:`blur(${Math.sin(Math.PI*p)*25*unit}px)`,pointerEvents:'none'}}/>
  </AbsoluteFill>;
  if(variant==='transition_curtain')return <AbsoluteFill style={scene}>
    {panel(old,background)}
    {panel(next,accent,undefined,`inset(0 ${100*(1-p)}% 0 0)`)}
  </AbsoluteFill>;
  if(variant==='transition_zoom')return <AbsoluteFill style={scene}>
    {panel(old,background,`scale(${1+.7*p})`)}
    <div style={{position:'absolute',inset:0,opacity:p,transform:`scale(${1.9-.9*p})`,background:accent,display:'grid',placeItems:'center'}}>{next}</div>
  </AbsoluteFill>;
  if(variant==='transition_flip'){
    const first=p<.5,half=first?p*2:(p-.5)*2;
    const value=first?title:nextTitle;
    return <AbsoluteFill style={{...scene,perspective:1500*unit}}>
      <div style={{position:'absolute',inset:0,backfaceVisibility:'hidden',background:first?background:accent,display:'grid',placeItems:'center',
        transform:`rotateY(${first?-90*half:90*(1-half)}deg)`,boxShadow:'0 0 100px #000B'}}>{label(value)}</div>
    </AbsoluteFill>;
  }
  return <AbsoluteFill style={scene}>{label(title)}</AbsoluteFill>;
}