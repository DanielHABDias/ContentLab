import React from 'react';
import { Board, Caption, Card, Seal, Common, Item, useBoard, phase, hit, C } from './shared';
export const PecaAusente:React.FC<Common & { contexto:Item[]; ausente:Item; pergunta?:string; revelar?:boolean }> = p=>{
 const b=useBoard();const items=(p.contexto||[]).slice(0,2);const reveal=p.revelar!==false;const t=reveal?phase(b.f,p.len,p.virada??.6):0;const cw=b.V?700:460;
 return <Board {...p}>{items.map((item,i)=><Card key={i} item={item} len={p.len} x={b.V?100:i*550} y={b.V?130+i*230:180} w={cw} h={b.V?190:360} at={hit(p.len,i*.15)}/>)}<div style={{position:'absolute',left:b.V?100:1100,top:b.V?610:180,width:cw,height:b.V?230:360,border:`5px dashed ${C.yellow}`,background:'#0b0b10aa'}}><Caption text="?" x={0} y={45} w={cw} size={150} tone={C.yellow} style={{textAlign:'center',opacity:1-t}}/>{reveal&&<Card item={p.ausente} len={p.len} x={0} y={0} w={cw-10} h={b.V?220:350} at={hit(p.len,p.virada??.6)} style={{opacity:t}}/>}</div><Seal text={p.pergunta} len={p.len} at={.25} y={b.h-110} w={b.w}/></Board>;
};
