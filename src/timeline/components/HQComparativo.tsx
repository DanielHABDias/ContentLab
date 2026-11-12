import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const INK = '#0b0b10';
const FONT = 'Anton, Impact, "Arial Black", "DejaVu Sans", sans-serif';
const BODY = '"DejaVu Sans", Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Dois painéis frente a frente (um ponto por linha em cada lado) com selo "VS" no meio. */
export const HQComparativo = ({ leftTitle = 'Antes', leftItems = 'Ponto 1\nPonto 2', rightTitle = 'Depois', rightItems = 'Ponto 1\nPonto 2', leftColor = '#27a8ff', rightColor = '#ff435a', background = '#121219' }: { leftTitle?: string; leftItems?: string; rightTitle?: string; rightItems?: string; leftColor?: string; rightColor?: string; background?: string }) => {
  const frame = useCurrentFrame(); const { fps, width, height, durationInFrames } = useVideoConfig();
  const vertical = height > width; const size = Math.round(Math.min(width, height) * 0.045);
  const panel = (title: string, items: string, color: string, index: number) => {
    const enter = spring({ frame: frame - index * Math.round(fps * 0.6), fps, config: { damping: 15 } });
    const lines = String(items).split('\n').map(item => item.trim()).filter(Boolean).slice(0, 4);
    return <div style={{ flex: 1, background: color, border: `7px solid ${INK}`, boxShadow: `12px 12px 0 ${INK}`, padding: size * 0.9, opacity: enter, transform: vertical ? `translateY(${(1 - enter) * 120}px)` : `translateX(${(1 - enter) * (index ? 160 : -160)}px)`, display: 'flex', flexDirection: 'column', gap: size * 0.5, minHeight: 0 }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size * 1.5, color: '#f6f3ea', WebkitTextStroke: `2px ${INK}`, textTransform: 'uppercase' }}>{title}</div>
      {lines.map((line, position) => <div key={position} style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, color: INK, background: '#f6f3ea', border: `4px solid ${INK}`, padding: `${size * 0.3}px ${size * 0.5}px`, opacity: interpolate(frame, [index * fps * 0.6 + (position + 1) * 8, index * fps * 0.6 + (position + 1) * 8 + 6], [0, 1], clamp) }}>{line}</div>)}
    </div>;
  };
  const badge = spring({ frame: frame - Math.round(fps * 0.4), fps, config: { damping: 9 } });
  return <AbsoluteFill style={{ backgroundColor: background }}>
    <AbsoluteFill style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.08) 2px, transparent 2.6px)', backgroundSize: '20px 20px' }} />
    <div style={{ position: 'absolute', left: '7%', right: vertical ? '13%' : '7%', top: vertical ? '6%' : '9%', height: vertical ? '44%' : '62%', display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: size * 2 }}>
      {panel(leftTitle, leftItems, leftColor, 0)}{panel(rightTitle, rightItems, rightColor, 1)}
    </div>
    <div style={{ position: 'absolute', left: vertical ? '43%' : '50%', top: vertical ? '28%' : '40%', transform: `translate(-50%,-50%) scale(${badge}) rotate(-8deg)`, fontFamily: FONT, fontWeight: 900, fontSize: size * 2.2, color: INK, background: '#ffcf3f', border: `7px solid ${INK}`, borderRadius: '50%', width: size * 3.6, height: size * 3.6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>VS</div>
  </AbsoluteFill>;
};
