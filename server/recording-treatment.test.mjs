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
  for(const invalid of [null,[],{enabled:'false'},{targetLufs:-40},{compression:'true'},{enhancementStrength:110}])assert.throws(()=>recordingTreatmentOptions(invalid));
});
test('disabled recording treatment copies bytes exactly and never invokes AI',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'recording-disabled-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const input=path.join(root,'in.wav'),output=path.join(root,'out.wav');fs.writeFileSync(input,'untouched test fixture');
  const result=await treatRecording(input,output,{enabled:false},{enhancer:()=>{throw Error('Must not invoke AI');}});
  assert.equal(result.applied,false);assert.deepEqual(fs.readFileSync(output),fs.readFileSync(input));
});
test('treated recording transcribes final clock, preserves takes and rolls back failed AI',async t=>{
  try{await run('ffmpeg',['-version']);}catch{t.skip('FFmpeg indisponível');return;}
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'recording-complete-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const input=path.join(root,'sample.wav');await run('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=frequency=330:duration=2','-af','adelay=400,apad=pad_dur=0.4',input]);
  const saved=await saveRecording(input,root);addTake(root,{...saved,kind:'recording'});const raw=fs.readFileSync(saved.file);
  let enhanced=false;
  const transcriber=async(audio,dir)=>{
    assert.equal(enhanced,true);const duration=await probeAudioDuration(audio);assert.ok(duration<2.3);
    const doc={words:[{word:'Teste',start:0,end:duration}],segments:[{text:'Teste',start:0,end:duration}]};
    fs.writeFileSync(path.join(dir,'transcript.json'),JSON.stringify(doc));for(const ext of ['txt','srt'])fs.writeFileSync(path.join(dir,'transcript.'+ext),'Teste');return {wordCount:1,segmentCount:1};
  };
  const result=await finalizeTakes(root,{treatment:{},transcriber,enhancer:async(source,dest,options)=>{assert.equal(options.enhancementEngine,'deepfilter');enhanced=true;fs.copyFileSync(source,dest);return {applied:true};}});
  assert.equal(result.treatment.applied,true);assert.ok(result.treatment.processing.includes('loudness'));assert.ok(result.treatment.processing.includes('compression'));
  assert.deepEqual(fs.readFileSync(saved.file),raw);
  for(const file of [saved.file,path.join(root,'audio/narration.wav')]){
    const {stdout}=await run('ffprobe',['-v','error','-show_entries','stream=codec_name,sample_rate,channels,bits_per_sample','-of','json',file]);
    const stream=JSON.parse(stdout).streams[0];
    assert.equal(stream.codec_name,'pcm_s24le');assert.equal(stream.sample_rate,'48000');assert.equal(stream.channels,1);assert.equal(stream.bits_per_sample,24);
  }
  const final=fs.readFileSync(path.join(root,'audio/narration.wav')),transcript=fs.readFileSync(path.join(root,'transcript.json'));
  const meta=JSON.parse(fs.readFileSync(path.join(root,'narration.build.json')));assert.ok(meta.treatment.removedRanges.length);assert.equal(meta.options.removeMiddleSilence,false);
  await assert.rejects(finalizeTakes(root,{treatment:{},transcriber,enhancer:async()=>{throw Error('AI failed');}}),/AI failed/);
  assert.deepEqual(fs.readFileSync(path.join(root,'audio/narration.wav')),final);assert.deepEqual(fs.readFileSync(path.join(root,'transcript.json')),transcript);
  assert.deepEqual(fs.readdirSync(path.join(root,'audio')).sort(),['narration.wav','takes']);
  await finalizeTakes(root,{treatment:{enabled:false},transcriber:async(audio,dir)=>{
    fs.writeFileSync(path.join(dir,'transcript.json'),transcript);for(const ext of ['txt','srt'])fs.writeFileSync(path.join(dir,'transcript.'+ext),'Teste');return {wordCount:1,segmentCount:1};
  }});
  const {stdout}=await run('ffprobe',['-v','error','-show_entries','stream=codec_name,sample_rate,channels','-of','json',path.join(root,'audio/narration.wav')]);
  assert.deepEqual(JSON.parse(stdout).streams[0],{codec_name:'pcm_s24le',sample_rate:'48000',channels:1});
});
