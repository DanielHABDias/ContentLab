import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {APP_ROOT,projectFile,readJson,assetReport,validatePlan,PlanError} from './plan.mjs';
import {createProject,loadProject,saveProject,listAssets,registry,visualContext,installedAssets} from './project.mjs';
import {renderProject} from './render.mjs';
import {run} from './exec.mjs';

const PORT=Number(process.env.PORT||5000);
const HOST='127.0.0.1';
const app=express(),jobs=new Map(),transcriptions=new Map();
app.disable('x-powered-by');
app.use(express.json({limit:'5mb'}));
app.use('/static',express.static(path.join(APP_ROOT,'frontend','static'),{index:false}));
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
app.post('/api/editor/project',api(async(req,res)=>res.json(loadProject(req.body.projectRoot))));
app.post('/api/editor/project/create',api(async(req,res)=>res.status(201).json(createProject(req.body.parentRoot,req.body.name))));
app.post('/api/editor/project/assets',api(async(req,res)=>res.json(listAssets(req.body.projectRoot,req.body.folder))));
app.post('/api/editor/validate',api(async(req,res)=>{
  const root=projectFile(req.body.projectRoot).root;
  const validation=assetReport(req.body.plan,root);
  res.status(validation.valid?200:422).json(validation);
}));
app.post('/api/editor/project/save',api(async(req,res)=>{
  try{res.json(saveProject(req.body.projectRoot,req.body.planText,req.body.revision));}
  catch(e){
    if(e.issues?.some(x=>x.path==='revision'))return res.status(409).json({error:e.message,errors:e.issues});
    throw e;
  }
}));
app.post('/api/editor/project/narration',upload.single('file'),api(async(req,res)=>{
  if(!req.file)return forbidden(res,'Selecione uma narração.');
  try{
    const {root}=projectFile(req.body.projectRoot),ext=path.extname(req.file.originalname||'').toLowerCase();
    if(!['.wav','.mp3','.m4a','.aac','.flac','.ogg','.opus'].includes(ext))return forbidden(res,'Formato de áudio inválido.');
    const audioDir=path.join(root,'audio');
    if(fs.existsSync(audioDir)&&fs.lstatSync(audioDir).isSymbolicLink())return forbidden(res,'Pasta audio insegura.');
    fs.mkdirSync(audioDir,{recursive:true});
    const dest=path.join(audioDir,'narration-'+crypto.randomUUID()+ext);
    fs.renameSync(req.file.path,dest);
    res.status(201).json({path:dest,relative:path.relative(root,dest).split(path.sep).join('/')});
  }finally{if(fs.existsSync(req.file.path))fs.rmSync(req.file.path,{force:true});}
}));
app.post('/api/editor/project/transcript',smallUpload.single('file'),api(async(req,res)=>{
  if(!req.file)return forbidden(res,'Selecione transcript.json.');
  const {root}=projectFile(req.body.projectRoot),doc=JSON.parse(req.file.buffer.toString('utf8'));
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
  if([...jobs.values()].some(job=>job.projectRoot===root&&job.status==='running'))return res.status(409).json({error:'Já há um render deste projeto.'});
  const id=crypto.randomUUID(),controller=new AbortController();
  const job={status:'running',stage:'prepare',percent:0,message:'Preparando render...',projectRoot:root,
    mode:'final',cacheMode,sceneId:null,error:null,filepath:null,controller,startedAt:Date.now()};
  jobs.set(id,job);
  res.status(202).json({jobId:id});
  const progress=(stage,current,total,sceneId)=>{
    if(controller.signal.aborted)throw Error('Render cancelado.');
    Object.assign(job,{stage,current,total,sceneId:stage==='scene'?String(sceneId).replace(/ \(cache\)$/,''):null});
    if(stage==='scene'){
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
app.get('/api/skill/download',api(async(req,res)=>{
  res.status(501).json({error:'A skill antiga ainda requer atualização para o contrato único antes de ser redistribuída.'});
}));
// This route does not launch Python: a native whisper.cpp CLI can be connected here.
app.post('/api/transcription/jobs',upload.single('file'),api(async(req,res)=>{
  if(req.file&&fs.existsSync(req.file.path))fs.rmSync(req.file.path,{force:true});
  res.status(501).json({error:'A transcrição nativa em Node/whisper.cpp ainda não foi concluída nesta branch de migração.'});
}));
app.get('/api/transcription/jobs/:id',api(async(req,res)=>res.status(404).json({error:'Transcrição não iniciada.'})));
app.post('/api/info',api(async(req,res)=>res.status(501).json({error:'Importação YouTube será migrada para um cliente JavaScript nativo.'})));
for(const endpoint of ['/api/preview','/api/download','/api/batch-download','/api/local-source/import','/api/cache/open','/api/cache/delete']){
  app.post(endpoint,api(async(req,res)=>res.status(501).json({error:'Ferramenta de vídeo em migração para Node.js.'})));
}
app.get('/api/cache',api(async(req,res)=>res.json({items:[]})));
app.get('/api/cache-preview/:id',api(async(req,res)=>res.status(404).json({error:'Vídeo não encontrado.'})));
app.get('/api/video-proxy/:id',api(async(req,res)=>res.status(404).json({error:'Prévia não encontrada.'})));
app.post('/api/choose-video',api(async(req,res)=>res.status(501).json({error:'Seletor de mídia em migração.'})));
app.get('/health',api(async(req,res)=>res.json({ok:true,backend:'node',renderer:'remotion'})));
const server=app.listen(PORT,HOST,()=>console.log('Content Lab Node: http://'+HOST+':'+PORT));
app.post('/api/shutdown',api(async(req,res)=>{res.json({ok:true});server.close();}));
