import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {QWEN_MODELS,VOICE_MODELS,generationOptions,saveRecording,saveProfile,profile} from './voice-creation.mjs';
import {run} from './exec.mjs';

test('only official cloning Base sizes are accepted',()=>{
  assert.deepEqual(QWEN_MODELS,['0.6B','1.7B']);
  for(const model of ['3B','../model','CustomVoice'])assert.throws(()=>generationOptions({model,text:'Olá'}));
});
test('generation has bounded, explicit parameters and paragraph timing',()=>{
  const value=generationOptions({model:'0.6B',text:'Olá mundo!\n\nOutra ideia.',seed:42});
  assert.deepEqual(value.chunks,['Olá mundo!','Outra ideia.']);assert.equal(value.seed,42);assert.equal(value.language,'Portuguese');
  for(const model of QWEN_MODELS){const defaults=generationOptions({model,text:'Teste.'});assert.equal(defaults.temperature,.9);assert.equal(defaults.topP,1);assert.equal(defaults.repetitionPenalty,1.05);assert.equal(defaults.pauseSeconds,0);}
  for(const raw of [{temperature:Infinity},{topP:2},{seed:1.2},{device:'shell'},{pauseSeconds:-1},{repetitionPenalty:0},{language:'xx'}])assert.throws(()=>generationOptions({model:'1.7B',text:'Teste',...raw}));
  assert.throws(()=>generationOptions({model:'1.7B',text:'x'.repeat(12001)}));
  assert.ok(generationOptions({model:'1.7B',text:'a'.repeat(1500)}).chunks.every(x=>x.length<=400));
});
test('Chatterbox supports cloned voice expression without changing Qwen parameters',()=>{
  assert.ok(VOICE_MODELS.includes('chatterbox-multilingual'));
  const value=generationOptions({model:'chatterbox-multilingual',text:'Uma pergunta?\n\nAgora, a resposta!',exaggeration:.75,cfgWeight:.3});
  assert.deepEqual(value.chunks,['Uma pergunta?','Agora, a resposta!']);
  assert.equal(value.exaggeration,.75);assert.equal(value.cfgWeight,.3);
  for(const raw of [{exaggeration:-.1},{exaggeration:2.1},{cfgWeight:Infinity},{cfgWeight:-1},{cfgWeight:1.01}])assert.throws(()=>generationOptions({model:'chatterbox-multilingual',text:'Teste',...raw}));
  const neutral=generationOptions({model:'chatterbox-multilingual',text:'Olá.'});
  assert.equal(neutral.exaggeration,.5);assert.equal(neutral.cfgWeight,.5);
  assert.equal(neutral.temperature,.8);assert.equal(neutral.topP,1);assert.equal(neutral.repetitionPenalty,2);assert.equal(neutral.pauseSeconds,0);
  assert.deepEqual(generationOptions({model:'chatterbox-multilingual',text:'Será que muda tudo? Agora, a história fica interessante!'}).chunks,['Será que muda tudo?','Agora, a história fica interessante!']);
  assert.ok(generationOptions({model:'chatterbox-multilingual',text:('Uma frase longa ').repeat(40)}).chunks.every(x=>x.length<=200));
  assert.equal(generationOptions({model:'1.7B',text:'Olá.',exaggeration:2}).exaggeration,undefined);
  assert.throws(()=>generationOptions({model:'chatterbox-multilingual',text:'Teste',language:'Chinese'}),/integração Chatterbox/);
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
