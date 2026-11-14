import React from 'react';
import { Board, Card, Wire, Caption, Common, Item, useBoard, phase, hit, C } from './shared';
export const CronologiaRamos: React.FC<Common & { origem: Item; ramos: (Item & { data?: string })[] }> = p => {
  const b=useBoard(); const rows=(p.ramos||[]).slice(0,3); const ox=b.V?250:0, oy=b.V?130:300; const cw=b.V?380:420;
  return <Board {...p}><Card item={p.origem} len={p.len} x={ox} y={oy} w={cw} h={200}/>{rows.map((item,i)=>{const x=b.V?i*300:1050,y=b.V?590:130+i*195;return <React.Fragment key={i}><Wire x1={ox+cw/2} y1={oy+200} x2={x+(b.V?125:210)} y2={y} progress={phase(b.f,p.len,.18+i*.18)} tone={i%2?C.red:C.blue}/><Caption text={item.data} x={x} y={y-45} w={b.V?260:420} size={32} tone={C.yellow}/><Card item={item} len={p.len} x={x} y={y} w={b.V?250:420} h={b.V?260:135} at={hit(p.len,.25+i*.18)}/></React.Fragment>})}</Board>;
};
