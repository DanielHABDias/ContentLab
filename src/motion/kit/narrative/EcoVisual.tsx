import React from 'react';
import { Board,Card,Caption,Media,Impact,useAsset,Common,Item,useBoard,phase,hit,C } from './shared';
const Ghost:React.FC<{item:Item;len:number;opacity:number;shift:number}> = ({item,len,opacity,shift}) => {
  const a=useAsset(item.midia);return a?<div style={{position:'absolute',inset:0,opacity,mixBlendMode:'screen',transform:`translateX(${shift}px)`}}><Media asset={a} len={len} fit="contain"/></div>:null;
};
export const EcoVisual:React.FC<Common & {ocorrencias:Item[];motivo:string}> = p => {
  const b=useBoard(),items=(p.ocorrencias||[]).slice(0,3),t=phase(b.f,p.len,.55,.2),age=Math.max(0,b.f-hit(p.len,.55));
  const active=Math.min(items.length-1,Math.floor(age/(b.fps*.17))),align=phase(b.f,p.len,.55,.35);
  return <Board {...p} impactos={[.55,.76]}>
    {items.map((item,i)=><Card key={i} item={item} len={p.len} x={b.V?60:i*540} y={b.V?140+i*230:160} w={b.V?780:480} h={b.V?200:400} at={hit(p.len,i*.14)} entrada={i%2?'direita':'esquerda'} style={{opacity:1-t*.7,transform:`translateX(${(b.w/2-(b.V?450:i*540+240))*t*.35}px) scale(${1-t*.12})`}}/>)}
    <div style={{position:'absolute',left:b.w*.15,top:140,width:b.w*.7,height:b.h-310,border:`5px solid ${C.yellow}`,opacity:t,background:'#0b0b10ee',transform:`scale(${.78+.22*t})`,overflow:'hidden'}}>
      {items.map((item,i)=><Ghost key={i} item={item} len={p.len} opacity={b.f<hit(p.len,.55)?0:i===active?.72:.25} shift={(i-(items.length-1)/2)*(1-align)*110}/>)}
      <div style={{position:'absolute',inset:'12%',border:`3px dashed ${C.blue}`,opacity:align}}/>
      <Caption text={items[active]?.titulo} x={25} y={25} w={b.w*.7-50} size={32} tone={C.white}/>
      <Caption text={p.motivo} x={25} y={b.h-450} w={b.w*.7-50} size={82} tone={C.yellow} style={{textAlign:'center',background:C.ink,padding:'12px 0',transform:`translateY(${(1-phase(b.f,p.len,.76))*40}px)`,opacity:phase(b.f,p.len,.76)}}/>
    </div>
    <Impact at={hit(p.len,.76)} x={b.w/2} y={b.h*.5} size={500}/>
  </Board>;
};
