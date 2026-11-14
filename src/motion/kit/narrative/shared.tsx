import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, C, Punch, pop, slide, shake } from '../fx';
import { Background, Camera, Media, useAsset, color, fit } from '../stage';

export { C, Punch, pop, slide, shake, Media, useAsset, color };
export type Item = { titulo: string; texto?: string; midia?: string; fonte?: string; tom?: string };
export type Common = { len: number; titulo?: string; fundo?: 'estrelas' | 'escuro' | 'meio-tom' | 'explosao'; tom?: string; /** Fração do beat reservada à conclusão. */ virada?: number };
/** Palco lógico seguro: cabe no quadro horizontal e na zona editorial do Short. */
export function useBoard() {
  const f = useCurrentFrame(); const { width, height, fps } = useVideoConfig(); const V = height > width;
  const w = V ? 900 : 1600, h = V ? 1050 : 780;
  const scale = Math.min((width * .86) / w, (height * (V ? .55 : .76)) / h);
  return { f, fps, V, w, h, scale, x: (width - w * scale) / 2, y: V ? height * .14 : (height - h * scale) / 2 };
}
export const phase = (f: number, len: number, at: number, span = .12) => slide(f, Math.round(len * at), Math.max(1, Math.round(len * span)));
export const hit = (len: number, at: number) => Math.round(len * at);
export const Caption: React.FC<{ text?: string; x?: number; y?: number; w?: number; size?: number; tone?: string; style?: React.CSSProperties }> = ({ text, x = 0, y = 0, w = 500, size = 58, tone = C.white, style }) => text ? <div style={{ position: 'absolute', left: x, top: y, width: w, color: tone, fontFamily: ANTON, fontSize: fit(text, w, size, 2), lineHeight: 1.12, textTransform: 'uppercase', overflowWrap: 'anywhere', ...style }}>{text}</div> : null;
export const Board: React.FC<Common & { children: React.ReactNode }> = ({ titulo, fundo = 'estrelas', tom, children }) => {
  const b = useBoard();
  return <Camera from={1.06} push={.00012}><Background kind={fundo} tint={tom}/><div style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, transform: `scale(${b.scale})`, transformOrigin: 'top left' }}><div style={{ position: 'absolute', left: 0, top: -10, width: 9, height: 67, background: color(tom, C.yellow) }}/><Caption text={titulo} x={30} y={0} w={b.w - 60} size={68}/>{children}</div></Camera>;
};
/** Cartão escuro com borda de tinta e registro cromático, na linguagem do kit. */
export const Card: React.FC<{ item: Item; len: number; x: number; y: number; w: number; h: number; at?: number; rotate?: number; style?: React.CSSProperties }> = ({ item, len, x, y, w, h, at = 0, rotate = 0, style }) => {
  const { f } = useBoard(); const asset = useAsset(item.midia); const accent = color(item.tom, C.yellow);
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: '#171d2b', border: `5px solid ${C.ink}`, outline: `2px solid ${accent}`, boxShadow: `9px 9px 0 ${C.red}, -4px -3px 0 ${C.blue}`, transform: `rotate(${rotate}deg) scale(${pop(f, at, 9)})`, overflow: 'hidden', ...style }}>
    {asset && <div style={{ position: 'absolute', inset: 0, opacity: .78 }}><Media asset={asset} len={len}/><AbsoluteFill style={{ background: 'linear-gradient(transparent 20%, #0b0b10 90%)' }}/></div>}
    {!asset && <div style={{ position: 'absolute', inset: 0, opacity: .16, backgroundImage: 'radial-gradient(#fff 18%, transparent 22%)', backgroundSize: '17px 17px' }}/>}
    <div style={{ position: 'absolute', left: 22, right: 22, bottom: 18, display: 'flex', flexDirection: 'column', gap: Math.min(10, h * .035) }}>
      <Caption text={item.titulo} w={w - 44} size={Math.min(64, h * .19)} tone={accent} style={{ position: 'relative', width: '100%' }}/>
      <Caption text={item.texto} w={w - 44} size={Math.min(34, h * .12)} style={{ position: 'relative', width: '100%' }}/>
      <Caption text={item.fonte} w={w - 44} size={Math.min(20, h * .09)} tone="#c2c9dc" style={{ position: 'relative', width: '100%' }}/>
    </div>
  </div>;
};
export const Wire: React.FC<{ x1: number; y1: number; x2: number; y2: number; progress: number; tone?: string; dashed?: boolean }> = ({ x1, y1, x2, y2, progress, tone = C.yellow, dashed }) => <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}><path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={C.ink} strokeWidth={14}/><path d={`M ${x1} ${y1} L ${x2} ${y2}`} pathLength={1} stroke={tone} strokeWidth={5} fill="none" strokeDasharray={dashed ? '.025 .025' : 1} strokeDashoffset={dashed ? 0 : 1 - progress} opacity={progress}/><circle cx={x1 + (x2 - x1) * progress} cy={y1 + (y2 - y1) * progress} r={9} fill={tone} opacity={progress}/></svg>;
export const Seal: React.FC<{ text?: string; len: number; at?: number; y: number; w: number; tone?: string }> = ({ text, len, at = .76, y, w, tone = C.yellow }) => {
  const { f } = useBoard(); if (!text || f < hit(len, at)) return null;
  return <div style={{ position: 'absolute', top: y, left: 30, width: w - 60, textAlign: 'center', transform: `scale(${pop(f, hit(len, at))}) rotate(-2deg)`, background: C.ink, padding: '12px 16px', boxSizing: 'border-box', border: `4px solid ${tone}`, boxShadow: `8px 8px 0 ${C.red}` }}><Punch size={fit(text, w - 120, 76, 2)} color={tone}>{text}</Punch></div>;
};
