import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {allowedPlatforms,inspectVideo,validatePublishRequest,uploadYouTube,
  uploadInstagram,uploadTikTok,checkTikTokStatus} from './social-publish.mjs';

const fixture=()=>{const folder=fs.mkdtempSync(path.join(os.tmpdir(),'cl-pub-test-'));
  const file=path.join(folder,'clip.mp4');fs.writeFileSync(file,Buffer.from('fixture'));
  return {file,cleanup:()=>fs.rmSync(folder,{recursive:true,force:true})};};
const probe=(width,height)=>async(bin,args)=>({stdout:JSON.stringify({streams:[{width,height}]})});
const future=()=>new Date(Date.now()+86400000).toISOString();
test('aspect ratios choose platforms independent of UI',async()=>{
  const a=fixture();
  try {
    assert.deepEqual(allowedPlatforms('16:9'),['youtube','instagram']);
    assert.deepEqual(allowedPlatforms('9:16'),['youtube','instagram','tiktok']);
    assert.equal((await inspectVideo(a.file,{probe:probe(1920,1080)})).format,'16:9');
    assert.equal((await inspectVideo(a.file,{probe:probe(1080,1920)})).format,'9:16');
    await assert.rejects(inspectVideo(a.file,{probe:probe(1024,1024)}),/16:9 ou 9:16/);
    assert.throws(()=>validatePublishRequest({
      platform:'tiktok',format:'16:9',title:'Test',confirmRights:'true'
    },{format:'16:9'}),/bloqueado/);
    assert.throws(()=>validatePublishRequest({
      platform:'youtube',format:'9:16',title:'Teste',madeForKids:'false',scheduledAt:future()
    },{format:'16:9',width:1920,height:1080}),/não corresponde/);
  }finally{a.cleanup();}
});
test('YouTube schedule and captions are preserved, public upload is not immediate',async()=>{
  const a=fixture(),calls=[],id='youtube-video-test';
  try {
    const input=validatePublishRequest({platform:'youtube',format:'9:16',title:'Batman #Shorts',
      description:'Vídeo do canal #Shorts',madeForKids:'false',scheduledAt:future()},{
      format:'9:16',width:1080,height:1920});
    const fetcher=async(url,request)=>{
      calls.push({url:String(url),method:request.method,body:typeof request.body==='string'?JSON.parse(request.body):null});
      if(request.method==='POST')return {ok:true,headers:new Headers({'location':'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=mock'})};
      return {ok:true,json:async()=>({id:'youtube-video-test',status:{privacyStatus:'private'}})};
    };
    const result=await uploadYouTube(a.file,input,{fetcher,tokenGetter:async()=> 'fake'});
    assert.equal(result.state,'scheduled');
    assert.equal(result.url,'https://www.youtube.com/watch?v=youtube-video-test');
  }finally{a.cleanup();}
});
test('Instagram local resumable video uses caption and chosen frame',async()=>{
  const a=fixture(),calls=[];
  try{
    const data=validatePublishRequest({platform:'instagram',format:'16:9',title:'Marvel #Shorts',
      description:'Análise #Shorts',coverTime:3.2},{format:'16:9',width:1920,height:1080});
    const fetcher=async(url,opts)=>{
      calls.push({url:String(url),opts});
      if(String(url).endsWith('/media'))return {ok:true,json:async()=>({id:'container-1'})};
      if(String(url).includes('rupload.facebook.com'))return {ok:true,json:async()=>({success:true})};
      if(String(url).includes('fields=status_code'))return {ok:true,json:async()=>({status_code:'FINISHED'})};
      return {ok:true,json:async()=>({id:'published-1'})};
    };
    const result=await uploadInstagram(a.file,data,{
      fetcher,tokenGetter:async()=> 'fake',accountId:'123456',wait:async()=>{}});
    assert.equal(result.id,'published-1');
    assert.match(calls[0].opts.body.toString(),/thumb_offset=3200/);
    assert.match(calls[0].opts.body.toString(),/Marvel/);
    assert.match(calls[0].opts.body.toString(),/%23Viral/);
  }finally{a.cleanup();}
});
test('TikTok requires approved privacy level and user consent, returns processing state',async()=>{
  const a=fixture(),calls=[];
  try{
    const data=validatePublishRequest({platform:'tiktok',format:'9:16',title:'Batman #Shorts',
      description:'DC #Shorts',coverTime:2,confirmRights:'true',privacyLevel:'SELF_ONLY'},
      {format:'9:16',width:1080,height:1920});
    const fetcher=async(url,opts)=>{
      calls.push({url:String(url),opts});
      if(opts.method==='POST')return {ok:true,json:async()=>({error:{code:'ok'},data:{
        publish_id:'publish-123',upload_url:'https://open-upload.tiktokapis.com/video/?upload_id=123'}})};
      return {ok:true,status:201};
    };
    const result=await uploadTikTok(a.file,data,{
      fetcher,tokenGetter:async()=> 'fake',infoGetter:async()=>({privacyOptions:['SELF_ONLY']})});
    assert.equal(result.state,'processing');
    assert.match(calls[0].opts.body,/"video_cover_timestamp_ms":2000/);
    assert.match(calls[0].opts.body,/Batman #Viral/);
    assert.equal(calls[1].opts.headers['Content-Range'],'bytes 0-6/7');
    await assert.rejects(uploadTikTok(a.file,{...data,privacyLevel:'PUBLIC_TO_EVERYONE'},
      {fetcher,tokenGetter:async()=> 'fake',infoGetter:async()=>({privacyOptions:['SELF_ONLY']})}),/Privacidade/);
  }finally{a.cleanup();}
});
test('TikTok status remains separate from upload acceptance',async()=>{
 const result=await checkTikTokStatus('publish-123',{tokenGetter:async()=> 'fake',
   fetcher:async()=>({ok:true,json:async()=>({data:{status:'PUBLISH_COMPLETE',publicaly_available_post_id:['22']},error:{code:'ok'}})})});
 assert.equal(result.state,'PUBLISH_COMPLETE');
});
