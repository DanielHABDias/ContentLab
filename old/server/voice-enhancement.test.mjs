import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {enhancementOptions,enhanceVoice} from './voice-enhancement.mjs';
import {run} from './exec.mjs';
import {probeAudioDuration} from './audio.mjs';

test('enhancement defaults off and rejects unbounded or unknown options',()=>{
  assert.equal(enhancementOptions().enhancementEngine,'off');
  for(const raw of [{enhancementEngine:'adobe'},{enhancementMode:'invalid'},{enhancementStrength:101},{enhancementStrength:-1},{enhancementStrength:'no'}])assert.throws(()=>enhancementOptions(raw));
  assert.equal(enhancementOptions({enhancementStrength:0}).enhancementStrength,0);
});
test('disabled enhancement and zero strength are exact bypasses without downloads',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'enhancement-bypass-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const source=path.join(root,'source.wav'),dest=path.join(root,'out.wav');fs.writeFileSync(source,'original');
  const installer=()=>{throw Error('No download expected');};
  for(const raw of [{},{enhancementEngine:'deepfilter',enhancementStrength:0}]){
    assert.equal((await enhanceVoice(source,dest,raw,{installer})).applied,false);
    assert.deepEqual(fs.readFileSync(source),fs.readFileSync(dest));
  }
});
test('enhancement compensates delay, mixes strength and keeps exact length without changing source',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'enhancement-contract-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const source=path.join(root,'source.wav'),dest=path.join(root,'out.wav');
  await run('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=duration=0.537:sample_rate=48000',source]);
  const original=fs.readFileSync(source);let options;
  // Mock the model only; resampling and mixing use real FFmpeg.
  const runner=async(bin,args,config)=>{
    if(bin!=='model-test')return run(bin,args,config);
    options=args;
    const out=args[args.indexOf('-o')+1];
    await run('ffmpeg',['-loglevel','error','-i',args.at(-1),'-af','volume=0.2',path.join(out,'source_DeepFilterNet3.wav')],config);
  };
  const result=await enhanceVoice(source,dest,{enhancementEngine:'deepfilter',enhancementMode:'strong',enhancementStrength:50},{installer:async()=> 'model-test',runner});
  assert.equal(result.applied,true);assert.ok(options.includes('-D'));assert.ok(options.includes('--pf'));
  assert.ok(Math.abs(await probeAudioDuration(dest)-await probeAudioDuration(source))<.002);
  assert.deepEqual(fs.readFileSync(source),original);assert.notDeepEqual(fs.readFileSync(dest),original);
  await assert.rejects(enhanceVoice(source,dest,{enhancementEngine:'deepfilter'},{installer:async()=>{throw Error('Download indisponível');}}),/Download indisponível/);
  assert.deepEqual(fs.readFileSync(source),original);
});
