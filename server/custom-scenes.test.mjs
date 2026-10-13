import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assetReport,compileScene,validatePlan} from './plan.mjs';
import {customSceneSourceFingerprint,stageCustomScene} from './custom-scenes.mjs';
import {sceneFingerprint} from './cache.mjs';

const setup=()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-custom-test-'));
  fs.mkdirSync(path.join(dir,'custom-scenes'),{recursive:true});
  fs.mkdirSync(path.join(dir,'assets'),{recursive:true});
  fs.mkdirSync(path.join(dir,'audio'),{recursive:true});
  fs.writeFileSync(path.join(dir,'custom-scenes','Motion.tsx'),
    "import React from 'react'; export default function Motion(){return <div>OK</div>;}\n");
  fs.writeFileSync(path.join(dir,'assets','icon.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(dir,'audio','narration.wav'),'dummy-audio');
  const plan={
    project:{name:'Custom example',format:'youtube_short',profile:'generic'},
    audio:{narration:'audio/narration.wav'},
    timeline:[{id:'motion',start:0,end:3,layout:'fullscreen',background:{color:'#000'},
      elements:[],
      customComponent:{module:'project://custom-scenes/Motion.tsx',mode:'replace',
        props:{title:'hello'},assets:{icon:'project://assets/icon.svg'}}}]
  };
  return {dir,plan};
};

test('custom TSX scene passes schema and tracks source+named assets',()=>{
  const {dir,plan}=setup();
  try{
    assert.deepEqual(validatePlan(plan),[]);
    const r=assetReport(plan,dir);
    assert.equal(r.valid,true,JSON.stringify(r.errors));
    const scene=compileScene(plan.timeline[0],plan,r.resolvedAssets);
    assert.equal(scene.customComponent.module_path,path.join(dir,'custom-scenes','Motion.tsx'));
    assert.equal(scene.customComponent.assetPaths.icon,path.join(dir,'assets','icon.svg'));
    const frameKey=()=>sceneFingerprint(plan.timeline[0],scene,{width:1080,height:1920,fps:30,seed:0},
      r.resolvedAssets,[],'engine');
    const before=frameKey();
    fs.writeFileSync(scene.customComponent.module_path,
      "import React from 'react'; export default function Motion(){return <div>CHANGED</div>;}\n");
    assert.notEqual(frameKey(),before,'TSX modification must invalidate cached frame');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('custom modules are limited to project custom-scenes and require explicit opt-in',()=>{
  const {dir,plan}=setup();
  const renderer=path.resolve('backend/remotion');
  try{
    plan.timeline[0].customComponent.module='project://assets/test.tsx';
    assert.ok(validatePlan(plan).some(x=>x.path.includes('customComponent.module')));
    plan.timeline[0].customComponent.module='project://custom-scenes/Motion.tsx';
    const module_path=path.join(dir,'custom-scenes','Motion.tsx');
    const old=process.env.CONTENTLAB_TRUST_CUSTOM_TSX;
    delete process.env.CONTENTLAB_TRUST_CUSTOM_TSX;
    assert.throws(()=>stageCustomScene({module_path},renderer),/desativado/);
    process.env.CONTENTLAB_TRUST_CUSTOM_TSX='1';
    let staged;
    try{
      staged=stageCustomScene({module_path},renderer);
      assert.ok(fs.existsSync(staged.entry));
      const root=fs.readFileSync(staged.entry,'utf8');
      assert.match(root,/registerRoot\(Root\)/);
      assert.match(root,/import UserScene/);
      assert.match(root,/config.mode==='overlay'/);
    }finally{
      if(staged)fs.rmSync(staged.directory,{recursive:true,force:true});
      if(old===undefined)delete process.env.CONTENTLAB_TRUST_CUSTOM_TSX;
      else process.env.CONTENTLAB_TRUST_CUSTOM_TSX=old;
    }
    assert.ok(customSceneSourceFingerprint(module_path).length>=1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('custom source tree rejects symlinks, even when main TSX is safe',()=>{
  const {dir}=setup();
  try{
    const target=path.join(dir,'custom-scenes','Motion.tsx');
    fs.symlinkSync(target,path.join(dir,'custom-scenes','shortcut.tsx'));
    assert.throws(()=>customSceneSourceFingerprint(target),/Links simbólicos/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
