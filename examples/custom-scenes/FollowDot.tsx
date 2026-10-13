import React from 'react';
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from 'remotion';

/**
 * Single continuous procedural composition, inspired by motion-design studies.
 * Place in PROJECT/custom-scenes/FollowDot.tsx and reference using
 * timeline[].customComponent.module = "project://custom-scenes/FollowDot.tsx".
 * All animation is seekable: every pixel depends on frame, props and fps.
 */
type Props={title?:string;subtitle?:string;accent?:string;assets?:Record<string,string>};
type Point={x:number;y:number};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*t*(t*(t*6-15)+10);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const segment=(time:number,start:number,end:number)=>smooth((time-start)/(end-start));
const between=(a:Point,b:Point,t:number):Point=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)});
const stops=[
  {t:0,p:{x:300,y:360},camera:{x:315,y:450,s:1}},
  {t:2.25,p:{x:875,y:530},camera:{x:870,y:520,s:.94}},
  {t:4.5,p:{x:1450,y:900},camera:{x:1450,y:920,s:.98}},
  {t:6.4,p:{x:875,y:1540},camera:{x:875,y:1480,s:.90}},
  {t:8.8,p:{x:1320,y:1840},camera:{x:1070,y:1710,s:.77}},
  {t:10.75,p:{x:1040,y:1990},camera:{x:1060,y:1260,s:.34}},
  {t:17.7,p:{x:1040,y:1990},camera:{x:1060,y:1260,s:.34}},
];
function at(time:number){
  let i=0;
  while(i<stops.length-2&&time>=stops[i+1].t)i++;
  const a=stops[i],b=stops[i+1];
  const progress=segment(time,a.t,b.t);
  return {dot:between(a.p,b.p,progress),
    camera:{x:mix(a.camera.x,b.camera.x,progress),
      y:mix(a.camera.y,b.camera.y,progress),s:mix(a.camera.s,b.camera.s,progress)}};
}
const gridCells=Array.from({length:14*14},(_,i)=>({x:i%14,y:Math.floor(i/14)}));
const dotPath='M300 360 Q550 240 875 530 Q1160 700 1450 900 L1450 1020 Q1450 1320 875 1540 L1320 1840 L1040 1990';

export default function FollowDot({title='CONTENT LAB',subtitle='EVERY MOVE, WRITTEN IN CODE',accent='#fa4245'}:Props){
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const time=frame/fps;
  const {dot,camera}=at(time);
  const titleEnter=segment(time,.15,1.5);
  const gridEnter=segment(time,1.75,3.5);
  const orbitEnter=segment(time,3.6,5.1);
  const wordsEnter=segment(time,6.1,9.1);
  const ending=segment(time,10.4,11.5);
  const code='const frame = useCurrentFrame();\nconst position = interpolate(frame);\nrender(<MotionWorld />);';
  const chars=Math.floor(segment(time,12.3,15.3)*code.length);
  return <AbsoluteFill style={{background:'#090a0e',overflow:'hidden',fontFamily:'Arial,sans-serif'}}>
    <svg viewBox="0 0 576 1024" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="micro" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M36 0 H0 V36" stroke="#1a1e2a" strokeWidth=".7" fill="none"/>
        </pattern>
        <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="9"/>
        </filter>
      </defs>
      <rect x="0" y="0" width="576" height="1024" fill="url(#micro)"/>
      <g transform={`translate(288 512) scale(${camera.s}) translate(${-camera.x} ${-camera.y})`}>
        <g opacity={titleEnter}>
          <text x="300" y="330" textAnchor="middle" fill="#f4f5f8" fontWeight="900" fontSize="88" letterSpacing="-4">{title}</text>
          <text x="300" y="385" textAnchor="middle" fill="#737b90" fontSize="24" letterSpacing="7">MADE WITH MOTION</text>
          <rect x="180" y="407" width={245*titleEnter} height="6" rx="3" fill={accent}/>
        </g>
        <g transform="translate(688 345)" opacity={gridEnter}>
          {gridCells.map(({x,y},i)=>{
            const d=Math.hypot(x-6.5,y-6.5);
            const wave=Math.sin(d*.95-time*6);
            const active=gridEnter>0.02 && ((d<gridEnter*9&&wave>.10)||time>3.2);
            return <rect key={i} x={x*29} y={y*29} width="22" height="22" rx="3"
              fill={active?(wave>.2?'#2f7ff9':'#e1b938'):'#1b2438'}
              opacity={.18+.82*gridEnter}/>;
          })}
          <text x="203" y="456" fontSize="22" letterSpacing="5" textAnchor="middle" fill="#dfe7ff">GRID / 196 CELLS</text>
        </g>
        <g opacity={orbitEnter}>
          <circle cx="1450" cy="920" r="180" stroke="#f1f3f7" strokeWidth="12" fill="none"/>
          <circle cx="1450" cy="920" r={125+8*Math.sin(time*2)} stroke={accent} strokeWidth="2" opacity=".45" fill="none"/>
          {Array.from({length:12},(_,i)=>{
            const angle=i*Math.PI/6+time*.68;
            return <circle key={i} cx={1450+230*Math.cos(angle)} cy={920+230*Math.sin(angle)}
              r={9+(i%3)*3} fill={accent} opacity={.4+.5*Math.sin(time+i)**2}/>;
          })}
        </g>
        <g opacity={wordsEnter}>
          {['MOTION','TIMING','SPACING','EASING','IMPACT'].map((word,i)=>{
            const points=[[880,1470],[885,1635],[1250,1770],[740,1935],[1130,2100]];
            const local=segment(time,6.2+i*.36,7.2+i*.42);
            return <g key={word} transform={`translate(${points[i][0]} ${points[i][1]}) rotate(${(1-local)*(-18+i*7)})`}
              opacity={local} >
              <text textAnchor="middle" fontWeight="900" fontSize={i===0?105:74}
                letterSpacing="-3" fill={i%2===0?'#f2f2f7':'#ee403d'}>{word}</text>
            </g>;
          })}
        </g>
        <path d={dotPath} stroke={accent} strokeWidth="13" opacity=".13" filter="url(#glow)" fill="none"/>
        <path d={dotPath} stroke={accent} strokeWidth="4" fill="none"
          strokeDasharray="2900" strokeDashoffset={2900*(1-segment(time,.1,10.5))}
          strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={dot.x} cy={dot.y} r="26" fill={accent} opacity=".25" filter="url(#glow)"/>
        <circle cx={dot.x} cy={dot.y} r="12" fill={accent}/>
        <circle cx={dot.x} cy={dot.y} r="4" fill="#fff"/>
        <g opacity={ending} transform="translate(770 2360)">
          <rect x="0" y="0" width="620" height="400" rx="20" fill="#10141e" stroke="#394155" strokeWidth="3"/>
          <rect width="620" height="56" rx="20" fill="#191f2c"/>
          <circle cx="26" cy="29" r="9" fill="#ed4b4b"/><circle cx="54" cy="29" r="9" fill="#f0bd44"/>
          <circle cx="82" cy="29" r="9" fill="#64c677"/>
          <text x="310" y="38" textAnchor="middle" fontSize="22" fill="#c3cadb">motion.tsx</text>
          <text x="36" y="110" fontFamily="monospace" fontSize="25" fill="#64c7dc">
            {code.slice(0,chars).split('\n').map((line,i)=><tspan key={i} x="36" dy={i===0?0:54}>{line}</tspan>)}
          </text>
          <text x="310" y="345" fontSize="28" textAnchor="middle" fill="#e7e7ec">{subtitle}</text>
        </g>
      </g>
      <g opacity=".85">
        <path d="M25 70 h32 M25 70 v32 M551 70 h-32 M551 70 v32 M25 954 h32 M25 954 v-32 M551 954 h-32 M551 954 v-32" stroke="#778094" strokeWidth="2" fill="none"/>
        <text x="34" y="45" fill="#888e9b" fontSize="14" letterSpacing="4">DIAZVERSO / MOTION LAB</text>
        <text x="542" y="987" textAnchor="end" fill="#888e9b" fontSize="14">
          FRAME {String(frame).padStart(3,'0')} / {Math.round(17.7*fps)}
        </text>
      </g>
    </svg>
  </AbsoluteFill>;
}
