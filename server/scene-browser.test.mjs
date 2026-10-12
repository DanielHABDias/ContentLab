import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {APP_ROOT,settings,compileScene,assetReport} from './plan.mjs';
import {SegmentCache,sceneFingerprint,rendererIdentity} from './cache.mjs';
import {sceneCacheOverview,savedSceneFile} from './scene-browser.mjs';

test('scene viewer checks current JSON against persistent MP4 cache and never serves arbitrary paths',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-scene-viewer-'));
  try{
    fs.mkdirSync(path.join(root,'audio'));
    fs.writeFileSync(path.join(root,'audio','voice.wav'),'voice');
    const plan={project:{name:'viewer',format:'custom',profile:'generic',
      resolution:{width:640,height:360},fps:30},
      audio:{narration:'audio/voice.wav'},timeline:[
        {id:'batman',start:0,end:2,background:{color:'#000000'},elements:[]},
        {id:'jason',start:2,end:4,background:{color:'#333333'},elements:[]}
      ]};
    const file=path.join(root,'edit_plan.json');
    fs.writeFileSync(file,JSON.stringify(plan));
    const resolved=assetReport(plan,root).resolvedAssets;
    const fingerprint=sceneFingerprint(plan.timeline[0],compileScene(plan.timeline[0],plan,resolved),
      settings(plan),resolved,[],rendererIdentity(APP_ROOT));
    const cache=new SegmentCache(path.join(root,'output','final','scenes'));
    const staged=path.join(root,'temporary.mp4');fs.writeFileSync(staged,'fake-video-segment');
    const stored=cache.save('batman',fingerprint,staged);
    assert.deepEqual(sceneCacheOverview(root).scenes.map(x=>x.status),['ready','missing']);
    assert.equal(savedSceneFile(root,'batman'),stored);
    assert.equal(savedSceneFile(root,'../../secrets'),null);
    plan.timeline[0].background.color='#FAFAFA';
    fs.writeFileSync(file,JSON.stringify(plan));
    assert.equal(sceneCacheOverview(root).scenes[0].status,'changed');
    assert.equal(savedSceneFile(root,'batman'),stored,'Prior cached version remains playable.');
    fs.writeFileSync(stored,'changed-file-size');
    assert.equal(sceneCacheOverview(root).scenes[0].status,'missing');
    assert.equal(savedSceneFile(root,'batman'),null);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('studio HTML keeps unique action IDs and has scene viewer controls',()=>{
  const html=fs.readFileSync(path.join(APP_ROOT,'frontend','templates','index.html'),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size,'Duplicate DOM IDs would break existing event wiring.');
  for(const id of ['editorReuse','editorRebuild','visualSceneList','visualSceneVideo',
    'visualSceneSearch','visualSceneFields','visualSelectedSceneCache','editorPlanText','visualAddScene'])
    assert.ok(ids.includes(id),'Missing '+id);
  assert.match(html,/studio\.css/);
  assert.match(html,/contentlab-mark\.svg/);
});
