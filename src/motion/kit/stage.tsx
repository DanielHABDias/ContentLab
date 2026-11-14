import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, Halftone, SpeedBurst, Stars, ease } from './fx';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export type Asset = { src: string; kind: 'image' | 'video'; w?: number; h?: number };
/** Imagem bem mais alta que larga (capa de HQ, pôster). */
export const isPortrait = (asset?: Asset | null) => Boolean(asset && asset.kind === 'image' && asset.w && asset.h && asset.h > asset.w * 1.1);
export const Assets = createContext<Record<string, Asset>>({});
export const useAsset = (ref?: string): Asset | null => { const assets = useContext(Assets); if (!ref) return null; const id = ref.startsWith('media:') ? ref.slice(6) : ref; return assets[id] || null; };
export type Base = { len: number };
export type Bg = 'estrelas' | 'explosao' | 'meio-tom' | 'branco' | 'papel' | 'escuro';
const COLORS: Record<string, string> = { branco: C.white, amarelo: C.yellow, vermelho: C.red, azul: C.blue, tinta: C.ink };
export const color = (name?: string, fallback = C.white) => (name && (COLORS[name] || (/^#[0-9a-f]{6}$/i.test(name) ? name : null))) || fallback;

/** Palco: tamanho do vídeo e orientação. */
export const useStage = () => { const { width: W, height: H } = useVideoConfig(); return { W, H, V: H > W }; };
/** Tamanho de fonte que faz a palavra mais longa caber na largura (o texto quebra linha nas demais). */
export const fit = (text: string, width: number, max: number, lines = 3) => {
  const words = String(text).split(/\s+/).filter(Boolean);
  const longest = Math.max(3, ...words.map(word => word.length));
  const byWord = width / (longest * 0.58);
  const byLines = (width * lines) / Math.max(4, String(text).length * 0.6);
  return Math.min(max, byWord, Math.max(byLines, max * 0.45));
};

/** Fundo por nome. */
export const Background: React.FC<{ kind?: Bg; tint?: string }> = ({ kind = 'estrelas', tint }) => {
  if (kind === 'explosao') return <SpeedBurst bg={color(tint, C.yellow)} />;
  if (kind === 'meio-tom') return <Halftone bg={color(tint, C.blue)} dot="rgba(255,255,255,.12)" />;
  if (kind === 'papel') return <Halftone />;
  if (kind === 'branco') return <AbsoluteFill style={{ background: '#fff' }} />;
  if (kind === 'escuro') return <AbsoluteFill style={{ background: '#121219' }} />;
  return <Stars />;
};

/** Entrada com zoom e desfoque de movimento + câmera em movimento contínuo (nunca parada). */
export const Camera: React.FC<{ children: React.ReactNode; push?: number; from?: number }> = ({ children, push = 0.00035, from = 1.18 }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 7], [from, 1], { ...clamp, easing: ease });
  const b = interpolate(f, [0, 5], [10, 0], clamp);
  return <AbsoluteFill style={{ transform: `scale(${s * (1 + Math.min(f, 300) * push)}) rotate(${Math.sin(f / 40) * 0.4}deg)`, filter: b > 0.2 ? `blur(${b}px)` : undefined }}>{children}</AbsoluteFill>;
};

/** Mídia (imagem ou vídeo sem áudio) cobrindo a caixa, com Ken Burns: entrar, sair ou panorâmica. */
export const Media: React.FC<{ asset: Asset | null; len: number; motion?: 'entrar' | 'sair' | 'panoramica'; fit?: 'cover' | 'contain'; style?: React.CSSProperties; inicio?: number; som?: boolean; volume?: number; zoom?: number; foco?: string }> = ({ asset, len, motion = 'entrar', fit = 'cover', style: extra, inicio = 0, som = false, volume = 1, zoom = 1, foco }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  if (!asset) return <AbsoluteFill style={{ background: C.ink }} />;
  const t = f / Math.max(1, len);
  const scale = (fit === 'contain' ? (motion === 'sair' ? 0.98 - 0.04 * t : 0.94 + 0.04 * t) : (motion === 'sair' ? 1.18 - 0.14 * t : 1.04 + 0.14 * t)) * zoom;
  const x = motion === 'panoramica' ? interpolate(t, [0, 1], [-4, 4]) : 0;
  // `foco` (object-position) escolhe a parte que fica no quadro quando a mídia é cortada (ex.: '50% 20%' = rosto no alto).
  const style: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit, objectPosition: foco, transform: `scale(${scale}) translateX(${x}%)`, transformOrigin: foco, ...extra };
  // Vídeo: `inicio` escolhe o trecho da fonte; `som` deixa ouvir o áudio original (trecho com pausa na narração).
  return asset.kind === 'video' ? <OffthreadVideo src={asset.src} muted={!som} volume={som ? volume : 0} trimBefore={Math.max(0, Math.round(inicio * fps))} style={style} /> : <Img src={asset.src} style={style} />;
};
