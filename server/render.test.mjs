import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderProject} from './render.mjs';

test('Node pipeline persists scene clips, redraws only changed scene and rebuilds all',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-node-render-'));
  try{
    fs.mkdirSync(path.join(root,'assets'));fs.mkdirSync(path.join(root,'audio'));
    fs.writeFileSync(path.join(root,'assets','a.png'),'asset');
    fs.writeFileSync(path.join(root,'audio','voice.wav'),'voice');
    const element=(id,scale)=>({id,type:'image',asset:'project://assets/a.png',fit:'contain',
      cells:[2,5,8],transform:{scale}});
    const plan={project:{name:'teste',format:'custom',profile:'generic',resolution:{width:64,height:36},fps:30},
      audio:{narration:'audio/voice.wav'},timeline:[
        {id:'first',start:0,end:1,layout:'3x3',background:{color:'#000000'},elements:[element('one',1)]},
        {id:'second',start:1,end:2,layout:'3x3',background:{color:'#000000'},elements:[element('two',1)]}
      ]};
    const file=path.join(root,'edit_plan.json');
    fs.writeFileSync(file,JSON.stringify(plan));
    const calls=[];
    const renderScene=async(scene,cfg,words,target)=>{calls.push(scene.id);fs.writeFileSync(target,'scene-'+scene.id+Date.now());};
    const compose=async(scenes,segments,target)=>{fs.writeFileSync(target,'visual');return {transitions:[]};};
    const prepareVoice=async(input,output)=>{fs.writeFileSync(output,'audio');};
    const mix=async(visual,voice,p,resolved,target)=>{fs.writeFileSync(target,'final');return [];};
    const probe=async()=>({videoDuration:2,audioDuration:2,videoCodec:'h264',audioCodec:'aac'});
    const options={renderScene,compose,prepareVoice,mix,probe};
    const first=await renderProject(root,options);
    assert.deepEqual(first.sceneCache.rendered,['first','second']);
    assert.equal(first.sceneCache.reusedCount,0);
    assert.equal(calls.length,2);
    const repeated=await renderProject(root,options);
    assert.equal(repeated.cacheHit,true);
    assert.equal(calls.length,2);
    plan.timeline[1].elements[0].transform.scale=1.35;
    fs.writeFileSync(file,JSON.stringify(plan));
    const changed=await renderProject(root,options);
    assert.deepEqual(changed.sceneCache.rendered,['second']);
    assert.deepEqual(changed.sceneCache.reused,['first']);
    assert.equal(calls.length,3);
    fs.writeFileSync(path.join(root,'audio','voice.wav'),'updated-narration');
    const audioOnly=await renderProject(root,options);
    assert.equal(audioOnly.sceneCache.renderedCount,0);
    assert.equal(audioOnly.sceneCache.reusedCount,2);
    assert.equal(calls.length,3);
    fs.writeFileSync(path.join(root,'output','old.tmp'),'stale');
    const rebuilt=await renderProject(root,{...options,cacheMode:'rebuild'});
    assert.equal(rebuilt.sceneCache.renderedCount,2);
    assert.equal(calls.length,5);
    assert.ok(!fs.existsSync(path.join(root,'output','old.tmp')));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
