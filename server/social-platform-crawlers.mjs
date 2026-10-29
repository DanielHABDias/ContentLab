/* Upload assistido em TikTok Studio e Instagram Web. Sem click em publicar. */
import fs from 'node:fs';
import {validateStudioUrl,StudioLoginRequired,StudioChanged,DEEP_DOM,
  clickText,setText,waitFor,uploadFile} from './social-studio-browser.mjs';

export function socialCaption(item,platform){
  if(!['instagram','tiktok'].includes(platform))throw Error('Destino inválido.');
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
  }else if(platform==='instagram')
    return 'O agendamento pelo Instagram no desktop pode exigir uma conta profissional vinculada ao Meta Business Suite. Verifique manualmente.';
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
export async function prepareInstagramUpload(session,item,{videoPath,coverAPath,progress=()=>{}}={}){
  const cdp=await session.navigate('instagram');
  progress('Abrindo o criador do Instagram...');
  if(await cdp.eval(hasLogin('instagram')))throw new StudioLoginRequired('Instagram');
  const opened=await waitFor(cdp,clickText(['criar','create','nova publicação','new post'],
    ['button','a','[role="button"]','div[role="button"]','span[role="button"]']),12000);
  if(!opened){
    if(await cdp.eval(hasLogin('instagram')))throw new StudioLoginRequired('Instagram');
    throw new StudioChanged('Instagram','o botão Criar');
  }
  await cdp.eval(clickText(['publicação','post','reel','reels'],['button','div[role="button"]','[role="menuitem"]'])).catch(()=>false);
  const fileSelector='(()=>{'+DEEP_DOM+"return nodes.some(n=>n.matches?.('input[type=\"file\"]'));})()";
  if(!await waitFor(cdp,fileSelector,12000))throw new StudioChanged('Instagram','o seletor de mídia');
  progress('Carregando o vídeo para o Instagram...');
  if(!await uploadFile(cdp,videoPath))throw new StudioChanged('Instagram','o campo de arquivo de vídeo');
  await cdp.eval(clickText(['selecionar corte','select crop','cortar'],['button','[role="button"]','div[role="button"]'])).catch(()=>false);
  await cdp.eval(clickText(['original'],['button','[role="button"]','div[role="button"]'])).catch(()=>false);
  // Em desktop, o Instagram apresenta etapas de recorte e edição antes da legenda.
  const fields=['textarea[aria-label*="legenda"]','textarea[aria-label*="caption"]',
    '[contenteditable="true"][aria-label*="legenda"]','[contenteditable="true"][aria-label*="caption"]',
    'textarea[placeholder*="legenda"]','textarea[placeholder*="caption"]','[role="textbox"][contenteditable="true"]'];
  const caption=socialCaption(item,'instagram');
  let done=false;
  for(let step=0;step<3&&!done;step++){
    done=!!await waitFor(cdp,setText(fields,caption),2300);
    if(!done){
      const next=await cdp.eval(clickText(['avançar','next'],['button','[role="button"]','div[role="button"]'])).catch(()=>false);
      if(!next)break;
      await new Promise(r=>setTimeout(r,800));
    }
  }
  if(!done)throw new StudioChanged('Instagram','a etapa de legenda (vídeo já selecionado)');
  const warnings=[];
  await cdp.eval(clickText(['configurações avançadas','advanced settings'],
    ['button','[role="button"]','div[role="button"]'])).catch(()=>false);
  const likesHidden=await cdp.eval(enableOption(['ocultar número de curtidas e visualizações','hide like and view counts'])).catch(()=>false);
  if(!likesHidden)warnings.push('Instagram: confira manualmente “Ocultar número de curtidas e visualizações”.');
  if(coverAPath&&fs.existsSync(coverAPath)){
    try{
      const doneCover=await uploadFile(cdp,coverAPath,{image:true});
      if(!doneCover)warnings.push(imageNotice('instagram'));
    }catch{warnings.push(imageNotice('instagram'));}
  }
  const schedule=validateScheduleWindow('instagram',item.scheduledAt);
  if(schedule)warnings.push(schedule);
  if(item.scheduledAt&&!await applySchedule(cdp,'instagram',item.scheduledAt))
    warnings.push('Agendamento: o Instagram não expôs os controles nesta conta; use a data e o horário preparados no Content Lab.');
  if(item.kind==='long')warnings.push('Instagram não executa o mesmo teste A/B de dois títulos/capas do YouTube. Revise a opção A, sem aplicar a alternativa B.');
  warnings.push('Confirme conta, público, parcerias e conteúdo de IA. Publique ou programe manualmente no Instagram/Meta Business Suite.');
  return {status:'awaiting_review',warnings,videoUrl:null};
}
