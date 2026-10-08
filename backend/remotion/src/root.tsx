import {Composition} from 'remotion';
import {Scene} from './scene';
import type {SceneProps} from './types';

const sample: SceneProps = {
  width: 1920, height: 1080, fps: 30, durationInFrames: 90,
  scene: {id: 'sample', start: 0, end: 3, background: {color: '#151515'}, camera: {}, elements: []},
  words: [],
};

export const Root = () => <Composition
  id="Scene"
  component={Scene}
  width={1920}
  height={1080}
  fps={30}
  durationInFrames={90}
  defaultProps={sample}
  calculateMetadata={({props}) => ({
    width: props.width,
    height: props.height,
    fps: props.fps,
    durationInFrames: props.durationInFrames,
  })}
/>;
