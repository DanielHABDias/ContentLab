import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {recordingTreatmentOptions,treatRecording} from './recording-treatment.mjs';
import {saveRecording} from './voice-creation.mjs';
import {addTake,finalizeTakes} from './narration-assembly.mjs';
import {probeAudioDuration} from './audio.mjs';
import {run} from './exec.mjs';

test('recording defaults enable strong AI and balanced voice without destroying pauses or pitch',()=>{
  const config=recordingTreatmentOptions();
  assert.equal(config.enabled,true);assert.equal(config.enhancementEngine,'deepfilter');assert.equal(config.enhancementStrength,100);
  assert.equal(config.enhancementMode,'strong');assert.equal(config.compression,true);assert.equal(config.deesser,true);assert.equal(config.normalize,true);
  assert.equal(config.highpassHz,70);assert.equal(config.targetLufs,-16);assert.equal(config.removeMiddleSilence,false);assert.equal(config.pitchSemitones,0);
  assert.equal(config.reduceBreaths,true);assert.equal(config.breathReductionStrength,60);
  for(const invalid of [null,[],{enabled:'false'},{targetLufs:-40},{compression:'true'},{enhancementStrength:110}])assert.throws(()=>recordingTreatmentOptions(invalid));
});
test('disabled recording treatment copies bytes exactly and never invokes AI',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'recording-disabled-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const input=path.join(root,'in.wav'),output=path.join(root,'out.wav');fs.writeFileSync(input,'untouched test fixture');
  const result=await treatRecording(input,output,{enabled:false},{enhancer:()=>{throw Error('Must not invoke AI');}});
  assert.equal(result.applied,false);assert.deepEqual(fs.readFileSync(output),fs.readFileSync(input));
});
test('recording finalization is always raw, even if legacy clients request treatment',async t=>{
  try{await run('ffmpeg',['-version']);}catch{t.skip('FFmpeg indisponível');return;}
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'recording-raw-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const input=path.join(root,'sample.wav');await run('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=frequency=330:duration=2',input]);
  const saved=await saveRecording(input,root);addTake(root,{...saved,kind:'recording'});const raw=fs.readFileSync(saved.file);
  const transcriber=async(audio,dir)=>{
    const duration=await probeAudioDuration(audio);assert.ok(Math.abs(duration-2)<.02);
    const doc={words:[{word:'Teste',start:0,end:duration}],segments:[{text:'Teste',start:0,end:duration}]};
    fs.writeFileSync(path.join(dir,'transcript.json'),JSON.stringify(doc));for(const ext of ['txt','srt'])fs.writeFileSync(path.join(dir,'transcript.'+ext),'Teste');return {wordCount:1,segmentCount:1};
  };
  const result=await finalizeTakes(root,{treatment:{enabled:true,removeMiddleSilence:true,enhancementEngine:'deepfilter'},enhancement:{enhancementEngine:'deepfilter'},enhancer:()=>{throw Error('Should not run enhancement');},transcriber});
  assert.equal(result.treatment,null);
  const meta=JSON.parse(fs.readFileSync(path.join(root,'narration.build.json')));
  assert.deepEqual(meta.processing,[]);assert.equal(meta.treatment,null);
  assert.deepEqual(fs.readFileSync(saved.file),raw);
  assert.ok(Math.abs(await probeAudioDuration(path.join(root,'audio/narration.wav'))-2)<.02);
});
