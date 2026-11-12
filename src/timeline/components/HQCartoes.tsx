import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const INK = '#0b0b10';
const FONT = 'Anton, Impact, "Arial Black", "DejaVu Sans", sans-serif';
const BODY = '"DejaVu Sans", Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Ideias em cartões HQ que aparecem em sequência e se ligam por traços (uma ideia por linha em `items`). */
export const HQCartoes = ({ title = '', items = 'Ideia 1\nIdeia 2\nIdeia 3', background = '#18243c', accent = '#ff435a', card = '#f6f3ea' }: { title?: string; items?: string; background?: string; accent?: string; card?: string }) => {
  const frame = useCurrentFrame(); const { fps, width, height, durationInFrames } = useVideoConfig();
  const vertical = height > width; const list = String(items).split('\n').map(item => item.trim()).filter(Boolean).slice(0, 5);
  const top = height * (vertical ? 0.08 : 0.1); const areaH = height * (vertical ? 0.4 : 0.58);
  const titleSize = Math.round(Math.min(width, height) * 0.065);
  const step = Math.max(8, Math.floor((durationInFrames - fps) / Math.max(1, list.length)));
  const cols = vertical ? 1 : Math.min(3, list.length); const rows = Math.ceil(list.length / cols);
  const cardW = vertical ? width * 0.72 : (width * 0.8) / cols - 30; const cardH = Math.min(areaH / rows - 26, vertical ? 150 : 220);
  const base = title ? top + titleSize * 1.6 : top;
  const pos = list.map((_, index) => { const row = Math.floor(index / cols); const col = index % cols; const x = vertical ? width * 0.08 + (index % 2) * width * 0.06 : width * 0.1 + col * (cardW + 30) + (row % 2) * 30; return { x, y: base + row * (cardH + 26) }; });
  return <AbsoluteFill style={{ backgroundColor: background }}>
    <AbsoluteFill style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.05) 2px, transparent 2px)', backgroundSize: '64px 64px', backgroundPosition: `${frame * 0.6}px 0` }} />
    {title ? <div style={{ position: 'absolute', left: width * 0.08, top, fontFamily: FONT, fontWeight: 900, fontSize: titleSize, color: '#f6f3ea', textTransform: 'uppercase', WebkitTextStroke: `2px ${INK}`, opacity: interpolate(frame, [0, 8], [0, 1], clamp) }}>{title}</div> : null}
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
      {pos.slice(1).map((point, index) => { const from = pos[index]; const t = interpolate(frame, [(index + 1) * step, (index + 1) * step + 10], [0, 1], clamp); const x1 = from.x + cardW / 2; const y1 = from.y + cardH / 2; const x2 = point.x + cardW / 2; const y2 = point.y + cardH / 2; return <line key={index} x1={x1} y1={y1} x2={x1 + (x2 - x1) * t} y2={y1 + (y2 - y1) * t} stroke={accent} strokeWidth={8} strokeLinecap="round" strokeDasharray="2 18" />; })}
    </svg>
    {list.map((text, index) => {
      const enter = spring({ frame: frame - index * step, fps, config: { damping: 14, stiffness: 170 } });
      const size = Math.round(Math.min(cardH * 0.3, (cardW / Math.max(8, text.length)) * 1.9, 54));
      return <div key={index} style={{ position: 'absolute', left: pos[index].x, top: pos[index].y, width: cardW, height: cardH, background: card, border: `6px solid ${INK}`, boxShadow: `10px 10px 0 ${INK}`, display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px', boxSizing: 'border-box', opacity: enter, transform: `scale(${0.8 + enter * 0.2}) rotate(${(index % 2 ? 1.5 : -1.5) * enter}deg)` }}>
        <div style={{ flex: 'none', width: size * 1.5, height: size * 1.5, borderRadius: '50%', background: accent, border: `4px solid ${INK}`, color: INK, fontFamily: FONT, fontWeight: 900, fontSize: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{index + 1}</div>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, color: INK, lineHeight: 1.15 }}>{text}</div>
      </div>;
    })}
  </AbsoluteFill>;
};
