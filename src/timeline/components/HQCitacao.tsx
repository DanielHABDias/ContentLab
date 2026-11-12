import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const INK = '#0b0b10';
const FONT = 'Anton, Impact, "Arial Black", "DejaVu Sans", sans-serif';
const BODY = '"DejaVu Sans", Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Frase em destaque numa caixa de narração HQ; a palavra marcada em `highlight` ganha a cor de destaque. */
export const HQCitacao = ({ text = 'Uma decisão leva um dia. As consequências, anos.', author = '', highlight = '', background = '#2a1420', accent = '#ffcf3f' }: { text?: string; author?: string; highlight?: string; background?: string; accent?: string }) => {
  const frame = useCurrentFrame(); const { fps, width, height, durationInFrames } = useVideoConfig();
  const vertical = height > width; const words = String(text).split(/\s+/).filter(Boolean).slice(0, 40);
  const size = Math.round(Math.min(width, height) * (vertical ? 0.062 : 0.056) * (words.length > 18 ? 0.8 : 1));
  const per = Math.max(1, Math.floor((durationInFrames * 0.6) / Math.max(1, words.length)));
  const box = spring({ frame, fps, config: { damping: 16 } });
  const mark = String(highlight).toLowerCase().trim();
  return <AbsoluteFill style={{ backgroundColor: background }}>
    <AbsoluteFill style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,.35) 3px, transparent 3.6px)', backgroundSize: '16px 16px' }} />
    <AbsoluteFill style={{ background: `linear-gradient(135deg, transparent 40%, ${accent}22 100%)` }} />
    <div style={{ position: 'absolute', left: '8%', right: vertical ? '14%' : '8%', top: vertical ? '9%' : '14%', background: '#fff6d8', border: `7px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`, padding: size * 0.9, transform: `rotate(-1.2deg) scale(${0.85 + box * 0.15})`, opacity: box }}>
      <div style={{ position: 'absolute', top: -size * 0.95, left: -size * 0.2, fontFamily: FONT, fontWeight: 900, fontSize: size * 2.4, color: accent, WebkitTextStroke: `3px ${INK}`, lineHeight: 1 }}>“</div>
      <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, color: INK, lineHeight: 1.3 }}>
        {words.map((word, index) => <span key={index} style={{ opacity: interpolate(frame, [6 + index * per, 10 + index * per], [0.12, 1], clamp), color: mark && word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').includes(mark) ? '#d01f3c' : INK }}>{word} </span>)}
      </div>
      {author ? <div style={{ marginTop: size * 0.5, fontFamily: FONT, fontWeight: 900, fontSize: size * 0.7, color: INK, textAlign: 'right', textTransform: 'uppercase' }}>— {author}</div> : null}
    </div>
  </AbsoluteFill>;
};
