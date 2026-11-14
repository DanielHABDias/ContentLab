import React from 'react';
import { Board,Card,Caption,Seal,Impact,Common,Item,useBoard,phase,hit,C } from './shared';
export const RevelacaoCamadas:React.FC<Common & {revelacao:Item;camadas:string[];conclusao?:string}> = p => {
  const b=useBoard(),layers=(p.camadas||[]).slice(0,4),y=150,h=b.h-320,last=.12+Math.max(0,layers.length-1)*.56/Math.max(1,layers.length);
  const reveal=phase(b.f,p.len,last,.17);
  return <Board {...p} impactos={[last,.82]} camera={{zoom:1+reveal*.035}}>
    <Card item={p.revelacao} len={p.len} x={50} y={y} w={b.w-100} h={h} entrada="profundidade"/>
    {layers.map((text,i)=>{const t=phase(b.f,p.len,.12+i*.56/layers.length,.16),dir=i%2?1:-1;return t<1&&<div key={i} style={{position:'absolute',left:50,top:y,width:b.w-100,height:h,perspective:1400,zIndex:layers.length-i,opacity:1-Math.max(0,(t-.75)/.25),transform:`translateX(${dir*t*(b.w+120)}px) translateY(${-t*70}px) rotate(${dir*t*9}deg)`}}>
      <div style={{position:'absolute',inset:0,background:i%2?'#202a40':'#11131d',border:`5px solid ${i%2?C.blue:C.red}`,boxShadow:`12px 12px 0 ${C.ink}`,transform:`rotateY(${dir*t*30}deg)`,transformOrigin:dir>0?'right':'left'}}>
        <div style={{position:'absolute',inset:0,opacity:.16,backgroundImage:'radial-gradient(#fff 18%,transparent 22%)',backgroundSize:'20px 20px'}}/>
        <Caption text={`${String(i+1).padStart(2,'0')} / ${layers.length}`} x={40} y={35} w={240} size={35} tone={C.blue}/>
        <Caption text={text} x={50} y={h*.35} w={b.w-200} size={100} tone={C.yellow}/>
      </div>
    </div>})}
    <Impact at={hit(p.len,last+.13)} x={b.w/2} y={y+h/2} size={650}/>
    <Seal text={p.conclusao} len={p.len} at={.82} y={b.h-110} w={b.w}/>
  </Board>;
};
