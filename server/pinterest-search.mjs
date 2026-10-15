// Busca pública de pins; sem cookies pessoais, senhas ou login automatizado.
// A estrutura do endpoint pode mudar ou exigir autenticação no Pinterest.
const PINIMG=/^https:\/\/(?:[a-z0-9-]+\.)?pinimg\.com(?::443)?\//i;
const clean=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
const safePinimg=value=>{
  if(typeof value!=='string'||!PINIMG.test(value))return null;
  try {
    const url=new URL(value);
    if(url.username||url.password||url.port&&url.port!=='443')return null;
    return url.toString();
  }catch{return null;}
};
const validPin=value=>/^[0-9]{6,25}$/.test(String(value||''));
const looksMp4=url=>/\.(?:mp4|m4v)(?:\?|$)/i.test(url);

export function normalizePinterest(results,kind='all'){
  const found=[];
  const seen=new Set();
  for(const pin of results||[]){
    const id=String(pin?.id||'');
    if(!validPin(id)||seen.has(id))continue;
    const images=pin.images||{};
    const choices=[images.orig?.url,images['736x']?.url,images['474x']?.url,
      ...Object.values(images).map(item=>item?.url)];
    const image=choices.map(safePinimg).find(Boolean);
    const preview=[images['474x']?.url,images['236x']?.url,images.orig?.url,image]
      .map(safePinimg).find(Boolean);
    const videoContainers=[
      pin.videos?.video_list,pin.video?.video_list,
      ...(pin.story_pin_data?.pages||[]).flatMap(page=>
        (page.blocks||[]).map(block=>block?.video?.video_list))
    ].filter(Boolean);
    const streams=videoContainers.flatMap(list=>Object.values(list)
      .map(item=>safePinimg(item?.url)).filter(Boolean));
    const mp4=streams.find(looksMp4);
    const type=mp4?'video':'image';
    if(kind!=='all'&&kind!==type)continue;
    const media=mp4||image;
    if(!media)continue;
    const title=clean(pin.title||pin.grid_title||pin.description||'Pin '+id);
    const creator=clean(pin.pinner?.full_name||pin.pinner?.username||'Criador no Pinterest');
    const entry={
      provider:'pinterest',kind:type,title,
      pageUrl:'https://www.pinterest.com/pin/'+id+'/',
      preview:preview||null,assetUrl:media,credit:creator,
      license:'Licença não verificada — confirme os direitos com o criador antes de reutilizar.',
      licenseUrl:null
    };
    seen.add(id);
    found.push(entry);
  }
  return found;
}
// Evite redirect:'error': o Pinterest pode mudar de domínio regionalmente.
const isPinterestURL=url=>url.protocol==='https:'&&!url.username&&!url.password&&
  (!url.port||url.port==='443')&&
  /^(?:[a-z0-9-]+\.)?pinterest\.com$/i.test(url.hostname);

function rememberCookies(headers,jar){
  const all=typeof headers?.getSetCookie==='function'?headers.getSetCookie():
    [headers?.get?.('set-cookie')].filter(Boolean);
  for(const header of all||[]){
    const part=String(header).split(';',1)[0];
    const separator=part.indexOf('=');
    if(separator<1)continue;
    const name=part.slice(0,separator).trim();
    const value=part.slice(separator+1).trim();
    if(!/^[\w-]{1,80}$/.test(name))continue;
    if(value)jar.set(name,value);else jar.delete(name);
  }
}
function csrfToken(jar){return jar.get('csrftoken')||'undefined';}
function networkMessage(error,stage){
  const all=[error,error?.cause,...(error?.cause?.errors||[])].filter(Boolean);
  const codes=[...new Set(all.map(x=>String(x.code||'')).filter(Boolean))];
  const has=code=>codes.some(x=>x.includes(code));
  let detail='Verifique a conexão e tente novamente.';
  if(has('ENOTFOUND')||has('EAI_AGAIN'))detail='O DNS não conseguiu localizar o Pinterest.';
  else if(has('ETIMEDOUT')||has('UND_ERR_CONNECT_TIMEOUT')||
    error?.name==='TimeoutError')detail='A conexão com o Pinterest expirou.';
  else if(codes.some(c=>/CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER/.test(c)))
    detail='O certificado HTTPS foi recusado. Verifique a rede e o relógio do computador.';
  else if(has('ENETUNREACH')||has('EHOSTUNREACH')||has('ECONNREFUSED'))
    detail='A rede não conseguiu alcançar o Pinterest.';
  else if(has('ECONNRESET')||has('UND_ERR_SOCKET'))
    detail='A conexão foi interrompida pelo servidor ou pela rede.';
  else if(/unexpected redirect/i.test(String(error?.cause?.message||error?.message||'')))
    detail='O Pinterest respondeu com um redirecionamento.';
  const code=codes.length?' ['+codes.join(', ').slice(0,90)+']':'';
  return 'Falha de rede ao '+stage+' do Pinterest'+code+'. '+detail;
}
export async function pinterestRequest(url,{fetcher=fetch,headers={},jar=new Map(),
  stage='consultar o site'}={}){
  let current=new URL(url);
  const visited=new Set();
  for(let index=0;index<5;index++){
    if(!isPinterestURL(current))throw Error('O Pinterest redirecionou para um destino externo não autorizado.');
    if(/\/(?:login|auth|account\/login)(?:\/|$)/i.test(current.pathname))
      throw Error('O Pinterest exige login para esta busca. Abra a pesquisa no navegador.');
    if(visited.has(current.href))throw Error('O Pinterest entrou em um ciclo de redirecionamentos.');
    visited.add(current.href);
    let response;
    try{
      response=await fetcher(current.toString(),{
        headers:{...headers,...(jar.size?
          {Cookie:[...jar].map(([key,value])=>key+'='+value).join('; ')}:{})},
        signal:AbortSignal.timeout(16000),redirect:'manual'
      });
    }catch(error){
      const issue=Error(networkMessage(error,stage),{cause:error});
      issue.retryable=true;
      throw issue;
    }
    rememberCookies(response.headers,jar);
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers?.get?.('location');
      if(!location)throw Error('O Pinterest retornou um redirecionamento sem destino.');
      let next;
      try{next=new URL(location,current);}
      catch{throw Error('O Pinterest retornou um destino de redirecionamento inválido.');}
      if(!isPinterestURL(next))
        throw Error('O Pinterest redirecionou para um destino externo não autorizado.');
      await response.body?.cancel?.().catch(()=>{});
      current=next;
      continue;
    }
    return {response,url:current,jar};
  }
  throw Error('O Pinterest excedeu o limite de redirecionamentos.');
}

async function searchOnHost(host,query,kind,fetcher){
  const source=new URL('https://'+host+'/search/pins/');
  source.searchParams.set('q',query);
  const jar=new Map();
  const headers={
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept-Language':'pt-BR,pt;q=0.9,en;q=0.8'
  };
  const landing=await pinterestRequest(source.toString(),{
    fetcher,headers,jar,stage:'abrir a página de pesquisa'
  });
  if(!landing.response.ok)throw Error(landing.response.status===403||landing.response.status===429?
    'Pinterest bloqueou a pesquisa pública (HTTP '+landing.response.status+').':
    'Pinterest não liberou a busca pública (HTTP '+landing.response.status+').');
  await landing.response.body?.cancel?.().catch(()=>{});
  const resource=new URL('/resource/BaseSearchResource/get/',landing.url);
  const sourcePath=landing.url.pathname+landing.url.search;
  resource.searchParams.set('source_url',sourcePath);
  resource.searchParams.set('data',JSON.stringify({
    options:{query,scope:'pins',page_size:25},context:{}
  }));
  const result=await pinterestRequest(resource.toString(),{
    fetcher,jar,stage:'consultar os resultados',
    headers:{...headers,
      Accept:'application/json, text/javascript, */*, q=0.01',
      'X-Requested-With':'XMLHttpRequest',
      'X-Pinterest-PWS-Handler':'www/search/[scope].js',
      'X-Pinterest-Source-Url':sourcePath,
      'X-Pinterest-Appstate':'active',
      'X-CSRFToken':csrfToken(jar),Referer:landing.url.toString()
    }
  });
  if(!result.response.ok)throw Error(result.response.status===403||result.response.status===429?
    'Pinterest bloqueou temporariamente a busca (HTTP '+result.response.status+').':
    'Pinterest indisponível (HTTP '+result.response.status+').');
  if(!result.url.pathname.includes('/resource/BaseSearchResource/'))
    throw Error('O Pinterest redirecionou a pesquisa para outra página. Talvez seja necessário fazer login.');
  const body=await result.response.json().catch(()=>null);
  const list=body?.resource_response?.data?.results;
  if(!Array.isArray(list))throw Error('O Pinterest alterou a resposta da pesquisa ou exige login.');
  return normalizePinterest(list,kind).slice(0,25);
}

export async function searchPinterest(query,kind='all',{fetcher=fetch}={}){
  if(kind!=='all'&&kind!=='image'&&kind!=='video')throw Error('Formato Pinterest inválido.');
  // Domínio regional usado em implementações open source; tente somente se a rede falhar.
  let firstError;
  for(const host of ['www.pinterest.com','id.pinterest.com']){
    try{return await searchOnHost(host,query,kind,fetcher);}
    catch(error){
      if(!firstError)firstError=error;
      if(!error.retryable)throw error;
      if(host==='id.pinterest.com')
        throw Error(firstError.message+' O domínio alternativo também falhou: '+error.message);
    }
  }
  throw firstError;
}
export const pinterestSearchLink=query=>
  'https://www.pinterest.com/search/pins/?'+new URLSearchParams({q:String(query||'')});
export const isPinMediaUrl=safePinimg;
