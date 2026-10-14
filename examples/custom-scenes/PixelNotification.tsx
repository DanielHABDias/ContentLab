import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

/** Reusable corner notification based on Diazverso VD_0005 CTA system.
 * Draws its own pixel glyphs; no external font or sound dependency.
 * Put it on an `overlay` custom scene to preserve footage behind it.
 */
export type NotificationProps = {
  message?: string;
  brand?: string;
  icon?: 'youtube' | 'like' | 'bell' | 'info';
  start?: number;
  duration?: number;
  accent?: string;
  position?: 'top-right' | 'top-left';
};
const alphabet: Record<string, string[]> = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['10001','10001','10001','11111','00001','00001','00001'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01111','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','00100','00100','00100'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','11110'],
  '!':['00100','00100','00100','00100','00100','00000','00100'],
  '?':['01110','10001','00001','00010','00100','00000','00100'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t)};
const PixelText=({text,color,size=3}:{text:string;color:string;size?:number}) => {
  const chars=[...text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')].slice(0,26);
  return <svg role="img" aria-label={text} width={chars.length*6*size} height={7*size}
      viewBox={`0 0 ${Math.max(1,chars.length*6)} 7`} preserveAspectRatio="xMinYMid meet" style={{maxWidth:'100%',height:'auto',display:'block',shapeRendering:'crispEdges'}}>
    {chars.flatMap((c,i)=>(alphabet[c]||alphabet[' ']).flatMap((row,y)=>[...row].map((value,x)=> value==='1'
      ? <rect key={`${i}-${x}-${y}`} x={i*6+x} y={y} width="1" height="1" fill={color}/> : null).filter(Boolean)))}
  </svg>;
};
export default function PixelNotification({message='SE INSCREVA NO CANAL',brand='SEU CANAL',icon='youtube',start=.6,duration=1.8,accent,position='top-right'}:NotificationProps){
  const {fps,width,height}=useVideoConfig();const t=useCurrentFrame()/fps;
  const zoom=Math.min(width/1920,height/1080),end=start+duration;
  if(t < start || t > end) return null;
  const intro=smooth((t-start)/.18),outro=1-smooth((t-(end-.18))/.18);
  const pct=clamp((t-start)/Math.max(.01,duration));
  const color=accent || ({youtube:'#F22932',like:'#73CDFF',bell:'#FFC75D',info:'#97B6FC'}[icon]);
  const ico=icon==='youtube'?<svg width="46" height="46" viewBox="0 0 46 46"><rect x="2" y="7" width="42" height="32" rx="8" fill={color}/><path d="M20 16 L32 23 L20 30 Z" fill="white"/></svg>
    :icon==='like'?<svg width="46" height="46" viewBox="0 0 46 46"><path d="M14 18 L22 18 L26 8 Q32 8 30 16 L38 18 Q41 20 39 26 L35 36 L14 36 Z" fill={color}/><rect x="6" y="18" width="6" height="18" rx="2" fill={color}/></svg>
    :icon==='bell'?<svg width="46" height="46" viewBox="0 0 46 46"><path d="M23 7 Q12 9 12 20 L12 29 L8 34 H38 L34 29 V20 Q34 9 23 7Z" fill={color}/><path d="M18 36 Q23 42 28 36" fill="none" stroke={color} strokeWidth="4"/></svg>
    :<div style={{fontFamily:'Impact,sans-serif',fontSize:38,color}}>i</div>;
  return <AbsoluteFill style={{pointerEvents:'none',overflow:'hidden'}}><div style={{position:'absolute',width:1920,height:1080,transform:`scale(${zoom})`,transformOrigin:'0 0'}}>
    <div style={{position:'absolute',top:50,...(position==='top-left'?{left:60}:{right:60}),width:540,
      opacity:intro*outro,transform:`translateX(${(1-intro)*(position==='top-left'?-85:85)}px)`,background:'rgba(11,17,28,.95)',
      border:'2px solid rgba(255,255,255,.13)',borderRadius:16,boxShadow:'0 24px 60px #0008',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:18,padding:'17px 20px 14px'}}>
        <div style={{width:50,height:50,flexShrink:0}}>{ico}</div>
        <div style={{minWidth:0,flex:1}}><PixelText text={message} color="#FAFDFF" size={3.1}/><div style={{marginTop:9}}><PixelText text={brand} color="#93A5C0" size={1.85}/></div></div>
      </div>
      <div style={{height:7,background:'#080C14'}}><div style={{height:'100%',width:`${pct*100}%`,background:color,boxShadow:`0 0 12px ${color}`}}/></div>
    </div>
  </div></AbsoluteFill>;
}