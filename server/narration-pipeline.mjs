import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {readJson,projectFile} from './plan.mjs';
import {analyzeNarrationEdges,prepareNarration,probeAudioDuration,narrationCuts,silenceSourcePositions} from './audio.mjs';
import {transcribeAudio} from './transcribe.mjs';

export const TRANSCRIPT_FILE='transcript.json';
export const TRANSCRIPT_BUILD='transcript.build.json';
export const PREPARED_NARRATION='audio/narration.prepared.wav';

// Only changes that alter the AUDIO SAMPLE CLOCK invalidate the transcript.
// Volume, music, motion and fades do not change any recognized word's time.
export function narrationStamp(root,plan){
  const filename=path.resolve(root,plan.audio?.narration||'');
  if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename))return null;
  const stat=fs.statSync(filename),voice=plan.audio?.voice||{};
  const timing={
    narration:plan.audio.narration,
    file:{size:stat.size,mtimeMs:stat.mtimeMs},
    narrationTrim:plan.audio.narrationTrim,
    sourceCuts:plan.audio.sourceCuts||[],
    silenceInserts:plan.audio.silenceInserts||[],
    autoTrimSilence:voice.autoTrimSilence!==false,
    highpassHz:voice.highpassHz??70,
    normalize:voice.normalize!==false,
    targetLufs:voice.targetLufs??-16,
    truePeakDb:voice.truePeakDb??-1.5,
    buildVersion:2
  };
  return crypto.createHash('sha256').update(JSON.stringify(timing)).digest('hex');
}
export function renderVoiceSettings(root,plan){
  const audio=plan.audio||{};
  try{
    const meta=readJson(path.join(root,'narration.build.json'));
    if(meta.mode!=='voice-studio'||audio.narration!==meta.output)return audio;
    const file=path.join(root,meta.output);
    if(!fs.existsSync(file)||fs.statSync(file).size!==meta.outputIdentity?.size)return audio;
    // This audio was already cut, normalized and optionally pitch-shifted
    // BEFORE the edit plan existed. Preserve later editorial sourceCuts and
    // silenceInserts, but never process the source a second time.
    return {...audio,voice:{...audio.voice,autoTrimSilence:false,highpassHz:0,normalize:false}};
  }catch{return audio;}
}
export function transcriptStatus(root,plan){
  if(plan.sources?.transcript!==TRANSCRIPT_FILE)return {status:'external'};
  const file=path.join(root,TRANSCRIPT_FILE),metadata=path.join(root,TRANSCRIPT_BUILD);
  if(!fs.existsSync(file))return {status:'missing'};
  if(!fs.existsSync(metadata))return {status:'external'};
  try{
    const meta=readJson(metadata);
    if(meta.mode==='voice-studio'){
      if(meta.output!==plan.audio?.narration)return {status:'external'};
      const output=path.join(root,meta.output);
      const intact=fs.existsSync(output)&&fs.statSync(output).size===meta.outputIdentity?.size;
      return {status:intact?'external':'stale',kind:'voice-studio',prepared:meta.output,
        generatedAt:meta.generatedAt};
    }
    const stamp=narrationStamp(root,plan);
    return {status:stamp&&meta.narrationStamp===stamp?'ready':'stale',
      prepared:meta.prepared,language:meta.language,generatedAt:meta.generatedAt};
  }catch{return {status:'stale'};}
}
function moveAtomic(source,destination){
  const stage=destination+'.next-'+crypto.randomUUID();
  fs.copyFileSync(source,stage);
  fs.renameSync(stage,destination);
}
export async function prepareAndTranscribeProject(directory,{
  model='base',language='pt',ffmpeg='ffmpeg',ffprobe='ffprobe',signal,
  update=()=>{},transcriber=transcribeAudio
}={}){
  const {root,file}=projectFile(directory),plan=readJson(file);
  const narration=path.resolve(root,plan.audio?.narration||'');
  if(!narration.startsWith(root+path.sep)||!fs.existsSync(narration))
    throw Error('Importe uma narração válida antes de gerar a transcrição.');
  const stamp=narrationStamp(root,plan);
  if(!stamp)throw Error('Narração ausente.');
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-prepared-transcript-'));
  try{
    update('Preparando narração: cortes, trim de bordas e pausas...');
    const edges=await analyzeNarrationEdges(narration,plan.audio,{ffmpeg,ffprobe,signal});
    const cuts=edges.cuts.length?edges.cuts:
      [{start:0,end:await probeAudioDuration(narration,{ffprobe,signal})}];
    const voiceDuration=cuts.reduce((n,c)=>n+c.end-c.start,0);
    const gaps=silenceSourcePositions(plan.audio.silenceInserts||[]);
    if(gaps.some(g=>g.sourceAt>voiceDuration+0.01))
      throw Error('Pausa da narração posicionada além do áudio limpo.');
    const duration=voiceDuration+gaps.reduce((n,g)=>n+g.duration,0);
    const prepared=path.join(work,'narration.prepared.wav');
    await prepareNarration(narration,prepared,plan.audio,{
      ffmpeg,ffprobe,signal,duration,autoTrimCuts:edges.cuts
    });
    update('Transcrevendo narração já corrigida e sincronizada...');
    const result=await transcriber(prepared,work,{model,language,signal,update});
    if(!fs.existsSync(path.join(work,TRANSCRIPT_FILE)))
      throw Error('Transcrição não gerou transcript.json.');
    // Do not silently destroy human corrections to an earlier transcription.
    const current=path.join(root,TRANSCRIPT_FILE);
    if(fs.existsSync(current)){
      const previous=fs.readFileSync(current,'utf8'),incoming=fs.readFileSync(path.join(work,TRANSCRIPT_FILE),'utf8');
      if(previous!==incoming){
        const priorMeta=path.join(root,TRANSCRIPT_BUILD);
        const hadManualEdits=!fs.existsSync(priorMeta)||
          (()=>{try{return readJson(priorMeta).contentHash!==crypto.createHash('sha256').update(previous).digest('hex');}
          catch{return true;}})();
        if(hadManualEdits)
          fs.copyFileSync(current,path.join(root,'transcript.manual-backup-'+Date.now()+'.json'));
      }
    }
    // If the plan changes while Whisper is working, do NOT mark the
    // transcript up to date or publish data for the wrong timebase.
    const latest=readJson(file);
    if(narrationStamp(root,latest)!==stamp)
      throw Error('O áudio ou os cortes mudaram durante a transcrição. Gere novamente.');
    fs.mkdirSync(path.join(root,'audio'),{recursive:true});
    for(const name of [TRANSCRIPT_FILE,'transcript.txt','transcript.srt'])
      if(fs.existsSync(path.join(work,name)))moveAtomic(path.join(work,name),path.join(root,name));
    moveAtomic(prepared,path.join(root,PREPARED_NARRATION));
    const meta={narrationStamp:stamp,prepared:PREPARED_NARRATION,
      generatedAt:new Date().toISOString(),language,model,
      contentHash:crypto.createHash('sha256').update(fs.readFileSync(current)).digest('hex'),
      duration,edgeTrim:{start:edges.headSeconds,end:edges.tailSeconds},
      wordCount:result.wordCount,source:plan.audio.narration};
    const tmp=path.join(work,TRANSCRIPT_BUILD);
    fs.writeFileSync(tmp,JSON.stringify(meta,null,2)+'\n');
    moveAtomic(tmp,path.join(root,TRANSCRIPT_BUILD));
    update('Narração preparada e transcript.json sincronizado.');
    return {...result,prepared:PREPARED_NARRATION,transcript:TRANSCRIPT_FILE,
      duration,edgeTrim:meta.edgeTrim};
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
