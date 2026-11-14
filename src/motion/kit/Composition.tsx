import React from 'react';
import { AbsoluteFill, Audio, Composition, Sequence, staticFile, useCurrentFrame, CalculateMetadataFunction } from 'remotion';
import { ANTON, C, Film, Flash, resolvePublic, useAnton } from './fx';
import { Thumbnail, calculateThumb } from './Thumbnail';
import { SCENES_3D } from './three';
import { Extra, Extras } from './overlays';
import { Character, PersonagemCtx } from './Personagem';
import { Asset, Assets, SCENES } from './scenes';
import { TelaFinal } from './telafinal';
import { narrationSegments, narrationToVideo, pauseWindows } from './pausas.js';

/**
 * Composição única do roteiro em beats (contrato `contentlab-motion-v1`).
 * Tempos em segundos; o editor resolve `media:<id>` em `assets` (caminhos da pasta pública).
 */
export type Beat = { id: string; scene: string; at: number; duration: number; props?: Record<string, unknown>; sfx?: Array<{ name: string; at?: number; volume?: number }>; flash?: boolean; legenda?: boolean; extras?: Extra[] };
export type Word = { start: number; end: number; text: string };
export type MotionProps = {
  plan: { fps: number; width: number; height: number; duration: number; beats: Beat[]; captions?: boolean; musicVolume?: number; duck?: number; pausas?: Array<{ em: number; duracao: number }>; musicPause?: number; musicFade?: number; musicStart?: number; musicParts?: Array<{ at: number; inicio?: number; duracao?: number }> };
  assets: Record<string, Asset>;
  narration?: string | null; music?: string | null; words?: Word[];
  /** Personagem do projeto: arquivo da pose → PNG pronto (`pose` = nome sem o sufixo da variante) e os tons de cada pose. */
  personagem?: Character;
};

const NO_CAPTION = new Set(['titulo', 'cta', 'telafinal']);
const ALL_SCENES: Record<string, React.FC<any>> = { ...SCENES, ...SCENES_3D, telafinal: TelaFinal };

/** Legenda palavra a palavra: blocos de até 3 palavras; a palavra falada fica amarela. */
const Captions: React.FC<{ words: Word[]; fps: number; hidden: (t: number) => boolean; vertical?: boolean }> = ({ words, fps, hidden, vertical }) => {
  const t = useCurrentFrame() / fps;
  if (hidden(t)) return null;
  const blocks: Word[][] = []; let block: Word[] = [];
  for (const word of words) {
    const length = block.reduce((sum, item) => sum + item.text.length + 1, 0) + word.text.length;
    if (block.length && (block.length >= 3 || length > 18 || word.start - block[block.length - 1].end > 0.6)) { blocks.push(block); block = []; }
    block.push(word);
    if (/[.!?…,;:]$/.test(word.text)) { blocks.push(block); block = []; }
  }
  if (block.length) blocks.push(block);
  const current = blocks.find((b, i) => t >= b[0].start - 0.05 && t < (blocks[i + 1]?.[0].start ?? b[b.length - 1].end + 0.4));
  if (!current) return null;
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: vertical ? '24%' : 70, pointerEvents: 'none' }}>
      <div style={{ fontFamily: ANTON, fontSize: vertical ? 78 : 66, background: 'rgba(11,11,16,.88)', padding: '4px 26px', borderRadius: 10, boxShadow: `6px 6px 0 ${C.red}`, textTransform: 'uppercase', letterSpacing: 1 }}>
        {current.map((w, i) => <span key={i} style={{ color: t >= w.start && t < w.end + 0.1 ? C.yellow : '#fff' }}>{w.text}{i < current.length - 1 ? ' ' : ''}</span>)}
      </div>
    </AbsoluteFill>
  );
};


export const MotionVideo: React.FC<MotionProps> = (raw) => {
  useAnton();
  const { plan, assets, narration, music, words: spoken = [], personagem = { poses: {} } } = resolvePublic(raw) as MotionProps;
  const { fps, beats } = plan;
  const frames = (s: number) => Math.max(0, Math.round(s * fps));
  // Pausas na narração (trechos com o áudio original da obra): a voz e as palavras andam para frente no vídeo.
  const pausas = plan.pausas || [];
  const words = pausas.length ? spoken.map(w => ({ ...w, start: narrationToVideo(w.start, pausas), end: narrationToVideo(w.end, pausas) })) : spoken;
  const holes = pauseWindows(pausas);
  const speaking = (t: number) => words.some(w => t >= w.start - 0.15 && t <= w.end + 0.25);
  const inHole = (t: number) => holes.some(h => t >= h.start - 0.2 && t < h.end + 0.2);
  const duck = plan.duck ?? 0.25; const base = plan.musicVolume ?? 0.5; const pauseLevel = plan.musicPause ?? 0.12;
  const fadeOut = plan.musicFade ?? 3;
  const musicVolume = (f: number) => {
    const t = f / fps;
    const level = inHole(t) ? pauseLevel : words.length && speaking(t) ? duck : 1;
    const tail = fadeOut > 0 ? Math.min(1, Math.max(0, (plan.duration - t) / fadeOut)) : 1;
    return base * level * tail;
  };
  const captionHidden = (t: number) => beats.some(b => b.legenda === false || NO_CAPTION.has(b.scene) ? t >= b.at && t < b.at + b.duration && (b.legenda !== true) : false);
  return (
    <Assets.Provider value={assets}>
      <PersonagemCtx.Provider value={personagem}>
      <AbsoluteFill style={{ background: '#000' }}>
        {beats.map(beat => {
          const Scene = ALL_SCENES[beat.scene];
          const len = Math.max(1, frames(beat.duration));
          return Scene ? <Sequence key={beat.id} from={frames(beat.at)} durationInFrames={len}><Scene len={len} {...(beat.props || {})} />{beat.extras?.length ? <Extras extras={beat.extras} fps={fps} beatLen={len} /> : null}</Sequence> : null;
        })}
        {beats.filter(b => b.flash !== false && b.at > 0).map(b => <Flash key={`f${b.id}`} at={frames(b.at)} length={5} />)}
        <Film />
        {plan.captions !== false && words.length > 0 && <Captions words={words} fps={fps} hidden={captionHidden} vertical={plan.height > plan.width} />}
        {narration && narrationSegments(pausas).map(seg => (
          <Sequence key={`voz-${seg.from}`} from={frames(seg.at)} durationInFrames={seg.to === null ? undefined : Math.max(1, frames(seg.to - seg.from))}><Audio src={narration} trimBefore={frames(seg.from)} /></Sequence>
        ))}
        {music && !plan.musicParts?.length && <Audio src={music} loop trimBefore={frames(plan.musicStart || 0)} volume={musicVolume} />}
        {music && (plan.musicParts || []).map((part, i, parts) => {
          const end = part.duracao ? part.at + part.duracao : parts[i + 1]?.at ?? plan.duration;
          return <Sequence key={`trilha-${i}`} from={frames(part.at)} durationInFrames={Math.max(1, frames(end - part.at))}><Audio src={music} trimBefore={frames(part.inicio || 0)} volume={f => musicVolume(f + frames(part.at))} /></Sequence>;
        })}
        {beats.flatMap(beat => (beat.sfx || []).map((cue, i) => (
          <Sequence key={`${beat.id}-${i}`} from={frames(beat.at + (cue.at || 0))} durationInFrames={frames(3)}><Audio src={staticFile(`sfx/${cue.name}.wav`)} volume={cue.volume ?? 0.5} /></Sequence>
        )))}
      </AbsoluteFill>
      </PersonagemCtx.Provider>
    </Assets.Provider>
  );
};

const calculateMetadata: CalculateMetadataFunction<MotionProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.ceil(props.plan.duration * props.plan.fps)), fps: props.plan.fps, width: props.plan.width, height: props.plan.height,
});

export const Root: React.FC = () => (
  <>
    <Composition id="KitMotion" component={MotionVideo} calculateMetadata={calculateMetadata} durationInFrames={1} fps={30} width={1920} height={1080}
      defaultProps={{ plan: { fps: 30, width: 1920, height: 1080, duration: 3, beats: [{ id: 'b1', scene: 'titulo', at: 0, duration: 3, props: { palavras: ['CONTENT LAB'] } }] }, assets: {} }} />
    <Composition id="KitThumb" component={Thumbnail} calculateMetadata={calculateThumb} durationInFrames={1} fps={30} width={1280} height={720}
      defaultProps={{ assets: {}, texto: 'O HERÓI *CHATO*' }} />
  </>
);
