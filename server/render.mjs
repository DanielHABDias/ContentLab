import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {APP_ROOT,readJson,assetReport,settings,compileScene,sha,projectFile,PlanError} from './plan.mjs';
import {statIdentity,SegmentCache,rendererIdentity,sceneFingerprint,cleanOutput} from './cache.mjs';
import {transcriptWords,remapTranscriptWords,applyNarrationSilence,renderRemotionScene} from './remotion.mjs';
import {prepareNarration,mixAudio,probeOutput,narrationCuts,analyzeNarrationEdges} from './audio.mjs';
import {transcriptStatus,renderVoiceSettings} from './narration-pipeline.mjs';
import {composeVisual} from './compose.mjs';

function hashRender(plan,validation,identity){
  const inputs=[validation.narration,...Object.values(validation.resolvedAssets)];
  if(plan.sources?.transcript)inputs.push(path.resolve(validation.projectRoot,plan.sources.transcript));
  const fileInfo=inputs.filter(Boolean).filter(fs.existsSync).map(statIdentity);
  return sha({plan,files:fileInfo,renderer:identity});
}
function normalizedScenes(plan){
  const result=[];let cursor=0,index=0;
  for(const scene of plan.timeline){
    if(scene.start>cursor){
      result.push({id:'__gap__'+index+'__'+cursor,start:cursor,end:scene.start,
        background:{color:'#000000'},elements:[],transitionOut:'cut',camera:{keyframes:[]}});
    }
    result.push(scene);cursor=scene.end;index++;
  }
  return result;
}
export async function renderProject(directory,{
  cacheMode='reuse',hardwareAccel=false,signal,progress,
  ffmpeg=process.env.FFMPEG_PATH||'ffmpeg',ffprobe=process.env.FFPROBE_PATH||'ffprobe',
  renderScene=renderRemotionScene,
  compose=composeVisual,
  prepareVoice=prepareNarration,
  mix=mixAudio,
  probe=probeOutput
}={}){
  if(!['reuse','rebuild'].includes(cacheMode))throw Error('Modo de cache inválido.');
  const {root,file}=projectFile(directory),plan=readJson(file),validation=assetReport(plan,root);
  if(!validation.valid)throw new PlanError([...validation.errors,...validation.missingAssets.map(x=>({path:x.asset,message:'Arquivo não encontrado: '+x.path}))]);
  if(!plan.timeline?.length)throw new PlanError([{path:'timeline',message:'Crie uma cena antes do render.'}]);
  validation.projectRoot=root;
  const inputFiles=[validation.narration,...Object.values(validation.resolvedAssets),
    plan.sources?.transcript&&path.resolve(root,plan.sources.transcript)].filter(Boolean);
  if(cacheMode==='rebuild')cleanOutput(root,inputFiles);
  const outputRoot=path.join(root,'output'),finalDir=path.join(outputRoot,'final'),finalFile=path.join(finalDir,'final.mp4');
  if(fs.existsSync(outputRoot)&&fs.lstatSync(outputRoot).isSymbolicLink())throw Error('Pasta output insegura.');
  if(fs.existsSync(finalDir)&&fs.lstatSync(finalDir).isSymbolicLink())throw Error('Pasta final insegura.');
  fs.mkdirSync(finalDir,{recursive:true});
  const cache=new SegmentCache(path.join(finalDir,'scenes'));
  const cfg=settings(plan),duration=Math.max(...plan.timeline.map(s=>s.end));
  const raws=normalizedScenes(plan),scenes=raws.map(raw=>compileScene(raw,plan,validation.resolvedAssets));
  let transcript=null;
  if(plan.sources?.transcript&&fs.existsSync(path.resolve(root,plan.sources.transcript))){
    transcript=readJson(path.resolve(root,plan.sources.transcript));
  }
  // Detect edge silence before scene fingerprints: the remapped transcript
  // and the prepared WAV must use the exact same post-trim clock.
  const voiceSourceSettings=renderVoiceSettings(root,plan);
  const narrationEdges=prepareVoice===prepareNarration
    ? await analyzeNarrationEdges(validation.narration,voiceSourceSettings,{ffmpeg,ffprobe,signal})
    : {cuts:narrationCuts(voiceSourceSettings),headSeconds:0,tailSeconds:0};
  const transcription=transcriptStatus(root,plan);
  if(transcription.status==='stale')
    throw Error('Transcrição desatualizada para os cortes/pausas atuais. Gere novamente a transcrição do áudio preparado.');
  // Generated transcript timestamps already reference the final prepared WAV.
  // Never trim/remap that transcript a second time on render.
  const words=transcription.status==='ready'?transcriptWords(transcript):
    applyNarrationSilence(remapTranscriptWords(transcriptWords(transcript),narrationEdges.cuts),
      plan.audio.silenceInserts);
  const identity=rendererIdentity(APP_ROOT);
  const signature=hashRender(plan,validation,identity),reportFile=path.join(finalDir,'render_report.json');
  const fingerprints=raws.map((raw,i)=>sceneFingerprint(raw,scenes[i],cfg,validation.resolvedAssets,words,identity));
  if(cacheMode==='reuse'&&fs.existsSync(finalFile)&&fs.existsSync(reportFile)){
    try{
      const cached=readJson(reportFile);
      if(cached.status==='completed'&&cached.cacheKey===signature&&cached.outputBytes===fs.statSync(finalFile).size&&
        scenes.every((s,i)=>cache.lookup(s.id,fingerprints[i]))){
        return {...cached,cacheHit:true,sceneCache:{
          enabled:true,reused:scenes.map(s=>s.id),rendered:[],reusedCount:scenes.length,renderedCount:0
        }};
      }
    }catch{}
  }
  const work=fs.mkdtempSync(path.join(finalDir,'contentlab-render-'));
  const reused=[],rendered=[],paths=[],started=Date.now();
  const emit=(stage,current,total,id)=>progress?.(stage,current,total,id);
  try {
    for(let i=0;i<scenes.length;i++){
      if(signal?.aborted)throw Error('Render cancelado.');
      const scene=scenes[i],fingerprint=fingerprints[i];
      let video=cacheMode==='reuse'?cache.lookup(scene.id,fingerprint):null;
      if(video){reused.push(scene.id);}
      else{
        const temp=path.join(work,'scene-'+i+'.mp4');
        await renderScene(scene,cfg,words,temp,{signal,hardwareAccel});
        video=cache.save(scene.id,fingerprint,temp);
        rendered.push(scene.id);
      }
      paths.push(video);
      emit('scene',i+1,scenes.length,scene.id+(reused.includes(scene.id)?' (cache)':''));
    }
    const silent=path.join(work,'visual.mp4');
    const composed=await compose(scenes,paths,silent,cfg,work,{
      ffmpeg,signal,cacheDirectory:path.join(finalDir,'pieces')
    });
    emit('compose',scenes.length,scenes.length,'Vídeo composto');
    const voice=path.join(work,'narration.cleaned.wav');
    await prepareVoice(validation.narration,voice,voiceSourceSettings,{ffmpeg,ffprobe,signal,duration,
      autoTrimCuts:narrationEdges.cuts});
    emit('narration',scenes.length,scenes.length,'Narração preparada');
    const tempFinal=path.join(work,'final.mp4');
    const layers=await mix(silent,voice,plan,validation.resolvedAssets,tempFinal,duration,{ffmpeg,ffprobe,signal});
    emit('audio',scenes.length,scenes.length,'Áudio mixado');
    const verified=await probe(tempFinal,{ffprobe,signal});
    const tolerance=Math.max(.15,2/cfg.fps);
    if(Math.abs(verified.videoDuration-duration)>tolerance||
       Math.abs(verified.audioDuration-duration)>tolerance)throw Error('Vídeo ou áudio fora da duração esperada.');
    fs.renameSync(tempFinal,finalFile);
    const cleaned=path.join(finalDir,'narration.cleaned.wav');
    fs.copyFileSync(voice,cleaned);
    const report={
      status:'completed',project:plan.project.name,mode:'final',cacheMode,
      output:finalFile,outputBytes:fs.statSync(finalFile).size,duration,scenes:plan.timeline.length,
      cacheKey:signature,cacheHit:false,sceneCache:{enabled:true,reused,rendered,
        reusedCount:reused.length,renderedCount:rendered.length},
      transitions:composed.transitions||[],audioLayers:layers,outputProbe:verified,
      narrationAutoTrim:{start:narrationEdges.headSeconds,end:narrationEdges.tailSeconds},
      warnings:validation.warnings||[],
      elapsedSeconds:Math.round((Date.now()-started)/10)/100,
    };
    fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
    emit('verify',scenes.length,scenes.length,'Render concluído');
    return report;
  }catch(error){
    try{fs.writeFileSync(reportFile,JSON.stringify({status:signal?.aborted?'cancelled':'failed',
      error:error.message,sceneCache:{rendered,reused},elapsedSeconds:(Date.now()-started)/1000},null,2)+'\n');}catch{}
    throw error;
  }finally{
    fs.rmSync(work,{recursive:true,force:true});
  }
}
