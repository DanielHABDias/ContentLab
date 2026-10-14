import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

/** Reusable storyboard/argument journey distilled from VD_0005's CicloDaFuga and PerguntaAbertura.
 * All times are LOCAL seconds, all labels/assets are provided by the calling project.
 * No video-specific dialogue, references, or characters are embedded in the template.
 */
export type JourneyBeat = {
  id?: string;
  title: string;
  subtitle?: string;
  at: number;
  accent?: string;
  x?: number;
  y?: number;
};
export type NarrativePathProps = {
  beats?: JourneyBeat[];
  heading?: string;
  appearance?: 'dark' | 'comic';
  assets?: {anton?: string};
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {const x = clamp(v); return x * x * (3 - 2 * x);};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const defaultBeats: JourneyBeat[] = [
  {title: 'UMA IDEIA', subtitle: 'O PONTO DE PARTIDA', at: 0, accent: '#175AE8'},
  {title: 'UMA ESCOLHA', subtitle: 'O CAMINHO MUDA', at: 1.6, accent: '#F22932'},
  {title: 'UMA CONSEQUÊNCIA', subtitle: 'O QUE ACONTECE DEPOIS', at: 3.3, accent: '#F0B84F'},
];

export default function NarrativePath({beats = defaultBeats, heading = 'UMA HISTÓRIA EM MOVIMENTO', appearance = 'dark', assets = {}}: NarrativePathProps) {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const sceneLength = durationInFrames / fps;
  const scale = Math.min(width / 1920, height / 1080);
  const entries = [...beats].filter(b => Number.isFinite(b.at) && b.at >= 0 && b.title).sort((a, b) => a.at - b.at)
    .map((b, i) => ({...b, x: b.x ?? 960 + i * 1920, y: b.y ?? (i % 2 ? 670 : 450), accent: b.accent ?? '#F22932'}));
  if (!entries.length) return <AbsoluteFill style={{backgroundColor: '#111'}}/>;
  const activeIndex = Math.max(0, entries.findLastIndex(b => b.at <= t));
  const active = entries[activeIndex];
  let focusX = entries[0].x;
  let focusY = entries[0].y;
  entries.slice(1).forEach(b => {
    const a = ease((t - (b.at - .39)) / .36);
    focusX = lerp(focusX, b.x, a);
    focusY = lerp(focusY, b.y, a);
  });
  const ink = appearance === 'comic' ? '#17171D' : '#F9FAFD';
  const paper = appearance === 'comic' ? '#F6EEDC' : '#0A1321';
  const font = 'JourneyAnton,Impact,"Arial Narrow",sans-serif';
  const worldW = Math.max(1920 * 2, Math.ceil(Math.max(...entries.map(b => b.x)) + 1100));
  const worldShiftX = 960 - focusX;
  const worldShiftY = 540 - focusY;
  return <AbsoluteFill style={{background: paper, color: ink, overflow: 'hidden'}}>
    {assets.anton ? <style>{`@font-face{font-family:JourneyAnton;src:url('${assets.anton}') format('truetype');font-display:block}`}</style> : null}
    <div style={{position: 'absolute', width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: '0 0', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: appearance === 'comic'
        ? 'radial-gradient(circle at 60% 40%,#FFFFFF,#E7DCC2)'
        : 'radial-gradient(circle at 55% 50%,#1C2E46,#07101E)'}}/>
      {appearance === 'comic' && <div style={{position: 'absolute', inset: 0, opacity: .13,
        backgroundImage: 'radial-gradient(#1E1722 1.5px, transparent 1.5px)', backgroundSize: '16px 16px'}}/>}
      <div style={{position: 'absolute', width: worldW, height: 1400,
        transform: `translate3d(${worldShiftX}px,${worldShiftY}px,0)`, willChange: 'transform'}}>
        <svg width={worldW} height="1400" style={{position: 'absolute', top: 0, left: 0, overflow: 'visible'}}>
          {entries.slice(0, -1).map((beat, index) => {
            const next = entries[index + 1];
            const middle = (beat.x + next.x) / 2;
            const path = `M${beat.x} ${beat.y} Q${middle} ${Math.min(beat.y, next.y) - 340} ${next.x} ${next.y}`;
            const drawn = ease((t - next.at + .5) / .55);
            return <g key={beat.id ?? index}>
              <path d={path} fill="none" stroke={ink} strokeWidth="8" strokeDasharray="22 19" opacity=".2"/>
              <path d={path} fill="none" stroke={beat.accent} strokeWidth="13" strokeDasharray="3000"
                strokeDashoffset={3000 * (1 - drawn)}/>
            </g>;
          })}
          {entries.map((beat, index) => <g key={beat.id ?? index}>
            <circle cx={beat.x} cy={beat.y} r="175" fill="none" stroke={beat.accent} strokeWidth="7"
              opacity={.2 + .5 * ease((t - beat.at) / .3)}/>
            <circle cx={beat.x} cy={beat.y} r="16" fill={beat.accent}/>
          </g>)}
        </svg>
        {entries.map((beat, index) => {
          const available = ease((t - (index === 0 ? 0 : beat.at - .22)) / .22);
          const next = entries[index + 1];
          const exit = next ? 1 - ease((t - next.at + .2) / .5) : 1;
          const opacity = Math.max(.12, available * exit);
          return <div key={beat.id ?? index} style={{position: 'absolute', left: beat.x - 755, top: beat.y - 315,
            width: 1530, opacity, transform: `translateY(${45 * (1 - available)}px)`}}>
            <div style={{fontFamily: font, fontSize: 32, color: beat.accent, letterSpacing: 6}}>CAPÍTULO {String(index + 1).padStart(2, '0')}</div>
            <div style={{fontFamily: font, fontWeight: 900, fontSize: beat.title.length > 18 ? 114 : 169,
              lineHeight: .97, maxWidth: 1480, overflowWrap: 'normal', textShadow: appearance === 'comic' ? 'none' : '0 13px 40px #0009'}}>{beat.title}</div>
            {beat.subtitle && <div style={{fontFamily: font, fontSize: 37, letterSpacing: 3,
              marginTop: 24, opacity: .8}}>{beat.subtitle}</div>}
          </div>;
        })}
      </div>
      <div style={{position: 'absolute', top: 56, left: 72, fontFamily: font, fontSize: 30,
        background: appearance === 'comic' ? '#F6EEDCEC' : '#0A1321E6', color: ink,
        padding: '12px 18px', borderLeft: `9px solid ${active.accent}`}}>{heading}</div>
      <div style={{position: 'absolute', right: 72, top: 65, fontFamily: font, fontSize: 36}}>{String(activeIndex + 1).padStart(2, '0')} / {String(entries.length).padStart(2, '0')}</div>
      <div style={{position: 'absolute', bottom: 64, left: 70, right: 70, display: 'flex', gap: 12}}>
        {entries.map((b, i) => <div key={b.id ?? i} style={{height: 9, flex: 1, borderRadius: 4,
          background: t >= b.at ? b.accent : appearance === 'comic' ? '#26202740' : '#FFFFFF24'}}/>)}
      </div>
      <div style={{position:'absolute',top:0,left:0,right:0,height:7,background:active.accent,
        transform:`scaleX(${ease(t / Math.max(.1,sceneLength))})`, transformOrigin:'left'}}/>
    </div>
  </AbsoluteFill>;
}