import React from 'react';
import { Board,Card,Wire,Caption,Impact,Common,Item,useBoard,phase,hit,C,slide } from './shared';
export const CronologiaRamos:React.FC<Common & {origem:Item;ramos:(Item & {data?:string})[]}> = p => {
  const b=useBoard(),rows=(p.ramos||[]).slice(0,3),ox=b.V?220:30,oy=b.V?130:275,cw=b.V?460:500;
  const junction={x:b.V?450:800,y:b.V?460:425};
  return <Board {...p} impactos={[.18]} camera={{zoom:1+phase(b.f,p.len,.7,.25)*.025}}>
    <Wire x1={b.V?ox+cw/2:ox+cw} y1={b.V?oy+210:oy+150} x2={junction.x} y2={junction.y} progress={phase(b.f,p.len,.1,.12)}/>
    <Card item={p.origem} len={p.len} x={ox} y={oy} w={cw} h={b.V?210:300} entrada={b.V?'cima':'esquerda'}/>
    <Impact at={hit(p.len,.18)} {...junction} size={180}/>
    {rows.map((item,i)=>{const x=b.V?i*300:1000,y=b.V?590:115+i*205,at=hit(p.len,.25+i*.18),active=b.f>=at&&(i===rows.length-1||b.f<hit(p.len,.25+(i+1)*.18));return <React.Fragment key={i}>
      <Wire x1={junction.x} y1={junction.y} x2={b.V?x+135:x} y2={b.V?y:y+80} progress={phase(b.f,p.len,.18+i*.18)} tone={i%2?C.red:C.blue} bend={b.V?(i-1)*60:45}/>
      {b.f>=at&&<Caption text={item.data} x={x+10} y={y-42} w={b.V?260:530} size={34} tone={C.yellow} style={{opacity:slide(b.f,at,8),transform:`translateY(${(1-slide(b.f,at,8))*-30}px)`}}/>}
      <Card item={item} len={p.len} x={x} y={y} w={b.V?270:530} h={b.V?290:170} at={at} entrada={b.V?'baixo':'direita'} style={{filter:active?'drop-shadow(0 0 10px #2676e880)':undefined}}/>
      <Impact at={at} x={x+(b.V?135:265)} y={y+80} size={180} tone={i%2?C.red:C.blue}/>
    </React.Fragment>})}
  </Board>;
};
