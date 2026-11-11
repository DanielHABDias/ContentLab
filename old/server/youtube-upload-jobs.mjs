/* Fila YouTube: um vídeo por vez, com revisão humana antes de publicar.
 * O crawler nunca afirma sucesso baseado apenas no upload. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {readSocialBrowser,socialUrl} from './social-browser.mjs';
import {listSocialDrafts,socialDraftMedia} from './social-drafts.mjs';
import {openYouTubeStudio,prepareYouTubeUpload,YouTubeLoginRequired,
  YouTubeStudioChanged,normalizeYouTubeVideoUrl} from './youtube-studio-crawler.mjs';

export const YOUTUBE_RESULTS_FILE=path.join(os.homedir(),'.contentlab','youtube-publication-results.json');
const jobs=new Map();
const busy=()=>[...jobs.values()].some(j=>!['done','cancelled','error'].includes(j.status));
const publicJob=job=>({
  id:job.id,status:job.status,createdAt:job.createdAt,
  index:job.index,total:job.queue.length,message:job.message,
  current:job.queue[job.index]?{id:job.queue[job.index].id,title:job.queue[job.index].titleA,
    scheduledAt:job.queue[job.index].scheduledAt,kind:job.queue[job.index].kind}:null,
  completed:job.completed,warnings:job.warnings,videoUrl:job.videoUrl||null,
  requiresHumanReview:true
});
export function readYouTubeResults(file=YOUTUBE_RESULTS_FILE){
  try{
    if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>150000)return {};
    const rows=JSON.parse(fs.readFileSync(file,'utf8'));
    return rows&&typeof rows==='object'&&!Array.isArray(rows)?rows:{};
  }catch{return {};}
}
function saveResult(id,url,file=YOUTUBE_RESULTS_FILE){
  const folder=path.dirname(file);fs.mkdirSync(folder,{recursive:true,mode:0o700});
  if(fs.lstatSync(folder).isSymbolicLink()||
     fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())
    throw Error('Arquivo de resultados inseguro.');
  const prior=readYouTubeResults(file),temp=file+'.next-'+crypto.randomUUID();
  try{
    fs.writeFileSync(temp,JSON.stringify({...prior,[id]:{url,confirmedAt:new Date().toISOString()}},null,2)+'\n',
      {flag:'wx',mode:0o600});
    fs.renameSync(temp,file);
  }finally{fs.rmSync(temp,{force:true});}
}
function set(job,status,message){job.status=status;job.message=message;}
async function advance(job){
  if(job.stopped)return;
  if(job.index>=job.queue.length){
    set(job,'done','Todos os vídeos selecionados para YouTube foram concluídos e confirmados por você.');
    job.browser?.close?.();return;
  }
  const video=job.queue[job.index];
  set(job,'running','Preparando '+video.titleA+' no navegador...');
  job.warnings=[];job.videoUrl=null;
  try{
    if(!job.browser){
      const url=socialUrl('youtube',job.config.urls.youtube);
      job.browser=await job.adapters.open({browser:job.config.browser,url});
    }
    if(job.stopped)return;
    const result=await job.adapters.upload(job.browser,video,{
      videoPath:socialDraftMedia(video.id,'video',job.root),
      coverAPath:socialDraftMedia(video.id,'coverA',job.root),
      coverBPath:video.kind==='long'?socialDraftMedia(video.id,'coverB',job.root):null,
      progress:message=>{job.message=message;}
    });
    job.warnings=result.warnings||[];job.videoUrl=normalizeYouTubeVideoUrl(result.videoUrl);
    set(job,'awaiting_review','Arquivo enviado e metadados preparados. Confira as declarações, A/B, tela final e horário no Studio; conclua por lá e informe o link para passar ao próximo vídeo.');
  }catch(error){
    if(error instanceof YouTubeLoginRequired){
      set(job,'awaiting_login',error.message);
    }else if(error instanceof YouTubeStudioChanged){
      job.warnings=[error.message];
      set(job,'needs_manual','A interface do YouTube mudou. Termine este vídeo manualmente no navegador, sem reiniciar outro upload.');
    }else{
      job.warnings=[error.message];
      set(job,'needs_manual','Falha de automação: confira a janela antes de tentar qualquer novo upload. Você pode concluir este vídeo manualmente.');
    }
  }
}
export function startYouTubeQueue(draftIds,{
  config=readSocialBrowser(),drafts=listSocialDrafts(),root,
  adapters={open:openYouTubeStudio,upload:prepareYouTubeUpload}
}={}){
  if(busy())throw Error('Já existe uma fila YouTube em andamento. Termine ou cancele a anterior.');
  if(!config?.browser||config.confirmed?.youtube!==true)throw Error('Confirme o YouTube em Configurações antes de publicar.');
  if(!Array.isArray(draftIds)||!draftIds.length||draftIds.length>100||
     new Set(draftIds).size!==draftIds.length||draftIds.some(id=>typeof id!=='string'))
    throw Error('Selecione os vídeos da lista.');
  const picked=draftIds.map(id=>drafts.find(v=>v.id===id));
  if(picked.some(v=>!v))throw Error('Um dos vídeos não foi encontrado.');
  // A lista local é armazenada do mais recente para o mais antigo.
  // Invertê-la evita empates de timestamp e garante a ordem real da fila.
  const queue=drafts.slice().reverse()
    .filter(v=>draftIds.includes(v.id)&&v.platforms?.includes('youtube'));
  if(!queue.length)throw Error('Nenhum vídeo selecionado tem YouTube como destino.');
  const job={id:crypto.randomUUID(),status:'queued',createdAt:new Date().toISOString(),
    message:'Aguardando navegador...',queue,index:0,config,root,adapters,browser:null,
    warnings:[],completed:[],videoUrl:null,stopped:false};
  jobs.set(job.id,job);
  void advance(job);
  return publicJob(job);
}
export function getYouTubeJob(id){
  const job=jobs.get(id);if(!job)throw Error('Fila YouTube não encontrada.');
  return publicJob(job);
}
export async function resumeYouTubeJob(id){
  const job=jobs.get(id);
  if(!job)throw Error('Fila YouTube não encontrada.');
  if(job.status!=='awaiting_login')throw Error('Continuar só está disponível após concluir o login no navegador.');
  await advance(job);return publicJob(job);
}
export function confirmYouTubePublished(id,{videoUrl,resultsFile=YOUTUBE_RESULTS_FILE}={}){
  const job=jobs.get(id);
  if(!job)throw Error('Fila YouTube não encontrada.');
  if(!['awaiting_review','needs_manual'].includes(job.status))
    throw Error('Revise e finalize o vídeo no YouTube Studio antes de confirmar.');
  const url=normalizeYouTubeVideoUrl(videoUrl);
  if(!url)throw Error('Cole um link real do YouTube (https://www.youtube.com/watch?v=...).');
  const current=job.queue[job.index];
  saveResult(current.id,url,resultsFile);
  job.completed.push({id:current.id,title:current.titleA,url});
  job.index++;
  void advance(job);
  return publicJob(job);
}
export function cancelYouTubeJob(id){
  const job=jobs.get(id);if(!job)throw Error('Fila YouTube não encontrada.');
  job.stopped=true;set(job,'cancelled','Fila interrompida. O navegador foi mantido aberto para você revisar os vídeos.');
  job.browser?.close?.();
  return publicJob(job);
}
