import React from 'react';
import { Board,Caption,Card,Seal,Impact,Common,Item,useBoard,phase,hit,C } from './shared';
export const PecaAusente:React.FC<Common & {contexto:Item[];ausente:Item;pergunta?:string;revelar?:boolean}> = p => {
  const b=useBoard(),items=(p.contexto||[]).slice(0,2),reveal=p.revelar!==false,turn=p.virada??.6,t=reveal?phase(b.f,p.len,turn):0,cw=b.V?700:460,x=b.V?100:1100,y=b.V?610:180,h=b.V?230:360;
  return <Board {...p} impactos={reveal?[turn]:[]}>
    {items.map((item,i)=><Card key={i} item={item} len={p.len} x={b.V?100:i*550} y={b.V?130+i*230:180} w={cw} h={b.V?190:360} at={hit(p.len,i*.15)} entrada={i?'direita':'esquerda'}/>)}
    <div style={{position:'absolute',left:x,top:y,width:cw,height:h,border:`5px dashed ${C.yellow}`,background:'#0b0b10aa',opacity:phase(b.f,p.len,.2),transform:`scale(${1+Math.sin(b.f/b.fps*3)*.015*(1-t)})`}}>
      <Caption text="?" x={0} y={h*.2} w={cw} size={150} tone={C.yellow} style={{textAlign:'center',opacity:1-t,transform:`rotateY(${t*90}deg)`}}/>
    </div>
    {reveal&&<Card item={p.ausente} len={p.len} x={x+5} y={y+5} w={cw-10} h={h-10} at={hit(p.len,turn)} entrada="cima" rotate={0}/>}
    {reveal&&<Impact at={hit(p.len,turn)+Math.round(b.fps*.14)} x={x+cw/2} y={y+h/2} size={450}/>}
    <Seal text={p.pergunta} len={p.len} at={.28} y={b.h-110} w={b.w}/>
  </Board>;
};
