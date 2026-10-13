import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {run} from './exec.mjs';
import {prepareNarration,probeAudioDuration} from './audio.mjs';
import {transcribeAudio} from './transcribe.mjs';

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
export function voiceOptions(raw={}){
  const minSilence=raw.minSilence===undefined?.7:Number(raw.minSilence);
  const thresholdDb=raw.thresholdDb===undefined?-42:Number(raw.thresholdDb);
  const pitchSemitones=raw.pitchSemitones===undefined?0:Number(raw.pitchSemitones);
  if(typeof raw.removeMiddleSilence!=='boolean'&&raw.removeMiddleSilence!==undefined)
    throw Error('Remoção de silêncio interno inválida.');
  if(!Number.isFinite(minSilence)||minSilence<.45||minSilence>2.5)
    throw Error('Silêncio interno mínimo deve ficar entre 0,45 e 2,5 segundos.');
  if(!Number.isFinite(thresholdDb)||thresholdDb< -55||thresholdDb> -30)
    throw Error('Limite de silêncio deve ficar entre -55 dB e -30 dB.');
  if(!Number.isFinite(pitchSemitones)||pitchSemitones< -3||pitchSemitones>0)
    throw Error('Pitch permitido: de -3 a 0 semitons.');
  return {removeMiddleSilence:raw.removeMiddleSilence!==false,minSilence,
    thresholdDb,pitchSemitones};
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
    const cut=edgeStart||edgeEnd||(config.removeMiddleSilence&&end-begin>=config.minSilence);
    if(!cut)continue;
    const trimStart=edgeStart?0:begin+.085;
    const trimEnd=edgeEnd?duration:end-.085;
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
    '-af','silencedetect=noise='+config.thresholdDb+'dB:d=0.18','-f','null','-'],{signal});
  return keepRanges(duration,detectedSilences(stderr,duration),config);
}
async function applyVoicePitch(input,output,options,{ffmpeg='ffmpeg',ffprobe='ffprobe',signal}={}){
  if(options.pitchSemitones===0){fs.copyFileSync(input,output);return;}
  const {stdout}=await run(ffmpeg,['-hide_banner','-filters'],{signal});
  if(!/\brubberband\b/.test(stdout))throw Error(
    'O FFmpeg instalado não inclui rubberband. Instale FFmpeg com --enable-librubberband ou escolha Voz original.');
  const duration=await probeAudioDuration(input,{ffprobe,signal});
  const pitch=Math.pow(2,options.pitchSemitones/12);
  await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',input,'-vn',
    '-af','rubberband=tempo=1:pitch='+pitch.toFixed(7)+':formant=preserved:pitchq=quality,'+
      'aresample=48000,apad=whole_dur='+fmt(duration)+',atrim=end='+fmt(duration),
    '-ar','48000','-ac','2','-c:a','pcm_s16le',output],{signal});
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
    const ready=build.mode==='voice-studio'&&fs.existsSync(audio)&&fs.existsSync(transcript)&&
      fs.statSync(audio).size===build.outputIdentity?.size;
    return {ready,source:build.source,options:build.options,duration:build.duration,
      removedCount:build.removedCount,output:NARRATION_OUTPUT,transcript:'transcript.json'};
  }catch{return {ready:false};}
}
export async function prepareStandaloneNarration(directory,{
  sourceFile,options={},model='small',language='pt',
  update=()=>{},signal,ffmpeg='ffmpeg',ffprobe='ffprobe',transcriber=transcribeAudio
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
    update('Localizando pausas e removendo silêncios de borda e intervalos internos longos...');
    const layout=await analyzeVoice(source,config,{ffmpeg,ffprobe,signal});
    const neutral=path.join(staged,'narration.prepared.wav');
    await prepareNarration(source,neutral,{
      sourceCuts:layout.cuts,voice:{autoTrimSilence:false,highpassHz:70,normalize:true,
        targetLufs:-16,truePeakDb:-1.5}
    },{ffmpeg,ffprobe,signal,duration:layout.duration,autoTrimCuts:layout.cuts});
    const styled=path.join(staged,'narration.wav');
    update('Aplicando efeitos de voz opcionais...');
    await applyVoicePitch(neutral,styled,config,{ffmpeg,ffprobe,signal});
    update('Transcrevendo o áudio limpo, antes dos efeitos de pitch...');
    const transcript=await transcriber(neutral,staged,{model,language,signal,update});
    for(const name of ['transcript.json','transcript.txt','transcript.srt'])
      if(!fs.existsSync(path.join(staged,name)))throw Error('Transcrição não gerou '+name);
    if(signal?.aborted)throw Error('Preparação cancelada.');
    fs.mkdirSync(path.join(root,'audio'),{recursive:true});
    const original='audio/narration.original'+ext;
    atomicReplace(source,path.join(root,original));
    atomicReplace(neutral,path.join(root,NARRATION_NEUTRAL));
    atomicReplace(styled,path.join(root,NARRATION_OUTPUT));
    for(const name of ['transcript.json','transcript.txt','transcript.srt'])
      atomicReplace(path.join(staged,name),path.join(root,name));
    const identity=fs.statSync(path.join(root,NARRATION_OUTPUT));
    const meta={mode:'voice-studio',version:1,source:original,output:NARRATION_OUTPUT,
      neutral:NARRATION_NEUTRAL,outputIdentity:{size:identity.size,mtimeMs:identity.mtimeMs},
      duration:await probeAudioDuration(neutral,{ffprobe,signal}),originalDuration:layout.originalDuration,
      options:config,removedCount:layout.removed.length,removedRanges:layout.removed,
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
      removedCount:layout.removed.length,pitchSemitones:config.pitchSemitones};
  }finally{fs.rmSync(staged,{recursive:true,force:true});}
}
