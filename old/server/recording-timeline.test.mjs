import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {APP_ROOT} from './plan.mjs';
const scope={};vm.runInNewContext(fs.readFileSync(APP_ROOT+'/frontend/static/recording-timeline.js','utf8'),scope);
const {cut,join,wav,envelope,sampleAt}=scope.RecordingTimeline;
test('horizontal scroll and zoom map mouse position to the correct audio sample',()=>{
 assert.equal(sampleAt(220,20,800,80,48000,48000*30),600000);
 assert.equal(sampleAt(220,20,800,160,48000,48000*30),300000);
 assert.equal(sampleAt(-100,20,0,80,48000,1000),0);
 assert.equal(sampleAt(3000,0,1000,80,48000,1000),1000);
});
test('signed waveform envelopes preserve brief transients instead of flattening an entire long take',()=>{
 const data=new Float32Array(48000*30);data[192000]=-.8;data[192001]=.4;
 const p=envelope(data);assert.ok(p.low.length>4096);const bin=Math.floor(192000/p.block);
 assert.ok(p.low[bin]<-.79);assert.ok(p.high[bin]>.39);assert.equal(p.low[bin+1],0);assert.equal(p.high[bin+1],0);
});
test('sample cuts remove only the selected interval, preserving order and source',()=>{
 const input=Float32Array.from([1,2,3,4,5]);assert.deepEqual([...cut(input,1,4)],[1,5]);assert.deepEqual([...input],[1,2,3,4,5]);
 assert.deepEqual([...cut(input,0,5)],[]);assert.deepEqual([...cut(input,-10,2)],[3,4,5]);assert.deepEqual([...cut(input,3,1)],[1,2,3,4,5]);
 assert.deepEqual([...join(cut(input,1,4),Float32Array.from([6,7]))],[1,5,6,7]);
});
test('WAV uses mono PCM16 at 48k with bounded samples and exact duration',()=>{
 const bytes=wav(Float32Array.from([-2,-.5,0,.5,2]),48000),v=new DataView(bytes);
 assert.equal(v.getUint16(22,true),1);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(34,true),16);
 assert.equal(v.getUint32(40,true),10);assert.equal(bytes.byteLength,54);assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(52,true),32767);
});
