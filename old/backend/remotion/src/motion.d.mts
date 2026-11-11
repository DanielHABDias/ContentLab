export function clamp01(value: number): number;
export function smootherstep(value: number): number;
export function ease(value: number, name?: 'linear'|'ease_in'|'ease_out'|'ease_in_out'|string): number;
export function progress(elapsed: number, seconds: number, curve?: string): number;
export function lerp(a: number,b: number,p: number): number;
export function idleEnvelope(elapsed:number,total:number,ramp?:number): number;
export function intervalSeconds(requested:number|undefined,available:number,fallback:number):number;
