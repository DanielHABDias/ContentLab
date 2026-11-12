import React from 'react';
import { AbsoluteFill, Audio, Composition, Sequence, staticFile, useCurrentFrame, CalculateMetadataFunction } from 'remotion';
import { ANTON, C, Film, Flash, useAnton } from './fx';
import { Asset, Assets, SCENES } from './scenes';

/**
 * Composição única do roteiro em beats (contrato `diazverso-motion-v1`).
 * Tempos em segundos; o editor resolve `media:<id>` em `assets` (caminhos da pasta pública).
 */
export type Beat = { id: string; scene: string; at: number; duration: number; props?: Record<string, unknown>; sfx?: Array<{ name: string; at?: number; volume?: number }>; flash?: boolean; legenda?: boolean };
export type Word = { start: number; end: number; text: string };
export type MotionProps = {
  plan: { fps: number; width: number; height: number; duration: number; beats: Beat[]; captions?: boolean; musicVolume?: number; duck?: number };
  assets: Record<string, Asset>;
  narration?: string | null; music?: string | null; words?: Word[];
};

const NO_CAPTION = new Set(['titulo', 'cta']);

/** Legenda palavra a palavra: blocos de até 3 palavras; a palavra falada fica amarela. */
const Captions: React.FC<{ words: Word[]; fps: number; hidden: (t: number) => boolean }> = ({ words, fps, hidden }) => {
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
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70, pointerEvents: 'none' }}>
      <div style={{ fontFamily: ANTON, fontSize: 66, background: 'rgba(11,11,16,.88)', padding: '4px 26px', borderRadius: 10, boxShadow: `6px 6px 0 ${C.red}`, textTransform: 'uppercase', letterSpacing: 1 }}>
        {current.map((w, i) => <span key={i} style={{ color: t >= w.start && t < w.end + 0.1 ? C.yellow : '#fff' }}>{w.text}{i < current.length - 1 ? ' ' : ''}</span>)}
      </div>
    </AbsoluteFill>
  );
};

/** Caminhos `public:<arquivo>` (pasta pública do editor) viram URLs do bundle via staticFile. */
const resolve = (value: unknown): any => typeof value === 'string' ? (value.startsWith('public:') ? staticFile(value.slice(7)) : value) : Array.isArray(value) ? value.map(resolve) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)])) : value;

export const MotionVideo: React.FC<MotionProps> = (raw) => {
  useAnton();
  const { plan, assets, narration, music, words = [] } = resolve(raw) as MotionProps;
  const { fps, beats } = plan;
  const frames = (s: number) => Math.max(0, Math.round(s * fps));
  const speaking = (t: number) => words.some(w => t >= w.start - 0.15 && t <= w.end + 0.25);
  const duck = plan.duck ?? 0.25; const base = plan.musicVolume ?? 0.5;
  const captionHidden = (t: number) => beats.some(b => b.legenda === false || NO_CAPTION.has(b.scene) ? t >= b.at && t < b.at + b.duration && (b.legenda !== true) : false);
  return (
    <Assets.Provider value={assets}>
      <AbsoluteFill style={{ background: '#000' }}>
        {beats.map(beat => {
          const Scene = SCENES[beat.scene];
          const len = Math.max(1, frames(beat.duration));
          return Scene ? <Sequence key={beat.id} from={frames(beat.at)} durationInFrames={len}><Scene len={len} {...(beat.props || {})} /></Sequence> : null;
        })}
        {beats.filter(b => b.flash !== false && b.at > 0).map(b => <Flash key={`f${b.id}`} at={frames(b.at)} length={5} />)}
        <Film />
        {plan.captions !== false && words.length > 0 && <Captions words={words} fps={fps} hidden={captionHidden} />}
        {narration && <Audio src={narration} />}
        {music && <Audio src={music} volume={f => base * (words.length && speaking(f / fps) ? duck : 1)} />}
        {beats.flatMap(beat => (beat.sfx || []).map((cue, i) => (
          <Sequence key={`${beat.id}-${i}`} from={frames(beat.at + (cue.at || 0))} durationInFrames={frames(3)}><Audio src={staticFile(`sfx/${cue.name}.wav`)} volume={cue.volume ?? 0.5} /></Sequence>
        )))}
      </AbsoluteFill>
    </Assets.Provider>
  );
};

const calculateMetadata: CalculateMetadataFunction<MotionProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.ceil(props.plan.duration * props.plan.fps)), fps: props.plan.fps, width: props.plan.width, height: props.plan.height,
});

export const Root: React.FC = () => (
  <Composition id="DiazversoMotion" component={MotionVideo} calculateMetadata={calculateMetadata} durationInFrames={1} fps={30} width={1920} height={1080}
    defaultProps={{ plan: { fps: 30, width: 1920, height: 1080, duration: 3, beats: [{ id: 'b1', scene: 'titulo', at: 0, duration: 3, props: { palavras: ['DIAZVERSO'] } }] }, assets: {} }} />
);
