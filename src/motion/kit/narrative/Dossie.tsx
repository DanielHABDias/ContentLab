import React from 'react';
import { Board, Card, Caption, Wire, Seal, Common, Item, useBoard, phase, hit, C } from './shared';
/** Pistas passam de suspeita a evidência; conexões são inferências declaradas, não dados inventados. */
export const Dossie: React.FC<Common & { pistas: (Item & { status?: string })[]; conclusao?: string }> = p => {
  const b = useBoard(); const items = (p.pistas || []).slice(0, 4); const cw = b.V ? 370 : 340, ch = b.V ? 280 : 390;
  const pos = items.map((_, i) => ({ x: b.V ? (i % 2) * 460 : i * 410, y: b.V ? 140 + Math.floor(i / 2) * 350 : 170 + (i % 2) * 30 }));
  return <Board {...p}>{items.map((_, i) => i > 0 && <Wire key={i} x1={pos[i-1].x+cw/2} y1={pos[i-1].y+ch/2} x2={pos[i].x+cw/2} y2={pos[i].y+ch/2} progress={phase(b.f,p.len,.15+i*.13)} tone={C.red}/>)}{items.map((item,i)=><React.Fragment key={i}><Card item={item} len={p.len} {...pos[i]} w={cw} h={ch} at={hit(p.len,i*.13)} rotate={i%2?2:-2}/><Caption text={b.f>hit(p.len,.5+i*.04)?item.status||'EM ANÁLISE':`PISTA ${i+1}`} x={pos[i].x+12} y={pos[i].y+ch+25} w={cw} size={30} tone={C.yellow}/></React.Fragment>)}<Seal text={p.conclusao} len={p.len} y={b.h-110} w={b.w}/></Board>;
};
