import fs from 'node:fs';
import path from 'node:path';
import {voiceOptions,analyzeVoice} from './voice-studio.mjs';
import {enhanceVoice} from './voice-enhancement.mjs';
import {prepareNarration,probeAudioDuration} from './audio.mjs';
import {run} from './exec.mjs';
import {reduceBreaths} from './breath-reduction.mjs';

export function recordingTreatmentOptions(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Tratamento da gravação inválido.');
  if(raw.enabled!==undefined&&typeof raw.enabled!=='boolean')throw Error('Ativação do tratamento inválida.');
  return {enabled:raw.enabled!==false,...voiceOptions({voicePreset:'original',trimEdges:true,removeMiddleSilence:false,normalize:true,compression:true,deesser:true,reduceBreaths:true,breathReductionStrength:60,highpassHz:70,targetLufs:-16,enhancementEngine:'deepfilter',enhancementMode:'strong',enhancementStrength:100,...raw,pitchSemitones:0,voicePreset:'original'})};
}
export async function treatRecording(input,output,raw={}, {ffmpeg='ffmpeg',ffprobe='ffprobe',signal,update=()=>{},enhancer=enhanceVoice}={}){
  const options=recordingTreatmentOptions(raw);
  if(!options.enabled){fs.copyFileSync(input,output);return {applied:false,options,enhancement:{applied:false},processing:[]};}
  const stage=fs.mkdtempSync(path.join(path.dirname(output),'.recording-treatment-'));
  try{
    let working=input,enhancement={applied:false};const processing=[];
    if(options.enhancementEngine!=='off'&&options.enhancementStrength>0){
      const cleaned=path.join(stage,'cleaned.wav');enhancement=await enhancer(working,cleaned,options,{ffmpeg,ffprobe,signal,update});working=cleaned;processing.push('deepfilter');
    }
    update('Analisando pausas da gravação; pausas internas preservadas salvo escolha explícita...');
    const layout=await analyzeVoice(working,options,{ffmpeg,ffprobe,signal});
    const filters=[];
    if(options.highpassHz){filters.push('highpass=f='+options.highpassHz);processing.push('highpass');}
    if(options.compression){filters.push('acompressor=threshold=0.125:ratio=2:attack=15:release=180:makeup=1');processing.push('compression');}
    if(options.deesser){filters.push('deesser=i=0.15:m=0.3:f=0.5:s=o');processing.push('deesser');}
    if(filters.length){
      update('Equilibrando volume, graves indesejados e sibilância...');const dynamics=path.join(stage,'dynamics.wav');
      await run(ffmpeg,['-hide_banner','-loglevel','error','-i',working,'-vn','-af',filters.join(','),'-ar','48000','-ac','1','-c:a','pcm_s24le',dynamics],{signal});
      if(Math.abs(await probeAudioDuration(working,{ffprobe,signal})-await probeAudioDuration(dynamics,{ffprobe,signal}))>.01)throw Error('O tratamento alterou a duração inesperadamente.');
      working=dynamics;
    }
    const breathFile=path.join(stage,'breaths.wav');
    const breathReduction=await reduceBreaths(working,breathFile,options,{ffmpeg,signal,update});
    working=breathFile;
    if(breathReduction.applied)processing.push('breath-reduction');
    update('Finalizando gravação'+(options.normalize?' em '+options.targetLufs+' LUFS, pico alvo -1,5 dBTP':'')+'...');
    await prepareNarration(working,output,{sourceCuts:layout.cuts,voice:{autoTrimSilence:false,highpassHz:0,normalize:options.normalize,targetLufs:options.targetLufs,truePeakDb:-1.5}},{ffmpeg,ffprobe,signal,duration:layout.duration,autoTrimCuts:layout.cuts,outputChannels:1,outputCodec:'pcm_s24le'});
    if(layout.removed.length)processing.push('silence-cuts');if(options.normalize)processing.push('loudness');
    return {applied:true,options,enhancement,breathReduction,processing,removedRanges:layout.removed,originalDuration:layout.originalDuration,duration:await probeAudioDuration(output,{ffprobe,signal})};
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
