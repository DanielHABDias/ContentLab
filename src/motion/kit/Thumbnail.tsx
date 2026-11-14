import React, { useContext } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, CalculateMetadataFunction } from 'remotion';
import { ANTON, C, Halftone, SpeedBurst, resolvePublic, useAnton } from './fx';
import { Figura, Mood, PersonagemCtx, Character, figW } from './Personagem';
import { Asset, Assets } from './scenes';

/**
 * Thumbnail do vídeo (contrato `contentlab-thumb-v1`), renderizada como still 1280×720.
 * Um assunto dominante (a mídia da obra), até 4 palavras em Anton com contorno e
 * aberração cromática, a palavra entre *asteriscos* em amarelo, o personagem do projeto
 * (opcional) na pose do humor do vídeo e um selo curto opcional.
 */
export type ThumbProps = {
  width?: number; height?: number;
  assets: Record<string, Asset>;
  midia?: string;
  midiaB?: string;
  texto: string;
  humor?: Mood;
  /** Poses do personagem do projeto (sem ele, `humor` não mostra nada). */
  personagem?: Character;
  lado?: 'esquerda' | 'direita';
  tom?: 'amarelo' | 'vermelho' | 'azul' | 'branco' | 'verde';
  selo?: string;
  /** preto (padrão) ou branco: fundo liso e limpo, personagem em destaque; cena: a mídia ocupa a imagem toda. */
  fundo?: 'preto' | 'branco' | 'cena';
  /** centro: personagem grande no meio, a palavra na frente dele embaixo e o personagem do projeto no canto. */
  layout?: 'lado' | 'centro' | 'palavra';
  /** Pose exata do personagem do projeto (nome do catálogo); sem ela, a pose sai do humor. */
  pose?: string;
  /** Parte da mídia que fica no quadro (object-position), ex.: '50% 25%' para manter o rosto. */
  foco?: string;
  /** Aproxima a mídia em volta do foco (1 = sem zoom), para o rosto ocupar o quadro. */
  zoom?: number;
  /** Layout `palavra`: textura do fundo (meio-tom leve ou efeito de TV). */
  textura?: 'halftone' | 'tv';
};

const TONS: Record<string, string> = { amarelo: C.yellow, vermelho: C.red, azul: C.blue, branco: C.white, verde: '#7CFF3A' };

/** Layout `palavra`: cor da palavra (brilho) e um fundo liso que contrasta com ela. */
const PALAVRA: Record<string, { word: string; glow: string; bg: [string, string] }> = {
  amarelo: { word: '#FFE94D', glow: '#FFC400', bg: ['#4B1D9E', '#1A0838'] },
  vermelho: { word: '#FF4655', glow: '#FF1030', bg: ['#0E3D6B', '#04121F'] },
  azul: { word: '#7FD4FF', glow: '#1E90FF', bg: ['#A3102A', '#3A0410'] },
  branco: { word: '#FFFFFF', glow: '#FFD0D6', bg: ['#E01B2F', '#5A0410'] },
  verde: { word: '#C8FF4D', glow: '#5DFF1A', bg: ['#7A1491', '#26052E'] },
};

/**
 * Palavra gigante brilhando atrás, o personagem "dentro" dela (na frente da palavra cheia e atrás de uma
 * segunda camada só com o contorno fino, alinhada), fundo liso com meio-tom leve ou efeito de TV e o
 * personagem do projeto grande num canto inferior, cortado na cintura.
 */
const PalavraLayout: React.FC<{ p: ThumbProps & { width: number; height: number }; humor?: Mood }> = ({ p, humor }) => {
  const { width, height, midia, texto, lado = 'direita', tom = 'amarelo', textura = 'halftone', foco, zoom, pose, selo } = p;
  const pal = PALAVRA[tom] || PALAVRA.amarelo;
  const assets = useContext(Assets);
  const asset = midia ? assets[midia.startsWith('media:') ? midia.slice(6) : midia] : null;
  const cutout = Boolean(asset && /\.png($|\?)/i.test(asset.src));
  const lines = texto.replace(/\*/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  const main = lines.at(-1) || '';
  const top = lines.slice(0, -1).join(' ');
  // Anton é condensada (~0,5 em por letra): a palavra ocupa quase toda a largura, alongada na vertical.
  const size = Math.min(height * 0.6, (width * 0.94) / Math.max(1, main.length * 0.5));
  const stretch = 1.18;
  const wordBox: React.CSSProperties = { position: 'absolute', left: 0, right: 0, top: height * (top ? 0.56 : 0.5), transform: `translateY(-50%) scaleY(${stretch})`, textAlign: 'center', fontFamily: ANTON, fontSize: size, lineHeight: 1, letterSpacing: size * 0.01, textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const topBox: React.CSSProperties = { ...wordBox, top: height * 0.56 - (size * stretch) / 2 - size * 0.26, fontSize: size * 0.3, transform: 'translateY(-50%)' };
  const glow = `0 0 ${size * 0.04}px ${pal.glow}, 0 0 ${size * 0.12}px ${pal.glow}, 0 0 ${size * 0.3}px ${pal.glow}`;
  const stroke = Math.max(3, size * 0.012);
  const left = lado === 'esquerda';
  const noxH = height * 1.08;
  const fade = 'radial-gradient(ellipse 48% 70% at 50% 45%, #000 50%, transparent 100%)';
  const dots = 'radial-gradient(circle, rgba(255,255,255,.22) 28%, transparent 31%)';
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 70% at 50% 48%, ${pal.bg[0]} 0%, ${pal.bg[1]} 100%)`, overflow: 'hidden' }}>
      {textura === 'halftone' ? (
        <AbsoluteFill style={{ backgroundImage: dots, backgroundSize: `${height * 0.022}px ${height * 0.022}px`, maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 25%, #000 100%)', WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 25%, #000 100%)' } as React.CSSProperties} />
      ) : (
        <>
          <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.32) 0px, rgba(0,0,0,.32) 2px, transparent 2px, transparent 5px)' }} />
          <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,0,60,.07) 0px, rgba(0,255,120,.07) 2px, rgba(40,90,255,.07) 4px, transparent 6px)' }} />
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, transparent 38%, rgba(255,255,255,.07) 40%, transparent 46%)' }} />
        </>
      )}
      {/* camada de trás: a palavra cheia, brilhando */}
      {top && <div style={{ ...topBox, color: pal.word, textShadow: glow }}>{top}</div>}
      <div style={{ ...wordBox, color: pal.word, textShadow: glow }}>{main}</div>
      {/* o personagem, dentro da palavra */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: width * 0.15, width: width * 0.7, ...(cutout ? { filter: `drop-shadow(0 0 ${height * 0.03}px rgba(0,0,0,.7))` } : { maskImage: fade, WebkitMaskImage: fade }) } as React.CSSProperties}>
        <Subject id={midia} fit={cutout ? 'contain' : 'cover'} foco={foco || (cutout ? '50% 0%' : '50% 25%')} zoom={zoom ?? (cutout ? 1.6 : 1)} />
      </div>
      {/* camada da frente: só o contorno fino, alinhado com a palavra de trás */}
      {top && <div style={{ ...topBox, color: 'transparent', WebkitTextStroke: `${stroke * 0.7}px ${C.white}` }}>{top}</div>}
      <div style={{ ...wordBox, color: 'transparent', WebkitTextStroke: `${stroke}px ${C.white}` }}>{main}</div>
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${height * 0.22}px rgba(0,0,0,.6)` }} />
      {humor && <Figura pose={pose} humor={humor} seed="thumb" height={noxH} x={left ? -width * 0.07 : width - figW(noxH) + width * 0.07} y={height * 0.42} flip={!left} />}
      {selo && <div style={{ position: 'absolute', top: height * 0.05, [left ? 'right' : 'left']: width * 0.04, background: pal.word, color: C.ink, fontFamily: ANTON, fontSize: height * 0.06, padding: '2px 16px', textTransform: 'uppercase' } as React.CSSProperties}>{selo}</div>}
    </AbsoluteFill>
  );
};

const Subject: React.FC<{ id?: string; style?: React.CSSProperties; fit?: 'cover' | 'contain'; foco?: string; zoom?: number }> = ({ id, style, fit = 'cover', foco, zoom = 1 }) => {
  const assets = useContext(Assets);
  const asset = id ? assets[id.startsWith('media:') ? id.slice(6) : id] : null;
  const css: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit, objectPosition: foco, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: foco, filter: 'contrast(1.12) saturate(1.2)', ...style };
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
  const { assets, personagem = { poses: {} }, midia, midiaB, texto, humor: wanted, lado = 'esquerda', tom = 'amarelo', selo, width = 1280, height = 720, fundo = 'preto', layout = 'lado', foco, pose, zoom } = resolvePublic(raw) as ThumbProps;
  const humor = (wanted || pose) && Object.keys(personagem.poses || {}).length ? (wanted || 'feliz') : undefined;
  const accent = TONS[tom] || C.yellow;
  const words = texto.replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
  const size = Math.round(height * (words <= 2 ? 0.25 : words <= 3 ? 0.21 : 0.18) * (humor && !midiaB ? 0.88 : 1));
  const left = lado === 'esquerda';
  const versus = Boolean(midiaB);
  if (layout === 'palavra') {
    return (
      <Assets.Provider value={assets}><PersonagemCtx.Provider value={personagem}>
        <PalavraLayout p={{ ...(resolvePublic(raw) as ThumbProps), width, height }} humor={humor} />
      </PersonagemCtx.Provider></Assets.Provider>
    );
  }
  if (layout === 'centro' && !versus) {
    // Limpa e centrada: fundo liso, o rosto do personagem grande no meio fundindo no fundo, a palavra enorme na
    // frente dele (embaixo) e o personagem do projeto no canto (lado escolhido), com a expressão do vídeo.
    const bg = fundo === 'branco' ? '#ffffff' : C.ink;
    const fade = 'radial-gradient(ellipse 50% 72% at 50% 42%, #000 45%, transparent 100%)';
    const cornerH = height * 0.46;
    const lines = texto.split('\n').filter(Boolean).length;
    const big = Math.round(height * (lines > 1 ? 0.2 : words <= 1 ? 0.3 : 0.24));
    const ink = fundo === 'branco' ? C.white : C.ink;
    return (
      <Assets.Provider value={assets}><PersonagemCtx.Provider value={personagem}>
        <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, height: height * 0.98, left: width * 0.14, width: width * 0.72, maskImage: fade, WebkitMaskImage: fade } as React.CSSProperties}><Subject id={midia} fit="cover" foco={foco || '50% 25%'} zoom={zoom} /></div>
          <AbsoluteFill style={{ background: `linear-gradient(to top, ${bg} 0%, ${bg}cc 14%, transparent 42%)` }} />
          <div style={{ position: 'absolute', left: width * 0.04, right: width * 0.04, bottom: height * 0.05, textAlign: 'center', filter: `drop-shadow(0 ${height * 0.012}px 0 ${ink}) drop-shadow(0 0 ${height * 0.03}px ${ink})` }}>
            <div style={{ fontFamily: ANTON, fontSize: big, lineHeight: 0.9, textTransform: 'uppercase', letterSpacing: big * 0.01 }}>
              {texto.split('\n').map(line => line.trim()).filter(Boolean).map((line, i) => <div key={i}>{line.split(/(\*[^*]+\*)/).filter(Boolean).map((part, k) => { const hot = part.startsWith('*'); return <span key={k} style={{ color: hot ? accent : fundo === 'branco' ? C.ink : C.white, WebkitTextStroke: `${big * 0.035}px ${ink}`, paintOrder: 'stroke fill' }}>{hot ? part.slice(1, -1) : part}</span>; })}</div>)}
            </div>
          </div>
          {humor && <Figura pose={pose} humor={humor} seed="thumb" height={cornerH} x={left ? width * 0.015 : width - figW(cornerH) - width * 0.015} y={height - cornerH * 0.98} flip={!left} />}
          {selo && <div style={{ position: 'absolute', top: height * 0.06, [left ? 'right' : 'left']: width * 0.04, background: accent, color: C.ink, fontFamily: ANTON, fontSize: height * 0.06, padding: '2px 16px', textTransform: 'uppercase' } as React.CSSProperties}>{selo}</div>}
        </AbsoluteFill>
      </PersonagemCtx.Provider></Assets.Provider>
    );
  }
  if (fundo !== 'cena') {
    // Limpa: fundo liso, o personagem grande do lado oposto ao texto, bordas da imagem fundindo no fundo
    // (com PNG transparente, o recorte aparece direto). Texto sem contorno, só a palavra-chave em cor.
    const bg = fundo === 'branco' ? '#ffffff' : C.ink;
    const fade = `radial-gradient(ellipse 70% 75% at 50% 50%, #000 55%, transparent 100%)`;
    const half = (id?: string, side: 'esquerda' | 'direita' = left ? 'direita' : 'esquerda', w = versus ? 0.5 : 0.62) => (
      <div style={{ position: 'absolute', top: 0, bottom: 0, [side === 'direita' ? 'right' : 'left']: 0, width: width * w, maskImage: fade, WebkitMaskImage: fade } as React.CSSProperties}><Subject id={id} fit="cover" /></div>
    );
    return (
      <Assets.Provider value={assets}><PersonagemCtx.Provider value={personagem}>
        <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
          {versus ? <>{half(midia, 'esquerda')}{half(midiaB, 'direita')}</> : half(midia)}
          {humor && <Figura humor={humor} seed="thumb" height={height * 0.5} x={left ? width * 0.03 : width - figW(height * 0.5) - width * 0.03} y={height * 0.5} flip={!left} />}
          <div style={{ position: 'absolute', ...(versus ? { left: 0, right: 0, bottom: height * 0.07, textAlign: 'center' } : { top: humor ? height * 0.08 : height * 0.2, [left ? 'left' : 'right']: width * 0.05, maxWidth: width * 0.48, textAlign: left ? 'left' : 'right' }) } as React.CSSProperties}>
            <BigText text={texto} size={size} clean={fundo} />
          </div>
          {versus && <div style={{ position: 'absolute', left: '50%', top: height * 0.38, transform: 'translate(-50%, -50%)', fontFamily: ANTON, fontSize: height * 0.16, color: fundo === 'branco' ? C.ink : C.white }}>VS</div>}
          {selo && <div style={{ position: 'absolute', top: height * 0.06, [left ? 'left' : 'right']: width * 0.05, background: accent, color: C.ink, fontFamily: ANTON, fontSize: height * 0.06, padding: '2px 16px', textTransform: 'uppercase' } as React.CSSProperties}>{selo}</div>}
        </AbsoluteFill>
      </PersonagemCtx.Provider></Assets.Provider>
    );
  }
  return (
    <Assets.Provider value={assets}><PersonagemCtx.Provider value={personagem}>
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
        {humor && <Figura humor={humor} seed="thumb" height={height * 0.6} x={left ? width * 0.015 : width - figW(height * 0.6) - width * 0.015} y={height * 0.4} flip={!left} tilt={left ? -5 : 5} />}
        <div style={{ position: 'absolute', top: versus ? height * 0.6 : humor ? height * 0.05 : height * 0.12, [left ? 'left' : 'right']: width * 0.045, ...(versus ? { left: 0, right: 0, display: 'flex', justifyContent: 'center' } : {}), maxWidth: versus ? width : width * 0.55, textAlign: versus ? 'center' : left ? 'left' : 'right' } as React.CSSProperties}>
          <BigText text={texto} size={size} />
        </div>
        {versus && <div style={{ position: 'absolute', left: '50%', top: height * 0.3, transform: 'translate(-50%, -50%) rotate(-6deg)', fontFamily: ANTON, fontSize: height * 0.2, color: C.ink, background: accent, padding: '0 28px', border: `8px solid ${C.ink}`, boxShadow: `10px 10px 0 ${C.ink}` }}>VS</div>}
        {selo && <div style={{ position: 'absolute', top: height * 0.05, [left ? 'right' : 'left']: width * 0.04, background: C.red, color: C.white, fontFamily: ANTON, fontSize: height * 0.07, padding: '4px 20px', border: `6px solid ${C.ink}`, transform: 'rotate(3deg)', boxShadow: `8px 8px 0 ${C.ink}`, textTransform: 'uppercase' } as React.CSSProperties}>{selo}</div>}
      </AbsoluteFill>
    </PersonagemCtx.Provider></Assets.Provider>
  );
};

export const calculateThumb: CalculateMetadataFunction<ThumbProps> = ({ props }) => ({ width: props.width || 1280, height: props.height || 720, durationInFrames: 1, fps: 30 });
