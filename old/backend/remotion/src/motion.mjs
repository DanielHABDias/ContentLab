// Frame-deterministic interpolation used by text, camera, layers and motion presets.
// Shape controls smoothness, never the duration. Values are normalized to [0,1].
export const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export function smootherstep(value) {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}
export function ease(value, name = 'ease_in_out') {
  const t = clamp01(value);
  if (name === 'linear') return t; // Explicit linear retains its meaning.
  if (name === 'ease_in') return t * t * t;
  if (name === 'ease_out') return 1 - (1 - t) ** 3;
  return smootherstep(t); // Zero velocity and acceleration at both ends.
}
export function progress(elapsed, seconds, curve = 'ease_in_out') {
  if (!(seconds > 0)) return elapsed >= 0 ? 1 : 0;
  return ease(elapsed / seconds, curve);
}
export const lerp = (a, b, p) => a + (b - a) * p;
// Prevent idle oscillations from jumping on the very first/last frame.
// Do not change their cycle rate: only ramp their amplitude smoothly.
export function idleEnvelope(elapsed, total, ramp = 0.22) {
  if (!(total > 0) || elapsed <= 0 || elapsed >= total) return 0;
  const edge = Math.min(ramp, total / 2);
  return smootherstep(Math.min(1, elapsed / edge, (total - elapsed) / edge));
}
// Preserve user-selected speed, including 0.1 s and shorter, without
// arbitrary 50/60ms minimum durations.
export function intervalSeconds(requested, available, fallback) {
  const seconds = Number.isFinite(Number(requested)) ? Number(requested) : fallback;
  return Math.max(0, Math.min(seconds, Math.max(0, available)));
}
