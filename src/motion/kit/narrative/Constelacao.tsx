import React from 'react';
import { Board, Caption, Card, Wire, Common, Item, useBoard, phase, hit, C } from './shared';
export const Constelacao: React.FC<Common & { tese: string; ideias: Item[]; ligacoes?: [number,number][] }> = p => {
 const b=useBoard();const items=(p.ideias||[]).slice(0,6);const cx=b.w/2,cy=b.h*.53;
 const pos=items.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/items.length;return {x:cx+Math.cos(a)*(b.V?290:590),y:cy+Math.sin(a)*(b.V?310:240)}});
 return <Board {...p}>{pos.map((v,i)=><Wire key={i} x1={cx} y1={cy} x2={v.x} y2={v.y} progress={phase(b.f,p.len,.1+i*.07)} tone={i%2?C.blue:C.red}/>)}{(p.ligacoes||[]).map(([a,c],i)=>pos[a]&&pos[c]?<Wire key={`l${i}`} x1={pos[a].x} y1={pos[a].y} x2={pos[c].x} y2={pos[c].y} progress={phase(b.f,p.len,.6)} dashed/>:null)}{items.map((item,i)=><Card key={i} item={item} len={p.len} x={pos[i].x-115} y={pos[i].y-70} w={230} h={140} at={hit(p.len,.08+i*.07)}/>)}<div style={{position:'absolute',left:cx-190,top:cy-85,width:380,height:170,background:C.ink,border:`5px solid ${C.yellow}`,boxShadow:`0 0 ${20+phase(b.f,p.len,.65)*35}px #f5c51840`,borderRadius:'50%'}}><Caption text={p.tese} x={40} y={40} w={300} size={55} tone={C.yellow} style={{textAlign:'center'}}/></div></Board>;
};
