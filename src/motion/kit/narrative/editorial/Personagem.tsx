import React from 'react';
import {AbsoluteFill} from 'remotion';
import {PersonagemPose,useHasPersonagem} from '../../Personagem';
import {Stage,Source,Fill,Tag,Clip,Props,useCanvas,C,ANTON,fit} from './media';
import {cueFrame,reactionState} from './timing';
type ActorProps=Props&{cena:Clip;poses?:string[];humor?:string;texto?:string};
export const PersonagemPrimeiroPlano:React.FC<ActorProps>=p=>{
 const {f,W,H,V,fps}=useCanvas(),has=useHasPersonagem(),k=Math.floor(f/Math.max(1,Math.round(fps*.8))),poses=p.poses||[];
 return <Stage {...p}><AbsoluteFill style={{clipPath:V?'polygon(0 12%,100% 12%,100% 46%,0 51%)':'polygon(48% 0,100% 0,100% 100%,39% 100%)'}}><Source item={p.cena} len={p.len}/></AbsoluteFill>
  <svg style={{position:'absolute',inset:0,width:W,height:H}}><path d={V?`M 0 ${H*.51} L ${W} ${H*.46}`:`M ${W*.48} 0 L ${W*.39} ${H}`} stroke={C.ink} strokeWidth={14}/><path d={V?`M 0 ${H*.51} L ${W} ${H*.46}`:`M ${W*.48} 0 L ${W*.39} ${H}`} stroke={C.blue} strokeWidth={4}/></svg>
  {has&&<PersonagemPose pose={poses.length?poses[k%poses.length]:undefined} humor={p.humor||'determinado'} height={V?H*.62:H*1.18} cx={W*(V?.27:.22)} bottom={V?H*.94:H*1.34} seed={`primeiro${k}`}/>}
  <Tag text={p.texto} top/>
 </Stage>;
};

export const PersonagemReacao:React.FC<ActorProps&{em?:number;ate?:number}>=p=>{
 const {f,W,H,V}=useCanvas(),has=useHasPersonagem(),state=reactionState(f,p.len,p.em??.28,p.ate??.83),poses=p.poses||[];
 return <Stage {...p}><Fill item={p.cena} len={p.len}/>{has&&state.visible&&<div data-editorial-reaction>
  <PersonagemPose pose={poses[state.index%Math.max(1,poses.length)]} humor={p.humor||'surpreso'} height={H*(V?.47:.72)} cx={W*(V?.75:.82)} bottom={H*(V?.84:1.16)} seed={`reacao${state.index}`}/>
  {p.texto&&<Tag text={p.texto} top/>}
 </div>}</Stage>;
};

export const PersonagemAlternado:React.FC<ActorProps>=p=>{
 const {f,W,H,V,fps}=useCanvas(),has=useHasPersonagem(),start=cueFrame(p.len,.25),end=cueFrame(p.len,.62),evidence=f>=start&&f<end,right=f>=end,k=Math.floor(f/Math.max(1,Math.round(fps*.8))),poses=p.poses||[];
 return <Stage {...p}>{evidence?<Source item={p.cena} len={p.len} from={start} until={end}/>:<>
  {has&&<PersonagemPose pose={poses.length?poses[k%poses.length]:undefined} humor={p.humor||'determinado'} height={V?H*.9:H*1.32} cx={W*(V?.5:right?.72:.28)} bottom={V?H*1.1:H*1.42} seed={`alternado${k}`}/>}
  <div style={{position:'absolute',left:W*(V?.08:right?.06:.57),top:H*(V?.14:.26),width:W*(V?.84:.36),fontFamily:ANTON,fontSize:fit(p.texto||'',W*(V?.84:.36),V?56:90,3),lineHeight:1.08,color:C.yellow,textTransform:'uppercase',textShadow:'4px 4px 0 #090b12'}}>{p.texto}</div>
 </>}</Stage>;
};
