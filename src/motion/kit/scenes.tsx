import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, interpolate, random, useCurrentFrame, Easing } from 'remotion';
import { ANTON, C, Halftone, Panel, Punch, ROUND, SpeedBurst, Stars, ease, pop, shake, slide } from './fx';
import { Mood, Nox } from './Nox';

/**
 * Cenas do kit de motion Diazverso. Cada cena recebe `len` (frames do beat) e ajusta os próprios tempos.
 * Mídias entram por referência `media:<id>` (imagem ou vídeo da obra, resolvida pelo editor) ou `brand:nox`.
 */
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export type Asset = { src: string; kind: 'image' | 'video' };
export const Assets = createContext<Record<string, Asset>>({});
const useAsset = (ref?: string): Asset | null => { const assets = useContext(Assets); if (!ref) return null; const id = ref.startsWith('media:') ? ref.slice(6) : ref; return assets[id] || null; };
type Base = { len: number };
type Bg = 'estrelas' | 'explosao' | 'meio-tom' | 'branco' | 'papel' | 'escuro';
const COLORS: Record<string, string> = { branco: C.white, amarelo: C.yellow, vermelho: C.red, azul: C.blue, tinta: C.ink };
const color = (name?: string, fallback = C.white) => (name && (COLORS[name] || (/^#[0-9a-f]{6}$/i.test(name) ? name : null))) || fallback;

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
export const Media: React.FC<{ asset: Asset | null; len: number; motion?: 'entrar' | 'sair' | 'panoramica'; fit?: 'cover' | 'contain' }> = ({ asset, len, motion = 'entrar', fit = 'cover' }) => {
  const f = useCurrentFrame();
  if (!asset) return <AbsoluteFill style={{ background: C.ink }} />;
  const t = f / Math.max(1, len);
  const scale = motion === 'sair' ? 1.18 - 0.14 * t : 1.04 + 0.14 * t;
  const x = motion === 'panoramica' ? interpolate(t, [0, 1], [-4, 4]) : 0;
  const style: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit, transform: `scale(${scale}) translateX(${x}%)` };
  return asset.kind === 'video' ? <OffthreadVideo src={asset.src} muted style={style} /> : <Img src={asset.src} style={style} />;
};

/** Palavras gigantes em cortes secos, distribuídas pela duração do beat. */
export const Titulo: React.FC<Base & { palavras: string[]; cores?: string[]; fundo?: Bg; tom?: string }> = ({ len, palavras, cores = [], fundo = 'estrelas', tom }) => {
  const f = useCurrentFrame();
  const n = Math.max(1, palavras.length); const step = len / n; const i = Math.min(n - 1, Math.floor(f / step)); const local = f - i * step;
  const word = palavras[i] || '';
  const size = Math.min(320, 1700 / Math.max(4, word.length * 0.62));
  const s = interpolate(local, [0, 3, 7], [1.9, 0.94, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) * interpolate(local, [0, step], [1, 1.07], clamp);
  return (
    <AbsoluteFill style={{ transform: shake(f, palavras.map((_, k) => Math.round(k * step))) }}>
      <Background kind={fundo} tint={tom} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', transform: `scale(${s})`, padding: 80 }}><Punch size={size} color={color(cores[i], fundo === 'branco' ? C.red : i === n - 1 ? C.yellow : C.white)} style={{ textAlign: 'center' }}>{word}</Punch></AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Frases "pensadas" no campo de estrelas, linha a linha; opcional riscar uma palavra e fechar com destaque gigante. */
export const Frase: React.FC<Base & { linhas: string[]; riscar?: string; destaque?: string; humor?: Mood }> = ({ len, linhas, riscar, destaque, humor }) => {
  const f = useCurrentFrame();
  const lineAt = (i: number) => Math.round(i * Math.min(16, (len * 0.45) / Math.max(1, linhas.length)));
  const big = destaque ? Math.round(len * 0.55) : Infinity;
  return (
    <AbsoluteFill style={{ transform: shake(f, Number.isFinite(big) ? [big] : [], 16) }}>
      <Stars />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 120 }}>
        {f < big ? linhas.map((line, i) => f >= lineAt(i) && (
          <div key={i} style={{ fontFamily: ROUND, fontWeight: 900, fontSize: 86, color: i % 2 ? '#b8b8c4' : '#fff', opacity: slide(f, lineAt(i), 6), transform: `translateY(${(1 - slide(f, lineAt(i), 8)) * 30}px)`, textShadow: '0 6px 0 rgba(0,0,0,.5)' }}>
            {riscar && line.includes(riscar) ? <>{line.split(riscar)[0]}<span style={{ position: 'relative' }}>{riscar}<span style={{ position: 'absolute', left: -10, right: -10, top: '52%', height: 12, background: C.red, transform: `scaleX(${slide(f, lineAt(i) + 18, 8)})`, transformOrigin: 'left' }} /></span>{line.split(riscar).slice(1).join(riscar)}</> : line}
          </div>
        )) : <div style={{ transform: `scale(${interpolate(f - big, [0, 4, 8, len - big], [1.7, 0.95, 1, 1.08], clamp)})` }}><Punch size={Math.min(240, 2600 / Math.max(6, destaque!.length))} color={C.yellow}>{destaque}</Punch></div>}
        {humor && f < big && f >= lineAt(linhas.length) + 6 && <div style={{ marginTop: 30, transform: `scale(${pop(f, lineAt(linhas.length) + 6)})`, position: 'relative', width: 200, height: 300 }}><Nox mood={humor} height={300} x={0} y={0} /></div>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Nox em destaque reagindo, com texto de impacto ao lado. */
export const NoxCena: React.FC<Base & { humor?: Mood; texto?: string; subtexto?: string; fundo?: Bg; tom?: string; lado?: 'direita' | 'esquerda' }> = ({ len, humor = 'feliz', texto, subtexto, fundo = 'explosao', tom, lado = 'direita' }) => {
  const f = useCurrentFrame();
  const right = lado === 'direita';
  return (
    <Camera>
      <Background kind={fundo} tint={tom} />
      <Nox mood={humor} height={880} x={right ? 1160 : 140} y={190} tilt={Math.sin(f / 6) * 3} squash={interpolate(f, [0, 4, 9], [0.22, -0.07, 0], clamp)} />
      {texto && <div style={{ position: 'absolute', [right ? 'left' : 'right']: 120, top: 300, maxWidth: 1000, transform: `scale(${pop(f, 6)}) rotate(${right ? -4 : 4}deg)`, transformOrigin: right ? 'left' : 'right', textAlign: right ? 'left' : 'right' }}>
        <div style={{ display: 'inline-block', background: C.ink, padding: '10px 40px', boxShadow: `14px 14px 0 ${C.red}` }}><Punch size={Math.min(190, 1900 / Math.max(6, texto.length))} color={C.yellow} split={4}>{texto}</Punch></div>
        {subtexto && f >= Math.min(20, len / 3) && <div style={{ marginTop: 30, transform: `scale(${pop(f, Math.min(20, len / 3))})` }}><Punch size={120} color={fundo === 'explosao' ? C.ink : C.white} split={4}>{subtexto}</Punch></div>}
      </div>}
    </Camera>
  );
};

/** Evidência da obra: imagem/vídeo num painel HQ com Ken Burns, etiqueta, legenda e reação opcional do Nox. */
export const Evidencia: React.FC<Base & { midia: string; rotulo?: string; legenda?: string; humor?: Mood; movimento?: 'entrar' | 'sair' | 'panoramica'; fundo?: Bg; tom?: string; tela?: boolean }> = ({ len, midia, rotulo, legenda, humor, movimento = 'entrar', fundo = 'papel', tom, tela = false }) => {
  const f = useCurrentFrame();
  const asset = useAsset(midia);
  const w = humor ? 1300 : 1560; const h = 820;
  return (
    <Camera from={1.1}>
      <Background kind={fundo} tint={tom} />
      <Panel x={humor ? 90 : 180} y={110} w={w} h={h} rotate={-1.2} bg={C.ink} style={tela ? { borderRadius: 30 } : undefined}>
        <Media asset={asset} len={len} motion={movimento} />
        {tela && <AbsoluteFill style={{ background: 'repeating-linear-gradient(to bottom, rgba(0,0,0,.18) 0 2px, transparent 2px 5px)', boxShadow: 'inset 0 0 120px rgba(0,0,0,.8)' }} />}
        {rotulo && <div style={{ position: 'absolute', left: 0, top: 0, background: C.yellow, borderRight: `7px solid ${C.ink}`, borderBottom: `7px solid ${C.ink}`, padding: '8px 22px', fontFamily: ANTON, fontSize: 52, color: C.ink, transform: `translateX(${(1 - slide(f, 4, 8)) * -400}px)` }}>{rotulo}</div>}
      </Panel>
      {legenda && f >= 10 && <div style={{ position: 'absolute', left: humor ? 140 : 260, bottom: 70, transform: `scale(${pop(f, 10)}) rotate(-1.5deg)`, transformOrigin: 'left' }}><span style={{ fontFamily: ANTON, fontSize: 74, color: '#fff', background: C.ink, padding: '4px 26px', boxShadow: `10px 10px 0 ${C.red}` }}>{legenda}</span></div>}
      {humor && <Nox mood={humor} height={520} x={1460} y={interpolate(f, [0, 9], [1100, 520], { ...clamp, easing: ease })} tilt={Math.sin(f / 8) * 3} look={-1} />}
    </Camera>
  );
};

/** Página HQ com 2–3 painéis que entram em sequência; cada painel mostra mídia ou o Nox. */
export const Pagina: React.FC<Base & { paineis: Array<{ midia?: string; humor?: Mood; rotulo?: string; onomatopeia?: string; tom?: string }>; conclusao?: string }> = ({ len, paineis, conclusao }) => {
  const f = useCurrentFrame();
  const assets = useContext(Assets);
  const n = Math.min(3, Math.max(1, paineis.length)); const gap = Math.max(8, Math.round((len * (conclusao ? 0.55 : 0.75)) / n));
  const w = n === 3 ? 560 : n === 2 ? 840 : 1300; const typedAt = n * gap + 4; const chars = Math.max(0, Math.floor((f - typedAt) / 1.5));
  return (
    <Camera>
      <Halftone />
      {paineis.slice(0, 3).map((p, i) => f >= i * gap && (
        <Panel key={i} x={70 + i * (w + 50)} y={80 + (i % 2) * 30} w={w} h={640} rotate={[-2, 1.5, -1][i]} bg={color(p.tom, ['#d9cfbd', C.yellow, '#e8e2d6'][i])} style={{ opacity: interpolate(f, [i * gap, i * gap + 3], [0, 1], clamp), transform: `translateY(${(1 - slide(f, i * gap, 9)) * 80}px) rotate(${[-2, 1.5, -1][i]}deg)` }}>
          {p.midia ? <Media asset={assets[p.midia.replace(/^media:/, '')] || null} len={len} /> : <><SpeedBurst bg={color(p.tom, ['#d9cfbd', C.yellow, '#e8e2d6'][i])} color="rgba(11,11,16,.2)" rays={24} /><Nox mood={p.humor || 'bravo'} height={460} x={(w - 290) / 2} y={150} squash={interpolate(f - i * gap, [0, 4, 10], [0.3, -0.1, 0], clamp)} /></>}
          {p.onomatopeia && <div style={{ position: 'absolute', right: 20, top: 40, transform: `rotate(12deg) scale(${pop(f, i * gap + 6)})` }}><Punch size={110} color={C.red} split={3}>{p.onomatopeia}</Punch></div>}
          {p.rotulo && <div style={{ position: 'absolute', left: 0, bottom: 0, background: '#fff', borderRight: `6px solid ${C.ink}`, borderTop: `6px solid ${C.ink}`, padding: '8px 18px', fontFamily: ANTON, fontSize: 40, color: C.ink, maxWidth: w - 40 }}>{p.rotulo}</div>}
        </Panel>
      ))}
      {conclusao && f >= typedAt && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center' }}><span style={{ fontFamily: ANTON, fontSize: 100, color: '#fff', background: C.ink, padding: '6px 34px', boxShadow: `10px 10px 0 ${C.red}` }}>{conclusao.slice(0, chars)}<span style={{ opacity: f % 10 < 5 ? 1 : 0 }}>|</span></span></div>}
    </Camera>
  );
};

/** Número que conta até o valor, com gráfico de linha subindo ou descendo (marcar fonte ou "simulação"). */
export const Numero: React.FC<Base & { valor: number; de?: number; sufixo?: string; rotulo: string; tendencia?: 'sobe' | 'desce'; fonte?: string; humor?: Mood; marcos?: string[] }> = ({ len, valor, de = 0, sufixo = '', rotulo, tendencia, fonte = 'simulação', humor, marcos = [] }) => {
  const f = useCurrentFrame();
  const up = tendencia ? tendencia === 'sobe' : valor >= de; const good = up ? '#3ddc84' : C.red;
  const p = slide(f, 6, Math.max(12, len * 0.7));
  const shown = de + (valor - de) * p; const digits = Math.abs(valor) < 10 && !Number.isInteger(valor) ? 1 : 0;
  const curve = (t: number) => (up ? 520 - t * 380 : 140 + (1 - Math.exp(-t * 3.2)) * 380) + Math.sin(t * 11) * 18;
  const pts = Array.from({ length: Math.max(2, Math.round(p * 50)) }, (_, i) => [80 + (i / 49) * 1100, curve(i / 49)]);
  return (
    <Camera>
      <AbsoluteFill style={{ background: up ? '#101a14' : '#121219' }} />
      <div style={{ position: 'absolute', left: 120, top: 80, fontFamily: ROUND, fontWeight: 800, fontSize: 40, color: up ? '#8fb59a' : '#9aa0b4' }}>{rotulo}{fonte ? ` · ${fonte}` : ''}</div>
      <div style={{ position: 'absolute', left: 120, top: 140, display: 'flex', alignItems: 'center', gap: 26 }}>
        <div style={{ width: 120, height: 120, borderRadius: 60, background: good, color: '#fff', fontFamily: ANTON, fontSize: 86, textAlign: 'center', lineHeight: '120px' }}>{up ? '↑' : '↓'}</div>
        <Punch size={180} color={good} split={3}>{shown.toFixed(digits)}{sufixo}</Punch>
      </div>
      <svg style={{ position: 'absolute', left: 100, top: 420 }} width={1300} height={620}>
        {[0, 1, 2, 3].map(i => <line key={i} x1={80} x2={1180} y1={120 + i * 130} y2={120 + i * 130} stroke="#2a2a36" strokeWidth={2} />)}
        <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={good} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 14px ${good})` }} />
        {marcos.map((label, i) => { const t = (i + 1) / (marcos.length + 1); return p >= t && <g key={label} transform={`translate(${80 + t * 1100} ${curve(t)}) scale(${pop(f, 6 + t * len * 0.7)})`}><circle r={20} fill={[C.blue, C.yellow, C.red][i % 3]} stroke={C.ink} strokeWidth={6} /><rect x={-140} y={-150} width={280} height={96} fill={C.paper} stroke={C.ink} strokeWidth={7} /><text y={-80} textAnchor="middle" fontFamily="Anton" fontSize={60} fill={C.ink}>{label}</text></g>; })}
      </svg>
      <Nox mood={humor || (up ? 'feliz' : 'tedio')} height={540} x={1460} y={460} tilt={Math.sin(f / 9) * 3} look={-1} />
    </Camera>
  );
};

/** Ficha com barras que enchem (atributos, estatísticas) e carimbo opcional. */
export const Ficha: React.FC<Base & { titulo: string; itens: Array<{ rotulo: string; valor: number }>; carimbo?: string; humor?: Mood; midia?: string }> = ({ len, titulo, itens, carimbo, humor = 'feliz', midia }) => {
  const f = useCurrentFrame();
  const asset = useAsset(midia);
  const step = Math.max(6, Math.min(16, (len * 0.6) / Math.max(1, itens.length)));
  const stampAt = Math.round(itens.length * step + 14);
  return (
    <Camera>
      <Halftone bg={C.blue} dot="rgba(255,255,255,.12)" />
      {asset ? <Panel x={90} y={170} w={600} h={740} rotate={2} bg={C.ink}><Media asset={asset} len={len} /></Panel> : <Nox mood={humor} height={700} x={120} y={300} squash={interpolate(f, [0, 4, 9], [0.25, -0.08, 0], clamp)} tilt={Math.sin(f / 12) * 2} />}
      <Panel x={760} y={150} w={1020} h={780} rotate={-1.5}>
        <div style={{ position: 'absolute', left: 40, top: 26, fontFamily: ANTON, fontSize: 64, color: C.ink }}>{titulo}</div>
        {itens.slice(0, 5).map((item, i) => {
          const start = 8 + i * step; const p = slide(f, start, 14); const low = item.valor <= 10;
          return (
            <div key={i} style={{ position: 'absolute', left: 40, top: 150 + i * (600 / Math.max(4, itens.length)), width: 920, opacity: interpolate(f, [start - 3, start], [0, 1], clamp), transform: `translateX(${(1 - slide(f, start - 3, 6)) * 60}px)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ANTON, fontSize: 50, color: C.ink }}><span>{item.rotulo}</span><span style={{ color: low ? C.red : C.ink }}>{Math.round(item.valor * p)}</span></div>
              <div style={{ height: 34, border: `5px solid ${C.ink}`, background: '#fff' }}><div style={{ width: `${Math.max(2, item.valor) * p}%`, height: '100%', background: low ? C.red : C.yellow, backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,.15) 0 10px, transparent 10px 20px)' }} /></div>
            </div>
          );
        })}
        {carimbo && f >= stampAt && <div style={{ position: 'absolute', right: 40, bottom: 40, transform: `rotate(-12deg) scale(${interpolate(f, [stampAt, stampAt + 4, stampAt + 8], [2.4, 0.9, 1], clamp)})`, border: `8px solid ${C.red}`, color: C.red, fontFamily: ANTON, fontSize: 86, padding: '0 26px', background: 'rgba(242,232,213,.85)' }}>{carimbo}</div>}
      </Panel>
    </Camera>
  );
};

/** Fórmula com cartas e operadores; cartas podem "virar" para outro valor; carimbo final com zoom. */
export const Formula: React.FC<Base & { titulo?: string; termos: Array<{ rotulo: string; valor: string; vira?: string }>; operadores?: string[]; carimbo?: string; humor?: Mood }> = ({ len, titulo, termos, operadores, carimbo, humor = 'confuso' }) => {
  const f = useCurrentFrame();
  const n = Math.min(4, termos.length); const ops = operadores || Array.from({ length: n - 1 }, (_, i) => (i === n - 2 ? '=' : '×'));
  const step = Math.max(6, Math.round((len * 0.3) / n)); const flipAt = Math.round(len * 0.4); const zoomAt = carimbo ? Math.round(len * 0.62) : Infinity;
  const cardW = n >= 4 ? 360 : 460; const total = n * cardW + (n - 1) * 120; const left = (1920 - total) / 2;
  const zoom = interpolate(f, [zoomAt, zoomAt + 8], [1, 1.9], { ...clamp, easing: ease });
  return (
    <Camera>
      <Stars speed={0.6} />
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `${left + total - cardW / 2}px 470px` }}>
        {titulo && <div style={{ position: 'absolute', top: 70, width: '100%', textAlign: 'center', transform: `scale(${pop(f, 0)})` }}><Punch size={110} color={C.yellow}>{titulo}</Punch></div>}
        {termos.slice(0, n).map((term, i) => {
          const at = 4 + i * step; const flipFrame = term.vira ? flipAt + i * 6 : Infinity; const flipped = f >= flipFrame;
          const turn = term.vira ? interpolate(f, [flipFrame - 4, flipFrame, flipFrame + 4], [1, 0, 1], clamp) : 1;
          return f >= at && <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: left + i * (cardW + 120), top: 330, width: cardW, transform: `scale(${pop(f, at, 9)}) scaleX(${turn}) rotate(${Math.sin((f + i * 20) / 20) * 1.2}deg)` }}>
              <div style={{ background: C.paper, border: `8px solid ${C.ink}`, boxShadow: `12px 12px 0 ${flipped ? C.red : [C.blue, C.yellow, C.red, C.blue][i]}`, padding: '26px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: ROUND, fontWeight: 900, fontSize: 32, color: '#555' }}>{term.rotulo}</div>
                <div style={{ fontFamily: ANTON, fontSize: Math.min(120, 900 / Math.max(4, (flipped ? term.vira! : term.valor).length)), color: flipped ? C.red : C.ink, lineHeight: 1.1 }}>{flipped ? term.vira : term.valor}</div>
              </div>
            </div>
            {i < n - 1 && f >= at + 4 && <div style={{ position: 'absolute', left: left + i * (cardW + 120) + cardW + 22, top: 410, transform: `scale(${pop(f, at + 4)})` }}><Punch size={120}>{ops[i]}</Punch></div>}
          </React.Fragment>;
        })}
        {f >= flipAt + 8 && f < zoomAt && <Nox mood={humor} height={340} x={interpolate(f, [flipAt + 8, flipAt + 18], [1950, 1560], { ...clamp, easing: ease })} y={720} tilt={-10 + Math.sin(f / 5) * 4} />}
      </AbsoluteFill>
      {f >= zoomAt && <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}><div style={{ transform: `rotate(-8deg) scale(${interpolate(f, [zoomAt + 8, zoomAt + 12, zoomAt + 16], [2.6, 0.92, 1], clamp)})`, border: `12px solid ${C.red}`, padding: '0 40px', background: 'rgba(11,11,16,.75)', opacity: f >= zoomAt + 8 ? 1 : 0 }}><Punch size={Math.min(190, 2600 / Math.max(8, carimbo!.length))} color={C.red} split={5}>{carimbo}</Punch></div></AbsoluteFill>}
    </Camera>
  );
};

/** Lista como fichas empilhadas em perspectiva, cada uma com ✓; conclusão opcional. */
export const Lista: React.FC<Base & { titulo: string; subtitulo?: string; prefixo?: string; itens: Array<{ titulo: string; texto?: string }>; conclusao?: string; humor?: Mood }> = ({ len, titulo, subtitulo, prefixo = 'ITEM', itens, conclusao, humor = 'determinado' }) => {
  const f = useCurrentFrame();
  const n = Math.min(5, itens.length); const step = Math.max(8, Math.round((len * 0.65) / n)); const endAt = 14 + n * step; const gap = n > 3 ? 165 : 225;
  return (
    <Camera>
      <Halftone bg="#1b2943" dot="rgba(255,255,255,.09)" />
      <div style={{ position: 'absolute', left: 110, top: 80, transform: `translateX(${(1 - slide(f, 0, 10)) * -400}px)` }}><Punch size={110} color={C.yellow}>{titulo}</Punch>{subtitulo && <div style={{ fontFamily: ROUND, fontWeight: 900, fontSize: 44, color: '#fff', marginTop: 8 }}>{subtitulo}</div>}</div>
      <div style={{ position: 'absolute', left: 110, top: 320, width: 1150, perspective: 1600 }}>
        {itens.slice(0, n).map((item, i) => {
          const at = 14 + i * step; const p = slide(f, at, 10); const active = f >= at && (i === n - 1 || f < at + step);
          const tone = [C.blue, C.yellow, C.red, '#3ddc84', '#b79ae4'][i];
          return (
            <div key={i} style={{ position: 'absolute', left: i * 40, top: i * gap, width: 1080, opacity: p, transform: `translateY(${(1 - p) * 300}px) rotateX(${(1 - p) * 60 + 8}deg) scale(${active ? 1.03 : 0.97})`, transformOrigin: 'top' }}>
              <div style={{ display: 'inline-block', background: tone, border: `6px solid ${C.ink}`, borderBottom: 'none', padding: '4px 26px', fontFamily: ANTON, fontSize: 38, color: C.ink, borderRadius: '14px 14px 0 0' }}>{prefixo} {String(i + 1).padStart(2, '0')}</div>
              <div style={{ background: C.paper, border: `6px solid ${C.ink}`, boxShadow: `10px 10px 0 ${C.ink}`, padding: '10px 30px', display: 'flex', alignItems: 'center', gap: 30, filter: active ? undefined : 'brightness(.8)' }}>
                <span style={{ fontFamily: ANTON, fontSize: n > 3 ? 64 : 80, color: C.ink, whiteSpace: 'nowrap' }}>{item.titulo}</span>
                {item.texto && <span style={{ fontFamily: ROUND, fontWeight: 800, fontSize: 34, color: '#444' }}>{item.texto}</span>}
                {f >= at + 10 && <span style={{ marginLeft: 'auto', width: 74, height: 74, flexShrink: 0, borderRadius: 40, background: tone, border: `6px solid ${C.ink}`, fontFamily: ANTON, fontSize: 50, lineHeight: '62px', textAlign: 'center', transform: `scale(${pop(f, at + 10)}) rotate(-10deg)` }}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>
      {conclusao && f >= endAt && <div style={{ position: 'absolute', right: 90, top: 70, transform: `scale(${pop(f, endAt)}) rotate(2deg)`, transformOrigin: 'right' }}><div style={{ background: C.yellow, border: `6px solid ${C.ink}`, boxShadow: `10px 10px 0 ${C.ink}`, padding: '6px 26px' }}><Punch size={64} color={C.ink} split={2}>{conclusao}</Punch></div></div>}
      <Nox mood={f >= endAt ? 'feliz' : humor} height={620} x={1340} y={360} squash={itens.slice(0, n).reduce((sum, _, i) => sum + interpolate(f - (14 + i * step), [0, 4, 10], [0, 0.12, 0], clamp), 0)} tilt={Math.sin(f / 14) * 2} />
    </Camera>
  );
};

/** Comparação lado a lado (mídia ou Nox), com "VS" e veredito opcional. */
export const Comparacao: React.FC<Base & { esquerda: { titulo: string; midia?: string; humor?: Mood; tom?: string }; direita: { titulo: string; midia?: string; humor?: Mood; tom?: string }; veredito?: string }> = ({ len, esquerda, direita, veredito }) => {
  const f = useCurrentFrame();
  const assets = useContext(Assets);
  const side = (s: typeof esquerda, i: number) => {
    const at = i * Math.round(len * 0.18); const tone = color(s.tom, i ? C.red : C.blue);
    return f >= at && <div key={i} style={{ position: 'absolute', left: i ? 980 : 0, top: 0, width: 940, height: 1080, background: tone, clipPath: i ? 'polygon(8% 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 92% 100%, 0 100%)', transform: `translateX(${(1 - slide(f, at, 9)) * (i ? 900 : -900)}px)` }}>
      <div style={{ position: 'absolute', inset: '120px 90px 200px 90px', border: `8px solid ${C.ink}`, background: C.ink, overflow: 'hidden', transform: `rotate(${i ? 1.5 : -1.5}deg)` }}>{s.midia ? <Media asset={assets[s.midia.replace(/^media:/, '')] || null} len={len} motion={i ? 'sair' : 'entrar'} /> : <><SpeedBurst bg={tone} color="rgba(11,11,16,.25)" rays={20} /><Nox mood={s.humor || 'bravo'} height={560} x={230} y={60} /></>}</div>
      <div style={{ position: 'absolute', bottom: 70, width: '100%', textAlign: 'center' }}><Punch size={90}>{s.titulo}</Punch></div>
    </div>;
  };
  const vsAt = Math.round(len * 0.36); const verdictAt = Math.round(len * 0.6);
  return (
    <AbsoluteFill style={{ background: C.ink, transform: shake(f, [vsAt], 14) }}>
      {side(esquerda, 0)}{side(direita, 1)}
      {f >= vsAt && <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}><div style={{ transform: `scale(${interpolate(f, [vsAt, vsAt + 4, vsAt + 8], [3, 0.9, 1], clamp)}) rotate(-6deg)`, background: C.yellow, border: `10px solid ${C.ink}`, borderRadius: 140, width: 240, height: 240, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Punch size={130} color={C.ink} split={3}>VS</Punch></div></AbsoluteFill>}
      {veredito && f >= verdictAt && <div style={{ position: 'absolute', top: 40, width: '100%', textAlign: 'center', transform: `scale(${pop(f, verdictAt)})` }}><span style={{ fontFamily: ANTON, fontSize: 80, background: '#fff', color: C.ink, border: `7px solid ${C.ink}`, padding: '4px 30px', boxShadow: `10px 10px 0 ${C.ink}` }}>{veredito}</span></div>}
    </AbsoluteFill>
  );
};

/** Encerramento: nome do canal letra a letra, Nox trocando de expressão, balão com pergunta e botão. */
export const Cta: React.FC<Base & { titulo?: string; pergunta: string; botao?: string; tom?: string }> = ({ len, titulo = 'DIAZVERSO', pergunta, botao = 'RESPONDE NOS COMENTÁRIOS ↓', tom }) => {
  const f = useCurrentFrame();
  const letters = titulo.split('');
  const moods: Mood[] = ['surpreso', 'feliz', 'determinado', 'piscada', 'feliz'];
  return (
    <AbsoluteFill style={{ transform: shake(f, [0], 20) }}>
      <SpeedBurst bg={color(tom, C.red)} color="rgba(11,11,16,.35)" />
      <Nox mood={moods[Math.min(moods.length - 1, Math.floor(f / Math.max(10, len / moods.length)))]} height={760} x={110} y={interpolate(f, [0, 10], [1100, 300], { ...clamp, easing: ease })} tilt={Math.sin(f / 10) * 3} />
      <div style={{ position: 'absolute', left: 760, top: 200, display: 'flex' }}>
        {letters.map((l, i) => <div key={i} style={{ transform: `translateY(${(1 - slide(f, 6 + i * 2, 8)) * -300}px) rotate(${(random(`l${i}`) - 0.5) * 8}deg)`, opacity: f >= 6 + i * 2 ? 1 : 0 }}><Punch size={Math.min(190, 1800 / Math.max(6, letters.length))} color="#fff" split={5}>{l === ' ' ? ' ' : l}</Punch></div>)}
      </div>
      {f >= Math.min(40, len * 0.25) && <div style={{ position: 'absolute', left: 770, top: 460, width: 1060, transform: `scale(${pop(f, Math.min(40, len * 0.25)) * (1 + Math.sin(f / 8) * 0.015)}) rotate(${-1 + Math.sin(f / 13)}deg)`, transformOrigin: 'left' }}>
        <div style={{ background: '#fff', border: `8px solid ${C.ink}`, borderRadius: 40, padding: '30px 40px', boxShadow: `12px 12px 0 ${C.ink}`, fontFamily: ROUND, fontWeight: 900, fontSize: 52, color: C.ink }}>{pergunta}</div>
        <div style={{ width: 0, height: 0, marginLeft: 80, borderLeft: '40px solid transparent', borderRight: '10px solid transparent', borderTop: `60px solid ${C.ink}` }} />
      </div>}
      {f >= Math.min(90, len * 0.5) && <div style={{ position: 'absolute', left: 780, top: 800, transform: `scale(${pop(f, Math.min(90, len * 0.5))})`, fontFamily: ANTON, fontSize: 60, color: C.ink, background: C.yellow, border: `6px solid ${C.ink}`, padding: '6px 28px', boxShadow: `8px 8px 0 ${C.ink}` }}>{botao}</div>}
    </AbsoluteFill>
  );
};

/** Catálogo das cenas (nome usado no roteiro em beats → componente). */
export const SCENES: Record<string, React.FC<any>> = { titulo: Titulo, frase: Frase, nox: NoxCena, evidencia: Evidencia, pagina: Pagina, numero: Numero, ficha: Ficha, formula: Formula, lista: Lista, comparacao: Comparacao, cta: Cta };
