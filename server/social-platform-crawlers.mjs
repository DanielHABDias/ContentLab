import {prepareInstagramScheduledReel,instagramCaption} from './instagram-scheduler.mjs';
/* Upload TikTok assistido e fluxo de agendamento específico do Instagram. */
import fs from 'node:fs';
import {validateStudioUrl,StudioLoginRequired,StudioChanged,DEEP_DOM,
  clickText,setText,waitFor,uploadFile} from './social-studio-browser.mjs';

export function socialCaption(item,platform){
  if(!['instagram','tiktok'].includes(platform))throw Error('Destino inválido.');
  if(platform==='instagram')return instagramCaption(item).text;
  const title=String(item.titleA||'').trim(),description=String(item.description||'').trim();
  const hashtags=(item.tags||[]).map(x=>'#'+String(x).replace(/^#/,'').replace(/[^\p{L}\p{N}_]/gu,'')).filter(x=>x.length>1);
  const caption=[title,description,hashtags.join(' ')].filter(Boolean).join('\n\n');
  if(!caption)throw Error('Informe o título ou a legenda do vídeo.');
  if(caption.length>2200)throw Error('A legenda tem '+caption.length+' caracteres; reduza para no máximo 2.200 no rascunho.');
  return caption;
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
export async function prepareTikTokUpload(session,item,{videoPath,coverAPath,progress=()=>{}}={}){
  const cdp=await session.navigate('tiktok');
  const warnings=[];
  progress('Abrindo o envio no TikTok Studio...');
  if(await cdp.eval(hasLogin('tiktok')))throw new StudioLoginRequired('TikTok');
  // A seleção começa no Studio oficial. Um upload já em andamento nunca é reiniciado automaticamente.
  let input=await waitFor(cdp,'(()=>{'+DEEP_DOM+
    "return nodes.some(n=>n.matches?.('input[type=\"file\"]')&&((n.accept||'').includes('video')||(n.accept||'').includes('.mp4')));})()",7000);
  if(!input){
    const clicked=await cdp.eval(clickText(['upload','carregar vídeo','enviar vídeo','fazer upload','upload video','upload videos'],
      ['button','a','[role="button"]'])).catch(()=>false);
    if(!clicked&&await cdp.eval(hasLogin('tiktok')))throw new StudioLoginRequired('TikTok');
    input=await waitFor(cdp,'(()=>{'+DEEP_DOM+
      "return nodes.some(n=>n.matches?.('input[type=\"file\"]')&&((n.accept||'').includes('video')||(n.accept||'').includes('.mp4')));})()",12000);
  }
  if(!input){
    if(await cdp.eval(hasLogin('tiktok')))throw new StudioLoginRequired('TikTok');
    throw new StudioChanged('TikTok Studio','a área de upload');
  }
  progress('Selecionando o arquivo do vídeo no TikTok...');
  if(!await uploadFile(cdp,videoPath))throw new StudioChanged('TikTok Studio','o seletor de arquivo');
  progress('Aguardando o editor de legenda...');
  const textFields=['[data-e2e="caption-text"] [contenteditable="true"]',
    '[data-testid="caption-input"] [contenteditable="true"]','[data-e2e="video-caption"] [contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]','div[contenteditable="true"]'];
  const caption=socialCaption(item,'tiktok');
  const filled=await waitFor(cdp,setText(textFields,caption),30000);
  if(!filled)throw new StudioChanged('TikTok Studio','o campo de legenda (arquivo já selecionado)');
  progress('Legenda preparada; verificando capa e agendamento...');
  if(coverAPath&&fs.existsSync(coverAPath)){
    // A capa nem sempre tem seletor de imagem; o TikTok pode oferecer apenas um frame.
    try{
      const done=await uploadFile(cdp,coverAPath,{image:true});
      if(!done)warnings.push(imageNotice('tiktok'));
    }catch{warnings.push(imageNotice('tiktok'));}
  }
  const schedule=validateScheduleWindow('tiktok',item.scheduledAt);
  if(schedule)warnings.push(schedule);
  else if(item.scheduledAt&&!await applySchedule(cdp,'tiktok',item.scheduledAt))
    warnings.push('Agendamento: não encontrei os controles atuais do TikTok; aplique a data e o horário preparados no Content Lab.');
  warnings.push('Confirme visibilidade, direitos autorais, rotulagem de IA, conteúdo comercial, capa e agendamento antes de clicar em Publicar/Agendar.');
  return {status:'awaiting_review',warnings,videoUrl:null};
}
// O fluxo nativo de Conteúdo programado foi isolado para testar cada etapa.
export async function prepareInstagramUpload(session,item,options={}){
  return prepareInstagramScheduledReel(session,item,options);
}
