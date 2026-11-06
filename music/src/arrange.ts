import {levelAt} from "./model.js";
const chords={
  tense:[[50,53,57,60,64],[46,50,53,57,60],[43,46,50,53,57],[45,49,52,55,58]],
  warm:[[48,52,55,59,62],[45,48,52,55,59],[41,45,48,52,55],[43,47,50,53,57]],
  melancholic:[[50,53,57,60,64],[46,50,53,57,60],[48,52,55,59,62],[45,48,52,55,59]]
};
export function seeded(seed){
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)|0;
    let x=Math.imul(state^state>>>15,1|state);
    x^=x+Math.imul(x^x>>>7,61|x);
    return ((x^x>>>14)>>>0)/4294967296;
  };
}
function arrangeV2(score,endSeconds){
  const end=Math.min(score.durationSeconds,endSeconds),beatTime=60/score.bpm,events=[];
  const add=(n,startBeat,track)=>{
    const start=startBeat*beatTime;
    if(start>=end)return;
    const duration=Math.min(n.durationBeats*beatTime,end-start);
    if(duration<=0)return;
    const gain=track.gain*(.92+.16*levelAt(score,start).intensity);
    events.push({start,duration,pitch:n.pitch,velocity:Math.min(1,n.velocity*gain),
      voice:track.instrument,track:track.id,instrument:track.instrument,
      pan:track.pan||0});
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
function arrangeLegacy(score,endSeconds){
  const random=seeded(score.seed),beat=60/score.bpm,bar=4*beat;
  const end=Math.min(endSeconds,score.durationSeconds),events=[];
  const add=(start,duration,pitch,velocity,voice)=>{
    if(start>=end||duration<=0)return;
    events.push({start,duration:Math.min(duration,end-start),pitch,velocity,voice});
  };
  const progression=chords[score.mode],bars=Math.ceil(end/bar);
  for(let index=0;index<bars;index++){
    const start=index*bar,tones=progression[index%progression.length];
    const intensity=levelAt(score,start).intensity,root=tones[0]-12;
    for(const pitch of tones.slice(1))add(start,bar*.98,pitch,.15+intensity*.06,"pad");
    add(start,bar*.80,root,.26+intensity*.08,"bass");
    if(intensity>.32)add(start+beat*2,beat*1.5,root+7,.16,"bass");
    for(let n=0;n<2;n++){
      const t=start+n*2*beat+(random()-.5)*.025;
      for(const pitch of tones.slice(1,4))
        add(Math.max(0,t),beat*(.60+random()*.16),pitch+12,.10+intensity*.05,"keys");
    }
    const density=score.melody==="balanced"?.80:score.melody==="sparse"?.37:0;
    let last=tones[2]+12;
    for(let step=0;step<8;step++){
      if(random()>density*(.62+intensity*.3))continue;
      const candidates=[tones[2]+12,tones[3]+12,tones[4]+12,tones[1]+24];
      const next=candidates.reduce((best,p)=>Math.abs(p-last)<Math.abs(best-last)?p:best,candidates[0]);
      const pitch=random()<.35?candidates[Math.floor(random()*candidates.length)]:next;
      add(Math.max(0,start+step*beat/2+(random()-.5)*.055),
        beat*(.34+random()*.48),pitch,.12+intensity*.07,"lead");
      last=pitch;
    }
    if(intensity>.20){
      add(start,.27,38,.24+intensity*.12,"kick");
      add(start+beat*2,.23,38,.17+intensity*.08,"kick");
      for(const i of [1,3])add(start+beat*i,.14,38,.14+intensity*.11,"snare");
      if(intensity>.40)for(let i=0;i<8;i++)
        if(random()<.72)add(start+beat*i/2,.07,38,.045+intensity*.04,"hat");
    }
  }
  if(score.melodyNotes.length){
    return [...events.filter(event=>event.voice!=="lead"),
      ...score.melodyNotes.filter(note=>note.time<end).map(note=>({
        start:note.time,duration:Math.min(note.duration,end-note.time),
        pitch:note.pitch,velocity:note.velocity,voice:"lead"}))]
      .sort((a,b)=>a.start-b.start);
  }
  return events.sort((a,b)=>a.start-b.start);
}
export function arrange(score,endSeconds=score.durationSeconds){
  return score.schemaVersion===2?arrangeV2(score,endSeconds):arrangeLegacy(score,endSeconds);
}
