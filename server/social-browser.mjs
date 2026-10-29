import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const SOCIAL_BROWSER_FILE=path.join(os.homedir(),'.contentlab','social-browser.json');
export const SOCIAL_PLATFORMS=Object.freeze({
  tiktok:{label:'TikTok Studio',url:'https://www.tiktok.com/tiktokstudio',hosts:['tiktok.com','www.tiktok.com']},
  instagram:{label:'Instagram',url:'https://www.instagram.com/',hosts:['instagram.com','www.instagram.com']},
  youtube:{label:'YouTube Studio',url:'https://studio.youtube.com/',hosts:['studio.youtube.com']}
});
const BROWSERS={
  chrome:{label:'Google Chrome',linux:['google-chrome','google-chrome-stable'],mac:['/Applications/Google Chrome.app'],win:['Google/Chrome/Application/chrome.exe']},
  edge:{label:'Microsoft Edge',linux:['microsoft-edge','microsoft-edge-stable'],mac:['/Applications/Microsoft Edge.app'],win:['Microsoft/Edge/Application/msedge.exe']},
  firefox:{label:'Mozilla Firefox',linux:['firefox'],mac:['/Applications/Firefox.app'],win:['Mozilla Firefox/firefox.exe']},
  brave:{label:'Brave',linux:['brave-browser','brave'],mac:['/Applications/Brave Browser.app'],win:['BraveSoftware/Brave-Browser/Application/brave.exe']}
};
const clean=platform=>{
  if(!Object.hasOwn(SOCIAL_PLATFORMS,platform))throw Error('Rede social desconhecida.');
  return SOCIAL_PLATFORMS[platform];
};
export function socialUrl(platform,value){
  const def=clean(platform);
  if(typeof value!=='string'||value.length>1024||!value.trim())throw Error('Informe a URL da plataforma.');
  let parsed;try{parsed=new URL(value);}catch{throw Error('URL inválida.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||!def.hosts.includes(parsed.hostname.toLowerCase()))
    throw Error('Use somente a URL HTTPS oficial de '+def.label+'.');
  if(/[\r\n\0]/.test(value))throw Error('URL inválida.');
  parsed.hash='';
  return parsed.href;
}
const defaults=()=>Object.fromEntries(Object.entries(SOCIAL_PLATFORMS).map(([key,v])=>[key,v.url]));
function lookupBrowser(id,{platform=process.platform,env=process.env}={}){
  const entry=BROWSERS[id];if(!entry)return null;
  if(platform==='darwin')return entry.mac.find(p=>fs.existsSync(p))||null;
  if(platform==='win32'){
    for(const base of [env.LOCALAPPDATA,env.PROGRAMFILES,env['PROGRAMFILES(X86)']].filter(Boolean))
      for(const suffix of entry.win){const found=path.join(base,suffix);if(fs.existsSync(found))return found;}
    return null;
  }
  for(const bin of entry.linux){
    try{const result=execFileSync('which',[bin],{encoding:'utf8',timeout:1500,stdio:['ignore','pipe','ignore']}).trim();if(result)return result;}catch{}
  }
  return null;
}
export function detectBrowsers(options={}){
  const platform=options.platform||process.platform;
  let systemLabel='Navegador padrão do sistema';
  try{
    let raw='';
    if(platform==='win32')raw=execFileSync('reg',['query','HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice','/v','ProgId'],{encoding:'utf8',timeout:2000}).toLowerCase();
    else if(platform==='linux')raw=execFileSync('xdg-settings',['get','default-web-browser'],{encoding:'utf8',timeout:2000}).toLowerCase();
    else if(platform==='darwin')raw=execFileSync('defaults',['read','com.apple.LaunchServices/com.apple.launchservices.secure','LSHandlers'],{encoding:'utf8',timeout:2000}).toLowerCase();
    const detected=Object.entries({chrome:['chrome','google-chrome'],edge:['edge','msedge','microsoft-edge'],firefox:['firefox'],brave:['brave']}).find(([,tokens])=>tokens.some(t=>raw.includes(t)))?.[0];
    if(detected)systemLabel+=' (detectado: '+BROWSERS[detected].label+')';
  }catch{}
  return [{id:'system',label:systemLabel,available:true},...Object.entries(BROWSERS).map(([id,b])=>({id,label:id==='firefox'?b.label+' (crawler indisponível)':b.label,available:id!=='firefox'&&!!lookupBrowser(id,options)}))];
}
export function readSocialBrowser(file=SOCIAL_BROWSER_FILE){
  const fallback={browser:null,urls:defaults(),confirmed:Object.fromEntries(Object.keys(SOCIAL_PLATFORMS).map(p=>[p,false]))};
  try{
    if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>8192)return fallback;
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    if(![1,2].includes(data?.version)||!['system',...Object.keys(BROWSERS)].includes(data.browser))return fallback;
    const urls=Object.fromEntries(Object.keys(SOCIAL_PLATFORMS).map(p=>[p,socialUrl(p,data.urls?.[p]||fallback.urls[p])]));
    // Confirmações antigas foram feitas no perfil pessoal e não valem para o crawler.
    const confirmed=Object.fromEntries(Object.keys(SOCIAL_PLATFORMS).map(p=>[p,data.version===2&&data.confirmed?.[p]===true]));
    return {browser:data.browser,urls,confirmed};
  }catch{return fallback;}
}
export function saveSocialBrowser(input,{file=SOCIAL_BROWSER_FILE,browsers=detectBrowsers()}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Configuração inválida.');
  if(!browsers.some(b=>b.id===input.browser&&b.available))throw Error('Selecione um navegador disponível.');
  const urls=Object.fromEntries(Object.keys(SOCIAL_PLATFORMS).map(p=>[p,socialUrl(p,input.urls?.[p])]));
  const previous=readSocialBrowser(file);
  const confirmed=Object.fromEntries(Object.keys(SOCIAL_PLATFORMS).map(p=>[p,previous.browser===input.browser&&previous.urls[p]===urls[p]&&previous.confirmed[p]]));
  const config={browser:input.browser,urls,confirmed};
  writeSocialBrowser(config,file);return config;
}
function writeSocialBrowser(config,file){
  const folder=path.dirname(file);
  fs.mkdirSync(folder,{recursive:true,mode:0o700});
  if(fs.lstatSync(folder).isSymbolicLink()||(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink()))
    throw Error('Arquivo de configurações inseguro.');
  const temp=file+'.next-'+crypto.randomUUID();
  try{fs.writeFileSync(temp,JSON.stringify({version:2,...config},null,2)+'\n',{flag:'wx',mode:0o600});fs.renameSync(temp,file);}
  finally{fs.rmSync(temp,{force:true});}
}
const openings=new Map();
// A configuração abre a mesma sessão Chromium persistente usada pela fila.
// O perfil vive em ~/.contentlab/social-studio-profile; o Content Lab não
// importa cookies do perfil pessoal, não lê senhas e não guarda tokens em JSON.
export async function openSocialBrowser(platform,{
  file=SOCIAL_BROWSER_FILE,browsers=detectBrowsers(),openSession
}={}){
  const provider=clean(platform),config=readSocialBrowser(file);
  if(!config.browser)throw Error('Salve primeiro seu navegador em Configurações.');
  if(!browsers.some(b=>b.id===config.browser&&b.available))
    throw Error('Navegador selecionado não está disponível neste computador.');
  const url=socialUrl(platform,config.urls[platform]);
  const opener=openSession||((opts)=>import('./social-studio-browser.mjs').then(m=>m.openSocialStudioWindow(opts)));
  const session=await opener({config,platforms:[platform]});
  try{
    await session.navigate(platform);
    openings.set(platform,{browser:config.browser,url,at:Date.now(),
      profile:'social-studio-profile'});
  }finally{session.close?.();} // Apenas fecha o canal CDP; o navegador e login ficam abertos.
  return {platform,label:provider.label,opened:true,loginVerified:false,
    profile:'social-studio-profile'};
}
export function confirmSocialBrowser(platform,{file=SOCIAL_BROWSER_FILE}={}){
  clean(platform);
  const config=readSocialBrowser(file),opened=openings.get(platform);
  if(!opened||Date.now()-opened.at>30*60*1000||opened.browser!==config.browser||opened.url!==config.urls[platform]||opened.profile!=='social-studio-profile')
    throw Error('Abra a plataforma neste navegador antes de confirmar seu login.');
  config.confirmed[platform]=true;
  writeSocialBrowser(config,file);openings.delete(platform);
  return config;
}
export const socialBrowserReady=config=>!!config.browser&&Object.keys(SOCIAL_PLATFORMS).some(p=>config.confirmed[p]===true);
