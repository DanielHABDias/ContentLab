import React from 'react';
import {AbsoluteFill,Freeze,Sequence,useCurrentFrame,useVideoConfig} from 'remotion';
import {Background,Media,useAsset,fit,color} from '../../stage';
import {ANTON,C} from '../../fx';
export {ANTON,C,fit,color};
export type Clip={midia:string;titulo?:string;fonte?:string;inicio?:number;foco?:string;zoom?:number;deslocamento?:{x:number;y:number}};
export type Props={len:number;titulo?:string;tom?:string;fundo?:'estrelas'|'escuro'|'meio-tom'|'explosao'};
export const useCanvas=()=>{const f=useCurrentFrame(),{width:W,height:H,fps}=useVideoConfig();return {f,W,H,fps,V:H>W};};
export const Stage:React.FC<Props&{children:React.ReactNode}>=p=><AbsoluteFill style={{overflow:'hidden',background:C.ink}}><Background kind={p.fundo||'estrelas'} tint={p.tom}/>{p.children}</AbsoluteFill>;
/** Every source stays muted. Playback starts at its own cue; inactive clips retain a real source frame. */
export const Source:React.FC<{item:Clip;len:number;from?:number;until?:number;frame?:number;fit?:'cover'|'contain';fixa?:boolean}>=({item,len,from=0,until=len,frame,fit:adjust='cover',fixa=false})=>{
 const {f,fps}=useCanvas(),asset=useAsset(item?.midia);
 const content=<Media asset={asset} len={len} inicio={Math.max(0,item?.inicio||0)} foco={item?.foco} zoom={item?.zoom||1} fit={adjust} style={{...(fixa?{transform:`scale(${item?.zoom||1})`}:{}),...(item?.deslocamento?{translate:`${item.deslocamento.x*100}% ${item.deslocamento.y*100}%`}:{})}}/>;
 if(frame!==undefined)return <Freeze frame={Math.max(0,Math.round(frame))}>{content}</Freeze>;
 if(f<from)return <Freeze frame={0}>{content}</Freeze>;
 if(f>=until)return <Freeze frame={Math.max(0,until-from-1)}>{content}</Freeze>;
 return <Sequence from={from} layout="none" premountFor={fps}>{content}</Sequence>;
};
export const Fill:React.FC<{item:Clip;len:number;frame?:number;style?:React.CSSProperties}>=({item,len,frame,style})=><AbsoluteFill style={{overflow:'hidden',...style}}><Source item={item} len={len} frame={frame}/></AbsoluteFill>;
export const Tag:React.FC<{text?:string;sub?:string;top?:boolean;tone?:string}>=({text,sub,top,tone=C.yellow})=>{
 const {W,H,V}=useCanvas();if(!text&&!sub)return null;
 return <div style={{position:'absolute',left:W*.045,right:W*.045,...(top?{top:H*(V?.14:.07)}:{bottom:H*(V?.31:.065)}),pointerEvents:'none',zIndex:40,fontFamily:ANTON,lineHeight:1.1}}>
  {text&&<span style={{display:'inline-block',padding:'8px 18px',background:'#0a0c13ed',color:tone,fontSize:fit(text,W*.82,V?52:62,2),boxShadow:`5px 5px 0 ${C.red}`,textTransform:'uppercase'}}>{text}</span>}
  {sub&&<div style={{marginTop:12,color:'#eee',fontSize:V?24:26,textShadow:'2px 2px 2px #000'}}>{sub}</div>}
 </div>;
};
export const Stroke:React.FC<{x:number;y:number;w:number;h:number;tone?:string;show?:number}>=({x,y,w,h,tone=C.yellow,show=1})=><svg style={{position:'absolute',left:x,top:y,width:w,height:h,overflow:'visible',pointerEvents:'none',opacity:show}} viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="46" ry="44" fill="none" stroke={C.ink} strokeWidth="4"/><ellipse cx="50" cy="50" rx="46" ry="44" fill="none" stroke={tone} strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={1-show}/></svg>;

export const Chip:React.FC<{text?:string;width?:number;tone?:string}>=({text,width=500,tone=C.yellow})=>text?<div style={{position:'absolute',left:16,right:16,bottom:18,fontFamily:ANTON,fontSize:fit(text,width-32,38,2),color:tone,lineHeight:1.1,textTransform:'uppercase',textShadow:'2px 2px 2px #000'}}><span style={{background:'#090b12dd',padding:'4px 10px',boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'}}>{text}</span></div>:null;
