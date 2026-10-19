import {HQComicPage, type HQComicPageOptions} from './HQComicPage';
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

type ProgressPoint = {at:number; value:number; easing?:'linear'|'smooth'};
type ColorPoint = {at:number; color:string};
type Props = HQComicPageOptions & {points?:ProgressPoint[]; colors?:ColorPoint[]; position?:'top'|'bottom'|'center';
  width?:number; height?:number; margin?:number; x?:number; y?:number;
  trackColor?:string; outlineColor?:string; texture?:boolean; opacity?:number};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const colorValid=(c:string)=>/^#[\da-f]{6}$/i.test(c);

export function validateLoading(points:ProgressPoint[], colors:ColorPoint[], duration:number){
  if(points.length<2||!colors.length)throw new Error('Informe pelo menos dois pontos de progresso e uma cor.');
  points.forEach((p,i)=>{if(!Number.isFinite(p.at)||p.at<0||p.at>duration||!Number.isFinite(p.value)||p.value<0||p.value>100||
    (i>0&&(p.at<=points[i-1].at||p.value<points[i-1].value))||!['linear','smooth'].includes(p.easing??'linear'))throw new Error('points: tempos crescentes dentro da cena, value de 0 a 100 sem retroceder, easing linear/smooth.');});
  colors.forEach((c,i)=>{if(!Number.isFinite(c.at)||c.at<0||c.at>duration||!colorValid(c.color)||(i>0&&c.at<=colors[i-1].at))throw new Error('colors: tempos crescentes dentro da cena e cores #RRGGBB.');});
}
export function progressAt(points:ProgressPoint[],time:number){
  if(time<=points[0].at)return points[0].value;
  for(let i=1;i<points.length;i++)if(time<=points[i].at){const a=points[i-1],b=points[i];let p=clamp((time-a.at)/(b.at-a.at));if(b.easing==='smooth')p=p*p*(3-2*p);return a.value+(b.value-a.value)*p;}
  return points[points.length-1].value;
}
export function colorAt(colors:ColorPoint[],time:number){
  if(time<=colors[0].at)return colors[0].color;
  for(let i=1;i<colors.length;i++)if(time<=colors[i].at){const a=colors[i-1],b=colors[i],p=clamp((time-a.at)/(b.at-a.at));
    return '#'+[1,3,5].map(k=>Math.round(parseInt(a.color.slice(k,k+2),16)*(1-p)+parseInt(b.color.slice(k,k+2),16)*p).toString(16).padStart(2,'0')).join('');}
  return colors[colors.length-1].color;
}

export default function BarraLoadingHQ({backgroundStyle, backgroundOpacity=100, points,colors,position='bottom',width=86,height=6,margin=7,x,y,
  trackColor='#FFF3D6',outlineColor='#101018',texture=true,opacity=1}:Props){
  const {width:w,height:h,fps,durationInFrames}=useVideoConfig();const time=useCurrentFrame()/fps;
  // A duração pertence à cena; sem pontos explícitos, preenche até seu último quadro.
  const duration=durationInFrames/fps,last=Math.max(0,(durationInFrames-1)/fps);
  const progress=points??[{at:0,value:0},{at:last||duration,value:100}];
  const stops=colors??[{at:0,color:'#2689FF'}];validateLoading(progress,stops,duration);
  if(!['top','bottom','center'].includes(position)||!colorValid(trackColor)||!colorValid(outlineColor))throw new Error('Posição inválida ou cores fora do formato #RRGGBB.');
  if(!Number.isFinite(width)||width<5||width>96||!Number.isFinite(height)||height<1||height>20||!Number.isFinite(margin)||margin<1||margin>35||!Number.isFinite(opacity)||opacity<0||opacity>1)throw new Error('width: 5–96%; height: 1–20% do lado menor; margin: 1–35%; opacity: 0–1.');
  if((x!==undefined&&(!Number.isFinite(x)||x<0||x>100))||(y!==undefined&&(!Number.isFinite(y)||y<0||y>100)))throw new Error('x e y: percentual 0–100 do centro da barra.');
  const bw=w*width/100,bh=Math.min(w,h)*height/100,ink=Math.max(2,bh*.075),shadow=bh*.13;
  const cx=w*(x??50)/100,cy=y!==undefined?h*y/100:position==='top'?h*margin/100+bh/2:position==='center'?h/2:h*(1-margin/100)-bh/2;
  if(cx-bw/2<ink||cx+bw/2+shadow>w-ink||cy-bh/2<ink||cy+bh/2+shadow>h-ink)throw new Error('Barra fora da tela: ajuste x/y, width ou margin.');
  const value=progressAt(progress,time),fill=colorAt(stops,time),id=React.useId().replace(/:/g,'');
  return <AbsoluteFill style={{pointerEvents:'none',opacity,backgroundColor:'transparent'}}>
    {backgroundStyle==='comic_page'&&<HQComicPage opacity={backgroundOpacity}/>}
    <svg width={bw+shadow+ink*2} height={bh+shadow+ink*2} viewBox={`0 0 ${bw+shadow+ink*2} ${bh+shadow+ink*2}`} style={{position:'absolute',left:cx-bw/2-ink,top:cy-bh/2-ink,overflow:'visible'}}>
      <defs>
        <clipPath id={`${id}track`}><rect x={ink*2} y={ink*2} width={bw-ink*2} height={bh-ink*2} rx={bh*.15}/></clipPath>
        <clipPath id={`${id}progress`}><rect x={ink*2} y={ink*2} width={(bw-ink*2)*value/100} height={bh-ink*2}/></clipPath>
        <pattern id={`${id}dots`} width={bh*.24} height={bh*.24} patternUnits="userSpaceOnUse"><circle cx={bh*.08} cy={bh*.08} r={bh*.027} fill={outlineColor} opacity=".25"/></pattern>
        <pattern id={`${id}hatch`} width={bh*.6} height={bh} patternUnits="userSpaceOnUse"><path d={`M 0 ${bh} L ${bh*.55} 0`} stroke="white" strokeWidth={bh*.14} opacity=".15"/></pattern>
      </defs>
      <rect x={ink+shadow} y={ink+shadow} width={bw} height={bh} rx={bh*.22} fill={outlineColor}/>
      <rect x={ink} y={ink} width={bw} height={bh} rx={bh*.22} fill={trackColor} stroke={outlineColor} strokeWidth={ink}/>
      <g clipPath={`url(#${id}track)`}><g clipPath={`url(#${id}progress)`}>
        <rect x={ink*2} y={ink*2} width={bw-ink*2} height={bh-ink*2} fill={fill}/>
        {texture&&<><rect x={ink*2} y={ink*2} width={bw} height={bh} fill={`url(#${id}dots)`}/><rect x={ink*2} y={ink*2} width={bw} height={bh} fill={`url(#${id}hatch)`}/></>}
        <path d={`M ${ink*3} ${bh*.32} Q ${bw*.3} ${bh*.22} ${bw*.58} ${bh*.32} T ${bw-ink*3} ${bh*.3}`} fill="none" stroke="white" strokeOpacity=".52" strokeWidth={bh*.09} strokeLinecap="round"/>
        <path d={`M ${ink*2} ${bh*.8} Q ${bw*.45} ${bh*.7} ${bw-ink*2} ${bh*.81}`} fill="none" stroke={outlineColor} strokeOpacity=".18" strokeWidth={bh*.13}/>
      </g></g>
    </svg>
  </AbsoluteFill>;
}
