import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {run} from './exec.mjs';
import {saveRecording} from './voice-creation.mjs';
import {takeList,addTake,editTakes,deleteTake,finalizeTakes,boundedTranscript} from './narration-assembly.mjs';
import {voiceStudioState} from './voice-studio.mjs';
import {renderVoiceSettings} from './narration-pipeline.mjs';
test('recognition tails cannot exceed the assembled audio duration',()=>{
  const result=boundedTranscript({words:[{word:'fim',start:.6,end:1.3}],segments:[{text:'fim',start:.6,end:1.3}]},1);
  assert.equal(result.words[0].end,1);assert.equal(result.segments[0].end,1);
  assert.throws(()=>boundedTranscript({words:[],segments:[]},1),/reconhecidas/);
});
test('takes persist, reorder, exclude and finalize with a transcript on the final audio clock',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'narration-assembly-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  try{await run('ffmpeg',['-version']);}catch{t.skip('FFmpeg indisponível');return;}
  for(const [index,duration] of [[0,.4],[1,.6],[2,.8]]){
    const file=path.join(root,'sample-'+index+'.wav');await run('ffmpeg',['-loglevel','error','-f','lavfi','-i',`sine=frequency=${330+index*100}:duration=${duration}`,file]);
    const saved=await saveRecording(file,root);addTake(root,{...saved,kind:'recording'});
  }
  const current=takeList(root);assert.equal(current.takes.length,3);
  const reordered=[current.takes[1],{...current.takes[2],selected:false},current.takes[0]];
  editTakes(root,reordered,current.revision);
  assert.throws(()=>editTakes(root,reordered,current.revision),/mudaram/);
  assert.throws(()=>editTakes(root,[],takeList(root).revision),/preservar/);
  const transcriber=async(audio,dir)=>{
    assert.ok(fs.statSync(audio).size>1000);
    const doc={words:[{word:'Teste',start:0,end:1}],segments:[{text:'Teste',start:0,end:1}]};
    fs.writeFileSync(path.join(dir,'transcript.json'),JSON.stringify(doc));
    for(const ext of ['txt','srt'])fs.writeFileSync(path.join(dir,'transcript.'+ext),'Teste');
    return {wordCount:1,segmentCount:1,preview:'Teste'};
  };
  const result=await finalizeTakes(root,{transcriber});
  assert.ok(Math.abs(result.duration-1)<.03);assert.equal(result.takeCount,2);
  assert.equal(voiceStudioState(root).ready,true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'narration.build.json'))).takes,[current.takes[1].name,current.takes[0].name]);
  assert.equal(renderVoiceSettings(root,{audio:{narration:'audio/narration.wav'}}).voice.autoTrimSilence,false);
  const original=fs.readFileSync(path.join(root,'audio/narration.wav'));
  await assert.rejects(finalizeTakes(root,{transcriber:async()=>{throw Error('Whisper indisponível');}}),/Whisper/);
  assert.deepEqual(fs.readFileSync(path.join(root,'audio/narration.wav')),original);
  let enhanced=false;
  const second=await finalizeTakes(root,{transcriber,enhancement:{enhancementEngine:'deepfilter'},treatment:{enabled:true},enhancer:async()=>{enhanced=true;throw Error('Never treat at finalization');}});assert.ok(second.backup);
  assert.equal(enhanced,false,'Neither explicit enhancement nor treatment runs when joining takes');
  assert.equal(second.treatment,null);
  assert.deepEqual(fs.readFileSync(path.join(root,'audio/narration.wav')),original);
  assert.ok(fs.existsSync(path.join(root,second.backup,'transcript.json')));
  assert.equal(fs.existsSync(path.join(root,'edit_plan.json')),false);
  for(const take of current.takes)assert.ok(fs.existsSync(path.join(root,'audio','takes',take.name)));
  assert.deepEqual(fs.readdirSync(path.join(root,'audio')).sort(),['narration.wav','takes']);
  const before=takeList(root),name=before.takes[0].name,file=path.join(root,'audio','takes',name),wav=fs.readFileSync(file);
  fs.writeFileSync(file+'.json','{}');
  assert.throws(()=>deleteTake(root,name,'stale'),/mudaram/);
  assert.throws(()=>deleteTake(root,'../narration.wav',before.revision),/encontrada/);
  const deleted=deleteTake(root,name,before.revision);
  assert.equal(deleted.takes.length,2);assert.equal(fs.existsSync(file),false);
  assert.deepEqual(fs.readFileSync(path.join(root,deleted.recovery,name)),wav);
  assert.equal(fs.existsSync(path.join(root,deleted.recovery,name+'.json')),true);
  assert.deepEqual(fs.readFileSync(path.join(root,'audio/narration.wav')),original,'Deleting a take must not replace the existing final narration');
  const rebuilt=await finalizeTakes(root,{transcriber});assert.equal(rebuilt.takeCount,1);
  assert.ok(Math.abs(rebuilt.duration-.4)<.03);
  for(const item of takeList(root).takes)deleteTake(root,item.name,takeList(root).revision);
  assert.equal(takeList(root).takes.length,0);
  await assert.rejects(finalizeTakes(root,{transcriber}),/Selecione/);
});
