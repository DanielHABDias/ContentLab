import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import {voiceStudioFolder} from './voice-studio.mjs';
import {takeList,rescanTakes} from './narration-assembly.mjs';
import {loadProject} from './project.mjs';
export const projectSlug=value=>String(value||'fonte').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'fonte';
export function projectDirectory(folder,parts=[]){
  const root=voiceStudioFolder(folder);let target=root;
  for(const part of parts){
    if(!part||part==='.'||part==='..'||/[\/\\\x00]/.test(part))throw Error('Subpasta inválida.');
    target=path.join(target,part);
    if(fs.existsSync(target)){if(fs.lstatSync(target).isSymbolicLink()||!fs.statSync(target).isDirectory())throw Error('Subpasta inválida ou link simbólico.');}
    else fs.mkdirSync(target);
  }
  return target;
}
export function projectAssetDirectory(folder,source,mode='video'){
  return projectDirectory(folder,['assets',projectSlug(source),mode==='audio'?'audio':mode==='transcript'?'transcripts':mode==='image'?'images':'clips']);
}
function regular(file){return fs.existsSync(file)&&fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink();}
export async function inspectWorkspace(folder,{reload=false}={}){
  const root=voiceStudioFolder(folder),assets=[];
  function visit(directory,depth=0){
    if(depth>8||assets.length>=2000||!fs.existsSync(directory)||fs.lstatSync(directory).isSymbolicLink())return;
    for(const item of fs.readdirSync(directory,{withFileTypes:true})){
      if(assets.length>=2000)break;if(item.isSymbolicLink()||item.name.startsWith('.'))continue;
      const file=path.join(directory,item.name);if(item.isDirectory())visit(file,depth+1);else if(item.isFile())assets.push(path.relative(root,file).split(path.sep).join('/'));
    }
  }
  for(const category of ['assets','audio','thumbnails'])visit(path.join(root,category));
  const list=reload?await rescanTakes(root):takeList(root);
  return {projectRoot:root,name:path.basename(root),hasEditPlan:regular(path.join(root,'edit_plan.json')),
    hasTranscript:regular(path.join(root,'transcript.json')),
    hasNarration:regular(path.join(root,'audio','narration.wav')),
    assets,takeCount:list.takes.length,truncated:assets.length>=2000};
}
const revision=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function readThumbnailProject(folder){
  const file=path.join(projectDirectory(folder,['thumbnails']),'project.json');
  if(!fs.existsSync(file))return {state:null,revision:null};
  if(!regular(file)||fs.statSync(file).size>95*1024*1024)throw Error('Projeto de thumbnail inválido.');
  const bytes=fs.readFileSync(file);return {state:JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),revision:revision(bytes)};
}
export function saveThumbnailFile(folder,{name,bytes,draft=false,expectedRevision=null}){
  const directory=projectDirectory(folder,['thumbnails']);
  if(!Buffer.isBuffer(bytes)||bytes.length>95*1024*1024)throw Error('Thumbnail excede 95 MB.');
  if(draft){
    const state=JSON.parse(bytes.toString('utf8'));if(state.version!==1||!state.base||!state.background||!state.media||!Array.isArray(state.variants))throw Error('Projeto de thumbnail inválido.');
    const file=path.join(directory,'project.json');
    const current=readThumbnailProject(folder);if(current.revision!==expectedRevision)throw Error('Thumbnail alterada fora desta sessão. Recarregue o projeto antes de salvar.');
    const tmp=path.join(directory,'.draft-'+crypto.randomUUID());
    try{fs.writeFileSync(tmp,bytes,{flag:'wx'});fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}
    return {relative:'thumbnails/project.json',revision:revision(bytes)};
  }
  if(typeof name!=='string'||name!==path.basename(name)||/[\\/\x00]/.test(name))throw Error('Nome de thumbnail inválido.');
  const ext=path.extname(name).toLowerCase();if(!['.png','.jpg','.jpeg','.webp','.zip','.json'].includes(ext))throw Error('Formato de thumbnail inválido.');
  const base=projectSlug(path.basename(name,ext));let file;
  for(let i=0;i<10000;i++){
    file=path.join(directory,base+(i?'_'+i:'')+ext);
    try{fs.writeFileSync(file,bytes,{flag:'wx'});break;}catch(error){if(error.code!=='EEXIST')throw error;if(i===9999)throw Error('Muitos arquivos com este nome.');}
  }
  return {relative:'thumbnails/'+path.basename(file)};
}
export function mountWorkspaceRoutes(app,api,{isBusy=()=>false}={}){
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:95*1024*1024,files:1}}).single('file');
  app.use('/api/workspace',(req,res,next)=>{
    const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||req.headers.origin&&req.headers.origin!=='http://'+host)return res.status(403).json({error:'Acesso local somente.'});next();
  });
  app.post('/api/workspace/project',api(async(req,res)=>{
    const root=voiceStudioFolder(req.body.projectRoot);if(req.body.reload&&isBusy(root))return res.status(409).json({error:'Aguarde o processamento antes de recarregar o projeto.'});
    res.json(await inspectWorkspace(root,{reload:req.body.reload===true}));
  }));
  app.get('/api/workspace/thumbnails',api(async(req,res)=>res.json(readThumbnailProject(req.query.projectRoot))));
  app.post('/api/workspace/edit-plan',api(async(req,res)=>{
    const root=voiceStudioFolder(req.body.projectRoot);if(isBusy(root))throw Error('Aguarde o processamento antes de criar o plano.');
    const initial={project:{name:String(req.body.name||path.basename(root)).slice(0,100),format:'youtube_long',profile:'generic'},sources:{assets:'assets',transcript:'transcript.json'},audio:{narration:'audio/narration.wav'},timeline:[]};
    fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(initial,null,2)+'\n',{flag:'wx'});res.status(201).json(loadProject(root));
  }));
  app.post('/api/workspace/thumbnails',(req,res,next)=>upload(req,res,error=>error?res.status(400).json({error:error.message}):next()),api(async(req,res)=>{
    if(!req.file)throw Error('Arquivo de thumbnail não enviado.');
    res.json(saveThumbnailFile(req.body.projectRoot,{name:req.file.originalname,bytes:req.file.buffer,draft:req.body.kind==='draft',expectedRevision:req.body.revision||null}));
  }));
}
