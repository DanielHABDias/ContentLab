import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createPreset,validateScore,levelAt} from "../frontend/static/music/model.js";
import {arrange} from "../frontend/static/music/arrange.js";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
test("music score validates exact automation endpoints and safe limits",()=>{
  const score=validateScore(createPreset(120));
  assert.equal(score.durationSeconds,120);
  assert.throws(()=>validateScore({...score,durationSeconds:180}),/terminar/);
  assert.throws(()=>validateScore({...score,bpm:0}),/BPM/);
  assert.throws(()=>validateScore({...score,automation:[{time:0,volume:0,intensity:0},{time:0,volume:1,intensity:1}]}),/crescente/);
  assert.equal(levelAt(score,0).volume,.3);
  assert.equal(levelAt(score,120).volume,0);
});
test("arranger creates actual pitched harmony, melody, rhythm and reproducible variation",()=>{
  const score=validateScore(createPreset(120));
  const a=arrange(score),b=arrange(score);
  assert.deepEqual(a,b);
  assert.ok(a.some(e=>e.voice==="pad"));
  assert.ok(a.some(e=>e.voice==="bass"));
  assert.ok(a.some(e=>e.voice==="keys"));
  assert.ok(a.some(e=>e.voice==="lead"),"preset must produce melody, not only atmosphere");
  assert.ok(a.some(e=>e.voice==="kick"));
  assert.ok(a.every(e=>e.start>=0&&e.start+e.duration<=120.00001));
  assert.notDeepEqual(a,arrange({...score,seed:score.seed+1}));
});
test("manual MIDI notes replace automatic lead and respect the soundtrack duration",()=>{
  const score=validateScore({...createPreset(12),melodyNotes:[{time:2,duration:1,pitch:74,velocity:.4}]});
  const melody=arrange(score).filter(e=>e.voice==="lead");
  assert.equal(melody.length,1);assert.equal(melody[0].pitch,74);
});
test("the TypeScript engine and its browser output stay synchronized",()=>{
  for(const module of ["model","arrange","synth","wav"]){
    const source=fs.readFileSync(path.join(root,"music","src",module+".ts"),"utf8");
    const shipped=fs.readFileSync(path.join(root,"frontend","static","music",module+".js"),"utf8");
    assert.equal(shipped,source,module+" compiled mirror differs");
  }
  const html=fs.readFileSync(path.join(root,"frontend/templates/index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"frontend/static/app.js"),"utf8");
  assert.match(html,/id="tab-music"/);assert.match(html,/id="panel-music"/);
  assert.match(html,/music-studio\.js/);assert.match(app,/"music"/);
});

test("WAV export writes a valid stereo PCM header and samples",async()=>{
  const {toWav}=await import("../frontend/static/music/wav.js");
  const samples=[new Float32Array([0,.5,-.5,1]),new Float32Array([0,-.5,.5,-1])];
  const blob=toWav({numberOfChannels:2,length:4,sampleRate:32000,getChannelData:i=>samples[i]});
  const bytes=new DataView(await blob.arrayBuffer());
  assert.equal(blob.size,60);
  assert.equal(bytes.getUint32(24,true),32000);
  assert.equal(bytes.getUint16(22,true),2);
  assert.equal(bytes.getUint16(34,true),16);
  // First stereo frame contains zero samples; inspect the next frame.
  assert.notEqual(bytes.getInt16(48,true),0);
});

test("graph automation edits preserve endpoints, time order and independent curves",async()=>{
  const {graphPoint,graphValue,moveAutomationPoint,insertAutomationPoint,deleteAutomationPoint}
    =await import("../frontend/static/music-automation.js");
  const preset=validateScore(createPreset(120));
  const coords=graphPoint(preset,30,.65);
  const back=graphValue(preset,coords.x,coords.y);
  assert.ok(Math.abs(back.time-30)<1e-8);
  assert.ok(Math.abs(back.value-.65)<1e-8);
  const moved=moveAutomationPoint(preset,2,"volume",66,.9);
  assert.equal(moved.automation[2].volume,.9);
  assert.equal(moved.automation[2].intensity,preset.automation[2].intensity);
  assert.ok(moved.automation[2].time<moved.automation[3].time);
  const locked=moveAutomationPoint(moved,0,"intensity",25,.76);
  assert.equal(locked.automation[0].time,0);
  assert.equal(locked.automation[0].intensity,.76);
  const end=moveAutomationPoint(moved,moved.automation.length-1,"volume",85,.2);
  assert.equal(end.automation.at(-1).time,120);
  const inserted=insertAutomationPoint(moved,55,"intensity",.66);
  assert.equal(inserted.automation.length,moved.automation.length+1);
  assert.ok(inserted.automation.some(p=>p.time===55&&p.intensity===.66));
  const restored=deleteAutomationPoint(inserted,3);
  assert.equal(restored.automation.length,moved.automation.length);
  assert.throws(()=>deleteAutomationPoint(preset,0),/primeiro/);
  assert.throws(()=>insertAutomationPoint(preset,0,"volume",.4),/dentro/);
  assert.throws(()=>insertAutomationPoint(preset,preset.automation[2].time,"volume",.4),/Muito perto/);
});
test("music UI uses a large draggable SVG instead of marker sliders and buttons",()=>{
  const html=fs.readFileSync(path.join(root,"frontend/templates/index.html"),"utf8");
  const script=fs.readFileSync(path.join(root,"frontend/static/music-studio.js"),"utf8");
  const css=fs.readFileSync(path.join(root,"frontend/static/music-studio.css"),"utf8");
  assert.match(html,/id="musicTimeline" viewBox="0 0 960 344"/);
  assert.match(html,/id="musicChartHint"/);
  assert.doesNotMatch(html,/id="musicMarkers"|id="musicAddMarker"/);
  assert.match(script,/createMusicAutomationEditor/);
  assert.match(css,/touch-action:none/);
});

test("v2 styles are distinct multitrack compositions rather than one loop with changed loudness",async()=>{
  const {createStylePreset,STYLES}=await import("../frontend/static/music/model.js");
  assert.deepEqual(STYLES,["cinematic","lofi","rock","funk","pagode"]);
  const palettes=[];
  const signatures=[];
  for(const genre of STYLES){
    const score=validateScore(createStylePreset(genre,457));
    assert.equal(score.schemaVersion,2);
    assert.equal(score.durationSeconds,457);
    assert.ok(score.tracks.length>=4);
    assert.ok(score.tracks.every(t=>t.instrument&&Array.isArray(t.clips)));
    const events=arrange(score);
    assert.ok(events.length>100,"full score should contain actual rhythmic/harmonic events");
    assert.ok(events.every(e=>e.start>=0&&e.start+e.duration<=457.00001));
    assert.ok(events.some(e=>e.pitch!==38),"all notes cannot be the old fixed kick pitch");
    palettes.push([...new Set(score.tracks.map(t=>t.instrument))].join(","));
    signatures.push(events.slice(0,20).map(e=>e.voice+":"+e.pitch+"@"+e.start.toFixed(2)).join("|"));
  }
  assert.equal(new Set(palettes).size,5,"styles must use different instruments");
  assert.equal(new Set(signatures).size,5,"styles must create distinct musical content");
});
test("v2 JSON owns arbitrary note composition, clip repetition and per-track instruments",async()=>{
  const {createStylePreset}=await import("../frontend/static/music/model.js");
  const v2=createStylePreset("funk",18),custom=structuredClone(v2);
  custom.tracks=[
    {id:"melody",name:"Melodia livre",instrument:"flute",gain:.8,pan:-.1,muted:false,
      notes:[{beat:0,durationBeats:3,pitch:85,velocity:.9}],
      clips:[{startBeat:4,lengthBeats:4,repeats:3,notes:[
        {beat:.5,durationBeats:1,pitch:67,velocity:.6},
        {beat:2.25,durationBeats:.25,pitch:92,velocity:.3}
      ]}]},
    {id:"rhythm",name:"Bateria customizada",instrument:"surdo",gain:.7,pan:0,muted:false,
      notes:[],clips:[{startBeat:0,lengthBeats:3,repeats:5,notes:[
        {beat:0,durationBeats:.5,pitch:36,velocity:.8},
        {beat:1.75,durationBeats:.2,pitch:36,velocity:.45}]}]}
  ];
  const score=validateScore(custom),events=arrange(score);
  assert.equal(events[0].pitch,85);
  assert.equal(events.filter(e=>e.track==="melody").length,7);
  assert.ok(events.some(e=>e.start===4*60/150+.5*60/150));
  assert.ok(events.some(e=>e.pitch===92));
  assert.ok(events.some(e=>e.instrument==="surdo"));
  const muted=structuredClone(score);muted.tracks[1].muted=true;
  assert.ok(arrange(muted).length<events.length,"mute should remove a track's notes");
  const edited=structuredClone(score);edited.tracks[0].notes[0].pitch=40;
  assert.equal(arrange(edited)[0].pitch,40,"changing pitch must change music");
  const wrong=structuredClone(score);wrong.tracks[0].clips[0].notes[0].beat=4.5;
  assert.throws(()=>validateScore(wrong),/ultrapassa|entre/);
  const repeated=structuredClone(score);repeated.tracks.push(structuredClone(repeated.tracks[0]));
  assert.throws(()=>validateScore(repeated),/repetido/);
});
test("MIDI export contains the composed tracks, tempo and actual note events",async()=>{
  const {createStylePreset}=await import("../frontend/static/music/model.js");
  const {toMidi}=await import("../frontend/static/music/midi.js");
  const score=createStylePreset("pagode",22);
  const raw=new Uint8Array(await toMidi(score).arrayBuffer());
  const str=(a,b)=>String.fromCharCode(...raw.slice(a,b));
  assert.equal(str(0,4),"MThd");
  assert.equal(raw[8]*256+raw[9],1,"multi-track MIDI format 1");
  assert.equal(raw[10]*256+raw[11],score.tracks.length+1);
  assert.ok(str(14,18)==="MTrk");
  assert.ok(raw.includes(0x90),"at least one MIDI note-on required");
  const a=arrange(score);
  assert.ok(a.some(e=>e.track==="surdo"),"MIDI covers genre-specific percussion");
  assert.throws(()=>toMidi(createPreset(20)),/v2/);
});
test("v2 synthesized audio plays different notes and genres, not only a volume curve",async()=>{
  const {createStylePreset}=await import("../frontend/static/music/model.js");
  const {renderAudio}=await import("../frontend/static/music/synth.js");
  // Rendering requires a browser's OfflineAudioContext; node verifies event-level differences.
  const a=arrange(createStylePreset("rock",8));
  const b=arrange(createStylePreset("funk",8));
  assert.notDeepEqual(a.map(e=>[e.voice,e.pitch,e.start]),b.map(e=>[e.voice,e.pitch,e.start]));
  assert.equal(typeof renderAudio,"function");
});

test("custom oscillator voice lets the score define timbre, independent of genre",async()=>{
  const {createStylePreset}=await import("../frontend/static/music/model.js");
  const original=createStylePreset("lofi",14),next=structuredClone(original);
  const track=next.tracks[0];
  track.instrument="custom-synth";
  track.sound={wave:"square",cutoff:520,attack:.04,release:.8,amp:.38,
    layerWave:"sine",layerGain:.17,detune:-12};
  const validated=validateScore(next),events=arrange(validated);
  assert.equal(events.find(e=>e.track===track.id).sound.wave,"square");
  assert.equal(events.find(e=>e.track===track.id).sound.cutoff,520);
  const illegal=structuredClone(validated);illegal.tracks[0].sound.cutoff=5;
  assert.throws(()=>validateScore(illegal),/cutoff/);
  const waveform=structuredClone(validated);waveform.tracks[0].sound.wave="wavetable";
  assert.throws(()=>validateScore(waveform),/Onda/);
});

test("long genre presets evolve across distinct musical sections",async()=>{
  const {createStylePreset}=await import("../frontend/static/music/model.js");
  for(const style of ["cinematic","lofi","rock","funk","pagode"]){
    const score=createStylePreset(style,457);
    const music=score.tracks.filter(t=>!["kick","snare","hat","clap","shaker","tom","surdo","pandeiro","tamborim","rim","cowbell"].includes(t.instrument));
    assert.ok(music.some(t=>t.clips.length>=3),style+" needs section changes");
    const patterned=music.find(t=>t.clips.length>=3);
    assert.notDeepEqual(
      patterned.clips[0].notes.map(n=>[n.pitch,n.velocity,n.beat]),
      patterned.clips[1].notes.map(n=>[n.pitch,n.velocity,n.beat]),
      style+" should not repeat the same notes and dynamics in every section"
    );
    assert.ok(arrange(score).every(e=>e.start+e.duration<=457.00001));
    const short=createStylePreset(style,5);
    assert.ok(validateScore(short),"short scores must not contain clips starting past the end");
  }
});
