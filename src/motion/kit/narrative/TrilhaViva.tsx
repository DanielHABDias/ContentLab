import React from 'react';
import { AbsoluteFill, Freeze, Sequence, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background, Media, useAsset, color } from '../stage';
import { ANTON, C } from '../fx';
import { lineY, timelineState } from './trilha';
import { Caption, Common } from './shared';

type Chapter = { titulo: string; midia?: string; inicio?: number; fonte?: string; rotulo?: string };
type Props = Common & { capitulos?: Chapter[]; fragmentos?: Chapter[]; de?: number; ate?: number; entrar?: boolean; sair?: boolean; mergulhar?: boolean };

/** Mídia do capítulo: congelada no primeiro quadro, ou tocando enquanto a câmera está dentro dele. */
const ChapterMedia: React.FC<{ item: Chapter; len: number; liveFrom: number | null }> = ({ item, len, liveFrom }) => {
  const asset = useAsset(item.midia); const { fps } = useVideoConfig(); const frame = useCurrentFrame();
  // The chapter the camera will enter stays frozen like the others until the entrance starts.
  if (liveFrom !== null && frame < liveFrom) liveFrom = null;
  if (!asset) return <AbsoluteFill style={{ background: '#1c2233', backgroundImage: 'radial-gradient(#ffffff22 18%,transparent 22%)', backgroundSize: '18px 18px' }} />;
  const content = <Media asset={asset} len={len} inicio={item.inicio ?? 0} motion="entrar" />;
  // Frozen a little into the source: many clips open on black.
  return liveFrom === null ? <Freeze frame={asset.kind === 'video' ? Math.round(fps * 1.2) : 0}>{content}</Freeze> : <Sequence from={liveFrom} layout="none" premountFor={fps}>{content}</Sequence>;
};

/** Botão de rebobinar: dois triângulos para trás, como no controle de um videocassete. */
const RewindIcon: React.FC<{ size: number }> = ({ size }) => <svg width={size * 1.6} height={size} viewBox="0 0 160 100"><path d="M78 10 L8 50 L78 90Z M152 10 L82 50 L152 90Z" fill={C.white} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" /></svg>;

export const TrilhaViva: React.FC<Props> = p => {
  const f = useCurrentFrame(); const { width: W, height: H } = useVideoConfig(); const V = H > W;
  const s = timelineState(f, p.len, p); const accent = color(p.tom, C.blue);
  // Cards share the frame's aspect ratio, so entering one lands exactly on full screen without cropping.
  const cw = V ? W * .36 : W * .25, ch = cw * H / W, S = V ? W * .62 : W * .34;
  const xOf = (c: number) => (c - 1) * S;
  // Vertical keeps every card above the line, clear of the Shorts interface at the bottom.
  const above = (c: number) => V || c % 2 === 1;
  const ly = (x: number) => lineY(x, H, V);
  const gap = V ? H * .035 : H * .07;
  const cardBox = (c: number) => { const x = xOf(c), y = ly(x); return { x: x - cw / 2, y: above(c) ? y - gap - ch : y + gap, cx: x, cy: above(c) ? y - gap - ch / 2 : y + gap + ch / 2 }; };

  // Camera: line view centered on the travelling position, blended into a cover-fit view of the chapter inside.
  const camX = xOf(s.pos || 1); const lineView = { s: 1, x: camX, y: H / 2 };
  const box = s.inside ? cardBox(s.inside) : null; const full = Math.max(W / cw, H / ch) * 1.002;
  const z = s.zoom; const cam = box ? { s: 1 + (full - 1) * z, x: lineView.x + (box.cx - lineView.x) * z, y: lineView.y + (box.cy - lineView.y) * z } : lineView;
  const jitter = s.rewinding && s.moving ? (random(`rw${Math.floor(f / 2)}`) - .5) * 14 : 0;
  const view = { left: cam.x - W / (2 * cam.s) - cw, right: cam.x + W / (2 * cam.s) + cw };
  const visible = s.chapters.map((item, i) => ({ item, c: i + 1 })).filter(({ c }) => xOf(c) + cw / 2 >= view.left && xOf(c) - cw / 2 <= view.right);
  const enterFrame = Math.round(s.enterStart * (p.len - 1));

  // Only the stretch of line inside the view is drawn, so a 40-chapter history costs the same as a 5-chapter one.
  const x0 = Math.max(xOf(1) - S * .4, view.left), x1 = Math.min(xOf(s.n) + S * .4, view.right);
  const pts = (a: number, b: number) => { const out: string[] = []; for (let x = a; x <= b; x += 24) out.push(`${out.length ? 'L' : 'M'} ${x.toFixed(1)} ${ly(x).toFixed(1)}`); out.push(`L ${b.toFixed(1)} ${ly(b).toFixed(1)}`); return out.join(' '); };
  const deco = 1 - z;

  return <AbsoluteFill style={{ overflow: 'hidden', background: C.ink }}>
    <Background kind={p.fundo || 'estrelas'} tint={p.tom} />
    <div data-timeline-world style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${W / 2 - cam.x * cam.s + jitter}px, ${H / 2 - cam.y * cam.s}px) scale(${cam.s})`, filter: s.rewinding ? 'saturate(.55) contrast(1.15)' : undefined }}>
      {s.n > 0 && x1 > x0 && <svg style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', opacity: deco }}>
        <path d={pts(x0, x1)} fill="none" stroke="#343b4a" strokeWidth={14} strokeLinecap="round" />
        {camX > x0 && <path d={pts(x0, Math.min(camX, x1))} fill="none" stroke={accent} strokeWidth={8} strokeLinecap="round" />}
      </svg>}
      {visible.map(({ item, c }) => {
        const b = cardBox(c); const here = s.inside === c || (!s.moving && Math.abs(s.pos - c) < .5) || (s.moving && Math.abs(s.pos - c) < .35);
        const inside = s.inside === c; const fade = inside ? deco : 1;
        const live = s.enter && c === s.to ? enterFrame : s.exit && c === s.from ? 0 : null;
        const dotX = xOf(c), dotY = ly(dotX);
        return <React.Fragment key={c}>
          <div style={{ position: 'absolute', left: dotX - 3, top: above(c) ? dotY - gap : dotY, width: 6, height: gap, background: here ? accent : '#4a5163', opacity: deco }} />
          <div style={{ position: 'absolute', left: dotX - 30, top: dotY - 30, width: 60, height: 60, borderRadius: 30, background: here ? accent : '#262c3a', border: `5px solid ${C.ink}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ANTON, fontSize: 26, color: C.white, opacity: deco, transform: `scale(${here ? 1.18 : 1})` }}>{String(c).padStart(2, '0')}</div>
          <div data-trail-item={c - 1} data-trail-active={here ? 'true' : 'false'} style={{ position: 'absolute', left: b.x, top: b.y, width: cw, height: ch, background: C.ink, zIndex: inside ? 30 : 5, filter: here ? 'none' : 'grayscale(.85) brightness(.55)', boxShadow: here && fade > .2 ? `9px 9px 0 ${C.red},-4px -3px 0 ${C.blue}` : 'none', outline: fade > .2 ? `${here ? 4 : 2}px solid ${here ? accent : '#687080'}` : 'none' }}>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}><ChapterMedia item={item} len={p.len} liveFrom={live} /></div>
            <div style={{ position: 'absolute', left: 0, top: 0, background: C.yellow, color: C.ink, fontFamily: ANTON, fontSize: V ? 26 : 20, padding: '2px 10px', opacity: fade }}>{item.rotulo || `CAP. ${String(c).padStart(2, '0')}`}</div>
            <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, opacity: fade, fontFamily: ANTON, fontSize: V ? 38 : 30, lineHeight: 1.05, color: here ? C.yellow : '#d4d5da', textShadow: '2px 3px 2px #000', background: '#0b0b10cc', padding: '4px 12px', textTransform: 'uppercase' }}>{item.titulo}{item.fonte && <small style={{ display: 'block', fontSize: 16, color: '#ddd' }}>{item.fonte}</small>}</div>
          </div>
        </React.Fragment>;
      })}
    </div>
    <div style={{ position: 'absolute', left: W * .06, top: H * .07, opacity: deco }}><Caption text={p.titulo} w={W * .86} size={V ? 58 : 72} /></div>
    {s.n > 0 && <div style={{ position: 'absolute', left: W * .06, bottom: V ? H * .26 : H * .08, opacity: deco, fontFamily: ANTON, fontSize: V ? 46 : 56, color: C.yellow }}>{String(Math.round(s.pos)).padStart(2, '0')} <span style={{ color: '#abb1c0', fontSize: V ? 26 : 28 }}>/ {String(s.n).padStart(2, '0')}</span></div>}
    {s.rewinding && <>
      <AbsoluteFill style={{ pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px 5px)' }} />
      {[0, 1, 2].map(i => { const y = random(`bar${i}-${Math.floor(f / 3)}`) * H; return <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: y, height: 6 + i * 5, background: 'rgba(255,255,255,.22)', mixBlendMode: 'screen' }} />; })}
      <div data-timeline-rewind style={{ position: 'absolute', left: 0, right: 0, top: V ? H * .14 : H * .08, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, opacity: Math.floor(f / 8) % 2 ? .55 : 1 }}>
        <RewindIcon size={V ? 70 : 64} /><span style={{ fontFamily: ANTON, fontSize: V ? 60 : 56, color: C.white, textShadow: `4px 0 0 rgba(230,57,70,.85), -4px 0 0 rgba(38,118,232,.85)` }}>VOLTANDO</span>
      </div>
    </>}
    {s.dark > 0 && <AbsoluteFill style={{ background: '#000', opacity: s.dark, pointerEvents: 'none' }} />}
  </AbsoluteFill>;
};
