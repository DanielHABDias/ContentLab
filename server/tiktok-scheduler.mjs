/* TikTok Studio: agendamento de vídeo no formulário oficial de upload.
 * Operações irreversíveis (Agendar) são executadas uma única vez e só
 * registradas automaticamente após a confirmação observável do TikTok.
 */
import fs from 'node:fs';
import {DEEP_DOM,StudioChanged,StudioLoginRequired,
  setText,waitFor,uploadFile} from './social-studio-browser.mjs';
import {instagramCaption} from './instagram-scheduler.mjs';

export const TIKTOK_UPLOAD_URL='https://www.tiktok.com/tiktokstudio/upload?from=creator_center&tab=video';
export const TIKTOK_ACTION_DELAY_MS=1100;
const sleep=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
const normalize=values=>JSON.stringify(values.map(v=>v.toLocaleLowerCase('pt-BR')));
export const tiktokCaption=item=>instagramCaption(item);

export function tiktokScheduleParts(value,now=new Date()){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value||''));
  if(!m)throw Error('Escolha data e hora válidas para agendar o TikTok.');
  const [year,month,day,hour,minute]=m.slice(1).map(Number);
  const date=new Date(year,month-1,day,hour,minute);
  if(date.getFullYear()!==year||date.getMonth()!==month-1||
    date.getDate()!==day||date.getHours()!==hour||date.getMinutes()!==minute||
    !Number.isFinite(date.getTime())||date.getTime()<=now.getTime())
    throw Error('Data ou horário passado/inválido no agendamento do TikTok.');
  const gap=date.getTime()-now.getTime();
  if(gap<15*60*1000||gap>10*86400000)
    throw Error('A janela de agendamento do TikTok Studio é normalmente entre 15 minutos e 10 dias. Ajuste a data para continuar.');
  return {date:m[1]+'-'+m[2]+'-'+m[3],time:m[4]+':'+m[5]};
}
export function tiktokButtonExpression(labels,{dialog=false}={}){
  return '(()=>{'+DEEP_DOM+'const names='+normalize(labels)+
    ',dialog='+JSON.stringify(dialog)+';'+
    "const text=n=>String(n.getAttribute('aria-label')||n.innerText||n.textContent||'').trim().toLocaleLowerCase('pt-BR');"+
    "const choices=nodes.filter(n=>n.getClientRects().length&&n.matches?.('button,[role=\"button\"],a')&&names.includes(text(n))&&"+
    "n.getAttribute('aria-disabled')!=='true'&&!n.disabled);"+
    "const target=choices.find(n=>!dialog||n.closest('[role=\"dialog\"],[aria-modal=\"true\"],dialog')||"+
    "n.getRootNode()?.host?.closest?.('[role=\"dialog\"],[aria-modal=\"true\"],dialog'));"+
    'if(!target)return false;target.click();return true;})()';
}
export function tiktokScheduleToggleExpression(){
  const labels=['programar','schedule','agendar vídeo','schedule video'];
  return '(()=>{'+DEEP_DOM+'const names='+normalize(labels)+';'+
    "const text=n=>String(n.getAttribute?.('aria-label')||n.innerText||n.textContent||'').trim().toLocaleLowerCase('pt-BR');"+
    "const labelsFound=nodes.filter(n=>n.getClientRects().length&&names.includes(text(n)));"+
    "const selector='input[type=\"radio\"],input[type=\"checkbox\"],[role=\"radio\"],[role=\"checkbox\"],[role=\"switch\"]';"+
    "for(const label of labelsFound){let parent=label;for(let depth=0;depth<5&&parent;depth++,parent=parent.parentElement||parent.getRootNode()?.host){"+
    "const controls=nodes.filter(n=>n.getClientRects().length&&n.matches?.(selector)&&"+
    "(n===parent||parent.contains?.(n)||n.closest?.('label')===parent));"+
    "if(controls.length!==1)continue;const target=controls[0];"+
    "if(target.checked!==true&&target.getAttribute('aria-checked')!=='true')target.click();return true;}}"+
    'return false;})()';
}
const CAPTION_FIELDS=[
  '[data-e2e="caption-text"] [contenteditable="true"]',
  '[data-testid="caption-input"] [contenteditable="true"]',
  '[data-e2e="video-caption"] [contenteditable="true"]',
  '[data-testid*="caption"] textarea','textarea[placeholder*="descrição"]',
  'textarea[aria-label*="Descrição"]','textarea[placeholder*="description"]',
  '[contenteditable="true"][data-placeholder*="descrição"]',
  '[contenteditable="true"][aria-label*="caption"]',
  '[contenteditable="true"][role="textbox"]'
];
export function tiktokUploadInputExpression(kind){
  return '(()=>{'+DEEP_DOM+
    "return nodes.some(n=>n.matches?.('input[type=\"file\"]')&&"+
    (kind==='image'?"(/image|png|jpe?g|webp/i.test(n.accept||''))":
      "(/video|mp4|webm/i.test(n.accept||'')||!(n.accept||''))")+
    ');})()';
}
const dateInput=date=>setText(['input[type="date"]'],date);
const textDateInput=date=>{
  const [year,month,day]=date.split('-');
  return setText(['input[placeholder*="DD/MM"]','input[aria-label*="Data"]',
    'input[aria-label*="Date"]','input[name*="date"]'],day+'/'+month+'/'+year);
};
const timeInput=time=>setText(['input[type="time"]',
  'input[placeholder*="HH:MM"]','input[aria-label*="Hora"]',
  'input[aria-label*="Time"]','input[name*="time"]'],time);
export function tiktokCalendarDayExpression(date){
  const [year,month,day]=date.split('-').map(Number);
  const time=new Date(year,month-1,day,12);
  const labels=['pt-BR','en-US'].map(locale=>new Intl.DateTimeFormat(locale,{
    day:'numeric',month:'long',year:'numeric'
  }).format(time).toLocaleLowerCase('pt-BR'));
  return '(()=>{'+DEEP_DOM+'const value='+JSON.stringify(date)+
    ',labels='+JSON.stringify(labels)+';'+
    "const dates=nodes.filter(n=>n.getClientRects().length&&n.matches?.('button,[role=\"gridcell\"],[role=\"button\"],[data-date]'));"+
    "const target=dates.find(n=>n.getAttribute('data-date')===value||"+
    "labels.some(label=>(n.getAttribute('aria-label')||'').toLocaleLowerCase('pt-BR').includes(label)));"+
    'if(!target)return false;target.click();return true;})()';
}
const datePickerTrigger=()=>tiktokButtonExpression(['selecionar data','choose date','data','date']);
export function tiktokScheduleSuccessObserver(){
  return '(()=>{'+
    'window.__contentlabTikTokScheduleObserver?.disconnect?.();'+
    'window.__contentlabTikTokScheduleSuccess=null;'+
    "const success=/(video|vídeo|publicaçã|post|content|conteúdo).{0,95}(scheduled|agendad|programad)|"+
    "(scheduled|agendad|programad).{0,95}(video|vídeo|post|publicaçã|conteúdo|content)/i;"+
    "const scan=()=>{const elements=[...document.querySelectorAll('[role=\"alert\"],[role=\"status\"],[aria-live=\"polite\"],[data-testid*=\"toast\"]')];"+
    "const text=elements.map(n=>(n.innerText||n.textContent||'').trim()).find(t=>t.length<500&&success.test(t));"+
    'if(text)window.__contentlabTikTokScheduleSuccess=text;};'+
    'window.__contentlabTikTokScheduleObserver=new MutationObserver(scan);'+
    'window.__contentlabTikTokScheduleObserver.observe(document.documentElement,{subtree:true,childList:true,characterData:true});'+
    'return true;})()';
}
const confirmation=()=>'(window.__contentlabTikTokScheduleSuccess||null)';
const disconnect=()=>'(window.__contentlabTikTokScheduleObserver?.disconnect?.(),true)';
async function dateAndTime(cdp,parts,delayMs){
  let date=await waitFor(cdp,dateInput(parts.date),9000).catch(()=>false);
  if(!date)date=await waitFor(cdp,textDateInput(parts.date),4000).catch(()=>false);
  if(!date){
    if(!await cdp.eval(datePickerTrigger()).catch(()=>false))return false;
    await sleep(delayMs);
    date=await cdp.eval(tiktokCalendarDayExpression(parts.date)).catch(()=>false);
    if(!date)return false;
  }
  await sleep(delayMs);
  if(!await waitFor(cdp,timeInput(parts.time),9000).catch(()=>false))return false;
  await sleep(delayMs);
  return true;
}
export async function prepareTikTokScheduledVideo(session,item,{
  videoPath,coverAPath,progress=()=>{},upload=uploadFile,awaitStep=waitFor,
  delayMs=TIKTOK_ACTION_DELAY_MS,now=new Date(),confirmTimeout=25000
}={}){
  const parts=tiktokScheduleParts(item.scheduledAt,now);
  if(!videoPath||!fs.existsSync(videoPath))throw Error('Vídeo do TikTok não encontrado.');
  if(!coverAPath||!fs.existsSync(coverAPath))throw Error('Capa do TikTok não encontrada.');
  const cdp=await session.navigate('tiktok');
  const login=await cdp.eval("(()=>/\\/login|\\/signup/i.test(location.pathname))()");
  if(login)throw new StudioLoginRequired('TikTok');
  const current=await cdp.eval('location.href');
  if(!current?.startsWith('https://www.tiktok.com/tiktokstudio/upload?')&&
    !current?.startsWith('https://tiktok.com/tiktokstudio/upload?'))
    throw new StudioChanged('TikTok Studio','a página de upload agendado');
  const required=async(message,expr,timeout=15000)=>{
    progress(message);
    if(!await awaitStep(cdp,expr,timeout))throw new StudioChanged('TikTok Studio',message);
    await sleep(delayMs);
  };
  await required('Selecionar vídeo',tiktokButtonExpression(['selecionar vídeo','select video','select videos']),18000);
  progress('Carregando o vídeo no TikTok Studio...');
  if(!await awaitStep(cdp,tiktokUploadInputExpression('video'),12000)||!await upload(cdp,videoPath))
    throw new StudioChanged('TikTok Studio','o campo de vídeo após Selecionar vídeo');
  await sleep(delayMs);
  const caption=tiktokCaption(item);
  progress('Preenchendo a descrição, sem tags automáticas...');
  if(!await awaitStep(cdp,setText(CAPTION_FIELDS,caption.text),40000))
    throw new StudioChanged('TikTok Studio','a caixa Descrição (vídeo já enviado)');
  await sleep(delayMs);
  await required('Editar capa',tiktokButtonExpression(['editar capa','edit cover']),18000);
  await required('Carregar capa',tiktokButtonExpression(['carregar capa','upload cover']),12000);
  progress('Selecionando a thumbnail do Content Lab...');
  if(!await awaitStep(cdp,tiktokUploadInputExpression('image'),12000)||
    !await upload(cdp,coverAPath,{image:true}))
    throw new StudioChanged('TikTok Studio','o arquivo da capa');
  await sleep(delayMs);
  // O Salvar é o do modal de edição da capa, não o salvar do formulário inteiro.
  await required('Salvar capa',tiktokButtonExpression(['salvar','save'],{dialog:true}),16000);
  await required('Programar vídeo',tiktokScheduleToggleExpression(),14000);
  progress('Configurando a data e a hora do TikTok...');
  if(!await dateAndTime(cdp,parts,delayMs))
    throw new StudioChanged('TikTok Studio','os seletores de data e hora');
  progress('Preparando a confirmação do TikTok...');
  await cdp.eval(tiktokScheduleSuccessObserver());
  // Uma única tentativa do botão final Agendar; nunca repetir após timeout.
  // O botão só fica habilitado quando o vídeo termina de processar.
  // A primeira tentativa bem-sucedida clica UMA vez; nunca reenviar após clique.
  if(!await awaitStep(cdp,tiktokButtonExpression(['agendar','schedule']),45000))
    throw new StudioChanged('TikTok Studio','o botão final Agendar');
  progress('Aguardando a confirmação do agendamento (sem reenviar)...');
  const confirmed=await awaitStep(cdp,confirmation(),confirmTimeout).catch(()=>null);
  await cdp.eval(disconnect()).catch(()=>{});
  const notes=[...(caption.truncated?['Descrição limitada aos primeiros 2.200 caracteres.']:[])];
  if(!confirmed)return {status:'awaiting_review',verified:false,videoUrl:null,
    warnings:['O clique Agendar foi enviado, mas não apareceu uma confirmação confiável. Confira o TikTok Studio antes de prosseguir. NÃO repita o upload.',...notes]};
  return {status:'scheduled',verified:true,verification:'tiktok_ui',
    confirmationText:String(confirmed),videoUrl:null,warnings:notes};
}
