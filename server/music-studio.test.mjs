import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createStylePreset,validateScore,levelAt,INSTRUMENTS,STYLES} from "../frontend/static/music/model.js";
import {arrange} from "../frontend/static/music/arrange.js";
import {sampleForEvent} from "../frontend/static/music/samples.js";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

test("o JSON musical atual exige faixas e valida a partitura",()=>{
  const score=validateScore(createStylePreset("cinematic",120));
  assert.equal(score.durationSeconds,120);
  assert.equal(score.tracks.length,5);
  assert.throws(()=>validateScore({...score,durationSeconds:180}),/terminar/);
  assert.throws(()=>validateScore({...score,bpm:0}),/BPM/);
  assert.throws(()=>validateScore({...score,automation:[
    {time:0,volume:0,intensity:0},{time:0,volume:1,intensity:1}
  ]}),/crescente/);
  assert.throws(()=>validateScore({title:"Sem faixas",durationSeconds:10,bpm:80,
    seed:1,masterVolume:.8,automation:[
      {time:0,volume:.5,intensity:.5},{time:10,volume:0,intensity:0}]}),/faixas/);
  assert.equal(levelAt(score,120).volume,0);
  assert.equal(score.automation[0].time,0);
});
test("cinco estilos produzem músicas realmente diferentes",()=>{
  assert.deepEqual(STYLES,["cinematic","lofi","rock","funk","pagode"]);
  const seen=new Set(),timbres=new Set();
  for(const style of STYLES){
    const score=validateScore(createStylePreset(style,120));
    const notes=arrange(score);
    assert.ok(notes.length>20,style+" sem música suficiente");
    assert.ok(notes.every(n=>n.start>=0&&n.start+n.duration<=120.00001));
    seen.add(notes.slice(0,20).map(e=>[e.instrument,e.pitch,e.start.toFixed(3)]).join(","));
    timbres.add(score.tracks.map(t=>t.instrument).join(","));
  }
  assert.equal(seen.size,5);
  assert.equal(timbres.size,5);
});
test("partitura livre permite controlar notas, clipes, instrumento e mute",()=>{
  const original=createStylePreset("funk",18);
  const score=structuredClone(original);
  score.tracks=[
    {id:"lead",name:"Frase",instrument:"nylon-guitar",gain:.7,pan:-.2,muted:false,
      notes:[{beat:0,durationBeats:2,pitch:69,velocity:.8}],
      clips:[{startBeat:4,lengthBeats:4,repeats:3,notes:[
        {beat:.5,durationBeats:1,pitch:67,velocity:.6},
        {beat:2.25,durationBeats:.25,pitch:72,velocity:.45}]}]},
    {id:"drums",name:"Percussão",instrument:"surdo",gain:.7,muted:false,
      notes:[],clips:[{startBeat:0,lengthBeats:3,repeats:4,notes:[
        {beat:0,durationBeats:.5,pitch:36,velocity:.8}]}]}
  ];
  const valid=validateScore(score),events=arrange(valid);
  assert.equal(events.filter(e=>e.track==="lead").length,7);
  assert.ok(events.some(e=>e.instrument==="nylon-guitar"));
  const changed=structuredClone(valid);changed.tracks[0].notes[0].pitch=55;
  assert.equal(arrange(changed)[0].pitch,55);
  changed.tracks[1].muted=true;
  assert.ok(arrange(changed).length<events.length);
  const invalid=structuredClone(valid);invalid.tracks[0].clips[0].notes[0].beat=4.2;
  assert.throws(()=>validateScore(invalid),/ultrapassa|entre/);
});
test("timbres sintetizados podem ser personalizados sem falsificar samples",()=>{
  const score=createStylePreset("lofi",12);
  score.tracks[0].instrument="custom-synth";
  score.tracks[0].sound={wave:"square",cutoff:440,attack:.03,release:.3,layerWave:"sine",amp:.4};
  const valid=validateScore(score);
  assert.equal(arrange(valid).find(e=>e.track===valid.tracks[0].id).sound.wave,"square");
  const invalid=structuredClone(valid);invalid.tracks[0].sound.cutoff=10;
  assert.throws(()=>validateScore(invalid),/cutoff/);
});
test("piano e violões usam amostras de instrumentos gravados CC0",()=>{
  assert.ok(INSTRUMENTS.includes("nylon-guitar"));
  assert.ok(INSTRUMENTS.includes("steel-guitar"));
  const sample=(instrument,pitch,rawVelocity)=>sampleForEvent({instrument,pitch,rawVelocity,velocity:.2});
  const piano=sample("piano",60,.61);
  assert.equal(piano.collection,"piano");
  assert.match(piano.file,/INSPiano_Vel0[1-4]_C4_01\.ogg/);
  const steel=sample("guitar",40,.85);
  assert.equal(steel.collection,"steel");
  assert.match(steel.file,/StringLowE_Vel03_E2_01\.ogg/);
  const nylon=sample("nylon-guitar",60,.2);
  assert.equal(nylon.collection,"nylon");
  assert.match(nylon.file,/Vel01Finger_C4_01\.ogg/);
  assert.equal(sample("pad",60,.7),null);
  assert.equal(steel.license,"CC0-1.0");
});
test("fontes de áudio e espelhos JS do navegador permanecem iguais",()=>{
  for(const module of ["model","arrange","synth","midi","wav","samples"]){
    const source=fs.readFileSync(path.join(root,"music","src",module+".ts"),"utf8");
    const mirror=fs.readFileSync(path.join(root,"frontend","static","music",module+".js"),"utf8");
    assert.equal(mirror,source,module+" divergente");
  }
  const ui=fs.readFileSync(path.join(root,"frontend","static","music-studio.js"),"utf8");
  const html=fs.readFileSync(path.join(root,"frontend","templates","index.html"),"utf8");
  assert.match(html,/id="panel-music"/);
  assert.match(html,/id="musicTimeline" viewBox="0 0 960 344"/);
  assert.doesNotMatch(html,/id="musicLegacyFields"|value="legacy"/);
  assert.match(ui,/createMusicAutomationEditor/);
});
test("exporta MIDI multifaixa e WAV com cabeçalho válido",async()=>{
  const {toMidi}=await import("../frontend/static/music/midi.js");
  const {toWav}=await import("../frontend/static/music/wav.js");
  const score=createStylePreset("rock",20);
  const midi=new Uint8Array(await toMidi(score).arrayBuffer());
  assert.equal(String.fromCharCode(...midi.slice(0,4)),"MThd");
  assert.equal(midi[8]*256+midi[9],1);
  assert.equal(midi[10]*256+midi[11],score.tracks.length+1);
  assert.ok(midi.includes(144));
  const pcm=[new Float32Array([0,.5,-.5,1]),new Float32Array([0,-.5,.5,-1])];
  const wav=new DataView(await toWav({numberOfChannels:2,length:4,sampleRate:48000,
    getChannelData:i=>pcm[i]}).arrayBuffer());
  assert.equal(wav.getUint32(24,true),48000);
  assert.equal(wav.getUint16(22,true),2);
});
test("automação visual altera o JSON atual sem perder as notas",async()=>{
  const {moveAutomationPoint,insertAutomationPoint,deleteAutomationPoint,graphPoint,graphValue}
    =await import("../frontend/static/music-automation.js");
  const s=createStylePreset("cinematic",120),pos=graphPoint(s,30,.65),back=graphValue(s,pos.x,pos.y);
  assert.ok(Math.abs(back.time-30)<.00001);
  const moved=moveAutomationPoint(s,2,"volume",55,.8);
  assert.equal(moved.automation[2].volume,.8);
  assert.equal(moved.tracks.length,s.tracks.length);
  const inserted=insertAutomationPoint(s,25,"intensity",.3);
  assert.equal(inserted.automation.length,s.automation.length+1);
  assert.equal(deleteAutomationPoint(inserted,1).automation.length,s.automation.length);
});
test("músicas longas possuem seções musicais distintas",()=>{
  for(const style of STYLES){
    const score=createStylePreset(style,457);
    assert.ok(score.tracks.some(t=>t.clips.length>=3));
    const track=score.tracks.find(t=>t.clips.length>=3&&!["kick","snare","hat","clap","shaker","tom","surdo","pandeiro","tamborim","rim","cowbell"].includes(t.instrument));
    assert.ok(track,style);
    assert.notDeepEqual(track.clips[0].notes,track.clips[1].notes);
    assert.ok(arrange(score).every(e=>e.start+e.duration<=457.00001));
  }
});
test("o exemplo Carnificina é um JSON musical atual com gravações de piano",()=>{
  const file=path.join(root,"music","examples","carnificina-peso-e-sombra.json");
  const score=validateScore(JSON.parse(fs.readFileSync(file,"utf8")));
  assert.equal(score.durationSeconds,457);
  assert.equal(score.tracks.length,5);
  const piano=score.tracks.find(t=>t.instrument==="piano");
  assert.ok(piano?.clips.length>=8);
  assert.ok(score.tracks.some(t=>t.instrument==="sub-bass"));
  assert.ok(arrange(score).length>200);
});
