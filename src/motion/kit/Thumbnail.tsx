import React, { useContext } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, CalculateMetadataFunction } from 'remotion';
import { ANTON, C, Halftone, SpeedBurst, resolvePublic, useAnton } from './fx';
import { Figura, Mood, PersonagemCtx, Character, figW } from './Personagem';
import { Asset, Assets, Background } from './scenes';
import type { z } from 'zod';
import type { thumbnailVariantSchema } from '../../core/thumbnail';
type Recipe = z.infer<typeof thumbnailVariantSchema>;

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
  /** preto (padrão) ou branco: fundo liso e limpo, personagem em destaque (no layout `palavra`, branco é a versão clara); cena: a mídia ocupa a imagem toda. */
  fundo?: 'preto' | 'branco' | 'cena' | 'quadrinhos';
  /** centro: personagem grande no meio, a palavra na frente dele embaixo e o personagem do projeto no canto. */
  layout?: 'lado' | 'centro' | 'palavra';
  /** Pose exata do personagem do projeto (nome do catálogo); sem ela, a pose sai do humor. */
  pose?: string;
  /** Parte da mídia que fica no quadro (object-position), ex.: '50% 25%' para manter o rosto. */
  foco?: string;
  /** Aproxima a mídia em volta do foco (1 = sem zoom), para o rosto ocupar o quadro. */
  zoom?: number;
  /** Layout `palavra`: textura do fundo (meio-tom leve ou efeito de TV). */
  textura?: 'halftone' | 'tv' | 'nenhuma';
  /** Layout `palavra`: imagem do fundo, escurecida e borrada. */
  midiaFundo?: string;
  /** Layout `palavra`: altura do centro do texto (0 = topo, 1 = base; padrão 0,5). */
  alturaTexto?: number;
  /** Layout `palavra`: contorno da camada da frente — na cor da palavra, com brilho neon (padrão), ou branco. */
  contorno?: 'branco' | 'cor';
  backgroundEffects?: Recipe['backgroundEffects']; halftone?: Recipe['halftone']; border?: Recipe['border'];
  subject?: Recipe['subject']; textStyle?: Recipe['textStyle']; foregroundText?: Recipe['foregroundText'];
};

const TONS: Record<string, string> = { amarelo: C.yellow, vermelho: C.red, azul: C.blue, branco: C.white, verde: '#7CFF3A' };

/** Layout `palavra`: cor da palavra (brilho) e o tom do fundo escuro, quase preto, que contrasta com ela. */
const PALAVRA: Record<string, { word: string; glow: string; bg: [string, string] }> = {
  amarelo: { word: '#FFE94D', glow: '#FFC400', bg: ['#1C1530', '#050308'] },
  vermelho: { word: '#FF3B4E', glow: '#FF0A2A', bg: ['#1A0B10', '#040203'] },
  azul: { word: '#8FDCFF', glow: '#1E90FF', bg: ['#0B1626', '#020407'] },
  branco: { word: '#FFFFFF', glow: '#C9D4FF', bg: ['#16141F', '#030305'] },
  verde: { word: '#C8FF4D', glow: '#5DFF1A', bg: ['#111A0C', '#030502'] },
};
/** Layout `palavra` com `fundo: 'branco'`: fundo claro com leve tom da cor e palavra saturada, ainda brilhante. */
const PALAVRA_CLARA: Record<string, { word: string; glow: string; bg: [string, string] }> = {
  amarelo: { word: '#FFB800', glow: '#FFD84D', bg: ['#FFFFFF', '#FFF1C2'] },
  vermelho: { word: '#FF1F3D', glow: '#FF7A8A', bg: ['#FFFFFF', '#FFDCE1'] },
  azul: { word: '#1673FF', glow: '#6BB8FF', bg: ['#FFFFFF', '#D3E8FF'] },
  branco: { word: '#16141F', glow: '#9AA0B8', bg: ['#FFFFFF', '#E6E8F0'] },
  verde: { word: '#25C400', glow: '#8CFF4D', bg: ['#FFFFFF', '#DDF9D2'] },
};

/**
 * Palavra (ou frase curta, até 2 linhas) gigante brilhando atrás, o personagem "dentro" dela (na frente da
 * palavra cheia e atrás de uma segunda camada só com o contorno fino, alinhada), fundo escuro (quase preto ou
 * a imagem `midiaFundo` escurecida e borrada) com efeito de TV, e o personagem do projeto grande num canto
 * inferior, cortado na cintura. A mídia principal deve ser um recorte PNG inteiro, em alta resolução.
 */
const PalavraLayout: React.FC<{ p: ThumbProps & { width: number; height: number }; humor?: Mood }> = ({ p, humor }) => {
  const { width, height, midia, midiaFundo, texto, lado = 'direita', tom = 'amarelo', foco, zoom, pose, selo, alturaTexto, contorno = 'cor' } = p;
  const light = p.fundo === 'branco';
  // No fundo claro as linhas de TV sujam a imagem: o padrão vira o meio-tom suave.
  const textura = p.textura ?? (light ? 'halftone' : 'tv');
  const pal = (light ? PALAVRA_CLARA[tom] || PALAVRA_CLARA.amarelo : PALAVRA[tom] || PALAVRA.amarelo);
  const assets = useContext(Assets);
  const asset = midia ? assets[midia.startsWith('media:') ? midia.slice(6) : midia] : null;
  const cutout = Boolean(asset && /\.png($|\?)/i.test(asset.src));
  const lines = texto.replace(/\*/g, '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2);
  const longest = Math.max(1, ...lines.map(l => l.length));
  const stretch = 1.15;
  // Anton é condensada (~0,5 em por letra): a linha mais longa ocupa quase toda a largura, alongada na vertical.
  const scaleX = width / 1280; const scaleY = height / 720;
  const size = p.textStyle?.size ? p.textStyle.size * scaleY : Math.min(height * (lines.length > 1 ? 0.36 : 0.6), (width * 0.94) / (longest * 0.5));
  const lineH = size * 0.95 * stretch;
  // Vertical (Shorts): o personagem ocupa a parte de cima, a palavra cruza o peito dele e o Nox fica no canto de baixo.
  const portrait = height > width;
  const center = height * (alturaTexto ?? (portrait ? 0.4 : 0.5));
  const box = (i: number): React.CSSProperties => ({ position: 'absolute', left: 0, right: 0, top: center + (i - (lines.length - 1) / 2) * lineH, transform: `translateY(-50%) scaleY(${stretch})`, textAlign: 'center', fontFamily: ANTON, fontSize: size, lineHeight: 1, letterSpacing: p.textStyle?.letterSpacing !== undefined ? p.textStyle.letterSpacing * scaleX : size * 0.01, textTransform: 'uppercase', whiteSpace: 'nowrap' });
  const glow = `0 0 ${size * 0.03}px ${pal.glow}, 0 0 ${size * 0.1}px ${pal.glow}, 0 0 ${size * 0.25}px ${pal.glow}`;
  const stroke = Math.max(1.5, size * 0.0055);
  const left = lado === 'esquerda';
  const noxH = portrait ? height * 0.56 : height * 1.08;
  const noxY = portrait ? height - noxH * 0.74 : height * 0.42;
  const subjectBox: React.CSSProperties = p.subject ? {left:p.subject.x*scaleX,top:p.subject.y*scaleY,width:p.subject.width*scaleX,height:p.subject.height*scaleY} : portrait ? { top: 0, height: height * 0.78, left: 0, width } : { top: 0, bottom: 0, left: width * 0.15, width: width * 0.7 };
  const fade = 'radial-gradient(ellipse 48% 70% at 50% 45%, #000 50%, transparent 100%)';
  const h = p.halftone || (p.fundo === 'quadrinhos' ? {spacing:9,radius:.3,opacity:.595,color:'#000000',full:true} : undefined);
  const e = p.backgroundEffects || (p.fundo === 'quadrinhos' ? {blur:3,brightness:.7,saturation:.65,vignette:.75} : undefined);
  const customDots = h ? `radial-gradient(circle, ${h.color || '#000000'} ${100*(h.radius ?? .3)}%, transparent ${100*(h.radius ?? .3)+3}%)` : undefined;
  const dots = customDots || (light ? `radial-gradient(circle, ${pal.glow}55 28%, transparent 31%)` : 'radial-gradient(circle, rgba(255,255,255,.14) 28%, transparent 31%)');
  // Fundo claro: halo do recorte mais suave, palavra com sombra de profundidade e vinheta leve.
  const halo = light ? `drop-shadow(0 ${height * 0.012}px ${height * 0.035}px rgba(10,12,30,.55))` : `drop-shadow(0 0 ${height * 0.04}px rgba(0,0,0,.85))`;
  const wordShadow = light ? `${glow}, 0 ${size * 0.03}px ${size * 0.05}px rgba(10,12,30,.25)` : glow;
  const vignette = light ? `inset 0 0 ${height * 0.22}px ${pal.bg[1]}` : `inset 0 0 ${height * 0.25}px rgba(0,0,0,${e?.vignette ?? .75})`;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 70% at 50% 48%, ${pal.bg[0]} 0%, ${pal.bg[1]} 100%)`, overflow: 'hidden' }}>
      {(midiaFundo || p.fundo === 'quadrinhos') && <AbsoluteFill style={{ transform: 'scale(1.12)', filter: e ? `blur(${(e.blur ?? 3)*scaleY}px) brightness(${e.brightness ?? .7}) saturate(${e.saturation ?? .65})` : light ? `blur(${height*.018}px) brightness(1.15) saturate(.6)` : `blur(${height*.018}px) brightness(.32) saturate(.8)`, opacity:light ? .28 : 1 }}>{midiaFundo ? <Subject id={midiaFundo} fit="cover"/> : <Background kind="quadrinhos"/>}</AbsoluteFill>}
      {textura === 'halftone' ? (
        <AbsoluteFill style={{ backgroundImage: dots, backgroundSize: `${h?.spacing ? h.spacing*scaleY : height*.022}px ${h?.spacing ? h.spacing*scaleY : height*.022}px`, opacity:h?.opacity ?? 1, maskImage: h?.full ? undefined : 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 25%, #000 100%)', WebkitMaskImage:h?.full ? undefined : 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 25%, #000 100%)' } as React.CSSProperties} />
      ) : textura === 'tv' ? (
        <>
          <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.38) 0px, rgba(0,0,0,.38) 2px, transparent 2px, transparent 5px)' }} />
          <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,0,60,.05) 0px, rgba(0,255,120,.05) 2px, rgba(40,90,255,.05) 4px, transparent 6px)' }} />
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, transparent 38%, rgba(255,255,255,.05) 40%, transparent 46%)' }} />
        </>
      ) : null}
      {/* camada de trás: a palavra cheia, brilhando */}
      {lines.map((line, i) => <div key={`b${i}`} style={{ ...box(i), color: pal.word, textShadow: wordShadow }}>{line}</div>)}
      {/* o personagem, dentro da palavra */}
      <div style={{ position: 'absolute', ...subjectBox, ...(cutout ? { filter: halo } : { maskImage: fade, WebkitMaskImage: fade }) } as React.CSSProperties}>
        <Subject id={midia} fit={cutout ? 'contain' : 'cover'} foco={foco || (cutout ? '50% 0%' : '50% 25%')} zoom={zoom ?? (cutout ? (portrait ? 1.1 : 1.6) : 1)} />
      </div>
      {/* camada da frente: só o contorno fino, alinhado com a palavra de trás */}
      {lines.map((line, i) => <div key={`f${i}`} style={{ ...box(i), color: 'transparent', ...(contorno === 'cor' ? { WebkitTextStroke: `${Math.max(1, size * 0.0038)}px ${pal.word}`, filter: `drop-shadow(0 0 ${size * 0.006}px ${pal.glow})` } : { WebkitTextStroke: `${stroke}px ${C.white}` }) }}>{line}</div>)}
      <AbsoluteFill style={{ boxShadow: vignette }} />
      {p.foregroundText && <ForegroundWord value={p.foregroundText} width={width} height={height}/>}
      <ThumbnailBorder value={p.border} width={width} height={height}/>
      {humor && <Figura pose={pose} humor={humor} seed="thumb" style={{zIndex:2}} height={noxH} x={left ? -width * 0.07 : width - figW(noxH) + width * 0.07} y={noxY} flip={!left} />}
      {selo && <div style={{ position: 'absolute', top: height * 0.05, [left ? 'right' : 'left']: width * 0.04, background: pal.word, color: C.ink, fontFamily: ANTON, fontSize: height * 0.06, padding: '2px 16px', textTransform: 'uppercase' } as React.CSSProperties}>{selo}</div>}
    </AbsoluteFill>
  );
};

export const ThumbnailBorder: React.FC<{value?:Recipe['border'];width:number;height:number}> = ({value,width,height}) => {
  if (!value?.width) return null;
  const scale = height / 720; const w=value.width*scale; const r=Math.min((value.radius ?? 0)*scale,(width-2*w)/2,(height-2*w)/2);
  const d=`M0 0H${width}V${height}H0Z M${w+r} ${w}H${width-w-r}Q${width-w} ${w} ${width-w} ${w+r}V${height-w-r}Q${width-w} ${height-w} ${width-w-r} ${height-w}H${w+r}Q${w} ${height-w} ${w} ${height-w-r}V${w+r}Q${w} ${w} ${w+r} ${w}Z`;
  const mask=`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path fill="white" fill-rule="evenodd" d="${d}"/></svg>`)}")`;
  const colors=value.colors.map((c,i)=>`${c}${value.stops ? ` ${value.stops[i]}%` : ''}`).join(',');
  return <AbsoluteFill data-testid="thumbnail-border" style={{pointerEvents:'none',background:value.colors.length===1?value.colors[0]:`linear-gradient(${value.angle ?? 115}deg,${colors})`,maskImage:mask,WebkitMaskImage:mask}}/>;
};
const ForegroundWord:React.FC<{value:NonNullable<Recipe['foregroundText']>;width:number;height:number}>=({value:v,width,height})=>{
  const sx=width/1280,sy=height/720,pal=PALAVRA[v.tone || 'verde'];
  return <div style={{position:'absolute',left:v.x*sx,top:v.y*sy,width:v.width*sx,fontFamily:ANTON,fontWeight:400,fontSize:v.size*sy,lineHeight:1,letterSpacing:(v.letterSpacing ?? v.size*.01)*sx,transform:`scaleY(${v.stretch ?? 1.15})`,transformOrigin:'center top',color:pal.word,textTransform:'uppercase',textShadow:`0 0 ${5*sy}px ${pal.word},0 0 ${16*sy}px ${pal.glow},0 ${5*sy}px ${12*sy}px #000`,filter:`drop-shadow(0 0 ${5*sy}px #070B04)`}}>{v.text}</div>;
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
