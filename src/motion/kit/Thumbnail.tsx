import React, { useContext } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, CalculateMetadataFunction } from 'remotion';
import { ANTON, C, Halftone, SpeedBurst, resolvePublic, useAnton } from './fx';
import { Nox, Mood } from './Nox';
import { Asset, Assets } from './scenes';

/**
 * Thumbnail do vídeo (contrato `diazverso-thumb-v1`), renderizada como still 1280×720.
 * Um assunto dominante (a mídia da obra), até 4 palavras em Anton com contorno e
 * aberração cromática, a palavra entre *asteriscos* em amarelo, Nox opcional com a
 * expressão que conta a emoção do vídeo e um selo curto opcional.
 */
export type ThumbProps = {
  width?: number; height?: number;
  assets: Record<string, Asset>;
  midia?: string;
  midiaB?: string;
  texto: string;
  humor?: Mood;
  lado?: 'esquerda' | 'direita';
  tom?: 'amarelo' | 'vermelho' | 'azul';
  selo?: string;
};

const TONS = { amarelo: C.yellow, vermelho: C.red, azul: C.blue };

const Subject: React.FC<{ id?: string; style?: React.CSSProperties }> = ({ id, style }) => {
  const assets = useContext(Assets);
  const asset = id ? assets[id.startsWith('media:') ? id.slice(6) : id] : null;
  const css: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.15) saturate(1.25)', ...style };
  if (!asset) return <SpeedBurst bg={C.ink} color="#1d1d28" />;
  return asset.kind === 'video' ? <OffthreadVideo src={asset.src} muted style={css} /> : <Img src={asset.src} style={css} />;
};

/** Texto com contorno grosso, sombra sólida e deslocamento vermelho/azul; *palavra* fica amarela. */
const BigText: React.FC<{ text: string; size: number }> = ({ text, size }) => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  return (
    <div style={{ fontFamily: ANTON, fontSize: size, lineHeight: 0.92, textTransform: 'uppercase', transform: 'rotate(-3deg)', letterSpacing: size * 0.01 }}>
      {lines.map((line, i) => (
        <div key={i}>
          {line.split(/(\*[^*]+\*)/).filter(Boolean).map((part, k) => {
            const hot = part.startsWith('*');
            return <span key={k} style={{ color: hot ? C.yellow : C.white, WebkitTextStroke: `${size * 0.07}px ${C.ink}`, paintOrder: 'stroke fill', textShadow: `${size * 0.045}px 0 0 rgba(230,57,70,.9), ${-size * 0.045}px 0 0 rgba(38,118,232,.9), 0 ${size * 0.09}px 0 ${C.ink}` }}>{hot ? part.slice(1, -1) : part}</span>;
          })}
        </div>
      ))}
    </div>
  );
};

export const Thumbnail: React.FC<ThumbProps> = (raw) => {
  useAnton();
  const { assets, midia, midiaB, texto, humor, lado = 'esquerda', tom = 'amarelo', selo, width = 1280, height = 720 } = resolvePublic(raw) as ThumbProps;
  const accent = TONS[tom] || C.yellow;
  const words = texto.replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
  const size = Math.round(height * (words <= 2 ? 0.25 : words <= 3 ? 0.21 : 0.18) * (humor && !midiaB ? 0.88 : 1));
  const left = lado === 'esquerda';
  const versus = Boolean(midiaB);
  return (
    <Assets.Provider value={assets}>
      <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
        {versus ? (
          <>
            <AbsoluteFill style={{ clipPath: 'polygon(0 0, 56% 0, 44% 100%, 0 100%)' }}><Subject id={midia} /></AbsoluteFill>
            <AbsoluteFill style={{ clipPath: 'polygon(56% 0, 100% 0, 100% 100%, 44% 100%)' }}><Subject id={midiaB} /></AbsoluteFill>
            <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent 49.2%, ${accent} 49.2%, ${accent} 50.8%, transparent 50.8%)` }} />
          </>
        ) : (
          <AbsoluteFill style={{ transform: `scale(1.06) translateX(${left ? 6 : -6}%)` }}><Subject id={midia} /></AbsoluteFill>
        )}
        {/* lado do texto escurece e ganha meio-tom para o texto saltar */}
        {!versus && <AbsoluteFill style={{ background: `linear-gradient(${left ? 90 : 270}deg, rgba(11,11,16,.92) 0%, rgba(11,11,16,.7) 38%, transparent 62%)` }} />}
        {!versus && <AbsoluteFill style={{ opacity: 0.35, maskImage: `linear-gradient(${left ? 90 : 270}deg, #000 0%, transparent 45%)`, WebkitMaskImage: `linear-gradient(${left ? 90 : 270}deg, #000 0%, transparent 45%)` }}><Halftone bg="transparent" dot={accent} size={18} drift={false} /></AbsoluteFill>}
        <AbsoluteFill style={{ boxShadow: 'inset 0 0 160px rgba(0,0,0,.65)' }} />
        {humor && <Nox mood={humor} height={height * 0.6} x={left ? width * 0.015 : width - height * 0.6 * 0.62 - width * 0.015} y={height * 0.44} flip={!left} blinkEvery={100000} tilt={left ? -5 : 5} />}
        <div style={{ position: 'absolute', top: versus ? height * 0.6 : humor ? height * 0.05 : height * 0.12, [left ? 'left' : 'right']: width * 0.045, ...(versus ? { left: 0, right: 0, display: 'flex', justifyContent: 'center' } : {}), maxWidth: versus ? width : width * 0.55, textAlign: versus ? 'center' : left ? 'left' : 'right' } as React.CSSProperties}>
          <BigText text={texto} size={size} />
        </div>
        {versus && <div style={{ position: 'absolute', left: '50%', top: height * 0.3, transform: 'translate(-50%, -50%) rotate(-6deg)', fontFamily: ANTON, fontSize: height * 0.2, color: C.ink, background: accent, padding: '0 28px', border: `8px solid ${C.ink}`, boxShadow: `10px 10px 0 ${C.ink}` }}>VS</div>}
        {selo && <div style={{ position: 'absolute', top: height * 0.05, [left ? 'right' : 'left']: width * 0.04, background: C.red, color: C.white, fontFamily: ANTON, fontSize: height * 0.07, padding: '4px 20px', border: `6px solid ${C.ink}`, transform: 'rotate(3deg)', boxShadow: `8px 8px 0 ${C.ink}`, textTransform: 'uppercase' } as React.CSSProperties}>{selo}</div>}
      </AbsoluteFill>
    </Assets.Provider>
  );
};

export const calculateThumb: CalculateMetadataFunction<ThumbProps> = ({ props }) => ({ width: props.width || 1280, height: props.height || 720, durationInFrames: 1, fps: 30 });
