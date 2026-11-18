import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background, Media, useAsset, fit } from '../stage';
import { PersonagemPose, useHasPersonagem } from '../Personagem';
import { IconArt } from '../icons';
import { ANTON, C } from '../fx';
import { phase, Common } from './shared';
type Idea={texto?:string;icone?:string;pose?:string;humor?:string};
const Bubble:React.FC<{idea:Idea;x:number;y:number;w:number;h:number;show:number;rotation?:number}>=({idea,x,y,w,h,show,rotation=0})=><div style={{position:'absolute',left:x,top:y,width:w,height:h,opacity:show,transform:`rotate(${rotation}deg) scale(${.7+.3*show})`,transformOrigin:'50% 100%'}}>
 <svg width="100%" height="100%" viewBox="0 0 500 340" preserveAspectRatio="none" style={{position:'absolute',inset:0,filter:'drop-shadow(7px 9px 0 #070910)'}}><path d="M38 12 H462 Q488 12 488 42 V258 Q488 284 456 284 H185 L105 330 L118 284 H38 Q12 284 12 258 V42 Q12 12 38 12Z" fill="#f4f2ea" stroke={C.ink} strokeWidth="10"/><path d="M40 27 H454" stroke={C.red} strokeWidth="5"/></svg>
 <div style={{position:'absolute',inset:'10% 8% 22%',display:'flex',alignItems:'center',justifyContent:'center',gap:20,flexDirection:idea.texto&&idea.icone?'column':'row'}}>
  {idea.icone&&<IconArt name={idea.icone} size={Math.min(w*.36,h*.48)}/>}
  {idea.texto&&<div style={{fontFamily:ANTON,fontSize:fit(idea.texto,w*.82,Math.min(76,h*.2),3),textAlign:'center',lineHeight:1.05,color:C.ink,textTransform:'uppercase'}}>{idea.texto}</div>}
 </div>
</div>;
export const PersonagemClose:React.FC<Common & {ideias:Idea[];midia?:string;inicio?:number;poses?:string[];lado?:'esquerda'|'direita'}>=p=>{
 const f=useCurrentFrame(),{width:W,height:H,fps}=useVideoConfig(),V=H>W,has=useHasPersonagem(),asset=useAsset(p.midia);
 const poseStep=Math.floor(f/Math.max(1,Math.round(fps*.8)));
 const ideas=(p.ideias||[]).slice(0,6),step=p.len/Math.max(1,ideas.length),i=Math.min(ideas.length-1,Math.floor(f/step)),idea=ideas[i]||{},right=p.lado==='direita',enter=phase(f,p.len,0,.1);
 // Enlarge the complete supplied PNG and crop only at the canvas edge; never redraw the actor.
 const nh=V?H*1.04:H*1.48,bottom=V?H*1.45:H*1.56,cx=V?W*.5:W*(right?.72:.28);
 return <AbsoluteFill style={{overflow:'hidden'}}><Background kind={p.fundo||'meio-tom'} tint={p.tom||'azul'}/>
  {asset&&<AbsoluteFill style={{filter:'blur(15px) brightness(.33)'}}><Media asset={asset} len={p.len} inicio={p.inicio||0}/></AbsoluteFill>}
  <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 30% 75%,#1c448044,transparent 65%)'}}/>
  {has&&<div style={{position:'absolute',inset:0,transform:`translateY(${(1-enter)*H*.24}px)`}}><PersonagemPose pose={p.poses?.length?p.poses[poseStep%p.poses.length]:idea.pose} humor={idea.humor||'determinado'} height={nh} cx={cx} bottom={bottom} seed={`close${poseStep}`}/></div>}
  <Bubble idea={idea} x={V?W*.12:W*(right?.07:.57)} y={V?H*.1:H*.2} w={V?W*.76:W*.37} h={V?H*.28:H*.57} show={phase(f-i*step,step,0,.13)} rotation={right?-3:3}/>
 </AbsoluteFill>;
};
export const PensamentoVivo:React.FC<Common & {ideias:Idea[];poses?:string[];conclusao?:string}>=p=>{
 const f=useCurrentFrame(),{width:W,height:H}=useVideoConfig(),V=H>W,has=useHasPersonagem(),ideas=(p.ideias||[]).slice(0,3);
 const nh=V?H*.76:H*1.17,bottom=V?H*1.12:H*1.45;
 const k=Math.floor(f/Math.max(1,Math.round(useVideoConfig().fps*.8))),poses=p.poses||[];
 const slots=V?[{x:W*.06,y:H*.12,w:W*.51,h:H*.22},{x:W*.49,y:H*.28,w:W*.46,h:H*.22},{x:W*.03,y:H*.44,w:W*.34,h:H*.21}]:[{x:W*.055,y:H*.19,w:W*.28,h:H*.42},{x:W*.67,y:H*.18,w:W*.27,h:H*.42},{x:W*.38,y:H*.03,w:W*.25,h:H*.34}];
 return <AbsoluteFill style={{overflow:'hidden'}}><Background kind={p.fundo||'estrelas'} tint={p.tom}/>
  <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 80%,#2363ad55,transparent 65%)'}}/>
  {has&&<PersonagemPose pose={poses.length?poses[k%poses.length]:undefined} humor="confuso" height={nh} cx={V?W*.55:W*.5} bottom={bottom} seed={`pensamento${k}`}/>}
  {ideas.map((idea,i)=>{const slot=slots[i],show=phase(f,p.len,.08+i*.19,.09);return <Bubble key={i} idea={idea} {...slot} show={show} rotation={(i%2?4:-4)+Math.sin(f/38+i)*1.2}/>;})}
  {p.conclusao&&<div style={{position:'absolute',left:W*.07,right:W*.07,bottom:V?H*.25:H*.08,opacity:phase(f,p.len,.76),fontFamily:ANTON,fontSize:V?52:74,color:C.yellow,textAlign:'center',textShadow:'4px 4px 0 #080910'}}>{p.conclusao}</div>}
 </AbsoluteFill>;
};
