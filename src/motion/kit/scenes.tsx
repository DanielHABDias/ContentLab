import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, interpolate, random, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { ANTON, C, Halftone, Panel, Punch, ROUND, SpeedBurst, Stars, ease, pop, shake, slide } from './fx';
import { Mood, Nox, NoxPose } from './Nox';
import { IconArt } from './icons';

/**
 * Cenas do kit de motion Diazverso. Cada cena recebe `len` (frames do beat) e ajusta os próprios tempos.
 * Mídias entram por referência `media:<id>` (imagem ou vídeo da obra, resolvida pelo editor).
 * Todas as cenas são diagramadas para 16:9 (1920×1080) e para 9:16 (1080×1920, Shorts): no vertical,
 * o conteúdo fica entre 12% e 72% da altura, fora da faixa da interface do Shorts e da legenda.
 */
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export type Asset = { src: string; kind: 'image' | 'video' };
export const Assets = createContext<Record<string, Asset>>({});
const useAsset = (ref?: string): Asset | null => { const assets = useContext(Assets); if (!ref) return null; const id = ref.startsWith('media:') ? ref.slice(6) : ref; return assets[id] || null; };
type Base = { len: number };
type Bg = 'estrelas' | 'explosao' | 'meio-tom' | 'branco' | 'papel' | 'escuro';
const COLORS: Record<string, string> = { branco: C.white, amarelo: C.yellow, vermelho: C.red, azul: C.blue, tinta: C.ink };
const color = (name?: string, fallback = C.white) => (name && (COLORS[name] || (/^#[0-9a-f]{6}$/i.test(name) ? name : null))) || fallback;

/** Palco: tamanho do vídeo e orientação. */
export const useStage = () => { const { width: W, height: H } = useVideoConfig(); return { W, H, V: H > W }; };
/** Largura do Nox na tela para uma altura (recorte da figura 412×669). */
const noxW = (h: number) => (h * 412) / 669;
/** Tamanho de fonte que faz a palavra mais longa caber na largura (o texto quebra linha nas demais). */
const fit = (text: string, width: number, max: number, lines = 3) => {
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
export const Media: React.FC<{ asset: Asset | null; len: number; motion?: 'entrar' | 'sair' | 'panoramica'; fit?: 'cover' | 'contain'; style?: React.CSSProperties }> = ({ asset, len, motion = 'entrar', fit = 'cover', style: extra }) => {
  const f = useCurrentFrame();
  if (!asset) return <AbsoluteFill style={{ background: C.ink }} />;
  const t = f / Math.max(1, len);
  const scale = motion === 'sair' ? 1.18 - 0.14 * t : 1.04 + 0.14 * t;
  const x = motion === 'panoramica' ? interpolate(t, [0, 1], [-4, 4]) : 0;
  const style: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit, transform: `scale(${scale}) translateX(${x}%)`, ...extra };
  return asset.kind === 'video' ? <OffthreadVideo src={asset.src} muted style={style} /> : <Img src={asset.src} style={style} />;
};

/** Palavras gigantes em cortes secos, distribuídas pela duração do beat. */
export const Titulo: React.FC<Base & { palavras: string[]; cores?: string[]; fundo?: Bg; tom?: string }> = ({ len, palavras, cores = [], fundo = 'estrelas', tom }) => {
  const f = useCurrentFrame(); const { W, V } = useStage();
  const n = Math.max(1, palavras.length); const step = len / n; const i = Math.min(n - 1, Math.floor(f / step)); const local = f - i * step;
  const word = palavras[i] || '';
  const size = fit(word, W - 180, V ? 260 : 320, V ? 3 : 2);
  const s = interpolate(local, [0, 3, 7], [1.9, 0.94, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) * interpolate(local, [0, step], [1, 1.07], clamp);
  return (
    <AbsoluteFill style={{ transform: shake(f, palavras.map((_, k) => Math.round(k * step))) }}>
      <Background kind={fundo} tint={tom} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', transform: `scale(${s})`, padding: 80 }}><Punch size={size} color={color(cores[i], fundo === 'branco' ? C.red : i === n - 1 ? C.yellow : C.white)} style={{ textAlign: 'center' }}>{word}</Punch></AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Frases "pensadas" no campo de estrelas, linha a linha; opcional riscar uma palavra e fechar com destaque gigante. */
export const Frase: React.FC<Base & { linhas: string[]; riscar?: string; destaque?: string; humor?: Mood; fundo?: Bg; tom?: string }> = ({ len, linhas, riscar, destaque, humor, fundo, tom }) => {
  const f = useCurrentFrame(); const { W, V } = useStage();
  const lineAt = (i: number) => Math.round(i * Math.min(16, (len * 0.45) / Math.max(1, linhas.length)));
  const big = destaque ? Math.round(len * 0.55) : Infinity;
  return (
    <AbsoluteFill style={{ transform: shake(f, Number.isFinite(big) ? [big] : [], 16) }}>
      {fundo ? <Background kind={fundo} tint={tom} /> : <Stars />}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: V ? 70 : 120, paddingBottom: V ? 380 : 120 }}>
        {f < big ? linhas.map((line, i) => f >= lineAt(i) && (
          <div key={i} style={{ fontFamily: ANTON, fontSize: fit(line, W - (V ? 200 : 360), V ? 150 : 130, 2), lineHeight: 1.05, maxWidth: W - (V ? 140 : 300), textTransform: 'uppercase', color: i % 2 ? C.yellow : C.white, background: C.ink, padding: '6px 28px', margin: '10px 0', boxShadow: `10px 10px 0 ${i % 2 ? C.red : C.blue}`, transform: `rotate(${i % 2 ? 2 : -2}deg) scale(${f - lineAt(i) < 1 ? 1.25 : 1})` }}>
            {riscar && line.includes(riscar) ? <>{line.split(riscar)[0]}<span style={{ position: 'relative' }}>{riscar}<span style={{ position: 'absolute', left: -10, right: -10, top: '52%', height: 12, background: C.red, transform: `scaleX(${slide(f, lineAt(i) + 18, 8)})`, transformOrigin: 'left' }} /></span>{line.split(riscar).slice(1).join(riscar)}</> : line}
          </div>
        )) : <div style={{ transform: `scale(${interpolate(f - big, [0, 4, 8, len - big], [1.7, 0.95, 1, 1.08], clamp)})` }}><div style={{ display: 'inline-block', background: fundo && fundo !== 'estrelas' && fundo !== 'escuro' ? C.ink : 'transparent', padding: '14px 36px', boxShadow: fundo && fundo !== 'estrelas' && fundo !== 'escuro' ? `14px 14px 0 ${C.red}` : 'none' }}><Punch size={fit(destaque!, W - 220, V ? 220 : 240, V ? 3 : 2)} color={C.yellow} style={{ textAlign: 'center' }}>{destaque}</Punch></div></div>}
        {humor && f < big && f >= lineAt(linhas.length) + 6 && <div style={{ marginTop: 30, transform: `scale(${pop(f, lineAt(linhas.length) + 6)})`, position: 'relative', width: noxW(300), height: 300 }}><Nox mood={humor} height={300} x={0} y={0} /></div>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Nox em destaque, de corpo inteiro, reagindo, com texto de impacto ao lado (no vertical, texto em cima). */
export const NoxCena: React.FC<Base & { humor?: Mood; texto?: string; subtexto?: string; fundo?: Bg; tom?: string; lado?: 'direita' | 'esquerda'; poses?: Array<{ pose?: string; humor?: Mood }> }> = ({ len, humor = 'feliz', texto, subtexto, fundo = 'explosao', tom, lado = 'direita', poses }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const right = lado === 'direita';
  const nh = V ? 900 : 880;
  const nx = V ? (W - noxW(nh)) / 2 + (right ? 60 : -60) : right ? 1160 : 140;
  const ny = V ? H * 0.68 - nh : 190;
  const textBox: React.CSSProperties = V
    ? { left: 60, right: 60, top: H * 0.13, textAlign: 'center', transformOrigin: 'center' }
    : { [right ? 'left' : 'right']: 120, top: 300, maxWidth: 1000, transformOrigin: right ? 'left' : 'right', textAlign: right ? 'left' : 'right' };
  return (
    <Camera>
      <Background kind={fundo} tint={tom} />
      {poses?.length
        ? (() => { const k = Math.min(poses.length - 1, Math.floor(f / Math.max(1, len / poses.length))); const p = poses[k]; return <NoxPose pose={p.pose} mood={p.humor || humor} height={nh} cx={nx + noxW(nh) / 2} bottom={ny + nh} flip={(V ? !right : false) !== (k % 2 === 1)} seed={`nox${k}`} />; })()
        : <Nox mood={humor} height={nh} x={nx} y={ny} flip={V ? !right : false} tilt={Math.sin(f / 6) * 3} squash={interpolate(f, [0, 4, 9], [0.22, -0.07, 0], clamp)} />}
      {texto && <div style={{ position: 'absolute', ...textBox, transform: `scale(${pop(f, 6)}) rotate(${right ? -4 : 4}deg)` }}>
        <div style={{ display: 'inline-block', background: C.ink, padding: '10px 40px', boxShadow: `14px 14px 0 ${C.red}` }}><Punch size={fit(texto, V ? W - 200 : 900, V ? 150 : 190, V ? 3 : 2)} color={C.yellow} split={4}>{texto}</Punch></div>
        {subtexto && f >= Math.min(20, len / 3) && <div style={{ marginTop: 30, transform: `scale(${pop(f, Math.min(20, len / 3))})` }}><Punch size={V ? 100 : 120} color={fundo === 'explosao' ? C.ink : C.white} split={4}>{subtexto}</Punch></div>}
      </div>}
    </Camera>
  );
};

/** Evidência da obra: imagem/vídeo num painel HQ com Ken Burns, etiqueta, legenda e reação opcional do Nox (só o rosto e o tronco, num canto). */
export const Evidencia: React.FC<Base & { midia: string; rotulo?: string; legenda?: string; humor?: Mood; movimento?: 'entrar' | 'sair' | 'panoramica'; fundo?: Bg; tom?: string; tela?: boolean; cheia?: boolean }> = ({ len, midia, rotulo, legenda, humor, movimento = 'entrar', fundo = 'papel', tom, tela = false, cheia }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const asset = useAsset(midia);
  const full = cheia ?? false;
  const box = full ? { x: -10, y: -10, w: W + 20, h: H + 20 } : V ? { x: 40, y: H * 0.13, w: W - 80, h: H * 0.5 } : { x: humor ? 90 : 180, y: 110, w: humor ? 1300 : 1560, h: 820 };
  const peek = humor ? interpolate(f, [2, 10], [0, 1], { ...clamp, easing: ease }) : 0;
  const nh = V ? 760 : 620;
  return (
    <Camera from={1.1}>
      <Background kind={fundo} tint={tom} />
      <Panel x={box.x} y={box.y} w={box.w} h={box.h} rotate={full ? 0 : -1.2} bg={C.ink} style={tela ? { borderRadius: 30 } : full ? { border: 'none', boxShadow: 'none' } : undefined}>
        <Media asset={asset} len={len} motion={movimento} />
        {tela && <AbsoluteFill style={{ background: 'repeating-linear-gradient(to bottom, rgba(0,0,0,.18) 0 2px, transparent 2px 5px)', boxShadow: 'inset 0 0 120px rgba(0,0,0,.8)' }} />}
        {rotulo && <div style={{ position: 'absolute', left: 0, top: 0, background: C.yellow, borderRight: `7px solid ${C.ink}`, borderBottom: `7px solid ${C.ink}`, padding: '8px 22px', fontFamily: ANTON, fontSize: V ? 56 : 52, color: C.ink, transform: `translateX(${(1 - slide(f, 4, 8)) * -400}px)` }}>{rotulo}</div>}
      </Panel>
      {legenda && f >= 10 && <div style={{ position: 'absolute', left: V ? 50 : humor ? 140 : 260, right: V ? 50 : undefined, top: V ? box.y + box.h + 50 : undefined, bottom: V ? undefined : 70, textAlign: V ? 'center' : 'left', transform: `scale(${pop(f, 10)}) rotate(-1.5deg)`, transformOrigin: V ? 'center' : 'left' }}><span style={{ fontFamily: ANTON, fontSize: V ? 80 : 74, lineHeight: 1.3, color: '#fff', background: C.ink, padding: '4px 26px', boxShadow: `10px 10px 0 ${C.red}`, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{legenda}</span></div>}
      {humor && <div style={{ position: 'absolute', right: V ? -40 : 20, top: (V ? H * 0.72 : H) - nh * 0.62 * peek, width: noxW(nh), height: nh * 0.62, overflow: 'hidden' }}>
        <Nox mood={humor} height={nh} x={0} y={0} tilt={Math.sin(f / 8) * 3} look={-1} flip />
      </div>}
    </Camera>
  );
};

/**
 * Aparte do Nox (momentos cômicos, opinião): a cena da obra continua atrás e desfoca; o Nox aparece
 * INTEIRO, subindo pela borda de baixo, com o resto do corpo fora do quadro. Cada fala é uma pose nova
 * em stop motion: troca seca de desenho e de lugar, sem quadros intermediários, com uma tremidinha.
 * Um balão com ícone ou texto mostra o que ele diz. No fim ele sai de uma vez e o fundo volta nítido.
 */
export const Aparte: React.FC<Base & { midia?: string; falas: Array<{ pose?: string; humor?: Mood; icone?: string; texto?: string }>; fundo?: Bg; tom?: string }> = ({ len, midia, falas, fundo = 'escuro', tom }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const asset = useAsset(midia);
  const n = Math.max(1, Math.min(5, falas.length));
  const inAt = 3; const outAt = Math.max(inAt + 10, len - 6);
  const step = (outAt - inAt) / n; const k = Math.min(n - 1, Math.max(0, Math.floor((f - inAt) / step))); const localAt = inAt + k * step; const local = f - localAt;
  const fala = falas[k] || {};
  // Entrada e saída em dois "quadros" de stop motion, não em animação contínua.
  const shown = f < inAt ? 0 : f < inAt + 2 ? 0.55 : f < outAt ? 1 : f < outAt + 2 ? 0.55 : 0;
  const blur = 18 * interpolate(f, [0, inAt + 3], [0, 1], clamp) * (1 - interpolate(f, [outAt, outAt + 5], [0, 1], clamp));
  const spots = V ? [0, -0.17, 0.16, -0.06, 0.1] : [0, -0.2, 0.18, -0.08, 0.12];
  const cx = W / 2 + spots[k % spots.length] * W;
  const flip = k % 2 === 1;
  // Figura inteira; ~28% do corpo (pernas) fica abaixo da borda, para tronco, braços e mãos aparecerem.
  const nh = V ? H * 0.56 : H * 0.95;
  const bottom = H + nh * 0.28 + (1 - shown) * nh * 0.75;
  const top = bottom - nh;
  const pop_ = local < 1 ? 1.25 : 1; // balão "estala" num quadro
  const bubbleOn = shown === 1 && local >= 2 && (fala.icone || fala.texto);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: blur > 0.3 ? `blur(${blur}px) brightness(${1 - blur / 45})` : undefined, transform: `scale(${1.04 + blur / 300})` }}>
        {asset ? <Media asset={asset} len={len} motion="panoramica" /> : <Background kind={fundo} tint={tom} />}
      </AbsoluteFill>
      {shown > 0 && <NoxPose pose={fala.pose} mood={(fala.humor as Mood) || 'feliz'} height={nh} cx={cx} bottom={bottom} flip={flip} seed={`aparte${k}`} />}
      {bubbleOn && (
        <div style={{ position: 'absolute', left: cx, top: top - (V ? 30 : 20), transform: `translate(-50%, -100%) scale(${pop_}) rotate(${(k % 2 ? 3 : -3)}deg)`, transformOrigin: '50% 100%' }}>
          <div style={{ background: '#fff', border: `8px solid ${C.ink}`, borderRadius: 46, boxShadow: `12px 12px 0 ${C.ink}`, padding: '22px 34px', display: 'flex', alignItems: 'center', gap: 22, maxWidth: V ? W - 120 : 900 }}>
            {fala.icone && <IconArt name={fala.icone} size={fala.texto ? (V ? 170 : 150) : (V ? 260 : 210)} />}
            {fala.texto && <span style={{ fontFamily: ANTON, fontSize: fit(fala.texto, V ? W - 360 : 640, V ? 96 : 92, 2), color: C.ink, textTransform: 'uppercase', lineHeight: 1 }}>{fala.texto}</span>}
          </div>
          <div style={{ width: 0, height: 0, margin: '0 auto', borderLeft: '26px solid transparent', borderRight: '26px solid transparent', borderTop: `42px solid ${C.ink}` }} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Página HQ com 2–3 painéis que entram em sequência (lado a lado no 16:9, empilhados no 9:16). */
export const Pagina: React.FC<Base & { paineis: Array<{ midia?: string; humor?: Mood; rotulo?: string; onomatopeia?: string; tom?: string }>; conclusao?: string }> = ({ len, paineis, conclusao }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const assets = useContext(Assets);
  const n = Math.min(3, Math.max(1, paineis.length)); const gap = Math.max(8, Math.round((len * (conclusao ? 0.55 : 0.75)) / n));
  const typedAt = n * gap + 4; const chars = Math.max(0, Math.floor((f - typedAt) / 1.5));
  const area = V ? { top: H * 0.12, h: H * 0.58 } : { top: 80, h: 640 };
  const rect = (i: number) => V
    ? { x: 60 + (i % 2) * 24, y: area.top + i * (area.h / n), w: W - 144, h: area.h / n - 34 }
    : { x: 70 + i * ((n === 3 ? 560 : n === 2 ? 840 : 1300) + 50), y: 80 + (i % 2) * 30, w: n === 3 ? 560 : n === 2 ? 840 : 1300, h: 640 };
  return (
    <Camera>
      <Halftone />
      {paineis.slice(0, 3).map((p, i) => { const r = rect(i); const nh = Math.min(r.h * 0.85, 460); return f >= i * gap && (
        <Panel key={i} x={r.x} y={r.y} w={r.w} h={r.h} rotate={[-2, 1.5, -1][i]} bg={color(p.tom, ['#d9cfbd', C.yellow, '#e8e2d6'][i])} style={{ opacity: interpolate(f, [i * gap, i * gap + 3], [0, 1], clamp), transform: `translate${V ? 'X' : 'Y'}(${(1 - slide(f, i * gap, 9)) * (V ? (i % 2 ? 300 : -300) : 80)}px) rotate(${[-2, 1.5, -1][i]}deg)` }}>
          {p.midia ? <Media asset={assets[p.midia.replace(/^media:/, '')] || null} len={len} /> : <><SpeedBurst bg={color(p.tom, ['#d9cfbd', C.yellow, '#e8e2d6'][i])} color="rgba(11,11,16,.2)" rays={24} /><Nox mood={p.humor || 'bravo'} height={nh} x={(r.w - noxW(nh)) / 2} y={r.h - nh * 0.95} squash={interpolate(f - i * gap, [0, 4, 10], [0.3, -0.1, 0], clamp)} /></>}
          {p.onomatopeia && <div style={{ position: 'absolute', right: 20, top: 30, transform: `rotate(12deg) scale(${pop(f, i * gap + 6)})` }}><Punch size={V ? 96 : 110} color={C.red} split={3}>{p.onomatopeia}</Punch></div>}
          {p.rotulo && <div style={{ position: 'absolute', left: 0, bottom: 0, background: '#fff', borderRight: `6px solid ${C.ink}`, borderTop: `6px solid ${C.ink}`, padding: '8px 18px', fontFamily: ANTON, fontSize: V ? 46 : 40, color: C.ink, maxWidth: r.w - 40 }}>{p.rotulo}</div>}
        </Panel>
      ); })}
      {conclusao && f >= typedAt && <div style={{ position: 'absolute', left: 30, right: 30, top: V ? area.top + area.h + 30 : undefined, bottom: V ? undefined : 70, textAlign: 'center' }}><span style={{ fontFamily: ANTON, fontSize: V ? 88 : 100, color: '#fff', background: C.ink, padding: '6px 34px', boxShadow: `10px 10px 0 ${C.red}` }}>{conclusao.slice(0, chars)}<span style={{ opacity: f % 10 < 5 ? 1 : 0 }}>|</span></span></div>}
    </Camera>
  );
};

/** Número que conta até o valor, com gráfico de linha subindo ou descendo (marcar fonte ou "simulação"). */
export const Numero: React.FC<Base & { valor: number; de?: number; sufixo?: string; rotulo: string; tendencia?: 'sobe' | 'desce'; fonte?: string; humor?: Mood; marcos?: string[] }> = ({ len, valor, de = 0, sufixo = '', rotulo, tendencia, fonte = 'simulação', humor, marcos = [] }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const up = tendencia ? tendencia === 'sobe' : valor >= de; const good = up ? '#3ddc84' : C.red;
  const p = slide(f, 6, Math.max(12, len * 0.7));
  const shown = de + (valor - de) * p; const digits = Math.abs(valor) < 10 && !Number.isInteger(valor) ? 1 : 0;
  const cw = V ? W - 120 : 1100; const top = V ? H * 0.12 : 80;
  const curve = (t: number) => (up ? 520 - t * 380 : 140 + (1 - Math.exp(-t * 3.2)) * 380) + Math.sin(t * 11) * 18;
  const pts = Array.from({ length: Math.max(2, Math.round(p * 50)) }, (_, i) => [40 + (i / 49) * (cw - 80), curve(i / 49)]);
  return (
    <Camera>
      <AbsoluteFill style={{ background: up ? '#101a14' : '#121219' }} />
      <div style={{ position: 'absolute', left: V ? 60 : 120, right: V ? 60 : undefined, top, fontFamily: ROUND, fontWeight: 800, fontSize: V ? 44 : 40, color: up ? '#8fb59a' : '#9aa0b4' }}>{rotulo}{fonte ? ` · ${fonte}` : ''}</div>
      <div style={{ position: 'absolute', left: V ? 60 : 120, top: top + (V ? 110 : 60), display: 'flex', alignItems: 'center', gap: 26 }}>
        <div style={{ width: 120, height: 120, borderRadius: 60, background: good, color: '#fff', fontFamily: ANTON, fontSize: 86, textAlign: 'center', lineHeight: '120px' }}>{up ? '↑' : '↓'}</div>
        <Punch size={V ? 200 : 180} color={good} split={3}>{shown.toFixed(digits)}{sufixo}</Punch>
      </div>
      <svg style={{ position: 'absolute', left: V ? 60 : 100, top: V ? top + 420 : 420 }} width={cw} height={620}>
        {[0, 1, 2, 3].map(i => <line key={i} x1={40} x2={cw - 40} y1={120 + i * 130} y2={120 + i * 130} stroke="#2a2a36" strokeWidth={2} />)}
        <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={good} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 14px ${good})` }} />
        {marcos.map((label, i) => { const t = (i + 1) / (marcos.length + 1); return p >= t && <g key={label} transform={`translate(${40 + t * (cw - 80)} ${curve(t)}) scale(${pop(f, 6 + t * len * 0.7)})`}><circle r={20} fill={[C.blue, C.yellow, C.red][i % 3]} stroke={C.ink} strokeWidth={6} /><rect x={-140} y={-150} width={280} height={96} fill={C.paper} stroke={C.ink} strokeWidth={7} /><text y={-80} textAnchor="middle" fontFamily="Anton" fontSize={60} fill={C.ink}>{label}</text></g>; })}
      </svg>
      {humor && !V && <Nox mood={humor} height={540} x={1460} y={460} tilt={Math.sin(f / 9) * 3} look={-1} />}
    </Camera>
  );
};

/** Ficha com barras que enchem (atributos, estatísticas) e carimbo opcional. */
export const Ficha: React.FC<Base & { titulo: string; itens: Array<{ rotulo: string; valor: number }>; carimbo?: string; humor?: Mood; midia?: string }> = ({ len, titulo, itens, carimbo, humor = 'feliz', midia }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const asset = useAsset(midia);
  const step = Math.max(6, Math.min(16, (len * 0.6) / Math.max(1, itens.length)));
  const stampAt = Math.round(itens.length * step + 14);
  const pic = V ? { x: 60, y: H * 0.1, w: W - 120, h: H * 0.24 } : { x: 90, y: 170, w: 600, h: 740 };
  const sheet = V ? { x: 50, y: H * 0.37, w: W - 100, h: H * 0.36 } : { x: 760, y: 150, w: 1020, h: 780 };
  const n = Math.min(5, itens.length);
  return (
    <Camera>
      <Halftone bg={C.blue} dot="rgba(255,255,255,.12)" />
      {asset ? <Panel x={pic.x} y={pic.y} w={pic.w} h={pic.h} rotate={2} bg={C.ink}><Media asset={asset} len={len} /></Panel> : <Nox mood={humor} height={V ? pic.h * 1.1 : 700} x={V ? (W - noxW(pic.h * 1.1)) / 2 : 120} y={V ? pic.y : 300} squash={interpolate(f, [0, 4, 9], [0.25, -0.08, 0], clamp)} tilt={Math.sin(f / 12) * 2} />}
      <Panel x={sheet.x} y={sheet.y} w={sheet.w} h={sheet.h} rotate={-1.5}>
        <div style={{ position: 'absolute', left: 40, top: 26, fontFamily: ANTON, fontSize: 64, color: C.ink }}>{titulo}</div>
        {itens.slice(0, n).map((item, i) => {
          const start = 8 + i * step; const p = slide(f, start, 14); const low = item.valor <= 10;
          return (
            <div key={i} style={{ position: 'absolute', left: 40, top: 130 + i * ((sheet.h - 190) / Math.max(4, n)), width: sheet.w - 100, opacity: interpolate(f, [start - 3, start], [0, 1], clamp), transform: `translateX(${(1 - slide(f, start - 3, 6)) * 60}px)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ANTON, fontSize: 48, color: C.ink }}><span>{item.rotulo}</span><span style={{ color: low ? C.red : C.ink }}>{Math.round(item.valor * p)}</span></div>
              <div style={{ height: 30, border: `5px solid ${C.ink}`, background: '#fff' }}><div style={{ width: `${Math.max(2, item.valor) * p}%`, height: '100%', background: low ? C.red : C.yellow, backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,.15) 0 10px, transparent 10px 20px)' }} /></div>
            </div>
          );
        })}
        {carimbo && f >= stampAt && <div style={{ position: 'absolute', right: 40, bottom: 30, transform: `rotate(-12deg) scale(${interpolate(f, [stampAt, stampAt + 4, stampAt + 8], [2.4, 0.9, 1], clamp)})`, border: `8px solid ${C.red}`, color: C.red, fontFamily: ANTON, fontSize: 80, padding: '0 26px', background: 'rgba(242,232,213,.85)' }}>{carimbo}</div>}
      </Panel>
    </Camera>
  );
};

/** Fórmula com cartas e operadores (em linha no 16:9, em coluna no 9:16); cartas podem "virar"; carimbo final. */
export const Formula: React.FC<Base & { titulo?: string; termos: Array<{ rotulo: string; valor: string; vira?: string }>; operadores?: string[]; carimbo?: string; humor?: Mood }> = ({ len, titulo, termos, operadores, carimbo, humor = 'confuso' }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const n = Math.min(4, termos.length); const ops = operadores || Array.from({ length: n - 1 }, (_, i) => (i === n - 2 ? '=' : '×'));
  const step = Math.max(6, Math.round((len * 0.3) / n)); const flipAt = Math.round(len * 0.4); const zoomAt = carimbo ? Math.round(len * 0.62) : Infinity;
  const cardW = V ? W - 260 : n >= 4 ? 360 : 460; const cardH = V ? Math.min(230, (H * 0.5) / n - 70) : 240;
  const total = n * cardW + (n - 1) * 120; const left = (W - total) / 2;
  const pos = (i: number) => V ? { x: (W - cardW) / 2, y: H * 0.2 + i * (cardH + 90) } : { x: left + i * (cardW + 120), y: 330 };
  const last = pos(n - 1);
  const zoom = interpolate(f, [zoomAt, zoomAt + 8], [1, 1.6], { ...clamp, easing: ease });
  return (
    <Camera>
      <Stars speed={0.6} />
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `${last.x + cardW / 2}px ${last.y + cardH / 2}px` }}>
        {titulo && <div style={{ position: 'absolute', top: V ? H * 0.1 : 70, width: '100%', textAlign: 'center', transform: `scale(${pop(f, 0)})` }}><Punch size={V ? 96 : 110} color={C.yellow}>{titulo}</Punch></div>}
        {termos.slice(0, n).map((term, i) => {
          const at = 4 + i * step; const flipFrame = term.vira ? flipAt + i * 6 : Infinity; const flipped = f >= flipFrame; const p = pos(i);
          const turn = term.vira ? interpolate(f, [flipFrame - 4, flipFrame, flipFrame + 4], [1, 0, 1], clamp) : 1;
          return f >= at && <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: p.x, top: p.y, width: cardW, transform: `scale(${pop(f, at, 9)}) scaleX(${turn}) rotate(${Math.sin((f + i * 20) / 20) * 1.2}deg)` }}>
              <div style={{ background: C.paper, border: `8px solid ${C.ink}`, boxShadow: `12px 12px 0 ${flipped ? C.red : [C.blue, C.yellow, C.red, C.blue][i]}`, padding: '22px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: ROUND, fontWeight: 900, fontSize: 32, color: '#555' }}>{term.rotulo}</div>
                <div style={{ fontFamily: ANTON, fontSize: Math.min(V ? 110 : 120, (V ? 1100 : 900) / Math.max(4, (flipped ? term.vira! : term.valor).length)), color: flipped ? C.red : C.ink, lineHeight: 1.1 }}>{flipped ? term.vira : term.valor}</div>
              </div>
            </div>
            {i < n - 1 && f >= at + 4 && <div style={{ position: 'absolute', left: V ? W / 2 - 40 : p.x + cardW + 22, top: V ? p.y + cardH + 4 : 410, transform: `scale(${pop(f, at + 4)})` }}><Punch size={V ? 90 : 120}>{ops[i]}</Punch></div>}
          </React.Fragment>;
        })}
        {!V && f >= flipAt + 8 && f < zoomAt && <Nox mood={humor} height={340} x={interpolate(f, [flipAt + 8, flipAt + 18], [1950, 1560], { ...clamp, easing: ease })} y={720} tilt={-10 + Math.sin(f / 5) * 4} />}
      </AbsoluteFill>
      {f >= zoomAt && <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: V ? 300 : 0 }}><div style={{ transform: `rotate(-8deg) scale(${interpolate(f, [zoomAt + 8, zoomAt + 12, zoomAt + 16], [2.6, 0.92, 1], clamp)})`, border: `12px solid ${C.red}`, padding: '0 40px', background: 'rgba(11,11,16,.75)', opacity: f >= zoomAt + 8 ? 1 : 0 }}><Punch size={Math.min(V ? 150 : 190, (V ? 1700 : 2600) / Math.max(8, carimbo!.length))} color={C.red} split={5}>{carimbo}</Punch></div></AbsoluteFill>}
    </Camera>
  );
};

/** Lista como fichas empilhadas em perspectiva, cada uma com ✓; conclusão opcional. */
export const Lista: React.FC<Base & { titulo: string; subtitulo?: string; prefixo?: string; itens: Array<{ titulo: string; texto?: string }>; conclusao?: string; humor?: Mood }> = ({ len, titulo, subtitulo, prefixo = 'ITEM', itens, conclusao, humor = 'determinado' }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const n = Math.min(5, itens.length); const step = Math.max(8, Math.round((len * 0.65) / n)); const endAt = 14 + n * step;
  const gap = V ? Math.min(200, (H * 0.42) / n) : n > 3 ? 165 : 225; const cardW = V ? W - 160 : 1080;
  return (
    <Camera>
      <Halftone bg="#1b2943" dot="rgba(255,255,255,.09)" />
      <div style={{ position: 'absolute', left: V ? 60 : 110, right: V ? 60 : undefined, top: V ? H * 0.1 : 80, transform: `translateX(${(1 - slide(f, 0, 10)) * -400}px)` }}><Punch size={V ? 100 : 110} color={C.yellow}>{titulo}</Punch>{subtitulo && <div style={{ fontFamily: ROUND, fontWeight: 900, fontSize: 44, color: '#fff', marginTop: 8 }}>{subtitulo}</div>}</div>
      <div style={{ position: 'absolute', left: V ? 50 : 110, top: V ? H * 0.25 : 320, width: cardW + 80, perspective: 1600 }}>
        {itens.slice(0, n).map((item, i) => {
          const at = 14 + i * step; const p = slide(f, at, 10); const active = f >= at && (i === n - 1 || f < at + step);
          const tone = [C.blue, C.yellow, C.red, '#3ddc84', '#b79ae4'][i];
          return (
            <div key={i} style={{ position: 'absolute', left: i * (V ? 16 : 40), top: i * gap, width: cardW, opacity: p, transform: `translateY(${(1 - p) * 300}px) rotateX(${(1 - p) * 60 + 8}deg) scale(${active ? 1.03 : 0.97})`, transformOrigin: 'top' }}>
              <div style={{ display: 'inline-block', background: tone, border: `6px solid ${C.ink}`, borderBottom: 'none', padding: '4px 26px', fontFamily: ANTON, fontSize: 38, color: C.ink, borderRadius: '14px 14px 0 0' }}>{prefixo} {String(i + 1).padStart(2, '0')}</div>
              <div style={{ background: C.paper, border: `6px solid ${C.ink}`, boxShadow: `10px 10px 0 ${C.ink}`, padding: '10px 30px', display: 'flex', alignItems: 'center', gap: 30, filter: active ? undefined : 'brightness(.8)' }}>
                <span style={{ fontFamily: ANTON, fontSize: n > 3 ? 60 : 76, color: C.ink, whiteSpace: V ? 'normal' : 'nowrap', lineHeight: 1.05 }}>{item.titulo}</span>
                {item.texto && !V && <span style={{ fontFamily: ROUND, fontWeight: 800, fontSize: 34, color: '#444' }}>{item.texto}</span>}
                {f >= at + 10 && <span style={{ marginLeft: 'auto', width: 74, height: 74, flexShrink: 0, borderRadius: 40, background: tone, border: `6px solid ${C.ink}`, fontFamily: ANTON, fontSize: 50, lineHeight: '62px', textAlign: 'center', transform: `scale(${pop(f, at + 10)}) rotate(-10deg)` }}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>
      {conclusao && f >= endAt && <div style={{ position: 'absolute', right: V ? 50 : 90, left: V ? 50 : undefined, top: V ? H * 0.25 + n * gap + 60 : 70, textAlign: V ? 'center' : undefined, transform: `scale(${pop(f, endAt)}) rotate(2deg)`, transformOrigin: V ? 'center' : 'right' }}><div style={{ display: 'inline-block', background: C.yellow, border: `6px solid ${C.ink}`, boxShadow: `10px 10px 0 ${C.ink}`, padding: '6px 26px' }}><Punch size={64} color={C.ink} split={2}>{conclusao}</Punch></div></div>}
      {!V && <Nox mood={f >= endAt ? 'feliz' : humor} height={620} x={1340} y={360} squash={itens.slice(0, n).reduce((sum, _, i) => sum + interpolate(f - (14 + i * step), [0, 4, 10], [0, 0.12, 0], clamp), 0)} tilt={Math.sin(f / 14) * 2} />}
    </Camera>
  );
};

/** Comparação (lado a lado no 16:9, em cima e embaixo no 9:16), com "VS" e veredito opcional. */
export const Comparacao: React.FC<Base & { esquerda: { titulo: string; midia?: string; humor?: Mood; tom?: string }; direita: { titulo: string; midia?: string; humor?: Mood; tom?: string }; veredito?: string }> = ({ len, esquerda, direita, veredito }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const assets = useContext(Assets);
  const side = (s: typeof esquerda, i: number) => {
    const at = i * Math.round(len * 0.18); const tone = color(s.tom, i ? C.red : C.blue);
    const box: React.CSSProperties = V
      ? { left: 0, top: i ? H * 0.42 : H * 0.08, width: W, height: H * 0.36, clipPath: i ? 'polygon(0 6%, 100% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 100% 94%, 0 100%)', transform: `translateX(${(1 - slide(f, at, 9)) * (i ? W : -W)}px)` }
      : { left: i ? 980 : 0, top: 0, width: 940, height: 1080, clipPath: i ? 'polygon(8% 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 92% 100%, 0 100%)', transform: `translateX(${(1 - slide(f, at, 9)) * (i ? 900 : -900)}px)` };
    const inner = V ? '50px 60px 130px 60px' : '120px 90px 200px 90px';
    const nh = V ? H * 0.22 : 560;
    return f >= at && <div key={i} style={{ position: 'absolute', background: tone, ...box }}>
      <div style={{ position: 'absolute', inset: inner, border: `8px solid ${C.ink}`, background: C.ink, overflow: 'hidden', transform: `rotate(${i ? 1.5 : -1.5}deg)` }}>{s.midia ? <Media asset={assets[s.midia.replace(/^media:/, '')] || null} len={len} motion={i ? 'sair' : 'entrar'} /> : <><SpeedBurst bg={tone} color="rgba(11,11,16,.25)" rays={20} /><Nox mood={s.humor || 'bravo'} height={nh} x={V ? (W - 120 - noxW(nh)) / 2 : 230} y={V ? 10 : 60} /></>}</div>
      <div style={{ position: 'absolute', bottom: V ? 26 : 70, width: '100%', textAlign: 'center' }}><Punch size={V ? 80 : 90}>{s.titulo}</Punch></div>
    </div>;
  };
  const vsAt = Math.round(len * 0.36); const verdictAt = Math.round(len * 0.6);
  return (
    <AbsoluteFill style={{ background: C.ink, transform: shake(f, [vsAt], 14) }}>
      {side(esquerda, 0)}{side(direita, 1)}
      {f >= vsAt && <div style={{ position: 'absolute', left: W / 2 - 120, top: (V ? H * 0.42 : H / 2) - 120, transform: `scale(${interpolate(f, [vsAt, vsAt + 4, vsAt + 8], [3, 0.9, 1], clamp)}) rotate(-6deg)`, background: C.yellow, border: `10px solid ${C.ink}`, borderRadius: 140, width: 240, height: 240, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Punch size={130} color={C.ink} split={3}>VS</Punch></div>}
      {veredito && f >= verdictAt && <div style={{ position: 'absolute', top: V ? H * 0.8 : 40, left: 30, right: 30, textAlign: 'center', transform: `scale(${pop(f, verdictAt)})` }}><span style={{ fontFamily: ANTON, fontSize: 80, background: '#fff', color: C.ink, border: `7px solid ${C.ink}`, padding: '4px 30px', boxShadow: `10px 10px 0 ${C.ink}` }}>{veredito}</span></div>}
    </AbsoluteFill>
  );
};

/** Encerramento: nome do canal letra a letra, Nox trocando de expressão, balão com pergunta e botão. */
export const Cta: React.FC<Base & { titulo?: string; pergunta: string; botao?: string; tom?: string }> = ({ len, titulo = 'DIAZVERSO', pergunta, botao = 'RESPONDE NOS COMENTÁRIOS ↓', tom }) => {
  const f = useCurrentFrame(); const { W, H, V } = useStage();
  const letters = titulo.split('');
  const moods: Mood[] = ['surpreso', 'feliz', 'determinado', 'piscada', 'feliz'];
  const nh = V ? 720 : 760;
  const L = V ? { title: { left: 0, right: 0, top: H * 0.08, justifyContent: 'center' }, nox: { x: (W - noxW(nh)) / 2, y: H * 0.42 }, bubble: { left: 60, top: H * 0.2, width: W - 120 }, button: { left: 0, right: 0, top: H * 0.78, textAlign: 'center' as const } }
    : { title: { left: 760, top: 200 }, nox: { x: 110, y: 300 }, bubble: { left: 770, top: 460, width: 1060 }, button: { left: 780, top: 800 } };
  return (
    <AbsoluteFill style={{ transform: shake(f, [0], 20) }}>
      <SpeedBurst bg={color(tom, C.red)} color="rgba(11,11,16,.35)" />
      <Nox mood={moods[Math.min(moods.length - 1, Math.floor(f / Math.max(10, len / moods.length)))]} height={nh} x={L.nox.x} y={interpolate(f, [0, 10], [H + 50, L.nox.y], { ...clamp, easing: ease })} tilt={Math.sin(f / 10) * 3} />
      <div style={{ position: 'absolute', display: 'flex', ...L.title }}>
        {letters.map((l, i) => <div key={i} style={{ transform: `translateY(${(1 - slide(f, 6 + i * 2, 8)) * -300}px) rotate(${(random(`l${i}`) - 0.5) * 8}deg)`, opacity: f >= 6 + i * 2 ? 1 : 0 }}><Punch size={Math.min(190, ((V ? W - 100 : 1800)) / Math.max(6, letters.length))} color="#fff" split={5}>{l === ' ' ? ' ' : l}</Punch></div>)}
      </div>
      {f >= Math.min(40, len * 0.25) && <div style={{ position: 'absolute', ...L.bubble, transform: `scale(${pop(f, Math.min(40, len * 0.25)) * (1 + Math.sin(f / 8) * 0.015)}) rotate(${-1 + Math.sin(f / 13)}deg)`, transformOrigin: V ? 'center bottom' : 'left' }}>
        <div style={{ background: '#fff', border: `8px solid ${C.ink}`, borderRadius: 40, padding: '30px 40px', boxShadow: `12px 12px 0 ${C.ink}`, fontFamily: ROUND, fontWeight: 900, fontSize: V ? 56 : 52, color: C.ink }}>{pergunta}</div>
        <div style={{ width: 0, height: 0, marginLeft: V ? W / 2 - 100 : 80, borderLeft: '40px solid transparent', borderRight: '10px solid transparent', borderTop: `60px solid ${C.ink}` }} />
      </div>}
      {f >= Math.min(90, len * 0.5) && <div style={{ position: 'absolute', ...L.button, transform: `scale(${pop(f, Math.min(90, len * 0.5))})` }}><span style={{ fontFamily: ANTON, fontSize: V ? 56 : 60, color: C.ink, background: C.yellow, border: `6px solid ${C.ink}`, padding: '6px 28px', boxShadow: `8px 8px 0 ${C.ink}` }}>{botao}</span></div>}
    </AbsoluteFill>
  );
};

/** Catálogo das cenas (nome usado no roteiro em beats → componente). */
export const SCENES: Record<string, React.FC<any>> = { titulo: Titulo, frase: Frase, nox: NoxCena, aparte: Aparte, evidencia: Evidencia, pagina: Pagina, numero: Numero, ficha: Ficha, formula: Formula, lista: Lista, comparacao: Comparacao, cta: Cta };
