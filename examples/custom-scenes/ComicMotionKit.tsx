import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';

/** Future Diazverso direction: comic-book motion, NOT a copy of any comic publisher's artwork.
 * Single-scene modes: ink reveal, panels, speech bubbles, impact or split choice.
 * Pass verified media/characters via `assets` and story-specific lines via `props`.
 */
export type ComicProps = {
  variant?: 'panels' | 'ink_reveal' | 'speech_bubble' | 'impact' | 'split_choice';
  title?: string;
  subtitle?: string;
  secondary?: string;
  assets?: {anton?: string; bangers?: string; panelA?: string; panelB?: string};
  accent?: string;
  accent2?: string;
  background?: string;
};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t)};
export default function ComicMotionKit({variant='panels',title='UM NOVO CAPÍTULO',subtitle='A HISTÓRIA CONTINUA',secondary='OUTRO CAMINHO',assets={},accent='#F22932',accent2='#175AE8',background='#F8F0DC'}:ComicProps){
  const f=useCurrentFrame(),{fps,width,height,durationInFrames}=useVideoConfig();const t=f/fps,d=durationInFrames/fps;
  const sf=Math.min(width/1920,height/1080);
  const enter=smooth(t/.42),next=smooth((t-1.03)/.46),late=smooth((t-2.02)/.48);
  const pop=spring({fps,frame:f,config:{damping:15,mass:.75,stiffness:155},durationInFrames:Math.max(1,Math.round(.75*fps))});
  const titleFont='ComicBangers,Impact,"Arial Narrow",sans-serif';
  const bodyFont='ComicAnton,Impact,"Arial Narrow",sans-serif';
  const titles=(text:string,size=110,color='#11131B') => <span style={{display:'block',fontFamily:titleFont,fontWeight:900,fontSize:size,lineHeight:.97,color,
    letterSpacing:2,textShadow:'3px 4px 0 #F8F0DC',WebkitTextStroke:'2px #11131B',paintOrder:'stroke fill'}}>{text}</span>;
  const panel=(label:string,src:string|undefined,ink:string,show:number,left:number,top:number,pw:number,ph:number,angle=0)=>
    <div style={{position:'absolute',left,top,width:pw,height:ph,opacity:show,
      transform:`translateY(${(1-show)*70}px) rotate(${angle}deg)`,border:'9px solid #11131B',boxSizing:'border-box',background:ink,
      boxShadow:'18px 18px 0 #11131B55',overflow:'hidden'}}>
      {src?<img src={src} alt="" style={{width:'100%',height:'100%',objectFit:'cover',filter:'saturate(.82) contrast(1.08)'}}/>:
       <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(#11131B38 2px,transparent 2px)',backgroundSize:'17px 17px'}}/>}
      <div style={{position:'absolute',left:24,bottom:24,padding:'8px 18px',maxWidth:'85%',border:'4px solid #11131B',background:'#F8F0DC'}}>{titles(label,41)}</div>
    </div>;
  return <AbsoluteFill style={{background:'#12131A',overflow:'hidden'}}>
    {assets.anton&&<style>{`@font-face{font-family:ComicAnton;src:url('${assets.anton}') format('truetype');font-display:block}`}</style>}
    {assets.bangers&&<style>{`@font-face{font-family:ComicBangers;src:url('${assets.bangers}') format('truetype');font-display:block}`}</style>}
    <div style={{position:'absolute',width:1920,height:1080,transform:`scale(${sf})`,transformOrigin:'0 0',background,
      overflow:'hidden',perspective:1300}}>
      <div style={{position:'absolute',inset:0,opacity:.1,pointerEvents:'none',backgroundImage:'radial-gradient(#11131B 1.6px,transparent 1.6px)',backgroundSize:'17px 17px'}}/>
      {variant==='panels'&&<>
        {panel(title,assets.panelA,accent,enter,105,190,1080,750,-2.4)}
        {panel(secondary,assets.panelB,accent2,next,1220,245,595,635,3)}
        <div style={{position:'absolute',top:57,left:105,fontFamily:bodyFont,fontSize:56,fontWeight:900}}>{subtitle}</div>
        <svg width="1920" height="1080" style={{position:'absolute',inset:0,pointerEvents:'none'}}>
          <path d="M115 155 L1820 155" stroke="#12131A" strokeWidth="13" strokeDasharray="1850" strokeDashoffset={1850*(1-enter)}/>
        </svg>
      </>}
      {variant==='ink_reveal'&&<>
        <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
          <path d="M110 720 Q415 140 930 470 T1810 385" stroke="#11131B" strokeWidth="53" fill="none"
            pathLength={1} strokeDasharray="1" strokeDashoffset={1-enter}/>
          <path d="M110 720 Q415 140 930 470 T1810 385" stroke={accent} strokeWidth="39" fill="none"
            pathLength={1} strokeDasharray="1" strokeDashoffset={1-next}/>
          <path d="M160 900 Q975 725 1720 895" stroke={accent2} strokeWidth="10" fill="none"
            pathLength={1} strokeDasharray="1" strokeDashoffset={1-late}/>
        </svg>
        <div style={{position:'absolute',left:170,top:470,opacity:next,transform:`translateY(${45*(1-next)}px)`}}>{titles(title,137)}</div>
        <div style={{position:'absolute',left:175,top:635,opacity:late,fontFamily:bodyFont,fontSize:48,color:'#18202C'}}>{subtitle}</div>
      </>}
      {variant==='speech_bubble'&&<>
        <div style={{position:'absolute',left:215,top:205,width:1500,height:620,display:'flex',alignItems:'center',justifyContent:'center',
          padding:90,boxSizing:'border-box',background:'#FFFFFF',border:'14px solid #11131B',borderRadius:'48% 47% 48% 49%',
          boxShadow:`${Math.round(18*pop)}px ${Math.round(26*pop)}px 0 ${accent}`,transform:`scale(${.3+.7*pop})`,opacity:enter}}>
          <div style={{textAlign:'center'}}>{titles(title,154)}<div style={{fontFamily:bodyFont,fontSize:42,marginTop:25}}>{subtitle}</div></div>
        </div>
        <svg style={{position:'absolute',left:1270,top:790}} width="270" height="130"><path d="M4 0 L240 0 L270 130 Z" fill="white" stroke="#11131B" strokeWidth="14" strokeLinejoin="round"/></svg>
      </>}
      {variant==='impact'&&<>
        <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
          {Array.from({length:24},(_,i)=>{const a=i*Math.PI*2/24;
            return <path key={i} d={`M${960+250*Math.cos(a)} ${530+250*Math.sin(a)} L${960+(580+95*next)*Math.cos(a)} ${530+(580+95*next)*Math.sin(a)}`}
              stroke={i%3?accent:'#11131B'} strokeWidth={i%3?14:23} opacity={.2+.8*enter} />;})}
          <circle cx="960" cy="530" r={90+320*enter} fill={accent2} stroke="#11131B" strokeWidth="16" opacity={.25*enter}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
          transform:`rotate(${(1-pop)*-13}deg) scale(${.45+.55*pop})`}}>{titles(title,230,accent)}</div>
        <div style={{position:'absolute',bottom:95,left:0,right:0,textAlign:'center',opacity:next,fontFamily:bodyFont,fontSize:43}}>{subtitle}</div>
      </>}
      {variant==='split_choice'&&<>
        <div style={{position:'absolute',left:0,top:0,width:960,height:1080,background:accent,clipPath:`inset(0 ${100-100*enter}% 0 0)`}}/>
        <div style={{position:'absolute',left:960,top:0,width:960,height:1080,background:accent2,clipPath:`inset(0 0 0 ${100-100*next}%)`}}/>
        <div style={{position:'absolute',top:96,left:0,right:0,textAlign:'center',zIndex:2}}>{titles(subtitle,85)}</div>
        {panel(title,assets.panelA,'#F5F0E2',enter,115,310,775,520,-1)}
        {panel(secondary,assets.panelB,'#F5F0E2',next,1040,310,775,520,1)}
        <div style={{position:'absolute',left:952,top:170,width:16,height:820,background:'#11131B',transform:`scaleY(${late})`,transformOrigin:'top'}}/>
      </>}
      <div style={{position:'absolute',top:0,left:0,right:0,height:12,background:'#11131B'}}/>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:12,background:'#11131B'}}/>
      <div style={{position:'absolute',bottom:25,left:55,fontFamily:bodyFont,color:'#1B1D22',fontSize:24,opacity:.6}}>MOTION / QUADRINHOS</div>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:7,background:accent,transform:`scaleX(${smooth(t/Math.max(.1,d))})`,transformOrigin:'left'}}/>
    </div>
  </AbsoluteFill>;
}