import React from 'react';
import { Board,Caption,Card,Wire,Seal,Impact,Common,Item,useBoard,phase,hit,C } from './shared';
export const Bifurcacao:React.FC<Common & {pergunta:string;opcoes:Item[];escolhida?:number;conclusao?:string}> = p => {
  const b=useBoard(),items=(p.opcoes||[]).slice(0,2),turn=p.virada??.6,t=phase(b.f,p.len,turn),cw=b.V?380:610,y=b.V?450:280;
  const chosen=p.escolhida!==undefined&&p.escolhida>=0&&p.escolhida<items.length;
  return <Board {...p} impactos={chosen?[turn]:[]}>
    <Caption text={p.pergunta} x={100} y={130} w={b.w-200} size={70} style={{textAlign:'center',opacity:phase(b.f,p.len,0),transform:`translateY(${(1-phase(b.f,p.len,0))*-70}px)`}}/>
    {items.map((item,i)=>{const x=b.V?i*480:60+i*850,selected=p.escolhida===i;return <React.Fragment key={i}>
      <Wire x1={b.w/2} y1={b.V?320:235} x2={x+cw/2} y2={y} progress={phase(b.f,p.len,.15+i*.1)} tone={selected&&t>.1?C.yellow:C.blue} bend={i?45:-45}/>
      <Card item={item} len={p.len} x={x} y={y} w={cw} h={b.V?340:280} at={hit(p.len,.2+i*.12)} entrada={i?'direita':'esquerda'} style={{transform:`perspective(1300px) translateX(${chosen?(selected?(i?-1:1)*t*25:0):0}px) translateZ(${chosen?(selected?t*55:-t*100):0}px) rotateY(${chosen&&!selected?(i?1:-1)*t*12:0}deg)`,opacity:chosen&&!selected?1-t*.65:1,filter:selected?`drop-shadow(0 0 ${t*22}px ${C.yellow})`:undefined}}/>
      {chosen&&selected&&<Impact at={hit(p.len,turn)} x={x+cw/2} y={y+140} size={470}/>}
    </React.Fragment>})}
    <Seal text={p.conclusao} len={p.len} y={b.h-110} w={b.w}/>
  </Board>;
};
