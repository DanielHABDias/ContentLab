// Standard MIDI file format 1: export actual composed notes for editing in any DAW.
import {arrange} from "./arrange.js";
import {DRUM_INSTRUMENTS} from "./model.js";
const PPQ=480;
const GM={
  "sub-bass":38,"808":38,bass:33,piano:0,"electric-piano":4,
  pad:89,strings:48,organ:19,"synth-lead":81,pluck:10,
  guitar:25,"distorted-guitar":30,cavaquinho:24,flute:73,brass:61
};
const DRUM_PITCH={kick:36,snare:38,hat:42,clap:39,shaker:70,tom:45,
  surdo:41,pandeiro:54,tamborim:56,rim:37,cowbell:56};
const bytes16=n=>[(n>>>8)&255,n&255];
const bytes32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
const varlen=n=>{
  if(!Number.isInteger(n)||n<0)throw Error("Delta MIDI inválido.");
  const output=[n&127];
  for(n>>>=7;n>0;n>>>=7)output.unshift((n&127)|128);
  return output;
};
const textBytes=s=>Array.from(new TextEncoder().encode(s));
const meta=(type,data)=>[255,type,...varlen(data.length),...data];
const chunk=(tag,data)=>[...textBytes(tag),...bytes32(data.length),...data];
const encodeTrack=events=>{
  events.sort((a,b)=>a.at-b.at||a.order-b.order);
  const encoded=[],cursor={at:0};
  for(const event of events){
    encoded.push(...varlen(Math.max(0,event.at-cursor.at)),...event.data);
    cursor.at=event.at;
  }
  encoded.push(0,255,47,0);
  return chunk("MTrk",encoded);
};
export function toMidi(score){
  if(score.schemaVersion!==2)throw Error("Exportação MIDI requer composição em JSON v2.");
  const end=score.durationSeconds,beatToTick=t=>Math.round(t*score.bpm/60*PPQ);
  const tempo=Math.round(60000000/score.bpm);
  const timing=encodeTrack([
    {at:0,order:0,data:meta(3,textBytes("Content Lab — tempo"))},
    {at:0,order:1,data:meta(81,[(tempo>>16)&255,(tempo>>8)&255,tempo&255])},
    {at:0,order:2,data:meta(88,[score.beatsPerBar,2,24,8])}
  ]);
  const notes=arrange(score,end),all=[timing];
  let melodicIndex=0;
  for(const track of score.tracks){
    const isDrum=DRUM_INSTRUMENTS.includes(track.instrument);
    const channel=isDrum?9:melodicIndex++%15+(melodicIndex%15>=9?1:0);
    const events=[
      {at:0,order:0,data:meta(3,textBytes(track.name))},
      {at:0,order:1,data:[192|channel,GM[track.instrument]||0]}
    ];
    for(const n of notes){
      if(n.track!==track.id)continue;
      const at=beatToTick(n.start),until=Math.max(at+1,beatToTick(n.start+n.duration));
      const pitch=isDrum?DRUM_PITCH[track.instrument]||42:n.pitch;
      const velocity=Math.max(1,Math.min(127,Math.round(n.velocity*127)));
      events.push({at,order:2,data:[144|channel,pitch,velocity]});
      events.push({at:until,order:1,data:[128|channel,pitch,0]});
    }
    all.push(encodeTrack(events));
  }
  return new Blob([new Uint8Array([
    ...textBytes("MThd"),...bytes32(6),...bytes16(1),...bytes16(all.length),...bytes16(PPQ),
    ...all.flat()
  ])],{type:"audio/midi"});
}
