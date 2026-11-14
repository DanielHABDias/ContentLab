import React from 'react';
import { Board,Caption,Seal,Impact,Common,useBoard,phase,hit,C,color } from './shared';
import { thresholdFrame,thresholdValue } from './choreography';
export const Limiar:React.FC<Common & {de?:number;valor:number;limite:number;maximo?:number;rotulo:string;antes?:string;depois?:string;fonte:string}> = p => {
  const b=useBoard(),max=Math.max(1,p.maximo??100),unit=(v:number)=>Math.max(0,Math.min(1,v/max)),from=p.de??0;
  const v=thresholdValue(b.f,p.len,from,p.valor),cross=p.valor>=from?v>=p.limite:v<=p.limite;
  const crossing=thresholdFrame({len:p.len,from,to:p.valor,limit:p.limite}),x=80,y=b.V?430:320,w=b.w-160,enter=phase(b.f,p.len,0),warn=phase(b.f,p.len,.12,.58);
  return <Board {...p} impactos={crossing===null?[]:[crossing/p.len]}>
    <Caption text={p.rotulo} x={x} y={150} w={w} size={66} style={{opacity:enter}}/>
    <div style={{position:'absolute',left:x,top:y,width:w,height:110,background:'#202738',border:`6px solid ${C.ink}`,boxShadow:`8px 8px 0 ${C.blue}`,transform:`scaleX(${enter})`,transformOrigin:'left'}}>
      <div style={{position:'absolute',...(p.valor>=from?{left:`${unit(p.limite)*100}%`,right:0}:{left:0,width:`${unit(p.limite)*100}%`}),top:0,bottom:0,opacity:.35,backgroundImage:`repeating-linear-gradient(-45deg,${C.red} 0 12px,transparent 12px 25px)`}}/>
      <div style={{width:`${unit(v)*100}%`,height:'100%',background:cross?C.red:color(p.tom,C.blue),boxShadow:cross?`0 0 28px ${C.red}`:undefined}}/>
      {Array.from({length:11},(_,i)=><div key={i} style={{position:'absolute',left:`${i*10}%`,top:70,width:3,height:40,background:'#fff9'}}/>)}
    </div>
    <div style={{position:'absolute',left:x+unit(p.limite)*w,top:y-70,height:240,borderLeft:`7px dashed ${C.yellow}`,opacity:enter}}/>
    <div style={{position:'absolute',left:x+unit(v)*w-15,top:y-34,width:0,height:0,borderLeft:'16px solid transparent',borderRight:'16px solid transparent',borderTop:`28px solid ${cross?C.red:C.white}`,opacity:warn}}/>
    <Caption text={`LIMITE ${p.limite}`} x={Math.min(b.w-330,Math.max(50,x+unit(p.limite)*w-120))} y={y-115} w={280} size={36} tone={C.yellow} style={{opacity:enter}}/>
    <Caption text={`${Math.round(v)}`} x={x} y={y+155} w={w} size={145} tone={cross?C.red:C.white}/>
    {crossing!==null&&<Impact at={crossing} x={x+unit(p.limite)*w} y={y+55} size={420} tone={C.red}/>}
    <Seal text={cross?p.depois:p.antes} len={p.len} at={cross&&crossing!==null?crossing/p.len:.12} y={b.h-170} w={b.w} tone={cross?C.red:C.yellow}/>
    <Caption text={p.fonte} x={x} y={b.h-25} w={w} size={22}/>
  </Board>;
};
