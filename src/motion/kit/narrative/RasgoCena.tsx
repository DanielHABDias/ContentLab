import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { Background, Media, useAsset } from '../stage';
import { C } from '../fx';
import { Common, phase, useBoard } from './shared';
export const RasgoCena:React.FC<Common & {antes:string;depois:string;inicioAntes?:number;inicioDepois?:number}>=p=>{
 const b=useBoard(),{width:W,height:H,fps}=useVideoConfig(),before=useAsset(p.antes),after=useAsset(p.depois),at=Math.max(0,Math.min(.58,p.virada??.35)),q=phase(b.f,p.len,at,.42),edge=-.12+q*1.25;
 const jagged=Array.from({length:15},(_,i)=>`${(edge+(i%2?.035:-.025))*100}% ${i/14*100}%`).join(',');
 return <AbsoluteFill style={{overflow:'hidden'}}><Background kind="escuro"/>
  <Media asset={before} len={p.len} inicio={p.inicioAntes||0}/>
  <AbsoluteFill data-reveal-progress={q} style={{clipPath:q>=1?'none':`polygon(0 0,${jagged},0 100%)`}}>
   <Sequence from={Math.round(p.len*at)} layout="none" premountFor={fps}><Media asset={after} len={p.len} inicio={p.inicioDepois||0}/></Sequence>
  </AbsoluteFill>
  {q>0&&q<1&&<svg style={{position:'absolute',inset:0,width:W,height:H}}><polyline points={Array.from({length:15},(_,i)=>`${(edge+(i%2?.035:-.025))*W},${i/14*H}`).join(' ')} fill="none" stroke={C.ink} strokeWidth={22}/><polyline points={Array.from({length:15},(_,i)=>`${(edge+(i%2?.035:-.025))*W},${i/14*H}`).join(' ')} fill="none" stroke={C.white} strokeWidth={10}/><polyline points={Array.from({length:15},(_,i)=>`${(edge+(i%2?.035:-.025))*W+7},${i/14*H}`).join(' ')} fill="none" stroke={C.red} strokeWidth={3}/></svg>}
 </AbsoluteFill>;
};
