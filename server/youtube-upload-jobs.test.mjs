import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSocialDraft,listSocialDrafts} from './social-drafts.mjs';
import {startYouTubeQueue,getYouTubeJob,confirmYouTubePublished,resumeYouTubeJob,
  cancelYouTubeJob,readYouTubeResults} from './youtube-upload-jobs.mjs';
import {YouTubeLoginRequired,normalizeYouTubeVideoUrl} from './youtube-studio-crawler.mjs';

const mp4=Buffer.from([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0]);
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82]);
const config={browser:'chrome',urls:{youtube:'https://studio.youtube.com/'},
  confirmed:{youtube:true,instagram:false,tiktok:false}};
const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-yt-crawler-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=(name,data)=>{const p=path.join(root,name);fs.writeFileSync(p,data);return {path:p,originalname:name};};
  const video=file('a.mp4',mp4),image=file('a.png',png);
  const saved=path.join(root,'drafts');
  const create=(title,platforms)=>createSocialDraft({root:saved,body:{
    kind:'short',titleA:title,platforms:JSON.stringify(platforms),scheduledAt:'2026-11-01T12:00'},
    files:{video:[video],coverA:[image]},confirmed:{youtube:true,instagram:true,tiktok:true}});
  return {root:saved,create,results:path.join(root,'results.json')};
};
const until=async fn=>{
  for(let i=0;i<80;i++){const result=fn();if(result)return result;await new Promise(r=>setTimeout(r,20));}
  throw Error('Timeout esperando evento do crawler');
};
test('somente URLs oficiais de vídeo são aceitas como resultado',()=>{
  const base='https://www.youtube.com/watch?v=ABCdef12345';
  assert.equal(normalizeYouTubeVideoUrl(base),base);
  assert.equal(normalizeYouTubeVideoUrl('https://youtu.be/ABCdef12345'),base);
  assert.equal(normalizeYouTubeVideoUrl('https://www.youtube.com/shorts/ABCdef12345'),base);
  for(const bad of ['https://youtube.com.evil.test/watch?v=ABCdef12345',
    'http://www.youtube.com/watch?v=ABCdef12345','javascript:alert(1)',
    'https://www.youtube.com/watch?v=bad','https://evil.test/watch?v=ABCdef12345'])
    assert.equal(normalizeYouTubeVideoUrl(bad),null);
});
test('fila executa YouTube vídeo por vídeo e só prossegue após confirmação manual',async t=>{
  const f=fixture(t);
  const first=f.create('Um primeiro Short',['youtube']);
  const second=f.create('Outro Short',['youtube','tiktok']);
  const other=f.create('Apenas Instagram',['instagram']);
  const list=listSocialDrafts(f.root),visits=[],windows=[];
  const adapters={
    open:async ({url})=>{windows.push(url);return {close:()=>{}};},
    upload:async (_browser,draft,files)=>{
      visits.push(draft.titleA);
      assert.ok(fs.existsSync(files.videoPath));
      assert.ok(fs.existsSync(files.coverAPath));
      return {warnings:['Conferir IA e promoção paga'],videoUrl:null};
    }
  };
  const job=startYouTubeQueue([other.id,second.id,first.id],{config,drafts:list,root:f.root,adapters});
  assert.equal(job.total,2);
  await until(()=>getYouTubeJob(job.id).status==='awaiting_review');
  assert.deepEqual(visits,['Um primeiro Short']);
  assert.equal(getYouTubeJob(job.id).completed.length,0);
  assert.throws(()=>confirmYouTubePublished(job.id,{videoUrl:'http://evil.test'}),/link real/);
  assert.throws(()=>startYouTubeQueue([first.id],{config,drafts:list,root:f.root,adapters}),/andamento/);
  confirmYouTubePublished(job.id,{videoUrl:'https://youtu.be/ABCdef12345',resultsFile:f.results});
  await until(()=>getYouTubeJob(job.id).status==='awaiting_review'&&getYouTubeJob(job.id).index===1);
  assert.deepEqual(visits,['Um primeiro Short','Outro Short']);
  assert.equal(windows.length,1,'mesma janela para toda a fila');
  assert.equal(readYouTubeResults(f.results)[first.id].url,'https://www.youtube.com/watch?v=ABCdef12345');
  confirmYouTubePublished(job.id,{videoUrl:'https://www.youtube.com/watch?v=ZYXwvu98765',resultsFile:f.results});
  await until(()=>getYouTubeJob(job.id).status==='done');
  assert.equal(getYouTubeJob(job.id).completed.length,2);
  assert.equal(readYouTubeResults(f.results)[second.id].url,'https://www.youtube.com/watch?v=ZYXwvu98765');
});
test('login na janela visível pausa o envio sem duplicar o próximo vídeo',async t=>{
  const f=fixture(t),item=f.create('Login obrigatório',['youtube']);
  let called=0;
  const job=startYouTubeQueue([item.id],{config,drafts:listSocialDrafts(f.root),root:f.root,adapters:{
    open:async()=>({close:()=>{}}),
    upload:async()=>{if(++called===1)throw new YouTubeLoginRequired();return {warnings:[],videoUrl:null};}
  }});
  await until(()=>getYouTubeJob(job.id).status==='awaiting_login');
  await resumeYouTubeJob(job.id);
  await until(()=>getYouTubeJob(job.id).status==='awaiting_review');
  assert.equal(called,2);
  const cancelled=cancelYouTubeJob(job.id);
  assert.equal(cancelled.status,'cancelled');
});
