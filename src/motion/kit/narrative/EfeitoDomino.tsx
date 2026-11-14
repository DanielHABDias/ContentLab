import React from 'react';
import { Board,Card,Caption,Wire,Seal,Impact,Common,Item,useBoard,phase,hit,C } from './shared';
/** Each consequence arrives, receives the hit, and transfers its momentum. */
export const EfeitoDomino:React.FC<Common & {etapas:Item[];conclusao?:string}> = p => {
  const b=useBoard(),items=(p.etapas||[]).slice(0,4),cw=b.V?580:300,ch=b.V?150:330;
  const hits=items.map((_,i)=>.16+i*.15);
  return <Board {...p} impactos={hits}>
    {!b.V&&<div style={{position:'absolute',left:0,top:560,width:b.w,height:6,background:C.blue,opacity:.5}}/>}
    {items.map((item,i)=>{const x=b.V?80+i*45:i*410,y=b.V?130+i*185:180,t=phase(b.f,p.len,hits[i],.11),fallen=i<items.length-1;return <React.Fragment key={i}>
      {i>0&&<Wire x1={b.V?x-45+cw/2:x-90} y1={b.V?y-35:535} x2={b.V?x+cw/2:x} y2={b.V?y:535} progress={phase(b.f,p.len,hits[i]-.06,.1)} tone={C.red}/>}
      <Card item={{...item,tom:i===items.length-1?'vermelho':item.tom}} len={p.len} x={x} y={y} w={cw} h={ch} at={hit(p.len,i*.07)} entrada={b.V?'esquerda':'baixo'} style={{transformOrigin:b.V?'50% 100%':'100% 100%',transform:b.V?`perspective(1000px) rotateX(${fallen?t*42:0}deg) translateY(${fallen?t*20:0}px)`:`rotate(${fallen?t*58:0}deg)`,filter:`brightness(${.65+t*.35})`,zIndex:i+1}}/>
      <Impact at={hit(p.len,hits[i])} x={x+cw*.65} y={b.V?y+ch:535} size={200} tone={C.red}/>
      {!b.V&&b.f>=hit(p.len,hits[i])&&<Caption text={item.titulo} x={x} y={590} w={cw+25} size={38} tone={C.yellow}/>}
    </React.Fragment>})}
    <Seal text={p.conclusao} len={p.len} y={b.h-110} w={b.w}/>
  </Board>;
};
