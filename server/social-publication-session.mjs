import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {detectBrowsers,readSocialBrowser,SOCIAL_PLATFORMS} from './social-browser.mjs';
import {listSocialDrafts} from './social-drafts.mjs';

export const PUBLICATION_SESSION_FILE=path.join(os.homedir(),'.contentlab','publication-session.json');
const ORDER=['youtube','tiktok','instagram'];
const BROWSER_IDS={chrome:'Google Chrome',edge:'Microsoft Edge',firefox:'Mozilla Firefox',brave:'Brave'};
function defaultBrowserId(){
  const label=detectBrowsers()[0]?.label||'';
  return Object.keys(BROWSER_IDS).find(id=>label.includes('detectado: '+BROWSER_IDS[id]))||null;
}
function executable(id,{platform=process.platform,env=process.env}={}){
  // A implementação existente detecta os executáveis e evita usar shell com URLs.
  if(platform==='darwin')return {
    chrome:'/Applications/Google Chrome.app',edge:'/Applications/Microsoft Edge.app',
    firefox:'/Applications/Firefox.app',brave:'/Applications/Brave Browser.app'
  }[id];
  if(platform==='win32'){
    const suffix={chrome:'Google/Chrome/Application/chrome.exe',edge:'Microsoft/Edge/Application/msedge.exe',
      firefox:'Mozilla Firefox/firefox.exe',brave:'BraveSoftware/Brave-Browser/Application/brave.exe'}[id];
    return [env.LOCALAPPDATA,env.PROGRAMFILES,env['PROGRAMFILES(X86)']].filter(Boolean)
      .map(root=>path.join(root,suffix)).find(file=>fs.existsSync(file))||null;
  }
  const bins={chrome:['google-chrome','google-chrome-stable'],
    edge:['microsoft-edge','microsoft-edge-stable'],firefox:['firefox'],brave:['brave-browser','brave']}[id];
  for(const bin of bins){
    const search=(env.PATH||'').split(path.delimiter);
    const found=search.map(folder=>path.join(folder,bin)).find(file=>fs.existsSync(file));
    if(found)return found;
  }
  return null;
}
export function publicationLaunchCommand(browser,urls,{platform=process.platform,env=process.env}={}){
  const id=browser==='system'?defaultBrowserId():browser;
  if(!id||!Object.hasOwn(BROWSER_IDS,id))throw Error(
    'Não foi possível identificar o navegador padrão. Selecione Chrome, Edge, Brave ou Firefox em Configurações para abrir as abas juntas.');
  const bin=executable(id,{platform,env});
  if(!bin)throw Error('Navegador '+BROWSER_IDS[id]+' não encontrado. Confira o navegador em Configurações.');
  const args=id==='firefox'?['-new-window',urls[0],...urls.slice(1).flatMap(url=>['-new-tab',url])]:
    ['--new-window',...urls];
  return platform==='darwin'?{command:'open',args:['-a',bin,'--args',...args],browser:id}:
    {command:bin,args,browser:id};
}
function persistSession(file,session){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  if(fs.lstatSync(path.dirname(file)).isSymbolicLink()||
    fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())
    throw Error('Arquivo de sessão inseguro.');
  const temp=file+'.next-'+crypto.randomUUID();
  try{
    fs.writeFileSync(temp,JSON.stringify(session,null,2)+'\n',{flag:'wx',mode:0o600});
    fs.renameSync(temp,file);
  }finally{fs.rmSync(temp,{force:true});}
}
export async function preparePublicationSession(draftIds,{
  config=readSocialBrowser(),drafts=listSocialDrafts(),sessionFile=PUBLICATION_SESSION_FILE,
  openSession
}={}){
  if(!Array.isArray(draftIds)||!draftIds.length||draftIds.length>100||
    draftIds.some(id=>typeof id!=='string')||new Set(draftIds).size!==draftIds.length)
    throw Error('Selecione pelo menos um vídeo da lista.');
  if(!config?.browser)throw Error('Configure o navegador em Configurações.');
  const selected=draftIds.map(id=>drafts.find(item=>item.id===id));
  if(selected.some(item=>!item))throw Error('Um vídeo selecionado não foi encontrado. Atualize a lista.');
  if(selected.some(item=>!Array.isArray(item.platforms)||!item.platforms.length||
    item.platforms.some(p=>config.confirmed?.[p]!==true||
      (item.kind==='long'&&p==='tiktok'))))
    throw Error('Há vídeos com rede não confirmada ou incompatível. Revise os destinos em Editar.');
  // Abrir apenas as redes efetivamente usadas pelos vídeos selecionados.
  const used=new Set(selected.flatMap(item=>item.platforms));
  const enabled=ORDER.filter(p=>used.has(p)&&config.confirmed?.[p]===true);
  if(!enabled.length)throw Error('Confirme pelo menos uma rede em Configurações.');
  const opener=openSession||((opts)=>import('./social-studio-browser.mjs').then(m=>m.openSocialStudioWindow(opts)));
  // Exatamente o mesmo perfil e as mesmas abas do login nas Configurações.
  const browserSession=await opener({config,platforms:enabled});
  try{
    const tabs=browserSession.tabs.map(({platform,index,targetId,url})=>({
      platform,index,targetId,label:SOCIAL_PLATFORMS[platform].label,url
    }));
    const session={
      id:crypto.randomUUID(),status:'prepared',browser:browserSession.browser,
      profile:'social-studio-profile',createdAt:new Date().toISOString(),tabs,
      videos:selected.map(item=>({id:item.id,title:item.titleA,kind:item.kind,scheduledAt:item.scheduledAt,
        destinations:item.platforms.map(p=>({
          platform:p,tab:tabs.find(tab=>tab.platform===p).index,
          targetId:tabs.find(tab=>tab.platform===p).targetId
        }))})),
      note:'Abas anteriores do perfil dedicado substituídas pelas redes dos vídeos selecionados; cookies e logins preservados. Nenhum upload foi iniciado.'
    };
    persistSession(sessionFile,session);
    return session;
  }finally{browserSession.close?.();} // Preserva a janela e os cookies do perfil.
}
export function readPublicationSession(file=PUBLICATION_SESSION_FILE){
  try{
    if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>150000)return null;
    const value=JSON.parse(fs.readFileSync(file,'utf8'));
    return value?.status==='prepared'&&Array.isArray(value.tabs)?value:null;
  }catch{return null;}
}
