import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {run} from './exec.mjs';
import {detectedSilences,keepRanges,prepareStandaloneNarration,voiceStudioState,voiceOptions} from './voice-studio.mjs';
import {transcriptStatus,renderVoiceSettings} from './narration-pipeline.mjs';
import {probeAudioDuration} from './audio.mjs';

const ffmpegOk=spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status===0 &&
 spawnSync('ffprobe',['-version'],{stdio:'ignore'}).status===0;
const rubber=ffmpegOk&&/\brubberband\b/.test(spawnSync('ffmpeg',['-filters'],{encoding:'utf8'}).stdout||'');
const createVoice=async(root)=>{
  const source=path.join(root,'source.wav');
  const filters=['anullsrc=r=48000:cl=mono:d=0.26',
    'sine=frequency=440:sample_rate=48000:duration=0.45',
    'anullsrc=r=48000:cl=mono:d=0.90',
    'sine=frequency=630:sample_rate=48000:duration=0.45',
    'anullsrc=r=48000:cl=mono:d=0.28'];
  const args=['-hide_banner','-loglevel','error','-y'];
  for(const source of filters)args.push('-f','lavfi','-i',source);
  await run('ffmpeg',[...args,'-filter_complex',
    filters.map((_,i)=>'['+i+':a]').join('')+'concat=n=5:v=0:a=1[a]',
    '-map','[a]',source]);
  return source;
};
const transcriber=async(audio,dest)=>{
  const dur=await probeAudioDuration(audio);
  const doc={language:'pt',segments:[{start:0,end:dur,text:'Exemplo de voz'}],
    words:[{word:'Exemplo',start:0,end:.3},{word:'de',start:.3,end:.6},{word:'voz',start:.6,end:dur}]};
  fs.writeFileSync(path.join(dest,'transcript.json'),JSON.stringify(doc));
  fs.writeFileSync(path.join(dest,'transcript.txt'),'Exemplo de voz');
  fs.writeFileSync(path.join(dest,'transcript.srt'),'1');
  return {wordCount:3,segmentCount:1,language:'pt',preview:'Exemplo de voz'};
};

test('silence parser trims edges and keeps an intentionally short middle gap',()=>{
  const events='silence_start: 0\nsilence_end: 0.26 | silence_duration: 0.26\n'+
    'silence_start: 0.71\nsilence_end: 1.61 | silence_duration: 0.90\n'+
    'silence_start: 2.06\nsilence_end: 2.34 | silence_duration: .28';
  const ranges=keepRanges(2.34,detectedSilences(events,2.34),{removeMiddleSilence:true,minSilence:.7});
  assert.equal(ranges.removed.length,3);
  assert.equal(ranges.cuts.length,2);
  assert.ok(ranges.duration>1&&ranges.duration<1.12,ranges.duration);
  const optional=keepRanges(2.34,detectedSilences(events,2.34),{removeMiddleSilence:false,minSilence:.7});
  assert.equal(optional.removed.length,2);
  assert.ok(optional.duration>1.7);
  assert.throws(()=>voiceOptions({pitchSemitones:6}),/Pitch permitido/);
});

test('standalone narration generates final WAV and transcript without edit_plan.json', {skip:!ffmpegOk},async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-voice-studio-'));
  try{
    const source=await createVoice(root);
    const processed=await prepareStandaloneNarration(root,{sourceFile:source,model:'base',
      options:{removeMiddleSilence:true,minSilence:.7,pitchSemitones:0},
      transcriber});
    assert.ok(!fs.existsSync(path.join(root,'edit_plan.json')),'No edit plan needed');
    assert.equal(processed.narration,'audio/narration.wav');
    assert.equal(processed.transcript,'transcript.json');
    assert.equal(processed.removedCount,3);
    assert.ok(fs.existsSync(path.join(root,'audio','narration.original.wav')));
    assert.ok(fs.existsSync(path.join(root,'audio','narration.prepared.wav')));
    const outputDuration=await probeAudioDuration(path.join(root,'audio','narration.wav'));
    assert.ok(outputDuration>1&&outputDuration<1.2,outputDuration);
    const state=voiceStudioState(root);
    assert.equal(state.ready,true);
    const plan={audio:{narration:'audio/narration.wav',voice:{normalize:true},
      silenceInserts:[{at:.5,duration:.4}]},sources:{transcript:'transcript.json'}};
    assert.equal(transcriptStatus(root,plan).kind,'voice-studio');
    assert.equal(transcriptStatus(root,plan).status,'external');
    const effective=renderVoiceSettings(root,plan);
    assert.equal(effective.voice.autoTrimSilence,false);
    assert.equal(effective.voice.normalize,false);
    assert.deepEqual(effective.silenceInserts,plan.audio.silenceInserts);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('optional lower pitch preserves duration and previous master can be regenerated', {skip:!rubber},async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-pitch-studio-'));
  try{
    const source=await createVoice(root);
    const first=await prepareStandaloneNarration(root,{sourceFile:source,options:{pitchSemitones:0},transcriber});
    const earlier=await probeAudioDuration(path.join(root,first.narration));
    const original=fs.readFileSync(path.join(root,first.source));
    const next=await prepareStandaloneNarration(root,{
      sourceFile:path.join(root,first.source),
      options:{pitchSemitones:-1,removeMiddleSilence:true},transcriber
    });
    const after=await probeAudioDuration(path.join(root,next.narration));
    assert.ok(Math.abs(earlier-after)<.07,{earlier,after});
    assert.deepEqual(fs.readFileSync(path.join(root,first.source)),original);
    assert.notDeepEqual(fs.readFileSync(path.join(root,next.narration)),
      fs.readFileSync(path.join(root,next.neutral)));
    assert.equal(voiceStudioState(root).ready,true);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
