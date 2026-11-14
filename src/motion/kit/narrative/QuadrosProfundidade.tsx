import React from 'react';
import { Board,Card,Caption,Common,Item,useBoard,phase,hit,linear } from './shared';
/** Staggered Z entries, a lateral travelling camera and a focus hand-off between planes. */
export const QuadrosProfundidade:React.FC<Common & {planos:Item[];profundidade?:number}> = p => {
  const b=useBoard(),items=(p.planos||[]).slice(0,4),move=linear(b.f,p.len,.18,.68),depth=Math.max(30,Math.min(130,p.profundidade??85));
  const focus=move*Math.max(0,items.length-1),active=Math.round(focus);
  return <Board {...p} camera={{x:(.5-move)*(b.V?20:65)}}>
    <div style={{position:'absolute',inset:'110px 0 80px',perspective:1900,perspectiveOrigin:`${35+move*30}% 50%`,transformStyle:'preserve-3d'}}>
      {items.map((item,i)=>{const distance=Math.abs(focus-i),shine=1-Math.min(1,distance)*.4;return <Card key={i} item={item} len={p.len} x={b.V?100+i*35:35+i*(items.length>3?305:400)} y={b.V?50+i*(items.length>3?120:145):75+i*22} w={b.V?570:510} h={b.V?(items.length>3?280:330):430} at={hit(p.len,i*.12)} entrada="profundidade" style={{transform:`translate3d(${(move-.5)*(i+1)*-75}px,0,${i*depth+Math.max(0,1-distance)*45}px) rotateY(${-15+move*24}deg)`,filter:`brightness(${shine})`,zIndex:i}}/>})}
    </div>
    <Caption text={items[active]?.titulo} x={30} y={b.h-70} w={b.w-60} size={48} style={{textAlign:'center'}}/>
  </Board>;
};
