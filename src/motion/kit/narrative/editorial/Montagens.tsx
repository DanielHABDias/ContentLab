import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage,Source,Fill,Tag,Chip,Clip,Props,useCanvas,C} from './media';
import {cueFrame,progress,smooth,segmentState,recallState} from './timing';

export const MontagemEncaixe:React.FC<Props&{cenas:Clip[]}>=p=>{
 const {f,W,H,V}=useCanvas(),items=(p.cenas||[]).slice(0,4),n=items.length,merge=smooth(progress(f,p.len,.78,.21));
 return <Stage {...p}>{items.map((item,i)=>{const enter=smooth(progress(f,p.len,i*.16,.14)),last=i===n-1,z=last?merge:0;
  const x=V?W*(i%2?.43:.04):W*(.025+i*.235),y=V?H*(.14+i*.115):H*(.2+(i%2)*.1),w=V?W*.53:W*.33,h=V?H*.23:H*.56;
  return <div key={i} style={{position:'absolute',left:x*(1-z)+(1-enter)*W*.22,top:y*(1-z),width:w+(W-w)*z,height:h+(H-h)*z,opacity:enter,zIndex:last&&z>0?20:i+1,transform:`rotate(${(1-z)*(i%2?3:-3)}deg)`}}>
   <AbsoluteFill style={{overflow:'hidden',clipPath:z===1?'none':'polygon(7% 0,100% 3%,93% 100%,0 97%)',background:C.ink}}><Source item={item} len={p.len} from={cueFrame(p.len,i*.16)}/></AbsoluteFill>
   <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible',opacity:1-z,pointerEvents:'none'}}>
    <polygon points="7,0 100,3 93,100 0,97" fill="none" stroke={C.ink} strokeWidth={12} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
    <polygon points="7,0 100,3 93,100 0,97" fill="none" stroke={i%2?C.red:C.blue} strokeWidth={5} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
   </svg>
  </div>;
 })}<Tag text={merge<.5?p.titulo:undefined} top/></Stage>;
};

export const FaixasSequenciais:React.FC<Props&{cenas:Clip[]}>=p=>{
 const {f,W,H,V}=useCanvas(),items=(p.cenas||[]).slice(0,3),n=Math.max(1,items.length),state=segmentState(f,p.len,n);
 const strengths=items.map((_,i)=>{const prev=Math.max(0,state.index-1),q=smooth(progress(f-state.start(state.index),p.len,0,.055));return (i===prev?1-q:0)+(i===state.index?q:0);});
 const weights=strengths.map(v=>.2+v*.4),sum=weights.reduce((a,b)=>a+b,0)||1;let offset=0;
 return <Stage {...p}>{items.map((item,i)=>{const size=weights[i]/sum,active=i===state.index,x=V?0:offset*W,y=V?H*(.13+offset*.56):0,w=V?W:size*W,h=V?H*.56*size:H;offset+=size;
  return <div key={i} data-editorial-active={active} style={{position:'absolute',left:x,top:y,width:w,height:h,overflow:'hidden',filter:active?'none':'grayscale(.9) brightness(.5)',borderRight:`3px solid ${C.ink}`,borderBottom:`3px solid ${C.ink}`}}>
   <Source item={item} len={p.len} from={state.start(i)} until={state.end(i)}/><Chip width={w} text={item.titulo} tone={active?C.yellow:'#bfc4d0'}/>
  </div>;
 })}</Stage>;
};

export const FotogramasMudanca:React.FC<Props&{cenas:Clip[]}>=p=>{
 const {f,W,H,V}=useCanvas(),items=(p.cenas||[]).slice(0,3),q=smooth(progress(f,p.len,.79,.2));
 return <Stage {...p}>{items.map((item,i)=>{const enter=smooth(progress(f,p.len,i*.2,.15)),last=i===items.length-1,z=last?q:0,x=W*(V?.08+i*.13:.08+i*.25),y=H*(V?.15+i*.12:.19+i*.04),w=W*(V?.67:.37),h=H*(V?.3:.62);
  return <div key={i} style={{position:'absolute',left:x*(1-z)+(1-enter)*W*.1,top:y*(1-z),width:w+(W-w)*z,height:h+(H-h)*z,opacity:enter,transform:`rotate(${(i-1)*5*(1-z)}deg)`,overflow:'hidden',boxShadow:`9px 9px 0 ${C.ink}`,border:z>.99?'none':`4px solid ${i===1?C.red:C.blue}`,zIndex:last&&z>0?20:i}}><Source item={item} len={p.len} frame={0}/>{z<.5&&<Chip width={w} text={item.titulo}/>}</div>;
 })}<Tag text={q<.5?p.titulo:undefined} top/></Stage>;
};

export const RetornoImagem:React.FC<Props&{atual:Clip;lembranca:Clip;em?:number;duracao?:number}>=p=>{
 const {f}=useCanvas(),state=recallState(f,p.len,p.em??.35,p.duracao??.2);
 return <Stage {...p}><Fill item={p.atual} len={p.len} frame={state.frame}/>{state.recalling&&<AbsoluteFill data-editorial-recall><Source item={p.lembranca} len={p.len} from={state.start} until={state.end}/><Tag text={p.lembranca.titulo||'ANTES'} top tone={C.white}/><AbsoluteFill style={{boxShadow:`inset 0 0 0 7px ${C.blue}`}}/></AbsoluteFill>}</Stage>;
};

export const DivisaoResolvida:React.FC<Props&{cenas:Clip[];escolhida?:number;virada?:number}>=p=>{
 const {f,W,H,V}=useCanvas(),q=smooth(progress(f,p.len,p.virada??.33,.45)),chosen=p.escolhida===0?0:1,split=chosen===0?.5+.5*q:.5-.5*q;
 return <Stage {...p}>{(p.cenas||[]).slice(0,2).map((item,i)=><AbsoluteFill key={i} style={{clipPath:V?(i===0?`inset(0 0 ${(1-split)*100}% 0)`:`inset(${split*100}% 0 0 0)`):(i===0?`inset(0 ${(1-split)*100}% 0 0)`:`inset(0 0 0 ${split*100}%)`)}}><Source item={item} len={p.len}/>{q<.8&&<div style={{position:'absolute',left:W*.045,top:H*(V?(i?.46:.16):.11),width:W*(V?.85:.4),height:100,transform:!V&&i?'translateX(115%)':undefined}}><Chip width={W*(V?.85:.4)} text={item.titulo}/></div>}</AbsoluteFill>)}
  {q<1&&<div style={{position:'absolute',left:V?0:W*split,top:V?H*split:0,width:V?W:6,height:V?6:H,background:C.yellow,boxShadow:`0 0 0 3px ${C.ink}`}}/>}
 </Stage>;
};

export const RevelacaoRecortes:React.FC<Props&{cena:Clip}>=p=>{
 const {f,W,H,V}=useCanvas(),cuts=4,start=cueFrame(p.len,.72),q=smooth(progress(f,p.len,.72,.18));
 return <Stage {...p}>{Array.from({length:cuts},(_,i)=>{const enter=smooth(progress(f,p.len,i*.17,.15)),x=V?0:i*W/4,y=V?H*(.13+i*.14):H*.1,w=V?W:W/4,h=V?H*.14:H*.8;
  return <div key={i} style={{position:'absolute',inset:0,clipPath:V?`polygon(0 ${y/H*100}%,100% ${y/H*100+2}%,100% ${(y+h)/H*100}%,0 ${(y+h)/H*100-2}%)`:`polygon(${x/W*100}% 10%,${(x+w)/W*100}% 13%,${(x+w)/W*100}% 90%,${x/W*100}% 87%)`,opacity:enter,transform:`translate(${(1-enter)*(i%2?-80:80)}px,${(1-enter)*50}px)`}}><Source item={p.cena} len={p.len} frame={0}/></div>;
 })}{q>0&&<AbsoluteFill style={{opacity:q}}><Source item={p.cena} len={p.len} from={start}/></AbsoluteFill>}<Tag text={q<.5?p.titulo:undefined} top/></Stage>;
};
