import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import {voiceStudioFolder,voiceStudioState} from './voice-studio.mjs';
import {takeList,addTake,editTakes,deleteTake,finalizeTakes,transcriptionOptions,takesDirectory,resolveTake} from './narration-assembly.mjs';
import {probeAudioDuration} from './audio.mjs';
import {VOICE_MODELS,generationOptions,profile,profiles,saveProfile,saveRecording,modelState,setupRuntime,qwenTask} from './voice-creation.mjs';
import {CHATTERBOX_MODEL,setupChatterbox,chatterboxTask} from './chatterbox.mjs';
import {recordingTreatmentOptions} from './recording-treatment.mjs';
import {enhanceVoice,enhancementOptions} from './voice-enhancement.mjs';
import {run} from './exec.mjs';
import {sendNarrationAudio} from './audio-waveform.mjs';
import {ensureVoiceModel} from './feature-setup.mjs';

export function mountVoiceCreationRoutes(app,api,{isProjectBusy=()=>false}={}){
  const jobs=new Map();let busy=null;
  const upload=multer({dest:os.tmpdir(),limits:{fileSize:128*1024*1024,files:1}}).single('file');
  // Microphone/biometric data and model downloads are local, same-origin operations.
  app.use('/api/voice', (req,res,next)=>{
    const host=req.headers.host||'';
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))return res.status(403).json({error:'Acesso somente pelo Content Lab local.'});
    if(req.headers.origin&&req.headers.origin!==`http://${host}`)return res.status(403).json({error:'Origem não autorizada.'});
    next();
  });
  const uploaded=(req,res,next)=>upload(req,res,error=>{
    if(error)return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?'Áudio acima de 128 MB.':error.message});
    if(!req.file)return res.status(400).json({error:'Selecione ou grave um áudio.'});
    next();
  });
  const start=(work,details={})=>{
    if(busy)throw Error('Aguarde ou cancele a tarefa de IA em andamento.');
    for(const [id,j] of jobs)if(Date.now()-j.createdAt>86400000&&j.status!=='running')jobs.delete(id);
    const id=crypto.randomUUID(),controller=new AbortController();
    const job={id,status:'running',message:'Preparando...',createdAt:Date.now(),controller,...details};
    jobs.set(id,job);busy=id;
    Promise.resolve().then(()=>work(job,message=>{job.message=message;},controller.signal))
      .then(result=>{job.result=result;job.status='done';job.message='Concluído.';})
      .catch(e=>{job.status=controller.signal.aborted?'cancelled':'error';job.error=e.message;job.message=job.status==='cancelled'?'Cancelado.':'Falha no processamento.';})
      .finally(()=>{if(busy===id)busy=null;});
    return id;
  };
  const audioJob=file=>{
    const id=crypto.randomUUID();jobs.set(id,{id,status:'done',file,createdAt:Date.now()});return id;
  };
  app.get('/api/voice/state',api(async(req,res)=>res.json({...await modelState(),busyJobId:busy})));
  app.get('/api/voice/profiles',api(async(req,res)=>res.json({profiles:profiles()})));
  app.post('/api/voice/enhancement/preview',(req,res,next)=>upload(req,res,error=>error?res.status(400).json({error:error.message}):next()),api(async(req,res)=>{
    let handedOff=false;
    try{
      const root=voiceStudioFolder(req.body.projectRoot),options=enhancementOptions(req.body);
      if(options.enhancementEngine==='off'||options.enhancementStrength===0)throw Error('Ative o aprimoramento e escolha uma intensidade maior que zero.');
      if(isProjectBusy(root))throw Error('Aguarde o processamento deste projeto.');
      let input=req.file?.path;
      if(!input&&req.body.kind){
        const take=takeList(root).takes.find(t=>t.kind===req.body.kind&&t.selected);
        if(take)input=resolveTake(root,take.name);
      }
      if(!input){const state=voiceStudioState(root);if(state.ready)input=path.join(root,state.source);}
      if(!input||!fs.existsSync(input)||fs.lstatSync(input).isSymbolicLink())throw Error('Selecione um áudio, salve uma tomada ou prepare primeiro a narração.');
      const id=start(async(job,update,signal)=>{
        const stage=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-enhancement-preview-'));let kept=false;
        try{
          const original=path.join(stage,'original.wav'),output=path.join(stage,'enhanced.wav');
          await run('ffmpeg',['-hide_banner','-loglevel','error','-i',input,'-t','20','-vn','-ar','48000','-ac','1','-c:a','pcm_s16le',original],{signal});
          const enhancement=await enhanceVoice(original,output,options,{signal,update});
          job.file=output;job.originalFile=original;kept=true;
          const timer=setTimeout(()=>fs.rmSync(stage,{recursive:true,force:true}),3600000);timer.unref();
          return {preview:true,duration:await probeAudioDuration(output),enhancement};
        }finally{
          if(req.file)fs.rmSync(req.file.path,{force:true});
          if(!kept)fs.rmSync(stage,{recursive:true,force:true});
        }
      },{projectRoot:root});
      handedOff=true;res.status(202).json({jobId:id});
    }finally{if(!handedOff&&req.file)fs.rmSync(req.file.path,{force:true});}
  }));
  app.post('/api/voice/runtime',api(async(req,res)=>{
    const engine=req.body.engine||'qwen';if(!['qwen','chatterbox'].includes(engine))throw Error('Motor de voz inválido.');
    res.status(202).json({jobId:start(async(job,update,signal)=>{await (engine==='chatterbox'?setupChatterbox:setupRuntime)(update,signal);return {ready:true,engine};})});
  }));
  app.post('/api/voice/models/download',api(async(req,res)=>{
    if(!VOICE_MODELS.includes(req.body.model))return res.status(400).json({error:'Modelo inválido.'});
    res.status(202).json({jobId:start(async(job,update,signal)=>{await ensureVoiceModel(req.body.model,{update,signal});return {model:req.body.model};})});
  }));
  app.post('/api/voice/profiles',uploaded,api(async(req,res)=>{
    try{res.json(await saveProfile(req.file.path,req.body));}
    finally{fs.rmSync(req.file.path,{force:true});}
  }));
  app.get('/api/voice/profiles/:id/audio',api(async(req,res)=>{
    const voice=profile(req.params.id);await sendNarrationAudio(req,res,voice.audio);
  }));
  app.post('/api/voice/recordings',uploaded,api(async(req,res)=>{
    try{
      const root=voiceStudioFolder(req.body.projectRoot);
      if(isProjectBusy(root)||[...jobs.values()].some(j=>j.projectRoot===root&&j.status==='running'))throw Error('Aguarde o processamento da narração.');
      const result=await saveRecording(req.file.path,root);
      const list=addTake(root,{...result,kind:'recording'});
      res.json({...result,file:undefined,...list,jobId:audioJob(result.file)});
    }finally{fs.rmSync(req.file.path,{force:true});}
  }));
  app.post('/api/voice/generate',api(async(req,res)=>{
    const options=generationOptions(req.body),voice=profile(req.body.profileId),root=voiceStudioFolder(req.body.projectRoot);
    if(isProjectBusy(root))throw Error('Há processamento de áudio ou render neste projeto.');
    const transcription=transcriptionOptions(req.body.transcription);
    const enhancement=enhancementOptions(req.body.enhancement);
    res.status(202).json({jobId:start(async(job,update,signal)=>{
      await ensureVoiceModel(options.model,{signal,update});
      const staging=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-speech-'));
      try{
        const output=path.join(staging,'speech.wav');
        await (options.model===CHATTERBOX_MODEL?chatterboxTask:qwenTask)({...options,action:'generate',reference:voice.audio,referenceText:voice.referenceText,output},{signal,update});
        if(signal.aborted)throw Error('Cancelado.');
        // Revalidate the destination after a long inference. Never overwrite existing takes.
        takesDirectory(root);
        const relative='audio/takes/narration.ai-'+crypto.randomUUID()+'.wav';
        const file=path.join(root,relative);fs.copyFileSync(output,file,fs.constants.COPYFILE_EXCL);
        job.file=file;
        fs.writeFileSync(file+'.json',JSON.stringify({version:1,kind:'qwen',engine:options.model===CHATTERBOX_MODEL?'chatterbox':'qwen',checkpoint:options.model===CHATTERBOX_MODEL?'multilingual-v3':undefined,model:options.model,profileId:voice.id,language:options.language,exaggeration:options.exaggeration,cfgWeight:options.cfgWeight,processing:[],createdAt:new Date().toISOString()}),{flag:'wx'});
        const duration=await probeAudioDuration(file);
        addTake(root,{relative,duration,kind:'qwen'},req.body.append!==true);
        const result=await finalizeTakes(root,{kind:'qwen',transcription,enhancement,signal,update});
        job.file=path.join(root,result.source);
        return result;
      }finally{fs.rmSync(staging,{recursive:true,force:true});}
    },{projectRoot:root})});
  }));
  app.get('/api/voice/takes',api(async(req,res)=>{
    const root=voiceStudioFolder(req.query.projectRoot),list=takeList(root),state=voiceStudioState(root);
    let final=null;
    if(state.ready){
      const file=path.join(root,'transcript.json'),text=path.join(root,'transcript.txt');
      if(fs.statSync(file).size<8*1024*1024&&!fs.lstatSync(file).isSymbolicLink()){
        const doc=JSON.parse(fs.readFileSync(file,'utf8'));
        final={projectRoot:root,duration:state.duration,wordCount:doc.words?.length||0,
          preview:fs.existsSync(text)&&!fs.lstatSync(text).isSymbolicLink()?fs.readFileSync(text,'utf8').slice(0,20000):'',relative:'audio/narration.wav'};
      }
    }
    res.json({...list,final});
  }));
  app.get('/api/voice/final/audio',api(async(req,res)=>{
    const root=voiceStudioFolder(req.query.projectRoot),file=path.join(root,'audio','narration.wav');
    if(!voiceStudioState(root).ready||fs.lstatSync(file).isSymbolicLink())return res.status(404).json({error:'Narração final não disponível.'});
    await sendNarrationAudio(req,res,file);
  }));
  app.post('/api/voice/takes',api(async(req,res)=>{
    const root=voiceStudioFolder(req.body.projectRoot);
    if(isProjectBusy(root)||[...jobs.values()].some(j=>j.projectRoot===root&&j.status==='running'))return res.status(409).json({error:'Aguarde a finalização antes de alterar as tomadas.'});
    res.json(editTakes(root,req.body.takes,req.body.revision));
  }));
  app.get('/api/voice/takes/:name/audio',api(async(req,res)=>{
    const root=voiceStudioFolder(req.query.projectRoot),take=takeList(root).takes.find(t=>t.name===req.params.name);
    if(!take||!/^(recording-|narration\.ai-)[a-f0-9-]{36}\.wav$/.test(take.name))return res.status(404).json({error:'Tomada não encontrada.'});
    const file=resolveTake(root,take.name);
    if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())return res.status(404).end();
    await sendNarrationAudio(req,res,file);
  }));
  app.delete('/api/voice/takes/:name',api(async(req,res)=>{
    const root=voiceStudioFolder(req.body.projectRoot);
    if(isProjectBusy(root)||[...jobs.values()].some(j=>j.projectRoot===root&&j.status==='running'))return res.status(409).json({error:'Aguarde o processamento antes de excluir tomadas.'});
    res.json(deleteTake(root,req.params.name,req.body.revision));
  }));
  app.post('/api/voice/finalize',api(async(req,res)=>{
    const root=voiceStudioFolder(req.body.projectRoot),kind=req.body.kind||'recording';
    const treatment=kind==='recording'?recordingTreatmentOptions(req.body.treatment??{}):null;
    const transcription=transcriptionOptions(req.body.transcription);
    const enhancement=enhancementOptions(req.body.enhancement);
    if(isProjectBusy(root))return res.status(409).json({error:'Há processamento de áudio ou render neste projeto.'});
    if(!['recording','qwen'].includes(kind)||!takeList(root).takes.some(t=>t.kind===kind&&t.selected))return res.status(400).json({error:'Selecione pelo menos uma tomada.'});
    res.status(202).json({jobId:start(async(job,update,signal)=>{
      const result=await finalizeTakes(root,{kind,transcription,enhancement,treatment,signal,update});job.file=path.join(root,result.source);return result;
    },{projectRoot:root})});
  }));
  app.get('/api/voice/jobs/:id',api(async(req,res)=>{
    const job=jobs.get(req.params.id);if(!job)return res.status(404).json({error:'Tarefa não encontrada.'});
    const {controller,file,originalFile,...visible}=job;res.json(visible);
  }));
  app.post('/api/voice/jobs/:id/cancel',api(async(req,res)=>{
    const job=jobs.get(req.params.id);if(!job||job.status!=='running')return res.status(409).json({error:'Não há tarefa ativa.'});
    job.controller.abort();res.json({ok:true});
  }));
  app.get('/api/voice/jobs/:id/audio',api(async(req,res)=>{
    const job=jobs.get(req.params.id);
    const file=req.query.variant==='original'?job?.originalFile:job?.file;
    if(job?.status!=='done'||!file||!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())return res.status(404).json({error:'Áudio indisponível.'});
    const audioDir=path.dirname(file);
    if(fs.realpathSync(audioDir)!==audioDir)return res.status(400).json({error:'Pasta de áudio mudou.'});
    await sendNarrationAudio(req,res,file);
  }));
  return {jobs,isProjectBusy:root=>[...jobs.values()].some(j=>j.projectRoot===root&&j.status==='running'),activeCount:()=>busy?1:0,cancelAll:()=>{for(const job of jobs.values())if(job.status==='running')job.controller.abort();}};
}
