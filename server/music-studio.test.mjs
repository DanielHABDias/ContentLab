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
