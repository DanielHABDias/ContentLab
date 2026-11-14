import React from 'react';
import { Board,Card,Caption,Wire,Impact,Common,Item,useBoard,phase,hit,C } from './shared';
export const Convergencia:React.FC<Common & {frentes:Item[];encontro:Item}> = p => {
  const b=useBoard(),items=(p.frentes||[]).slice(0,3),target={x:b.V?170:1040,y:b.V?650:270},tw=b.V?560:530,th=b.V?290:320;
  const join={x:b.V?target.x+tw/2:target.x,y:b.V?target.y:target.y+th/2},arrival=.65,echo=phase(b.f,p.len,arrival,.18);
  return <Board {...p} impactos={[arrival]} camera={{zoom:1+echo*.025}}>
    {items.map((item,i)=>{const x=b.V?i*300:30,y=b.V?140:130+i*200,tx=b.V?0:echo*55;return <React.Fragment key={i}>
      <Wire x1={x+(b.V?135:510)+tx} y1={y+(b.V?240:80)} x2={join.x} y2={join.y} progress={phase(b.f,p.len,.2+i*.08,.36)} tone={[C.blue,C.red,C.yellow][i]} bend={b.V?(i-1)*45:55}/>
      <Card item={item} len={p.len} x={x} y={y} w={b.V?270:510} h={b.V?240:160} at={hit(p.len,i*.1)} entrada={b.V?'cima':'esquerda'} style={{transform:`translate(${tx}px,${b.V?echo*25:0}px)`,filter:`brightness(${1-echo*.2})`}}/>
    </React.Fragment>})}
    <Impact at={hit(p.len,arrival)} x={join.x} y={join.y} size={620}/>
    <Card item={{...p.encontro,tom:'amarelo'}} len={p.len} x={target.x} y={target.y} w={tw} h={th} at={hit(p.len,arrival)} entrada="profundidade" style={{filter:`drop-shadow(0 0 ${echo*20}px #f5c51855)`}}/>
    <Caption text="O MESMO PONTO DE CHEGADA" x={target.x} y={target.y+th+30} w={tw} size={32} tone={C.yellow} style={{opacity:phase(b.f,p.len,.7),transform:`translateY(${(1-phase(b.f,p.len,.7))*25}px)`}}/>
  </Board>;
};
