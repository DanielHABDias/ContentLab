import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage,Source,Fill,Clip,Props,useCanvas,ANTON,C,fit,color} from './media';
import {cueFrame,progress,smooth} from './timing';

export const PalavraRecortada:React.FC<Props&{cena:Clip;recorte:string;palavra:string}>=p=>{
 const {f,W,H,V}=useCanvas(),enter=smooth(progress(f,p.len,.06,.17)),size=fit(p.palavra||'',W*.91,H*(V?.2:.38),1);
 return <Stage {...p}><Fill item={p.cena} len={p.len} style={{filter:'brightness(.33) saturate(.6)'}}/>
  <div style={{position:'absolute',left:W*.025,right:W*.025,top:H*(V?.29:.31),fontFamily:ANTON,fontSize:size,lineHeight:.95,textAlign:'center',color:color(p.tom,C.yellow),textTransform:'uppercase',transform:`translateY(${(1-enter)*H*.1}px) scale(${.94+.06*enter})`,opacity:enter,textShadow:`7px 7px 0 ${C.ink},-3px 0 0 ${C.red},3px 0 0 ${C.blue}`}}>{p.palavra}</div>
  <div style={{position:'absolute',left:W*(V?.1:.18),top:H*(V?.16:.07),width:W*(V?.8:.64),height:H*(V?.57:1.1),filter:`drop-shadow(0 0 16px ${C.ink})`,opacity:enter}}><Source item={{midia:p.recorte}} len={p.len} fit="contain" fixa/></div>
 </Stage>;
};

export const LegendaVirada:React.FC<Props&{cena:Clip;prefixo?:string;antes:string;depois:string;sufixo?:string;virada?:number}>=p=>{
 const {f,W,H,V}=useCanvas(),at=p.virada??.42,start=cueFrame(p.len,at),changed=f>=start,correction=changed&&f<cueFrame(p.len,at+.18),text=[p.prefixo,correction?p.antes:changed?p.depois:p.antes,p.sufixo].filter(Boolean).join(' '),q=smooth(progress(f,p.len,at,.08));
 return <Stage {...p}><Fill item={p.cena} len={p.len}/><div style={{position:'absolute',left:W*.06,right:W*.06,top:H*(V?.51:.67),textAlign:'center',fontFamily:ANTON,fontSize:fit(text,W*.84,V?66:92,2),lineHeight:1.12,color:C.white,textTransform:'uppercase'}}>
  <span style={{background:'#0b0c14ec',padding:'8px 20px',boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'}}>{p.prefixo} <span style={{position:'relative',color:changed?C.yellow:C.white}}>{correction?p.antes:changed?p.depois:p.antes}{correction&&<span style={{position:'absolute',left:'-4%',top:'48%',width:`${q*108}%`,height:8,background:C.red,transform:'rotate(-5deg)',boxShadow:`0 2px 0 ${C.ink}`}}/>}</span> {p.sufixo}</span>
  {correction&&<div style={{marginTop:24,color:C.yellow,textShadow:`4px 4px 0 ${C.ink}`}}>{p.depois}</div>}
 </div></Stage>;
};

