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
  const root=voiceStudioFolder(folder),directory=path.join(root,'thumbnails');
  if(!fs.existsSync(directory))return {state:null,revision:null};
  if(fs.lstatSync(directory).isSymbolicLink()||!fs.statSync(directory).isDirectory())
    throw Error('Pasta de thumbnail inválida.');
  const file=path.join(directory,'project.json');
  if(!fs.existsSync(file))return {state:null,revision:null};
  if(!regular(file)||fs.statSync(file).size>95*1024*1024)throw Error('Projeto de thumbnail inválido.');
  const bytes=fs.readFileSync(file);return {state:JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),revision:revision(bytes)};
}
const FINAL_THUMBNAIL=/^TH_([A-Z]+)\.(jpg|jpeg|png|webp)$/i;
const THUMBNAIL_IMAGE_EXTENSIONS=new Set(['.png','.jpg','.jpeg','.webp']);
function thumbnailSlot(index){
  let name='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;
  return 'TH_'+name;
}
export function listFinalThumbnails(folder){
  const root=voiceStudioFolder(folder),directory=path.join(root,'output');
  if(!fs.existsSync(directory))return [];
  if(fs.lstatSync(directory).isSymbolicLink()||!fs.statSync(directory).isDirectory())throw Error('Pasta output inválida.');
  return fs.readdirSync(directory).filter(name=>FINAL_THUMBNAIL.test(name)&&regular(path.join(directory,name))).sort().map(name=>{
    const bytes=fs.readFileSync(path.join(directory,name));
    return {name,revision:revision(bytes),slot:name.match(FINAL_THUMBNAIL)[1].toUpperCase()};
  });
}
export function saveThumbnailFile(folder,{name,bytes,draft=false,expectedRevision=null,replace=null,expectedFileRevision=null}){
  if(!Buffer.isBuffer(bytes)||bytes.length>95*1024*1024)throw Error('Thumbnail excede 95 MB.');
  if(draft){
    const directory=projectDirectory(folder,['thumbnails']);
    const state=JSON.parse(bytes.toString('utf8'));if(state.version!==1||!state.base||!state.background||!state.media||!Array.isArray(state.variants))throw Error('Projeto de thumbnail inválido.');
    const file=path.join(directory,'project.json');
    const current=readThumbnailProject(folder);if(current.revision!==expectedRevision)throw Error('Thumbnail alterada fora desta sessão. Recarregue o projeto antes de salvar.');
    const tmp=path.join(directory,'.draft-'+crypto.randomUUID());
    try{fs.writeFileSync(tmp,bytes,{flag:'wx'});fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}
    return {relative:'thumbnails/project.json',revision:revision(bytes)};
  }
  if(typeof name!=='string'||name!==path.basename(name)||/[\\/\x00]/.test(name))throw Error('Nome de thumbnail inválido.');
  const ext=path.extname(name).toLowerCase();
  // JSONs e ZIPs portáteis continuam disponíveis, mas o projeto editável não sai de thumbnails/project.json.
  if(![...THUMBNAIL_IMAGE_EXTENSIONS,'.zip','.json'].includes(ext))throw Error('Formato de thumbnail inválido.');
  const output=projectDirectory(folder,['output']);
  if(THUMBNAIL_IMAGE_EXTENSIONS.has(ext)){
    const existing=listFinalThumbnails(folder);
    if(replace){
      if(typeof replace!=='string'||!FINAL_THUMBNAIL.test(replace)||!existing.some(item=>item.name===replace))
        throw Error('Thumbnail de destino inexistente. Atualize a lista.');
      if(path.extname(replace).toLowerCase()!==ext)throw Error('Para substituir, selecione o mesmo formato de arquivo.');
      const current=existing.find(item=>item.name===replace);
      if(!expectedFileRevision||current.revision!==expectedFileRevision)throw Error('Thumbnail alterada desde a seleção. Atualize a lista antes de substituir.');
      const file=path.join(output,replace),tmp=path.join(output,'.thumbnail-'+crypto.randomUUID());
      try{
        fs.writeFileSync(tmp,bytes,{flag:'wx'});
        if(!regular(file)||revision(fs.readFileSync(file))!==expectedFileRevision)throw Error('Thumbnail alterada antes da substituição.');
        fs.renameSync(tmp,file);
      }finally{fs.rmSync(tmp,{force:true});}
      return {relative:'output/'+replace,replaced:true};
    }
    const occupied=new Set(existing.map(item=>item.slot));
    for(let i=0;i<10000;i++){
      const slot=thumbnailSlot(i).slice(3);
      if(occupied.has(slot))continue;
      const filename='TH_'+slot+ext;
      try{fs.writeFileSync(path.join(output,filename),bytes,{flag:'wx'});return {relative:'output/'+filename,replaced:false};}
      catch(error){if(error.code!=='EEXIST')throw error;occupied.add(slot);}
    }
    throw Error('Limite de thumbnails do projeto atingido.');
  }
  if(replace)throw Error('Substituição somente para imagens TH_.');
  const base=projectSlug(path.basename(name,ext));
  for(let i=0;i<10000;i++){
    const filename=base+(i?'_'+i:'')+ext;
    try{fs.writeFileSync(path.join(output,filename),bytes,{flag:'wx'});return {relative:'output/'+filename};}
    catch(error){if(error.code!=='EEXIST')throw error;}
  }
  throw Error('Muitos arquivos com este nome.');
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
  app.get('/api/workspace/thumbnails/finals',api(async(req,res)=>res.json({files:listFinalThumbnails(req.query.projectRoot)})));
  app.post('/api/workspace/edit-plan',api(async(req,res)=>{
    const root=voiceStudioFolder(req.body.projectRoot);if(isBusy(root))throw Error('Aguarde o processamento antes de criar o plano.');
    const initial={project:{name:String(req.body.name||path.basename(root)).slice(0,100),format:'youtube_long',profile:'generic'},sources:{assets:'assets',transcript:'transcript.json'},audio:{narration:'audio/narration.wav'},timeline:[]};
    fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(initial,null,2)+'\n',{flag:'wx'});res.status(201).json(loadProject(root));
  }));
  app.post('/api/workspace/thumbnails',(req,res,next)=>upload(req,res,error=>error?res.status(400).json({error:error.message}):next()),api(async(req,res)=>{
    if(!req.file)throw Error('Arquivo de thumbnail não enviado.');
    res.json(saveThumbnailFile(req.body.projectRoot,{name:req.file.originalname,bytes:req.file.buffer,draft:req.body.kind==='draft',expectedRevision:req.body.revision||null,replace:req.body.replace||null,expectedFileRevision:req.body.expectedFileRevision||null}));
  }));
}
