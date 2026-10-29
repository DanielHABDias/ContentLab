import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSocialDraft,listSocialDrafts} from './social-drafts.mjs';
import {buildSocialTasks,startSocialPipeline,getSocialPipeline,resumeSocialPipeline,
  confirmSocialPipeline,cancelSocialPipeline,readSocialPipelineResults} from './social-pipeline-jobs.mjs';
import {socialCaption,normalizeSocialPostUrl,validateScheduleWindow,scheduleParts} from './social-platform-crawlers.mjs';
import {validateStudioUrl,StudioLoginRequired,StudioChanged} from './social-studio-browser.mjs';
const mp4=Buffer.from([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0]);
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82]);
const confirmed={youtube:true,tiktok:true,instagram:true};
const urls={youtube:'https://studio.youtube.com/',tiktok:'https://www.tiktok.com/tiktokstudio/upload?from=creator_center&tab=video',
  instagram:'https://www.instagram.com/scheduled_content/'};
const config={browser:'chrome',confirmed,urls};
function fixture(t){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-social-pipeline-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const file=(name,bytes)=>{
    const filepath=path.join(temp,name);fs.writeFileSync(filepath,bytes);
    return {path:filepath,originalname:name};
  };
  const video=file('video.mp4',mp4),cover=file('cover.png',png);
  const root=path.join(temp,'drafts'),resultsFile=path.join(temp,'results.json');
  const create=(title,platforms)=>createSocialDraft({root,
    body:{kind:'short',titleA:title,description:'Descrição '+title,tags:'um,dois',
      platforms:JSON.stringify(platforms),scheduledAt:'2026-11-06T12:00'},
    files:{video:[video],coverA:[cover]},confirmed});
  return {root,resultsFile,create};
}
async function until(fn){
  for(let n=0;n<150;n++){const result=fn();if(result)return result;
    await new Promise(resolve=>setTimeout(resolve,20));}
  throw Error('Timeout em teste de fila');
}
test('legenda combina título, descrição e hashtags, respeitando limite da plataforma',()=>{
  const caption=socialCaption({titleA:'Filme A',description:'Uma análise',
    tags:['nerd','cultura pop']},'tiktok');
  assert.equal(caption,'Filme A\n\nLink do canal na bio\n\nUma análise');
  assert.equal(socialCaption({titleA:'Olá',tags:[]},'instagram'),'Olá\n\nLink do canal na bio');
  assert.equal(socialCaption({titleA:'x'.repeat(2201)},'instagram').length,2200);
});
test('links TikTok e Instagram validados por host HTTPS e formato real de postagem',()=>{
  assert.equal(normalizeSocialPostUrl('tiktok','https://www.tiktok.com/@diazverso/video/7312345678901234567'),
    'https://www.tiktok.com/@diazverso/video/7312345678901234567/');
  assert.equal(normalizeSocialPostUrl('instagram','https://www.instagram.com/reel/AbCdEf1234/?igsh=abc'),
    'https://www.instagram.com/reel/AbCdEf1234/');
  for(const bad of ['https://evil.instagram.com/reel/AbCdEf1234',
    'http://www.instagram.com/reel/AbCdEf1234/','https://www.instagram.com/accounts/login/'])
    assert.equal(normalizeSocialPostUrl('instagram',bad),null);
  for(const bad of ['https://www.tiktok.com/login',
    'https://tiktok.com.evil.test/@someone/video/7312345678901234567'])
    assert.equal(normalizeSocialPostUrl('tiktok',bad),null);
  assert.throws(()=>validateStudioUrl('instagram','https://www.instagram.com.evil.test/'),/oficial/);
  assert.equal(validateStudioUrl('tiktok',urls.tiktok),urls.tiktok);
});
test('TikTok avisa sobre janela de agendamento e Instagram usa fluxo próprio',()=>{
  const now=new Date('2026-10-29T12:00:00');
  assert.match(validateScheduleWindow('tiktok','2026-12-01T12:00',now),/10 dias/);
  assert.equal(validateScheduleWindow('tiktok','2026-11-02T12:00',now),null);
  assert.equal(validateScheduleWindow('instagram','2026-11-02T12:00',now),null);
  assert.deepEqual(scheduleParts('2026-11-02T12:35'),{date:'2026-11-02',time:'12:35'});
  assert.equal(scheduleParts('02/11/2026 12:35'),null);
});
test('fila preserva ordem vídeo por vídeo, alternando redes do mesmo vídeo',async t=>{
  const f=fixture(t);
  const first=f.create('Primeiro',['youtube','tiktok','instagram']);
  const second=f.create('Segundo',['youtube','instagram']);
  const last=f.create('Terceiro',['tiktok']);
  const drafts=listSocialDrafts(f.root),visits=[],opens=[];
  const session={
    tabs:['youtube','tiktok','instagram'].map((platform,i)=>({platform,index:i+1,targetId:'target-'+platform,url:urls[platform]})),
    async navigate(platform){visits.push('tab:'+platform);return {eval:()=>true};},
    close(){}
  };
  const engine=(platform)=>async (_session,video,{videoPath,coverAPath})=>{
    visits.push(platform+':'+video.titleA);
    assert.ok(fs.existsSync(videoPath));assert.ok(fs.existsSync(coverAPath));
    return {warnings:['Revise antes de publicar'],videoUrl:null};
  };
  const adapters={open:async({platforms})=>{opens.push(platforms);return session;},
    youtube:async ({cdp},video,input)=>{assert.ok(cdp);return engine('youtube')(null,video,input);},
    tiktok:engine('tiktok'),instagram:engine('instagram')};
  const start=startSocialPipeline([last.id,first.id,second.id],
    {config,drafts,root:f.root,resultsFile:f.resultsFile,adapters});
  assert.equal(start.total,6);
  await until(()=>getSocialPipeline(start.id).status==='awaiting_review');
  assert.equal(getSocialPipeline(start.id).current.title,'Primeiro');
  assert.equal(getSocialPipeline(start.id).platform,'youtube');
  assert.deepEqual(opens,[['youtube','tiktok','instagram']]);
  const steps=[
    ['youtube','https://youtu.be/ABCdef12345',false],
    ['tiktok','https://www.tiktok.com/@diazverso/video/7312345678901234567',false],
    ['instagram','https://www.instagram.com/reel/AbCdEf1234/',false],
    ['youtube','',true],['instagram','',true],['tiktok','',true]
  ];
  for(const [platform,url,scheduled] of steps){
    await until(()=>getSocialPipeline(start.id).status==='awaiting_review');
    assert.equal(getSocialPipeline(start.id).platform,platform);
    assert.throws(()=>confirmSocialPipeline(start.id,{videoUrl:'https://evil.test/reel/fake'}),
      /link|válido|plataforma/);
    confirmSocialPipeline(start.id,{videoUrl:url,scheduled});
  }
  await until(()=>getSocialPipeline(start.id).status==='done');
  const outcomes=readSocialPipelineResults(f.resultsFile);
  assert.equal(outcomes[first.id].youtube.status,'published');
  assert.equal(outcomes[first.id].tiktok.status,'published');
  assert.equal(outcomes[first.id].instagram.status,'published');
  assert.equal(outcomes[second.id].youtube.status,'scheduled');
  assert.equal(outcomes[second.id].instagram.url,null);
  assert.equal(outcomes[last.id].tiktok.status,'scheduled');
  assert.equal(getSocialPipeline(start.id).completed.length,6);
  assert.deepEqual(visits.filter(v=>!v.startsWith('tab:')),[
    'youtube:Primeiro','tiktok:Primeiro','instagram:Primeiro',
    'youtube:Segundo','instagram:Segundo','tiktok:Terceiro']);
  assert.equal(buildSocialTasks([first.id],{config,drafts,results:outcomes}).length,0,
    'rede concluída não deve gerar segundo upload');
});
test('rede desconectada bloqueia fila inteira antes do primeiro upload',t=>{
  const f=fixture(t),draft=f.create('Testar',['instagram']);
  const cfg={...config,confirmed:{...confirmed,instagram:false}};
  assert.throws(()=>startSocialPipeline([draft.id],
    {config:cfg,drafts:listSocialDrafts(f.root),root:f.root,resultsFile:f.resultsFile}),/não confirmadas/);
});
test('sessão expirada interrompe pipeline e exige reconfiguração, sem pedir login durante upload',async t=>{
  const f=fixture(t),draft=f.create('Sessão expirada',['instagram']);
  let attempts=0;
  const adapters={open:async()=>({tabs:[],close(){}}),youtube:async()=>{},tiktok:async()=>{},
    instagram:async()=>{attempts++;throw new StudioLoginRequired('Instagram');}};
  const job=startSocialPipeline([draft.id],{config,drafts:listSocialDrafts(f.root),
    resultsFile:f.resultsFile,root:f.root,adapters});
  await until(()=>getSocialPipeline(job.id).status==='needs_configuration');
  assert.match(getSocialPipeline(job.id).message,/Configurações/);
  assert.equal(attempts,1);
  await assert.rejects(()=>resumeSocialPipeline(job.id),/Configurações/);
  assert.equal(attempts,1,'pipeline não reenvia após expiração de login');
  assert.throws(()=>confirmSocialPipeline(job.id,{videoUrl:'',scheduled:false}),/Conclua o envio/);
  const result=cancelSocialPipeline(job.id);
  assert.equal(result.status,'cancelled');
  assert.deepEqual(readSocialPipelineResults(f.resultsFile),{});
});
test('falha de seletor continua exigindo revisão manual, sem confirmar postagem',async t=>{
  const f=fixture(t),draft=f.create('Novo layout',['instagram']);
  const job=startSocialPipeline([draft.id],{config,drafts:listSocialDrafts(f.root),root:f.root,
    resultsFile:f.resultsFile,adapters:{
      open:async()=>({tabs:[],close(){}}),youtube:async()=>{},tiktok:async()=>{},
      instagram:async()=>{throw new StudioChanged('Instagram','o editor de legenda');}
    }});
  await until(()=>getSocialPipeline(job.id).status==='needs_manual');
  assert.match(getSocialPipeline(job.id).message,/manualmente/);
  cancelSocialPipeline(job.id);
});

test('Instagram avança e grava agendamento automaticamente somente quando recebeu confirmação do site',async t=>{
  const f=fixture(t),draft=f.create('Reels confirmado',['instagram']);
  const cfg={...config,urls:{...urls,instagram:'https://www.instagram.com/scheduled_content/'}};
  let attempts=0;
  const job=startSocialPipeline([draft.id],{config:cfg,drafts:listSocialDrafts(f.root),
    resultsFile:f.resultsFile,root:f.root,adapters:{
      open:async()=>({tabs:[],close(){}}),youtube:async()=>{},tiktok:async()=>{},
      instagram:async()=>{attempts++;return {
        status:'scheduled',verified:true,verification:'instagram_ui',confirmationText:'Reels programado para sexta-feira',
        warnings:[],videoUrl:null
      };}
    }});
  await until(()=>getSocialPipeline(job.id).status==='done');
  const rows=readSocialPipelineResults(f.resultsFile);
  assert.equal(attempts,1);
  assert.equal(rows[draft.id].instagram.status,'scheduled');
  assert.equal(rows[draft.id].instagram.verification,'instagram_ui');
  assert.equal(rows[draft.id].instagram.scheduledAt,draft.scheduledAt);
  assert.match(rows[draft.id].instagram.confirmationText,/programado/);
  assert.equal(getSocialPipeline(job.id).completed.length,1);
  assert.equal(buildSocialTasks([draft.id],{config:cfg,drafts:listSocialDrafts(f.root),results:rows}).length,0,
    'não reenviar Reels confirmado na próxima execução');
});
test('sem confirmação do Instagram, não avançar automaticamente nem persistir resultado',async t=>{
  const f=fixture(t),draft=f.create('Reels pendente',['instagram']);
  const job=startSocialPipeline([draft.id],{config,drafts:listSocialDrafts(f.root),
    resultsFile:f.resultsFile,root:f.root,adapters:{
      open:async()=>({tabs:[],close(){}}),youtube:async()=>{},tiktok:async()=>{},
      instagram:async()=>({status:'awaiting_review',verified:false,
        warnings:['Não repetir o upload sem verificar a conta'],videoUrl:null})
    }});
  await until(()=>getSocialPipeline(job.id).status==='awaiting_review');
  assert.deepEqual(readSocialPipelineResults(f.resultsFile),{});
  assert.equal(getSocialPipeline(job.id).completed.length,0);
  assert.match(getSocialPipeline(job.id).message,/não retornou confirmação/);
  cancelSocialPipeline(job.id);
});

test('TikTok só passa adiante automaticamente com confirmação específica do site',async t=>{
  const f=fixture(t),draft=f.create('TikTok confirmado',['tiktok']);
  const job=startSocialPipeline([draft.id],{config,drafts:listSocialDrafts(f.root),
    resultsFile:f.resultsFile,root:f.root,adapters:{
      open:async()=>({tabs:[],close(){}}),youtube:async()=>{},instagram:async()=>{},
      tiktok:async()=>({status:'scheduled',verified:true,verification:'tiktok_ui',
        confirmationText:'Vídeo agendado',videoUrl:null,warnings:[]})
    }});
  await until(()=>getSocialPipeline(job.id).status==='done');
  const result=readSocialPipelineResults(f.resultsFile)[draft.id].tiktok;
  assert.equal(result.status,'scheduled');
  assert.equal(result.verification,'tiktok_ui');
  assert.equal(result.scheduledAt,draft.scheduledAt);
  assert.equal(buildSocialTasks([draft.id],{config,drafts:listSocialDrafts(f.root),
    results:readSocialPipelineResults(f.resultsFile)}).length,0);
});
test('TikTok sem confirmação não persiste resultado nem segue ao próximo vídeo',async t=>{
  const f=fixture(t),draft=f.create('TikTok pendente',['tiktok']);
  const job=startSocialPipeline([draft.id],{config,drafts:listSocialDrafts(f.root),
    resultsFile:f.resultsFile,root:f.root,adapters:{
      open:async()=>({tabs:[],close(){}}),youtube:async()=>{},instagram:async()=>{},
      tiktok:async()=>({status:'awaiting_review',verified:false,videoUrl:null,
        warnings:['Sem confirmação do agendamento']})
    }});
  await until(()=>getSocialPipeline(job.id).status==='awaiting_review');
  assert.deepEqual(readSocialPipelineResults(f.resultsFile),{});
  assert.match(getSocialPipeline(job.id).message,/não retornou confirmação/);
  cancelSocialPipeline(job.id);
});
