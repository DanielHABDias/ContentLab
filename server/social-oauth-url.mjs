import crypto from 'node:crypto';

// URLs de autorização: nenhum token ou segredo da conta aparece nestas URLs.
export function createOAuthAuthorizeUrl(provider,{clientId,redirectUri,state,verifier}={}) {
  if(!clientId||!redirectUri||!state||!verifier)throw Error('Parâmetros OAuth incompletos.');
  let url;
  if(provider==='youtube'){
    url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({
      client_id:clientId,redirect_uri:redirectUri,response_type:'code',
      scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      access_type:'offline',prompt:'select_account consent',state,
      code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method:'S256'
    }).toString();
  }else if(provider==='instagram'){
    url=new URL('https://www.instagram.com/oauth/authorize');
    url.search=new URLSearchParams({
      client_id:clientId,redirect_uri:redirectUri,response_type:'code',
      scope:'instagram_business_basic,instagram_business_content_publish',state
    }).toString();
  }else if(provider==='tiktok'){
    url=new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.search=new URLSearchParams({
      client_key:clientId,redirect_uri:redirectUri,response_type:'code',
      scope:'user.info.basic,video.publish,video.list',state,
      code_challenge:crypto.createHash('sha256').update(verifier).digest('hex'),
      code_challenge_method:'S256'
    }).toString();
  }else throw Error('Plataforma OAuth inválida.');
  return url.toString();
}
