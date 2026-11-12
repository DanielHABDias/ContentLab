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
  /** preto (padrão) ou branco: fundo liso e limpo, personagem em destaque; cena: a mídia ocupa a imagem toda. */
  fundo?: 'preto' | 'branco' | 'cena';
};

const TONS = { amarelo: C.yellow, vermelho: C.red, azul: C.blue };

const Subject: React.FC<{ id?: string; style?: React.CSSProperties; fit?: 'cover' | 'contain' }> = ({ id, style, fit = 'cover' }) => {
  const assets = useContext(Assets);
  const asset = id ? assets[id.startsWith('media:') ? id.slice(6) : id] : null;
  const css: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit, filter: 'contrast(1.12) saturate(1.2)', ...style };
  if (!asset) return <SpeedBurst bg={C.ink} color="#1d1d28" />;
  return asset.kind === 'video' ? <OffthreadVideo src={asset.src} muted style={css} /> : <Img src={asset.src} style={css} />;
};

/** Texto com contorno grosso, sombra sólida e deslocamento vermelho/azul; *palavra* fica amarela. */
const BigText: React.FC<{ text: string; size: number; clean?: 'preto' | 'branco' }> = ({ text, size, clean }) => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  return (
    <div style={{ fontFamily: ANTON, fontSize: size, lineHeight: 0.92, textTransform: 'uppercase', transform: clean ? undefined : 'rotate(-3deg)', letterSpacing: size * 0.01 }}>
      {lines.map((line, i) => (
        <div key={i}>
          {line.split(/(\*[^*]+\*)/).filter(Boolean).map((part, k) => {
            const hot = part.startsWith('*');
            if (clean) return <span key={k} style={{ color: hot ? (clean === 'branco' ? C.red : C.yellow) : clean === 'branco' ? C.ink : C.white }}>{hot ? part.slice(1, -1) : part}</span>;
            return <span key={k} style={{ color: hot ? C.yellow : C.white, WebkitTextStroke: `${size * 0.07}px ${C.ink}`, paintOrder: 'stroke fill', textShadow: `${size * 0.045}px 0 0 rgba(230,57,70,.9), ${-size * 0.045}px 0 0 rgba(38,118,232,.9), 0 ${size * 0.09}px 0 ${C.ink}` }}>{hot ? part.slice(1, -1) : part}</span>;
          })}
        </div>
      ))}
    </div>
  );
};

export const Thumbnail: React.FC<ThumbProps> = (raw) => {
  useAnton();
  const { assets, midia, midiaB, texto, humor, lado = 'esquerda', tom = 'amarelo', selo, width = 1280, height = 720, fundo = 'preto' } = resolvePublic(raw) as ThumbProps;
  const accent = TONS[tom] || C.yellow;
  const words = texto.replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
  const size = Math.round(height * (words <= 2 ? 0.25 : words <= 3 ? 0.21 : 0.18) * (humor && !midiaB ? 0.88 : 1));
  const left = lado === 'esquerda';
  const versus = Boolean(midiaB);
  if (fundo !== 'cena') {
    // Limpa: fundo liso, o personagem grande do lado oposto ao texto, bordas da imagem fundindo no fundo
    // (com PNG transparente, o recorte aparece direto). Texto sem contorno, só a palavra-chave em cor.
    const bg = fundo === 'branco' ? '#ffffff' : C.ink;
    const fade = `radial-gradient(ellipse 70% 75% at 50% 50%, #000 55%, transparent 100%)`;
    const half = (id?: string, side: 'esquerda' | 'direita' = left ? 'direita' : 'esquerda', w = versus ? 0.5 : 0.62) => (
      <div style={{ position: 'absolute', top: 0, bottom: 0, [side === 'direita' ? 'right' : 'left']: 0, width: width * w, maskImage: fade, WebkitMaskImage: fade } as React.CSSProperties}><Subject id={id} fit="cover" /></div>
    );
    return (
      <Assets.Provider value={assets}>
        <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
          {versus ? <>{half(midia, 'esquerda')}{half(midiaB, 'direita')}</> : half(midia)}
          {humor && <Nox mood={humor} height={height * 0.5} x={left ? width * 0.03 : width - height * 0.5 * 0.62 - width * 0.03} y={height * 0.52} flip={!left} blinkEvery={100000} />}
          <div style={{ position: 'absolute', ...(versus ? { left: 0, right: 0, bottom: height * 0.07, textAlign: 'center' } : { top: humor ? height * 0.08 : height * 0.2, [left ? 'left' : 'right']: width * 0.05, maxWidth: width * 0.48, textAlign: left ? 'left' : 'right' }) } as React.CSSProperties}>
            <BigText text={texto} size={size} clean={fundo} />
          </div>
          {versus && <div style={{ position: 'absolute', left: '50%', top: height * 0.38, transform: 'translate(-50%, -50%)', fontFamily: ANTON, fontSize: height * 0.16, color: fundo === 'branco' ? C.ink : C.white }}>VS</div>}
          {selo && <div style={{ position: 'absolute', top: height * 0.06, [left ? 'left' : 'right']: width * 0.05, background: accent, color: C.ink, fontFamily: ANTON, fontSize: height * 0.06, padding: '2px 16px', textTransform: 'uppercase' } as React.CSSProperties}>{selo}</div>}
        </AbsoluteFill>
      </Assets.Provider>
    );
  }
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
