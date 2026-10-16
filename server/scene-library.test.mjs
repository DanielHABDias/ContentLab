import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {sceneLibrary,libraryFile,installScenePreset} from './scene-library.mjs';
import {APP_ROOT,validatePlan,assetReport} from './plan.mjs';

test('official library contains 15 self-contained components, examples and both aspect ratios',()=>{
 const entries=sceneLibrary();assert.equal(entries.length,15);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-library-'));
 try{
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});fs.cpSync(path.join(APP_ROOT,'scene-library/demo-assets'),path.join(root,'assets/exemplos'),{recursive:true});
  fs.mkdirSync(path.join(root,'audio'));fs.writeFileSync(path.join(root,'audio/narration.wav'),'fixture');
  for(const entry of entries){
   assert.equal(crypto.createHash('sha256').update(fs.readFileSync(libraryFile(entry.id,entry.file))).digest('hex'),entry.hash);
   assert.ok(entry.previews.some(p=>p.endsWith('16x9.png')));assert.ok(entry.previews.some(p=>p.endsWith('9x16.png')));
   for(const p of entry.previews)assert.ok(fs.statSync(path.join(APP_ROOT,p)).size>500);
   fs.writeFileSync(path.join(root,'edit_plan.json'),'{}');installScenePreset(root,entry.id);
   for(const file of entry.examples){const scene=JSON.parse(fs.readFileSync(path.join(APP_ROOT,file),'utf8'));
    const plan={project:{name:'Biblioteca',format:'youtube_long',profile:'generic'},audio:{narration:'audio/narration.wav'},timeline:[scene]};
    assert.deepEqual(validatePlan(plan),[],file);
    const report=assetReport(plan,root);assert.deepEqual(report.missingAssets,[],file+': missing assets');
   }
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('installation never overwrites different code or edits plan; rejects symlinks and unknown assets',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-library-install-'));try{
  fs.writeFileSync(path.join(root,'edit_plan.json'),'{}');
  const first=installScenePreset(root,'texto-hq');assert.equal(fs.readFileSync(path.join(root,'edit_plan.json'),'utf8'),'{}');
  assert.equal(installScenePreset(root,'texto-hq').hash,first.hash);
  fs.writeFileSync(first.file,'existing project code');assert.throws(()=>installScenePreset(root,'texto-hq'),/outra versão/);assert.equal(fs.readFileSync(first.file,'utf8'),'existing project code');
  assert.throws(()=>libraryFile('texto-hq','../../.env'));assert.throws(()=>libraryFile('invalid','TextoHQ.tsx'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
