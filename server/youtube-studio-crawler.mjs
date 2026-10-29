/* Automação assistida do YouTube Studio.
 * Usa CDP nativo do Node 22, sem extensões nem leitura de cookies. O perfil de
 * automação é separado do perfil normal; a primeira execução exige login visível.
 * Nunca clica em Publicar/Programar: as declarações e a etapa final exigem revisão.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {publicationLaunchCommand} from './social-publication-session.mjs';

export const YOUTUBE_PROFILE=path.join(os.homedir(),'.contentlab','youtube-studio-profile');
export class YouTubeLoginRequired extends Error {constructor(){super('Faça login no YouTube Studio na janela aberta e clique em Continuar no Content Lab.');this.name='YouTubeLoginRequired';}}
export class YouTubeStudioChanged extends Error {constructor(step){super('Não foi possível identificar '+step+' no YouTube Studio. Continue manualmente na janela visível; o aplicativo não enviará o vídeo novamente automaticamente.');this.name='YouTubeStudioChanged';}}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const number=server.address().port;server.close(()=>resolve(number));});});
const browserDOM=String.raw`
  function deepNodes(){
    const found=[],walk=root=>{
      found.push(...root.querySelectorAll('*'));
      for(const n of root.querySelectorAll('*'))if(n.shadowRoot)walk(n.shadowRoot);
    };walk(document);return found;
  }
  const nodes=deepNodes();
`;
class Cdp {
  constructor(ws){this.ws=ws;this.seq=0;this.pending=new Map();this.sessionId=null;
    ws.addEventListener('message',evt=>{
      let m;try{m=JSON.parse(evt.data);}catch{return;}
      if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;
      this.pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result||{});
    });
    ws.addEventListener('close',()=>{for(const p of this.pending.values())p.reject(Error('A janela do navegador foi fechada.'));this.pending.clear();});
  }
  send(method,params={}){return new Promise((resolve,reject)=>{
    if(this.ws.readyState!==1)return reject(Error('Navegador desconectado.'));
    const id=++this.seq;this.pending.set(id,{resolve,reject});
    this.ws.send(JSON.stringify({id,method,params,...this.sessionId?{sessionId:this.sessionId}:{}}));
  });}
  async eval(expression,returnByValue=true){
    const response=await this.send('Runtime.evaluate',{expression,returnByValue,awaitPromise:true});
    if(response.exceptionDetails)throw Error('Falha na interface do YouTube Studio: '+response.exceptionDetails.text);
    if(response.result?.subtype==='error')throw Error(response.result.description||'Falha no navegador.');
    return returnByValue?response.result?.value:response.result;
  }
  close(){try{this.ws.close();}catch{}}
}
async function connect(portNumber,attempts=100){
  let target=null;
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const r=await fetch('http://127.0.0.1:'+portNumber+'/json/list');
      if(r.ok){const list=await r.json();target=list.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&x.url?.includes('studio.youtube.com'))||list.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);if(target)break;}
    }catch{}
    await sleep(200);
  }
  if(!target)throw Error('O navegador não iniciou o modo de automação local.');
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  const cdp=new Cdp(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  return cdp;
}
function clickSelector(selectors){
  return `(()=>{${browserDOM}
    for(const selector of ${JSON.stringify(selectors)}){
      const node=nodes.find(n=>n.matches?.(selector)&&n.getClientRects().length);
      if(node){node.click();return true;}
    }return false;})()`;
}
function clickText(labels,selectors=['button','ytcp-button','tp-yt-paper-item','ytcp-ve','[role="button"]']){
  return `(()=>{${browserDOM}
    const labels=${JSON.stringify(labels)}.map(v=>v.toLowerCase());
    const candidates=nodes.filter(n=>${JSON.stringify(selectors)}.some(sel=>n.matches?.(sel))&&n.getClientRects().length);
    const match=candidates.find(n=>labels.some(label=>(n.innerText||n.getAttribute('aria-label')||'').trim().toLowerCase()===label))
      ||candidates.find(n=>labels.some(label=>(n.innerText||n.getAttribute('aria-label')||'').trim().toLowerCase().includes(label)));
    if(!match)return false;match.click();return true;})()`;
}
function setField(selectors,value){
  return `(()=>{${browserDOM}
    const selectors=${JSON.stringify(selectors)},value=${JSON.stringify(value)};
    const node=selectors.map(sel=>nodes.find(n=>n.matches?.(sel)&&n.getClientRects().length)).find(Boolean);
    if(!node)return false;
    node.focus();
    if(node.isContentEditable){
      const selection=window.getSelection(),range=document.createRange();
      range.selectNodeContents(node);selection.removeAllRanges();selection.addRange(range);
      document.execCommand('insertText',false,value);
      if(node.textContent!==value)node.textContent=value;
    }else{
      const setter=Object.getOwnPropertyDescriptor(node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')?.set;
      setter?.call(node,value);
    }
    node.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:value}));
    node.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
    return true;})()`;
}
export const YOUTUBE_ACTION_DELAY_MS=1100;
const pauseForStudio=ms=>sleep(Math.max(0,ms));
const TAG_SELECTORS=[
  'ytcp-free-text-chip-bar input','ytcp-form-input-container#tags-container input',
  '#tags-container input','input[aria-label="Tags"]','input[aria-label="Etiquetas"]'
];
export function findStudioTagsExpression(){
  return '(()=>{'+browserDOM+'return nodes.some(n=>'+JSON.stringify(TAG_SELECTORS)+
    '.some(sel=>n.matches?.(sel))&&n.getClientRects().length>0);})()';
}
export async function fillYouTubeTags(cdp,tags,{delayMs=YOUTUBE_ACTION_DELAY_MS}={}){
  if(!Array.isArray(tags)||!tags.length)return true;
  if(!await waitUntil(cdp,findStudioTagsExpression(),8000))return false;
  for(const raw of tags){
    const tag=String(raw||'').trim().replace(/^#/,'');
    if(!tag)continue;
    const expression='(()=>{'+browserDOM+
      'const selectors='+JSON.stringify(TAG_SELECTORS)+';'+
      'const n=selectors.map(s=>nodes.find(x=>x.matches?.(s)&&x.getClientRects().length)).find(Boolean);'+
      'if(!n)return false;n.focus();return n.getRootNode()?.activeElement===n;})()';
    if(!await cdp.eval(expression))return false;
    // Input.insertText + Enter nativos formam um chip por tag no Studio.
    await cdp.send('Input.insertText',{text:tag});
    await pauseForStudio(Math.max(150,delayMs/3));
    await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',
      windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',
      windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    await pauseForStudio(delayMs);
  }
  return true;
}
export function disclosureExpression(type){
  const headings=type==='altered'?
    ['altered content','conteúdo alterado','contenido alterado','synthetic content','conteúdo sintético']:
    ['paid promotion','promoção paga','paid promotions','promoção remunerada','branded content'];
  return '(()=>{'+browserDOM+
    'const headings='+JSON.stringify(headings)+',type='+JSON.stringify(type)+';'+
    "const text=n=>(n.getAttribute('aria-label')||n.textContent||'').trim().toLowerCase();"+
    "const headingsFound=nodes.filter(n=>n.getClientRects().length&&headings.some(h=>text(n)===h));"+
    "const selector='ytcp-radio-button,tp-yt-paper-radio-button,[role=\"radio\"],input[type=\"radio\"],ytcp-checkbox-lit,tp-yt-paper-checkbox,[role=\"checkbox\"],input[type=\"checkbox\"]';"+
    "const isChecked=n=>n.checked===true||n.getAttribute('aria-checked')==='true'||n.hasAttribute('checked');"+
    "const within=(node,ancestor)=>{let n=node;while(n){if(n===ancestor)return true;n=n.parentElement||n.getRootNode()?.host;}return false;};"+
    'for(const head of headingsFound){let section=head;for(let depth=0;depth<8&&section;depth++,section=section.parentElement||section.getRootNode()?.host){'+
    "const controls=nodes.filter(n=>n!==section&&n.matches?.(selector)&&n.getClientRects().length&&within(n,section));"+
    "if(type==='altered'){const radios=controls.filter(n=>n.matches?.('ytcp-radio-button,tp-yt-paper-radio-button,[role=\"radio\"],input[type=\"radio\"]'));"+
    "const target=radios.find(n=>/^(no|não|nao)(\\b|,)/i.test((n.getAttribute('aria-label')||n.getAttribute('value')||n.innerText||n.closest('label')?.innerText||'').trim()));"+
    'if(target){if(!isChecked(target))target.click();return true;}}'+
    "else{const boxes=controls.filter(n=>n.matches?.('ytcp-checkbox-lit,tp-yt-paper-checkbox,[role=\"checkbox\"],input[type=\"checkbox\"]'));"+
    'if(boxes.length===1){if(isChecked(boxes[0]))boxes[0].click();return true;}}'+
    '}}return false;})()';
}
export async function applyYouTubeDisclosures(cdp,_video,{delayMs=YOUTUBE_ACTION_DELAY_MS}={}){
  // Padrão do Content Lab definido pelo criador: não há conteúdo sintético
  // realista nem promoção paga. Se um vídeo for uma exceção, ele altera a
  // declaração no YouTube Studio durante a revisão antes de publicar.
  const warnings=[];
  for(const [label,type] of [
    ['Conteúdo alterado/IA','altered'],
    ['Promoção paga','promotion']
  ]){
    const applied=await cdp.eval(disclosureExpression(type)).catch(()=>false);
    if(!applied)warnings.push(label+': não consegui aplicar a resposta padrão "Não"; confira no YouTube Studio.');
    else await pauseForStudio(delayMs);
  }
  return warnings;
}
export function selectScheduleCardExpression(){
  return '(()=>{'+browserDOM+
    "const options=nodes.filter(n=>n.matches?.('ytcp-radio-button,tp-yt-paper-radio-button,[role=\"radio\"],input[type=\"radio\"],ytcp-visibility-option,ytcp-video-visibility-option')&&n.getClientRects().length);"+
    "const target=options.find(n=>/(schedule|programar|agendar)/i.test((n.getAttribute('aria-label')||'')+' '+(n.innerText||n.closest('label')?.innerText||'')));"+
    "if(!target)return false;if(!(target.checked||target.getAttribute('aria-checked')==='true'))target.click();return true;})()";
}

async function waitUntil(cdp,expression,ms=12000){
  const end=Date.now()+ms;
  while(Date.now()<end){
    try{const value=await cdp.eval(expression);if(value)return value;}catch{}
    await sleep(350);
  }
  return false;
}
async function setFile(cdp,file,{role='video'}={}){
  const expression=`(()=>{${browserDOM}
    const inputs=nodes.filter(n=>n.matches?.('input[type="file"]'));
    const node=inputs.find(n=>{
      const accept=(n.getAttribute('accept')||'').toLowerCase();
      return ${JSON.stringify(role)}==='video'?accept.includes('video')||accept.includes('.mp4'):
        accept.includes('image')||accept.includes('.png')||accept.includes('.jpg');
    })||(${JSON.stringify(role)}==='video'?inputs[0]:null);
    return node||null;})()`;
  const remote=await cdp.eval(expression,false);
  if(!remote?.objectId)throw new YouTubeStudioChanged(role==='video'?'o seletor de vídeo':'o seletor de thumbnail');
  await cdp.send('DOM.setFileInputFiles',{files:[file],objectId:remote.objectId});
  await cdp.send('Runtime.releaseObject',{objectId:remote.objectId}).catch(()=>{});
}
async function setLastImageFile(cdp,file){
  const remote=await cdp.eval(`(()=>{${browserDOM}
    const inputs=nodes.filter(n=>n.matches?.('input[type="file"]')&&/image|png|jpe?g|webp/i.test(n.accept||''));
    return inputs.at(-1)||null;})()`,false);
  if(!remote?.objectId)return false;
  try{await cdp.send('DOM.setFileInputFiles',{files:[file],objectId:remote.objectId});}
  finally{await cdp.send('Runtime.releaseObject',{objectId:remote.objectId}).catch(()=>{});}
  return true;
}
const scheduleParts=value=>{
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value||''));
  return m?{date:m[1]+'-'+m[2]+'-'+m[3],time:m[4]+':'+m[5]}:null;
};
export async function prepareYouTubeSchedule(cdp,value,{delayMs=YOUTUBE_ACTION_DELAY_MS}={}){
  const parts=scheduleParts(value);if(!parts)return false;
  for(let step=0;step<3;step++){
    if(!await waitUntil(cdp,clickText(['próximo','next']),12000))return false;
    await pauseForStudio(delayMs);
  }
  // A última etapa é Visibilidade: clicar no CARTÃO, não no botão final.
  const card=await waitUntil(cdp,clickSelector(['#schedule-radio-button',
    'ytcp-visibility-scheduler #schedule-radio-button']),2500);
  if(!card&&!await waitUntil(cdp,selectScheduleCardExpression(),9000))return false;
  await pauseForStudio(delayMs);
  const dates=['ytcp-datetime-picker input[type="date"]',
    'ytcp-date-time-picker input[type="date"]','input[type="date"]',
    'ytcp-date-time-picker input[aria-label*="Date"]',
    'ytcp-date-time-picker input[aria-label*="Data"]'];
  const times=['ytcp-datetime-picker input[type="time"]',
    'ytcp-date-time-picker input[type="time"]','input[type="time"]',
    'ytcp-date-time-picker input[aria-label*="Time"]',
    'ytcp-date-time-picker input[aria-label*="Hora"]'];
  let date=await cdp.eval(setField(dates,parts.date)).catch(()=>false);
  if(!date){
    // O YouTube frequentemente usa #datepicker-trigger em vez de input[type=date].
    const opened=await cdp.eval(clickSelector(['#datepicker-trigger',
      'ytcp-datetime-picker #datepicker-trigger'])).catch(()=>false);
    if(!opened)return false;
    await pauseForStudio(delayMs);
    const locale=await cdp.eval('navigator.language').catch(()=>'en-US');
    const [year,month,day]=parts.date.split('-');
    const formatted=/^(pt|es|fr|de|it)/i.test(String(locale))?
      day+'/'+month+'/'+year:month+'/'+day+'/'+year;
    date=await cdp.eval(setField(['ytcp-date-picker tp-yt-paper-dialog input',
      'ytcp-date-picker input[type="text"]','ytcp-date-picker input'],formatted)).catch(()=>false);
    if(!date)return false;
    await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  }
  await pauseForStudio(delayMs);
  let time=await cdp.eval(setField(times,parts.time)).catch(()=>false);
  if(!time){
    const opened=await cdp.eval(clickSelector(['#time-of-day-trigger',
      'ytcp-datetime-picker #time-of-day-trigger'])).catch(()=>false);
    if(!opened)return false;
    await pauseForStudio(delayMs);
    time=await cdp.eval(clickText([parts.time],
      ['ytcp-time-of-day-picker tp-yt-paper-item','tp-yt-paper-item'])).catch(()=>false);
  }
  if(!time)return false;
  await pauseForStudio(delayMs);
  return true; // Não clica em "Programar", "Salvar" nem "Publicar".
}
const readActivePort=profile=>{
  const file=path.join(profile,'DevToolsActivePort');
  try{
    if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>2048)return null;
    const n=Number(fs.readFileSync(file,'utf8').split(/\r?\n/)[0]);
    return Number.isInteger(n)&&n>1024&&n<=65535?n:null;
  }catch{return null;}
};
export async function openYouTubeStudio({browser,url,profile=YOUTUBE_PROFILE,launch=spawn,commandBuilder=publicationLaunchCommand}={}){
  if(typeof url!=='string'||!url.startsWith('https://studio.youtube.com/'))throw Error('URL de YouTube Studio inválida.');
  const command=commandBuilder(browser,[url]);
  if(!['chrome','edge','brave'].includes(command.browser))throw Error(
    'Para automatizar o YouTube Studio, selecione Chrome, Edge ou Brave em Configurações. Firefox não oferece o controle CDP necessário.');
  fs.mkdirSync(profile,{recursive:true,mode:0o700});
  if(fs.lstatSync(profile).isSymbolicLink())throw Error('Perfil do navegador inseguro.');
  // Reutiliza a janela que permaneceu aberta após outra fila, inclusive se
  // o serviço Node foi reiniciado. Não inicia Chrome duas vezes com o mesmo perfil.
  const existing=readActivePort(profile);
  if(existing){
    try{
      const cdp=await connect(existing,5);
      return {cdp,port:existing,profile,close:()=>cdp.close()};
    }catch{/* Chrome fechado ou porta desatualizada: iniciar uma nova janela. */}
  }
  const portNumber=await port();
  const args=[...command.args,`--remote-debugging-port=${portNumber}`,'--remote-debugging-address=127.0.0.1',
    '--user-data-dir='+profile,'--remote-allow-origins=http://127.0.0.1:'+portNumber,'--no-first-run'];
  const child=launch(command.command,args,{detached:true,stdio:'ignore',windowsHide:false,shell:false});
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});
  child.unref?.();
  const cdp=await connect(portNumber);
  return {cdp,port:portNumber,profile,close:()=>cdp.close()};
}
export async function prepareYouTubeUpload(browser,video,{videoPath,coverAPath,coverBPath,progress=()=>{}}={}){
  const cdp=browser.cdp;
  if(!fs.existsSync(videoPath))throw Error('O vídeo local foi removido.');
  const currentUrl=await cdp.eval('location.href');
  if(!currentUrl?.startsWith('https://studio.youtube.com/'))throw new YouTubeLoginRequired();
  const delayMs=YOUTUBE_ACTION_DELAY_MS;
  progress('Localizando a opção Criar no YouTube Studio...');
  await pauseForStudio(delayMs);
  let clicked=await waitUntil(cdp,clickSelector(['#create-icon','ytcp-button#create-icon','button[aria-label="Create"]','button[aria-label="Criar"]']),10000);
  if(!clicked)clicked=await waitUntil(cdp,clickText(['criar','create']),6000);
  if(!clicked)throw new YouTubeStudioChanged('o botão Criar');
  await pauseForStudio(delayMs);
  progress('Abrindo a tela de envio...');
  clicked=await waitUntil(cdp,clickText(['enviar vídeos','upload videos','fazer upload de vídeos','upload video']),10000);
  if(!clicked)throw new YouTubeStudioChanged('a opção Enviar vídeos');
  await pauseForStudio(delayMs);
  progress('Selecionando o arquivo no computador...');
  await setFile(cdp,videoPath);
  await pauseForStudio(delayMs);
  progress('Aguardando campos de título e descrição...');
  const titleSelectors=['ytcp-social-suggestions-textbox#title-textarea #textbox',
    '#title-textarea #textbox','ytcp-social-suggestions-textbox#title-textarea [contenteditable="true"]',
    'ytcp-mention-textbox#title-textarea [contenteditable="true"]'];
  const descSelectors=['ytcp-social-suggestions-textbox#description-textarea #textbox',
    '#description-textarea #textbox','ytcp-mention-textbox#description-textarea [contenteditable="true"]'];
  const ready=await waitUntil(cdp,'(()=>{'+browserDOM+'return nodes.some(n=>'+
    JSON.stringify(titleSelectors)+'.some(sel=>n.matches?.(sel)));})()',45000);
  if(!ready)throw new YouTubeStudioChanged('o campo Título após selecionar o arquivo');
  if(!await cdp.eval(setField(titleSelectors,video.titleA)))throw new YouTubeStudioChanged('o campo Título');
  await pauseForStudio(delayMs);
  if(video.description){
    if(!await cdp.eval(setField(descSelectors,video.description)))
      throw new YouTubeStudioChanged('o campo Descrição');
    await pauseForStudio(delayMs);
  }
  const warnings=[];
  progress('Abrindo Mostrar mais / Show more na primeira etapa...');
  const expanded=await waitUntil(cdp,clickText(['mostrar mais','show more','more options','mais opções']),7000);
  if(!expanded)warnings.push('Não encontrei o botão Mostrar mais / Show more. Revise as opções avançadas.');
  await pauseForStudio(delayMs);
  if(video.tags?.length){
    progress('Inserindo as tags individualmente no YouTube...');
    const tags=await fillYouTubeTags(cdp,video.tags,{delayMs}).catch(()=>false);
    if(!tags)warnings.push('Tags: não consegui criar os chips; verifique o campo Tags em Mostrar mais.');
  }
  progress('Revisando conteúdo alterado/IA e promoção paga...');
  warnings.push(...await applyYouTubeDisclosures(cdp,video,{delayMs}));
  await pauseForStudio(delayMs);
  // O YouTube pode ter uma miniatura própria; arquivo de thumbnail é uma etapa separada.
  if(coverAPath){
    progress('Preparando thumbnail A...');
    try{await setFile(cdp,coverAPath,{role:'image'});}
    catch{warnings.push('Thumbnail A: confira manualmente o arquivo selecionado.');}
    await pauseForStudio(delayMs);
  }
  if(video.kind==='long'&&coverBPath){
    progress('Tentando configurar o teste A/B...');
    const opened=await cdp.eval(clickText(['teste a/b','a/b test'])).catch(()=>false);
    if(opened){
      await pauseForStudio(delayMs);
      await cdp.eval(clickText(['título e miniatura','title and thumbnail'])).catch(()=>false);
      await pauseForStudio(delayMs);
      const secondTitle=await cdp.eval(setField([
        '[role="dialog"] input[type="text"]','[role="dialog"] [contenteditable="true"]',
        'ytcp-dialog input[type="text"]','ytcp-dialog [contenteditable="true"]'],video.titleB||'')).catch(()=>false);
      await pauseForStudio(delayMs);
      const secondCover=await setLastImageFile(cdp,coverBPath).catch(()=>false);
      if(!secondTitle||!secondCover)warnings.push('Teste A/B: revise manualmente o título B e a segunda thumbnail.');
    }else warnings.push('Teste A/B: recurso indisponível. Configure o título B e a segunda capa no Studio.');
    await pauseForStudio(delayMs);
  }
  if(video.kind==='short')
    warnings.push('Shorts: confira a thumbnail no YouTube Studio; teste A/B indisponível.');
  if(video.scheduledAt){
    progress('Avançando pelas etapas até Visibilidade e abrindo o cartão Agendar...');
    if(!await prepareYouTubeSchedule(cdp,video.scheduledAt,{delayMs}))
      warnings.push('Agendamento: não consegui selecionar o cartão e/ou preencher data/hora. Configure manualmente '+video.scheduledAt.replace('T',' às ')+'.');
  }
  warnings.push('Confira fuso horário, público infantil, uso de IA, promoção paga, direitos autorais e horário. A confirmação final de Programar/Publicar permanece manual.');
  return {status:'awaiting_review',warnings,videoUrl:await detectYouTubeLink(cdp)};
}
export async function detectYouTubeLink(cdp){
  try{
    return await cdp.eval(`(()=>{const anchors=[...document.querySelectorAll('a[href]')].map(x=>x.href);
      return anchors.find(v=>v.startsWith('https://youtu.be/')||v.startsWith('https://www.youtube.com/watch?v='))||null;})()`);
  }catch{return null;}
}
export function normalizeYouTubeVideoUrl(value){
  if(typeof value!=='string'||value.length>500)return null;
  let u;try{u=new URL(value);}catch{return null;}
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  const host=u.hostname.toLowerCase();
  let id=null;
  if(host==='youtube.com'||host==='www.youtube.com'){
    if(u.pathname==='/watch')id=u.searchParams.get('v');
    else if(u.pathname.startsWith('/shorts/')||u.pathname.startsWith('/live/'))id=u.pathname.split('/').at(-1);
  }else if(host==='youtu.be')id=u.pathname.slice(1);
  return /^[A-Za-z0-9_-]{11}$/.test(id||'')?'https://www.youtube.com/watch?v='+id:null;
}
