import React from 'react';
import { Board, Card, Wire, Common, Item, useBoard, phase, C } from './shared';
/** Peso é avaliação editorial explícita, nunca medida científica implícita. */
export const BalancaCusto: React.FC<Common & { ganho:Item; custo:Item; pesoGanho?:number; pesoCusto?:number; fonte?:string }> = p => {
 const b=useBoard(),t=phase(b.f,p.len,.25,.4);const diff=Math.max(-1,Math.min(1,((p.pesoCusto??2)-(p.pesoGanho??1))/3));const tilt=diff*13*t,cx=b.w/2,cy=b.V?600:430,span=b.V?360:610;
 return <Board {...p}><div style={{position:'absolute',left:cx-16,top:cy-30,width:32,height:b.V?280:220,background:C.yellow,clipPath:'polygon(40% 0,60% 0,100% 100%,0 100%)'}}/><div style={{position:'absolute',left:cx,top:cy,transform:`rotate(${tilt}deg)`}}><div style={{position:'absolute',left:-span,top:0,width:span*2,height:15,background:C.yellow,boxShadow:`5px 5px 0 ${C.red}`}}/>{[p.ganho,p.custo].map((item,i)=><div key={i} style={{position:'absolute',left:i?span-160:-span-160,top:70,transform:`rotate(${-tilt}deg)`}}><Wire x1={160} y1={-70} x2={160} y2={0} progress={1}/><Card item={{...item,tom:i?'vermelho':'azul'}} len={p.len} x={0} y={0} w={320} h={b.V?210:190}/></div>)}</div><div style={{position:'absolute',bottom:0,left:40,color:'#bcc5d9',fontSize:26}}>{p.fonte||'PESO NARRATIVO · AVALIAÇÃO EDITORIAL'}</div></Board>;
};
