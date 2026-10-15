import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {normalizePinterest,searchPinterest,isPinMediaUrl,pinterestRequest} from './pinterest-search.mjs';
import {searchMedia,importMedia,safeDownloadHost} from './media-library.mjs';

const photo='https://i.pinimg.com/originals/ab/cd/pretty.jpg';
const video='https://v1.pinimg.com/videos/mc/720p/test123.mp4';
const records=[
  {id:'123456789012345678',title:'Photo art',pinner:{username:'creator_a'},
    images:{orig:{url:photo},'474x':{url:'https://i.pinimg.com/474x/ab/cd/pretty.jpg'}}},
  {id:'123456789012345679',grid_title:'Video pin',pinner:{full_name:'Creator B'},
    images:{orig:{url:'https://i.pinimg.com/originals/bb/cc/poster.jpg'}},
    videos:{video_list:{V_720P:{url:video}}}},
  {id:'999999999999999999',title:'Malicious pin',
    images:{orig:{url:'http://127.0.0.1:3000/secrets.jpg'}}},
  {id:'bad',title:'Invalid identifier',
    images:{orig:{url:photo}}}
];
const pinterestFetcher=async(url,options={})=>{
  if(String(url).includes('/search/pins/')){
    return new Response('page',{status:200,headers:{'Set-Cookie':'csrftoken=test-csrf; Path=/'}});
  }
  if(String(url).includes('/resource/BaseSearchResource/get/')){
    const u=new URL(url);
    assert.equal(u.searchParams.get('source_url').includes('/search/pins/?q='),true);
    const params=JSON.parse(u.searchParams.get('data'));
    assert.equal(params.options.scope,'pins');
    assert.equal(params.options.page_size,25);
    assert.equal(options.headers['X-Requested-With'],'XMLHttpRequest');
    return new Response(JSON.stringify({resource_response:{data:{results:records}}}),{
      status:200,headers:{'Content-Type':'application/json'}
    });
  }
  throw Error('unexpected URL '+url);
};
test('Pinterest normalizer produces image and video cards with source and creator',()=>{
  const all=normalizePinterest(records,'all');
  assert.equal(all.length,2);
  assert.equal(all[0].kind,'image');
  assert.equal(all[0].credit,'creator_a');
  assert.equal(all[0].preview.includes('474x'),true);
  assert.equal(all[1].kind,'video');
  assert.equal(all[1].assetUrl,video);
  assert.equal(normalizePinterest(records,'video').length,1);
  assert.equal(normalizePinterest(records,'image').length,1);
  assert.match(all[0].license,/não verificada/);
});
test('Public Pinterest search queries the known search resource without login or cookies from a user',async()=>{
  const results=await searchPinterest('film clips','all',{fetcher:pinterestFetcher});
  assert.equal(results.length,2);
  assert.ok(results.every(x=>x.pageUrl.startsWith('https://www.pinterest.com/pin/')));
  assert.equal(results[1].kind,'video');
});
test('Pinterest blocked/search changed errors are user-friendly, not empty successful results',async()=>{
  await assert.rejects(searchPinterest('cinema','image',{fetcher:async()=>new Response('',{status:403})}),
    /não liberou/);
  await assert.rejects(searchPinterest('cinema','image',{fetcher:async(url)=>{
    return String(url).includes('/search/pins/')?new Response('ok'):
      new Response(JSON.stringify({wrong:true}),{status:200});
  }}),/alterou a resposta/);
});
test('Direct pinimg URLs allow only HTTPS public CDN assets',()=>{
  assert.equal(isPinMediaUrl(photo),photo);
  for(const target of ['https://pinimg.com.evil.invalid/a.png','http://i.pinimg.com/a.png',
    'https://127.0.0.1/a.png','file:///etc/passwd']){
    assert.equal(isPinMediaUrl(target),null);
  }
  assert.equal(safeDownloadHost(new URL(photo)),true);
  assert.equal(safeDownloadHost(new URL(video)),true);
  assert.equal(safeDownloadHost(new URL('https://i.pinimg.com.evil.invalid/o.jpg')),false);
});
test('Pinterest photo saves into library image folder and attribution is explicitly unknown',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-pin-test-'));
  try{
    const search=await searchMedia('art',{source:'pinterest',kind:'image',fetcher:pinterestFetcher});
    assert.equal(search.items.length,1);
    assert.equal(search.items[0].provider,'pinterest');
    assert.equal('assetUrl' in search.items[0],false);
    const got=await importMedia(search.items[0].key,{destination:temp,fetcher:async(url)=>{
      assert.equal(String(url),photo);
      return new Response(new Uint8Array([255,216,255,217]),{
        status:200,headers:{'Content-Type':'image/jpeg','Content-Length':'4'}
      });
    }});
    assert.equal(got.kind,'image');
    assert.equal(fs.existsSync(got.filePath),true);
    const sidecar=got.filePath.replace(/\.jpg$/,'.license.txt');
    assert.match(fs.readFileSync(sidecar,'utf8'),/pinterest/i);
    assert.match(fs.readFileSync(sidecar,'utf8'),/Licença não verificada/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('Pinterest video downloads the direct MP4 then uses existing local video importer',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-pin-video-test-'));
  try{
    const found=await searchMedia('edit',{source:'pinterest',kind:'video',fetcher:pinterestFetcher});
    assert.equal(found.items.length,1);
    let imported=false;
    const result=await importMedia(found.items[0].key,{
      fetcher:async(url)=>new Response(new Uint8Array([0,1,2,3]),{
        status:200,headers:{'Content-Type':'video/mp4','Content-Length':'4'}
      }),
      localImporter:async file=>{
        imported=fs.existsSync(file);
        return {key:'local-fake',path:path.join(temp,'video.mp4'),folder:temp};
      }
    });
    assert.equal(imported,true);
    assert.equal(result.kind,'video');
    assert.equal(result.cachedKey,'local-fake');
    assert.match(fs.readFileSync(path.join(temp,'source-license.txt'),'utf8'),/pinterest/i);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});


test('Follows regional Pinterest redirects, keeps guest CSRF session and searches regional endpoint',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{
    const u=new URL(url);calls.push({url:u,options});
    if(u.hostname==='www.pinterest.com'&&u.pathname==='/search/pins/')
      return new Response(null,{status:302,headers:{Location:'https://br.pinterest.com'+u.pathname+u.search,
        'Set-Cookie':'csrftoken=redirect-token; Path=/; Secure'}});
    if(u.hostname==='br.pinterest.com'&&u.pathname==='/search/pins/')
      return new Response('Pesquisa',{status:200,headers:{'Set-Cookie':'_pinterest_sess=guest; Path=/; Secure'}});
    if(u.hostname==='br.pinterest.com'&&u.pathname==='/resource/BaseSearchResource/get/'){
      assert.match(options.headers.Cookie,/csrftoken=redirect-token/);
      assert.match(options.headers.Cookie,/_pinterest_sess=guest/);
      assert.equal(options.headers['X-CSRFToken'],'redirect-token');
      assert.equal(u.searchParams.get('source_url').startsWith('/search/pins/'),true);
      return new Response(JSON.stringify({resource_response:{data:{results:records}}}),{status:200});
    }
    throw Error('Unexpected request '+url);
  };
  const results=await searchPinterest('cenas clássicas','image',{fetcher});
  assert.equal(results.length,1);
  assert.ok(calls.some(c=>c.url.hostname==='br.pinterest.com'));
  assert.ok(calls.every(c=>c.options.redirect==='manual'));
});
test('Pinterest redirects never send cookies to external or non-HTTPS sites',async()=>{
  const calls=[];
  const fetcher=async(url)=>{
    calls.push(url);
    return new Response(null,{status:302,
      headers:{Location:'https://notpinterest.example/collect?cookie=1',
        'Set-Cookie':'csrftoken=private-test; Path=/'}});
  };
  await assert.rejects(searchPinterest('cinema','image',{fetcher}),/destino externo não autorizado/);
  assert.equal(calls.length,1);
  await assert.rejects(pinterestRequest('https://www.pinterest.com/search/pins/',{
    fetcher:async()=>new Response(null,{status:302,headers:{Location:'http://www.pinterest.com/login/'}})
  }),/destino externo não autorizado/);
});
test('Pinterest detects redirects to login, broken Location and loops',async()=>{
  await assert.rejects(pinterestRequest('https://www.pinterest.com/search/pins/',{
    fetcher:async()=>new Response(null,{status:302,headers:{Location:'/login/'}})
  }),/exige login/);
  await assert.rejects(pinterestRequest('https://www.pinterest.com/search/pins/',{
    fetcher:async()=>new Response(null,{status:302})
  }),/sem destino/);
  await assert.rejects(pinterestRequest('https://www.pinterest.com/search/pins/',{
    fetcher:async()=>new Response(null,{status:302,headers:{Location:'/search/pins/'}})
  }),/ciclo de redirecionamentos/);
});
test('Pinterest retries a regional host only after network failure, then returns valid pins',async()=>{
  const calls=[];
  const results=await searchPinterest('videos','all',{fetcher:async(url)=>{
    const u=new URL(url);
    calls.push(u.hostname);
    if(u.hostname==='www.pinterest.com'){
      const error=new TypeError('fetch failed');
      error.cause=Object.assign(new Error('connect ENETUNREACH'),{code:'ENETUNREACH'});
      throw error;
    }
    if(u.pathname==='/search/pins/')return new Response('ok',{status:200});
    return new Response(JSON.stringify({resource_response:{data:{results:records}}}),{status:200});
  }});
  assert.equal(results.length,2);
  assert.deepEqual(calls,['www.pinterest.com','id.pinterest.com','id.pinterest.com']);
});
test('Pinterest network errors include actionable cause codes instead of fetch failed',async()=>{
  const error=new TypeError('fetch failed');
  error.cause=Object.assign(new Error('DNS failed'),{code:'ENOTFOUND'});
  await assert.rejects(searchPinterest('cinema','all',{fetcher:async()=>{throw error;}}),
    err=>err.message.includes('ENOTFOUND')&&err.message.includes('DNS')&&
      err.message.includes('domínio alternativo'));
  const tls=new TypeError('fetch failed');
  tls.cause=Object.assign(new Error('certificate not trusted'),{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'});
  await assert.rejects(pinterestRequest('https://www.pinterest.com/search/pins/',{
    fetcher:async()=>{throw tls;}
  }),/certificado HTTPS/);
});
