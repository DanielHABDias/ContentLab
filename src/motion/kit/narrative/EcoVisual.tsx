import React from 'react';
import { Board, Card, Caption, Media, useAsset, Common, Item, useBoard, phase, hit, C } from './shared';
const Ghost:React.FC<{item:Item;len:number;opacity:number}> = ({item,len,opacity})=>{const a=useAsset(item.midia);return a?<div style={{position:'absolute',inset:0,opacity,mixBlendMode:'screen'}}><Media asset={a} len={len} fit="contain"/></div>:null};
export const EcoVisual:React.FC<Common & { ocorrencias:Item[]; motivo:string }> = p=>{
 const b=useBoard(),items=(p.ocorrencias||[]).slice(0,3);const t=phase(b.f,p.len,.55,.25);
 return <Board {...p}>{items.map((item,i)=><Card key={i} item={item} len={p.len} x={b.V?60:i*540} y={b.V?140+i*230:160} w={b.V?780:480} h={b.V?200:400} at={hit(p.len,i*.14)} style={{opacity:1-t*.5}}/>)}<div style={{position:'absolute',left:b.w*.15,top:130,width:b.w*.7,height:b.h-300,border:`4px solid ${C.yellow}`,opacity:t,background:'#0b0b10dc',transform:`scale(${.85+.15*t})`}}>{items.map((item,i)=><Ghost key={i} item={item} len={p.len} opacity={.3}/>) }<Caption text={p.motivo} x={30} y={b.h-420} w={b.w*.7-60} size={75} tone={C.yellow} style={{textAlign:'center',background:'#0b0b10bb'}}/></div></Board>;
};
