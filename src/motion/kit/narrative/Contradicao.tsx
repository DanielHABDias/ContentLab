import React from 'react';
import { Board, Card, Caption, Seal, Common, Item, useBoard, phase, hit, shake, C } from './shared';
export const Contradicao: React.FC<Common & { afirmacao: Item; prova: Item; veredito?: string }> = p => {
 const b=useBoard();const t=phase(b.f,p.len,p.virada??.42);const y=140,h=b.h-310;
 return <Board {...p}><div style={{transform:shake(b.f,[hit(p.len,p.virada??.42)],14)}}><Card item={p.afirmacao} len={p.len} x={30} y={y} w={b.w-60} h={h} style={{opacity:1-t*.72,transform:`translateX(${-t*60}px)`}}/><div style={{position:'absolute',left:30,top:y+h*.5,width:(b.w-60)*t,height:12,background:C.red,transform:'rotate(-8deg)',transformOrigin:'left'}}/><Card item={p.prova} len={p.len} x={b.V?90:650} y={y+40} w={b.V?720:850} h={h-65} at={hit(p.len,p.virada??.42)} rotate={2}/><Caption text="MAS A PROVA DIZ…" x={70} y={y-45} w={b.w-140} size={30} tone={C.red} style={{opacity:t}}/></div><Seal text={p.veredito} len={p.len} y={b.h-110} w={b.w}/></Board>;
};
