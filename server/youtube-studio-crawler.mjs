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
  progress('Localizando a opção Criar no YouTube Studio...');
  let clicked=await waitUntil(cdp,clickSelector(['#create-icon','ytcp-button#create-icon','button[aria-label="Create"]','button[aria-label="Criar"]']),10000);
  if(!clicked)clicked=await waitUntil(cdp,clickText(['criar','create']),6000);
  if(!clicked)throw new YouTubeStudioChanged('o botão Criar');
  progress('Abrindo a tela de envio...');
  clicked=await waitUntil(cdp,clickText(['enviar vídeos','upload videos','fazer upload de vídeos','upload video']),8000);
  if(!clicked)throw new YouTubeStudioChanged('a opção Enviar vídeos');
  progress('Selecionando o arquivo no computador...');
  await sleep(450);
  await setFile(cdp,videoPath);
  progress('Aguardando campos de título e descrição...');
  const titleSelectors=['ytcp-social-suggestions-textbox#title-textarea #textbox',
    '#title-textarea #textbox','ytcp-social-suggestions-textbox#title-textarea [contenteditable="true"]',
    'ytcp-mention-textbox#title-textarea [contenteditable="true"]'];
  const descSelectors=['ytcp-social-suggestions-textbox#description-textarea #textbox',
    '#description-textarea #textbox','ytcp-mention-textbox#description-textarea [contenteditable="true"]'];
  const ready=await waitUntil(cdp,`(()=>{${browserDOM}return nodes.some(n=>${JSON.stringify(titleSelectors)}.some(sel=>n.matches?.(sel)));})()`,45000);
  if(!ready)throw new YouTubeStudioChanged('o campo Título após selecionar o arquivo');
  if(!await cdp.eval(setField(titleSelectors,video.titleA)))throw new YouTubeStudioChanged('o campo Título');
  if(video.description&&!await cdp.eval(setField(descSelectors,video.description)))
    throw new YouTubeStudioChanged('o campo Descrição');
  progress('Título e descrição preenchidos. Procurando tags e miniatura...');
  const warnings=[];
  if(video.tags?.length){
    await cdp.eval(clickText(['mostrar mais','show more'])).catch(()=>false);
    const tagSelectors=['ytcp-form-input-container#tags-container input','ytcp-free-text-chip-bar input',
      '#tags-container input','input[aria-label="Tags"]','input[aria-label="Etiquetas"]'];
    const filled=await cdp.eval(setField(tagSelectors,video.tags.join(',')));
    if(!filled)warnings.push('Tags: campo não encontrado automaticamente; revise em Mostrar mais.');
  }
  // O YouTube expõe frequentemente um único controle de miniatura no upload.
  // O A/B de título/capa requer recursos avançados e controle específico da conta.
  if(coverAPath){
    try{await setFile(cdp,coverAPath,{role:'image'});}
    catch{warnings.push('Thumbnail principal: revise e carregue manualmente no Studio, se necessário.');}
  }
  if(video.kind==='long'&&coverBPath)warnings.push('Teste A/B: configure o título B e a segunda thumbnail manualmente na opção Teste A/B do Studio (quando disponível).');
  if(video.kind==='short')warnings.push('Shorts não têm teste A/B de títulos/miniaturas; verifique a thumbnail do Short no Studio.');
  warnings.push('Revise manualmente: público infantil, uso de IA/conteúdo alterado, promoção paga, direitos autorais, tela final e agendamento ('+(video.scheduledAt||'sem data')+').');
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
