import fs from 'node:fs';
import path from 'node:path';
import {run} from './exec.mjs';
import {usableAccessToken} from './social-auth.mjs';
import {socialValue} from './social-env.mjs';

const MAX_BYTES=1024*1024*1024;
const captionText=(title,description)=>[title.trim(),description.trim()].filter(Boolean).join('\n\n').replace(/#shorts\b/gi,'#Viral');
const ms=seconds=>Math.max(0,Math.floor((Number(seconds)||0)*1000));
const pause=amount=>new Promise(resolve=>setTimeout(resolve,amount));
const isTikTokURL=url=>{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='open-upload.tiktokapis.com';};
const parseApi=async(response,service)=>{
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.error?.code&&result.error.code!=='ok'||result.error&&typeof result.error==='string')
    throw Error(service+' recusou a solicitação (HTTP '+response.status+'): '+
      String(result.error?.message||result.error?.code||result.error?.error_user_msg||result.error||'erro desconhecido').slice(0,200));
  return result;
};
const streamUpload=(url,file,headers={},fetcher=fetch,signal)=>fetcher(url,{
  method:'PUT',headers,body:fs.createReadStream(file),duplex:'half',redirect:'error',
  signal:signal||AbortSignal.timeout(20*60*1000)
});
const requireFile=(file)=>{
  if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile())throw Error('Arquivo de vídeo inexistente.');
  const size=fs.statSync(file).size;
  if(size<1||size>MAX_BYTES)throw Error('MP4 vazio ou acima de 1 GiB.');
  return size;
};
export function allowedPlatforms(format){
  if(!['16:9','9:16'].includes(format))throw Error('Formato deve ser 16:9 ou 9:16.');
  return format==='16:9'?['youtube','instagram']:['youtube','instagram','tiktok'];
}
export async function inspectVideo(file,{probe=run}={}){
  requireFile(file);
  const {stdout}=await probe('ffprobe',['-v','error','-select_streams','v:0','-show_entries',
    'stream=width,height','-of','json',file]);
  const stream=JSON.parse(stdout).streams?.[0];
  const width=Number(stream?.width),height=Number(stream?.height);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)
    throw Error('Não foi possível identificar as dimensões do MP4.');
  const ratio=width/height;
  const format=Math.abs(ratio-16/9)<.08?'16:9':Math.abs(ratio-9/16)<.04?'9:16':null;
  if(!format)throw Error('O vídeo deve ser 16:9 ou 9:16 (resolução '+width+'x'+height+').');
  return {width,height,format,allowed:allowedPlatforms(format)};
}
export function validatePublishRequest(input,meta){
  if(!input||typeof input!=='object')throw Error('Dados do envio inválidos.');
  if(!['youtube','instagram','tiktok'].includes(input.platform))throw Error('Plataforma não suportada.');
  if(!allowedPlatforms(meta.format).includes(input.platform))
    throw Error('TikTok está bloqueado para vídeos horizontais 16:9.');
  if(input.format!==meta.format)
    throw Error('O formato escolhido não corresponde ao MP4 ('+meta.width+'x'+meta.height+').');
  const title=String(input.title||'').trim();
  const description=String(input.description||'').trim();
  if(!title||title.length>(input.platform==='youtube'?100:150))throw Error('Título inválido para a plataforma.');
  if(description.length>4500)throw Error('Descrição muito longa.');
  const cover=Number(input.coverTime||0);
  if(!Number.isFinite(cover)||cover<0||cover>36000)throw Error('Tempo da capa inválido.');
  let scheduledAt=null;
  if(input.platform==='youtube'){
    scheduledAt=new Date(input.scheduledAt||'');
    if(!Number.isFinite(scheduledAt.getTime())||scheduledAt.getTime()<Date.now()+60000)
      throw Error('Informe um horário futuro para agendar o vídeo no YouTube.');
    if(!['true','false'].includes(input.madeForKids))
      throw Error('Selecione se o vídeo é destinado a crianças.');
  }
  if(input.platform==='tiktok'&&input.confirmRights!=='true')
    throw Error('Confirme que tem direitos sobre o conteúdo e autoriza o envio ao TikTok.');
  return {...input,title,description,coverTime:cover,scheduledAt:scheduledAt?.toISOString(),
    caption:captionText(title,description)};
}
export async function uploadYouTube(file,data,{fetcher=fetch,tokenGetter=usableAccessToken}={}){
  const size=requireFile(file),token=await tokenGetter('youtube');
  const info={snippet:{title:data.title,description:data.description,categoryId:'24'},
    status:{privacyStatus:'private',publishAt:data.scheduledAt,selfDeclaredMadeForKids:data.madeForKids==='true'}};
  const start=await fetcher('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8',
      'X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(size)},
    body:JSON.stringify(info),signal:AbortSignal.timeout(30000),redirect:'error'
  });
  if(!start.ok)await parseApi(start,'YouTube');
  const link=start.headers.get('location');
  if(!link)throw Error('YouTube não retornou endereço de upload.');
  const url=new URL(link);
  if(url.protocol!=='https:'||url.hostname!=='www.googleapis.com'||!url.pathname.startsWith('/upload/youtube/v3/videos'))
    throw Error('URL de upload inesperada do YouTube.');
  const response=await streamUpload(url.toString(),file,{
    Authorization:'Bearer '+token,'Content-Type':'video/mp4','Content-Length':String(size)
  },fetcher);
  const uploaded=await parseApi(response,'YouTube');
  if(!uploaded.id)throw Error('YouTube não confirmou o ID do upload. Verifique o Studio antes de reenviar.');
  return {state:'scheduled',id:uploaded.id,url:'https://www.youtube.com/watch?v='+encodeURIComponent(uploaded.id),
    scheduledAt:data.scheduledAt,visibility:uploaded.status?.privacyStatus||'private'};
}
export async function uploadInstagram(file,data,{fetcher=fetch,tokenGetter=usableAccessToken,wait=pause}={}){
  const size=requireFile(file);
  const token=await tokenGetter('instagram'),id=socialValue('CONTENTLAB_INSTAGRAM_ACCOUNT_ID');
  if(!id||!/^\d{1,30}$/.test(id))throw Error('ID da conta profissional Instagram não encontrado. Reconecte.');
  const root='https://graph.instagram.com/v24.0/';
  const params=new URLSearchParams({media_type:'REELS',upload_type:'resumable',caption:data.caption,
    share_to_feed:'true',thumb_offset:String(ms(data.coverTime))});
  const create=await fetcher(root+id+'/media',{method:'POST',headers:{Authorization:'Bearer '+token,
    'Content-Type':'application/x-www-form-urlencoded'},body:params,signal:AbortSignal.timeout(30000)});
  const container=await parseApi(create,'Instagram (contêiner)');
  if(!container.id)throw Error('Instagram não retornou o contêiner.');
  const response=await streamUpload('https://rupload.facebook.com/ig-api-upload/'+encodeURIComponent(container.id),
    file,{Authorization:'OAuth '+token,'offset':'0','file_size':String(size),'Content-Type':'video/mp4',
      'Content-Length':String(size)},fetcher);
  await parseApi(response,'Instagram (vídeo)');
  let ready=false;
  for(let n=0;n<30;n++){
    await wait(3000);
    const check=await fetcher(root+encodeURIComponent(container.id)+'?fields=status_code',{
      headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
    const state=await parseApi(check,'Instagram (processamento)');
    if(state.status_code==='FINISHED'){ready=true;break;}
    if(['ERROR','EXPIRED'].includes(state.status_code))
      throw Error('Instagram não processou o arquivo ('+state.status_code+').');
  }
  if(!ready)throw Error('Instagram ainda processa o vídeo. Confira a conta antes de repetir o envio.');
  const publish=await fetcher(root+id+'/media_publish',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({creation_id:container.id}),signal:AbortSignal.timeout(30000)});
  const posted=await parseApi(publish,'Instagram (publicação)');
  if(!posted.id)throw Error('Instagram não confirmou o ID da publicação.');
  return {state:'published',id:posted.id,containerId:container.id};
}
export async function tiktokCreatorInfo({fetcher=fetch,tokenGetter=usableAccessToken}={}){
  const token=await tokenGetter('tiktok');
  const result=await fetcher('https://open.tiktokapis.com/v2/post/publish/creator_info/query/',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8'},
    body:'{}',signal:AbortSignal.timeout(30000)});
  const data=await parseApi(result,'TikTok (conta)');
  const options=data.data?.privacy_level_options;
  if(!Array.isArray(options)||!options.length)throw Error('TikTok não informou as opções de privacidade.');
  return {privacyOptions:options,
    maxVideoDuration:data.data?.max_video_post_duration_sec||null,
    nickname:String(data.data?.creator_nickname||''),
    canDuet:!data.data?.duet_disabled,
    canStitch:!data.data?.stitch_disabled,
    canComment:!data.data?.comment_disabled};
}
export async function uploadTikTok(file,data,{fetcher=fetch,tokenGetter=usableAccessToken,
  infoGetter=tiktokCreatorInfo}={}){
  const size=requireFile(file),token=await tokenGetter('tiktok');
  const creator=await infoGetter({fetcher,tokenGetter});
  if(!creator.privacyOptions.includes(data.privacyLevel))
    throw Error('Privacidade não permitida na conta TikTok. Atualize as opções.');
  if(data.caption.length>2200)throw Error('Legenda TikTok excede 2.200 caracteres.');
  // TikTok: 5–64 MiB por chunk, último aceita resto até 128 MiB.
  const chunk=10*1024*1024;
  const count=Math.max(1,Math.floor(size/chunk));
  const init=await fetcher('https://open.tiktokapis.com/v2/post/publish/video/init/',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8'},
    body:JSON.stringify({
      post_info:{title:data.caption,privacy_level:data.privacyLevel,disable_duet:false,
        disable_stitch:false,disable_comment:false,video_cover_timestamp_ms:ms(data.coverTime),
        brand_content_toggle:false,brand_organic_toggle:false},
      source_info:{source:'FILE_UPLOAD',video_size:size,chunk_size:size<chunk?size:chunk,
        total_chunk_count:count}
    }),signal:AbortSignal.timeout(30000)
  });
  const ticket=await parseApi(init,'TikTok (preparação)');
  const uploadUrl=ticket.data?.upload_url;
  if(!uploadUrl||!isTikTokURL(uploadUrl)||!ticket.data?.publish_id)
    throw Error('TikTok não retornou um upload seguro ou ID.');
  for(let index=0;index<count;index++){
    const first=index*chunk,last=index===count-1?size-1:Math.min(size-1,first+chunk-1);
    const bytes=last-first+1;
    const result=await fetcher(uploadUrl,{method:'PUT',headers:{
      'Content-Type':'video/mp4','Content-Length':String(bytes),
      'Content-Range':'bytes '+first+'-'+last+'/'+size},
      body:fs.createReadStream(file,{start:first,end:last}),duplex:'half',redirect:'error',
      signal:AbortSignal.timeout(5*60*1000)});
    if(!result.ok)throw Error('TikTok recusou a parte '+(index+1)+' de '+count+' (HTTP '+result.status+').');
  }
  return {state:'processing',id:ticket.data.publish_id,
    message:'Upload aceito. A publicação final depende do processamento e das permissões TikTok.'};
}
export async function publishFile(file,input,dependencies={}){
  const meta=await inspectVideo(file,dependencies);
  const data=validatePublishRequest(input,meta);
  if(input.platform==='youtube')return {format:meta.format,...await uploadYouTube(file,data,dependencies)};
  if(input.platform==='instagram')return {format:meta.format,...await uploadInstagram(file,data,dependencies)};
  return {format:meta.format,...await uploadTikTok(file,data,dependencies)};
}
