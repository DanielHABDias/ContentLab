import React from 'react';
import { Board,Caption,Media,Wire,Impact,useAsset,Common,useBoard,phase,hit,C,slide } from './shared';
import { containFocus } from './choreography';
/** Same source and exact contain geometry in the panel and lens. */
export const LupaEvidencia:React.FC<Common & {midia:string;foco?:{x:number;y:number};ampliacao?:number;detalhe?:string;fonte?:string}> = p => {
  const b=useBoard(),asset=useAsset(p.midia),t=phase(b.f,p.len,.15,.3),x=Math.max(0,Math.min(1,p.foco?.x??.5)),y=Math.max(0,Math.min(1,p.foco?.y??.5)),z=Math.max(1.2,Math.min(4,p.ampliacao??2));
  const bh=b.h-320,bw=b.w-100,d=b.V?370:460,focus=containFocus(asset?.w,asset?.h,bw,bh,x,y);
  const start={x:50+focus.x,y:135+focus.y},end={x:b.V?b.w*.57:b.w*.74,y:b.V?b.h*.53:b.h*.48};
  const cx=start.x+(end.x-start.x)*t,cy=start.y+(end.y-start.y)*t-Math.sin(t*Math.PI)*85;
  const magnify=1+(z-1)*phase(b.f,p.len,.2,.34),entry=slide(b.f,0,b.fps*.32),label=phase(b.f,p.len,.48);
  return <Board {...p} impactos={[.48]}>
    <div style={{position:'absolute',left:50,top:135,width:bw,height:bh,overflow:'hidden',border:`5px solid ${C.blue}`,clipPath:`inset(0 ${100-entry*100}% 0 0)`}}><Media asset={asset} len={p.len} fit="contain" style={{transform:'none'}}/></div>
    <Wire x1={start.x} y1={start.y} x2={cx} y2={cy} progress={t} tone={C.yellow}/>
    <div style={{position:'absolute',left:start.x-32,top:start.y-32,width:64,height:64,border:`4px solid ${C.yellow}`,opacity:t,transform:`rotate(${(1-t)*45}deg)`}}/>
    <div style={{position:'absolute',left:cx-d/2,top:cy-d/2,width:d,height:d,borderRadius:'50%',border:`10px solid ${C.yellow}`,boxShadow:`10px 10px 0 ${C.ink},0 0 30px #f5c51855`,overflow:'hidden',transform:`scale(${t}) rotate(${(1-t)*-15}deg)`,background:C.ink}}>
      <div style={{position:'absolute',width:focus.w*magnify,height:focus.h*magnify,left:d/2-x*focus.w*magnify,top:d/2-y*focus.h*magnify}}><Media asset={asset} len={p.len} fit="contain" style={{transform:'none'}}/></div>
    </div>
    <Impact at={hit(p.len,.48)} x={cx} y={cy} size={d+150}/>
    <Caption text={p.detalhe} x={70} y={b.h-150} w={b.w-140} size={60} tone={C.yellow} style={{opacity:label,transform:`translateY(${(1-label)*35}px)`}}/>
    <Caption text={p.fonte} x={70} y={b.h-45} w={b.w-140} size={25} style={{opacity:entry}}/>
  </Board>;
};
