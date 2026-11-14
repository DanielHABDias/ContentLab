import React from 'react';
import { Board, Card, Wire, Seal, Common, Item, useBoard, phase, hit, C } from './shared';
export const EfeitoDomino: React.FC<Common & { etapas: Item[]; conclusao?: string }> = p => {
 const b=useBoard();const items=(p.etapas||[]).slice(0,4);const cw=b.V?580:300,ch=b.V?155:390;
 return <Board {...p}>{items.map((item,i)=>{const x=b.V?80+i*45:i*410,y=b.V?130+i*185:170;const t=phase(b.f,p.len,.12+i*.15);return <React.Fragment key={i}>{i>0&&<Wire x1={b.V?x-45+cw/2:x-110} y1={b.V?y-30:y+ch/2} x2={b.V?x+cw/2:x} y2={b.V?y:y+ch/2} progress={t} tone={C.red}/>}<Card item={{...item,tom:i===items.length-1?'vermelho':item.tom}} len={p.len} x={x} y={y} w={cw} h={ch} at={hit(p.len,i*.15)} style={{transformOrigin:b.V?'top left':'bottom right',transform:`perspective(900px) rotate${b.V?'X':'Z'}(${(i===items.length-1?0:8)*t}deg)`,opacity:.4+.6*t}}/></React.Fragment>})}<Seal text={p.conclusao} len={p.len} y={b.h-110} w={b.w}/></Board>;
};
