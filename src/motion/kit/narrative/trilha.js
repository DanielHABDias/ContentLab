/** Shared timeline geometry and cue times: visuals, video offsets and SFX use the same schedule. */
export function trailSchedule(len, count) {
 if(count<=0)return [];
 const n=Math.max(1,Math.min(4,count));
 return Array.from({length:n},(_,i)=>({t:n===1?.48:.12+i*.72/(n-1),start:Math.round(len*(.08+.68*(n===1?.48:.12+i*.72/(n-1))/.84))}));
}
export const trailY=t=>.5+Math.sin(t*Math.PI*2.3-.8)*.2;
export function trailGeometry(width,height,t) {
 const points=Array.from({length:161},(_,i)=>({x:width*i/160,y:height*trailY(i/160),t:i/160}));
 const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
 const index=Math.max(0,Math.min(160,t*160)),lo=Math.floor(index),hi=Math.min(160,lo+1);
 const distance=distances[lo]+(distances[hi]-distances[lo])*(index-lo);
 return {path:points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '),progress:distance/distances[160],point:{x:width*t,y:height*trailY(t)}};
}
export function trailState(frame,len,count) {
 const cues=trailSchedule(len,count);let active=-1;
 for(let i=0;i<cues.length;i++)if(frame>=cues[i].start)active=i;
 const elapsed=i=>Math.max(0,Math.min(frame,(cues[i+1]?.start??len)-1)-cues[i].start);
 return {cues,active,elapsed};
}
