import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const INK = '#0b0b10';
const FONT = 'Anton, Impact, "Arial Black", "DejaVu Sans", sans-serif';
const BODY = '"DejaVu Sans", Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Linha do tempo: uma linha por marco no formato "1939 | O que aconteceu"; os marcos acendem em sequência. */
export const HQLinhaTempo = ({ title = '', items = '1939 | Início\n1962 | Virada\n2008 | Hoje', background = '#1d1626', accent = '#ffcf3f' }: { title?: string; items?: string; background?: string; accent?: string }) => {
  const frame = useCurrentFrame(); const { fps, width, height, durationInFrames } = useVideoConfig();
  const vertical = height > width;
  const list = String(items).split('\n').map(line => { const [when, ...rest] = line.split('|'); return { when: (when || '').trim(), text: rest.join('|').trim() }; }).filter(item => item.when || item.text).slice(0, 6);
  const step = Math.max(8, Math.floor((durationInFrames - fps) / Math.max(1, list.length)));
  const progress = interpolate(frame, [0, step * list.length], [0, 1], clamp);
  const titleSize = Math.round(Math.min(width, height) * 0.06);
  const start = vertical ? { x: width * 0.16, y: height * 0.14 } : { x: width * 0.08, y: height * 0.4 };
  const span = vertical ? height * 0.34 : width * 0.84;
  return <AbsoluteFill style={{ backgroundColor: background }}>
    <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 3px, transparent 3px 120px)', transform: `translateX(${-frame * 0.5}px)` }} />
    {title ? <div style={{ position: 'absolute', left: width * 0.08, top: height * (vertical ? 0.06 : 0.1), fontFamily: FONT, fontWeight: 900, fontSize: titleSize, color: '#f6f3ea', textTransform: 'uppercase' }}>{title}</div> : null}
    <div style={{ position: 'absolute', left: start.x, top: start.y, width: vertical ? 10 : span * progress, height: vertical ? span * progress : 10, background: accent, border: `3px solid ${INK}` }} />
    {list.map((item, index) => {
      const at = list.length > 1 ? index / (list.length - 1) : 0.5; const enter = spring({ frame: frame - index * step, fps, config: { damping: 15 } });
      const x = vertical ? start.x : start.x + span * at; const y = vertical ? start.y + span * at : start.y;
      const size = Math.round(Math.min(width, height) * (vertical ? 0.05 : 0.04));
      const below = !vertical && index % 2 === 1;
      return <div key={index} style={{ position: 'absolute', left: x - 22, top: y - 17, opacity: enter }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: frame >= index * step ? accent : '#444', border: `5px solid ${INK}`, transform: `scale(${0.6 + enter * 0.4})` }} />
        <div style={{ position: 'absolute', left: vertical ? 70 : -110, top: vertical ? -14 : below ? 64 : -size * 3.6, width: vertical ? width * 0.62 : 260, textAlign: vertical ? 'left' : 'center' }}>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size * 1.3, color: accent, WebkitTextStroke: `2px ${INK}` }}>{item.when}</div>
          <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: size * 0.72, color: '#f6f3ea', lineHeight: 1.2 }}>{item.text}</div>
        </div>
      </div>;
    })}
  </AbsoluteFill>;
};
