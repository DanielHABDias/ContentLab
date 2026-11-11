import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {run} from './exec.mjs';
import {classifyVideoLink,getExternalVideoInfo,downloadExternalAsset} from './video-external.mjs';

export const SOURCE_CACHE=process.env.CONTENTLAB_SOURCE_CACHE||
  (process.platform==='win32'?path.join(process.env.LOCALAPPDATA||os.homedir(),'ContentLab','cache','videos'):
    path.join(process.env.XDG_CACHE_HOME||path.join(os.homedir(),'.cache'),'contentlab','cache','videos'));
const hash=x=>crypto.createHash('sha256').update(String(x)).digest('hex').slice(0,20);
export function safeTitle(s){return String(s||'video').replace(/[<>:"/\\|?*\x00-\x1f]/g,'').replace(/\s+/g,' ').trim().slice(0,110)||'video';}
function entryFolder(key){
  if(!/^[a-z]+-[a-z0-9]{20}$/.test(key))throw Error('Chave de cache inválida.');
  return path.join(SOURCE_CACHE,key);
}
export function cachedSource(key){
  const folder=entryFolder(key),metaFile=path.join(folder,'meta.json');
  if(!fs.existsSync(metaFile))throw Error('Fonte não encontrada no cache.');
  const item=JSON.parse(fs.readFileSync(metaFile,'utf8'));
  const full=path.join(folder,item.filename);
  if(!fs.existsSync(full))throw Error('Vídeo do cache não encontrado.');
  return {...item,key,folder,path:full,url:'contentlab-cache://'+key,size_bytes:fs.statSync(full).size};
}
export function listSources(){
  if(!fs.existsSync(SOURCE_CACHE))return [];
  return fs.readdirSync(SOURCE_CACHE,{withFileTypes:true}).filter(x=>x.isDirectory())
    .flatMap(entry=>{try{return [cachedSource(entry.name)];}catch{return [];}})
    .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
}
export async function probeVideo(file,ffprobe='ffprobe'){
  const r=await run(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_type,width,height',
    '-of','json',file]);
  const obj=JSON.parse(r.stdout);
  return {duration:Number(obj.format?.duration||0),
    width:obj.streams?.find(s=>s.codec_type==='video')?.width||0,
    height:obj.streams?.find(s=>s.codec_type==='video')?.height||0};
}
export async function importLocalSource(file,update=()=>{}){
  const source=fs.realpathSync(file);
  if(!fs.statSync(source).isFile()||!/\.(mp4|mkv|mov|webm|avi)$/i.test(source))throw Error('Selecione um arquivo de vídeo local.');
  const stat=fs.statSync(source),key='local-'+hash(source+':'+stat.size+':'+stat.mtimeNs);
  const folder=entryFolder(key);
  if(fs.existsSync(path.join(folder,'meta.json')))return cachedSource(key);
  fs.mkdirSync(folder,{recursive:true});
  const dest=path.join(folder,'video'+path.extname(source).toLowerCase());
  update(10,'Copiando vídeo local para o cache...');
  await fs.promises.copyFile(source,dest);
  const media=await probeVideo(dest);
  const item={title:path.parse(source).name,original_name:path.basename(source),origin:'local',filename:path.basename(dest),
    duration:media.duration,width:media.width,height:media.height,createdAt:new Date().toISOString()};
  fs.writeFileSync(path.join(folder,'meta.json'),JSON.stringify(item,null,2));
  update(100,'Vídeo copiado.');
  return cachedSource(key);
}
export function youtubeId(url){
  const u=new URL(url);
  if(!['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be'].includes(u.hostname))throw Error('Informe um link do YouTube válido.');
  const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop();
  if(!/^[\w-]{11}$/.test(id))throw Error('ID do vídeo do YouTube inválido.');
  return id;
}
export async function getYoutubeInfo(url){
  youtubeId(url);
  return getExternalVideoInfo(url);
}
export async function downloadYoutube(url,update=()=>{},options={}){
  youtubeId(url);
  return downloadInternetVideo(url,update,options);
}
export async function getSourceInfo(url){
  const kind=classifyVideoLink(url);
  if(kind.provider==='youtube')return getYoutubeInfo(kind.url);
  return getExternalVideoInfo(kind.url);
}
const pendingDownloads=new Map();
export async function downloadInternetVideo(url,update=()=>{},options={}){
  const link=classifyVideoLink(url);
  const key=link.provider==='youtube'?'yt-'+hash(youtubeId(link.url)):'web-'+hash(link.url);
  if(pendingDownloads.has(key))return pendingDownloads.get(key);
  const pending=downloadInternetVideoOnce(link.url,update,options);
  pendingDownloads.set(key,pending);
  try{return await pending;}finally{if(pendingDownloads.get(key)===pending)pendingDownloads.delete(key);}
}
async function downloadInternetVideoOnce(url,update=()=>{},{
  downloader=downloadExternalAsset,metadata=getExternalVideoInfo
}={}){
  const link=classifyVideoLink(url);
  const isYoutube=link.provider==='youtube';
  const key=isYoutube?'yt-'+hash(youtubeId(link.url)):'web-'+hash(link.url),folder=entryFolder(key);
  if(fs.existsSync(path.join(folder,'meta.json')))return cachedSource(key);
  fs.mkdirSync(folder,{recursive:true});
  // Each attempt owns only its temporary directory. Concurrent processes must
  // never write/delete one another's yt-dlp fragments or shared cache folder.
  const stage=fs.mkdtempSync(path.join(folder,'.download-'));
  try{
    update(2,'Preparando vídeo da internet…');
    const info=await metadata(link.url);
    await downloader(link.url,stage,{update});
    const media=await probeVideo(path.join(stage,'video.mp4'));
    if(!media.width||!media.duration)throw Error('O arquivo não contém um vídeo válido.');
    const item={title:info.title,origin:isYoutube?'youtube':'internet',sourceUrl:link.url,
      filename:'video.mp4',duration:media.duration,thumbnail:info.thumbnail,
      width:media.width,height:media.height,createdAt:new Date().toISOString()};
    if(fs.existsSync(path.join(folder,'meta.json')))return cachedSource(key);
    fs.renameSync(path.join(stage,'video.mp4'),path.join(folder,'video.mp4'));
    fs.writeFileSync(path.join(stage,'meta.json'),JSON.stringify(item,null,2));
    fs.renameSync(path.join(stage,'meta.json'),path.join(folder,'meta.json'));
    update(100,'Vídeo da internet disponível no cache.');
    return cachedSource(key);
  }finally{
    fs.rmSync(stage,{recursive:true,force:true});
    // Remove only an empty failed entry; another attempt may still be using it.
    try{fs.rmdirSync(folder);}catch(error){if(!['ENOTEMPTY','EEXIST','ENOENT'].includes(error.code))throw error;}
  }
}
export async function resolveSource(url,update){
  if(String(url).startsWith('contentlab-cache://'))return cachedSource(url.slice('contentlab-cache://'.length));
  return downloadInternetVideo(url,update);
}
export async function exportCut(source,{folder,filename,mode='video',full=true,start,end}={}){
  const dest=fs.realpathSync(folder);
  if(!fs.statSync(dest).isDirectory())throw Error('Pasta de exportação inválida.');
  const title=safeTitle(filename||source.title),ext=mode==='audio'?'.mp3':'.mp4';
  let output=path.join(dest,title+ext),index=1;
  while(fs.existsSync(output))output=path.join(dest,`${title}_${index++}${ext}`);
  let args=['-hide_banner','-loglevel','error','-n'];
  if(!full){
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<0)throw Error('Intervalo inválido.');
    args.push('-ss',String(start));
  }
  args.push('-i',source.path);
  if(!full)args.push('-t',String(end-start));
  if(mode==='audio')args.push('-vn','-c:a','libmp3lame','-q:a','2');
  else args.push('-map','0:v:0','-map','0:a?','-c','copy','-movflags','+faststart');
  args.push(output);
  await run('ffmpeg',args);
  if(!fs.existsSync(output)||!fs.statSync(output).size)throw Error('Nenhum arquivo exportado.');
  return output;
}
export function removeSource(key){const folder=entryFolder(key);if(!fs.existsSync(folder))throw Error('Cache não encontrado.');fs.rmSync(folder,{recursive:true});}
