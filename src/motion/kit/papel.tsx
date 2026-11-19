import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';

/*
 * Fundos de papel amassado gerados por código, sem imagem. Quatro modos, cada um um fundo do kit:
 *   papel        facetado: a folha em planos desenhados, com alguns vincos em traço (o padrão);
 *   papel-dobras dobras realistas: vincos que dividem a folha em planos de luz, brilho nas cristas, grão;
 *   papel-hq     as mesmas dobras em tons chapados, meio-tom nas sombras e tinta sobre os vincos;
 *   papel-sutil  as dobras mais leves, para não disputar com texto e imagem.
 * Todos trocam o amassado a cada `hold` quadros, como um GIF em stop motion: cada troca é uma semente nova.
 */
const PAPER = '#F2E8D5';
const useStep = (hold: number) => Math.floor(useCurrentFrame() / hold);

/** Facetado (fundo `papel`): o papel em facetas planas, como dobras desenhadas, com alguns vincos em traço de tinta. */
export const PapelFacetado: React.FC<{ hold?: number }> = ({ hold = 6 }) => {
  const step = useStep(hold); const { width: W, height: H } = useVideoConfig();
  const cols = 9, rows = Math.round(cols * H / W) + 1; const cw = W / cols, rh = H / rows;
  const pt = (i: number, j: number) => { const edge = i === 0 || j === 0 || i === cols || j === rows; const r = (s: string) => (random(`${s}${i}-${j}-${step}`) - .5) * (edge ? 0 : .85); return [i * cw + r('x') * cw, j * rh + r('y') * rh]; };
  const grid = Array.from({ length: cols + 1 }, (_, i) => Array.from({ length: rows + 1 }, (_, j) => pt(i, j)));
  const light = [-.55, -.65, .52];
  const shade = (a: number[], b: number[], c: number[], seed: string) => {
    // A tilted normal per facet, lit from the top left, keeps neighbouring facets clearly different.
    const nx = (random(`nx${seed}`) - .5) * 1.3, ny = (random(`ny${seed}`) - .5) * 1.3, nz = 1; const len = Math.hypot(nx, ny, nz);
    const d = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / len);
    const t = Math.min(1, .8 + d * .3); return `rgb(${Math.round(242 * t + 8)},${Math.round(232 * t + 4)},${Math.round(213 * t)})`;
  };
  const tris: React.ReactNode[] = []; const folds: React.ReactNode[] = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1]; const flip = random(`f${i}-${j}-${step}`) > .5;
    const [t1, t2] = flip ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const [n, t] of [[0, t1], [1, t2]] as const) tris.push(<polygon key={`${i}-${j}-${n}`} points={t.map(p => p.join(',')).join(' ')} fill={shade(t[0], t[1], t[2], `${i}-${j}-${n}-${step}`)} stroke={shade(t[0], t[1], t[2], `${i}-${j}-${n}-${step}`)} strokeWidth={1} />);
    if (random(`k${i}-${j}-${step}`) > .86) { const [p, q] = flip ? [a, c] : [b, d]; folds.push(<line key={`k${i}-${j}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#3a2f22" strokeWidth={2} strokeOpacity={.4} strokeLinecap="round" />); }
  }
  return <AbsoluteFill style={{ background: PAPER }}><svg width="100%" height="100%">{tris}{folds}</svg></AbsoluteFill>;
};

/*
 * Dobras: o amassado é um conjunto de vincos retos. Cada vinco inclina a folha para lados opostos, então a
 * claridade muda de uma vez ao cruzá-lo (planos com luz diferente) e some aos poucos nas pontas. Cristas pegam
 * um brilho fino. O cálculo roda em meia resolução e só quando o amassado troca (a cada `hold` quadros).
 */
type Crease = { cx: number; cy: number; cos: number; sin: number; half: number; k: number; ridge: boolean };
// A few long folds that cross the sheet plus many short creases, as in a real crumpled page.
const creasesFor = (W: number, H: number, step: number, count: number, depth: number): Crease[] => Array.from({ length: count * 3 }, (_, i) => {
  const r = (s: string) => random(`dobra-${s}-${i}-${step}`); const a = r('a') * Math.PI; const long = i < count;
  const half = (long ? .22 + r('l') * .45 : .04 + r('l') * .12) * Math.hypot(W, H);
  return { cx: (r('x') * 1.2 - .1) * W, cy: (r('y') * 1.2 - .1) * H, cos: Math.cos(a), sin: Math.sin(a), half, k: (r('s') > .5 ? 1 : -1) * (long ? .04 + r('k') * .06 : .015 + r('k') * .03) * depth, ridge: r('r') > .55 };
});
/** Mean and spread of the raw relief, so every swap lands on the same overall brightness. */
const levels = (W: number, H: number, creases: Crease[], step: number) => {
  const vals: number[] = []; for (let y = 0; y < 24; y++) for (let x = 0; x < 40; x++) vals.push(brightness((x + .5) * W / 40, (y + .5) * H / 24, creases, step));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length; const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
  return (v: number, depth: number) => .92 + (v - mean) / sd * .075 * depth;
};
const brightness = (x: number, y: number, creases: Crease[], step: number) => {
  let v = .93 + Math.sin(x / 410 + step) * .012 + Math.sin(y / 290 - step * .7) * .012;
  for (const c of creases) {
    const dx = x - c.cx, dy = y - c.cy, t = dx * c.cos + dy * c.sin, d = -dx * c.sin + dy * c.cos;
    const along = Math.exp(-((t / c.half) ** 4)); if (along < .01) continue;
    v += c.k * along * (Math.tanh(d / 1.6) + d / 900);
    if (c.ridge && Math.abs(d) < 2.2) v += .05 * along * (1 - Math.abs(d) / 2.2);
  }
  return v;
};
const PAPER_RGB = [242, 232, 213];

const PapelDobras: React.FC<{ hold?: number; hq?: boolean; depth?: number; count?: number }> = ({ hold = 6, hq = false, depth = 1, count = 12 }) => {
  const step = useStep(hold); const { width: W, height: H } = useVideoConfig(); const ref = useRef<HTMLCanvasElement>(null);
  const creases = useMemo(() => creasesFor(W, H, step, count, depth), [W, H, step, count, depth]);
  const level = useMemo(() => levels(W, H, creases, step), [W, H, creases, step]);
  useLayoutEffect(() => {
    const canvas = ref.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
    const sw = Math.ceil(W / 2), sh = Math.ceil(H / 2); const img = ctx.createImageData(sw, sh); const px = img.data;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      let b = level(brightness(x * 2, y * 2, creases, step), depth);
      if (hq) b = b > .95 ? 1 : b > .87 ? .91 : .8; else b += (random(`g${x % 97}-${y % 89}`) - .5) * .02;
      const o = (y * sw + x) * 4; const warm = hq ? 0 : (1 - b) * 18;
      px[o] = Math.min(255, PAPER_RGB[0] * b); px[o + 1] = Math.min(255, PAPER_RGB[1] * b - warm * .3); px[o + 2] = Math.min(255, PAPER_RGB[2] * b - warm); px[o + 3] = 255;
    }
    canvas.width = sw; canvas.height = sh; ctx.putImageData(img, 0, 0);
  }, [W, H, creases, hq, step, level, depth]);
  // HQ: halftone dots where the folds are in shadow, and ink drawn right on the valley creases.
  const dots = useMemo(() => {
    if (!hq) return null; const g = 14; const out: React.ReactNode[] = [];
    for (let y = 0; y < H + g; y += g) for (let x = (y / g) % 2 ? g / 2 : 0; x < W + g; x += g) {
      const b = level(brightness(x, y, creases, step), depth); const r = Math.max(0, Math.min(1, (.9 - b) / .12)) * 4.6;
      if (r > .8) out.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#8f7a5c" />);
    }
    return out;
  }, [hq, W, H, creases, step, level, depth]);
  return <AbsoluteFill style={{ background: PAPER }}>
    <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: hq ? 'pixelated' : 'auto' }} />
    {hq && <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <g opacity={.55}>{dots}</g>
      {creases.filter(c => !c.ridge && Math.abs(c.k) > .03 * depth).map((c, i) => {
        // A short tapered stroke on the deepest part of the fold, slightly off-centre like a hand-inked crease.
        const len = Math.min(c.half * .5, 260) * (.5 + random(`il${i}-${step}`) * .5), off = (random(`io${i}-${step}`) - .5) * c.half * .6;
        const mx = c.cx + c.cos * off, my = c.cy + c.sin * off, bend = (random(`ib${i}-${step}`) - .5) * 18;
        const ax = mx - c.cos * len, ay = my - c.sin * len, bx = mx + c.cos * len, by = my + c.sin * len;
        return <path key={i} d={`M ${ax} ${ay} Q ${mx - c.sin * bend} ${my + c.cos * bend} ${bx} ${by}`} fill="none" stroke="#2a2219" strokeOpacity={.5} strokeWidth={2.4} strokeLinecap="round" strokeDasharray={`${len * 1.6} 4000`} />;
      })}
    </svg>}
  </AbsoluteFill>;
};
/** Fundo `papel-dobras`. */
export const PapelDobrasReal: React.FC = () => <PapelDobras />;
/** Fundo `papel-hq`. */
export const PapelDobrasHQ: React.FC = () => <PapelDobras hq />;
/** Fundo `papel-sutil`. */
export const PapelDobrasSutil: React.FC = () => <PapelDobras depth={.5} count={10} />;
