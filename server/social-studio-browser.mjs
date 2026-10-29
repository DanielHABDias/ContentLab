/* Janela visível com abas identificadas via CDP, sem cookies ou modo headless. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {publicationLaunchCommand} from './social-publication-session.mjs';

export const SOCIAL_STUDIO_PROFILE=path.join(os.homedir(),'.contentlab','social-studio-profile');
export const SOCIAL_ORDER=Object.freeze(['youtube','tiktok','instagram']);
const HOSTS={youtube:['studio.youtube.com'],tiktok:['tiktok.com','www.tiktok.com'],
  instagram:['instagram.com','www.instagram.com']};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{const n=server.address().port;server.close(()=>resolve(n));});});
export function validateStudioUrl(platform,value){
  if(!Object.hasOwn(HOSTS,platform))throw Error('Plataforma desconhecida.');
  let parsed;try{parsed=new URL(value);}catch{throw Error('URL da rede inválida.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||
    !HOSTS[platform].includes(parsed.hostname.toLowerCase()))throw Error('URL social deve ser HTTPS e oficial.');
  return parsed.href;
}
export class StudioLoginRequired extends Error{
  constructor(platform){super('Entre na conta '+platform+' na janela visível e clique em Continuar.');this.name='StudioLoginRequired';}
}
export class StudioChanged extends Error{
  constructor(platform,element){super('Não encontrei '+element+' no '+platform+'. Conclua este vídeo manualmente, sem reenviar o arquivo.');this.name='StudioChanged';}
}
class CDP {
  constructor(ws){
    this.ws=ws;this.pending=new Map();this.sequence=0;
    ws.addEventListener('message',ev=>{
      let msg;try{msg=JSON.parse(ev.data);}catch{return;}
      if(!msg.id)return;
      const pending=this.pending.get(msg.id);if(!pending)return;
      this.pending.delete(msg.id);
      msg.error?pending.reject(Error(msg.error.message||'Erro CDP')):pending.resolve(msg.result||{});
    });
    ws.addEventListener('close',()=>{for(const p of this.pending.values())p.reject(Error('Navegador desconectado.'));this.pending.clear();});
  }
  send(method,params={}){
    return new Promise((resolve,reject)=>{
      if(this.ws.readyState!==1)return reject(Error('Navegador desconectado.'));
      const id=++this.sequence;this.pending.set(id,{resolve,reject});
      this.ws.send(JSON.stringify({id,method,params}));
    });
  }
  async eval(expression,byValue=true){
    const msg=await this.send('Runtime.evaluate',{expression,returnByValue:byValue,awaitPromise:true});
    if(msg.exceptionDetails||msg.result?.subtype==='error')throw Error('Erro ao ler os controles da plataforma.');
    return byValue?msg.result?.value:msg.result;
  }
  close(){try{this.ws.close();}catch{}}
}
async function connectWebsocket(url){
  const ws=new WebSocket(url);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  return new CDP(ws);
}
async function connectBrowser(n,attempts=80){
  for(let i=0;i<attempts;i++){
    try{const response=await fetch('http://127.0.0.1:'+n+'/json/version');
      if(response.ok){const data=await response.json();if(data.webSocketDebuggerUrl)return connectWebsocket(data.webSocketDebuggerUrl);}}
    catch{}
    await delay(250);
  }
  throw Error('A porta local de automação não respondeu.');
}
function previousPort(profile){
  try{const file=path.join(profile,'DevToolsActivePort');
    if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>2048)return null;
    const n=Number(fs.readFileSync(file,'utf8').split(/\r?\n/)[0]);
    return Number.isInteger(n)&&n>1024&&n<65536?n:null;
  }catch{return null;}
}
async function connectTab(n,targetId){
  const response=await fetch('http://127.0.0.1:'+n+'/json/list');
  const list=await response.json();
  const tab=list.find(t=>t.id===targetId&&t.type==='page'&&t.webSocketDebuggerUrl);
  if(!tab)throw Error('A aba foi fechada. Interrompa a fila e abra uma nova sessão.');
  const c=await connectWebsocket(tab.webSocketDebuggerUrl);
  await c.send('Runtime.enable');await c.send('Page.enable');await c.send('DOM.enable');
  return c;
}
export async function openSocialStudioWindow({config,platforms,profile=SOCIAL_STUDIO_PROFILE,
  launch=spawn,buildCommand=publicationLaunchCommand}={}){
  if(!Array.isArray(platforms)||!platforms.length||new Set(platforms).size!==platforms.length)
    throw Error('Selecione redes válidas para a sessão.');
  const ordered=SOCIAL_ORDER.filter(p=>platforms.includes(p));
  if(ordered.length!==platforms.length)throw Error('Rede social desconhecida.');
  const urls=Object.fromEntries(ordered.map(p=>[p,validateStudioUrl(p,config?.urls?.[p])]));
  const cmd=buildCommand(config.browser,[urls[ordered[0]]]);
  if(!['chrome','edge','brave'].includes(cmd.browser))
    throw Error('Para enviar vídeos, selecione Chrome, Edge ou Brave em Configurações.');
  fs.mkdirSync(profile,{recursive:true,mode:0o700});
  if(fs.lstatSync(profile).isSymbolicLink())throw Error('Perfil do navegador inseguro.');
  // O perfil inicial (das versões anteriores) continua funcionando sem
  // perder cookies. Se trocar Chrome por Edge/Brave, usar outro perfil,
  // sem tentar reaproveitar um processo do navegador antigo.
  const existingMarker=path.join(profile,'.contentlab-browser');
  if(fs.existsSync(existingMarker)&&fs.lstatSync(existingMarker).isSymbolicLink())
    throw Error('Marcador do perfil do navegador inseguro.');
  const previousBrowser=fs.existsSync(existingMarker)?
    fs.readFileSync(existingMarker,'utf8').trim():null;
  if(previousBrowser&&previousBrowser!==cmd.browser)profile=profile+'-'+cmd.browser;
  fs.mkdirSync(profile,{recursive:true,mode:0o700});
  if(fs.lstatSync(profile).isSymbolicLink())throw Error('Perfil do navegador inseguro.');
  const marker=path.join(profile,'.contentlab-browser');
  if(fs.existsSync(marker)){
    if(fs.lstatSync(marker).isSymbolicLink()||fs.readFileSync(marker,'utf8').trim()!==cmd.browser)
      throw Error('Perfil do navegador pertence a outro navegador. Selecione o navegador correto em Configurações.');
  }else fs.writeFileSync(marker,cmd.browser+'\n',{flag:'wx',mode:0o600});
  let n=previousPort(profile),control=null,fresh=false;
  if(n)try{control=await connectBrowser(n,4);}catch{control=null;}
  if(!control){
    fresh=true;
    n=await port();
    // No macOS, "open -a" reutiliza o Chrome pessoal já aberto;
    // "-n" força uma instância separada com o perfil persistente do crawler.
    const baseArgs=cmd.command==='open'&&cmd.args[0]==='-a'?
      ['-n',...cmd.args]:cmd.args;
    const args=[...baseArgs,'--remote-debugging-port='+n,'--remote-debugging-address=127.0.0.1',
      '--remote-allow-origins=http://127.0.0.1:'+n,'--user-data-dir='+profile,'--no-first-run'];
    const child=launch(cmd.command,args,{detached:true,stdio:'ignore',windowsHide:false,shell:false});
    await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});
    child.unref?.();
    control=await connectBrowser(n);
  }
  const targets=new Map(),clients=new Map();
  try{
    // Cada nova chamada, seja configuração, abertura manual ou pipeline,
    // reaproveita a aba real deste perfil. Não criar outra janela/perfil.
    const response=await control.send('Target.getTargets');
    const pages=(response.targetInfos||[]).filter(t=>t.type==='page');
    const used=new Set();
    const forPlatform=platform=>pages.find(t=>{
      if(used.has(t.targetId))return false;
      try{return HOSTS[platform].includes(new URL(t.url).hostname.toLowerCase());}
      catch{return false;}
    });
    for(const platform of ordered){
      let selected=forPlatform(platform);
      let shouldNavigate=false;
      if(!selected&&fresh&&targets.size===0){
        // Reutilizar a aba criada pelo Chrome na primeira inicialização.
        selected=pages.find(t=>!used.has(t.targetId)&&!t.url?.startsWith('devtools:'))||null;
        shouldNavigate=Boolean(selected);
      }
      if(!selected){
        selected=await control.send('Target.createTarget',{url:urls[platform],newWindow:false});
      }
      if(!selected.targetId)throw Error('Não foi possível localizar a aba '+platform);
      used.add(selected.targetId);
      targets.set(platform,selected.targetId);
      clients.set(platform,await connectTab(n,selected.targetId));
      if(shouldNavigate)await clients.get(platform).send('Page.navigate',{url:urls[platform]});
    }
    await control.send('Target.activateTarget',{targetId:targets.get(ordered[0])});
  }catch(error){for(const c of clients.values())c.close();control.close();throw error;}
  return {
    port:n,browser:cmd.browser,tabs:ordered.map((p,i)=>({platform:p,index:i+1,targetId:targets.get(p),url:urls[p]})),
    async activate(platform){
      const id=targets.get(platform),client=clients.get(platform);
      if(!id||!client)throw Error('A aba '+platform+' não está disponível.');
      await control.send('Target.activateTarget',{targetId:id});
      return client;
    },
    async navigate(platform){
      const client=await this.activate(platform);
      await client.send('Page.navigate',{url:urls[platform]});
      await delay(800);return client;
    },
    close(){for(const c of clients.values())c.close();control.close();}
  };
}
export const DEEP_DOM="const nodes=[];const visit=root=>{for(const n of root.querySelectorAll('*')){nodes.push(n);if(n.shadowRoot)visit(n.shadowRoot);}};visit(document);";
export async function waitFor(client,expression,timeout=12000){
  const until=Date.now()+timeout;
  while(Date.now()<until){
    try{const result=await client.eval(expression);if(result)return result;}catch{}
    await delay(300);
  }
  return null;
}
export function clickText(labels,selectors=['button','a','[role="button"]']){
  const terms=labels.map(x=>x.toLowerCase());
  return '(()=>{'+DEEP_DOM+'const labels='+JSON.stringify(terms)+',selectors='+JSON.stringify(selectors)+
    ';const choices=nodes.filter(n=>selectors.some(s=>n.matches?.(s))&&n.getClientRects().length);'+
    "const text=n=>(n.getAttribute('aria-label')||n.innerText||'').trim().toLowerCase();"+
    'const target=choices.find(n=>labels.some(t=>text(n)===t))||choices.find(n=>labels.some(t=>text(n).includes(t)));'+
    'if(!target)return false;target.click();return true;})()';
}
export function setText(selectors,value){
  return '(()=>{'+DEEP_DOM+'const sel='+JSON.stringify(selectors)+',value='+JSON.stringify(value)+
    ';const node=nodes.find(n=>sel.some(s=>n.matches?.(s))&&n.getClientRects().length);'+
    'if(!node)return false;node.focus();'+
    "if(node.isContentEditable){const sel=window.getSelection(),range=document.createRange();range.selectNodeContents(node);sel.removeAllRanges();sel.addRange(range);document.execCommand('insertText',false,value);if(node.textContent!==value)node.textContent=value;}"+
    "else if(node instanceof HTMLTextAreaElement||node instanceof HTMLInputElement){const p=node instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(node,value);}else return false;"+
    "node.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,data:value,inputType:'insertText'}));"+
    "node.dispatchEvent(new Event('change',{bubbles:true,composed:true}));return true;})()";
}
export async function uploadFile(client,file,{image=false}={}){
  if(!file||!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile())
    throw Error('Arquivo de mídia ausente ou inválido.');
  const js='(()=>{'+DEEP_DOM+"const inputs=nodes.filter(n=>n.matches?.('input[type=\"file\"]'));"+
    "const selected=inputs.find(n=>{const accept=(n.getAttribute('accept')||'').toLowerCase();return "+
    (image?"accept.includes('image')||accept.includes('.png')||accept.includes('.jpg')":
      "accept.includes('video')||accept.includes('.mp4')||accept.includes('.webm')")+
    ';})'+(image?'':"||(inputs.length===1?inputs[0]:null)")+';return selected||null;})()';
  const remote=await client.eval(js,false);
  if(!remote?.objectId)return false;
  try{await client.send('DOM.setFileInputFiles',{files:[file],objectId:remote.objectId});}
  finally{await client.send('Runtime.releaseObject',{objectId:remote.objectId}).catch(()=>{});}
  return true;
}
