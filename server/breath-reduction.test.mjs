import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {breathOptions,breathRanges,reduceBreaths} from './breath-reduction.mjs';
import {run} from './exec.mjs';

test('breath controls validate booleans, bounds, zero and legacy default',()=>{
  assert.equal(breathOptions().reduceBreaths,false);
  assert.equal(breathOptions({breathReductionStrength:0}).breathReductionStrength,0);
  for(const raw of [{reduceBreaths:'true'},{breathReductionStrength:-1},{breathReductionStrength:101},{breathReductionStrength:'bad'}])assert.throws(()=>breathOptions(raw));
});
test('detector protects speech, long noise and silence',()=>{
  const frames=Array.from({length:240},()=>({db:-90,zcr:0,periodicity:0}));
  for(let i=0;i<60;i++)frames[i]={db:-20,zcr:.05,periodicity:.9};
  for(let i=90;i<115;i++)frames[i]={db:-40,zcr:.25,periodicity:.1};
  for(let i=140;i<200;i++)frames[i]={db:-20,zcr:.05,periodicity:.9};
  assert.equal(breathRanges(frames).length,1);
  const adjacent=frames.map(f=>({...f}));for(let i=60;i<68;i++)adjacent[i]={db:-40,zcr:.25,periodicity:.1};
  assert.equal(breathRanges(adjacent).length,1,'short unvoiced speech-adjacent consonants stay untouched');
  assert.deepEqual(breathRanges(Array.from({length:150},()=>({db:-35,zcr:.2,periodicity:.1}))),[]);
});
test('attenuation preserves samples and voice; disabled copies; cancellation cleans up',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-breath-test-'));
  try{
    const raw=path.join(root,'input.f32'),input=path.join(root,'input.wav'),output=path.join(root,'output.wav'),decoded=path.join(root,'output.f32');
    const samples=Buffer.alloc(48000*3*4);let seed=17,noise=0;
    for(let i=0;i<48000*3;i++){
      const t=i/48000;seed=(1664525*seed+1013904223)>>>0;
      noise=.8*noise+.2*(seed/4294967296-.5)*.06;
      const value=t<.6||(t>1.5&&t<2.3)? .2*Math.sin(2*Math.PI*150*t):t>.92&&t<1.25? noise:0;
      samples.writeFloatLE(value,i*4);
    }
    fs.writeFileSync(raw,samples);
    await run('ffmpeg',['-v','error','-f','f32le','-ar','48000','-ac','1','-i',raw,'-c:a','pcm_s24le',input]);
    await reduceBreaths(input,output,{reduceBreaths:false});assert.deepEqual(fs.readFileSync(output),fs.readFileSync(input));fs.unlinkSync(output);
    await reduceBreaths(input,output,{reduceBreaths:true,breathReductionStrength:0});assert.deepEqual(fs.readFileSync(output),fs.readFileSync(input));fs.unlinkSync(output);
    const result=await reduceBreaths(input,output,{reduceBreaths:true,breathReductionStrength:60});
    assert.equal(result.applied,true);assert.equal(result.attenuationDb,12);
    const extreme=await reduceBreaths(input,path.join(root,'extreme.wav'),{reduceBreaths:true,breathReductionStrength:100});
    assert.equal(extreme.attenuationDb,40);
    await run('ffmpeg',['-v','error','-i',output,'-f','f32le',decoded]);
    const actual=fs.readFileSync(decoded);assert.equal(actual.length,samples.length);
    const energy=(data,a,b)=>{let sum=0;for(let i=Math.round(a*48000);i<Math.round(b*48000);i++)sum+=data.readFloatLE(i*4)**2;return sum;};
    assert.ok(energy(actual,1,1.15)<energy(samples,1,1.15)*.15);
    assert.ok(Math.abs(energy(actual,.1,.4)/energy(samples,.1,.4)-1)<.001);
    const controller=new AbortController();controller.abort();
    await assert.rejects(reduceBreaths(input,path.join(root,'cancel.wav'),{reduceBreaths:true},{signal:controller.signal}));
    assert.equal(fs.existsSync(path.join(root,'cancel.wav')),false);
    assert.equal(fs.readdirSync(root).some(name=>name.startsWith('.breaths-')),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
