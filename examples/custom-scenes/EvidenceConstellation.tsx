import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';

/** A cast/evidence map generalized from ConstelacaoFamilia and LegadoEmRede in VD_0005.
 * All names/times/media are supplied by the next production; defaults are placeholders.
 * Up to 5 nodes, one camera/graph, no network or external font requests.
 */
export type EvidenceNode = {
  key: string;
  label: string;
  caption?: string;
  at: number;
  color?: string;
};
export type EvidenceConstellationProps={
  nodes?: EvidenceNode[];
  title?: string;
  subtitle?: string;
  assets?: Record<string,string>;
  accent?: string;
  appearance?: 'comic'|'dark';
};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const x=clamp(v);return x*x*(3-2*x)};
const mix=(a:number,b:number,p:number)=>a+(b-a)*p;
const defaults:EvidenceNode[]=[
  {key:'one',label:'PERSONAGEM A',caption:'O PONTO DE PARTIDA',at:0},
  {key:'two',label:'PERSONAGEM B',caption:'UMA NOVA CONSEQUÊNCIA',at:1.5},
  {key:'three',label:'PERSONAGEM C',caption:'O QUADRO COMPLETO',at:3},
];
export default function EvidenceConstellation({nodes=defaults,title='RELAÇÕES EM FOCO',subtitle='CONEXÕES E CONSEQUÊNCIAS',assets={},accent='#F22932',appearance='dark'}:EvidenceConstellationProps){
 const frame=useCurrentFrame(),{fps,width,height,durationInFrames}=useVideoConfig();const t=frame/fps;
 const sf=Math.min(width/1920,height/1080),isComic=appearance==='comic';
 const data=nodes.slice(0,5).filter(n=>n.key && n.label && Number.isFinite(n.at)).sort((a,b)=>a.at-b.at);
 if(!data.length)return <AbsoluteFill style={{background:'#14151C'}}/>;
 const last=Math.max(0,...data.map(n=>n.at)),duration=durationInFrames/fps;
 const overview=ease((t-Math.min(duration-1.1,last+.7))/1);
 const focusIdx=Math.max(0,data.findLastIndex(n=>n.at<=t));
 const nodesSpatial=data.map((n,i)=>({...n,x:270+i*(1380/Math.max(1,data.length-1)),y:i%2?630:470}));
 const focus=nodesSpatial[focusIdx];
 const cameraX=mix(focus.x,960,overview),cameraY=mix(focus.y,540,overview);
 const z=mix(1.58,1,overview);
 const font='EvidenceAnton,Impact,"Arial Narrow",sans-serif';
 const background=isComic?'#F6EDDB':'#111A2A',ink=isComic?'#15151A':'#F7F8FB';
 return <AbsoluteFill style={{overflow:'hidden',background,color:ink}}>
 {assets.anton&&<style>{`@font-face{font-family:EvidenceAnton;src:url('${assets.anton}') format('truetype');font-display:block}`}</style>}
 <div style={{width:1920,height:1080,position:'absolute',overflow:'hidden',transform:`scale(${sf})`,transformOrigin:'0 0'}}>
  <div style={{position:'absolute',inset:0,backgroundImage:isComic?'radial-gradient(#15151A30 1.6px, transparent 1.6px)':'radial-gradient(#FFFFFF19 1.5px, transparent 1.5px)',backgroundSize:'18px 18px'}}/>
  <div style={{position:'absolute',width:1920,height:1080,transform:`translate(${960-cameraX*z}px, ${540-cameraY*z}px) scale(${z})`,transformOrigin:'0 0'}}>
   <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
    {nodesSpatial.slice(0,-1).map((n,i)=>{
      const next=nodesSpatial[i+1],p=ease((t-next.at+.3)/.65);
      const d=`M${n.x} ${n.y} Q${(n.x+next.x)/2} ${Math.min(n.y,next.y)-160} ${next.x} ${next.y}`;
      return <path key={n.key} d={d} stroke={n.color||accent} strokeWidth="6" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1-p}/>;
    })}
   </svg>
   {nodesSpatial.map((n,i)=>{
     const show=ease((t-n.at)/.38);
     const src=assets[n.key];
     return <div key={n.key} style={{position:'absolute',left:n.x-170,top:n.y-220,width:340,height:445,background:isComic?'#FDF7E9':'#15253C',border:`7px solid ${ink}`,
       boxSizing:'border-box',boxShadow:`15px 17px 0 ${n.color||accent}66`,opacity:show,transform:`translateY(${65*(1-show)}px)`}}>
       {src?<Img src={src} style={{width:'100%',height:300,objectFit:'contain',objectPosition:'center bottom'}}/>:
         <div style={{width:'100%',height:300,display:'grid',placeItems:'center',fontFamily:font,fontSize:105,color:n.color||accent}}>0{i+1}</div>}
       <div style={{borderTop:`5px solid ${ink}`,padding:'11px 14px',fontFamily:font,fontSize:29,lineHeight:1.05,color:ink}}>{n.label}</div>
       {n.caption?<div style={{padding:'2px 14px',fontSize:14,color:ink,letterSpacing:1,opacity:.65}}>{n.caption}</div>:null}
     </div>;
   })}
  </div>
  <div style={{position:'absolute',top:60,left:70,right:70,background:isComic?'#F6EDDBE8':'#10192BE6',padding:'12px 22px',borderLeft:`10px solid ${accent}`}}>
    <div style={{fontFamily:font,fontSize:46,letterSpacing:2}}>{title}</div><div style={{fontFamily:font,fontSize:22,letterSpacing:3,opacity:.7}}>{subtitle}</div>
  </div>
  <div style={{position:'absolute',bottom:58,left:70,right:70,display:'flex',gap:12}}>{nodesSpatial.map((n,i)=><div key={n.key} style={{height:7,flex:1,background:t>=n.at?(n.color||accent):ink,opacity:t>=n.at?1:.16}}/>)}</div>
 </div>
 </AbsoluteFill>;
}