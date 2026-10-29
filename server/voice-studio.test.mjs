import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {run} from './exec.mjs';
import {ffmpegFilterAvailable} from './runtime-tools.mjs';
import {detectedSilences,keepRanges,officialNarrationSource,prepareStandaloneNarration,voiceStudioState,voiceOptions,VOICE_PRESETS} from './voice-studio.mjs';
import {transcriptStatus,renderVoiceSettings} from './narration-pipeline.mjs';
import {probeAudioDuration} from './audio.mjs';

const ffmpegOk=spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status===0 &&
 spawnSync('ffprobe',['-version'],{stdio:'ignore'}).status===0;
const rubber=ffmpegOk&&ffmpegFilterAvailable(
  spawnSync('ffmpeg',['-hide_banner','-filters'],{encoding:'utf8'}).stdout||'','rubberband');
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
test('official treatment defaults to the current project narration.wav',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-official-narration-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'audio'));
  assert.throws(()=>officialNarrationSource(root),/audio\/narration\.wav/);
  const narration=path.join(root,'audio','narration.wav');fs.writeFileSync(narration,'current-master');
  fs.writeFileSync(path.join(root,'audio','narration.original.wav'),'older-source');
  assert.equal(officialNarrationSource(root),narration);
});
test('retratamento usa o original vinculado ao WAV atual, nunca um original antigo',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-source-selection-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const audio=path.join(root,'audio');fs.mkdirSync(audio);
  const current=path.join(audio,'narration.wav');
  const original=path.join(audio,'narration.original.wav');
  fs.writeFileSync(current,'TRATADO');fs.writeFileSync(original,'BRUTO PRESERVADO');
  assert.equal(officialNarrationSource(root),current,'sem manifesto, usar WAV bruto atual');
  const masterStat=fs.statSync(current);
  const meta={mode:'voice-studio',source:'audio/narration.original.wav',
    outputIdentity:{size:masterStat.size,mtimeMs:masterStat.mtimeMs}};
  const marker=path.join(root,'narration.build.json');
  fs.writeFileSync(marker,JSON.stringify(meta));
  assert.equal(officialNarrationSource(root),original,'com tratamento vigente, reutilizar o original');
  const raw=fs.readFileSync(original);
  fs.writeFileSync(current,'NOVA GRAVACAO');
  assert.equal(officialNarrationSource(root),current,'nova narração invalida o original anterior');
  assert.deepEqual(fs.readFileSync(original),raw,'original antigo não é sobrescrito ao selecionar a nova fonte');
  fs.writeFileSync(marker,JSON.stringify({...meta,source:'audio/narration.wav'}));
  assert.equal(officialNarrationSource(root),current,'finalização bruta usa a narração atual');
  const freshStat=fs.statSync(current);
  fs.writeFileSync(marker,JSON.stringify({...meta,outputIdentity:{size:freshStat.size,mtimeMs:freshStat.mtimeMs}}));
  assert.equal(officialNarrationSource(root),original);
  fs.rmSync(original);
  assert.throws(()=>officialNarrationSource(root),/original preservado não foi encontrado/,'não retratar áudio tratado se o bruto sumir');
  fs.writeFileSync(original,'BRUTO NOVO');
  fs.writeFileSync(marker,JSON.stringify({...meta,source:'../../outside.wav',outputIdentity:{size:freshStat.size,mtimeMs:freshStat.mtimeMs}}));
  assert.throws(()=>officialNarrationSource(root),/original de narração válido/,'não seguir caminhos arbitrários no manifesto');
});
test('duas execuções de tratamento preservam os bytes do bruto', {skip:!ffmpegOk},async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-retratamento-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const raw=await createVoice(root);
  const sourceBytes=fs.readFileSync(raw);
  const audio=path.join(root,'audio');fs.mkdirSync(audio);
  fs.copyFileSync(raw,path.join(audio,'narration.wav'));
  const selectedFirst=officialNarrationSource(root);
  assert.equal(selectedFirst,path.join(audio,'narration.wav'));
  await prepareStandaloneNarration(root,{sourceFile:selectedFirst,
    options:{removeMiddleSilence:true,minSilence:.7,voicePreset:'original'},transcriber});
  const original=path.join(audio,'narration.original.wav');
  assert.deepEqual(fs.readFileSync(original),sourceBytes);
  assert.equal(officialNarrationSource(root),original);
  await prepareStandaloneNarration(root,{sourceFile:officialNarrationSource(root),
    options:{removeMiddleSilence:false,trimEdges:false,normalize:false,voicePreset:'warm'},transcriber});
  assert.deepEqual(fs.readFileSync(original),sourceBytes,'segundo tratamento não troca o original pelo áudio processado');
  assert.equal(officialNarrationSource(root),original,'terceiro tratamento também usará a fonte bruta');
});
const transcriber=async(audio,dest,{detail}={})=>{
  const dur=await probeAudioDuration(audio);
  const doc={language:'pt',segments:[{start:0,end:dur,text:'Exemplo de voz'}],
    words:[{word:'Exemplo',start:0,end:.3},{word:'de',start:.3,end:.6},{word:'voz',start:.6,end:dur}]};
  fs.writeFileSync(path.join(dest,'transcript.json'),JSON.stringify(doc));
  fs.writeFileSync(path.join(dest,'transcript.txt'),'Exemplo de voz');
  fs.writeFileSync(path.join(dest,'transcript.srt'),'1');
  return {wordCount:3,segmentCount:1,language:'pt',detail,preview:'Exemplo de voz'};
};

test('FFmpeg rubberband detection reads an actual filter entry, not comments',()=>{
  const listed=['Filters:',' .. rubberband A->A Pitch-shift audio',
    ' .. bass A->A Boost or cut bass'].join(String.fromCharCode(10));
  assert.equal(ffmpegFilterAvailable(listed,'rubberband'),true);
  assert.equal(ffmpegFilterAvailable('ffmpeg version compiled with --enable-librubberband','rubberband'),false);
  assert.equal(ffmpegFilterAvailable(' ... rubberbanded A->A Audio','rubberband'),false);
});

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
  assert.equal(voiceOptions({voicePreset:'warm'}).pitchSemitones,0,
    'Natural-body preset must preserve the speaker fundamental pitch');
  assert.ok(voiceOptions({voicePreset:'gentle'}).pitchSemitones>-.5,
    'Gentle pitch should be subtler than the previous implementation');
  assert.equal(voiceOptions({voicePreset:'deep'}).pitchSemitones,VOICE_PRESETS.deep.pitchSemitones);
  assert.throws(()=>voiceOptions({voicePreset:'not-capcut'}),/não reconhecido/);
  assert.deepEqual(keepRanges(2.34,detectedSilences(events,2.34),{trimEdges:false,removeMiddleSilence:false}).cuts,[{start:0,end:2.34}]);
  for(const raw of [{targetLufs:0},{highpassHz:900},{normalize:'yes'},{compression:'false'},{minSilence:.14},{thresholdDb:-23}])assert.throws(()=>voiceOptions(raw));
  assert.equal(voiceOptions({minSilence:.15,thresholdDb:-24}).minSilence,.15);
  const aggressive=keepRanges(1,[{start:.2,end:.42}],{trimEdges:false,removeMiddleSilence:true,minSilence:.15,thresholdDb:-24});
  assert.equal(aggressive.removed.length,1);
  assert.ok(aggressive.duration<.9);
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
    assert.equal(processed.detail,'words','Voice Studio must forward the selected text detail');
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
    const corrected=JSON.parse(fs.readFileSync(path.join(root,'transcript.json'),'utf8'));
    corrected.words[0].word='CORRIGIDO';
    fs.writeFileSync(path.join(root,'transcript.json'),JSON.stringify(corrected));
    await prepareStandaloneNarration(root,{
      sourceFile:path.join(root,processed.source),
      options:{removeMiddleSilence:true,minSilence:.7},transcriber
    });
    const backups=fs.readdirSync(root).filter(name=>name.startsWith('transcript.backup-'));
    const natural=await prepareStandaloneNarration(root,{
      sourceFile:path.join(root,processed.source),
      options:{voicePreset:'warm',removeMiddleSilence:true,minSilence:.7},
      transcriber
    });
    assert.equal(natural.voicePreset,'warm');
    assert.equal(natural.pitchSemitones,0);
    const effectAudio=fs.readFileSync(path.join(root,natural.narration));
    const cleanAudio=fs.readFileSync(path.join(root,natural.neutral));
    assert.notDeepEqual(effectAudio,cleanAudio,'EQ effect should differ from neutral');
    assert.ok(Math.abs((await probeAudioDuration(path.join(root,natural.narration)))-
      (await probeAudioDuration(path.join(root,natural.neutral))))<.07);
    assert.ok(backups.length>=1,'Manual transcript correction must be backed up');
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,backups[0]),'utf8')).words[0].word,'CORRIGIDO');
    let enhanced=false;
    await prepareStandaloneNarration(root,{sourceFile:path.join(root,processed.source),options:{enhancementEngine:'deepfilter',enhancementStrength:70},
      enhancer:async(input,output,config)=>{enhanced=true;assert.equal(config.enhancementStrength,70);fs.copyFileSync(input,output);return {applied:true};},transcriber});
    assert.equal(enhanced,true);
    assert.deepEqual(fs.readFileSync(path.join(root,processed.source)),fs.readFileSync(source),'Original must remain untouched by enhancement');
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,'narration.build.json'))).enhancement.applied,true);
    const full=await prepareStandaloneNarration(root,{sourceFile:path.join(root,processed.source),options:{trimEdges:false,removeMiddleSilence:false,normalize:false,highpassHz:0,compression:true,deesser:true,reduceBreaths:true,breathReductionStrength:60},transcriber});
    assert.ok(Math.abs(full.duration-await probeAudioDuration(source))<.01,'Dynamics must not shorten the narration');
    const meta=JSON.parse(fs.readFileSync(path.join(root,'narration.build.json')));
    assert.equal(meta.options.normalize,false);assert.equal(meta.options.compression,true);assert.equal(meta.options.deesser,true);assert.equal(meta.removedCount,0);
    assert.equal(meta.options.reduceBreaths,true);assert.ok(Array.isArray(meta.breathReduction.ranges));

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
