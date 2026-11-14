import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, C, Punch, pop, slide, shake } from '../fx';
import { Background, Camera, Media, useAsset, color, fit } from '../stage';
import { atFrame, cardEntrance, clamp01, linear } from './choreography';

export { C, Punch, pop, slide, shake, Media, useAsset, color, linear, clamp01 };
export type Item = { titulo: string; texto?: string; midia?: string; fonte?: string; tom?: string };
export type Common = { len: number; titulo?: string; fundo?: 'estrelas' | 'escuro' | 'meio-tom' | 'explosao'; tom?: string; virada?: number };
export function useBoard() {
  const f = useCurrentFrame(); const { width, height, fps } = useVideoConfig(); const V = height > width;
  const w = V ? 900 : 1600, h = V ? 1050 : 780;
  const scale = Math.min((width*.86)/w, (height*(V ? .55 : .76))/h);
  return { f, fps, V, w, h, scale, x: (width-w*scale)/2, y: V ? height*.14 : (height-h*scale)/2 };
}
export const phase = (f: number, len: number, at: number, span = .12) => slide(f, atFrame(len,at), Math.max(1,Math.round(len*span)));
export const hit = atFrame;
export const Caption: React.FC<{ text?: string; x?: number; y?: number; w?: number; size?: number; tone?: string; lines?:number; style?: React.CSSProperties }> = ({ text, x=0, y=0, w=500, size=58, tone=C.white, lines=2, style }) => text ? <div style={{ position:'absolute', left:x, top:y, width:w, color:tone, fontFamily:ANTON, fontSize:fit(text,w,size,lines), lineHeight:1.08, textTransform:'uppercase', overflowWrap:'anywhere', ...style }}>{text}</div> : null;

/** Shared ink/Anton/camera grammar; actor-specific motion remains inside each scene. */
export const Board: React.FC<Common & { children:React.ReactNode; impactos?:number[]; camera?:{x?:number;y?:number;zoom?:number} }> = ({ titulo, len, fundo='estrelas', tom, children, impactos=[], camera={} }) => {
  const b=useBoard(); const enter=slide(b.f,0,Math.min(b.fps*.3,len*.16)); const out=linear(b.f,len,.94,.06);
  return <Camera from={1.12} push={.00016}><Background kind={fundo} tint={tom}/>
    <AbsoluteFill style={{transform:shake(b.f,impactos.map(t=>hit(len,t)),9)}}>
      <div style={{position:'absolute',left:b.x,top:b.y,width:b.w,height:b.h,transform:`scale(${b.scale})`,transformOrigin:'top left'}}>
        <div style={{position:'absolute',inset:0,transform:`translate(${camera.x||0}px,${(camera.y||0)-out*12}px) scale(${(camera.zoom||1)+out*.025})`,transformOrigin:'50% 48%',opacity:1-out*.2}}>{children}</div>
        <div style={{position:'absolute',left:0,top:-10,width:10,height:67,background:color(tom,C.yellow),transform:`scaleY(${enter})`,transformOrigin:'top'}}/>
        <div data-motion-heading style={{position:'absolute',left:30,top:0,width:b.w-60,height:110,clipPath:`inset(0 ${100-enter*100}% 0 0)`,transform:`translateX(${(1-enter)*-70}px)`}}><Caption text={titulo} w={b.w-60} size={68} lines={1} style={{whiteSpace:'nowrap'}}/></div>
      </div>
    </AbsoluteFill>
  </Camera>;
};

/** Spatial and entrance transforms live on separate elements, so neither can cancel the other. */
export const Card: React.FC<{ item:Item; len:number; x:number;y:number;w:number;h:number;at?:number;rotate?:number;entrada?:'esquerda'|'direita'|'baixo'|'cima'|'profundidade';style?:React.CSSProperties }> = ({ item,len,x,y,w,h,at=0,rotate=0,entrada='baixo',style }) => {
  const b=useBoard(); const asset=useAsset(item.midia); const accent=color(item.tom,C.yellow);
  const entry=cardEntrance(b.f,at,b.fps,entrada,Math.max(170,Math.min(600,w*.85)));
  return <div data-motion-card={item.titulo} style={{position:'absolute',left:x,top:y,width:w,height:h,...style}}>
    <div style={{position:'absolute',inset:0,...entry}}>
      <div style={{position:'absolute',inset:0,background:'#171d2b',border:`5px solid ${C.ink}`,outline:`2px solid ${accent}`,boxShadow:`9px 9px 0 ${C.red},-4px -3px 0 ${C.blue}`,transform:`rotate(${rotate}deg)`,overflow:'hidden'}}>
        {asset ? <div style={{position:'absolute',inset:0,opacity:.9}}><Media asset={asset} len={len}/><AbsoluteFill style={{background:'linear-gradient(transparent 18%,#0b0b10 94%)'}}/></div> : <div style={{position:'absolute',inset:0,opacity:.16,backgroundImage:'radial-gradient(#fff 18%,transparent 22%)',backgroundSize:'17px 17px'}}/>}
        <div style={{position:'absolute',left:22,right:22,bottom:18,display:'flex',flexDirection:'column',gap:Math.min(10,h*.035)}}>
          <Caption text={item.titulo} w={w-44} size={Math.min(76,h*(item.texto ? .22 : .36))} tone={accent} style={{position:'relative',width:'100%'}}/>
          <Caption text={item.texto} w={w-44} size={Math.min(34,h*.12)} style={{position:'relative',width:'100%'}}/>
          <Caption text={item.fonte} w={w-44} size={Math.min(20,h*.09)} tone="#c2c9dc" style={{position:'relative',width:'100%'}}/>
        </div>
      </div>
    </div>
  </div>;
};

export const Wire: React.FC<{x1:number;y1:number;x2:number;y2:number;progress:number;tone?:string;dashed?:boolean;bend?:number}> = ({x1,y1,x2,y2,progress,tone=C.yellow,dashed,bend=0}) => {
  const f=useCurrentFrame(); const p=clamp01(progress); const cx=(x1+x2)/2+bend,cy=(y1+y2)/2;
  const path=`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  const travel=progress<1?p:((f/50)%1); const tx=(1-travel)**2*x1+2*(1-travel)*travel*cx+travel**2*x2,ty=(1-travel)**2*y1+2*(1-travel)*travel*cy+travel**2*y2;
  return <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible',pointerEvents:'none',opacity:p}}>
    <path d={path} pathLength={1} stroke={C.ink} strokeWidth={12} strokeDasharray="1" strokeDashoffset={1-p} fill="none"/>
    <path d={path} pathLength={1} stroke={tone} strokeWidth={5} fill="none" strokeDasharray={dashed?'.025 .025':1} strokeDashoffset={dashed?-f*.001:1-p}/>
    <circle cx={tx} cy={ty} r={8} fill={tone}/><circle cx={x2} cy={y2} r={6} fill={tone} opacity={p>.97?1:0}/>
  </svg>;
};

/** Localized impact, rather than a flash that hides the evidence. */
export const Impact:React.FC<{at:number;x:number;y:number;size?:number;tone?:string}> = ({at,x,y,size=260,tone=C.yellow}) => {
  const f=useCurrentFrame()-at; const {fps}=useVideoConfig(); const t=clamp01(f/(fps*.38));
  if(f<0||t>=1)return null;
  return <svg style={{position:'absolute',left:x-size/2,top:y-size/2,width:size,height:size,pointerEvents:'none',overflow:'visible',opacity:(1-t)**2}} viewBox="-100 -100 200 200">
    <circle r={12+t*85} fill="none" stroke={tone} strokeWidth={9*(1-t)}/>
    {Array.from({length:10},(_,i)=>{const a=i*Math.PI/5;return <path key={i} d={`M ${Math.cos(a)*(18+t*45)} ${Math.sin(a)*(18+t*45)} L ${Math.cos(a)*(38+t*70)} ${Math.sin(a)*(38+t*70)}`} stroke={i%2?C.white:tone} strokeWidth={4}/>})}
  </svg>;
};
export const Seal:React.FC<{text?:string;len:number;at?:number;y:number;w:number;tone?:string}> = ({text,len,at=.76,y,w,tone=C.yellow}) => {
  const b=useBoard(); const age=b.f-hit(len,at); if(!text||age<0)return null;
  const s=interpolate(age,[0,4,9,14],[1.65,.94,1.025,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  return <div style={{position:'absolute',top:y,left:30,width:w-60,textAlign:'center',transform:`scale(${s}) rotate(-2deg)`,background:C.ink,padding:'12px 20px',boxSizing:'border-box',border:`5px solid ${tone}`,boxShadow:`10px 10px 0 ${C.red}`,opacity:Math.min(1,age/2)}}><Punch size={fit(text,w-120,82,2)} color={tone}>{text}</Punch></div>;
};
