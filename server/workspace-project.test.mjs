import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import {inspectWorkspace,projectAssetDirectory,readThumbnailProject,saveThumbnailFile,mountWorkspaceRoutes} from './workspace-project.mjs';
import {takeList} from './narration-assembly.mjs';
import {run} from './exec.mjs';
const draft=name=>Buffer.from(JSON.stringify({version:1,name,base:{center:{},title:{}},background:{},media:{},variants:[]}));
test('universal project accepts empty folders and safely groups assets without an edit plan',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-empty-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  let info=await inspectWorkspace(root);assert.equal(info.hasEditPlan,false);assert.equal(info.takeCount,0);
  const folder=projectAssetDirectory(root,'Batman: A Piada Mórtal','video');
  assert.equal(folder,path.join(root,'assets','batman-a-piada-mortal','clips'));
  fs.writeFileSync(path.join(folder,'cena.mp4'),'fixture');
  info=await inspectWorkspace(root);assert.ok(info.assets.includes('assets/batman-a-piada-mortal/clips/cena.mp4'));
  assert.equal(fs.existsSync(path.join(root,'edit_plan.json')),false);
  if(process.platform!=='win32'){
    fs.symlinkSync(os.tmpdir(),path.join(root,'assets','externo'));
    assert.throws(()=>projectAssetDirectory(root,'externo','audio'),/simbólico/);
  }
});
test('thumbnail drafts isolate projects, reject stale overwrites and export unique names',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-thumbs-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const a=path.join(root,'a'),b=path.join(root,'b');fs.mkdirSync(a);fs.mkdirSync(b);
  const first=saveThumbnailFile(a,{bytes:draft('Primeiro'),draft:true});
  assert.equal(readThumbnailProject(a).state.name,'Primeiro');assert.equal(readThumbnailProject(b).state,null);
  assert.throws(()=>saveThumbnailFile(a,{bytes:draft('Stale'),draft:true}),/alterada/);
  saveThumbnailFile(a,{bytes:draft('Atualizado'),draft:true,expectedRevision:first.revision});
  assert.equal(readThumbnailProject(a).state.name,'Atualizado');
  const one=saveThumbnailFile(a,{name:'Capa.JPG',bytes:Buffer.from('jpeg-test')});
  const two=saveThumbnailFile(a,{name:'Capa.JPG',bytes:Buffer.from('other')});assert.notEqual(one.relative,two.relative);
  assert.equal(fs.readFileSync(path.join(a,one.relative),'utf8'),'jpeg-test');
  assert.throws(()=>saveThumbnailFile(a,{name:'../outside.json',bytes:Buffer.from('{}')}),/inválido/);
});
test('reload discovers persisted raw takes and removes externally missing entries without touching audio',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-takes-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  await inspectWorkspace(root);const name='recording-'+crypto.randomUUID()+'.wav',file=path.join(root,'audio','takes',name);
  await run('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=duration=0.2',file]);
  assert.equal(takeList(root).takes.length,0);
  const info=await inspectWorkspace(root,{reload:true});assert.equal(info.takeCount,1);assert.ok(fs.existsSync(file));
  fs.unlinkSync(file);assert.equal((await inspectWorkspace(root,{reload:true})).takeCount,0);
});
test('workspace HTTP protects origin and creates edit plan only on explicit request',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-http-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const app=express();app.use(express.json());mountWorkspaceRoutes(app,fn=>async(req,res)=>{try{await fn(req,res);}catch(error){res.status(400).json({error:error.message});}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});
  const base='http://127.0.0.1:'+server.address().port;
  const post=(url,data,headers={})=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  assert.equal((await post('/api/workspace/project',{projectRoot:root},{Origin:'https://other.example'})).status,403);
  const selected=await post('/api/workspace/project',{projectRoot:root,reload:true});assert.equal(selected.status,200);assert.equal((await selected.json()).hasEditPlan,false);
  assert.equal((await post('/api/workspace/edit-plan',{projectRoot:root})).status,201);
  assert.equal((await post('/api/workspace/edit-plan',{projectRoot:root})).status,400);
  assert.equal((await inspectWorkspace(root)).hasEditPlan,true);
});
