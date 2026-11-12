import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const INK = '#0b0b10';
const FONT = 'Anton, Impact, "Arial Black", "DejaVu Sans", sans-serif';
const BODY = '"DejaVu Sans", Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Diálogo em balões: uma fala por linha no formato "Nome: fala". Não use para inventar falas de obras. */
export const HQDialogo = ({ lines = 'Nox: E se a regra estiver errada?\nVocê: Então eu preciso de outra escolha.', background = '#202a1a', accent = '#d8ff48' }: { lines?: string; background?: string; accent?: string }) => {
  const frame = useCurrentFrame(); const { fps, width, height, durationInFrames } = useVideoConfig();
  const vertical = height > width;
  const list = String(lines).split('\n').map(line => { const at = line.indexOf(':'); return at > 0 && at < 24 ? { who: line.slice(0, at).trim(), text: line.slice(at + 1).trim() } : { who: '', text: line.trim() }; }).filter(item => item.text).slice(0, 4);
  const names = [...new Set(list.map(item => item.who))];
  const step = Math.max(10, Math.floor((durationInFrames - fps) / Math.max(1, list.length)));
  const size = Math.round(Math.min(width, height) * (vertical ? 0.048 : 0.042));
  return <AbsoluteFill style={{ backgroundColor: background }}>
    <AbsoluteFill style={{ backgroundImage: `repeating-conic-gradient(from 0deg at 50% 40%, rgba(255,255,255,.05) 0deg 6deg, transparent 6deg 18deg)`, transform: `rotate(${frame * 0.08}deg) scale(1.6)` }} />
    <div style={{ position: 'absolute', left: '7%', right: vertical ? '13%' : '7%', top: vertical ? '6%' : '8%', height: vertical ? '44%' : '62%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: size * 0.9 }}>
      {list.map((item, index) => {
        const right = names.indexOf(item.who) % 2 === 1; const enter = spring({ frame: frame - index * step, fps, config: { damping: 12, stiffness: 180 } });
        return <div key={index} style={{ alignSelf: right ? 'flex-end' : 'flex-start', maxWidth: '78%', opacity: enter, transform: `scale(${0.7 + enter * 0.3})`, transformOrigin: right ? 'right bottom' : 'left bottom' }}>
          {item.who ? <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size * 0.8, color: accent, WebkitTextStroke: `1.5px ${INK}`, textAlign: right ? 'right' : 'left', textTransform: 'uppercase' }}>{item.who}</div> : null}
          <div style={{ position: 'relative', background: '#f6f3ea', border: `6px solid ${INK}`, borderRadius: size * 1.2, padding: `${size * 0.55}px ${size * 0.8}px`, fontFamily: BODY, fontWeight: 800, fontSize: size, color: INK, lineHeight: 1.2, boxShadow: `8px 8px 0 ${INK}` }}>
            {item.text}
            <div style={{ position: 'absolute', bottom: -size * 0.9, [right ? 'right' : 'left']: size * 1.2, width: 0, height: 0, borderLeft: `${size * 0.5}px solid transparent`, borderRight: `${size * 0.5}px solid transparent`, borderTop: `${size * 0.9}px solid ${INK}` } as React.CSSProperties} />
          </div>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
};
