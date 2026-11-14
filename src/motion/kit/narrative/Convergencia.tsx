import React from 'react';
import { Board, Card, Caption, Wire, Common, Item, useBoard, phase, hit, C } from './shared';
export const Convergencia:React.FC<Common & { frentes:Item[]; encontro:Item }> = p=>{
 const b=useBoard();const items=(p.frentes||[]).slice(0,3);const target={x:b.V?200:1100,y:b.V?700:300};
 return <Board {...p}>{items.map((item,i)=>{const x=b.V?i*300:30,y=b.V?150:130+i*190;return <React.Fragment key={i}><Card item={item} len={p.len} x={x} y={y} w={b.V?250:500} h={b.V?270:140} at={hit(p.len,i*.1)}/><Wire x1={x+(b.V?125:500)} y1={y+(b.V?270:70)} x2={target.x+(b.V?250:0)} y2={target.y+(b.V?0:100)} progress={phase(b.f,p.len,.2+i*.08,.36)} tone={[C.blue,C.red,C.yellow][i]}/></React.Fragment>})}<Card item={{...p.encontro,tom:'amarelo'}} len={p.len} x={target.x} y={target.y} w={500} h={230} at={hit(p.len,.65)}/><Caption text="O MESMO PONTO DE CHEGADA" x={target.x} y={target.y+260} w={500} size={29} tone={C.yellow}/></Board>;
};
