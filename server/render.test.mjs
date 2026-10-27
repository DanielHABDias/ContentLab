import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderProject} from './render.mjs';

test('scene concurrency preserves composition order, cache and monotonically completed progress',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-render-order-'));
  try{
    fs.mkdirSync(path.join(root,'audio'));fs.writeFileSync(path.join(root,'audio','voice.wav'),'voice');
    const plan={project:{name:'order',format:'custom',profile:'generic',resolution:{width:64,height:36},fps:30},audio:{narration:'audio/voice.wav'},
      timeline:['a','b','c'].map((id,i)=>({id,start:i,end:i+1,background:{color:'#000'},elements:[]}))};
    fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(plan));
    const completed=[];
    const options={sceneConcurrency:2,
      renderScene:async(scene,cfg,words,target)=>{await new Promise(resolve=>setTimeout(resolve,scene.id==='a'?20:1));fs.writeFileSync(target,scene.id);},
      compose:async(scenes,paths,target)=>{assert.deepEqual(paths.map(p=>fs.readFileSync(p,'utf8')),['a','b','c']);fs.writeFileSync(target,'visual');return {};},
      prepareVoice:async(input,target)=>fs.writeFileSync(target,'voice'),
      mix:async(visual,voice,plan,assets,target)=>{fs.writeFileSync(target,'final');return [];},
      probe:async()=>({videoDuration:3,audioDuration:3}),
      progress:(stage,current)=>{if(stage==='scene')completed.push(current);}};
    const report=await renderProject(root,options);
    assert.deepEqual(report.sceneCache.rendered,['a','b','c']);
    assert.deepEqual(completed,[1,2,3]);
    assert.deepEqual(report.performance.sceneTimings.map(s=>s.id),['a','b','c']);
    assert.equal((await renderProject(root,options)).cacheHit,true);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a failed scene preserves completed cache and the previous final without composing partial output',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-render-partial-'));
  try{
    fs.mkdirSync(path.join(root,'audio'));fs.writeFileSync(path.join(root,'audio','voice.wav'),'voice');
    fs.mkdirSync(path.join(root,'output','final'),{recursive:true});
    fs.writeFileSync(path.join(root,'output','final','final.mp4'),'previous-final');
    const plan={project:{name:'partial',format:'youtube_long',profile:'generic'},audio:{narration:'audio/voice.wav'},
      timeline:['a','b','c'].map((id,i)=>({id,start:i,end:i+1,background:{color:'#000'},elements:[]}))};
    fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(plan));
    const calls=[];
    await assert.rejects(renderProject(root,{sceneConcurrency:1,prepareVoice:async()=>{},
      renderScene:async(scene,cfg,words,target)=>{calls.push(scene.id);if(scene.id==='b')throw Error('bad scene');fs.writeFileSync(target,'scene');},
      compose:async()=>assert.fail('Partial output must not be composed')
    }),/cena 2\/3 \[b\].*bad scene/);
    assert.deepEqual(calls,['a','b']);
    const final=path.join(root,'output','final');
    assert.equal(fs.readFileSync(path.join(final,'final.mp4'),'utf8'),'previous-final');
    const manifest=JSON.parse(fs.readFileSync(path.join(final,'scenes','manifest.json')));
    assert.deepEqual(Object.keys(manifest.entries),['a']);
    assert.equal(fs.readdirSync(final).some(name=>name.startsWith('contentlab-render-')),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

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

test('render reports the failing scene before invoking Remotion, even on scene one',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-render-diagnostics-'));
  try{
    fs.mkdirSync(path.join(root,'audio'));
    fs.writeFileSync(path.join(root,'audio','voice.wav'),'dummy');
    const plan={project:{name:'diagnostics',format:'youtube_long',profile:'generic'},
      audio:{narration:'audio/voice.wav'},timeline:[
        {id:'abertura',start:0,end:3,layout:'fullscreen',background:{color:'#000'},
          elements:[]},
        {id:'outra',start:3,end:6,layout:'fullscreen',background:{color:'#000'},
          elements:[]}
      ]};
    fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(plan));
    const events=[];
    await assert.rejects(()=>renderProject(root,{
      progress:(...args)=>events.push(args),
      renderScene:async()=>{throw Error('write EPIPE');},
      prepareVoice:async()=>{},
    }),error=>error.message.includes('cena 1/2 [abertura]')&&error.message.includes('write EPIPE'));
    assert.deepEqual(events[0],['scene_start',1,2,'abertura']);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,'output','final','render_report.json'))).status,'failed');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('GPU encoder fallback disables GPU attempts for remaining scenes',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-render-gpu-fallback-'));
  try{
    fs.mkdirSync(path.join(root,'audio'));
    fs.writeFileSync(path.join(root,'audio','voice.wav'),'voice');
    const plan={project:{name:'gpu-fallback',format:'custom',profile:'generic',resolution:{width:64,height:36},fps:30},
      audio:{narration:'audio/voice.wav'},timeline:[
        {id:'first',start:0,end:1,layout:'fullscreen',background:{color:'#000'},elements:[]},
        {id:'second',start:1,end:2,layout:'fullscreen',background:{color:'#000'},elements:[]},
      ]};
    fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(plan));
    const hardwareFlags=[];
    const report=await renderProject(root,{
      hardwareAccel:true,
      renderScene:async(scene,cfg,words,target,{hardwareAccel,onHardwareFallback})=>{
        hardwareFlags.push(hardwareAccel);
        if(hardwareFlags.length===1)onHardwareFallback();
        fs.writeFileSync(target,'scene-'+scene.id);
      },
      compose:async(scenes,segments,target)=>{fs.writeFileSync(target,'video');return {transitions:[]};},
      prepareVoice:async(input,target)=>{fs.writeFileSync(target,'voice');},
      mix:async(visual,voice,plan,assets,target)=>{fs.writeFileSync(target,'final');return [];},
      probe:async()=>({videoDuration:2,audioDuration:2,videoCodec:'h264',audioCodec:'aac'}),
    });
    assert.equal(report.status,'completed');
    assert.deepEqual(hardwareFlags,[true,false]);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
