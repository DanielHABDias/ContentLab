import React from 'react';
import { Board,Caption,Card,Wire,Impact,Common,Item,useBoard,phase,hit,pop,C } from './shared';
export const Constelacao:React.FC<Common & {tese:string;ideias:Item[];ligacoes?:[number,number][]}> = p => {
  const b=useBoard(),items=(p.ideias||[]).slice(0,6),cx=b.w/2,cy=b.h*.53;
  const pos=items.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/items.length+Math.sin(b.f/b.fps*.5)*.035;return {x:cx+Math.cos(a)*(b.V?330:590),y:cy+Math.sin(a)*(b.V?315:240)}});
  return <Board {...p} impactos={[.65]} camera={{zoom:1+phase(b.f,p.len,.65,.2)*.025}}>
    {pos.map((v,i)=><Wire key={i} x1={cx} y1={cy} x2={v.x} y2={v.y} progress={phase(b.f,p.len,.12+i*.08)} tone={i%2?C.blue:C.red}/>)}
    {(p.ligacoes||[]).map(([a,c],i)=>pos[a]&&pos[c]?<Wire key={`l${i}`} x1={pos[a].x} y1={pos[a].y} x2={pos[c].x} y2={pos[c].y} bend={i%2?55:-55} progress={phase(b.f,p.len,.6)} dashed/>:null)}
    {items.map((item,i)=>{const t=phase(b.f,p.len,.08+i*.08,.16);return <Card key={i} item={item} len={p.len} x={cx+(pos[i].x-cx)*t-115} y={cy+(pos[i].y-cy)*t-75} w={230} h={150} at={hit(p.len,.08+i*.08)} entrada="profundidade"/>})}
    <div style={{position:'absolute',left:cx-170,top:cy-85,width:340,height:170,background:C.ink,border:`5px solid ${C.yellow}`,boxShadow:`0 0 ${20+phase(b.f,p.len,.65)*40}px #f5c51850`,borderRadius:'50%',transform:`scale(${pop(b.f,0,12)})`}}><Caption text={p.tese} x={30} y={45} w={280} size={60} tone={C.yellow} style={{textAlign:'center'}}/></div>
    <Impact at={hit(p.len,.65)} x={cx} y={cy} size={520}/>
  </Board>;
};
