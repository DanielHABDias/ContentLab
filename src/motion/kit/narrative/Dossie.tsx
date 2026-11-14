import React from 'react';
import { Board,Card,Caption,Wire,Seal,Impact,Common,Item,useBoard,phase,hit,C,pop } from './shared';
/** Clue arrival → traced connection → status stamp → conclusion. */
export const Dossie:React.FC<Common & {pistas:(Item & {status?:string})[];conclusao?:string}> = p => {
  const b=useBoard(),items=(p.pistas||[]).slice(0,4),cw=b.V?370:340,ch=b.V?280:390;
  const pos=items.map((_,i)=>({x:b.V?(items.length===3&&i===2?230:(i%2)*460):(b.w-(Math.max(0,items.length-1)*410+cw))/2+i*410,y:b.V?140+Math.floor(i/2)*350:160+(i%2)*30}));
  return <Board {...p} impactos={[.5,.76]} camera={{x:Math.sin(b.f/b.fps*.7)*7}}>
    {items.map((_,i)=>i>0&&<Wire key={i} x1={pos[i-1].x+cw/2} y1={pos[i-1].y+ch*.45} x2={pos[i].x+cw/2} y2={pos[i].y+ch*.45} bend={b.V?50:0} progress={phase(b.f,p.len,.12+i*.13)} tone={C.red}/>)}
    {items.map((item,i)=>{const at=hit(p.len,i*.13),stamp=hit(p.len,.5+i*.04);return <React.Fragment key={i}>
      <Card item={item} len={p.len} {...pos[i]} w={cw} h={ch} at={at} entrada={i%2?'direita':'esquerda'} rotate={i%2?2:-2}/>
      {b.f>=at+6&&<div style={{position:'absolute',left:pos[i].x+cw/2-9,top:pos[i].y-9,width:18,height:18,borderRadius:'50%',background:C.red,boxShadow:`3px 3px 0 ${C.ink}`,transform:`scale(${pop(b.f,at+6)})`}}/>}
      {b.f>=at&&<Caption text={b.f>=stamp?item.status||'EM ANÁLISE':`PISTA ${i+1}`} x={pos[i].x+12} y={pos[i].y+ch+25} w={cw-20} size={34} tone={C.yellow} style={{transform:b.f>=stamp?`scale(${pop(b.f,stamp)}) rotate(-3deg)`:undefined,transformOrigin:'left'}}/>}
      <Impact at={stamp} x={pos[i].x+cw/2} y={pos[i].y+ch+40} size={150} tone={C.red}/>
    </React.Fragment>})}
    <Seal text={p.conclusao} len={p.len} y={b.h-110} w={b.w}/>
  </Board>;
};
