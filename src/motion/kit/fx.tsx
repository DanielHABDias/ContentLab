import React, { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, interpolate, random, staticFile, useCurrentFrame, Easing } from 'remotion';

/** Paleta do padrão visual Diazverso. */
export const C = { ink: '#0B0B10', paper: '#F2E8D5', yellow: '#F5C518', red: '#E63946', blue: '#2676E8', eye: '#FCDF43', white: '#FFFFFF' };
export const ANTON = 'Anton, Impact, sans-serif';
export const ROUND = '"Arial Rounded MT Bold", "Nunito", "DejaVu Sans", sans-serif';

/** Carrega a Anton do public/ antes do primeiro frame. */
export const useAnton = () => {
  const [handle] = useState(() => delayRender('Anton'));
  useEffect(() => {
    const font = new FontFace('Anton', `url(${staticFile('brand/Anton-Regular.ttf')})`);
    font.load().then(loaded => { document.fonts.add(loaded); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);
};

/** Caminhos `public:<arquivo>` (pasta pública do editor) viram URLs do bundle via staticFile. */
export const resolvePublic = (value: unknown): any => typeof value === 'string' ? (value.startsWith('public:') ? staticFile(value.slice(7)) : value) : Array.isArray(value) ? value.map(resolvePublic) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolvePublic(v)])) : value;

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const pop = (frame: number, at: number, length = 8) => interpolate(frame - at, [0, length * 0.6, length], [0, 1.12, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
export const slide = (frame: number, at: number, length = 10) => interpolate(frame - at, [0, length], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

/** Texto de impacto com aberração cromática (vermelho/azul deslocados), como nos títulos do RunnyIA. */
export const Punch: React.FC<{ children: React.ReactNode; size: number; color?: string; split?: number; style?: React.CSSProperties }> = ({ children, size, color = C.white, split = 6, style }) => (
  <div style={{ fontFamily: ANTON, fontSize: size, lineHeight: 0.95, color, textTransform: 'uppercase', letterSpacing: size * 0.01, textShadow: `${split}px 0 0 rgba(230,57,70,.85), ${-split}px 0 0 rgba(38,118,232,.85), 0 ${size * 0.06}px 0 rgba(0,0,0,.55)`, ...style }}>{children}</div>
);

/** Grão de filme animado + vinheta + linhas de scan: a textura que une todas as cenas. */
export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.16, mixBlendMode: 'overlay' }}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 12} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill style={{ background: 'repeating-linear-gradient(to bottom, rgba(0,0,0,.10) 0px, rgba(0,0,0,.10) 1px, transparent 2px, transparent 4px)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)' }} />
    </AbsoluteFill>
  );
};

/** Campo de estrelas em deriva lenta (fundo dos textos "pensados", inspirado no RunnyIA). */
export const Stars: React.FC<{ speed?: number }> = ({ speed = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {Array.from({ length: 90 }, (_, i) => {
        const x = random(`x${i}`) * 1920; const y = random(`y${i}`) * 1080; const z = 0.3 + random(`z${i}`) * 1.4;
        const drift = ((x + frame * speed * z * 1.4) % 1960) - 20;
        return <div key={i} style={{ position: 'absolute', left: drift, top: y, width: z * 2.2, height: z * 2.2, borderRadius: 9, background: '#fff', opacity: 0.25 + 0.6 * Math.abs(Math.sin(frame / 20 + i)) * (z / 1.7) }} />;
      })}
    </AbsoluteFill>
  );
};

/** Explosão de linhas de velocidade (mangá) girando devagar atrás do assunto. */
export const SpeedBurst: React.FC<{ color?: string; bg?: string; rays?: number }> = ({ color = C.ink, bg = C.yellow, rays = 36 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
      <svg viewBox="-960 -540 1920 1080" width="100%" height="100%" style={{ transform: `rotate(${frame * 0.4}deg) scale(1.6)` }}>
        {Array.from({ length: rays }, (_, i) => { const a = (i / rays) * Math.PI * 2; const w = 0.025 + random(`r${i}`) * 0.05; return <polygon key={i} fill={color} points={`0,0 ${Math.cos(a - w) * 1500},${Math.sin(a - w) * 1500} ${Math.cos(a + w) * 1500},${Math.sin(a + w) * 1500}`} />; })}
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(circle at center, ${bg} 0%, ${bg} 22%, transparent 45%)` }} />
    </AbsoluteFill>
  );
};

/** Fundo de meio-tom (pontos) com cor base: a "página" HQ. */
export const Halftone: React.FC<{ bg?: string; dot?: string; size?: number; drift?: boolean }> = ({ bg = C.paper, dot = 'rgba(11,11,16,.13)', size = 22, drift = true }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: bg, backgroundImage: `radial-gradient(${dot} 28%, transparent 30%)`, backgroundSize: `${size}px ${size}px`, backgroundPosition: drift ? `${frame * 0.6}px ${frame * 0.3}px` : '0 0' }} />;
};

/** Tremor de câmera que decai depois de um impacto. */
export const shake = (frame: number, hits: number[], power = 18) => {
  const amount = hits.reduce((sum, hit) => sum + (frame >= hit ? Math.exp(-(frame - hit) / 4) : 0), 0) * power;
  return `translate(${(random(`sx${frame}`) - 0.5) * amount}px, ${(random(`sy${frame}`) - 0.5) * amount}px)`;
};

/** Clarão branco curto nas trocas fortes. */
export const Flash: React.FC<{ at: number; length?: number; color?: string }> = ({ at, length = 4, color = '#fff' }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - at, [0, 1, length], [0, 0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: 'none' }} />;
};

/** Painel HQ: borda de tinta, sombra sólida deslocada e leve rotação. */
export const Panel: React.FC<{ x: number; y: number; w: number; h: number; rotate?: number; bg?: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, w, h, rotate = 0, bg = C.paper, children, style }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: bg, border: `8px solid ${C.ink}`, boxShadow: `14px 14px 0 ${C.ink}`, transform: `rotate(${rotate}deg)`, overflow: 'hidden', ...style }}>{children}</div>
);
