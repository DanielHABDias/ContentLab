import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const INK = '#0b0b10';
const FONT = 'Anton, Impact, "Arial Black", "DejaVu Sans", sans-serif';
const BODY = '"DejaVu Sans", Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Encerramento HQ: estouro de quadrinho com a ideia final e um convite curto (sem pedir ação de publicação). */
export const HQChamada = ({ text = 'E você, qual escolha faria?', subtext = '', background = '#0f2a3d', accent = '#ff435a' }: { text?: string; subtext?: string; background?: string; accent?: string }) => {
  const frame = useCurrentFrame(); const { fps, width, height } = useVideoConfig();
  const vertical = height > width; const size = Math.round(Math.min(width, height) * (vertical ? 0.085 : 0.075) * (String(text).length > 40 ? 0.75 : 1));
  const pop = spring({ frame, fps, config: { damping: 10, stiffness: 140 } });
  const points = Array.from({ length: 24 }, (_, index) => { const angle = (index / 24) * Math.PI * 2; const radius = index % 2 ? 0.34 : 0.5; return `${50 + Math.cos(angle) * radius * 100}% ${50 + Math.sin(angle) * radius * 100}%`; }).join(',');
  return <AbsoluteFill style={{ backgroundColor: background }}>
    <AbsoluteFill style={{ backgroundImage: `repeating-conic-gradient(from ${frame * 0.4}deg at 50% 42%, ${accent}33 0deg 8deg, transparent 8deg 20deg)` }} />
    <div style={{ position: 'absolute', left: '50%', top: vertical ? '27%' : '42%', width: vertical ? width * 0.85 : width * 0.62, height: vertical ? width * 0.85 : width * 0.42, transform: `translate(-50%,-50%) scale(${pop}) rotate(${interpolate(pop, [0, 1], [-10, -3])}deg)`, background: '#ffcf3f', clipPath: `polygon(${points})`, filter: `drop-shadow(10px 10px 0 ${INK})` }} />
    <div style={{ position: 'absolute', left: vertical ? '12%' : '24%', right: vertical ? '16%' : '24%', top: vertical ? '27%' : '42%', transform: `translateY(-50%) scale(${pop})`, textAlign: 'center' }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, color: INK, textTransform: 'uppercase', lineHeight: 1.05 }}>{text}</div>
      {subtext ? <div style={{ marginTop: size * 0.35, fontFamily: BODY, fontWeight: 800, fontSize: size * 0.38, color: INK, opacity: interpolate(frame, [fps * 0.5, fps * 0.8], [0, 1], clamp) }}>{subtext}</div> : null}
    </div>
  </AbsoluteFill>;
};
