import { Player, Thumbnail } from '@remotion/player';
import { AbsoluteFill } from 'remotion';
import shield from '../../assets/kit/graphics/escudo.svg?url';
import lamp from '../../assets/kit/graphics/lampada.svg?url';
import scale from '../../assets/kit/graphics/balanca.svg?url';
import mask from '../../assets/kit/graphics/mascara.svg?url';
import { NARRATIVE_SCENES } from '../motion/kit/narrative';
import { Assets, Background, SCENES } from '../motion/kit/scenes';
import { Film } from '../motion/kit/fx';
import { PersonagemCtx } from '../motion/kit/Personagem';
import { TelaFinal } from '../motion/kit/telafinal';

/** Prévias ao vivo do kit no navegador (@remotion/player): as mesmas cenas e fundos do render. */
const FPS = 30;
/** A tela final só monta a página com um personagem: na prévia, um gráfico neutro do kit faz esse papel. */
const DEMO_CHARACTER = { poses: { acenando: { src: mask, w: 1000, h: 1000 } } };

function SceneDemo({ scene, props, len }) {
  const Scene = scene === 'telafinal' ? TelaFinal : SCENES[scene];
  const demoAssets = { demo0: { src: shield, kind: 'image', w: 1000, h: 1000 }, demo1: { src: lamp, kind: 'image', w: 1000, h: 1000 }, demo2: { src: scale, kind: 'image', w: 1000, h: 1000 } };
  const demo = (value, index = 0, nested = false) => Array.isArray(value) ? value.map((item, i) => demo(item, i, true)) : value && typeof value === 'object' ? { ...Object.fromEntries(Object.entries(value).map(([key, item]) => [key, demo(item, index, true)])), ...(nested && 'titulo' in value ? { midia: `media:demo${index % 3}` } : {}) } : value;
  const input = NARRATIVE_SCENES[scene] ? { ...demo(props), ...(scene === 'lupaEvidencia' ? { midia: 'media:demo0' } : {}) } : props;
  const view = <Assets.Provider value={demoAssets}><AbsoluteFill style={{ background: '#000' }}>{Scene ? <Scene len={len} {...input}/> : null}<Film/></AbsoluteFill></Assets.Provider>;
  return scene === 'telafinal' ? <PersonagemCtx.Provider value={DEMO_CHARACTER}>{view}</PersonagemCtx.Provider> : view;
}

function BackgroundDemo({ kind, tint }) {
  return <AbsoluteFill><Background kind={kind} tint={tint}/></AbsoluteFill>;
}

export function ScenePlayer({ scene, props, vertical = false, seconds = 5 }) {
  const len = seconds * FPS;
  return <Player component={SceneDemo} inputProps={{ scene, props, len }} durationInFrames={len} fps={FPS}
    compositionWidth={vertical ? 1080 : 1920} compositionHeight={vertical ? 1920 : 1080}
    controls loop autoPlay muted clickToPlay style={{ width: '100%', aspectRatio: vertical ? '9 / 16' : '16 / 9', maxHeight: vertical ? 560 : undefined }}/>;
}

export function BackgroundPlayer({ kind, tint, playing = false }) {
  // A small documentation swatch does not need to calculate a full-HD canvas every frame.
  const props = { component: BackgroundDemo, inputProps: { kind, tint }, durationInFrames: 10 * FPS, fps: FPS,
    compositionWidth: 640, compositionHeight: 360, style: { width: '100%', aspectRatio: '16 / 9' } };
  return playing ? <Player {...props} loop autoPlay muted/> : <Thumbnail {...props} frameToDisplay={60}/>;
}
