import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const INK = '#0b0b10';
const FONT = 'Anton, Impact, "Arial Black", "DejaVu Sans", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Abertura HQ: palavras do título entram uma a uma sobre fundo de meio-tom; o terço de baixo fica livre para a legenda. */
export const HQAbertura = ({ title = 'Título', kicker = '', background = '#15233b', accent = '#ff435a' }: { title?: string; kicker?: string; background?: string; accent?: string }) => {
  const frame = useCurrentFrame(); const { fps, width, height, durationInFrames } = useVideoConfig();
  const vertical = height > width; const words = String(title).split(/\s+/).filter(Boolean).slice(0, 12);
  const size = Math.round(Math.min(width, height) * (vertical ? 0.13 : 0.1) * (words.length > 6 ? 0.78 : 1));
  const drift = frame * 0.4;
  return <AbsoluteFill style={{ backgroundColor: background }}>
    <AbsoluteFill style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.10) 2.2px, transparent 2.8px)', backgroundSize: '22px 22px', backgroundPosition: `${drift}px ${drift}px` }} />
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 35%, transparent 35%, ${INK} 100%)`, opacity: 0.75 }} />
    <div style={{ position: 'absolute', left: '8%', right: vertical ? '14%' : '8%', top: vertical ? '8%' : '12%', height: vertical ? '40%' : '56%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: size * 0.2 }}>
      {kicker ? <div style={{ alignSelf: 'flex-start', background: accent, color: INK, fontFamily: FONT, fontWeight: 900, fontSize: size * 0.34, padding: `${size * 0.06}px ${size * 0.2}px`, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}`, transform: `rotate(-2deg) scale(${spring({ frame, fps, config: { damping: 14 } })})`, textTransform: 'uppercase' }}>{kicker}</div> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${size * 0.08}px ${size * 0.24}px`, alignItems: 'baseline' }}>
        {words.map((word, index) => {
          const enter = spring({ frame: frame - 6 - index * 4, fps, config: { damping: 13, stiffness: 160 } });
          return <span key={index} style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1, color: index === words.length - 1 ? accent : '#f6f3ea', textTransform: 'uppercase', WebkitTextStroke: `${Math.max(2, size * 0.03)}px ${INK}`, textShadow: `${size * 0.05}px ${size * 0.05}px 0 ${INK}`, opacity: enter, transform: `translateY(${(1 - enter) * size * 0.6}px) rotate(${(1 - enter) * -6}deg)`, display: 'inline-block' }}>{word}</span>;
        })}
      </div>
      <div style={{ height: Math.max(8, size * 0.09), background: accent, width: `${interpolate(frame, [10, 10 + fps], [0, vertical ? 70 : 45], clamp)}%`, border: `3px solid ${INK}` }} />
    </div>
  </AbsoluteFill>;
};
