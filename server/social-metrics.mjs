import crypto from 'node:crypto';
import {usableAccessToken} from './social-auth.mjs';

const PROVIDERS=['youtube','instagram','tiktok'];
const TTL=2*60*1000;
const cache=new Map();
const numberOrNull=value=>value===null||value===undefined||value===''?null:
  Number.isFinite(Number(value))?Math.max(0,Number(value)):null;
const utc=value=>{
  if(!value)return null;
  const ms=typeof value==='number'?value*1000:Date.parse(String(value).replace(/([+-]\d{2})(\d{2})$/,'$1:$2'));
  return Number.isFinite(ms)?new Date(ms).toISOString():null;
};
const sortRecent=(items)=>items.sort((a,b)=>(Date.parse(b.publishedAt||0)||0)-(Date.parse(a.publishedAt||0)||0));
const video=(platform,{id,title,url,publishedAt,views,likes,comments,shares,thumbnail,status,scheduledAt})=>({
  platform,id:String(id||''),title:String(title||'Sem título').slice(0,350),
  url:typeof url==='string'&&/^https:\/\/(www\.)?(youtube\.com|youtu\.be|instagram\.com|tiktok\.com)\//.test(url)?url:null,
  publishedAt:utc(publishedAt),scheduledAt:utc(scheduledAt),
  views:numberOrNull(views),likes:numberOrNull(likes),comments:numberOrNull(comments),
  shares:numberOrNull(shares),
  thumbnail:typeof thumbnail==='string'&&thumbnail.startsWith('https://')?thumbnail:null,
  status:status||'published'
});
const failMessage=(name,response,payload)=>{
  const reason=payload?.error?.message||payload?.error?.code||
    (typeof payload?.error==='string'?payload.error:null);
  const code=response.status;
  return (code===401||code===403)?
    name+': acesso negado. Reconecte em Publicações e confira os escopos do aplicativo.':
    name+': consulta indisponível (HTTP '+code+(reason?' · '+String(reason).slice(0,90):'')+').';
};
async function getJSON(name,url,{fetcher=fetch,token,method='GET',body}={}){
  const response=await fetcher(url,{
    method,headers:{Authorization:'Bearer '+token,
      ...(body?{'Content-Type':'application/json; charset=UTF-8'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(18000),redirect:'error'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error&&data.error.code&&data.error.code!=='ok'&&data.error.code!==0||
      typeof data.error==='string'&&data.error){
    throw Error(failMessage(name,response,data));
  }
  return data;
}
function summarize(platform,items,{channel=null,note=null}={}){
  const published=sortRecent(items.filter(x=>x.status==='published'));
  const scheduled=items.filter(x=>x.status==='scheduled')
    .sort((a,b)=>Date.parse(a.scheduledAt||0)-Date.parse(b.scheduledAt||0));
  const sampled=published.filter(v=>v.views!==null);
  return {
    platform,channel,note,updatedAt:new Date().toISOString(),
    sampleSize:published.length,scheduledCount:scheduled.length,
    totalViews:sampled.length?sampled.reduce((n,v)=>n+v.views,0):null,
    totalLikes:published.some(v=>v.likes!==null)?
      published.reduce((n,v)=>n+(v.likes||0),0):null,
    recent:published.slice(0,20),scheduled:scheduled.slice(0,30),
    latest:published[0]||null,
    top:published.filter(v=>v.views!==null).sort((a,b)=>b.views-a.views).slice(0,7)
  };
}
async function youtube(token,fetcher){
  const root='https://www.googleapis.com/youtube/v3/';
  const auth={fetcher,token};
  const channel=await getJSON('YouTube',root+'channels?'+new URLSearchParams({
    part:'snippet,contentDetails,statistics',mine:'true'}),auth);
  const current=channel.items?.[0];
  if(!current)throw Error('YouTube: nenhum canal encontrado na conta autorizada.');
  const playlist=current.contentDetails?.relatedPlaylists?.uploads;
  if(!playlist)throw Error('YouTube: playlist de uploads não disponível neste canal.');
  const uploads=await getJSON('YouTube',root+'playlistItems?'+new URLSearchParams({
    part:'contentDetails',playlistId:playlist,maxResults:'50'}),auth);
  const ids=[...new Set((uploads.items||[]).map(x=>x.contentDetails?.videoId).filter(Boolean))];
  if(!ids.length)return summarize('youtube',[],{
    channel:{name:current.snippet?.title||'Meu canal',
      subscribers:numberOrNull(current.statistics?.subscriberCount)},
    note:'Últimos 50 uploads do canal; inclui agendados quando retornados pela API.'});
  const details=await getJSON('YouTube',root+'videos?'+new URLSearchParams({
    part:'snippet,statistics,status',id:ids.slice(0,50).join(',')}),auth);
  const items=(details.items||[]).map(v=>{
    const publishedAt=v.snippet?.publishedAt||null;
    const future=v.status?.privacyStatus==='private' && utc(v.status?.publishAt) &&
      Date.parse(v.status.publishAt)>Date.now();
    return video('youtube',{
      id:v.id,title:v.snippet?.title||'Sem título',url:'https://www.youtube.com/watch?v='+v.id,
      publishedAt:publishedAt||v.status?.publishAt,scheduledAt:future?v.status.publishAt:null,
      views:v.statistics?.viewCount,likes:v.statistics?.likeCount,
      comments:v.statistics?.commentCount,
      status:future?'scheduled':v.status?.privacyStatus==='public'?'published':
        v.status?.privacyStatus==='unlisted'?'unlisted':'private',
      thumbnail:v.snippet?.thumbnails?.medium?.url||null
    });
  });
  return summarize('youtube',items,{
    channel:{name:current.snippet?.title||'Meu canal',
      subscribers:numberOrNull(current.statistics?.subscriberCount)},
    note:'Métricas dos vídeos públicos entre os 50 uploads mais recentes; não representam o histórico completo do canal.'});
}
async function instagram(token,fetcher){
  const base='https://graph.instagram.com/v24.0/';
  const auth={fetcher,token};
  const profile=await getJSON('Instagram',base+'me?'+new URLSearchParams({
    fields:'id,username,followers_count,media_count'}),auth);
  // Uma falha em campos opcionais do Instagram não deve ocultar o painel inteiro.
  const standard='id,caption,media_type,permalink,timestamp,like_count,comments_count,thumbnail_url';
  let media;
  try{
    media=await getJSON('Instagram',base+'me/media?'+new URLSearchParams({fields:standard,limit:'20'}),auth);
  }catch{
    media=await getJSON('Instagram',base+'me/media?'+new URLSearchParams({
      fields:'id,media_type,permalink,timestamp',limit:'20'}),auth);
  }
  const entries=(media.data||[]).filter(x=>x.media_type==='VIDEO');
  const items=await Promise.all(entries.map(async(entry,index)=>{
    let views=null;
    if(index<8){
      try{
        const insights=await getJSON('Instagram',base+encodeURIComponent(entry.id)+'/insights?'+
          new URLSearchParams({metric:'views'}),auth);
        const metric=(insights.data||[]).find(x=>x.name==='views');
        views=metric?.values?.[0]?.value??metric?.total_value?.value??null;
      }catch{
        // Nem toda conta ou vídeo disponibiliza visualizações pela API oficial.
      }
    }
    return video('instagram',{
      id:entry.id,title:(entry.caption||'Vídeo sem legenda').split('\n')[0],
      publishedAt:entry.timestamp,url:entry.permalink,
      likes:entry.like_count,comments:entry.comments_count,views,
      thumbnail:entry.thumbnail_url,status:'published'
    });
  }));
  return summarize('instagram',items,{
    channel:{name:profile.username?'@'+profile.username:'Instagram',followers:numberOrNull(profile.followers_count)},
    note:'Vídeos recentes da conta profissional; views consultadas apenas nos oito vídeos mais recentes e exibidas quando a Meta as fornece. Agendamentos feitos pelo Instagram não são listados.'});
}
async function tiktok(token,fetcher){
  const fields='id,title,video_description,create_time,view_count,like_count,comment_count,share_count,share_url,cover_image_url';
  const result=await getJSON('TikTok','https://open.tiktokapis.com/v2/video/list/?'+
    new URLSearchParams({fields}),{
      fetcher,token,method:'POST',body:{max_count:20}
    });
  const items=(result.data?.videos||[]).map(v=>video('tiktok',{
    id:v.id,title:v.title||v.video_description||'Vídeo TikTok',
    publishedAt:v.create_time,views:v.view_count,
    likes:v.like_count,comments:v.comment_count,shares:v.share_count,
    url:v.share_url,thumbnail:v.cover_image_url,status:'published'
  }));
  return summarize('tiktok',items,{
    note:'Últimos 20 vídeos públicos retornados pelo TikTok. Rascunhos e vídeos agendados no TikTok Studio não são disponibilizados por esta API.'});
}
const readers={youtube,instagram,tiktok};
export async function readMetrics(provider,{fetcher=fetch,tokenGetter=usableAccessToken,now=Date.now(),useCache=true}={}){
  if(!PROVIDERS.includes(provider))throw Error('Plataforma inválida.');
  const token=await tokenGetter(provider);
  const key=provider+':'+crypto.createHash('sha256').update(token).digest('hex');
  const old=cache.get(key);
  if(useCache && old && now-old.savedAt<TTL)return old.value;
  const value=await readers[provider](token,fetcher);
  if(cache.size>15)cache.clear();
  cache.set(key,{value,savedAt:now});
  return value;
}
export function clearMetricsCache(){cache.clear();}
