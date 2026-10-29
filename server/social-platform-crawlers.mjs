import {prepareTikTokScheduledVideo} from './tiktok-scheduler.mjs';
import {prepareInstagramScheduledReel,instagramCaption} from './instagram-scheduler.mjs';
/* Upload TikTok assistido e fluxo de agendamento específico do Instagram. */
import fs from 'node:fs';
import {validateStudioUrl,StudioLoginRequired,StudioChanged,DEEP_DOM,
  clickText,setText,waitFor,uploadFile} from './social-studio-browser.mjs';

export function socialCaption(item,platform){
  if(!['instagram','tiktok'].includes(platform))throw Error('Destino inválido.');
  return instagramCaption(item).text;
}
export function normalizeSocialPostUrl(platform,value){
  if(typeof value!=='string'||value.length>1200)return null;
  let url;try{url=new URL(value);}catch{return null;}
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase();
  if(platform==='tiktok'){
    if(!['tiktok.com','www.tiktok.com'].includes(host)||!/^\/@[\w.-]+\/video\/\d{8,30}\/?$/.test(url.pathname))return null;
  }else if(platform==='instagram'){
    if(!['instagram.com','www.instagram.com'].includes(host)||!/^\/(p|reel|tv)\/[A-Za-z0-9_-]{5,32}\/?$/.test(url.pathname))return null;
  }else return null;
  return 'https://www.'+platform+'.com'+url.pathname.replace(/\/$/,'')+'/';
}
export function validateScheduleWindow(platform,scheduledAt,now=new Date()){
  if(!scheduledAt)return null;
  const date=new Date(scheduledAt);
  if(!Number.isFinite(date.getTime()))return 'Data de agendamento inválida. Ajuste no Studio.';
  if(platform==='tiktok'){
    const gap=date.getTime()-now.getTime();
    if(gap<15*60*1000||gap>10*86400000)
      return 'TikTok costuma permitir agendamento na web apenas entre 15 minutos e 10 dias; ajuste o horário manualmente no Studio.';
  }
  return null;
}
export function scheduleParts(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value||''));
  return match?{date:match[1]+'-'+match[2]+'-'+match[3],time:match[4]+':'+match[5]}:null;
}
async function applySchedule(cdp,platform,scheduledAt){
  const parts=scheduleParts(scheduledAt);if(!parts)return false;
  if(platform==='instagram')await cdp.eval(clickText(['configurações avançadas','advanced settings'],
    ['button','[role="button"]','div[role="button"]'])).catch(()=>false);
  const toggled=await cdp.eval(clickText(['programar esta publicação','programar','schedule this post','schedule'],
    ['button','label','[role="button"]','div[role="button"]'])).catch(()=>false);
  if(!toggled)return false;
  const date=await waitFor(cdp,setText(['input[type="date"]','input[name*="date"]','input[aria-label*="data"]','input[aria-label*="date"]'],parts.date),5000);
  const time=await waitFor(cdp,setText(['input[type="time"]','input[name*="time"]','input[aria-label*="hora"]','input[aria-label*="time"]'],parts.time),5000);
  return Boolean(date&&time);
}
const enableOption=labels=>'(()=>{'+DEEP_DOM+'const labels='+JSON.stringify(labels.map(x=>x.toLowerCase()))+
  ";const text=n=>(n.innerText||n.getAttribute?.('aria-label')||'').trim().toLowerCase();"+
  "const label=nodes.find(n=>n.getClientRects().length&&labels.some(v=>text(n).includes(v)));if(!label)return false;"+
  "const control=label.matches?.('input,[role=\"switch\"]')?label:label.querySelector?.('input,[role=\"switch\"]')||label.closest?.('label')?.querySelector?.('input,[role=\"switch\"]');"+
  "if(control&&(control.checked||control.getAttribute('aria-checked')==='true'))return true;(control||label).click();return true;})()";
const hasLogin=platform=>'(()=>{const url=location.href.toLowerCase();'+
  'return url.includes("/login")||url.includes("/accounts/login")||url.includes("/signup");})()';
const imageNotice=platform=>platform==='tiktok'?
  'Capa: confirme manualmente o frame/capa escolhido no TikTok Studio.':
  'Capa: confirme a miniatura/capa no Instagram antes de compartilhar.';
export async function prepareTikTokUpload(session,item,options={}){
  return prepareTikTokScheduledVideo(session,item,options);
}
// O fluxo nativo de Conteúdo programado foi isolado para testar cada etapa.
export async function prepareInstagramUpload(session,item,options={}){
  return prepareInstagramScheduledReel(session,item,options);
}
