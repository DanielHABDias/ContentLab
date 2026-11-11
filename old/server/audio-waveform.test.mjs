import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {audioWaveform} from './audio-waveform.mjs';
import {run} from './exec.mjs';
test('waveform contains real silence and sound, caches identical media and refreshes changed media',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-waveform-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'audio.wav');
  await run('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=0.2','-af','adelay=200',file]);
  const [a,b]=await Promise.all([audioWaveform(file),audioWaveform(file)]);
  assert.equal(a,b);assert.ok(Math.abs(a.duration-.4)<.01);assert.equal(a.peaks.length,640);
  assert.ok(a.peaks.slice(0,200).every(n=>n===0),'Silence must not become decorative waves');
  assert.ok(a.peaks.slice(400).some(n=>n>.05));assert.ok(a.peaks.every(n=>n>=0&&n<=1));
  await run('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','anullsrc=r=8000:cl=mono:d=0.3',file]);
  const changed=await audioWaveform(file);assert.notEqual(changed,a);assert.ok(changed.peaks.every(n=>n===0));
});
test('bad media fails without poisoning later waveform requests',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-waveform-invalid-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'broken.wav');fs.writeFileSync(file,'Not audio');
  await assert.rejects(audioWaveform(file));await assert.rejects(audioWaveform(file));
});
