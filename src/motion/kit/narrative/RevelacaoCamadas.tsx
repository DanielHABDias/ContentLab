import React from 'react';
import { Board, Card, Caption, Seal, Common, Item, useBoard, phase, C } from './shared';
export const RevelacaoCamadas: React.FC<Common & { revelacao: Item; camadas: string[]; conclusao?: string }> = p => {
 const b=useBoard();const n=(p.camadas||[]).slice(0,4);const y=150,h=b.h-320;
 return <Board {...p}><Card item={p.revelacao} len={p.len} x={50} y={y} w={b.w-100} h={h}/>{n.map((text,i)=>{const t=phase(b.f,p.len,.12+i*.17,.16);return <div key={i} style={{position:'absolute',left:50,top:y,width:b.w-100,height:h,clipPath:`inset(0 ${t*100}% 0 0)`,background:i%2?'#202a40':'#11131d',border:`4px solid ${i%2?C.blue:C.red}`,transform:`translateX(${-t*30}px)`,zIndex:n.length-i}}><div style={{position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(135deg,transparent 0 34px,#ffffff08 34px 36px)'}}/><Caption text={text} x={60} y={h*.35} w={b.w-220} size={95} tone={C.yellow}/></div>})}<Seal text={p.conclusao} len={p.len} at={.82} y={b.h-110} w={b.w}/></Board>;
};
