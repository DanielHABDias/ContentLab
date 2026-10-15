// Busca pública de pins; sem cookies pessoais, senhas ou login automatizado.
// A estrutura do endpoint pode mudar ou exigir autenticação no Pinterest.
const SEARCH_ENDPOINT='https://www.pinterest.com/resource/BaseSearchResource/get/';
const URL_PIN=/^https:\/\/(?:[a-z0-9-]+\.)?pinterest\.com\/pin\/[0-9]+\/?$/i;
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
function cookieJar(headers){
  const set=typeof headers?.getSetCookie==='function'?headers.getSetCookie():
    [headers?.get?.('set-cookie')].filter(Boolean);
  const jar=[];
  for(const header of set||[]){
    const match=String(header).match(/(?:^|,\s*)([a-zA-Z0-9_-]+)=([^;,]*)/);
    if(match)jar.push(match[1]+'='+match[2]);
  }
  return jar;
}
export async function searchPinterest(query,kind='all',{fetcher=fetch}={}){
  if(kind!=='all'&&kind!=='image'&&kind!=='video')throw Error('Formato Pinterest inválido.');
  const source=new URL('https://www.pinterest.com/search/pins/');
  source.searchParams.set('q',query);
  const headers={
    'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept-Language':'pt-BR,pt;q=0.9,en;q=0.8'
  };
  const landing=await fetcher(source.toString(),{headers,
    redirect:'error',signal:AbortSignal.timeout(13000)});
  if(!landing.ok)throw Error('Pinterest não liberou a busca pública (HTTP '+landing.status+').');
  const cookies=cookieJar(landing.headers);
  await landing.body?.cancel?.().catch(()=>{});
  const csrf=cookies.find(c=>c.startsWith('csrftoken='))?.split('=').slice(1).join('=')||'undefined';
  const path=source.pathname+source.search;
  const resource=new URL(SEARCH_ENDPOINT);
  resource.searchParams.set('source_url',path);
  resource.searchParams.set('data',JSON.stringify({
    options:{query,scope:'pins',page_size:25},context:{}
  }));
  const response=await fetcher(resource.toString(),{
    headers:{...headers,'Accept':'application/json, text/javascript, */*, q=0.01',
      'X-Requested-With':'XMLHttpRequest','X-Pinterest-PWS-Handler':'www/search/[scope].js',
      'X-CSRFToken':csrf,Referer:source.toString(),
      ...(cookies.length?{Cookie:cookies.join('; ')}:{})},
    redirect:'error',signal:AbortSignal.timeout(16000)
  });
  if(!response.ok)throw Error(response.status===403||response.status===429?
    'Pinterest bloqueou temporariamente a busca. Abra a pesquisa no Pinterest e tente novamente mais tarde.':
    'Pinterest indisponível (HTTP '+response.status+').');
  const body=await response.json().catch(()=>null);
  const list=body?.resource_response?.data?.results;
  if(!Array.isArray(list))throw Error('O Pinterest alterou a resposta da pesquisa ou exige login.');
  return normalizePinterest(list,kind).slice(0,25);
}
export const pinterestSearchLink=query=>
  'https://www.pinterest.com/search/pins/?'+new URLSearchParams({q:String(query||'')});
export const isPinMediaUrl=safePinimg;
