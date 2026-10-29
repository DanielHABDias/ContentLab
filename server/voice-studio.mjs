import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {run} from './exec.mjs';
import {mediaToolExecutable,ffmpegFilterAvailable} from './runtime-tools.mjs';
import {prepareNarration,probeAudioDuration} from './audio.mjs';
import {transcribeAudio} from './transcribe.mjs';
import {enhanceVoice,enhancementOptions} from './voice-enhancement.mjs';
import {reduceBreaths,breathOptions} from './breath-reduction.mjs';

const fmt=x=>Number(x).toFixed(6);
const AUDIO_EXT=new Set(['.wav','.mp3','.m4a','.aac','.flac','.ogg','.opus']);
export const NARRATION_OUTPUT='audio/narration.wav';
export const NARRATION_NEUTRAL='audio/narration.prepared.wav';
export const VOICE_STUDIO_BUILD='narration.build.json';

// Intentionally independent of edit_plan.json. The editing plan is created AFTER
// the user approves this audio and its word-level transcription.
export function voiceStudioFolder(folder){
  if(typeof folder!=='string'||!folder.trim())throw Error('Informe a pasta de narração.');
  const root=fs.realpathSync(path.resolve(folder));
  if(!fs.statSync(root).isDirectory())throw Error('A pasta informada não é um diretório.');
  for(const name of ['audio']){
    const dir=path.join(root,name);
    if(fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw Error('Pasta de áudio não pode ser link simbólico.');
  }
  return root;
}
// Profiles are intentionally gentler than the previous pitch-only filter.
// CapCut does not disclose Super Deep's processing parameters: none of these
// presets should be described as an exact reproduction of that proprietary effect.
export const VOICE_PRESETS=Object.freeze({
  original:{pitchSemitones:0,bassGainDb:0},
  warm:{pitchSemitones:0,bassGainDb:1.8},
  gentle:{pitchSemitones:-0.2,bassGainDb:1.3},
  balanced:{pitchSemitones:-0.4,bassGainDb:1.7},
  deep:{pitchSemitones:-0.7,bassGainDb:2.1}
});
export function voiceOptions(raw={}){
  for(const key of ['trimEdges','normalize','compression','deesser'])if(raw[key]!==undefined&&typeof raw[key]!=='boolean')throw Error('Opção de tratamento inválida: '+key);
  const targetLufs=Number(raw.targetLufs??-16),highpassHz=Number(raw.highpassHz??70);
  if(!Number.isFinite(targetLufs)||targetLufs< -24||targetLufs> -12)throw Error('Volume alvo deve ficar entre -24 e -12 LUFS.');
  if(!Number.isFinite(highpassHz)||highpassHz<0||highpassHz>120)throw Error('Filtro de graves deve ficar entre 0 e 120 Hz.');
  const minSilence=raw.minSilence===undefined?.7:Number(raw.minSilence);
  const thresholdDb=raw.thresholdDb===undefined?-42:Number(raw.thresholdDb);
  const voicePreset=raw.voicePreset===undefined?
    (raw.pitchSemitones===undefined?'original':'legacy'):String(raw.voicePreset);
  if(voicePreset!=='legacy'&&!Object.hasOwn(VOICE_PRESETS,voicePreset))
    throw Error('Perfil de voz não reconhecido.');
  // Old API callers specifying pitchSemitones remain supported, but the UI
  // uses the carefully tuned named presets instead.
  const preset=voicePreset==='legacy'?null:VOICE_PRESETS[voicePreset];
  const pitchSemitones=preset?.pitchSemitones??Number(raw.pitchSemitones??0);
  const bassGainDb=preset?.bassGainDb??0;
  if(typeof raw.removeMiddleSilence!=='boolean'&&raw.removeMiddleSilence!==undefined)
    throw Error('Remoção de silêncio interno inválida.');
  if(!Number.isFinite(minSilence)||minSilence<.15||minSilence>2.5)
    throw Error('Silêncio interno mínimo deve ficar entre 0,15 e 2,5 segundos.');
  if(!Number.isFinite(thresholdDb)||thresholdDb< -55||thresholdDb> -24)
    throw Error('Limite de silêncio deve ficar entre -55 dB e -24 dB.');
  if(!Number.isFinite(pitchSemitones)||pitchSemitones< -3||pitchSemitones>0)
    throw Error('Pitch permitido: de -3 a 0 semitons.');
  return {removeMiddleSilence:raw.removeMiddleSilence!==false,minSilence,
    thresholdDb,voicePreset,pitchSemitones,bassGainDb,trimEdges:raw.trimEdges!==false,normalize:raw.normalize!==false,compression:raw.compression===true,deesser:raw.deesser===true,targetLufs,highpassHz,...enhancementOptions(raw),...breathOptions(raw)};
}
// FFmpeg silencedetect emits start/end pairs; retain speech-adjacent padding.
// No silence removal is allowed to depend on the edit plan's future pauses.
export function detectedSilences(stderr,duration){
  const matches=[...String(stderr).matchAll(/silence_(start|end):\s*([\d.]+)/g)];
  const regions=[];let start=null;
  for(const match of matches){
    const seconds=Number(match[2]);
    if(match[1]==='start'){start=seconds;continue;}
    if(start!==null&&seconds>start){regions.push({start,end:Math.min(duration,seconds)});start=null;}
  }
  if(start!==null)regions.push({start,end:duration});
  return regions.filter(r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.end>r.start);
}
export function keepRanges(duration,detected,options={}){
  const config=voiceOptions(options),keep=[];let cursor=0,removed=[];
  for(const gap of detected){
    const begin=Math.max(cursor,Math.min(duration,gap.start));
    const end=Math.max(begin,Math.min(duration,gap.end));
    const edgeStart=begin<=.10,edgeEnd=end>=duration-.10;
    const cut=edgeStart||edgeEnd?config.trimEdges:(config.removeMiddleSilence&&end-begin>=config.minSilence);
    if(!cut)continue;
    // Boundary silence must be removed almost entirely; the small 20ms
    // guard keeps a natural seam without leaving audible dead air.
    // O modo extremo deixa menor margem, sem remover a proteção dos encontros entre falas.
    const margin=config.minSilence<.45?.025:.085;
    const trimStart=edgeStart?0:edgeEnd?begin+.020:begin+margin;
    const trimEnd=edgeEnd?duration:edgeStart?end-.020:end-margin;
    if(trimEnd-trimStart<=.035)continue;
    if(trimStart>cursor+.005)keep.push({start:cursor,end:trimStart});
    removed.push({start:trimStart,end:trimEnd});
    cursor=trimEnd;
  }
  if(cursor<duration-.005)keep.push({start:cursor,end:duration});
  const result=keep.filter(r=>r.end-r.start>.015);
  const retained=result.reduce((n,r)=>n+r.end-r.start,0);
  if(retained<.1)throw Error('Não foi detectada narração utilizável. Confira o áudio e o limite de silêncio.');
  return {cuts:result,removed,originalDuration:duration,duration:retained};
}
export async function analyzeVoice(file,options={}, {ffmpeg='ffmpeg',ffprobe='ffprobe',signal}={}){
  const config=voiceOptions(options),duration=await probeAudioDuration(file,{ffprobe,signal});
  const {stderr}=await run(ffmpeg,['-hide_banner','-nostats','-loglevel','info','-i',file,
    '-af','silencedetect=noise='+config.thresholdDb+'dB:d='+Math.min(.18,config.minSilence*.7).toFixed(3),'-f','null','-'],{signal});
  return keepRanges(duration,detectedSilences(stderr,duration),config);
}
async function applyVoiceStyle(input,output,options,{ffmpeg='ffmpeg',ffprobe='ffprobe',signal}={}){
  const {pitchSemitones,bassGainDb}=options;
  if(pitchSemitones===0&&bassGainDb===0){
    fs.copyFileSync(input,output);
    return;
  }
  const filters=[];
  if(pitchSemitones!==0){
    const {stdout}=await run(ffmpeg,['-hide_banner','-filters'],{signal});
    if(!ffmpegFilterAvailable(stdout,'rubberband'))throw Error(
      'O executável FFmpeg usado pelo servidor ('+mediaToolExecutable(ffmpeg)+
      ') não oferece o filtro rubberband. Feche o Content Lab, atualize e abra pelo run.sh ou iniciar.bat para preparar o FFmpeg correto automaticamente.');
    const pitch=Math.pow(2,pitchSemitones/12);
    // Longer analysis window and smoothing reduce warbling on spoken vowels,
    // while formants are kept stable. Small pitch changes matter: do not
    // transpose the full human voice multiple semitones for a subtle preset.
    filters.push('rubberband=tempo=1:pitch='+pitch.toFixed(7)+
      ':formant=preserved:transients=smooth:detector=soft:phase=laminar'+
      ':window=long:smoothing=on:pitchq=quality');
  }
  if(bassGainDb>0){
    // Moderate low-shelf enhancement adds body without making the vowels
    // sound like a different person. Pull 320 Hz down slightly to avoid mud.
    filters.push('bass=g='+Number(bassGainDb).toFixed(2)+':f=150:w=0.8');
    filters.push('equalizer=f=320:t=q:w=1:g=-0.55');
  }
  const duration=await probeAudioDuration(input,{ffprobe,signal});
  filters.push('alimiter=limit=0.96:level=false','aresample=48000',
    'apad=whole_dur='+fmt(duration),'atrim=end='+fmt(duration));
  await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',input,'-vn',
    '-af',filters.join(','),'-ar','48000','-ac','2','-c:a','pcm_s16le',output],{signal});
  const final=await probeAudioDuration(output,{ffprobe,signal});
  if(Math.abs(final-duration)>.07)throw Error('Efeito de voz alterou a duração da narração.');
}
const atomicReplace=(source,destination)=>{
  const staged=destination+'.next-'+crypto.randomUUID();
  fs.copyFileSync(source,staged);
  try{fs.renameSync(staged,destination);}finally{fs.rmSync(staged,{force:true});}
};
export function voiceStudioState(folder){
  const root=voiceStudioFolder(folder),file=path.join(root,VOICE_STUDIO_BUILD);
  if(!fs.existsSync(file))return {ready:false};
  try{
    const build=JSON.parse(fs.readFileSync(file,'utf8'));
    const audio=path.join(root,NARRATION_OUTPUT);
    const transcript=path.join(root,'transcript.json');
    const stat=fs.existsSync(audio)?fs.statSync(audio):null;
    const ready=build.mode==='voice-studio'&&stat&&fs.existsSync(transcript)&&
      stat.size===build.outputIdentity?.size&&
      Math.abs(stat.mtimeMs-build.outputIdentity?.mtimeMs)<1;
    return {ready,source:build.source,options:build.options,duration:build.duration,
      removedCount:build.removedCount,output:NARRATION_OUTPUT,transcript:'transcript.json'};
  }catch{return {ready:false};}
}
export async function prepareStandaloneNarration(directory,{
  sourceFile,options={},model='small',language='pt',detail='words',
  update=()=>{},signal,ffmpeg='ffmpeg',ffprobe='ffprobe',transcriber=transcribeAudio,enhancer=enhanceVoice
}={}){
  const root=voiceStudioFolder(directory),config=voiceOptions(options);
  if(!sourceFile||!fs.existsSync(sourceFile))throw Error('Selecione um arquivo de narração válido.');
  const ext=path.extname(sourceFile).toLowerCase();
  if(!AUDIO_EXT.has(ext))throw Error('Extensão da narração não suportada.');
  const staged=fs.mkdtempSync(path.join(root,'.voice-studio-'+crypto.randomUUID()+'-'));
  try{
    // Source is never overwritten by effect edits. Reprocessing reuses the
    // original from disk, even when the output has the same project folder.
    const source=path.join(staged,'source'+ext);
    fs.copyFileSync(sourceFile,source);
    let working=source,enhancement={applied:false};
    if(config.enhancementEngine!=='off'&&config.enhancementStrength>0){
      working=path.join(staged,'enhanced.wav');
      enhancement=await enhancer(source,working,config,{ffmpeg,ffprobe,signal,update});
    }
    if(config.compression||config.deesser){
      update('Equilibrando a dinâmica e suavizando sibilância...');
      const processed=path.join(staged,'dynamics.wav'),filters=[];
      if(config.compression)filters.push('acompressor=threshold=0.125:ratio=2:attack=15:release=180:makeup=1');
      if(config.deesser)filters.push('deesser=i=0.15:m=0.3:f=0.5:s=o');
      await run(ffmpeg,['-hide_banner','-loglevel','error','-i',working,'-vn','-af',filters.join(','),'-ar','48000','-c:a','pcm_s16le',processed],{signal});
      if(Math.abs(await probeAudioDuration(processed,{ffprobe,signal})-await probeAudioDuration(working,{ffprobe,signal}))>.01)throw Error('O tratamento de dinâmica alterou a duração.');
      working=processed;
    }
    update('Localizando pausas e removendo silêncios de borda e intervalos internos longos...');
    const layout=await analyzeVoice(working,config,{ffmpeg,ffprobe,signal});
    const breathFile=path.join(staged,'breaths.wav');
    const breathReduction=await reduceBreaths(working,breathFile,config,{ffmpeg,signal,update});
    working=breathFile;
    const neutral=path.join(staged,'narration.prepared.wav');
    await prepareNarration(working,neutral,{
      sourceCuts:layout.cuts,voice:{autoTrimSilence:false,highpassHz:config.highpassHz,normalize:config.normalize,
        targetLufs:config.targetLufs,truePeakDb:-1.5}
    },{ffmpeg,ffprobe,signal,duration:layout.duration,autoTrimCuts:layout.cuts});
    const styled=path.join(staged,'narration.wav');
    update('Aplicando efeitos de voz opcionais...');
    await applyVoiceStyle(neutral,styled,config,{ffmpeg,ffprobe,signal});
    update('Transcrevendo o áudio limpo, antes dos efeitos de pitch...');
    const transcript=await transcriber(neutral,staged,{model,language,detail,signal,update});
    for(const name of ['transcript.json','transcript.txt','transcript.srt'])
      if(!fs.existsSync(path.join(staged,name)))throw Error('Transcrição não gerou '+name);
    if(signal?.aborted)throw Error('Preparação cancelada.');
    fs.mkdirSync(path.join(root,'audio'),{recursive:true});
    const original='audio/narration.original'+ext;
    atomicReplace(source,path.join(root,original));
    atomicReplace(neutral,path.join(root,NARRATION_NEUTRAL));
    atomicReplace(styled,path.join(root,NARRATION_OUTPUT));
    // Keep manually corrected text safe when reprocessing with another effect.
    const existing=path.join(root,'transcript.json');
    if(fs.existsSync(existing)&&fs.readFileSync(existing,'utf8')!==
      fs.readFileSync(path.join(staged,'transcript.json'),'utf8')){
      const backup=path.join(root,'transcript.backup-'+Date.now()+'-'+crypto.randomUUID()+'.json');
      fs.copyFileSync(existing,backup);
    }
    for(const name of ['transcript.json','transcript.txt','transcript.srt'])
      atomicReplace(path.join(staged,name),path.join(root,name));
    const identity=fs.statSync(path.join(root,NARRATION_OUTPUT));
    const meta={mode:'voice-studio',version:1,source:original,output:NARRATION_OUTPUT,
      neutral:NARRATION_NEUTRAL,outputIdentity:{size:identity.size,mtimeMs:identity.mtimeMs},
      duration:await probeAudioDuration(neutral,{ffprobe,signal}),originalDuration:layout.originalDuration,
      options:config,enhancement,breathReduction,removedCount:layout.removed.length,removedRanges:layout.removed,
      model,language,generatedAt:new Date().toISOString()};
    const written=path.join(staged,'narration.build.json');
    fs.writeFileSync(written,JSON.stringify(meta,null,2)+'\n');
    atomicReplace(written,path.join(root,VOICE_STUDIO_BUILD));
    // Do NOT stamp as an edit_plan transcript: inserted silences in the future
    // JSON must still be remapped from the source-cleaned word timeline.
    fs.writeFileSync(written,JSON.stringify({...meta,narrationStamp:null},null,2)+'\n');
    atomicReplace(written,path.join(root,'transcript.build.json'));
    update('Narração preparada e transcrição prontas para criar o edit_plan.json.');
    return {...transcript,source:original,narration:NARRATION_OUTPUT,
      neutral:NARRATION_NEUTRAL,transcript:'transcript.json',duration:meta.duration,
      removedCount:layout.removed.length,voicePreset:config.voicePreset,pitchSemitones:config.pitchSemitones};
  }finally{fs.rmSync(staged,{recursive:true,force:true});}
}
