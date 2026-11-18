import React from 'react';
import { AbsoluteFill, Freeze, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background, Media, useAsset, color } from '../stage';
import { ANTON, C } from '../fx';
import { trailGeometry, trailState } from './trilha';
import { phase, Caption, Common } from './shared';
type Fragment={titulo:string;midia:string;inicio?:number;fonte?:string};
const FragmentMedia:React.FC<{item:Fragment;start:number;elapsed:number;active:boolean;len:number}>=({item,start,elapsed,active,len})=>{
 const asset=useAsset(item.midia);const {fps}=useVideoConfig();
 // Before activation, show the first source frame; after it, retain the last frame actually played.
 const content=<Media asset={asset} len={len} inicio={item.inicio??0} motion="entrar"/>;
 return active?<Sequence from={start} layout="none" premountFor={fps}>{content}</Sequence>:<Freeze frame={elapsed}>{content}</Freeze>;
};
export const TrilhaViva:React.FC<Common & {fragmentos:Fragment[];mergulhar?:boolean}>=p=>{
 const f=useCurrentFrame(),{width:W,height:H}=useVideoConfig(),V=H>W;
 const items=(p.fragmentos||[]).slice(0,4),state=trailState(f,p.len,items.length);
 const trackW=V?W*.66:W*.84,trackH=V?H*.56:H*.51;
 const travel=Math.min(.84,Math.max(0,(f/p.len-.08)/.68)*.84),geometry=trailGeometry(V?trackH:trackW,V?trackW:trackH,travel);
 const drift=Math.sin(f/44)*trackH*.012;
 const left=W*.08+(V?drift:0),top=(V?H*.14:H*.22)+(V?0:drift);
 const node=(t:number)=>V?{x:left+trackW*0.5+trackW*(trailGeometry(trackH,trackW,t).point.y/trackW-.5),y:top+trackH*t}:{x:left+trackW*t,y:top+trackH*trailGeometry(trackW,trackH,t).point.y/trackH};
 const cw=V?W*.57:W*.235,ch=cw*.61,accent=color(p.tom,C.blue);
 const portal=p.mergulhar!==false&&items.length?phase(f,p.len,.84,.15):0;
 const path=V?geometry.path.replace(/([ML]) ([\d.e+-]+) ([\d.e+-]+)/g,(_,cmd,x,y)=>`${cmd} ${y} ${x}`):geometry.path;
 const renderItem=(item:Fragment,i:number)=>{const pos=node(state.cues[i].t),active=i===state.active,last=i===items.length-1;
  const z=last?portal:0,x=pos.x-cw/2,y=pos.y-ch/2;
  return <div key={i} data-trail-active={active?'true':'false'} data-trail-item={i} style={{position:'absolute',left:x*(1-z),top:y*(1-z),width:cw+(W-cw)*z,height:ch+(H-ch)*z,zIndex:last&&z>0?30:5,transform:`rotate(${(1-z)*(i%2?4:-4)}deg)`,filter:active?'none':'grayscale(1) brightness(.46)',clipPath:z>.99?'none':`polygon(2% 0,100% 3%,98% 100%,0 96%)`,background:C.ink,padding:z>.99?0:4,boxShadow:active?`0 0 25px ${accent}88`:'none'}}>
   <AbsoluteFill style={{border:active?`4px solid ${accent}`:'3px solid #687080',opacity:1-z,zIndex:2,pointerEvents:'none'}}/>
   <div style={{position:'absolute',inset:3*(1-z),overflow:'hidden'}}><FragmentMedia item={item} start={state.cues[i].start} elapsed={state.elapsed(i)} active={active} len={p.len}/></div>
   <div style={{position:'absolute',left:14,right:10,bottom:12,opacity:1-z,fontFamily:ANTON,fontSize:V?35:32,color:active?C.yellow:'#d4d5da',textShadow:'2px 3px 2px #000',background:'#0b0b10cc',padding:'4px 12px'}}>{item.titulo}<small style={{display:'block',fontSize:18,color:'#ddd'}}>{item.fonte}</small></div>
  </div>;
 };
 return <AbsoluteFill style={{overflow:'hidden'}}><Background kind={p.fundo||'estrelas'} tint={p.tom}/>
  <div style={{position:'absolute',left:W*.06,top:H*.08,opacity:1-portal}}><Caption text={p.titulo} w={W*.86} size={V?58:76}/></div>
  <svg style={{position:'absolute',left,top,width:V?trackW:trackW,height:V?trackH:trackH,overflow:'visible',opacity:1-portal}}>
   <path d={path} fill="none" stroke="#343b4a" strokeWidth={14} strokeLinecap="round"/>
   <path d={path} fill="none" stroke={accent} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1-geometry.progress}/>
  </svg>
  {items.map(renderItem)}
  {state.active>=0&&portal<.9&&<div style={{position:'absolute',left:W*.08,bottom:V?H*.29:H*.1,opacity:1-portal,fontFamily:ANTON,fontSize:V?46:58,color:C.yellow}}>{String(state.active+1).padStart(2,'0')} <span style={{color:'#abb1c0',fontSize:28}}>/ {String(items.length).padStart(2,'0')}</span></div>}
 </AbsoluteFill>;
};
