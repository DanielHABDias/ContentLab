/* Pipeline por vídeo: YouTube -> TikTok -> Instagram; revisão humana por destino. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {readSocialBrowser,socialUrl} from './social-browser.mjs';
import {listSocialDrafts,socialDraftMedia} from './social-drafts.mjs';
import {openSocialStudioWindow,SOCIAL_ORDER,StudioLoginRequired,StudioChanged} from './social-studio-browser.mjs';
import {prepareTikTokUpload,prepareInstagramUpload,normalizeSocialPostUrl} from './social-platform-crawlers.mjs';
import {prepareYouTubeUpload,normalizeYouTubeVideoUrl,YouTubeLoginRequired,YouTubeStudioChanged,
  discardCurrentYouTubeDraft} from './youtube-studio-crawler.mjs';

export const SOCIAL_PIPELINE_RESULTS=path.join(os.homedir(),'.contentlab','social-pipeline-results.json');
const jobs=new Map();
const terminal=new Set(['done','cancelled','needs_configuration']);
const active=()=>[...jobs.values()].some(j=>!terminal.has(j.status));
export function readSocialPipelineResults(file=SOCIAL_PIPELINE_RESULTS){
  try{
    if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>500000)return {};
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    return data&&typeof data==='object'&&!Array.isArray(data)?data:{};
  }catch{return {};}
}
function persistResult(file,draftId,platform,record){
  const folder=path.dirname(file);fs.mkdirSync(folder,{recursive:true,mode:0o700});
  if(fs.lstatSync(folder).isSymbolicLink()||(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink()))
    throw Error('Arquivo de resultados inseguro.');
  const previous=readSocialPipelineResults(file);
  const value={...previous,[draftId]:{...previous[draftId],[platform]:record}};
  const temp=file+'.next-'+crypto.randomUUID();
  try{
    fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
    fs.renameSync(temp,file);
  }finally{fs.rmSync(temp,{force:true});}
}
const currentTask=job=>job.tasks[job.index]||null;
const snapshot=job=>{
  const task=currentTask(job);
  return {id:job.id,status:job.status,index:job.index,total:job.tasks.length,
    message:job.message,platform:task?.platform||null,
    current:task?{id:task.video.id,title:task.video.titleA,kind:task.video.kind,
      scheduledAt:task.video.scheduledAt,platform:task.platform}:null,
    tabs:job.session?.tabs?.map(({platform,index,targetId,url})=>({platform,index,targetId,url}))||[],
    warnings:job.warnings,completed:job.completed,videoUrl:job.videoUrl||null};
};
function platformUrl(platform,value){
  return platform==='youtube'?normalizeYouTubeVideoUrl(value):normalizeSocialPostUrl(platform,value);
}
export function buildSocialTasks(draftIds,{config,drafts,results={}}){
  if(!Array.isArray(draftIds)||!draftIds.length||draftIds.length>100||
    draftIds.some(id=>typeof id!=='string')||new Set(draftIds).size!==draftIds.length)
    throw Error('Selecione pelo menos um vídeo.');
  if(!config?.browser)throw Error('Configure o navegador em Redes sociais.');
  const selected=draftIds.map(id=>drafts.find(v=>v.id===id));
  if(selected.some(v=>!v))throw Error('Um dos vídeos selecionados não está mais na lista.');
  if(selected.some(v=>!Array.isArray(v.platforms)||!v.platforms.length||
    v.platforms.some(p=>!SOCIAL_ORDER.includes(p)||config.confirmed?.[p]!==true||
      (p==='tiktok'&&v.kind==='long'))))
    throw Error('Há redes não confirmadas ou incompatíveis. Revise os destinos em Editar.');
  // A lista normal exibe os mais recentes primeiro. A fila respeita a
  // programação escolhida (incluindo importação em lote). Para empates,
  // conserva a ordem de criação mais antiga primeiro.
  const ordered=drafts.slice().reverse().filter(v=>draftIds.includes(v.id))
    .sort((a,b)=>{
      const first=Date.parse(a.scheduledAt||''),second=Date.parse(b.scheduledAt||'');
      return Number.isFinite(first)&&Number.isFinite(second)?first-second:0;
    });
  const tasks=[];
  for(const video of ordered)for(const platform of SOCIAL_ORDER){
    if(!video.platforms.includes(platform))continue;
    if(['published','scheduled'].includes(results?.[video.id]?.[platform]?.status))continue;
    tasks.push({video,platform});
  }
  return tasks;
}
async function step(job){
  if(job.stopped)return;
  const task=currentTask(job);
  if(!task){job.status='done';job.message='Todos os destinos foram revisados e confirmados.';job.session?.close?.();return;}
  job.status='running';job.warnings=[];job.videoUrl=null;
  const {video,platform}=task;
  job.message='Preparando '+platform+' para '+video.titleA+'...';
  try{
    if(!job.session){
      const networks=SOCIAL_ORDER.filter(p=>job.tasks.some(t=>t.platform===p));
      job.session=await job.adapters.open({config:job.config,platforms:networks});
    }
    if(job.stopped)return;
    const input={
      videoPath:socialDraftMedia(video.id,'video',job.root),
      coverAPath:socialDraftMedia(video.id,'coverA',job.root),
      coverBPath:video.kind==='long'?socialDraftMedia(video.id,'coverB',job.root):null,
      progress:message=>{if(!job.stopped)job.message=message;}
    };
    let result;
    if(platform==='youtube'){
      const cdp=await job.session.navigate('youtube');
      result=await job.adapters.youtube({cdp},video,input);
    }else result=await job.adapters[platform](job.session,video,input);
    if(job.stopped)return;
    job.warnings=result?.warnings||[];
    job.videoUrl=platformUrl(platform,result?.videoUrl);
    if(['youtube','instagram','tiktok'].includes(platform)&&result?.status==='scheduled'&&
      result?.verified===true&&result?.verification===platform+'_ui'&&
      typeof result.confirmationText==='string'&&result.confirmationText.trim()){
      // TikTok/Instagram: somente após confirmação textual observada no site.
      const record={status:'scheduled',url:null,scheduledAt:video.scheduledAt,
        confirmedAt:new Date().toISOString(),verification:platform+'_ui',
        confirmationText:String(result.confirmationText||'').slice(0,480)};
      persistResult(job.resultsFile,video.id,platform,record);
      job.completed.push({id:video.id,title:video.titleA,platform,...record});
      job.index++;
      job.status='queued';
      job.message=platform+' confirmou o agendamento de '+video.titleA+'. Avançando na fila...';
      void step(job);
      return;
    }
    job.status='awaiting_review';
    job.message=(platform==='instagram'||platform==='tiktok')&&result?.status==='awaiting_review'?
      'O '+platform+' recebeu o comando de agendamento, mas não retornou confirmação confiável. Confira a programação no site antes de confirmar, sem reenviar o vídeo.':
      'Confira o upload e conclua a publicação ou programação de '+video.titleA+
      ' no '+platform+'. Depois confirme para prosseguir.';
  }catch(error){
    if(job.stopped)return;
    const failureWarnings=[error.message||'Erro de interface'];
    if(platform==='youtube'&&job.session){
      const cdp=await job.session.navigate('youtube').catch(()=>null);
      if(cdp){
        const discarded=await discardCurrentYouTubeDraft(cdp).catch(()=>false);
        if(!discarded)failureWarnings.push('O rascunho falho do YouTube não pôde ser descartado automaticamente; revise o Studio antes de repetir.');
      }
    }
    job.warnings=failureWarnings;
    if(error instanceof StudioLoginRequired||error instanceof YouTubeLoginRequired){
      // Login é uma etapa de Configurações. A fila não oferece login nem
      // prossegue após expiração de cookies: exige revalidação do perfil.
      job.status='needs_configuration';
      job.message='Sessão de '+platform+' expirada ou sem login. Volte em Configurações, abra a rede no perfil do crawler e confirme novamente. Nenhum envio foi confirmado.';
    }else if(error instanceof StudioChanged||error instanceof YouTubeStudioChanged){
      job.status='needs_manual';
      job.message='O site mudou durante a preparação. Conclua o vídeo manualmente, sem repetir o upload.';
    }else{
      job.status='needs_manual';
      job.message='A automação não conseguiu continuar. Confira a janela antes de iniciar outro envio.';
    }
  }
}
export function startSocialPipeline(draftIds,{
  config=readSocialBrowser(),drafts=listSocialDrafts(),root,
  resultsFile=SOCIAL_PIPELINE_RESULTS,
  adapters={open:openSocialStudioWindow,youtube:prepareYouTubeUpload,
    tiktok:prepareTikTokUpload,instagram:prepareInstagramUpload}
}={}){
  if(active())throw Error('Já existe uma fila de redes em andamento. Finalize ou cancele primeiro.');
  const tasks=buildSocialTasks(draftIds,{config,drafts,results:readSocialPipelineResults(resultsFile)});
  if(!tasks.length)throw Error('Todas as redes dos vídeos selecionados já foram confirmadas nesta fila. Revise os links na lista.');
  const job={id:crypto.randomUUID(),status:'queued',message:'Abrindo navegador...',
    tasks,index:0,session:null,config,root,adapters,resultsFile,stopped:false,
    warnings:[],completed:[],videoUrl:null};
  jobs.set(job.id,job);
  void step(job);
  return snapshot(job);
}
export function getSocialPipeline(id){
  const job=jobs.get(id);if(!job)throw Error('Fila não encontrada (talvez o Content Lab tenha reiniciado).');
  return snapshot(job);
}
export async function resumeSocialPipeline(id){
  const job=jobs.get(id);if(!job)throw Error('Fila não encontrada.');
  if(job.status!=='awaiting_login')throw Error('Login só pode ser revalidado em Configurações. Cancele a fila e confirme a rede lá.');
  void step(job);
  return snapshot(job);
}
export function confirmSocialPipeline(id,{videoUrl,scheduled=false}={}){
  const job=jobs.get(id);if(!job)throw Error('Fila não encontrada.');
  if(!['awaiting_review','needs_manual'].includes(job.status))
    throw Error('Conclua o envio no site antes de confirmar.');
  const task=currentTask(job),status=scheduled?'scheduled':'published';
  const url=videoUrl?.trim()?platformUrl(task.platform,videoUrl.trim()):null;
  if(!scheduled&&!url)throw Error('Cole o link válido da postagem publicada em '+task.platform+'.');
  if(scheduled&&videoUrl?.trim()&&!url)throw Error('O link informado não pertence à plataforma atual.');
  const record={status,url:url||null,scheduledAt:scheduled?task.video.scheduledAt:null,
    confirmedAt:new Date().toISOString(),verification:'manual'};
  persistResult(job.resultsFile,task.video.id,task.platform,record);
  job.completed.push({id:task.video.id,title:task.video.titleA,platform:task.platform,...record});
  job.index++;
  job.status='queued';job.message='Passando ao próximo destino da fila...';
  void step(job);
  return snapshot(job);
}
export function cancelSocialPipeline(id){
  const job=jobs.get(id);if(!job)throw Error('Fila não encontrada.');
  job.stopped=true;job.status='cancelled';job.message='Fila interrompida. Verifique uploads já iniciados antes de recomeçar.';
  job.session?.close?.();return snapshot(job);
}
