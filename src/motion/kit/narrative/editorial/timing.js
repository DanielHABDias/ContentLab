export const clamp01 = n => Math.max(0,Math.min(1,n));
export const cueFrame = (len,fraction) => Math.round(Math.max(1,len)*clamp01(fraction));
export const progress = (f,len,at=0,span=1) => clamp01((f-cueFrame(len,at))/Math.max(1,len*span));
export const smooth = t => { const x=clamp01(t);return x*x*(3-2*x); };
export const entryCues = (count,max=4) => Array.from({length:Math.min(max,Math.max(0,count))},(_,i)=>i*.16);
export function segmentState(f,len,count) {
 const n=Math.max(1,Math.min(4,count)),index=Math.min(n-1,Math.max(0,Math.floor(f*n/len)));
 return {index,start:i=>Math.round(i*len/n),end:i=>Math.round((i+1)*len/n)};
}
/** Hold a source during an annotation; resume from the held frame without skipping content. */
export function pauseFrame(f,len,at=.32,duration=.35) {
 const start=cueFrame(len,at),end=cueFrame(len,Math.min(.95,at+duration));
 return {frame:f<start?f:f<end?start:f-(end-start),start,end,holding:f>=start&&f<end};
}
export function recallState(f,len,at=.35,duration=.2) {
 const a=clamp01(at),d=Math.max(.02,Math.min(duration,.95-a)),start=cueFrame(len,a),end=cueFrame(len,a+d);
 return {start,end,recalling:f>=start&&f<end,frame:f<start?f:f<end?start:f-(end-start)};
}
export function reactionState(f,len,at=.28,until=.83) {
 const start=cueFrame(len,at),end=cueFrame(len,Math.max(at,until)),swap=Math.round((start+end)/2);
 return {visible:f>=start&&f<end,index:f<swap?0:1,start,swap,end};
}
