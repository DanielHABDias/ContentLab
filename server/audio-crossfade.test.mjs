import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {run} from './exec.mjs';
import {mixAudio,narrationCuts,prepareNarration,probeOutput,probeAudioDuration,analyzeNarrationEdges,measureAudioSliceEdges} from './audio.mjs';
import {remapTranscriptWords} from './remotion.mjs';
import {validatePlan,validateShape} from './plan.mjs';

const ffmpegAvailable=spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status===0&&
  spawnSync('ffprobe',['-version'],{stdio:'ignore'}).status===0;

test('narrationTrim is an alternative to sourceCuts, not an addition',()=>{
 const plan={project:{name:'audio',format:'youtube_long',profile:'generic'},
   audio:{narration:'audio/voice.wav',narrationTrim:{start:1,end:3},
     voice:{fadeIn:.25,fadeOut:.5},music:[
       {asset:'project://music/a.wav',start:0,end:4,sourceStart:.5,sourceEnd:1.5,fadeOut:1},
       {asset:'project://music/b.wav',start:3,end:6,sourceStart:0,sourceEnd:2,fadeIn:1}]},
   timeline:[{id:'s1',start:0,end:6,layout:'fullscreen',elements:[]}]};
 assert.deepEqual(narrationCuts(plan.audio),[{start:1,end:3}]);
 assert.deepEqual(validateShape(plan),[]);
 assert.deepEqual(validatePlan(plan),[]);
 plan.audio.sourceCuts=[{start:0,end:1}];
 assert.ok(validatePlan(plan).some(e=>e.path==='audio.narrationTrim'));
 delete plan.audio.sourceCuts;
 plan.audio.music[0].sourceEnd=.25;
 assert.ok(validatePlan(plan).some(e=>e.path==='audio.music.0.sourceEnd'));
 plan.audio.music[0].sourceEnd=1.5;
 plan.audio.music[0].fadeOut=5;
 assert.ok(validatePlan(plan).some(e=>e.path==='audio.music.0.fadeOut'));
});

test('FFmpeg trims a narration, fades voice, and mixes two overlapping, independently trimmed music beds', {skip:!ffmpegAvailable},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-audio-crossfade-'));
 try{
  const voice=path.join(root,'voice.wav'),cleaned=path.join(root,'clean.wav');
  const musicA=path.join(root,'a.wav'),musicB=path.join(root,'b.wav');
  const video=path.join(root,'black.mp4'),output=path.join(root,'result.mp4');
  const makeTone=async(dest,freq,seconds)=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','sine=frequency='+freq+':sample_rate=48000:duration='+seconds,dest]);
  await makeTone(voice,340,4);
  await makeTone(musicA,440,2);
  await makeTone(musicB,700,2);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi',
    '-i','color=c=black:s=320x180:r=10:d=6','-c:v','mpeg4',video]);
  const audio={narration:'voice.wav',narrationTrim:{start:1,end:3},
    voice:{normalize:false,highpassHz:0,fadeIn:.25,fadeOut:.75},
    ducking:{enabled:false},music:[
      {asset:'project://audio/a.wav',start:0,end:4,sourceStart:.5,sourceEnd:1.5,fadeOut:1,trimDb:-18},
      {asset:'project://audio/b.wav',start:3,end:6,sourceStart:.25,sourceEnd:1.25,fadeIn:1,fadeOut:.5,trimDb:-18}
    ]};
  await prepareNarration(voice,cleaned,audio,{ffmpeg:'ffmpeg'});
  assert.ok(Math.abs((await probeAudioDuration(cleaned))-2)<.025);
  const plan={audio,timeline:[]};
  const layers=await mixAudio(video,cleaned,plan,{
    'project://audio/a.wav':musicA,'project://audio/b.wav':musicB},output,6,{ffmpeg:'ffmpeg',ffprobe:'ffprobe'});
  assert.equal(layers.length,2);
  assert.deepEqual(layers.map(x=>[x.start,x.end,x.fadeIn,x.fadeOut]),[[0,4,0,1],[3,6,1,.5]]);
  assert.deepEqual(layers.map(x=>[x.sourceStart,x.sourceEnd]),[[.5,1.5],[.25,1.25]]);
  const probed=await probeOutput(output);
  assert.ok(Math.abs(probed.videoDuration-6)<.25);
  assert.ok(Math.abs(probed.audioDuration-6)<.25);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('automatic narration edge trim preserves internal pauses and keeps transcript timestamps aligned', {skip:!ffmpegAvailable},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-voice-edge-trim-'));
 try{
  const voice=path.join(root,'voice.wav'),out=path.join(root,'clean.wav');
  // .4 s silence + .7 s tone + .3 s INTERNAL silence + .7 s tone + .5 s silence
  const inputs=[
    'anullsrc=r=48000:cl=mono:d=0.4',
    'sine=frequency=440:sample_rate=48000:duration=0.7',
    'anullsrc=r=48000:cl=mono:d=0.3',
    'sine=frequency=660:sample_rate=48000:duration=0.7',
    'anullsrc=r=48000:cl=mono:d=0.5'
  ];
  const args=['-hide_banner','-loglevel','error','-y'];
  for(const src of inputs)args.push('-f','lavfi','-i',src);
  args.push('-filter_complex','[0:a][1:a][2:a][3:a][4:a]concat=n=5:v=0:a=1[out]',
    '-map','[out]',voice);
  await run('ffmpeg',args);
  const settings={voice:{normalize:false,highpassHz:0,autoTrimSilence:true}};
  const trim=await analyzeNarrationEdges(voice,settings);
  assert.ok(Math.abs(trim.headSeconds-.4)<.06,JSON.stringify(trim));
  assert.ok(Math.abs(trim.tailSeconds-.5)<.06,JSON.stringify(trim));
  await prepareNarration(voice,out,settings,{autoTrimCuts:trim.cuts});
  // .7 + INTERNAL .3 + .7 = 1.7 s. Interior pause is preserved.
  assert.ok(Math.abs((await probeAudioDuration(out))-1.7)<.09);
  const words=remapTranscriptWords([{word:'START',start:.5,end:.7},
    {word:'AFTER PAUSE',start:1.55,end:1.75}],trim.cuts);
  assert.ok(Math.abs(words[0].start-.1)<.06,JSON.stringify(words));
  assert.ok(Math.abs(words[1].start-1.15)<.06,JSON.stringify(words));
  const full=path.join(root,'full.wav');
  await prepareNarration(voice,full,{voice:{normalize:false,highpassHz:0,autoTrimSilence:false}});
  assert.ok(Math.abs((await probeAudioDuration(full))-2.6)<.09);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('music auto trim removes only edges before repeating and applying fades', {skip:!ffmpegAvailable},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-music-edge-trim-'));
 try{
  const tone=path.join(root,'music.wav'),voice=path.join(root,'voice.wav'),
    video=path.join(root,'video.mp4'),out=path.join(root,'final.mp4');
  const inputs=['anullsrc=r=48000:cl=mono:d=0.4',
    'sine=frequency=440:sample_rate=48000:duration=0.8',
    'anullsrc=r=48000:cl=mono:d=0.3',
    'sine=frequency=500:sample_rate=48000:duration=0.8',
    'anullsrc=r=48000:cl=mono:d=0.5'];
  const args=['-hide_banner','-loglevel','error','-y'];
  for(const src of inputs)args.push('-f','lavfi','-i',src);
  args.push('-filter_complex','[0:a][1:a][2:a][3:a][4:a]concat=n=5:v=0:a=1[out]','-map','[out]',tone);
  await run('ffmpeg',args);
  const edges=await measureAudioSliceEdges(tone);
  assert.ok(Math.abs(edges.start-.4)<.06);
  assert.ok(Math.abs(edges.duration-edges.end-.5)<.06);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi',
    '-i','anullsrc=r=48000:cl=stereo:d=5',voice]);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi',
    '-i','color=c=black:s=320x180:r=10:d=5','-c:v','mpeg4',video]);
  const plan={audio:{narration:'voice.wav',ducking:{enabled:false},
    voice:{normalize:false},music:[
      {asset:'project://audio/music.wav',start:0,end:5,fadeIn:.5,fadeOut:.6,trimDb:-20}
    ]},timeline:[]};
  const layers=await mixAudio(video,voice,plan,{'project://audio/music.wav':tone},
    out,5);
  assert.equal(layers.length,1);
  assert.ok(layers[0].autoSilenceTrim,JSON.stringify(layers));
  assert.ok(Math.abs(layers[0].autoSilenceTrim.start-.4)<.06);
  assert.ok(Math.abs(layers[0].autoSilenceTrim.end-.5)<.06);
  assert.ok(Math.abs((await probeOutput(out)).audioDuration-5)<.2);
  const outNoTrim=path.join(root,'no-trim.mp4');
  plan.audio.music[0].autoTrimSilence=false;
  const regular=await mixAudio(video,voice,plan,{'project://audio/music.wav':tone},
    outNoTrim,5);
  assert.equal(regular[0].autoSilenceTrim,undefined);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
