/* Fluxo específico do Instagram em /scheduled_content/.
 * O clique final só ocorre após preparar vídeo, capa, legenda e agendamento.
 * Não faz novo upload nem repete o clique final sem confirmação.
 */
import fs from 'node:fs';
import {DEEP_DOM,StudioLoginRequired,StudioChanged,
  setText,waitFor,uploadFile} from './social-studio-browser.mjs';

export const INSTAGRAM_SCHEDULED_URL='https://www.instagram.com/scheduled_content/';
export const INSTAGRAM_STEP_DELAY_MS=1050;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));
const normLabels=labels=>JSON.stringify(labels.map(x=>x.toLocaleLowerCase('pt-BR')));
const safeElement=s=>JSON.stringify(s);

export function instagramCaption(item){
  const title=String(item.titleA||'').trim(),description=String(item.description||'').trim();
  // Etiquetas são metadados do Content Lab, não texto da legenda.
  // Uma linha em branco entre cada seção, conforme o padrão editorial.
  const text=[title,'Link do canal na bio',description].filter(Boolean).join('\n\n');
  if(!title)throw Error('Preencha o título do vídeo para a legenda do Instagram.');
  // Não bloquear vídeo longo por legenda extensa: manter título e convite,
  // preservar o máximo possível de descrição e hashtags.
  return {text:text.slice(0,2200),truncated:text.length>2200};
}
export function instagramScheduleParts(value,now=new Date()){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value||''));
  if(!m)throw Error('Informe uma data e um horário para programar o Reels.');
  const [year,month,day,hour,minute]=m.slice(1).map(Number);
  const date=new Date(year,month-1,day,hour,minute);
  if(!Number.isFinite(date.getTime())||date.getFullYear()!==year||
    date.getMonth()!==month-1||date.getDate()!==day||
    date.getHours()!==hour||date.getMinutes()!==minute||
    date.getTime()<=now.getTime())
    throw Error('Data/hora do Instagram inválida ou passada; revise o agendamento no Content Lab.');
  return {date:m[1]+'-'+m[2]+'-'+m[3],time:m[4]+':'+m[5]};
}
// Só aciona botões que correspondam exatamente a um texto visível.
export function instagramButtonExpression(labels,{title=false,scope=null}={}){
  return '(()=>{'+DEEP_DOM+'const names='+normLabels(labels)+
    ',scope='+safeElement(scope)+',byTitle='+JSON.stringify(title)+';'+
    "const text=x=>String(x||'').trim().toLocaleLowerCase('pt-BR');"+
    "const candidates=nodes.filter(n=>n.getClientRects().length&&"+
    "(byTitle?n.hasAttribute('title'):n.matches?.('button,[role=\"button\"],a,div[tabindex],input[type=\"button\"]')));"+
    "const label=n=>text(byTitle?n.getAttribute('title'):n.getAttribute('aria-label')||n.innerText||n.textContent||n.title);"+
    "let choices=candidates.filter(n=>names.includes(label(n)));"+
    "if(scope){choices=choices.filter(n=>{let p=n;for(let i=0;i<7&&p;i++,p=p.parentElement||p.getRootNode()?.host){"+
    "const t=text(p.getAttribute?.('aria-label')||p.innerText||'');"+
    "if(t.includes(scope))return true;}return false;});}"+
    "const target=choices.find(n=>!n.disabled&&n.getAttribute('aria-disabled')!=='true');"+
    'if(!target)return false;target.click();return true;})()';
}
const inputPresent=(type)=>'(()=>{'+DEEP_DOM+
  'return nodes.some(n=>n.matches?.("input[type=file]")&&'+
  (type==='image'?"(/image|png|jpe?g|webp/i.test(n.accept||''))":
  "(/video|mp4|webm/i.test(n.accept||'')||!(n.accept||''))")+
  ');})()';
export function instagramNoticeExpression(){
  return '(()=>{'+DEEP_DOM+
    "const dialogs=nodes.filter(n=>n.matches?.('[role=\"dialog\"],[role=\"alertdialog\"]')&&n.getClientRects().length);"+
    "const notice=dialogs.find(n=>/reels/i.test(n.innerText||'')&&"+
    "/(vídeo|video|compartilhad|shared|publicaç|post)/i.test(n.innerText||''));"+
    "if(!notice)return false;const buttons=[...notice.querySelectorAll('button,[role=\"button\"]')];"+
    "const ok=buttons.find(n=>/^(ok|entendi|got it|understood)$/i.test((n.innerText||n.getAttribute('aria-label')||'').trim()));"+
    'if(!ok)return false;ok.click();return true;})()';
}
const CAPTION_FIELDS=[
  'textarea[placeholder*="legenda"]','textarea[aria-label*="legenda"]',
  '[contenteditable="true"][aria-label*="legenda"]',
  '[contenteditable="true"][data-placeholder*="legenda"]',
  'textarea[placeholder*="caption"]','textarea[aria-label*="caption"]',
  '[contenteditable="true"][aria-label*="caption"]',
  '[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]'
];
export function instagramToggleExpression(labels){
  return '(()=>{'+DEEP_DOM+'const labels='+normLabels(labels)+';'+
    "const text=n=>String(n.innerText||n.getAttribute?.('aria-label')||n.textContent||'').trim().toLocaleLowerCase('pt-BR');"+
    "const matched=nodes.filter(n=>n.getClientRects().length&&labels.some(s=>text(n)===s));"+
    "for(const n of matched){let p=n;for(let depth=0;depth<5&&p;depth++,p=p.parentElement||p.getRootNode()?.host){"+
    "const controls=[...p.querySelectorAll?.('input[type=\"checkbox\"],[role=\"checkbox\"],[role=\"switch\"],input[type=\"radio\"]')||[]];"+
    "if(p.matches?.('input[type=\"checkbox\"],[role=\"checkbox\"],[role=\"switch\"],input[type=\"radio\"]'))controls.unshift(p);"+
    "if(controls.length!==1)continue;const target=controls[0];"+
    "const checked=target.checked===true||target.getAttribute('aria-checked')==='true';"+
    'if(!checked)target.click();return true;}}return false;})()';
}
const setInstagramDateExpression=date=>setText([
  'input[type="date"]'
],date);
const setInstagramTextDateExpression=date=>{
  const [year,month,day]=date.split('-');
  return setText(['input[name*="date"]','input[aria-label*="Data"]',
    'input[aria-label*="Date"]','input[placeholder*="DD/MM"]',
    'input[placeholder*="MM/DD"]'],day+'/'+month+'/'+year);
};
const setInstagramTimeExpression=time=>setText([
  'input[type="time"]','input[name*="time"]','input[aria-label*="Hora"]',
  'input[aria-label*="Time"]','input[placeholder*="HH:MM"]',
  'input[placeholder*="hh:mm"]'
],time);
export function instagramSpinTimeExpression(time){
  const [hours,minutes]=time.split(':');
  return '(()=>{'+DEEP_DOM+'const values='+JSON.stringify([hours,minutes])+';'+
    "const selectors=['input[role=\"spinbutton\"][aria-label=\"Hours\"]','input[role=\"spinbutton\"][aria-label=\"Hora\"]',"+
    "'input[role=\"spinbutton\"][aria-label=\"Minutes\"]','input[role=\"spinbutton\"][aria-label=\"Minutos\"]'];"+
    "const hour=nodes.find(n=>n.getClientRects().length&&(n.matches?.(selectors[0])||n.matches?.(selectors[1])));"+
    "const minute=nodes.find(n=>n.getClientRects().length&&(n.matches?.(selectors[2])||n.matches?.(selectors[3])));"+
    "if(!hour||!minute)return false;const set=(n,v)=>{n.focus();const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;"+
    "setter?.call(n,v);n.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}));n.dispatchEvent(new Event('change',{bubbles:true}));n.blur();};"+
    "set(hour,values[0]);set(minute,values[1]);return true;})()";
}
async function typeInstagramSpinValue(cdp,label,value){
  const focused=await cdp.eval('(()=>{'+DEEP_DOM+'const labels='+JSON.stringify(label)+';'+
    "const field=nodes.find(n=>n.getClientRects().length&&n.matches?.('input[role=\"spinbutton\"]')&&labels.includes(n.getAttribute('aria-label')));"+
    "if(!field)return false;field.focus();field.select?.();return true;})()").catch(()=>false);
  if(!focused||typeof cdp.send!=='function')return false;
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
  await cdp.send('Input.insertText',{text:value});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  return true;
}
export function instagramDateTriggerExpression(){
  return '(()=>{'+DEEP_DOM+
    "const target=nodes.find(n=>n.getClientRects().length&&n.matches?.('button,[role=\"button\"]')&&"+
    "/(\\b\\d{4}\\b|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|mon|tue|wed|thu|fri|sat|sun|seg|ter|qua|qui|sex|sáb|dom)/i.test((n.innerText||n.getAttribute('aria-label')||'').trim()));"+
    "if(!target)return false;target.click();return true;})()";
}
// Fallback apenas quando o calendário mostra uma data explicitamente
// identificável. Nunca clicar num dia solto do mês errado.
export function instagramCalendarDayExpression(date){
  const [yy,mm,dd]=date.split('-').map(Number);
  const day=new Date(yy,mm-1,dd,12);
  const labels=[new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric'}).format(day),
    new Intl.DateTimeFormat('en-US',{day:'numeric',month:'long',year:'numeric'}).format(day)];
  return '(()=>{'+DEEP_DOM+'const iso='+JSON.stringify(date)+
    ',labels='+JSON.stringify(labels.map(x=>x.toLocaleLowerCase('pt-BR')))+';'+
    "const choices=nodes.filter(n=>n.getClientRects().length&&n.matches?.('button,[role=\"gridcell\"],[role=\"button\"],[data-date]'));"+
    "const target=choices.find(n=>n.getAttribute('data-date')===iso||"+
    "labels.some(label=>(n.getAttribute('aria-label')||'').toLocaleLowerCase('pt-BR').includes(label)));"+
    'if(!target)return false;target.click();return true;})()';
}
export function instagramConfirmationObserverExpression(){
  return '(()=>{'+
    "window.__contentlabInstagramScheduleObserver?.disconnect?.();"+
    "const success=/((reel|conteúdo|content|post|publicaçã).{0,90}(programad|agendad|scheduled))|"+
    "((programad|agendad|scheduled).{0,90}(reel|conteúdo|content|post|publicaçã))/i;"+
    "window.__contentlabInstagramScheduleSuccess=null;"+
    "const scan=()=>{const nodes=[...document.querySelectorAll('[role=\"alert\"],[role=\"status\"],[data-testid*=\"toast\"],[aria-live=\"polite\"]')];"+
    "const text=nodes.map(n=>(n.innerText||n.textContent||'').trim()).find(t=>t.length<500&&success.test(t));"+
    "if(text)window.__contentlabInstagramScheduleSuccess=text;};"+
    "window.__contentlabInstagramScheduleObserver=new MutationObserver(scan);"+
    "window.__contentlabInstagramScheduleObserver.observe(document.documentElement,{subtree:true,childList:true,characterData:true});"+
    'return true;})()';
}
const confirmationResult=()=>"(window.__contentlabInstagramScheduleSuccess||null)";
const clearObserver=()=> '(()=>{window.__contentlabInstagramScheduleObserver?.disconnect?.();return true;})()';
async function calendarAndTime(cdp,parts,delayMs){
  let date=await cdp.eval(setInstagramDateExpression(parts.date)).catch(()=>false);
  if(!date)date=await cdp.eval(setInstagramTextDateExpression(parts.date)).catch(()=>false);
  if(!date){
    const trigger=await cdp.eval(instagramButtonExpression(['data','date','selecionar data','select date']))
      .catch(()=>false)||await cdp.eval(instagramDateTriggerExpression())
      .catch(()=>false);
    if(!trigger)return false;
    await sleep(delayMs);
    date=await cdp.eval(instagramCalendarDayExpression(parts.date)).catch(()=>false);
    if(!date)return false;
  }
  await sleep(delayMs);
  let time=await cdp.eval(setInstagramTimeExpression(parts.time)).catch(()=>false);
  if(!time&&typeof cdp.send==='function'){
    const [hour,minute]=parts.time.split(':');
    time=await typeInstagramSpinValue(cdp,['Hours','Hora'],hour)&&
      await typeInstagramSpinValue(cdp,['Minutes','Minutos'],minute);
  }
  if(!time)time=await cdp.eval(instagramSpinTimeExpression(parts.time)).catch(()=>false);
  if(!time)return false;
  await sleep(delayMs);
  return true;
}
export async function prepareInstagramScheduledReel(session,item,{
  videoPath,coverAPath,progress=()=>{},upload=uploadFile,
  delayMs=INSTAGRAM_STEP_DELAY_MS,now=new Date(),confirmTimeout=20000,
  awaitStep=waitFor
}={}){
  const parts=instagramScheduleParts(item.scheduledAt,now);
  if(!videoPath||!fs.existsSync(videoPath))throw Error('Arquivo do Reels não encontrado.');
  if(!coverAPath||!fs.existsSync(coverAPath))throw Error('Thumbnail do Reels não encontrada.');
  const cdp=await session.navigate('instagram');
  const login=await cdp.eval("(()=>/\\/accounts\\/login|\\/login|\\/signup/i.test(location.pathname))()");
  if(login)throw new StudioLoginRequired('Instagram');
  const current=await cdp.eval('location.href');
  if(!current?.startsWith('https://www.instagram.com/scheduled_content/')&&
    !current?.startsWith('https://instagram.com/scheduled_content/'))
    throw new StudioChanged('Instagram','a página Conteúdo programado');

  const requireStep=async(text,expr,timeout=12000)=>{
    progress(text);
    if(!await awaitStep(cdp,expr,timeout))throw new StudioChanged('Instagram',text);
    await sleep(delayMs);
  };
  let started=await awaitStep(cdp,instagramButtonExpression(['programar conteúdo','schedule content']),5000);
  if(!started)started=await awaitStep(cdp,instagramButtonExpression(['novo post','new post','criar','create']),7000);
  if(!started)throw new StudioChanged('Instagram','o botão Programar conteúdo ou Novo post');
  await sleep(delayMs);
  await requireStep('o botão Selecionar do computador',instagramButtonExpression([
    'selecionar do computador','select from computer']));
  progress('Enviando o vídeo ao Instagram...');
  if(!await awaitStep(cdp,inputPresent('video'),15000)||!await upload(cdp,videoPath))
    throw new StudioChanged('Instagram','o seletor de vídeo (o upload pode ter começado)');
  await sleep(delayMs);
  // Aviso opcional: vídeos agora são compartilhados como Reels.
  await cdp.eval(instagramNoticeExpression()).catch(()=>false);
  await sleep(delayMs);
  await requireStep('Selecionar corte',instagramButtonExpression([
    'selecionar corte','select crop'],{title:true}),15000);
  await requireStep('corte Original',instagramButtonExpression(['original']));
  await requireStep('o botão Avançar após o corte',instagramButtonExpression(['avançar','next']));
  progress('Carregando a foto da capa...');
  const coverPicker=await awaitStep(cdp,instagramButtonExpression([
    'selecionar do computador','select from computer'],{scope:'foto da capa'}),5000)||
    await awaitStep(cdp,instagramButtonExpression([
      'selecionar do computador','select from computer'],{scope:'cover photo'}),4000);
  if(!coverPicker)throw new StudioChanged('Instagram','Selecionar do computador na seção Foto da capa');
  await sleep(delayMs);
  if(!await awaitStep(cdp,inputPresent('image'),9000)||!await upload(cdp,coverAPath,{image:true}))
    throw new StudioChanged('Instagram','o upload da foto da capa');
  await sleep(delayMs);
  const caption=instagramCaption(item);
  progress('Preenchendo título, Link na bio e descrição do Reels...');
  let filled=await awaitStep(cdp,setText(CAPTION_FIELDS,caption.text),6500);
  if(!filled){
    await requireStep('Avançar até a legenda',instagramButtonExpression(['avançar','next']),5500);
    filled=await awaitStep(cdp,setText(CAPTION_FIELDS,caption.text),12000);
  }
  if(!filled)throw new StudioChanged('Instagram','Adicione uma legenda (vídeo já enviado)');
  await sleep(delayMs);
  await requireStep('o controle Programar conteúdo',instagramToggleExpression([
    'programar conteúdo','schedule content','schedule this reel']),11000);
  progress('Definindo a data e o horário do Reels...');
  if(!await calendarAndTime(cdp,parts,delayMs))
    throw new StudioChanged('Instagram','a data ou a hora do agendamento');
  await requireStep('Configurações avançadas',instagramButtonExpression([
    'configurações avançadas','advanced settings']));
  await requireStep('Ocultar número de curtidas e visualizações',instagramToggleExpression([
    'ocultar número de curtidas e visualizações desse post',
    'ocultar número de curtidas e visualizações',
    'hide like and view counts on this post',
    'hide like and view counts']));
  progress('Confirmando o agendamento no Instagram...');
  // Instalar observador ANTES do clique final, para captar toast dinâmico.
  await cdp.eval(instagramConfirmationObserverExpression());
  // Este é o único clique final; não é repetido automaticamente em caso de timeout.
  if(!await cdp.eval(instagramButtonExpression(['programar','schedule'])).catch(()=>false))
    throw new StudioChanged('Instagram','o botão final Programar');
  progress('Aguardando a confirmação do Instagram, sem repetir o envio...');
  const confirmation=await awaitStep(cdp,confirmationResult(),confirmTimeout).catch(()=>null);
  await cdp.eval(clearObserver()).catch(()=>{});
  if(!confirmation)return {
    status:'awaiting_review',videoUrl:null,
    warnings:['Clique final enviado, mas não foi encontrada confirmação de agendamento do Instagram. Verifique o Conteúdo programado antes de prosseguir; NÃO repita o upload.',
      ...(caption.truncated?['Legenda limitada aos primeiros 2.200 caracteres.']:[])]
  };
  return {status:'scheduled',verified:true,verification:'instagram_ui',videoUrl:null,
    confirmationText:confirmation,
    warnings:[...(caption.truncated?['Legenda limitada aos primeiros 2.200 caracteres.']:[]),
      ...(item.kind==='long'?['Instagram usa a thumbnail A; o teste A/B é exclusivo do YouTube.']:[])]};
}
