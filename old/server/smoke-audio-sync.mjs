import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {run} from './exec.mjs';
import {measureSfxEdges,edgeSilenceBounds,prepareNarration,mixAudio,probeAudioDuration} from './audio.mjs';

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-audio-sync-'));
const file=x=>path.join(folder,x);
try{
  const sfx=file('sfx.wav');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','anullsrc=r=48000:cl=mono:d=0.35',
    '-f','lavfi','-i','sine=frequency=600:sample_rate=48000:duration=0.2',
    '-f','lavfi','-i','anullsrc=r=48000:cl=mono:d=0.15',
    '-f','lavfi','-i','sine=frequency=850:sample_rate=48000:duration=0.25',
    '-f','lavfi','-i','anullsrc=r=48000:cl=mono:d=0.42',
    '-filter_complex','[0:a][1:a][2:a][3:a][4:a]concat=n=5:v=0:a=1[a]',
    '-map','[a]','-c:a','pcm_s16le',sfx]);
  const trim=await measureSfxEdges(sfx);
  assert.ok(trim.start>.30&&trim.start<.37,'Expected 350ms leading silence to disappear.');
  assert.ok(trim.end>.92&&trim.end<1.0,'Expected final 420ms silence removed.');
  assert.ok(trim.end-trim.start>.54,'Internal 150ms silence must not be removed.');
  assert.deepEqual(edgeSilenceBounds('',2),{start:0,end:2,empty:false});

  const visual=file('visual.mp4');
  const voice=file('voice.wav');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','color=c=black:s=320x180:r=15:d=4',
    '-c:v','libx264','-pix_fmt','yuv420p',visual]);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','anullsrc=r=48000:cl=stereo:d=4','-c:a','pcm_s16le',voice]);
  const plan={audio:{voice:{normalize:false},music:[]},timeline:[
    {id:'scene',start:0,end:4,elements:[{type:'sfx',at:1.25,asset:'project://sfx.wav'}]}
  ]};
  const result=file('result.mp4');
  const layers=await mixAudio(visual,voice,plan,{'project://sfx.wav':sfx},result,4);
  assert.equal(layers.length,1);
  assert.equal(layers[0].start,1.25);
  assert.ok(layers[0].edgeTrim.start>.3,'Cue must begin on the supplied at, without source preroll.');
  assert.ok(layers[0].edgeTrim.end>.39);

  // Decode short windows from the exported MP4: the effect must really become
  // audible near "at", and its internal silence must remain silent.
  const peakAt=async(source,start,length=.05)=>{
    const {stderr}=await run('ffmpeg',['-hide_banner','-nostats','-loglevel','info',
      '-i',source,'-vn','-af',
      'atrim=start='+String(start)+':end='+String(start+length)+',asetpts=PTS-STARTPTS,volumedetect',
      '-f','null','-']);
    const match=stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/);
    if(!match)throw Error('volumedetect não retornou pico de áudio.');
    return Number(match[1]);
  };
  const beforeCue=await peakAt(result,1.12);
  const firstTone=await peakAt(result,1.29);
  const middleGap=await peakAt(result,1.52);
  const lastTone=await peakAt(result,1.68);
  const wholePeak=await peakAt(result,0,4);
  const {stderr:timelineLog}=await run('ffmpeg',['-hide_banner','-nostats','-loglevel','info',
    '-i',result,'-vn','-af','silencedetect=noise=-50dB:d=0.03','-f','null','-']);
  const intervals=timelineLog.split('\n').filter(line=>line.includes('silence_start')||line.includes('silence_end')).slice(0,25);
  console.log('FINAL_AUDIO_TIMELINE',JSON.stringify({wholePeak,intervals}));
  console.log('AUDIBLE_CUE_PEAKS',JSON.stringify({beforeCue,firstTone,middleGap,lastTone}));
  assert.ok(firstTone>beforeCue+18,'SFX deve começar perto de at, sem leading silence: '+JSON.stringify({beforeCue,firstTone,middleGap,lastTone}));
  assert.ok(lastTone>middleGap+18,'Silêncio interno do efeito precisa continuar silencioso.');

  const tone=file('tone.wav');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','sine=frequency=350:sample_rate=48000:duration=4','-c:a','pcm_s16le',tone]);
  const aligned=file('aligned.wav');
  await prepareNarration(tone,aligned,{voice:{normalize:false,highpassHz:0},
    silenceInserts:[{at:1,duration:0.5}]},{duration:4.5});
  const seconds=await probeAudioDuration(aligned);
  assert.ok(Math.abs(seconds-4.5)<0.04,'Ripple narration duration must match video length.');
  assert.ok((await peakAt(aligned,.85))>(await peakAt(aligned,1.20))+18,
    'A inserção de silêncio deve interromper a voz exatamente no ponto solicitado.');
  assert.ok((await peakAt(aligned,1.70))>(await peakAt(aligned,1.20))+18,
    'A narração existente deve continuar após a pausa adicionada.');
  console.log(JSON.stringify({status:'passed',trimStart:trim.start,trimEnd:trim.end,
    audioLayers:layers.length,narrationSeconds:seconds}));
}finally{fs.rmSync(folder,{recursive:true,force:true});}
