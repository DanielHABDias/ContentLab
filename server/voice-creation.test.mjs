import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {QWEN_MODELS,generationOptions,saveRecording,saveProfile,profile} from './voice-creation.mjs';
import {run} from './exec.mjs';

test('only official cloning Base sizes are accepted',()=>{
  assert.deepEqual(QWEN_MODELS,['0.6B','1.7B']);
  for(const model of ['3B','../model','CustomVoice'])assert.throws(()=>generationOptions({model,text:'Olá'}));
});
test('generation has bounded, explicit parameters and paragraph timing',()=>{
  const value=generationOptions({model:'0.6B',text:'Olá mundo!\n\nOutra ideia.',seed:42});
  assert.deepEqual(value.chunks,['Olá mundo!','Outra ideia.']);assert.equal(value.seed,42);assert.equal(value.language,'Portuguese');
  for(const raw of [{temperature:Infinity},{topP:2},{seed:1.2},{device:'shell'},{pauseSeconds:-1},{repetitionPenalty:0},{language:'xx'}])assert.throws(()=>generationOptions({model:'1.7B',text:'Teste',...raw}));
  assert.throws(()=>generationOptions({model:'1.7B',text:'x'.repeat(12001)}));
  assert.ok(generationOptions({model:'1.7B',text:'a'.repeat(1500)}).chunks.every(x=>x.length<=400));
});
test('profile IDs cannot escape the voice directory',()=>{
  for(const id of ['../../secret','id','',null])assert.throws(()=>profile(id));
});
test('profiles require explicit consent and reference transcript before reading input',async()=>{
  await assert.rejects(saveProfile('/missing',{name:'A',referenceText:'Voz'}),/autorização/);
  await assert.rejects(saveProfile('/missing',{name:'A',referenceText:'',consent:true}),/transcrição/);
});
test('recording persists untouched timeline and unique originals without edit plan',async t=>{
  try{await run('ffmpeg',['-version']);}catch{t.skip('FFmpeg não disponível');return;}
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'voice-record-test-'));
  try{
    const input=path.join(root,'input.wav');
    await run('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=0.5','-c:a','pcm_s16le',input]);
    const first=await saveRecording(input,root),second=await saveRecording(input,root);
    assert.notEqual(first.file,second.file);assert.ok(fs.existsSync(first.file));
    assert.ok(Math.abs(first.duration-.5)<.02);
    assert.equal(path.dirname(first.file),path.join(root,'audio','takes'));
    assert.equal(fs.existsSync(first.file+'.json'),false);
    assert.equal(fs.existsSync(path.join(root,'edit_plan.json')),false);
    assert.equal(fs.existsSync(path.join(root,'audio','narration.wav')),false);
    if(process.platform!=='win32'){
      const elsewhere=fs.mkdtempSync(path.join(os.tmpdir(),'voice-outside-'));t.after(()=>fs.rmSync(elsewhere,{recursive:true,force:true}));
      const bad=path.join(root,'bad');fs.mkdirSync(bad);fs.symlinkSync(elsewhere,path.join(bad,'audio'));
      await assert.rejects(saveRecording(input,bad),/simbólico/);
    }
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
