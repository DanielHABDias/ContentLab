import React from 'react';
import { Board,Card,Caption,Seal,Impact,Common,Item,useBoard,phase,hit,C } from './shared';
export const Contradicao:React.FC<Common & {afirmacao:Item;prova:Item;veredito?:string}> = p => {
  const b=useBoard(),turn=p.virada??.42,t=phase(b.f,p.len,turn),y=140,h=b.h-310;
  return <Board {...p} impactos={[turn,.76]}>
    <Card item={p.afirmacao} len={p.len} x={30} y={y} w={b.w-60} h={h} entrada="esquerda" style={{opacity:1-t*.72,transform:`perspective(1300px) translateX(${-t*90}px) rotateY(${t*-12}deg) scale(${1-t*.06})`,transformOrigin:'left'}}/>
    <svg style={{position:'absolute',left:30,top:y,width:b.w-60,height:h,pointerEvents:'none'}} viewBox={`0 0 ${b.w-60} ${h}`}>
      <path d={`M 15 ${h*.7} L ${b.w-90} ${h*.25}`} pathLength={1} stroke={C.red} strokeWidth={14} strokeDasharray="1" strokeDashoffset={1-t}/>
      <path d={`M 15 ${h*.25} L ${b.w-90} ${h*.7}`} pathLength={1} stroke={C.red} strokeWidth={10} strokeDasharray="1" strokeDashoffset={1-phase(b.f,p.len,turn+.045,.1)}/>
    </svg>
    <Card item={p.prova} len={p.len} x={b.V?90:650} y={y+40} w={b.V?720:850} h={h-65} at={hit(p.len,turn)} entrada="direita" rotate={2}/>
    <Impact at={hit(p.len,turn)} x={b.V?450:950} y={y+h*.5} size={460} tone={C.red}/>
    <Caption text="MAS A PROVA DIZ…" x={70} y={y-45} w={b.w-140} size={30} tone={C.red} style={{opacity:t}}/>
    <Seal text={p.veredito} len={p.len} y={b.h-110} w={b.w}/>
  </Board>;
};
