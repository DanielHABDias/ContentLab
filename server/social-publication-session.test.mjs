import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {preparePublicationSession,readPublicationSession,publicationLaunchCommand} from './social-publication-session.mjs';

const urls={youtube:'https://studio.youtube.com/',tiktok:'https://www.tiktok.com/tiktokstudio',instagram:'https://www.instagram.com/'};
const config={browser:'chrome',confirmed:{youtube:true,tiktok:true,instagram:true},urls};
const drafts=[{id:'draft-1',kind:'short',titleA:'Primeiro',scheduledAt:'2026-11-10T12:00',
  platforms:['youtube','tiktok','instagram']},{id:'draft-2',kind:'long',titleA:'Segundo',
  scheduledAt:'2026-11-11T17:00',platforms:['youtube','instagram']}];
test('Apenas abrir redes reutiliza sessão do crawler e identifica as abas CDP reais',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cl-shared-session-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'session.json');
  const calls=[];
  const openSession=async opts=>{
    calls.push(opts);
    return {browser:'chrome',tabs:opts.platforms.map((platform,i)=>({
      platform,index:i+1,url:urls[platform],targetId:'CDP-'+platform
    })),close:()=>calls.push('closed')};
  };
  const session=await preparePublicationSession(['draft-2','draft-1'],
    {config,drafts,sessionFile:file,openSession});
  assert.deepEqual(calls[0].platforms,['youtube','tiktok','instagram']);
  assert.equal(calls[0].config.browser,'chrome');
  assert.equal(calls.at(-1),'closed');
  assert.equal(session.profile,'social-studio-profile');
  assert.deepEqual(session.tabs.map(x=>[x.index,x.platform,x.targetId]),[
    [1,'youtube','CDP-youtube'],[2,'tiktok','CDP-tiktok'],[3,'instagram','CDP-instagram']]);
  assert.deepEqual(session.videos[0].destinations.map(d=>[d.platform,d.targetId]),[
    ['youtube','CDP-youtube'],['instagram','CDP-instagram']]);
  assert.equal(readPublicationSession(file).id,session.id);
});
test('Só abre contas confirmadas e bloqueia rascunhos com redes desligadas',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cl-shared-subset-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const config2={...config,confirmed:{youtube:true,tiktok:false,instagram:true}},calls=[];
  const options={config:config2,drafts,sessionFile:path.join(dir,'session.json'),
    openSession:async ({platforms})=>{
      calls.push(platforms);
      return {browser:'chrome',tabs:platforms.map((platform,index)=>({
        platform,index:index+1,targetId:'id-'+platform,url:urls[platform]
      })),close(){}};
    }};
  await assert.rejects(()=>preparePublicationSession(['draft-1'],options),/não confirmada/);
  const result=await preparePublicationSession(['draft-2'],options);
  assert.deepEqual(calls,[['youtube','instagram']]);
  assert.deepEqual(result.videos[0].destinations.map(d=>d.tab),[1,2]);
  await assert.rejects(()=>preparePublicationSession(['deleted'],options),/não foi encontrado/);
});
test('O comando Chromium usa nova janela no perfil local e não abre Firefox via CDP',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cl-command-'));
  try{
    const bin=path.join(dir,'google-chrome');
    fs.writeFileSync(bin,'test');
    const env={...process.env,PATH:dir};
    const cmd=publicationLaunchCommand('chrome',[urls.youtube],{platform:'linux',env});
    assert.deepEqual(cmd.args,['--new-window',urls.youtube]);
    assert.equal(cmd.browser,'chrome');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
