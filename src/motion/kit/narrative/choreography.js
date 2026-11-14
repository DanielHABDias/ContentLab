import { Easing, interpolate, spring } from 'remotion';

export const clamp01 = value => Math.max(0, Math.min(1, value));
export const atFrame = (len, fraction) => Math.round(Math.max(1, len) * clamp01(fraction));
export const linear = (frame, len, at, span) => clamp01((frame - atFrame(len, at)) / Math.max(1, len * span));
export const ramp = Easing.inOut(Easing.cubic);

/** Entrance is independent of the actor's spatial transform (depth, tilt, choice, etc.). */
export function cardEntrance(frame, at, fps, mode = 'baixo', distance = 300) {
  const age = frame - at;
  const p = age < 0 ? 0 : spring({ frame: age, fps, config: { damping: 18, stiffness: 190, mass: .8 } });
  const dx = mode === 'esquerda' ? -distance : mode === 'direita' ? distance : 0;
  const dy = mode === 'baixo' ? distance : mode === 'cima' ? -distance : 0;
  return {
    opacity: clamp01(age / Math.max(1, fps * .06)),
    transform: `translate3d(${dx * (1-p)}px,${dy * (1-p)}px,0) rotate(${(mode === 'esquerda' ? -8 : mode === 'direita' ? 8 : 0) * (1-p)}deg) scale(${mode === 'profundidade' ? .35 + .65*p : .88 + .12*p})`,
    filter: `blur(${(1-clamp01(p))*7}px)`,
  };
}

/** First actual crossing, in frames, using the same value curve as Limiar. */
export function thresholdFrame({ len, from, to, limit }) {
  if (from === to || (limit-from)/(to-from) < 0 || (limit-from)/(to-from) > 1) return null;
  const target = (limit-from)/(to-from);
  let lo=0,hi=Math.max(0,len-1);
  if(ramp(linear(hi,len,.12,.58))<target)return null;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(ramp(linear(mid,len,.12,.58))>=target)hi=mid;else lo=mid+1;}
  return lo;
}
export function thresholdValue(frame, len, from, to) {
  return from + (to-from)*ramp(linear(frame,len,.12,.58));
}

/** Focus is measured in source-image coordinates, including contain letterboxing. */
export function containFocus(sourceW, sourceH, boxW, boxH, x, y) {
  const ratio = Math.min(boxW / (sourceW || boxW), boxH / (sourceH || boxH));
  const w = (sourceW || boxW)*ratio, h = (sourceH || boxH)*ratio;
  return { w, h, x: (boxW-w)/2+clamp01(x)*w, y: (boxH-h)/2+clamp01(y)*h };
}
