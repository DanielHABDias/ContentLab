import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {safeTitle,importLocalSource,downloadYoutube} from './source.mjs';
import {searchPinterest} from './pinterest-search.mjs';

const entries=new Map();
const TTL=20*60*1000;
const MAX_BYTES=240*1024*1024;
const IMAGE_EXT=new Set(['.jpg','.jpeg','.png','.webp','.gif']);
const VIDEO_EXT=new Set(['.mp4','.webm','.mov','.mkv']);
const SOURCES=['youtube','pinterest','commons','archive'];
const allowedLicense=value=>{
  const s=String(value||'').toLowerCase().trim();
  if(/^https?:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa)\/|publicdomain\/(?:zero|mark)\/)/.test(s))return true;
  if(/^https?:\/\/creativecommons\.org\/publicdomain\b/.test(s))return true;
  return /(?:^|[\/\s])(?:cc0|publicdomain|public.domain|pd-old|pd-us)(?:[\/\s-]|$)/i.test(s)||
    /^cc by(?:-sa)?(?: |$)/i.test(s)||
    /^public domain\b/i.test(s);
};
const licenceText=(shortName,url)=>[shortName,url].filter(Boolean).join(' · ');
const attribute=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
export function normalizeCommons(pages,kind='all'){
  return Object.values(pages||{}).flatMap(page=>{
    const info=page?.imageinfo?.[0];
    if(!info?.url)return [];
    const pathname=new URL(info.url).pathname;
    const ext=path.extname(pathname).toLowerCase();
    const type=IMAGE_EXT.has(ext)?'image':VIDEO_EXT.has(ext)?'video':null;
    if(!type||(kind!=='all'&&type!==kind))return [];
    const meta=info.extmetadata||{};
    const license=attribute(meta.LicenseShortName?.value);
    const licenseUrl=attribute(meta.LicenseUrl?.value);
    if(!allowedLicense(license)&&!allowedLicense(licenseUrl))return [];
    return [{
      provider:'commons',kind:type,title:attribute(page.title?.replace(/^File:/i,'')||'Arquivo'),
      pageUrl:info.descriptionurl||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(page.title),
      assetUrl:info.url,preview:info.thumburl||(type==='image'?info.url:null),
      credit:attribute(meta.Artist?.value||meta.Credit?.value||'Veja os créditos na página do arquivo'),
      license:licenceText(license,licenseUrl)||'Licença aberta indicada no Commons',
      licenseUrl:licenseUrl||null,size:info.size||null
    }];
  });
}
export function normalizeArchive(docs){
  return (docs||[]).flatMap(doc=>{
    const id=String(doc.identifier||'');
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,120}$/.test(id))return [];
    const rawLicense=Array.isArray(doc.licenseurl)?doc.licenseurl[0]:doc.licenseurl;
    if(!allowedLicense(rawLicense))return [];
    return [{
      provider:'archive',kind:'video',title:attribute(doc.title||id),
      pageUrl:'https://archive.org/details/'+encodeURIComponent(id),
      preview:'https://archive.org/services/img/'+encodeURIComponent(id),
      credit:attribute(doc.creator||'Consulte os créditos no Internet Archive'),
      license:'Licença declarada no Internet Archive: '+String(rawLicense),
      licenseUrl:String(rawLicense),archiveId:id
    }];
  });
}
export function normalizeYouTube(videos,{creativeCommons=false}={}){
  return Array.from(videos||[]).slice(0,15).flatMap(video=>{
    const id=String(video.id||'');
    if(!/^[A-Za-z0-9_-]{11}$/.test(id))return [];
    const title=video.title?.text||video.title?.toString?.()||video.title||'Vídeo YouTube';
    const thumbnails=video.thumbnails||video.thumbnail||[];
    const thumb=Array.isArray(thumbnails)?thumbnails.at(-1)?.url:thumbnails?.[0]?.url;
    return [{
      provider:'youtube',kind:'video',title:attribute(title),
      pageUrl:'https://www.youtube.com/watch?v='+id,
      preview:thumb||'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',
      credit:attribute(video.author?.name||video.author?.toString?.()||'Canal YouTube'),
      license:creativeCommons?'Filtro Creative Commons — confirme a licença na página original.':
        'Licença não verificada. Conteúdo padrão do YouTube; obtenha autorização do titular para reutilizar.',
      licenseUrl:null,assetUrl:'https://www.youtube.com/watch?v='+id
    }];
  });
}
const checkedQuery=q=>{
  if(typeof q!=='string'||q.trim().length<2||q.trim().length>100)throw Error('Pesquise entre 2 e 100 caracteres.');
  return q.trim();
};
async function json(url,fetcher){
  const r=await fetcher(url,{headers:{'User-Agent':'ContentLab/1.0 (media discovery; local client)',Accept:'application/json'},
    signal:AbortSignal.timeout(16000),redirect:'error'});
  if(!r.ok)throw Error('Fonte indisponível (HTTP '+r.status+').');
  return r.json();
}
export async function searchCommons(q,kind,{fetcher=fetch}={}){
  const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:q,
    gsrnamespace:'6',gsrlimit:'24',prop:'imageinfo',
    iiprop:'url|size|extmetadata',iiurlwidth:'480',format:'json',formatversion:'2'});
  const data=await json('https://commons.wikimedia.org/w/api.php?'+params,fetcher);
  return normalizeCommons(data.query?.pages,kind).slice(0,18);
}
export async function searchArchive(q,kind,{fetcher=fetch}={}){
  if(kind==='image')return [];
  const safeWords=q.replace(/["():*{}[\]]/g,' ').split(/\s+/).filter(Boolean).slice(0,6);
  const query='mediatype:movies AND ('+safeWords.join(' AND ')+') AND licenseurl:*';
  const p=new URLSearchParams({q:query,rows:'24',page:'1',output:'json'});
  for(const field of ['identifier','title','creator','licenseurl','mediatype'])p.append('fl[]',field);
  const data=await json('https://archive.org/advancedsearch.php?'+p,fetcher);
  return normalizeArchive(data.response?.docs).slice(0,16);
}
let youtube;
export async function searchYouTube(q,kind,{youtubeSearch,creativeCommons=false}={}){
  if(kind==='image')return [];
  if(!youtubeSearch){
    if(!youtube){const m=await import('youtubei.js');youtube=await m.Innertube.create({generate_session_locally:true});}
    youtubeSearch=(term)=>youtube.search(term,creativeCommons?
      {type:'video',features:['creative_commons']}:{type:'video'});
  }
  const results=await youtubeSearch(q);
  return normalizeYouTube(results.videos,{creativeCommons}).slice(0,15);
}
function putResults(items){
  const now=Date.now();
  for(const [key,item] of entries)if(item.created<now-TTL)entries.delete(key);
  if(entries.size>400)entries.clear();
  return items.map(item=>{
    const key=crypto.randomBytes(18).toString('base64url');
    entries.set(key,{...item,created:now});
    const {assetUrl,archiveId,...safe}=item;
    return {...safe,key};
  });
}
export async function searchMedia(query,{source='popular',kind='all',fetcher=fetch,youtubeSearch}={}){
  const q=checkedQuery(query);
  if(!['all','popular','youtube-cc',...SOURCES].includes(source))throw Error('Fonte inválida.');
  if(!['all','image','video'].includes(kind))throw Error('Tipo de mídia inválido.');
  const requested=source==='all'?SOURCES:source==='popular'?['youtube','pinterest']:
    source==='youtube-cc'?['youtube']:[source];
  const resolvers={commons:()=>searchCommons(q,kind,{fetcher}),
    archive:()=>searchArchive(q,kind,{fetcher}),
    youtube:()=>searchYouTube(q,kind,{youtubeSearch,creativeCommons:source==='youtube-cc'}),
    pinterest:()=>searchPinterest(q,kind,{fetcher})};
  const settled=await Promise.all(requested.map(async p=>{
    try{return {provider:p,items:await resolvers[p]()};}
    catch(error){return {provider:p,items:[],error:String(error?.message||'Indisponível').slice(0,150)};}
  }));
  const warnings=settled.filter(r=>r.error).map(r=>r.provider+': '+r.error);
  return {query:q,items:putResults(settled.flatMap(r=>r.items)),warnings,
    sources:requested,notice:'Resultados públicos não significam permissão de reutilização. Verifique licença e créditos com os autores.'};
}
export function selectedMedia(key){
  const entry=entries.get(key);
  if(!entry||entry.created<Date.now()-TTL)throw Error('Resultado expirado. Pesquise novamente.');
  return entry;
}
export function safeDownloadHost(u){
  if(u.protocol!=='https:'||u.username||u.password)return false;
  const name=u.hostname.toLowerCase();
  return name==='upload.wikimedia.org'||name==='archive.org'||
    /^(?:[a-z0-9-]+\.)?pinimg\.com$/.test(name)||
    /^[a-z0-9.-]+\.archive\.org$/.test(name);
}
async function mediaResponse(url,{fetcher=fetch}={}){
  let next=new URL(url);
  for(let i=0;i<5;i++){
    if(!safeDownloadHost(next))throw Error('Destino de arquivo não autorizado.');
    const r=await fetcher(next.toString(),{redirect:'manual',signal:AbortSignal.timeout(120000),
      headers:{'User-Agent':'ContentLab/1.0 (local media download)'}});
    if([301,302,303,307,308].includes(r.status)){
      const location=r.headers?.get('location');
      if(!location)throw Error('Redirecionamento inválido.');
      next=new URL(location,next);
      continue;
    }
    if(!r.ok||!r.body)throw Error('Download indisponível (HTTP '+r.status+').');
    const bytes=Number(r.headers?.get('content-length')||0);
    if(bytes>MAX_BYTES)throw Error('Arquivo muito grande (limite: 240 MB).');
    const mime=r.headers?.get('content-type')||'';
    if(/text\/html|application\/json|text\/plain/i.test(mime))
      throw Error('O serviço retornou uma página, não um arquivo de mídia.');
    return r;
  }
  throw Error('Número excessivo de redirecionamentos.');
}
async function archiveFile(entry,{fetcher=fetch}={}){
  const id=entry.archiveId;
  const data=await json('https://archive.org/metadata/'+encodeURIComponent(id),fetcher);
  const current=String(data.metadata?.licenseurl||'');
  if(!allowedLicense(current))throw Error('Licença do filme não está confirmada pelo acervo.');
  const candidates=(data.files||[]).filter(f=>{
    const ext=path.extname(f.name||'').toLowerCase();
    return VIDEO_EXT.has(ext)&&Number(f.size||0)>0&&Number(f.size)<MAX_BYTES&&
      f.source==='original'&&!f.private;
  }).sort((a,b)=>Number(a.size)-Number(b.size));
  if(!candidates.length)throw Error('Não há MP4/WebM original com menos de 240 MB neste item.');
  return {url:'https://archive.org/download/'+encodeURIComponent(id)+'/'+candidates[0].name.split('/').map(encodeURIComponent).join('/'),
    ext:path.extname(candidates[0].name).toLowerCase()};
}
const licenseReceipt=item=>[
  'Arquivo: '+item.title,'Fonte: '+item.provider,
  'Página de origem: '+item.pageUrl,'Créditos: '+item.credit,
  'Licença declarada: '+item.license,'Verifique a licença e atribuição antes de publicar.'
].join('\n')+'\n';
export async function importMedia(key,{fetcher=fetch,update=()=>{},downloader=downloadYoutube,
  localImporter=importLocalSource,destination=path.join(os.homedir(),'Downloads','ContentLab')}={}){
  const item=selectedMedia(key);
  if(item.provider==='youtube'){
    update(10,'Preparando vídeo do YouTube…');
    const video=await downloader(item.assetUrl,(progress,message)=>update(progress,message));
    return {kind:'video',cachedKey:video.key,title:video.title,
      filePath:video.path,source:item.pageUrl,credit:item.credit,license:item.license};
  }
  let url=item.assetUrl,ext=path.extname(new URL(item.assetUrl||'https://archive.org/fake.mp4').pathname).toLowerCase();
  if(item.provider==='archive'){
    update(8,'Consultando o arquivo e verificando a licença…');
    const archive=await archiveFile(item,{fetcher});url=archive.url;ext=archive.ext;
  }
  if(![...IMAGE_EXT,...VIDEO_EXT].includes(ext))throw Error('Formato de mídia não suportado.');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-media-'));
  const temp=path.join(folder,'asset'+ext);
  try{
    update(14,'Transferindo arquivo de mídia…');
    const response=await mediaResponse(url,{fetcher});
    let size=0;
    const guard=new Transform({transform(chunk,enc,done){
      size+=chunk.length;
      if(size>MAX_BYTES)return done(Error('Download excedeu 240 MB.'));
      update(Math.min(85,Math.round(size/MAX_BYTES*80)+14),'Baixando mídia…');
      done(null,chunk);
    }});
    await pipeline(Readable.fromWeb(response.body),guard,fs.createWriteStream(temp,{flags:'wx'}));
    if(size===0)throw Error('Arquivo recebido está vazio.');
    if(item.kind==='video'){
      update(88,'Adicionando vídeo ao cache de cortes…');
      const video=await localImporter(temp);
      fs.writeFileSync(path.join(video.folder,'source-license.txt'),licenseReceipt(item));
      update(100,'Vídeo disponível na aba Vídeos e cortes.');
      return {kind:'video',cachedKey:video.key,title:item.title,
        filePath:video.path,source:item.pageUrl,credit:item.credit,license:item.license};
    }
    const imageFolder=path.join(destination,'Imagens');
    fs.mkdirSync(imageFolder,{recursive:true});
    const name=safeTitle(item.title).slice(0,64)+'-'+crypto.randomBytes(4).toString('hex');
    const output=path.join(imageFolder,name+ext);
    fs.copyFileSync(temp,output,fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(path.join(imageFolder,name+'.license.txt'),licenseReceipt(item));
    update(100,'Imagem salva com informações de licença.');
    return {kind:'image',title:item.title,filePath:output,
      source:item.pageUrl,credit:item.credit,license:item.license};
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
}
