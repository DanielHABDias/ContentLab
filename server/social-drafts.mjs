import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const SOCIAL_DRAFT_DIR=path.join(os.homedir(),'.contentlab','publication-drafts');
const MAX_DRAFTS=100;
const PLATFORMS=['youtube','instagram','tiktok'];
const allowed={short:['youtube','instagram','tiktok'],long:['youtube','instagram']};
const text=(v,max)=>typeof v==='string'&&v.trim()&&v.trim().length<=max?v.trim():null;
const idValid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const reject=message=>{throw Error(message);};
const storeReady=root=>{
  fs.mkdirSync(root,{recursive:true,mode:0o700});
  if(fs.lstatSync(root).isSymbolicLink())reject('Diretório local inseguro.');
};
const manifest=root=>path.join(root,'drafts.json');
function readItems(root=SOCIAL_DRAFT_DIR){
  try{
    const file=manifest(root);
    if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>512000)return [];
    const rows=JSON.parse(fs.readFileSync(file,'utf8'));
    return Array.isArray(rows)?rows.filter(x=>idValid(x.id)&&['long','short'].includes(x.kind)).slice(0,MAX_DRAFTS):[];
  }catch{return [];}
}
function writeItems(root,rows){
  storeReady(root);
  const file=manifest(root),temp=file+'.'+crypto.randomUUID()+'.tmp';
  if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())reject('Manifesto inseguro.');
  try{
    fs.writeFileSync(temp,JSON.stringify(rows,null,2)+'\n',{flag:'wx',mode:0o600});
    fs.renameSync(temp,file);
  }finally{fs.rmSync(temp,{force:true});}
}
export function listSocialDrafts(root=SOCIAL_DRAFT_DIR){return readItems(root);}
const formats={
  mp4:{extensions:['.mp4','.mov','.m4v'],mime:'video/mp4'},
  webm:{extensions:['.webm'],mime:'video/webm'},
  png:{extensions:['.png'],mime:'image/png'},
  jpg:{extensions:['.jpg','.jpeg'],mime:'image/jpeg'},
  webp:{extensions:['.webp'],mime:'image/webp'}
};
function inspectFile(file,kind){
  if(!file?.path||!fs.existsSync(file.path))reject('Selecione o arquivo de '+(kind==='video'?'vídeo':'thumbnail')+'.');
  const ext=path.extname(file.originalname||'').toLowerCase();
  const sig=Buffer.alloc(16),fd=fs.openSync(file.path,'r');
  try{fs.readSync(fd,sig,0,sig.length,0);}finally{fs.closeSync(fd);}
  const format=kind==='video'?
    (formats.mp4.extensions.includes(ext)&&sig.toString('ascii',4,8)==='ftyp'?'mp4':
      formats.webm.extensions.includes(ext)&&sig.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))?'webm':null):
    (formats.png.extensions.includes(ext)&&sig.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':
      formats.jpg.extensions.includes(ext)&&sig[0]===255&&sig[1]===216&&sig[2]===255?'jpg':
      formats.webp.extensions.includes(ext)&&sig.toString('ascii',0,4)==='RIFF'&&sig.toString('ascii',8,12)==='WEBP'?'webp':null);
  if(!format)reject('Formato de '+(kind==='video'?'vídeo':'imagem')+' inválido. Use '+(kind==='video'?'MP4 ou WebM':'PNG, JPG ou WebP')+'.');
  return {extension:format==='jpg'?'jpg':format,mime:formats[format].mime};
}
const pickFile=(files,key)=>Array.isArray(files?.[key])?files[key][0]:null;
function validateInput(body,files,confirmed){
  const kind=body?.kind;
  if(!Object.hasOwn(allowed,kind))reject('Escolha vídeo longo ou Short.');
  const titleA=text(body.titleA,150);
  if(!titleA)reject('Informe o título do vídeo (até 150 caracteres).');
  const titleB=kind==='long'?text(body.titleB,150):null;
  if(kind==='long'&&(!titleB||titleB===titleA))reject('O teste A/B exige dois títulos diferentes.');
  const description=typeof body.description==='string'?body.description.trim():'';
  if(description.length>5000)reject('Descrição muito longa.');
  const tags=typeof body.tags==='string'?body.tags.split(/[,\n]/).map(x=>x.trim().replace(/^#/,'')).filter(Boolean):[];
  if(tags.length>30||tags.some(x=>x.length>50))reject('Informe no máximo 30 tags, com até 50 caracteres cada.');
  let platforms;try{platforms=JSON.parse(body.platforms);}catch{reject('Selecione os destinos.');}
  if(!Array.isArray(platforms)||!platforms.length||new Set(platforms).size!==platforms.length||
    platforms.some(p=>!PLATFORMS.includes(p)||!allowed[kind].includes(p)||confirmed[p]!==true))
    reject('Escolha ao menos uma rede confirmada e compatível com o formato.');
  const scheduledAt=String(body.scheduledAt||'').trim();
  if(scheduledAt&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledAt))
    reject('Data e horário do agendamento inválidos.');
  const video=pickFile(files,'video'),coverA=pickFile(files,'coverA'),coverB=pickFile(files,'coverB');
  const videoType=inspectFile(video,'video');
  const aType=inspectFile(coverA,'image');
  const bType=kind==='long'?inspectFile(coverB,'image'):null;
  if(kind==='short'&&coverB)reject('Shorts aceitam somente uma thumbnail.');
  return {kind,titleA,titleB,description,tags,platforms,scheduledAt,video,coverA,coverB,videoType,aType,bType};
}
export function createSocialDraft({body,files,confirmed,root=SOCIAL_DRAFT_DIR}){
  const data=validateInput(body,files,confirmed);
  storeReady(root);
  const items=readItems(root);
  if(items.length>=MAX_DRAFTS)reject('Limite de 100 vídeos na lista. Remova um antes de adicionar.');
  const id=crypto.randomUUID(),folder=path.join(root,id);
  fs.mkdirSync(folder,{mode:0o700});
  const copy=(src,name)=>fs.copyFileSync(src.path,path.join(folder,name),fs.constants.COPYFILE_EXCL);
  try{
    const videoFile='video.'+data.videoType.extension,coverAFile='coverA.'+data.aType.extension,
      coverBFile=data.bType?'coverB.'+data.bType.extension:null;
    copy(data.video,videoFile);copy(data.coverA,coverAFile);
    if(coverBFile)copy(data.coverB,coverBFile);
    const item={
      id,kind:data.kind,titleA:data.titleA,titleB:data.titleB,description:data.description,
      tags:data.tags,platforms:data.platforms,scheduledAt:data.scheduledAt,
      fileName:path.basename(data.video.originalname).slice(0,160),
      bytes:fs.statSync(path.join(folder,videoFile)).size,
      media:{video:videoFile,coverA:coverAFile,coverB:coverBFile},
      createdAt:new Date().toISOString(),status:'draft'
    };
    writeItems(root,[item,...items]);
    return item;
  }catch(error){fs.rmSync(folder,{recursive:true,force:true});throw error;}
}
export function deleteSocialDraft(id,root=SOCIAL_DRAFT_DIR){
  if(!idValid(id))reject('Vídeo inválido.');
  const items=readItems(root),found=items.find(x=>x.id===id);
  if(!found)reject('Vídeo não encontrado.');
  writeItems(root,items.filter(x=>x.id!==id));
  fs.rmSync(path.join(root,id),{recursive:true,force:true});
  return true;
}
export function socialDraftMedia(id,kind,root=SOCIAL_DRAFT_DIR){
  if(!idValid(id)||!['video','coverA','coverB'].includes(kind))reject('Mídia inválida.');
  const item=readItems(root).find(x=>x.id===id),name=item?.media?.[kind];
  if(!name||path.basename(name)!==name)reject('Mídia não encontrada.');
  const folder=path.join(root,id),file=path.join(folder,name);
  if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())reject('Mídia não encontrada.');
  return file;
}
export function cleanupUploaded(files){
  for(const list of Object.values(files||{}))for(const file of list)if(file?.path)fs.rmSync(file.path,{force:true});
}
