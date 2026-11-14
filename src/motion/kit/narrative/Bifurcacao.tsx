import React from 'react';
import { Board, Caption, Card, Wire, Seal, Common, Item, useBoard, phase, hit, C } from './shared';
export const Bifurcacao: React.FC<Common & { pergunta: string; opcoes: Item[]; escolhida?: number; conclusao?: string }> = p => {
 const b=useBoard(),items=(p.opcoes||[]).slice(0,2);const t=phase(b.f,p.len,p.virada??.6),cw=b.V?380:610,y=b.V?450:280;
 return <Board {...p}><Caption text={p.pergunta} x={100} y={130} w={b.w-200} size={65} style={{textAlign:'center'}}/>{items.map((item,i)=>{const x=b.V?i*480:60+i*850,selected=p.escolhida===i;return <React.Fragment key={i}><Wire x1={b.w/2} y1={235} x2={x+cw/2} y2={y} progress={phase(b.f,p.len,.15+i*.1)} tone={selected?C.yellow:C.blue}/><Card item={item} len={p.len} x={x} y={y} w={cw} h={b.V?340:280} at={hit(p.len,.2+i*.12)} style={{opacity:p.escolhida===undefined||selected?1:1-t*.75,filter:selected?`drop-shadow(0 0 ${t*18}px ${C.yellow})`:undefined}}/></React.Fragment>})}<Seal text={p.conclusao} len={p.len} y={b.h-110} w={b.w}/></Board>;
};
