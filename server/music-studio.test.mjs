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
  assert.notEqual(bytes.getInt16(46,true),0);
});
