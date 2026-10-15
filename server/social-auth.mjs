import crypto from 'node:crypto';
import {ensureSocialEnv,readSocialEnv,socialValue,writeSocialEnv} from './social-env.mjs';

const PROVIDERS=['youtube','instagram','tiktok'];
const CLIENT_KEYS={
  youtube:['CONTENTLAB_YOUTUBE_CLIENT_ID','CONTENTLAB_YOUTUBE_CLIENT_SECRET'],
  instagram:['CONTENTLAB_INSTAGRAM_CLIENT_ID','CONTENTLAB_INSTAGRAM_CLIENT_SECRET'],
  tiktok:['CONTENTLAB_TIKTOK_CLIENT_KEY','CONTENTLAB_TIKTOK_CLIENT_SECRET']
};
const TOKEN_KEYS={
  youtube:['CONTENTLAB_YOUTUBE_ACCESS_TOKEN','CONTENTLAB_YOUTUBE_REFRESH_TOKEN','CONTENTLAB_YOUTUBE_EXPIRES_AT'],
  instagram:['CONTENTLAB_INSTAGRAM_ACCESS_TOKEN','CONTENTLAB_INSTAGRAM_EXPIRES_AT','CONTENTLAB_INSTAGRAM_ACCOUNT_ID'],
  tiktok:['CONTENTLAB_TIKTOK_ACCESS_TOKEN','CONTENTLAB_TIKTOK_REFRESH_TOKEN','CONTENTLAB_TIKTOK_EXPIRES_AT','CONTENTLAB_TIKTOK_SCOPE','CONTENTLAB_TIKTOK_OPEN_ID']
};
const inFlight=new Map();
const expKey=provider=>'CONTENTLAB_'+provider.toUpperCase()+'_EXPIRES_AT';
const accessKey=provider=>'CONTENTLAB_'+provider.toUpperCase()+'_ACCESS_TOKEN';
const refreshKey=provider=>'CONTENTLAB_'+provider.toUpperCase()+'_REFRESH_TOKEN';
const value=key=>socialValue(key);
const PORT=()=>Number(process.env.PORT||5000);
const callback=provider=>'http://127.0.0.1:'+PORT()+'/api/social/oauth/'+provider+'/callback';

export function providerStatus() {
  ensureSocialEnv();
  return Object.fromEntries(PROVIDERS.map(provider=>{
    const [clientId,secret]=CLIENT_KEYS[provider];
    const configured=!!value(clientId)&&!!value(secret)&&
      (provider!=='instagram'||!!value('CONTENTLAB_INSTAGRAM_REDIRECT_URI'));
    const expiresAt=Number(value(expKey(provider))||0);
    const hasToken=!!value(accessKey(provider)) &&
      (provider==='instagram'||!!value(refreshKey(provider)));
    return [provider,{
      configured,connected:hasToken && (!expiresAt || expiresAt>Date.now()),
      needsRenewal:hasToken&&!!expiresAt&&expiresAt<=Date.now(),
      redirectUri:provider==='instagram'?
        (value('CONTENTLAB_INSTAGRAM_REDIRECT_URI')||'Configure uma URL HTTPS com encaminhamento para o servidor local'):
        callback(provider),
      supportsUpload:true,
      accountId:provider==='instagram'?value('CONTENTLAB_INSTAGRAM_ACCOUNT_ID')||
        null:provider==='tiktok'?value('CONTENTLAB_TIKTOK_OPEN_ID')||null:null
    }];
  }));
}
export function configureProvider(provider,changes) {
  if(!PROVIDERS.includes(provider))throw Error('Plataforma não reconhecida.');
  if(!changes||typeof changes!=='object'||Array.isArray(changes))throw Error('Configuração inválida.');
  const [idKey,secretKey]=CLIENT_KEYS[provider],patch={};
  const permitted=new Set(['clientId','clientSecret','redirectUri']);
  for(const key of Object.keys(changes))if(!permitted.has(key))throw Error('Campo desconhecido.');
  if(typeof changes.clientId==='string'&&changes.clientId.trim())patch[idKey]=changes.clientId.trim();
  if(typeof changes.clientSecret==='string'&&changes.clientSecret.trim())patch[secretKey]=changes.clientSecret.trim();
  if(provider==='instagram'&&typeof changes.redirectUri==='string'&&changes.redirectUri.trim()){
    const url=new URL(changes.redirectUri.trim());
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)
      throw Error('A URI de retorno do Instagram deve ser HTTPS e sem parâmetros.');
    if(!url.pathname.endsWith('/api/social/oauth/instagram/callback'))
      throw Error('A URL precisa apontar para /api/social/oauth/instagram/callback.');
    patch.CONTENTLAB_INSTAGRAM_REDIRECT_URI=url.toString();
  }
  if(!Object.keys(patch).length)throw Error('Informe as credenciais do aplicativo OAuth.');
  const old=readSocialEnv();
  const changed=Object.keys(patch).some(key=>old[key]!==patch[key]);
  if(changed)for(const key of TOKEN_KEYS[provider])patch[key]='';
  writeSocialEnv(patch);
  return providerStatus()[provider];
}
export function disconnectProvider(provider) {
  if(!PROVIDERS.includes(provider))throw Error('Plataforma não reconhecida.');
  writeSocialEnv(Object.fromEntries(TOKEN_KEYS[provider].map(key=>[key,''])));
  return providerStatus()[provider];
}
export function beginAuthorization(provider) {
  if(!PROVIDERS.includes(provider))throw Error('Plataforma não reconhecida.');
  const status=providerStatus()[provider];
  if(!status.configured)throw Error('Configure o Client ID e Secret do aplicativo primeiro.');
  for(const [key,item] of inFlight)if(item.created<Date.now()-10*60*1000)inFlight.delete(key);
  if(inFlight.size>=32)throw Error('Excesso de tentativas de login. Tente novamente.');
  const state=crypto.randomBytes(32).toString('base64url');
  const verifier=crypto.randomBytes(48).toString('base64url');
  const redirectUri=status.redirectUri;
  inFlight.set(state,{provider,redirectUri,verifier,created:Date.now()});
  let url;
  if(provider==='youtube'){
    url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({
      client_id:value(CLIENT_KEYS.youtube[0]),redirect_uri:redirectUri,
      response_type:'code',scope:'https://www.googleapis.com/auth/youtube.upload',
      access_type:'offline',prompt:'consent',state
    }).toString();
  } else if(provider==='instagram'){
    url=new URL('https://www.instagram.com/oauth/authorize');
    url.search=new URLSearchParams({
      client_id:value(CLIENT_KEYS.instagram[0]),redirect_uri:redirectUri,
      response_type:'code',scope:'instagram_business_basic,instagram_business_content_publish',state
    }).toString();
  } else {
    url=new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.search=new URLSearchParams({
      client_key:value(CLIENT_KEYS.tiktok[0]),redirect_uri:redirectUri,
      response_type:'code',scope:'user.info.basic,video.publish',state,
      code_challenge:crypto.createHash('sha256').update(verifier).digest('hex'),
      code_challenge_method:'S256'
    }).toString();
  }
  return {url:url.toString(),state};
}
const tokenRequest=async(url,params)=>{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(params),signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error)throw Error('O provedor recusou a autenticação ('+
    String(data.error?.code||data.error||response.status).slice(0,70)+').');
  return data;
};
const expires=seconds=>String(Date.now()+Math.max(0,Number(seconds)||0)*1000);
export async function completeAuthorization(provider,state,code) {
  const item=inFlight.get(state);
  inFlight.delete(state);
  if(!item||item.provider!==provider||Date.now()-item.created>10*60*1000)
    throw Error('Login expirou ou não pertence a esta tentativa.');
  if(typeof code!=='string'||code.length<5||code.length>4096)
    throw Error('Código de autorização inválido.');
  let data,patch;
  if(provider==='youtube'){
    data=await tokenRequest('https://oauth2.googleapis.com/token',{
      client_id:value(CLIENT_KEYS.youtube[0]),client_secret:value(CLIENT_KEYS.youtube[1]),
      redirect_uri:item.redirectUri,grant_type:'authorization_code',code
    });
    if(!data.access_token||!data.refresh_token)throw Error('Google não enviou refresh token. Revogue acesso e faça login novamente.');
    patch={CONTENTLAB_YOUTUBE_ACCESS_TOKEN:data.access_token,
      CONTENTLAB_YOUTUBE_REFRESH_TOKEN:data.refresh_token,CONTENTLAB_YOUTUBE_EXPIRES_AT:expires(data.expires_in)};
  }else if(provider==='instagram'){
    data=await tokenRequest('https://api.instagram.com/oauth/access_token',{
      client_id:value(CLIENT_KEYS.instagram[0]),client_secret:value(CLIENT_KEYS.instagram[1]),
      redirect_uri:item.redirectUri,grant_type:'authorization_code',code
    });
    if(!data.access_token)throw Error('Instagram não devolveu um token de acesso.');
    const u=new URL('https://graph.instagram.com/access_token');
    u.search=new URLSearchParams({
      grant_type:'ig_exchange_token',client_secret:value(CLIENT_KEYS.instagram[1]),
      access_token:data.access_token
    }).toString();
    const r=await fetch(u,{signal:AbortSignal.timeout(20000)});
    const long=await r.json().catch(()=>({}));
    if(!r.ok||!long.access_token)throw Error('Não foi possível obter token de longa duração do Instagram.');
    patch={CONTENTLAB_INSTAGRAM_ACCESS_TOKEN:long.access_token,
      CONTENTLAB_INSTAGRAM_ACCOUNT_ID:String(data.user_id||''),
      CONTENTLAB_INSTAGRAM_EXPIRES_AT:expires(long.expires_in)};
  }else{
    data=await tokenRequest('https://open.tiktokapis.com/v2/oauth/token/',{
      client_key:value(CLIENT_KEYS.tiktok[0]),client_secret:value(CLIENT_KEYS.tiktok[1]),
      redirect_uri:item.redirectUri,code_verifier:item.verifier,grant_type:'authorization_code',code
    });
    if(!data.access_token||!data.refresh_token)throw Error('TikTok não forneceu tokens de acesso completos.');
    patch={CONTENTLAB_TIKTOK_ACCESS_TOKEN:data.access_token,
      CONTENTLAB_TIKTOK_REFRESH_TOKEN:data.refresh_token,
      CONTENTLAB_TIKTOK_EXPIRES_AT:expires(data.expires_in),
      CONTENTLAB_TIKTOK_SCOPE:String(data.scope||''),
      CONTENTLAB_TIKTOK_OPEN_ID:String(data.open_id||'')};
  }
  writeSocialEnv(patch);
  return providerStatus()[provider];
}
export async function usableAccessToken(provider) {
  if(!PROVIDERS.includes(provider))throw Error('Plataforma não reconhecida.');
  const token=value(accessKey(provider)),exp=Number(value(expKey(provider))||0);
  if(!token)throw Error('Conta não conectada.');
  if(!exp||exp>Date.now()+120000)return token;
  let data,patch={};
  if(provider==='youtube'){
    const refresh=value(refreshKey(provider));
    if(!refresh)throw Error('Conecte sua conta Google novamente.');
    data=await tokenRequest('https://oauth2.googleapis.com/token',{
      client_id:value(CLIENT_KEYS.youtube[0]),client_secret:value(CLIENT_KEYS.youtube[1]),
      grant_type:'refresh_token',refresh_token:refresh
    });
  }else if(provider==='tiktok'){
    data=await tokenRequest('https://open.tiktokapis.com/v2/oauth/token/',{
      client_key:value(CLIENT_KEYS.tiktok[0]),client_secret:value(CLIENT_KEYS.tiktok[1]),
      grant_type:'refresh_token',refresh_token:value(refreshKey(provider))
    });
    if(data.refresh_token)patch.CONTENTLAB_TIKTOK_REFRESH_TOKEN=data.refresh_token;
  }else{
    const url=new URL('https://graph.instagram.com/refresh_access_token');
    url.search=new URLSearchParams({grant_type:'ig_refresh_token',access_token:token}).toString();
    const r=await fetch(url,{signal:AbortSignal.timeout(20000)});
    data=await r.json().catch(()=>({}));
    if(!r.ok||!data.access_token)throw Error('Instagram exige um novo login.');
  }
  if(!data.access_token)throw Error('Renovação da sessão falhou.');
  patch[accessKey(provider)]=data.access_token;
  patch[expKey(provider)]=expires(data.expires_in);
  writeSocialEnv(patch);
  return data.access_token;
}
