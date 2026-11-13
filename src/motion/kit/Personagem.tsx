import React, { createContext, useContext } from 'react';
import { Img, random, useCurrentFrame } from 'remotion';

/**
 * Personagem do projeto (pacote importado com `character_import`): cada pose é um PNG pronto, com o gesto
 * e a expressão já desenhados. `<pose>-b.png`, `-c`… (ou `-2`, `-3`…) são variantes sorteadas da mesma pose.
 * O kit não desenha olhos nem expressões: escolhe a pose pelo nome ou pelo humor (tom da fala).
 * Sem personagem no projeto, nada aparece.
 */
export type Mood = 'bravo' | 'feliz' | 'surpreso' | 'tedio' | 'confuso' | 'piscada' | 'determinado' | 'triste';
export type PoseInfo = { src: string; w: number; h: number; pose?: string };
export type Character = { poses: Record<string, string | PoseInfo>; tons?: Record<string, string[]> };
export const PersonagemCtx = createContext<Character>({ poses: {} });
export const useHasPersonagem = () => Object.keys(useContext(PersonagemCtx).poses || {}).length > 0;

/** Humor → tons do catálogo de poses (a pose do personagem é escolhida por tom). */
const HUMOR_TONS: Record<string, string[]> = {
  feliz: ['aprovacao', 'vitoria', 'abertura', 'piada'], bravo: ['discordancia', 'erro', 'opiniao'], surpreso: ['surpresa', 'pergunta'],
  tedio: ['erro', 'ressalva', 'base'], confuso: ['pergunta', 'ressalva'], piscada: ['piada', 'opiniao'],
  determinado: ['enfase', 'opiniao', 'explicacao', 'descoberta'], triste: ['tristeza', 'erro'],
};
/** Proporção de referência (largura/altura) para diagramar a área do personagem nas cenas. */
export const FIG_RATIO = 0.62;
export const figW = (h: number) => h * FIG_RATIO;

/** Tremidinha de stop motion: a cada `hold` frames a figura "reassenta" alguns pixels e graus. */
export const boil = (frame: number, seed: string, hold = 3, amount = 1) => {
  const k = Math.floor(frame / hold);
  return { x: (random(`${seed}x${k}`) - 0.5) * 8 * amount, y: (random(`${seed}y${k}`) - 0.5) * 6 * amount, r: (random(`${seed}r${k}`) - 0.5) * 2.4 * amount };
};

const info = (value: string | PoseInfo, name: string): PoseInfo => (typeof value === 'string' ? { src: value, w: 0, h: 0, pose: name } : { ...value, pose: value.pose || name });

/** PNG da pose: pelo nome; senão por humor (tons); senão "parado" ou a primeira. Variantes sorteadas por `seed`. */
export const choosePose = (character: Character, { pose, humor, seed = 'personagem' }: { pose?: string; humor?: string; seed?: string }): PoseInfo | null => {
  const files = Object.entries(character.poses || {}).map(([name, value]) => info(value, name.replace(/-(\d+|[a-z])$/, '')));
  if (!files.length) return null;
  const names = [...new Set(files.map(item => item.pose as string))];
  const wanted = humor ? HUMOR_TONS[humor] || [humor] : [];
  const byTone = names.filter(name => (character.tons?.[name] || []).some(tone => wanted.includes(tone)));
  const name = (pose && names.includes(pose) ? pose : null)
    || (byTone.length ? byTone[Math.floor(random(`${seed}${humor}`) * byTone.length)] : null)
    || (names.includes('parado') ? 'parado' : names[0]);
  const options = files.filter(item => item.pose === name);
  return options[Math.floor(random(`${seed}${name}`) * options.length)] || null;
};

/** Personagem numa pose, ancorado pela base (cx = centro, bottom = linha dos pés na tela), com tremidinha de stop motion. */
export const PersonagemPose: React.FC<{ pose?: string; humor?: string; height: number; cx: number; bottom: number; flip?: boolean; tilt?: number; seed?: string }> = ({ pose, humor, height, cx, bottom, flip = false, tilt = 0, seed = 'personagem' }) => {
  const frame = useCurrentFrame();
  const chosen = choosePose(useContext(PersonagemCtx), { pose, humor, seed });
  if (!chosen) return null;
  const b = boil(frame, seed);
  const width = chosen.w && chosen.h ? (height * chosen.w) / chosen.h : 'auto';
  return <Img src={chosen.src} style={{ position: 'absolute', left: cx + b.x, top: bottom - height + b.y, height, width, transform: `translateX(-50%) scaleX(${flip ? -1 : 1}) rotate(${tilt + b.r}deg)`, transformOrigin: '50% 100%' }} />;
};

/**
 * Personagem numa caixa (x, y = canto superior esquerdo; largura `figW(height)`), com a figura apoiada na base
 * e centrada. Para as cenas que reagem com humor: respiração leve, inclinação e "squash" de entrada.
 */
export const Figura: React.FC<{ pose?: string; humor?: string; height: number; x: number; y: number; flip?: boolean; tilt?: number; squash?: number; seed?: string; style?: React.CSSProperties }> = ({ pose, humor, height, x, y, flip = false, tilt = 0, squash = 0, seed = 'figura', style }) => {
  const frame = useCurrentFrame();
  const chosen = choosePose(useContext(PersonagemCtx), { pose, humor, seed });
  if (!chosen) return null;
  const breathe = Math.sin(frame / 9) * 0.012;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: figW(height), height, transform: `scaleX(${flip ? -1 : 1}) rotate(${tilt}deg) scale(${1 + squash}, ${1 - squash + breathe})`, transformOrigin: '50% 100%', ...style }}>
      <Img src={chosen.src} style={{ position: 'absolute', left: '50%', bottom: 0, height: '100%', width: 'auto', maxWidth: 'none', transform: 'translateX(-50%)' }} />
    </div>
  );
};
