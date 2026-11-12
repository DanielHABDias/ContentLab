import React, { useContext } from 'react';
import { Img, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, C } from './fx';
import { boil } from './Nox';
import { Assets } from './scenes';

/**
 * Elementos por cima de qualquer cena (`extras` do beat), com tempos em segundos relativos ao beat:
 * - caixinha: lembrete HQ que não precisa ser falado (inscreva-se, like, sininho, opinião, spoiler, fonte, livre);
 * - recorte: PNG de algo que está sendo falado (objeto, personagem recortado) que estala na tela em stop motion.
 */
export type Extra =
  | { tipo: 'caixinha'; preset?: keyof typeof PRESETS; texto?: string; canto?: 'superior-esquerdo' | 'superior-direito' | 'inferior-esquerdo' | 'inferior-direito'; at?: number; duracao?: number }
  | { tipo: 'recorte'; midia: string; lado?: 'esquerda' | 'direita' | 'centro'; tamanho?: number; at?: number; duracao?: number; giro?: number };

export const PRESETS = {
  inscricao: { text: 'INSCREVA-SE', box: '#E62F3F', color: '#FFFFFF', icon: 'youtube' },
  like: { text: 'DEIXA O LIKE', box: '#236CE5', color: '#FFFFFF', icon: 'like' },
  sininho: { text: 'ATIVA O SININHO', box: '#F4C542', color: '#080A11', icon: 'sino' },
  opiniao: { text: 'MINHA OPINIÃO, TÁ?', box: '#FFFFFF', color: '#080A11', icon: 'balao' },
  spoiler: { text: 'ALERTA DE SPOILER', box: '#080A11', color: '#F4C542', icon: 'alerta' },
  fonte: { text: 'FONTE', box: '#F2E8D5', color: '#080A11', icon: 'livro' },
  comenta: { text: 'COMENTA AÍ', box: '#3DDC84', color: '#080A11', icon: 'balao' },
  livre: { text: '', box: '#FFFFFF', color: '#080A11', icon: 'none' },
} as const;

const Glyph: React.FC<{ name: string; color: string; size: number }> = ({ name, color, size }) => {
  const s = { stroke: C.ink, strokeWidth: 8, strokeLinejoin: 'round' as const };
  const body = (() => {
    switch (name) {
      case 'youtube': return <><rect x={14} y={40} width={172} height={120} rx={36} fill="#fff" {...s} /><polygon points="84,72 84,128 134,100" fill="#E62F3F" {...s} strokeWidth={6} /></>;
      case 'like': return <path d="M40 92 L72 92 L72 170 L40 170 Z M80 168 L150 168 C164 168 172 156 170 144 L178 104 C180 92 172 82 160 82 L118 82 L124 50 C128 30 106 22 98 40 L80 86 Z" fill="#fff" {...s} />;
      case 'sino': return <><path d="M100 30 C66 30 54 60 54 92 L54 126 L36 150 L164 150 L146 126 L146 92 C146 60 134 30 100 30 Z" fill="#fff" {...s} /><circle cx={100} cy={164} r={14} fill="#fff" {...s} /></>;
      case 'balao': return <path d="M30 40 L170 40 C180 40 186 46 186 56 L186 130 C186 140 180 146 170 146 L90 146 L56 176 L60 146 L30 146 C20 146 14 140 14 130 L14 56 C14 46 20 40 30 40 Z" fill="#fff" {...s} />;
      case 'alerta': return <><polygon points="100,22 186,172 14,172" fill="#F4C542" {...s} /><text x={100} y={156} textAnchor="middle" fontFamily={ANTON} fontSize={100} fill={C.ink}>!</text></>;
      case 'livro': return <path d="M20 46 C60 30 90 40 100 54 C110 40 140 30 180 46 L180 166 C140 150 110 160 100 172 C90 160 60 150 20 166 Z M100 54 L100 172" fill="#fff" {...s} />;
      default: return null;
    }
  })();
  return body ? <svg viewBox="0 0 200 200" width={size} height={size} style={{ flexShrink: 0 }}>{body}</svg> : null;
};

/** Caixinha HQ: entra de lado num estalo, fica para leitura, faz o gesto (clique, sininho) e sai. */
const Caixinha: React.FC<{ extra: Extract<Extra, { tipo: 'caixinha' }>; local: number; len: number }> = ({ extra, local, len }) => {
  const { width: W, height: H } = useVideoConfig(); const V = H > W;
  const preset = PRESETS[extra.preset || 'inscricao'] || PRESETS.livre;
  const text = extra.texto || preset.text;
  const corner = extra.canto || (V ? 'superior-direito' : 'inferior-direito');
  const right = corner.endsWith('direito'); const topSide = corner.startsWith('superior');
  // Stop motion: fora → meio → dentro em dois quadros; saída igual.
  const slideIn = local < 1 ? 1 : local < 2 ? 0.4 : local >= len - 2 ? (local >= len - 1 ? 1 : 0.4) : 0;
  const click = preset.icon === 'youtube' || preset.icon === 'like' ? (local > len * 0.5 && local < len * 0.5 + 4 ? 0.88 : 1) : 1;
  const ring = preset.icon === 'sino' && local > len * 0.45 && local < len * 0.75 ? Math.sin(local * 1.6) * 10 : 0;
  const size = V ? 64 : 54;
  const style: React.CSSProperties = { position: 'absolute', [right ? 'right' : 'left']: V ? 50 : 60, [topSide ? 'top' : 'bottom']: V ? H * 0.06 : 60, transform: `translateX(${(right ? 1 : -1) * slideIn * 900}px) scale(${click}) rotate(${ring + (right ? -2 : 2)}deg)`, transformOrigin: right ? 'right center' : 'left center' };
  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: preset.box, color: preset.color, border: `7px solid ${C.ink}`, boxShadow: `10px 10px 0 ${C.ink}`, padding: '10px 24px', fontFamily: ANTON, fontSize: size, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        <Glyph name={preset.icon} color={preset.color} size={size * 1.3} />{text}
      </div>
      {click < 1 && <svg viewBox="0 0 40 60" width={70} height={100} style={{ position: 'absolute', right: 30, bottom: -60 }}><polygon points="4,4 4,48 16,38 24,56 32,52 24,34 38,34" fill="#fff" stroke={C.ink} strokeWidth={4} /></svg>}
    </div>
  );
};

/** Recorte PNG: estala na tela (sem animação contínua), treme como stop motion e some de uma vez. */
const Recorte: React.FC<{ extra: Extract<Extra, { tipo: 'recorte' }>; local: number; len: number; index: number }> = ({ extra, local, len, index }) => {
  const { width: W, height: H } = useVideoConfig(); const V = H > W;
  const assets = useContext(Assets);
  const id = extra.midia.replace(/^media:/, ''); const asset = assets[id];
  if (!asset || local >= len) return null;
  const b = boil(local, `rec${index}`, 3, 1.2);
  const h = (extra.tamanho || (V ? 0.3 : 0.45)) * H;
  const lado = extra.lado || (index % 2 ? 'esquerda' : 'direita');
  const x = lado === 'centro' ? W / 2 : lado === 'esquerda' ? W * (V ? 0.3 : 0.2) : W * (V ? 0.7 : 0.8);
  const y = V ? H * 0.42 : H * 0.5;
  const pop = local < 1 ? 1.3 : local < 2 ? 0.92 : 1;
  const giro = (extra.giro ?? (random(`g${index}`) - 0.5) * 14) + b.r;
  return <Img src={asset.src} style={{ position: 'absolute', left: x + b.x, top: y + b.y, height: h, width: 'auto', transform: `translate(-50%, -50%) scale(${pop}) rotate(${giro}deg)`, filter: 'drop-shadow(10px 10px 0 rgba(11,11,16,.9)) drop-shadow(0 0 2px #000)' }} />;
};

/** Desenha os extras de um beat. `frame` é o quadro dentro do beat. */
export const Extras: React.FC<{ extras: Extra[]; fps: number; beatLen: number }> = ({ extras, fps, beatLen }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {extras.map((extra, i) => {
        const start = Math.round((extra.at || 0) * fps);
        const len = Math.max(4, Math.round((extra.duracao || (extra.tipo === 'caixinha' ? 3 : beatLen / fps)) * fps));
        const local = frame - start;
        if (local < 0 || local >= len) return null;
        return extra.tipo === 'caixinha' ? <Caixinha key={i} extra={extra} local={local} len={len} /> : <Recorte key={i} extra={extra} local={local} len={len} index={i} />;
      })}
    </>
  );
};
