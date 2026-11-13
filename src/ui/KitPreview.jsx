import { Player } from '@remotion/player';
import { AbsoluteFill } from 'remotion';
import { Background, SCENES } from '../motion/kit/scenes';
import { Film } from '../motion/kit/fx';

/** Prévias ao vivo do kit no navegador (@remotion/player): as mesmas cenas e fundos do render. */
const FPS = 30;

function SceneDemo({ scene, props, len }) {
  const Scene = SCENES[scene];
  return <AbsoluteFill style={{ background: '#000' }}>{Scene ? <Scene len={len} {...props}/> : null}<Film/></AbsoluteFill>;
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

export function BackgroundPlayer({ kind, tint }) {
  return <Player component={BackgroundDemo} inputProps={{ kind, tint }} durationInFrames={10 * FPS} fps={FPS}
    compositionWidth={1920} compositionHeight={1080} loop autoPlay muted style={{ width: '100%', aspectRatio: '16 / 9' }}/>;
}
