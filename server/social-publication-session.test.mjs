import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {preparePublicationSession,readPublicationSession,publicationLaunchCommand} from './social-publication-session.mjs';

const urls={youtube:'https://studio.youtube.com/',tiktok:'https://www.tiktok.com/tiktokstudio',instagram:'https://www.instagram.com/'};
const config={browser:'chrome',confirmed:{youtube:true,tiktok:true,instagram:true},urls};
const drafts=[{id:'draft-1',kind:'short',titleA:'Primeiro vídeo',scheduledAt:'2026-11-10T12:00',
  platforms:['youtube','tiktok','instagram']},{id:'draft-2',kind:'long',titleA:'Segundo vídeo',
  scheduledAt:'2026-11-11T17:00',platforms:['youtube','instagram']}];
test('sessão abre navegador visível uma vez e preserva mapa lógico de abas por vídeo',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-session-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'session.json'),launches=[];
  const launch=(command,args,options)=>{
    launches.push({command,args,options});
    const child=new EventEmitter();child.unref=()=>{};
    queueMicrotask(()=>child.emit('spawn'));return child;
  };
  const buildCommand=(browser,values)=>{
    assert.equal(browser,'chrome');
    assert.deepEqual(values,[urls.youtube,urls.tiktok,urls.instagram]);
    return {command:'/fake/chrome',args:['--new-window',...values],browser:'chrome'};
  };
  const session=await preparePublicationSession(['draft-2','draft-1'],{
    config,drafts,sessionFile:file,launch,buildCommand});
  assert.equal(launches.length,1,'abrir todas as URLs em um único lançamento');
  assert.equal(launches[0].options.windowsHide,false);
  assert.equal(launches[0].options.shell,false);
  assert.deepEqual(session.tabs.map(x=>[x.index,x.platform]),[
    [1,'youtube'],[2,'tiktok'],[3,'instagram']]);
  assert.deepEqual(session.videos[0].destinations.map(x=>x.tab),[1,3]);
  assert.deepEqual(session.videos[1].destinations.map(x=>x.tab),[1,2,3]);
  assert.equal(session.status,'prepared');
  assert.equal(readPublicationSession(file).id,session.id);
});
test('só abre contas confirmadas e recusa destinos desligados e rascunhos desconhecidos',async()=>{
  const subset={...config,confirmed:{youtube:true,tiktok:false,instagram:true}};
  const commands=[];
  const launch=(cmd,args)=>{
    commands.push({cmd,args});
    const child=new EventEmitter();child.unref=()=>{};
    queueMicrotask(()=>child.emit('spawn'));return child;
  };
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-session-limited-'));
  try{
    const options={config:subset,drafts,sessionFile:path.join(dir,'session.json'),
      launch,buildCommand:(_browser,values)=>{
        assert.deepEqual(values,[urls.youtube,urls.instagram]);
        return {command:'/fake/chrome',args:values,browser:'chrome'};
      }};
    await assert.rejects(()=>preparePublicationSession(['draft-1'],options),/não confirmada/);
    const session=await preparePublicationSession(['draft-2'],options);
    assert.deepEqual(session.tabs.map(x=>x.platform),['youtube','instagram']);
    assert.deepEqual(session.videos[0].destinations.map(x=>x.tab),[1,2]);
    await assert.rejects(()=>preparePublicationSession(['deleted-id'],options),/não foi encontrado/);
    assert.equal(commands.length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('comando gráfico Chrome usa uma janela nova e Firefox usa uma aba por URL',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-browser-'));
  try{
    const bin=path.join(dir,'firefox');
    fs.writeFileSync(bin,'fixture');
    const chrome=path.join(dir,'google-chrome');
    fs.writeFileSync(chrome,'fixture');
    const env={...process.env,PATH:dir};
    const c=publicationLaunchCommand('chrome',[urls.youtube,urls.instagram],{platform:'linux',env});
    assert.deepEqual(c.args,['--new-window',urls.youtube,urls.instagram]);
    const f=publicationLaunchCommand('firefox',[urls.youtube,urls.instagram],{platform:'linux',env});
    assert.deepEqual(f.args,['-new-window',urls.youtube,'-new-tab',urls.instagram]);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
