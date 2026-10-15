// Escopos estritamente necessários ou desejados, alinhados aos provedores oficiais.
export const OAUTH_SCOPES=Object.freeze({
  youtube:[
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly'
  ],
  instagram:[
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_insights'
  ],
  tiktok:[
    'user.info.basic','video.publish','video.list',
    'user.info.profile','user.info.stats'
  ]
});
export const PUBLISH_SCOPES=Object.freeze({
  youtube:['https://www.googleapis.com/auth/youtube.upload'],
  instagram:['instagram_business_content_publish'],
  tiktok:['video.publish']
});
export function parseGrantedScopes(value){
  if(Array.isArray(value))return [...new Set(value.map(String).filter(Boolean))];
  if(typeof value!=='string')return [];
  return [...new Set(value.split(/[\s,]+/).map(x=>x.trim()).filter(Boolean))];
}
export function missingScopes(provider,granted){
  const expected=OAUTH_SCOPES[provider]||[];
  const actual=new Set(parseGrantedScopes(granted));
  return actual.size?expected.filter(scope=>!actual.has(scope)):[];
}
