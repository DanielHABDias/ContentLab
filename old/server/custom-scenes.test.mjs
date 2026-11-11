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

test('custom modules work without environment configuration and stay under custom-scenes',()=>{
  const {dir,plan}=setup();
  const renderer=path.resolve('backend/remotion');
  const previous=process.env.CONTENTLAB_TRUST_CUSTOM_TSX;
  delete process.env.CONTENTLAB_TRUST_CUSTOM_TSX;
  try{
    plan.timeline[0].customComponent.module='project://assets/test.tsx';
    assert.ok(validatePlan(plan).some(x=>x.path.includes('customComponent.module')));
    plan.timeline[0].customComponent.module='project://custom-scenes/Motion.tsx';
    const module_path=path.join(dir,'custom-scenes','Motion.tsx');
    let staged;
    try{
      staged=stageCustomScene({module_path},renderer);
      assert.ok(fs.existsSync(staged.entry));
      const root=fs.readFileSync(staged.entry,'utf8');
      assert.match(root,/registerRoot\(Root\)/);
      assert.match(root,/import UserScene/);
      assert.match(root,/config.mode==='overlay'/);
      assert.match(root,/const isForeground=/);
      assert.match(root,/Number\(element.z\)>=900/);
      assert.match(root,/config\?\.alwaysOnTop/);
      assert.match(root,/elements:normal/);
      assert.match(root,/elements:foreground/);
      assert.ok(root.indexOf('<UserScene') < root.indexOf('foreground.length>0'),
        'O overlay Minecraft precisa ser composto depois do TSX');
      assert.match(root,/background:\{color:'transparent'\}/);
    }finally{
      if(staged)fs.rmSync(staged.directory,{recursive:true,force:true});
    }
    assert.ok(customSceneSourceFingerprint(module_path).length>=1);
  }finally{
    if(previous===undefined)delete process.env.CONTENTLAB_TRUST_CUSTOM_TSX;
    else process.env.CONTENTLAB_TRUST_CUSTOM_TSX=previous;
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('custom source tree rejects symlinks, even when main TSX is safe',(t)=>{
  const {dir}=setup();
  try{
    const target=path.join(dir,'custom-scenes','Motion.tsx');
    try{fs.symlinkSync(target,path.join(dir,'custom-scenes','shortcut.tsx'));}
    catch(e){if(['EPERM','EACCES'].includes(e.code)){t.skip('Symlinks need privileges on this OS');return;}throw e;}
    assert.throws(()=>customSceneSourceFingerprint(target),/Links simbólicos/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
