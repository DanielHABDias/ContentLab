import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {APP_ROOT,projectFile,readJson,assetReport,validatePlan,PlanError} from './plan.mjs';
import {createProject,loadProject,saveProject,listAssets,registry,visualContext,installedAssets} from './project.mjs';
import {renderProject} from './render.mjs';
import {createRenderQueue} from './render-queue.mjs';
import {run} from './exec.mjs';
import {instanceIdentity} from './instance-identity.mjs';
import {SOURCE_CACHE,listSources,cachedSource,importLocalSource,removeSource,getSourceInfo,resolveSource,exportCut} from './source.mjs';
import {transcribeAudio} from './transcribe.mjs';
import {voiceStudioFolder,voiceStudioState,prepareStandaloneNarration} from './voice-studio.mjs';
import {readAudioTreatmentSettings,writeAudioTreatmentSettings} from './audio-treatment-settings.mjs';
import {mountVoiceCreationRoutes} from './voice-creation-routes.mjs';
import {sendNarrationAudio} from './audio-waveform.mjs';
import {prepareAndTranscribeProject,narrationStamp,transcriptStatus} from './narration-pipeline.mjs';
import {streamSkillZip} from './skill.mjs';
import {buildMarkdown,buildHtml} from './docs.mjs';
import {sceneLibrary,libraryFile,installScenePreset} from './scene-library.mjs';
import {diagramNames,diagramSvg} from './docs-diagrams.mjs';
import {sceneCacheOverview,savedSceneFile} from './scene-browser.mjs';
import {mountSocialRoutes} from './social-routes.mjs';
import {mountSocialPublishRoutes} from './social-publish-routes.mjs';
import {mountSocialMetricsRoutes} from './social-metrics-routes.mjs';
import {mountMediaLibraryRoutes} from './media-routes.mjs';
import {thumbnailBackground} from './thumbnail-background.mjs';
import {mountWorkspaceRoutes,projectAssetDirectory} from './workspace-project.mjs';

const PORT=Number(process.env.PORT||5000);
const HOST='127.0.0.1';
const app=express(),jobs=new Map(),transcriptions=new Map(),sourceJobs=new Map(),previews=new Map();
app.disable('x-powered-by');
app.use(express.json({limit:'5mb'}));
app.use('/static',express.static(path.join(APP_ROOT,'frontend','static'),{index:false}));
app.get('/api/thumbnails/background', (req, res) => {
  try {
    const svg = thumbnailBackground({style: req.query.style, tone: req.query.tone || 'light',
      width: Number(req.query.width || 1280), height: Number(req.query.height || 720)});
    res.type('image/svg+xml').send(svg);
  } catch (error) {res.status(400).json({error: error.message});}
});
const THUMBNAIL_FONTS=Object.freeze({anton:'Anton-Regular.ttf',bangers:'Bangers-Regular.ttf'});
app.get('/api/thumbnails/font/:font',(req,res)=>{
  const fileName=THUMBNAIL_FONTS[req.params.font];
  if(!fileName)return res.status(404).end();
  const fontFile=path.join(APP_ROOT,'builtin-assets','fonts',fileName);
  if(!fs.existsSync(fontFile))return res.status(404).json({error:'Fonte ainda não instalada no Content Lab.'});
  res.type('font/ttf').sendFile(fontFile);
});
const singleRenderActive=root=>[...jobs.values()].some(job=>job.projectRoot===root&&job.status==='running');
const anySingleRenderActive=()=>[...jobs.values()].some(job=>job.status==='running');
const runningTranscription=root=>[...transcriptions.values()].find(job=>job.projectRoot===root&&job.status==='running');
const renderQueue=createRenderQueue({loadProject,renderProject,isSingleRenderBusy:anySingleRenderActive,
  isTranscribing:root=>!!runningTranscription(root)||voiceCreation.isProjectBusy(root)});
const activeRender=root=>singleRenderActive(root)||renderQueue.isQueued(root);
function startPreparedTranscript(root,options={}){
  if(voiceCreation.isProjectBusy(root))throw Error('A narração deste projeto ainda está sendo finalizada.');
  const running=runningTranscription(root);
  if(running)return running.id;
  const id=crypto.randomUUID(),job={id,status:'running',projectRoot:root,
    message:'Preparando narração e transcrição...',result:null,error:null,
    narrationStamp:narrationStamp(root,readJson(projectFile(root).file))};
  transcriptions.set(id,job);
  prepareAndTranscribeProject(root,{
    model:options.model||'base',language:options.language||'pt',
    update:message=>{job.message=message;}
  }).then(result=>Object.assign(job,{
    status:'done',message:'Transcrição pronta para captions e kinetic text.',result
  })).catch(err=>Object.assign(job,{status:'error',message:'Falha ao preparar transcrição.',error:err.message}));
  return id;
}
const upload=multer({dest:os.tmpdir(),limits:{fileSize:1024*1024*1024}});
const smallUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024}});
const api=(handler)=>async(req,res)=>{
  try{await handler(req,res);}catch(e){
    if(res.headersSent)return;
    if(e instanceof PlanError)return res.status(422).json({error:e.message,errors:e.issues,valid:false});
    if(e.code==='LIMIT_FILE_SIZE')return res.status(413).json({error:'Arquivo acima do limite permitido.'});
    if(e instanceof SyntaxError)return res.status(422).json({error:'JSON inválido: '+e.message});
    console.error(e);
    res.status(500).json({error:e.message||'Erro no servidor.'});
  }
};
const forbidden=(res,msg)=>res.status(400).json({error:msg});
app.get('/',(req,res)=>{
  const html=fs.readFileSync(path.join(APP_ROOT,'frontend/templates/index.html'),'utf8')
    .replace('{{ default_dir }}',path.join(os.homedir(),'Downloads').replace(/&/g,'&amp;').replace(/"/g,'&quot;'));
  res.type('html').send(html);
});
app.get('/api/editor/plugins',api(async(req,res)=>res.json(registry())));
app.get('/api/editor/backgrounds',api(async(req,res)=>res.json({backgrounds:installedAssets().backgrounds})));
app.post('/api/editor/visual-context',api(async(req,res)=>res.json(visualContext(req.body.projectRoot))));
app.post('/api/editor/project',api(async(req,res)=>{
  const project=loadProject(req.body.projectRoot);
  res.json(project);
}));
app.get('/api/editor/scenes',api(async(req,res)=>{
  if(typeof req.query.projectRoot!=='string')return forbidden(res,'Informe a pasta do projeto.');
  res.json(sceneCacheOverview(req.query.projectRoot));
}));
app.get('/api/editor/scenes/:id/media',api(async(req,res)=>{
  if(typeof req.query.projectRoot!=='string')return forbidden(res,'Informe a pasta do projeto.');
  const file=savedSceneFile(req.query.projectRoot,req.params.id);
  if(!file)return res.status(404).json({error:'Não existe MP4 válido em cache para esta cena.'});
  res.type('video/mp4').sendFile(file,{acceptRanges:true});
}));
app.post('/api/editor/project/create',api(async(req,res)=>res.status(201).json(createProject(req.body.parentRoot,req.body.name))));
app.post('/api/editor/project/assets',api(async(req,res)=>res.json(listAssets(req.body.projectRoot,req.body.folder))));
app.post('/api/editor/validate',api(async(req,res)=>{
  const root=projectFile(req.body.projectRoot).root;
  const validation=assetReport(req.body.plan,root);
  res.status(validation.valid?200:422).json(validation);
}));
app.post('/api/editor/project/save',api(async(req,res)=>{
  const {root}=projectFile(req.body.projectRoot);
  if(activeRender(root))return res.status(409).json({error:'Aguarde o render antes de salvar o plano.'});
  try{
    const updated=saveProject(root,req.body.planText,req.body.revision);
    res.json(updated);
  }
  catch(e){
    if(e.issues?.some(x=>x.path==='revision'))return res.status(409).json({error:e.message,errors:e.issues});
    throw e;
  }
}));
app.post('/api/editor/project/narration',upload.single('file'),api(async(req,res)=>{
  if(!req.file)return forbidden(res,'Selecione uma narração.');
  try{
    const {root}=projectFile(req.body.projectRoot),ext=path.extname(req.file.originalname||'').toLowerCase();
    if(activeRender(root))return res.status(409).json({error:'Aguarde o render antes de importar narração.'});
    if(!['.wav','.mp3','.m4a','.aac','.flac','.ogg','.opus'].includes(ext))return forbidden(res,'Formato de áudio inválido.');
    const audioDir=path.join(root,'audio');
    if(fs.existsSync(audioDir)&&fs.lstatSync(audioDir).isSymbolicLink())return forbidden(res,'Pasta audio insegura.');
    fs.mkdirSync(audioDir,{recursive:true});
    if(runningTranscription(root)||voiceCreation.isProjectBusy(root))return res.status(409).json({error:'Aguarde a transcrição em andamento.'});
    const current=loadProject(root);
    if(req.body.revision&&req.body.revision!==current.revision)
      return res.status(409).json({error:'Plano alterado. Recarregue antes de importar a narração.'});
    const dest=path.join(audioDir,'narration-'+crypto.randomUUID()+ext);
    fs.renameSync(req.file.path,dest);
    const relative=path.relative(root,dest).split(path.sep).join('/');
    const plan=JSON.parse(current.planText);
    plan.audio.narration=relative;
    plan.sources={...(plan.sources||{}),transcript:'transcript.json'};
    try{
      const saved=saveProject(root,JSON.stringify(plan,null,2)+'\n',current.revision);
      const jobId=startPreparedTranscript(root);
      res.status(201).json({path:dest,relative,jobId,project:saved});
    }catch(error){fs.rmSync(dest,{force:true});throw error;}

  }finally{if(fs.existsSync(req.file.path))fs.rmSync(req.file.path,{force:true});}
}));
app.post('/api/editor/project/transcribe',api(async(req,res)=>{
  let project=loadProject(req.body.projectRoot);
  if(activeRender(project.projectRoot))return res.status(409).json({error:'Aguarde o render atual.'});
  if(!fs.existsSync(project.validation.narration||''))return forbidden(res,'Importe uma narração antes da transcrição.');
  if(project.transcription?.kind==='voice-studio')return forbidden(res,'Esta narração foi preparada na aba Narração. Faça ajustes nessa aba.');
  const plan=JSON.parse(project.planText);
  if(plan.sources?.transcript!=='transcript.json'){
    plan.sources={...(plan.sources||{}),transcript:'transcript.json'};
    project=saveProject(project.projectRoot,JSON.stringify(plan,null,2)+'\n',project.revision);
  }
  const id=startPreparedTranscript(project.projectRoot,{model:req.body.model,language:req.body.language});
  res.status(202).json({jobId:id});
}));
app.post('/api/editor/project/transcript',smallUpload.single('file'),api(async(req,res)=>{
  if(!req.file)return forbidden(res,'Selecione transcript.json.');
  const {root}=projectFile(req.body.projectRoot),doc=JSON.parse(req.file.buffer.toString('utf8'));
  if(activeRender(root))return res.status(409).json({error:'Aguarde o render antes de atualizar a transcrição.'});
  if(!Array.isArray(doc.segments))return res.status(422).json({error:'Transcrição precisa de segmentos.'});
  for(const s of doc.segments){
    if(!s||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.end<s.start||typeof s.text!=='string')return res.status(422).json({error:'Segmentos inválidos.'});
  }
  const temp=path.join(root,'.transcript-'+crypto.randomUUID()+'.tmp');
  fs.writeFileSync(temp,JSON.stringify(doc,null,2));
  fs.renameSync(temp,path.join(root,'transcript.json'));
  res.status(201).json({transcript:'transcript.json',segments:doc.segments.length});
}));
app.post('/api/editor/render',api(async(req,res)=>{
  const {projectRoot,mode,cacheMode='reuse',revision,hardwareAccel=false}=req.body||{};
  if(mode!=='final')return forbidden(res,'Somente o render final é permitido.');
  if(!['reuse','rebuild'].includes(cacheMode))return forbidden(res,'cacheMode inválido.');
  if(typeof hardwareAccel!=='boolean')return forbidden(res,'hardwareAccel deve ser booleano.');
  const project=loadProject(projectRoot);
  if(!project.validation.valid)return res.status(422).json({error:'Corrija os assets antes do render.',validation:project.validation});
  if(revision&&revision!==project.revision)return res.status(409).json({error:'O JSON mudou no disco. Recarregue.'});
  const root=project.projectRoot;
  if(runningTranscription(root))return res.status(409).json({error:'A transcrição ainda está sendo preparada. Aguarde o resultado antes de renderizar.'});
  if(transcriptStatus(root,JSON.parse(project.planText)).status==='stale')
    return res.status(409).json({error:'Transcrição desatualizada. Regenere a partir da narração processada.'});
  if(activeRender(root))return res.status(409).json({error:'Já há um render deste projeto.'});
  if(renderQueue.latest()?.status==='running')return res.status(409).json({error:'Aguarde a fila do Multi-editor terminar antes de iniciar um render individual.'});
  const id=crypto.randomUUID(),controller=new AbortController();
  const job={status:'running',stage:'prepare',percent:0,message:'Preparando render...',projectRoot:root,
    mode:'final',cacheMode,sceneId:null,error:null,filepath:null,controller,startedAt:Date.now()};
  jobs.set(id,job);
  res.status(202).json({jobId:id});
  const progress=(stage,current,total,sceneId)=>{
    if(controller.signal.aborted)throw Error('Render cancelado.');
    Object.assign(job,{stage:stage==='scene_start'?'scene':stage,current,total,
      sceneId:['scene','scene_start'].includes(stage)?String(sceneId).replace(/ \(cache\)$/,''):null});
    if(stage==='scene_start'){
      job.percent=Math.min(85,Math.round(Math.max(0,current-1)/Math.max(1,total)*85));
      job.message='Renderizando cena '+current+'/'+total+': '+job.sceneId;
    }else if(stage==='scene'){
      const cached=String(sceneId).endsWith(' (cache)');
      job.percent=Math.min(85,Math.round(current/Math.max(1,total)*85));
      job.message=(cached?'Reaproveitando':'Renderizando')+' cena '+current+'/'+total+': '+job.sceneId;
    }else{
      const pct={compose:90,narration:93,audio:96,verify:100}[stage]||0;
      job.percent=pct;job.message=String(sceneId||stage);
    }
  };
  renderProject(root,{cacheMode,hardwareAccel,signal:controller.signal,progress})
    .then(report=>{if(controller.signal.aborted){job.status='cancelled';return;}
      Object.assign(job,{status:'done',report,filepath:report.output,percent:100,message:'Render concluído.'});})
    .catch(e=>{
      job.status=controller.signal.aborted?'cancelled':'error';job.message=job.status==='cancelled'?'Render cancelado.':'Falha no render.';
      job.error=e.message;job.errorType=e.name||'Error';
      try{
        const dir=path.join(root,'output','logs');fs.mkdirSync(dir,{recursive:true});
        const file=path.join(dir,'render-'+id+'.log');fs.writeFileSync(file,e.stack||e.message);
        job.errorLog=file;job.hasErrorLog=true;
      }catch{}
    });
}));
app.get('/api/editor/jobs/:id',api(async(req,res)=>{
  const job=jobs.get(req.params.id);if(!job)return res.status(404).json({error:'Render não encontrado.'});
  const {controller,...visible}=job;res.json(visible);
}));
app.post('/api/editor/jobs/:id/cancel',api(async(req,res)=>{
  const job=jobs.get(req.params.id);if(!job)return res.status(404).json({error:'Render não encontrado.'});
  if(job.status!=='running')return res.status(409).json({error:'Não há render em andamento.'});
  job.controller.abort();job.message='Cancelando render...';res.json({ok:true});
}));
app.get('/api/editor/media/:id',api(async(req,res)=>{
  const job=jobs.get(req.params.id);
  if(job?.status!=='done'||!job.filepath)return res.status(404).json({error:'MP4 ainda não disponível.'});
  const expected=path.join(job.projectRoot,'output','final','final.mp4');
  if(path.resolve(job.filepath)!==expected||!fs.existsSync(expected))return res.status(404).json({error:'Arquivo não encontrado.'});
  res.type('video/mp4').sendFile(expected);
}));
app.get('/api/editor/jobs/:id/log',api(async(req,res)=>{
  const job=jobs.get(req.params.id);
  if(!job?.hasErrorLog)return res.status(404).json({error:'Log não disponível.'});
  res.download(job.errorLog);
}));
// Multi-editor: accepts an ordered list of saved project folders and renders them
// strictly one at a time, without the plan editor or a separate JSON input.
app.post('/api/render-queue',api(async(req,res)=>{
  try{res.status(202).json(renderQueue.enqueue(req.body||{}));}
  catch(e){res.status(e.statusCode||500).json({error:e.message});}
}));
app.get('/api/render-queue/latest',api(async(req,res)=>res.json({job:renderQueue.latest()})));
app.get('/api/render-queue/:id',api(async(req,res)=>{
  const job=renderQueue.get(req.params.id);
  if(!job)return res.status(404).json({error:'Fila não encontrada.'});
  res.json(job);
}));
app.post('/api/render-queue/:id/cancel',api(async(req,res)=>{
  try{res.json(renderQueue.cancel(req.params.id));}
  catch(e){res.status(e.statusCode||500).json({error:e.message});}
}));

app.post('/api/choose-folder',api(async(req,res)=>{
  let selected='';
  try{
    if(process.platform==='win32'){
      const ps='(New-Object -ComObject Shell.Application).BrowseForFolder(0,"Selecione a pasta",0,0).Self.Path';
      selected=(await run('powershell.exe',['-NoProfile','-Command',ps])).stdout.trim();
    }else selected=(await run('zenity',['--file-selection','--directory'])).stdout.trim();
  }catch{}
  res.json({folder:selected});
}));
app.post('/api/open-folder',api(async(req,res)=>{
  const directory=req.body?.folder;
  if(typeof directory!=='string'||!fs.existsSync(directory)||!fs.statSync(directory).isDirectory())return forbidden(res,'Pasta inválida.');
  if(process.platform==='win32')await run('explorer.exe',[path.resolve(directory)]);
  else await run('xdg-open',[path.resolve(directory)]);
  res.json({ok:true});
}));
app.get('/api/catalog/download',api(async(req,res)=>{
  const assets=installedAssets(),lines=['# Catálogo do Content Lab',''];
  for(const [category,entries] of Object.entries(assets)){
    lines.push('## '+category,'',...entries.map(e=>'- '+e.uri),'');
  }
  res.set('Content-Disposition','attachment; filename="catalogo-contentlab.md"');
  res.type('text/markdown').send(lines.join('\n'));
}));
app.get('/api/docs/view',api(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.type('html').send(buildHtml());
}));
app.get('/api/scene-library',api(async(req,res)=>res.json(sceneLibrary())));
app.get('/api/scene-library/:id/:name',api(async(req,res)=>{
 try{res.sendFile(libraryFile(req.params.id,req.params.name));}
 catch{res.status(404).json({error:'Arquivo do preset não encontrado.'});}
}));
app.post('/api/scene-library/install',api(async(req,res)=>{
 try{res.json(installScenePreset(req.body.projectRoot,req.body.id));}
 catch(e){res.status(409).json({error:e.message});}
}));
app.get('/api/docs/download',api(async(req,res)=>{
  const format=req.query.format;
  if(format!=='md'&&format!=='html')
    return res.status(400).json({error:'Formato permitido: md ou html.'});
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Disposition','attachment; filename="Documentacao-ContentLab.'+format+'"');
  if(format==='md')res.type('text/markdown; charset=utf-8').send(buildMarkdown());
  else res.type('text/html; charset=utf-8').send(buildHtml({standalone:true}));
}));
app.get('/api/docs/figures/:name.svg',api(async(req,res)=>{
  const name=req.params.name;
  if(!diagramNames.includes(name))return res.status(404).json({error:'Figura não encontrada.'});
  res.setHeader('X-Content-Type-Options','nosniff');
  res.type('image/svg+xml').send(diagramSvg(name));
}));
app.get('/api/skill/download',api(async(req,res)=>{
  await streamSkillZip(res);
}));
const makeSourceJob=(task,details={})=>{
  const id=crypto.randomUUID(),job={status:'running',percent:0,message:'Iniciando...',...details};
  sourceJobs.set(id,job);
  const update=(percent,message)=>Object.assign(job,{percent,message});
  Promise.resolve().then(()=>task(job,update)).then(()=>{
    if(job.status==='running')job.status='done';job.percent=100;job.message='Concluído.';
  }).catch(e=>{job.status='error';job.error=e.message;job.message='Falha no processamento.';console.error(e);});
  return id;
};
app.get('/api/cache',api(async(req,res)=>res.json({videos:listSources()})));
app.get('/api/cache-preview/:id',api(async(req,res)=>{
  const item=cachedSource(req.params.id);res.sendFile(item.path,{acceptRanges:true});
}));
app.post('/api/cache/open',api(async(req,res)=>{
  const item=cachedSource(req.body.key);
  try{await run(process.platform==='win32'?'explorer.exe':'xdg-open',[item.folder]);}catch{}
  res.json({ok:true});
}));
app.post('/api/cache/delete',api(async(req,res)=>{removeSource(req.body.key);res.json({ok:true});}));
app.post('/api/choose-video',api(async(req,res)=>{
  let selected='';
  try {
    if(process.platform==='win32'){
      const ps='Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Filter="Vídeos|*.mp4;*.mkv;*.mov;*.webm;*.avi"; if($d.ShowDialog() -eq "OK"){$d.FileName}';
      selected=(await run('powershell.exe',['-NoProfile','-Command',ps])).stdout.trim();
    }else selected=(await run('zenity',['--file-selection','--file-filter=*.mp4 *.mkv *.mov *.webm *.avi'])).stdout.trim();
  }catch{}
  res.json({path:selected});
}));
app.post('/api/local-source/import',api(async(req,res)=>{
  const filepath=req.body?.path;
  if(typeof filepath!=='string')return forbidden(res,'Selecione um arquivo local.');
  const id=makeSourceJob(async(job,update)=>{
    const source=await importLocalSource(filepath,update);job.source=source;
  });
  res.status(202).json({job_id:id});
}));
app.post('/api/info',api(async(req,res)=>res.json(await getSourceInfo(req.body.url))));
app.post('/api/preview',api(async(req,res)=>{
  const source=await resolveSource(req.body.url);
  const id=crypto.randomUUID();previews.set(id,source.key);
  res.json({preview_id:id});
}));
app.get('/api/video-proxy/:id',api(async(req,res)=>{
  const key=previews.get(req.params.id);
  if(!key)return res.status(404).json({error:'Prévia não encontrada.'});
  res.sendFile(cachedSource(key).path,{acceptRanges:true});
}));
app.post('/api/download',api(async(req,res)=>{
  const options=req.body||{};
  if(!['video','audio','transcript'].includes(options.mode))return forbidden(res,'Formato de saída inválido.');
  if(options.projectRoot)voiceStudioFolder(options.projectRoot);
  else { options.folder=options.folder||path.join(os.homedir(),'Downloads');fs.mkdirSync(options.folder,{recursive:true}); }
  const id=makeSourceJob(async(job,update)=>{
    update(2,'Preparando fonte...');
    const source=await resolveSource(options.url,update);
    let folder=options.projectRoot?projectAssetDirectory(options.projectRoot,options.sourceName||source.title,options.mode):options.folder;
    if(options.mode==='transcript')folder=fs.mkdtempSync(path.join(folder,'transcricao-'));
    update(82,'Exportando trecho...');
    const start=Number(options.start),end=Number(options.end);
    if(options.mode!=='transcript')job.filepath=await exportCut(source,{
      folder,filename:options.filename,mode:options.mode,
      full:options.full,start,end
    });
    else{
      const tmp=await exportCut(source,{folder,filename:options.filename||source.title,mode:'audio',
        full:options.full,start,end});
      await transcribeAudio(tmp,fs.realpathSync(folder),{
        model:options.transcript_model||'base',language:'pt',update:message=>update(90,message)
      });
      job.filepath=path.join(fs.realpathSync(folder),'transcript.srt');
    }
    job.folder=fs.realpathSync(folder);
  });
  res.status(202).json({job_id:id});
}));
app.post('/api/batch-download',api(async(req,res)=>{
  if(req.body.projectRoot)voiceStudioFolder(req.body.projectRoot);
  else {req.body.folder=req.body.folder||path.join(os.homedir(),'Downloads');fs.mkdirSync(req.body.folder,{recursive:true});}
  const input=String(req.body.batch_text||''),rows=input.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const items=[],errors=[];
  for(let i=0;i<rows.length;i++){
    const parts=rows[i].split(/[;,\t]/).map(x=>x.trim());
    const start=Number(parts[0]),end=Number(parts[1]);
    if(parts.length<2||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)errors.push('Linha '+(i+1)+': início/fim inválidos.');
    else items.push({start,end,title:parts[2]||'trecho-'+(i+1),status:'waiting'});
  }
  if(errors.length||!items.length)return res.status(422).json({error:'Lote inválido.',validation_errors:errors.length?errors:['Nenhuma linha encontrada.']});
  const id=makeSourceJob(async(job,update)=>{
    job.items=items;job.filepaths=[];job.folder=req.body.folder;
    const source=await resolveSource(req.body.url,update);
    const folder=req.body.projectRoot?projectAssetDirectory(req.body.projectRoot,req.body.sourceName||source.title,req.body.mode):req.body.folder;job.folder=folder;
    for(let i=0;i<items.length;i++){
      const item=items[i];item.status='running';update(Math.round(100*i/items.length),'Exportando '+item.title);
      try{const file=await exportCut(source,{folder,filename:item.title,
        mode:req.body.mode==='audio'?'audio':'video',full:false,start:item.start,end:item.end});
        job.filepaths.push(file);item.status='done';
      }catch(e){item.status='error';item.error=e.message;}
    }
    if(items.some(x=>x.status==='error'))job.status='done_with_errors';
  },{items});
  res.status(202).json({job_id:id});
}));
app.get('/api/progress/:id',api(async(req,res)=>{
  const job=sourceJobs.get(req.params.id);
  if(!job)return res.status(404).json({error:'Processamento não encontrado.'});
  res.json(job);
}));
app.get('/api/audio-treatment/preferences',api(async(req,res)=>{
  res.json({controls:readAudioTreatmentSettings()});
}));
app.get('/api/transcription/state',api(async(req,res)=>{
  res.json(voiceStudioState(String(req.query.projectRoot||'')));
}));
app.post('/api/transcription/jobs',upload.single('file'),api(async(req,res)=>{
  if(req.body.scope!=='narration'){
    if(!req.file)return forbidden(res,'Selecione o arquivo de áudio para transcrição avulsa.');
    if(!['.wav','.mp3','.m4a','.aac','.flac','.ogg','.opus'].includes(path.extname(req.file.originalname||'').toLowerCase())){fs.rmSync(req.file.path,{force:true});return forbidden(res,'Formato de áudio inválido.');}
    const downloads=path.join(os.homedir(),'Downloads');fs.mkdirSync(downloads,{recursive:true});
    const root=fs.mkdtempSync(path.join(downloads,'transcricao-')),id=crypto.randomUUID();
    const job={id,scope:'standalone',status:'running',message:'Transcrevendo arquivo avulso...',projectRoot:root,result:null,error:null};transcriptions.set(id,job);
    res.status(202).json({jobId:id});
    transcribeAudio(req.file.path,root,{model:req.body.model||'small',language:req.body.language||'pt',detail:req.body.detail||'words',update:message=>{job.message=message;}})
      .then(result=>Object.assign(job,{status:'done',message:'Transcrição avulsa pronta. Projeto preservado.',result:{...result,removedCount:0}}))
      .catch(e=>Object.assign(job,{status:'error',error:e.message,message:'Falha na transcrição avulsa.'}))
      .finally(()=>fs.rmSync(req.file.path,{force:true}));return;
  }
  let root;
  try{root=voiceStudioFolder(req.body.projectRoot);}
  catch(e){if(req.file)fs.rmSync(req.file.path,{force:true});return forbidden(res,e.message);}
  if(activeRender(root)||runningTranscription(root)||voiceCreation.isProjectBusy(root)){
    if(req.file)fs.rmSync(req.file.path,{force:true});
    return res.status(409).json({error:'Já há processamento de áudio neste projeto.'});
  }
  const ext=req.file?path.extname(req.file.originalname||'').toLowerCase():null;
  if(req.file&&!['.wav','.mp3','.m4a','.aac','.flac','.ogg','.opus'].includes(ext)){
    fs.rmSync(req.file.path,{force:true});return forbidden(res,'Formato de áudio inválido.');
  }
  const state=voiceStudioState(root);
  if(!req.file&&!state.ready)return forbidden(res,'Selecione o áudio ou prepare primeiro uma narração.');
  const sourceFile=req.file?req.file.path+ext:path.join(root,state.source);
  if(req.file)fs.renameSync(req.file.path,sourceFile);
  const id=crypto.randomUUID();
  const job={id,status:'running',message:'Preparando narração...',projectRoot:root,result:null,error:null};
  transcriptions.set(id,job);
  res.status(202).json({jobId:id});
  prepareStandaloneNarration(root,{
    sourceFile,model:req.body.model||'small',language:req.body.language||'pt',detail:req.body.detail||'words',
    options:{
      removeMiddleSilence:req.body.removeMiddleSilence!=='false',
      minSilence:Number(req.body.minSilence||.7),
      thresholdDb:Number(req.body.thresholdDb||-42),
      trimEdges:req.body.trimEdges!=='false',normalize:req.body.normalize!=='false',compression:req.body.compression==='true',deesser:req.body.deesser==='true',targetLufs:req.body.targetLufs??-16,highpassHz:req.body.highpassHz??70,
      reduceBreaths:req.body.reduceBreaths==='true',breathReductionStrength:req.body.breathReductionStrength??60,
      enhancementEngine:req.body.enhancementEngine||'off',enhancementMode:req.body.enhancementMode||'natural',enhancementStrength:req.body.enhancementStrength??80,
      ...(req.body.voicePreset?{voicePreset:String(req.body.voicePreset)}:
        {pitchSemitones:Number(req.body.pitchSemitones||0)})
    },update:message=>{job.message=message;}
  }).then(result=>{
    // Gravar preferências somente depois que o processamento oficial terminar com sucesso.
    try{if(req.body.audioTreatmentSettings)writeAudioTreatmentSettings(req.body.audioTreatmentSettings);}catch(error){console.warn('Não foi possível salvar as preferências locais do tratamento:',error.message);}
    Object.assign(job,{status:'done',message:'Narração e transcrição prontas.',result});
  })
    .catch(e=>Object.assign(job,{status:'error',message:'Falha no preparo da narração.',error:e.message}))
    .finally(()=>{if(req.file)fs.rmSync(sourceFile,{force:true});});
}));
app.get('/api/transcription/jobs/:id/audio',api(async(req,res)=>{
  const job=transcriptions.get(req.params.id);
  if(!job||job.status!=='done'||!job.result?.narration)
    return res.status(404).json({error:'Narração processada ainda não disponível.'});
  const variant=String(req.query.variant||'styled');
  if(!['styled','prepared','original'].includes(variant))return forbidden(res,'Versão de áudio inválida.');
  const name=variant==='original'?path.basename(job.result.source):variant==='prepared'?'narration.prepared.wav':'narration.wav';
  const audio=path.join(job.projectRoot,'audio',name);
  if(!fs.existsSync(audio))return res.status(404).json({error:'Áudio não encontrado.'});
  res.set('Cache-Control','no-store');
  if(fs.lstatSync(audio).isSymbolicLink())return forbidden(res,'Áudio inválido.');
  await sendNarrationAudio(req,res,audio);
}));
app.get('/api/transcription/jobs/:id',api(async(req,res)=>{
  const job=transcriptions.get(req.params.id);
  if(!job)return res.status(404).json({error:'Transcrição não encontrada.'});
  res.json(job);
}));
const voiceCreation=mountVoiceCreationRoutes(app,api,{isProjectBusy:root=>activeRender(root)||!!runningTranscription(root)});
mountWorkspaceRoutes(app,api,{isBusy:root=>activeRender(root)||!!runningTranscription(root)||voiceCreation.isProjectBusy(root)});
mountSocialRoutes(app,api);
mountSocialPublishRoutes(app,api,upload);
mountSocialMetricsRoutes(app,api);
mountMediaLibraryRoutes(app,api);
const runningIdentity=instanceIdentity();
app.get('/health',api(async(req,res)=>res.json({
  ok:true,backend:'node',renderer:'remotion',...runningIdentity
})));
const server=app.listen(PORT,HOST,()=>console.log('Content Lab Node: http://'+HOST+':'+PORT));
app.post('/api/shutdown',api(async(req,res)=>{
  const active=[...sourceJobs.values(),...jobs.values(),...transcriptions.values()].filter(j=>j.status==='running').length+
    (renderQueue.latest()?.status==='running'?1:0)+voiceCreation.activeCount();
  if(active&&!req.body?.force)return res.status(409).json({requires_force:true,active_jobs:active});
  voiceCreation.cancelAll();res.json({ok:true});server.close();
}));
