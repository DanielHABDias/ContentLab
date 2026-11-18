import React from 'react';
import { Board,Card,Caption,Wire,Impact,Common,Item,useBoard,phase,hit,C } from './shared';

/** A relationship changes while both people remain in view. */
export const Vinculo:React.FC<Common & {pessoas:Item[];antes:string;depois:string;acontecimento?:string}> = p => {
 const b=useBoard(),turn=p.virada??.55,q=phase(b.f,p.len,turn,.16),people=(p.pessoas||[]).slice(0,2);
 const w=b.V?370:570,h=b.V?390:430,y=b.V?190:160,xs=b.V?[30,500]:[30,1000];
 return <Board {...p} impactos={[turn]} camera={{zoom:1+q*.025}}>
  <Wire x1={xs[0]+w} y1={y+h/2} x2={xs[1]} y2={y+h/2} progress={phase(b.f,p.len,.18)} tone={q>.5?C.red:C.yellow} dashed={q>.5}/>
  {people.map((item,i)=><Card key={i} item={item} len={p.len} x={xs[i]} y={y} w={w} h={h} at={hit(p.len,i*.12)} entrada={i?'direita':'esquerda'}/>)}
  <Caption text={b.f<hit(p.len,turn)?p.antes:p.depois} x={b.V?100:605} y={b.V?640:290} w={b.V?700:360} size={64} tone={q>.5?C.red:C.yellow} style={{textAlign:'center'}}/>
  <Caption text={p.acontecimento} x={60} y={b.V?820:660} w={b.w-120} size={44} style={{opacity:q,textAlign:'center'}}/>
  <Impact at={hit(p.len,turn)} x={b.w/2} y={y+h/2}/>
 </Board>;
};

/** An audiovisual recollection opens over the current moment and returns to it. */
export const Memoria:React.FC<Common & {presente:Item;lembranca:Item;retorno?:string}> = p => {
 const b=useBoard(),open=phase(b.f,p.len,.22,.15),close=phase(b.f,p.len,.72,.15),show=open*(1-close);
 return <Board {...p} camera={{zoom:1+show*.025}}>
  <Card item={p.presente} len={p.len} x={30} y={150} w={b.w-60} h={b.V?710:510} style={{filter:`blur(${show*9}px) brightness(${1-show*.55})`}}/>
  <div style={{position:'absolute',inset:0,opacity:show,transform:`translateY(${(1-open)*100}px) scale(${.85+open*.15})`,transformOrigin:'center'}}>
   <Card item={p.lembranca} len={p.len} x={b.V?90:270} y={b.V?260:195} w={b.V?720:1060} h={b.V?490:400} at={hit(p.len,.22)} rotate={-2}/>
   <Caption text="LEMBRANÇA" x={b.V?90:270} y={b.V?200:135} w={600} size={40} tone={C.yellow}/>
  </div>
  <Caption text={p.retorno} x={60} y={b.V?930:700} w={b.w-120} size={45} style={{opacity:close,textAlign:'center'}}/>
 </Board>;
};

/** Two simultaneous responsibilities; emphasis alternates without declaring a winner. */
export const DuplaVida:React.FC<Common & {lados:Item[];trocas?:number[]}> = p => {
 const b=useBoard(),cues=(p.trocas??[.28,.55,.78]).filter(t=>t>=0&&t<1).sort((a,c)=>a-c),active=cues.filter(t=>b.f>=hit(p.len,t)).length%2;
 return <Board {...p} impactos={cues}>
  {(p.lados||[]).slice(0,2).map((item,i)=>{const w=b.V?840:740,h=b.V?350:490,x=b.V?30:30+i*800,y=b.V?150+i*430:160;
   return <React.Fragment key={i}><Card item={item} len={p.len} x={x} y={y} w={w} h={h} at={hit(p.len,i*.1)} entrada={i?'direita':'esquerda'} style={{filter:active===i?'brightness(1.12)':'brightness(.48)',transform:`translateY(${active===i?-12:0}px)`}}/>
    <Caption text={active===i?'EM FOCO':''} x={x+20} y={y+18} w={w-40} size={36} tone={C.yellow}/></React.Fragment>;
  })}
 </Board>;
};
