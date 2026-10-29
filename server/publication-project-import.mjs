/* Importação local de projetos Content Lab: somente edit_plan.json,
   output/final/final.mp4 e imagens exportadas em thumbnails/. */
import fs from 'node:fs';
import path from 'node:path';
import {createSocialDraft,deleteSocialDraft,listSocialDrafts,SOCIAL_DRAFT_DIR} from './social-drafts.mjs';

const MAX_PROJECTS=90;
const MAX_PLAN_BYTES=5*1024*1024;
const IMAGE_EXT=new Set(['.png','.jpg','.jpeg','.webp']);
const VIDEO_EXT=new Set(['.mp4']);
const isRegular=file=>{
  try{const stat=fs.lstatSync(file);return stat.isFile()&&!stat.isSymbolicLink();}
  catch{return false;}
};
const safeDir=dir=>{
  try{const stat=fs.lstatSync(dir);return stat.isDirectory()&&!stat.isSymbolicLink();}
  catch{return false;}
};
function rootPath(value){
  if(typeof value!=='string'||!value.trim()||value.length>4096||value.includes('\0'))
    throw Error('Caminho de projeto inválido.');
  const resolved=path.resolve(value);
  if(!safeDir(resolved))throw Error('Pasta de projeto indisponível ou link simbólico: '+path.basename(resolved));
  const real=fs.realpathSync(resolved);
  if((process.platform==='win32'?real.toLowerCase()!==resolved.toLowerCase():real!==resolved))
    throw Error('Não importe projetos por links simbólicos.');
  return real;
}
function projectPlan(root){
  const file=path.join(root,'edit_plan.json');
  if(!isRegular(file))return null;
  if(fs.statSync(file).size>MAX_PLAN_BYTES)throw Error('edit_plan.json maior que 5 MB.');
  let plan;try{plan=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
  catch{throw Error('edit_plan.json inválido.');}
  if(!plan||typeof plan!=='object'||!plan.project||typeof plan.project!=='object')
    throw Error('edit_plan.json sem projeto válido.');
  return plan;
}
function kindFromPlan(plan){
  if(plan.project.format==='youtube_short')return 'short';
  if(plan.project.format==='youtube_long')return 'long';
  if(plan.project.format==='custom'){
    const w=Number(plan.project.resolution?.width),h=Number(plan.project.resolution?.height);
    if(w>0&&h>0&&w!==h)return h>w?'short':'long';
  }
  throw Error('Formato indefinido no Edit Plan. Escolha youtube_short, youtube_long ou resolução customizada.');
}
const timestamp=file=>{
  const s=fs.statSync(file);
  return Math.max(s.mtimeMs,Number.isFinite(s.birthtimeMs)?s.birthtimeMs:0);
};
export function inspectPublicationProject(projectRoot){
  const root=rootPath(projectRoot);
  const plan=projectPlan(root);
  if(!plan)throw Error('Esta pasta não contém edit_plan.json.');
  const kind=kindFromPlan(plan);
  const name=String(plan.project.name||path.basename(root)).trim().slice(0,150)||path.basename(root).slice(0,150);
  const finalDir=path.join(root,'output','final');
  const video=path.join(finalDir,'final.mp4');
  if(!safeDir(path.join(root,'output'))||!safeDir(finalDir)||!isRegular(video))
    throw Error('Vídeo final não encontrado em output/final/final.mp4.');
  if(!VIDEO_EXT.has(path.extname(video).toLowerCase()))throw Error('Formato de vídeo não suportado.');
  const folder=path.join(root,'thumbnails');
  let images=[];
  if(safeDir(folder)){
    images=fs.readdirSync(folder,{withFileTypes:true})
      .filter(item=>item.isFile()&&!item.isSymbolicLink()&&IMAGE_EXT.has(path.extname(item.name).toLowerCase()))
      .map(item=>path.join(folder,item.name)).filter(isRegular)
      .sort((a,b)=>timestamp(b)-timestamp(a)||path.basename(b).localeCompare(path.basename(a)));
  }
  if(!images.length)throw Error('Nenhuma thumbnail PNG, JPG ou WebP encontrada na pasta thumbnails.');
  // Em vídeos longos, A é a anterior e B a mais recente. Em Shorts, só A.
  const coverA=kind==='long'?(images[1]||images[0]):images[0];
  const coverB=kind==='long'?images[0]:null;
  return {projectRoot:root,name,kind,format:plan.project.format,
    videoPath:video,videoName:path.basename(video),videoBytes:fs.statSync(video).size,
    coverAPath:coverA,coverBPath:coverB,
    coverAName:path.basename(coverA),coverBName:coverB&&path.basename(coverB),
    needsReview:kind==='long'&&images.length<2,
    warning:kind==='long'&&images.length<2?
      'Apenas uma thumbnail disponível. A opção B será uma cópia provisória; edite o título e a capa B antes de publicar.':
      'Pré-seleção automática. Confira as informações antes de publicar.'};
}
export function discoverPublicationProjects(folders,{limit=MAX_PROJECTS}={}){
  if(!Array.isArray(folders)||!folders.length||folders.length>MAX_PROJECTS)
    throw Error('Selecione de 1 a 90 pastas.');
  const roots=new Set(),items=[],skipped=[];
  for(const selected of folders){
    const parent=rootPath(selected);
    const childRoots=projectPlan(parent)?[parent]:
      fs.readdirSync(parent,{withFileTypes:true})
        .filter(d=>d.isDirectory()&&!d.isSymbolicLink()).slice(0,200)
        .map(d=>path.join(parent,d.name)).filter(dir=>isRegular(path.join(dir,'edit_plan.json')));
    if(!childRoots.length){
      skipped.push({folder:parent,reason:'Nenhum projeto com edit_plan.json nesta pasta ou nas subpastas imediatas.'});
    }
    for(const folder of childRoots){
      const real=rootPath(folder);
      if(roots.has(real))continue;
      roots.add(real);
      if(roots.size>limit)throw Error('Limite de '+limit+' projetos por importação.');
      try{items.push(inspectPublicationProject(real));}
      catch(error){skipped.push({folder:real,reason:error.message});}
    }
  }
  return {items,skipped};
}
function variantTitle(title){
  const suffix=' · título B (revisar)';
  return title.slice(0,150-suffix.length)+suffix;
}
function asUpload(file){
  return [{path:file,originalname:path.basename(file)}];
}
export function importPublicationProjects(entries,{
  confirmed,root=SOCIAL_DRAFT_DIR,now=new Date()
}={}){
  if(!Array.isArray(entries)||!entries.length||entries.length>MAX_PROJECTS)
    throw Error('Escolha de 1 a 90 projetos para importar.');
  const existing=listSocialDrafts(root);
  if(existing.length+entries.length>100)throw Error('A lista suporta no máximo 100 vídeos.');
  const used=new Set(existing.map(item=>item.sourceProject).filter(Boolean));
  const staged=[],created=[];
  for(const entry of entries){
    if(!entry||typeof entry!=='object')throw Error('Item de importação inválido.');
    const item=inspectPublicationProject(entry.projectRoot);
    if(used.has(item.projectRoot))throw Error('Projeto já importado ou repetido: '+item.name);
    used.add(item.projectRoot);
    const at=String(entry.scheduledAt||'');
    const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(at);
    if(!m)throw Error('Data de publicação inválida para '+item.name);
    const nums=m.slice(1).map(Number),date=new Date(...[nums[0],nums[1]-1,nums[2],nums[3],nums[4]]);
    if(!Number.isFinite(date.getTime())||date.getFullYear()!==nums[0]||
      date.getMonth()!==nums[1]-1||date.getDate()!==nums[2]||
      date.getHours()!==nums[3]||date.getMinutes()!==nums[4]||
      date.getTime()<now.getTime())throw Error('Data inválida ou passada para '+item.name);
    const platforms=(item.kind==='short'?['youtube','tiktok','instagram']:['youtube','instagram'])
      .filter(p=>confirmed?.[p]===true);
    if(!platforms.length)throw Error('Nenhuma rede compatível confirmada para '+item.name);
    const titleA=String(entry.titleA||item.name).trim().slice(0,150);
    const titleB=item.kind==='long'?String(entry.titleB||variantTitle(titleA)).trim().slice(0,150):'';
    staged.push({item,body:{kind:item.kind,titleA,titleB,description:'',
      tags:'',platforms:JSON.stringify(platforms),scheduledAt:at}});
  }
  try{
    // O manifesto coloca o último criado no topo. Criar do fim para o
    // início preserva exatamente a ordem visual escolhida na revisão.
    for(const {item,body} of staged.slice().reverse()){
      const saved=createSocialDraft({body,confirmed,root,sourceProject:item.projectRoot,
        needsReview:item.needsReview,files:{
          video:asUpload(item.videoPath),coverA:asUpload(item.coverAPath),
          ...(item.coverBPath?{coverB:asUpload(item.coverBPath)}:{})
        }});
      created.unshift(saved);
    }
  }catch(error){
    for(const item of created.reverse())try{deleteSocialDraft(item.id,root);}catch{}
    throw error;
  }
  return created;
}
