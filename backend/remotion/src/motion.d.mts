export function clamp01(value: number): number;
export function smoothstep5(value: number): number;
export function easeMotion(value: number, easing?: string): number;
export function motionDuration(configured: number, available: number): number;
export function motionProgress(elapsed: number, duration: number, easing?: string): number;
export function motionEnvelope(elapsed: number, total: number): number;
export function interpolate(start: number, end: number, progress: number): number;
