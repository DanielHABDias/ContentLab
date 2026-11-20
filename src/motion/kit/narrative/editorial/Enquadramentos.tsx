import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useAsset} from '../../stage';
import {Stage,Source,Fill,Tag,Stroke,Clip,Props,useCanvas,C} from './media';
import {cueFrame,progress,smooth,pauseFrame} from './timing';

export const EnquadramentoAlternado:React.FC<Props&{cenas:Clip[];ordem?:number[]}>=p=>{
 const {f}=useCanvas(),items=(p.cenas||[]).slice(0,4),order=(p.ordem||items.map((_,i)=>i)).slice(0,8),n=Math.max(1,order.length),index=Math.min(n-1,Math.floor(f*n/p.len)),item=items[order[index]]||items[0];
 return <Stage {...p}>{item&&<><Source item={item} len={p.len} from={Math.round(index*p.len/n)} fixa/><Tag text={item.titulo} sub={item.fonte} top/></>}</Stage>;
};

export const DetalheContexto:React.FC<Props&{cena:Clip;detalhe?:{x:number;y:number;w?:number;h?:number};zoom?:number}>=p=>{
 const {f,W,H}=useCanvas(),asset=useAsset(p.cena?.midia),d=p.detalhe||{x:.5,y:.5},q=smooth(progress(f,p.len,.15,.63)),scale=(p.zoom||2.3)*(1-q)+q;
 const ratio=asset?.w&&asset?.h?asset.w/asset.h:W/H,iw=Math.min(W,H*ratio),ih=iw/ratio,px=(W-iw)/2+d.x*iw,py=(H-ih)/2+d.y*ih;
 return <Stage {...p}><AbsoluteFill style={{transform:`translate(${(W/2-px)*(1-q)}px,${(H/2-py)*(1-q)}px) scale(${scale})`,transformOrigin:`${px}px ${py}px`}}>
  <Source item={p.cena} len={p.len} fit="contain" fixa/>
  <Stroke x={px-(d.w||.13)*iw/2} y={py-(d.h||.16)*ih/2} w={(d.w||.13)*iw} h={(d.h||.16)*ih} show={smooth(progress(f,p.len,.08,.13))}/>
 </AbsoluteFill><Tag text={p.titulo} top/></Stage>;
};

export const AnotacaoCena:React.FC<Props&{cena:Clip;em?:number;pausa?:number;ponto?:{x:number;y:number;w?:number;h?:number};marca?:'circulo'|'seta'|'sublinhado';texto?:string}>=p=>{
 const {f,W,H}=useCanvas(),state=pauseFrame(f,p.len,p.em??.32,p.pausa??.35),d=p.ponto||{x:.5,y:.5,w:.18,h:.2},x=d.x*W,y=d.y*H,w=(d.w||.18)*W,h=(d.h||.2)*H,q=smooth(progress(f-state.start,p.len,0,.08));
 return <Stage {...p}><Fill item={p.cena} len={p.len} frame={state.frame}/>{state.holding&&<div data-editorial-annotation>
  {(!p.marca||p.marca==='circulo')&&<Stroke x={x-w/2} y={y-h/2} w={w} h={h} show={q}/>}
  {p.marca==='sublinhado'&&<div style={{position:'absolute',left:x-w/2,top:y+h/2,width:w*q,height:8,background:C.yellow,boxShadow:`2px 3px 0 ${C.ink}`,transform:'rotate(-2deg)',transformOrigin:'left'}}/>}
  {p.marca==='seta'&&<svg style={{position:'absolute',inset:0,width:W,height:H,opacity:q}}><path d={`M ${x-w} ${y+h} Q ${x-w*.75} ${y+h*.2} ${x} ${y} l ${-w*.2} ${-h*.05} M ${x} ${y} l ${-w*.06} ${h*.23}`} fill="none" stroke={C.ink} strokeWidth={13}/><path d={`M ${x-w} ${y+h} Q ${x-w*.75} ${y+h*.2} ${x} ${y} l ${-w*.2} ${-h*.05} M ${x} ${y} l ${-w*.06} ${h*.23}`} fill="none" stroke={C.yellow} strokeWidth={6}/></svg>}
  <Tag text={p.texto} top/>
 </div>}</Stage>;
};
