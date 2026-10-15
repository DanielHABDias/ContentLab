import test from 'node:test';
import assert from 'node:assert/strict';
import {readMetrics,clearMetricsCache} from './social-metrics.mjs';
import {mountSocialMetricsRoutes} from './social-metrics-routes.mjs';

const later=()=>new Date(Date.now()+86400000).toISOString();
const recent=()=>new Date(Date.now()-3600000).toISOString();
const reply=data=>({ok:true,status:200,json:async()=>data});
test('YouTube aggregates only public videos, and exposes actual scheduled uploads',async()=>{
  clearMetricsCache();
  const requests=[];
  const fetcher=async(url)=>{
    requests.push(String(url));
    if(String(url).includes('/channels?'))return reply({items:[{
      snippet:{title:'Diazverso'},statistics:{subscriberCount:'123'},
      contentDetails:{relatedPlaylists:{uploads:'UP-1'}}}]});
    if(String(url).includes('/playlistItems?'))return reply({items:[
      {contentDetails:{videoId:'a'}},{contentDetails:{videoId:'b'}}]});
    if(String(url).includes('/videos?'))return reply({items:[
      {id:'a',snippet:{title:'Último vídeo #Shorts',publishedAt:recent()},
       status:{privacyStatus:'public'},statistics:{viewCount:'120',likeCount:'10',commentCount:'3'}},
      {id:'b',snippet:{title:'Agendado amanhã',publishedAt:recent()},
       status:{privacyStatus:'private',publishAt:later()},statistics:{viewCount:'0'}}
    ]});
    throw Error('URL inesperada');
  };
  const data=await readMetrics('youtube',{fetcher,tokenGetter:async()=> 'fixture-token',useCache:false});
  assert.equal(data.latest.title,'Último vídeo #Shorts');
  assert.equal(data.totalViews,120);
  assert.equal(data.scheduledCount,1);
  assert.equal(data.scheduled[0].title,'Agendado amanhã');
  assert.equal(data.channel.subscribers,123);
  const n=requests.length;
  await readMetrics('youtube',{fetcher,tokenGetter:async()=> 'fixture-token'});
  assert.equal(requests.length,n,'Deve usar cache recente');
});
test('Instagram retrieves video summaries, optionally views, no invented schedule',async()=>{
  clearMetricsCache();
  const fetcher=async(url)=>{
    const u=String(url);
    if(u.includes('me?'))return reply({id:'123',username:'diazversoyt',followers_count:88});
    if(u.includes('/me/media?'))return reply({data:[
      {id:'video-1',media_type:'VIDEO',caption:'Reels de hoje',
       timestamp:recent(),permalink:'https://www.instagram.com/reel/abc/',
       like_count:35,comments_count:7},
      {id:'image-1',media_type:'IMAGE',timestamp:recent()}]});
    if(u.includes('/insights?'))return reply({data:[{name:'views',values:[{value:456}]}]});
    throw Error('URL não esperada: '+u);
  };
  const data=await readMetrics('instagram',{fetcher,tokenGetter:async()=> 'ig-token',useCache:false});
  assert.equal(data.latest.views,456);
  assert.equal(data.latest.likes,35);
  assert.equal(data.sampleSize,1);
  assert.equal(data.scheduledCount,0);
});
test('Instagram degrades gracefully when views are unavailable',async()=>{
  clearMetricsCache();
  const fetcher=async(url)=>{
    const u=String(url);
    if(u.includes('me?'))return reply({username:'canal'});
    if(u.includes('me/media?'))return reply({data:[{
      id:'1',media_type:'VIDEO',timestamp:recent(),caption:'Vídeo'}]});
    return {ok:false,status:403,json:async()=>({error:{message:'no permission'}})};
  };
  const data=await readMetrics('instagram',{fetcher,tokenGetter:async()=> 'ig-token2',useCache:false});
  assert.equal(data.latest.views,null);
  assert.equal(data.totalViews,null);
});
test('TikTok public videos include views, likes and shares from Display API',async()=>{
  clearMetricsCache();
  const data=await readMetrics('tiktok',{fetcher:async(url,options)=>{
    assert.equal(options.method,'POST');
    assert.equal(new URL(url).searchParams.get('fields').includes('view_count'),true);
    return reply({error:{code:'ok'},data:{videos:[
      {id:'t-1',title:'Test TikTok',create_time:Math.floor(Date.now()/1000),
       view_count:800,like_count:60,comment_count:10,share_count:5,
       share_url:'https://www.tiktok.com/@channel/video/123'}]}});
  },tokenGetter:async()=> 'tt-token',useCache:false});
  assert.equal(data.latest.views,800);
  assert.equal(data.latest.shares,5);
  assert.equal(data.scheduledCount,0);
});
test('API gate never fetches networks when disconnected; isolates provider errors',async()=>{
  let handler;
  const app={get:(route,fn)=>{assert.equal(route,'/api/social/metrics');handler=fn;}};
  let calls=[];
  mountSocialMetricsRoutes(app,fn=>fn,{
    statusGetter:()=>({
      youtube:{connected:false,needsRenewal:false,configured:false},
      instagram:{connected:false,needsRenewal:false,configured:false},
      tiktok:{connected:false,needsRenewal:false,configured:false}
    }),
    reader:async(name)=>{calls.push(name);throw Error('must not fetch');}
  });
  let result;
  const fakeRes=()=>({
    set(){return this;},
    json(data){result=data;return this;},
    status(){return this;}
  });
  await handler({query:{}},fakeRes());
  assert.deepEqual(calls,[]);
  assert.equal(result.connected.youtube.connected,false);
  assert.deepEqual(result.platforms,{});
  mountSocialMetricsRoutes({get:(route,fn)=>{handler=fn;}},fn=>fn,{
    statusGetter:()=>({youtube:{connected:true},instagram:{connected:true},tiktok:{connected:false}}),
    reader:async(name)=>{calls.push(name);if(name==='instagram')throw Error('Sem permissão');
      return {platform:'youtube',recent:[]};}
  });
  await handler({query:{platform:'general',refresh:'1'}},fakeRes());
  assert.equal(result.platforms.youtube.status,'ok');
  assert.equal(result.platforms.instagram.status,'error');
  assert.equal(result.platforms.tiktok,undefined);
  assert.ok(!JSON.stringify(result).includes('fixture-token'));
});
