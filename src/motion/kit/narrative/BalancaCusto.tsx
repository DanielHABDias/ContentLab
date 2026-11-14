import React from 'react';
import { spring } from 'remotion';
import { Board,Card,Caption,Impact,Common,Item,useBoard,phase,hit,C } from './shared';
/** Loading each pan changes the balance; damped spring and counter-rotation preserve readable cards. */
export const BalancaCusto:React.FC<Common & {ganho:Item;custo:Item;pesoGanho?:number;pesoCusto?:number;fonte?:string}> = p => {
  const b=useBoard(),diff=Math.max(-1,Math.min(1,((p.pesoCusto??2)-(p.pesoGanho??1))/3)),at=hit(p.len,.4);
  const settle=b.f<at?0:spring({frame:b.f-at,fps:b.fps,config:{damping:9,stiffness:130,mass:1.2}});
  const preload=-6*phase(b.f,p.len,.1,.16)*(1-phase(b.f,p.len,.32,.1)),tilt=preload+diff*15*settle;
  const cx=b.w/2,cy=b.V?550:330,span=b.V?300:540,enter=phase(b.f,p.len,0);
  const sway=b.f<at?0:Math.sin((b.f-at)/b.fps*9)*Math.exp(-(b.f-at)/b.fps*3)*5;
  return <Board {...p} impactos={[.28,.4]}>
    <div style={{position:'absolute',left:cx-25,top:cy-10,width:50,height:b.V?340:280,background:C.yellow,clipPath:'polygon(44% 0,56% 0,100% 100%,0 100%)',transform:`scaleY(${enter})`,transformOrigin:'bottom'}}/>
    <div style={{position:'absolute',left:cx,top:cy,transform:`rotate(${tilt}deg)`,width:0,height:0}}>
      <div style={{position:'absolute',left:-span,top:0,width:span*2,height:18,background:C.yellow,boxShadow:`5px 5px 0 ${C.red}`,transform:`scaleX(${enter})`}}/>
      {[p.ganho,p.custo].map((item,i)=><div key={i} style={{position:'absolute',left:i?span-160:-span-160,top:0,width:320,height:340,transform:`rotate(${-tilt+(i?1:-1)*sway}deg)`,transformOrigin:'160px 0'}}>
        <svg style={{position:'absolute',left:0,top:0,width:320,height:130,opacity:phase(b.f,p.len,i?.28:.08)}}><path d="M 160 0 L 20 115 L 300 115 Z" fill="none" stroke={C.yellow} strokeWidth={5}/></svg>
        <Card item={{...item,tom:i?'vermelho':'azul'}} len={p.len} x={0} y={125} w={320} h={b.V?250:220} at={hit(p.len,i?.28:.08)} entrada="cima"/>
      </div>)}
    </div>
    <Impact at={at} x={cx} y={cy} size={230}/>
    <Caption text={p.fonte||'PESO NARRATIVO · AVALIAÇÃO EDITORIAL'} x={40} y={b.h-25} w={b.w-80} size={26} style={{textAlign:'center'}}/>
  </Board>;
};
