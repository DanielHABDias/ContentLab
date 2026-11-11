export type Keyframe = {t: number; easing?: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out'; x?: number; y?: number; scale?: number; rotation?: number; opacity?: number};
export type Motion = {enter?: string; exit?: string; idle?: string; enterDuration?: number; exitDuration?: number};
export type Element = {
  id: string; type: string; start: number; end: number; z: number;
  region: [number, number, number, number]; src?: string; fontSrc?: string; fontFamily?: string;
  data: Record<string, any> & {text?: string; style?: string; fit?: string; loop?: boolean; fontScale?: number; transform?: Record<string, number>; keyframes?: Keyframe[]; animation?: Motion; reveal?: {delay?: number; charactersPerSecond: number}};
};
export type Word = {word: string; start: number; end: number};
export type SceneProps = {
  width: number; height: number; fps: number; durationInFrames: number;
  scene: {id: string; start: number; end: number; background: {color?: string; fit?: string; loop?: boolean}; backgroundSrc?: string; camera: {keyframes?: Keyframe[]; shake?: Array<{start: number; end: number; amplitude?: number; frequency?: number}>}; elements: Element[]};
  words: Word[];
};
