// Frame-independent interpolation. Easing changes spatial velocity, never timing.
// "linear" remains an intentional explicit option in the edit-plan contract.
export const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
export function smoothstep5(value) {
  const p = clamp01(value);
  return p * p * p * (p * (p * 6 - 15) + 10);
}
export function easeMotion(value, easing = 'ease_in_out') {
  const p = clamp01(value);
  switch (easing) {
    case 'linear': return p;
    case 'ease_in': return p * p * p;
    case 'ease_out': return 1 - (1 - p) ** 3;
    default: return smoothstep5(p);
  }
}
// Do not impose a minimum 50/60ms or re-time user-specified motion.
export function motionDuration(configured, available) {
  const seconds = Number(configured);
  const window = Number(available);
  return Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0,
    Number.isFinite(window) ? window : 0));
}
export function motionProgress(elapsed, duration, easing = 'ease_in_out') {
  if (duration <= 0) return 1;
  return easeMotion(elapsed / duration, easing);
}
export function motionEnvelope(elapsed, total) {
  if (total <= 0 || elapsed < 0 || elapsed > total) return 0;
  const edge = Math.min(0.18, total / 4);
  return edge <= 0 ? 1 :
    smoothstep5(elapsed / edge) * smoothstep5((total - elapsed) / edge);
}
export const interpolate = (start, end, progress) => start + (end - start) * progress;
