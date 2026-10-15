// Perfis são consultados pelas APIs oficiais. Nenhum segredo chega ao navegador.
const names={youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok'};
const limit=value=>String(value||'').slice(0,150);
async function get(url,token,{fetcher=fetch}={}){
  const response=await fetcher(url,{
    headers:{Authorization:'Bearer '+token},
    signal:AbortSignal.timeout(14000),redirect:'error'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||(data.error&&data.error.code&&data.error.code!=='ok'&&data.error.code!==0)){
    const code=data.error?.code||response.status;
    throw Error('Consulta do perfil recusada pela plataforma ('+String(code).slice(0,45)+').');
  }
  return data;
}
export async function fetchSocialProfile(provider,token,{fetcher=fetch}={}){
  if(!token||typeof token!=='string')throw Error('Conexão sem autorização.');
  let data;
  if(provider==='youtube'){
    data=await get('https://www.googleapis.com/youtube/v3/channels?'+
      new URLSearchParams({part:'snippet',mine:'true'}),token,{fetcher});
    const channel=data.items?.[0];
    if(!channel)throw Error('Nenhum canal do YouTube associado à conta escolhida.');
    return {id:limit(channel.id),name:limit(channel.snippet?.title||'Canal YouTube'),
      username:limit(channel.snippet?.customUrl||''),picture:channel.snippet?.thumbnails?.default?.url||null};
  }
  if(provider==='instagram'){
    try{
      data=await get('https://graph.instagram.com/v24.0/me?'+
        new URLSearchParams({fields:'user_id,username,name,profile_picture_url'}),token,{fetcher});
    }catch{
      data=await get('https://graph.instagram.com/v24.0/me?'+
        new URLSearchParams({fields:'id,username'}),token,{fetcher});
    }
    return {id:limit(data.user_id||data.id),name:limit(data.name||data.username||'Instagram'),
      username:limit(data.username||''),picture:data.profile_picture_url||null};
  }
  if(provider==='tiktok'){
    data=await get('https://open.tiktokapis.com/v2/user/info/?'+
      new URLSearchParams({fields:'open_id,display_name,username,avatar_url'}),token,{fetcher});
    const user=data.data?.user;
    if(!user)throw Error('TikTok não disponibilizou os dados do usuário autorizado.');
    return {id:limit(user.open_id),name:limit(user.display_name||user.username||'TikTok'),
      username:limit(user.username||''),picture:user.avatar_url||null};
  }
  throw Error('Rede social não reconhecida: '+(names[provider]||provider));
}
