import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGrantedScopes,missingScopes,OAUTH_SCOPES} from './social-scopes.mjs';
import {fetchSocialProfile} from './social-profile.mjs';

const reply=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
test('OAuth permission inventory detects missing insights without inventing granted scopes',()=>{
  assert.deepEqual(parseGrantedScopes('video.publish,video.list user.info.basic'),
    ['video.publish','video.list','user.info.basic']);
  assert.ok(missingScopes('instagram','instagram_business_basic instagram_business_content_publish')
    .includes('instagram_business_manage_insights'));
  assert.ok(missingScopes('youtube',OAUTH_SCOPES.youtube).length===0);
  assert.deepEqual(missingScopes('tiktok',''),[],'Unknown scopes are not reported as missing');
});
test('YouTube account resolver identifies authorized channel',async()=>{
  const got=[];
  const result=await fetchSocialProfile('youtube','fake-token',{
    fetcher:async(url,options)=>{
      got.push({url,authorization:options.headers.Authorization});
      return reply({items:[{id:'UC-channel',snippet:{title:'Canal Exemplo',customUrl:'@Canal Exemplo'}}]});
    }
  });
  assert.equal(result.name,'Canal Exemplo');
  assert.equal(result.id,'UC-channel');
  assert.equal(result.username,'@Canal Exemplo');
  assert.ok(got[0].url.includes('mine=true'));
  assert.equal(got[0].authorization,'Bearer fake-token');
});
test('Instagram resolver falls back to basic profile fields without breaking connection',async()=>{
  const urls=[];
  const result=await fetchSocialProfile('instagram','ig-token',{
    fetcher:async(url)=>{
      urls.push(url);
      return urls.length===1?reply({error:{code:10}},403):
        reply({id:'ig-001',username:'Canal Exemplo'});
    }
  });
  assert.equal(urls.length,2);
  assert.equal(result.name,'Canal Exemplo');
  assert.equal(result.id,'ig-001');
});
test('TikTok resolver reads display name from Display API',async()=>{
  const result=await fetchSocialProfile('tiktok','tt-token',{
    fetcher:async(url)=>{
      assert.ok(url.includes('open.tiktokapis.com/v2/user/info'));
      return reply({error:{code:'ok'},data:{user:{
        open_id:'user-12',display_name:'Canal Exemplo',username:'Canal Exemplo'
      }}});
    }
  });
  assert.equal(result.name,'Canal Exemplo');
  assert.equal(result.id,'user-12');
});
