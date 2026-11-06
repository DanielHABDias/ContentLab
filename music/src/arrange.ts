import {levelAt} from "./model.js";
export function seeded(seed){
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)|0;
    let x=Math.imul(state^state>>>15,1|state);
    x^=x+Math.imul(x^x>>>7,61|x);
    return ((x^x>>>14)>>>0)/4294967296;
  };
}
function arrangeScore(score,endSeconds){
  const end=Math.min(score.durationSeconds,endSeconds),beatTime=60/score.bpm,events=[];
  const add=(n,startBeat,track)=>{
    const start=startBeat*beatTime;
    if(start>=end)return;
    const duration=Math.min(n.durationBeats*beatTime,end-start);
    if(duration<=0)return;
    const gain=track.gain*(.92+.16*levelAt(score,start).intensity);
    events.push({start,duration,pitch:n.pitch,velocity:Math.min(1,n.velocity*gain),rawVelocity:n.velocity,
      voice:track.instrument,track:track.id,instrument:track.instrument,
      pan:track.pan||0,sound:track.sound});
  };
  for(const track of score.tracks){
    if(track.muted||track.gain<=0)continue;
    for(const n of track.notes)add(n,n.beat,track);
    for(const clip of track.clips){
      for(let rep=0;rep<clip.repeats;rep++){
        const origin=clip.startBeat+rep*clip.lengthBeats;
        if(origin*beatTime>=end)break;
        for(const n of clip.notes)add(n,origin+n.beat,track);
      }
    }
  }
  return events.sort((a,b)=>a.start-b.start||a.track.localeCompare(b.track));
}
export function arrange(score,endSeconds=score.durationSeconds){
  return arrangeScore(score,endSeconds);
}
