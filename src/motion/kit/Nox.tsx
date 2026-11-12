import React, { createContext, useContext } from 'react';
import { Img, interpolate, random, staticFile, useCurrentFrame } from 'remotion';
import { C } from './fx';

/**
 * Nox com expressões: corpo e capuz vêm do Nox canônico (variante só sem os olhos, `nox-sem-olhos.png`),
 * e os olhos amarelos são redesenhados por expressão, na mesma posição, cor e brilho do original.
 * Coordenadas no espaço da imagem original (1408×768).
 */
export type Mood = 'bravo' | 'feliz' | 'surpreso' | 'tedio' | 'confuso' | 'piscada' | 'determinado' | 'triste';

const L = { x: 684, y: 252 }; const R = { x: 788, y: 242 };

const Eye: React.FC<{ cx: number; cy: number; mood: Mood; side: 'L' | 'R'; blink: number; look: number }> = ({ cx, cy, mood, side, blink, look }) => {
  const s = side === 'L' ? 1 : -1; // espelha formas inclinadas
  const x = cx + look * 8; const y = cy;
  const glow = { filter: `drop-shadow(0 0 10px ${C.eye}) drop-shadow(0 0 22px rgba(252,223,67,.55))` };
  const fill = C.eye;
  const sy = Math.max(0.08, 1 - blink); // fechar o olho achatando na vertical
  const g = (child: React.ReactNode) => <g style={glow} transform={`translate(${x} ${y}) scale(1 ${sy}) translate(${-x} ${-y})`}>{child}</g>;
  const w = side === 'L' ? 40 : 30; const h = side === 'L' ? 32 : 30;
  switch (mood) {
    case 'feliz': // arcos "^ ^"
      return g(<path d={`M ${x - w} ${y + 10} Q ${x} ${y - h * 1.3} ${x + w} ${y + 10}`} stroke={fill} strokeWidth={16} strokeLinecap="round" fill="none" />);
    case 'piscada':
      return side === 'R' ? g(<path d={`M ${x - w} ${y} L ${x + w} ${y + 4}`} stroke={fill} strokeWidth={14} strokeLinecap="round" />) : g(<ellipse cx={x} cy={y} rx={w} ry={h} fill={fill} />);
    case 'surpreso':
      return g(<ellipse cx={x} cy={y - 4} rx={w * 0.95} ry={h * 1.35} fill={fill} />);
    case 'tedio': // pálpebra reta caída
      return g(<path d={`M ${x - w} ${y + 2} L ${x + w} ${y + 2} Q ${x + w} ${y + h * 0.9} ${x} ${y + h * 0.9} Q ${x - w} ${y + h * 0.9} ${x - w} ${y + 2} Z`} fill={fill} />);
    case 'triste':
      return g(<path d={`M ${x - w} ${y - 2 - s * 10} L ${x + w} ${y - 2 + s * 10} Q ${x + w} ${y + h} ${x} ${y + h} Q ${x - w} ${y + h} ${x - w} ${y - 2 - s * 10} Z`} fill={fill} />);
    case 'confuso':
      return side === 'L' ? g(<ellipse cx={x} cy={y} rx={w * 0.95} ry={h * 1.2} fill={fill} />) : g(<path d={`M ${x - w} ${y + 6} L ${x + w} ${y - 4} Q ${x + w} ${y + h * 0.8} ${x} ${y + h * 0.8} Q ${x - w} ${y + h * 0.8} ${x - w} ${y + 6} Z`} fill={fill} />);
    case 'determinado':
      return g(<path d={`M ${x - w} ${y - h * 0.5 + s * 14} L ${x + w} ${y - h * 0.5 - s * 14} Q ${x + w + 4} ${y + h} ${x} ${y + h} Q ${x - w - 4} ${y + h} ${x - w} ${y - h * 0.5 + s * 14} Z`} fill={fill} />);
    case 'bravo':
    default: // forma do original: topo inclinado para o centro, base arredondada
      return g(<path d={`M ${x - w} ${y - h * 0.7 + (s > 0 ? 0 : 18)} L ${x + w} ${y - h * 0.7 + (s > 0 ? 18 : 0)} Q ${x + w + 6} ${y + h} ${x} ${y + h} Q ${x - w - 6} ${y + h} ${x - w} ${y - h * 0.7 + (s > 0 ? 0 : 18)} Z`} fill={fill} />);
  }
};

/** Nox recortado (só a figura) com expressão, piscar periódico, respiração e olhar. */
export const Nox: React.FC<{ mood: Mood; height: number; x: number; y: number; flip?: boolean; look?: number; blinkEvery?: number; tilt?: number; squash?: number; style?: React.CSSProperties }> = ({ mood, height, x, y, flip = false, look = 0, blinkEvery = 70, tilt = 0, squash = 0, style }) => {
  const frame = useCurrentFrame();
  // A figura ocupa x 508–920, y 53–722 na imagem original.
  const crop = { x: 508, y: 53, w: 412, h: 669 };
  const scale = height / crop.h;
  const phase = frame % blinkEvery;
  const blink = mood === 'piscada' || mood === 'feliz' ? 0 : interpolate(phase, [0, 2, 4, 6], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const breathe = Math.sin(frame / 9) * 0.012;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: crop.w * scale, height: crop.h * scale, transform: `scaleX(${flip ? -1 : 1}) rotate(${tilt}deg) scale(${1 + squash}, ${1 - squash + breathe})`, transformOrigin: '50% 100%', ...style }}>
      <Img src={staticFile('brand/nox-sem-olhos.png')} style={{ position: 'absolute', left: -crop.x * scale, top: -crop.y * scale, width: 1408 * scale, height: 768 * scale, maxWidth: 'none' }} />
      <svg viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <Eye cx={L.x} cy={L.y} mood={mood} side="L" blink={blink} look={look} />
        <Eye cx={R.x} cy={R.y} mood={mood} side="R" blink={blink} look={look} />
      </svg>
    </div>
  );
};


/**
 * Poses do Nox (stop motion): PNGs desenhados a partir do canônico, cada um com um gesto e a expressão
 * dos olhos já desenhada (mão na frente do rosto pensando, arminha, apontando, dando de ombros…).
 * Ficam em `assets/brand/nox/poses/<pose>.png` (fundo transparente, figura inteira recortada rente,
 * pés na base). O editor entrega o mapa pose → arquivo por este contexto.
 */
export const NoxPoses = createContext<Record<string, string>>({});
export const POSES = ['pensando', 'arminha', 'apontando', 'ombros', 'joinha', 'facepalm', 'bracos-cruzados', 'acenando', 'rindo', 'assustado', 'comemorando', 'explicando'] as const;
export type Pose = typeof POSES[number] | 'parado';

/** Tremidinha de stop motion: a cada `hold` frames a figura "reassenta" alguns pixels e graus. */
export const boil = (frame: number, seed: string, hold = 3, amount = 1) => {
  const k = Math.floor(frame / hold);
  return { x: (random(`${seed}x${k}`) - 0.5) * 8 * amount, y: (random(`${seed}y${k}`) - 0.5) * 6 * amount, r: (random(`${seed}r${k}`) - 0.5) * 2.4 * amount };
};

/**
 * Nox numa pose, ancorado pela base (x = centro, bottom = linha dos pés na tela). Sem o PNG da pose,
 * usa o Nox canônico com a expressão `mood` e uma inclinação própria da pose, para o vídeo nunca quebrar.
 */
export const NoxPose: React.FC<{ pose?: Pose | string; mood?: Mood; height: number; cx: number; bottom: number; flip?: boolean; tilt?: number; seed?: string }> = ({ pose = 'parado', mood = 'feliz', height, cx, bottom, flip = false, tilt = 0, seed = 'nox' }) => {
  const frame = useCurrentFrame();
  const poses = useContext(NoxPoses);
  const b = boil(frame, seed);
  const src = pose && pose !== 'parado' ? poses[pose] : undefined;
  const lean: Record<string, number> = { pensando: -6, apontando: 5, ombros: 0, facepalm: -8, assustado: 4, comemorando: -3, acenando: 4, arminha: 6, rindo: -4, joinha: 3, explicando: 2 };
  const angle = tilt + b.r + (src ? 0 : lean[pose] || 0);
  const box: React.CSSProperties = { position: 'absolute', left: cx + b.x, top: bottom - height + b.y, height, transform: `translateX(-50%) scaleX(${flip ? -1 : 1}) rotate(${angle}deg)`, transformOrigin: '50% 100%' };
  if (src) return <Img src={src} style={{ ...box, width: 'auto' }} />;
  const w = (height * 412) / 669;
  return <div style={{ ...box, width: w }}><Nox mood={mood} height={height} x={0} y={0} blinkEvery={100000} /></div>;
};
