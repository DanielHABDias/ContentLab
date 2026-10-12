import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validatePlan, validateShape, settings, region, compileScene, resolveAsset, assetReport, schema, visualWarnings} from './plan.mjs';
import {SegmentCache,sceneFingerprint,rendererIdentity,cleanOutput,idFilename} from './cache.mjs';
import {transcriptWords,remapTranscriptWords,applyNarrationSilence} from './remotion.mjs';
import {silenceSourcePositions,edgeSilenceBounds} from './audio.mjs';

function example(root){
  return {project:{name:'Teste',format:'custom',profile:'generic',resolution:{width:1920,height:1080},fps:30},
    sources:{assets:'assets'},audio:{narration:'audio/narration.wav'},
    timeline:[{id:'batman',start:0,end:3,layout:'3x3',background:{color:'#000000'},
    elements:[{id:'hero',type:'image',asset:'project://assets/batman.png',start:0,end:3,cells:[2,5,8],fit:'contain',transform:{scale:1.2}}]}]};
}
test('one canonical schema with no version key',()=>{
  const s=schema();
  assert.equal(Object.hasOwn(s.properties,'version'),false);
  const p=example();
  assert.deepEqual(validateShape(p),[]);
  assert.deepEqual(validatePlan(p),[]);
  assert.ok(validatePlan({...p,version:'0.2'}).some(x=>x.path==='$.version'));
});
test('scene IDs are stable and duplicates rejected',()=>{
  const p=example();p.timeline.push({...p.timeline[0],start:3,end:6});
  assert.ok(validatePlan(p).some(e=>e.message.includes('duplicado')));
});
test('grid and default settings match current cinematic layout',()=>{
  const p=example();const s=settings(p);
  assert.deepEqual([s.width,s.height,s.fps],[1920,1080,30]);
  assert.deepEqual(region([2,5,8],1920,1080),[640,0,640,1080]);
  const compiled=compileScene(p.timeline[0],p,{'project://assets/batman.png':'/tmp/batman.png'});
  assert.equal(compiled.elements[0].region[0],640);
  assert.equal(compiled.elements[0].transform.scale,1.2);
});
test('grid sizing and opacity with pixel offsets validate',()=>{
  const p=example(),e=p.timeline[0].elements[0];
  e.cells=[5,8];e.transform={scale:1.05,opacity:0.65,offsetX:-20,offsetY:35};
  assert.deepEqual(validateShape(p),[]);
  assert.deepEqual(region([5,8],1920,1080),[640,360,640,720]);
  assert.equal(compileScene(p.timeline[0],p,{}).elements[0].transform.offsetY,35);
  e.transform.opacity=1.1;
  assert.ok(validateShape(p).length>0);
});
test('asset resolver rejects traversal',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-assets-'));
  try{
    assert.throws(()=>resolveAsset('project://../../etc/passwd',root));
    assert.equal(resolveAsset('project://assets/test.png',root),path.join(root,'assets','test.png'));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('per-scene cache reuses only identical fingerprint and rejects corrupt clip',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-cache-'));
  try{
    const cache=new SegmentCache(path.join(root,'output','final','scenes'));
    const staged=path.join(root,'temp.mp4');fs.writeFileSync(staged,'mp4 bytes');
    const file=cache.save('batman', 'fingerprint-a',staged);
    assert.equal(cache.lookup('batman','fingerprint-a'),file);
    assert.equal(cache.lookup('batman','fingerprint-b'),null);
    fs.writeFileSync(file,'changed clip');
    assert.equal(cache.lookup('batman','fingerprint-a'),null);
    assert.ok(!idFilename('../../foo').includes('/'));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('scene dependency fingerprint isolates edits',()=>{
  const p=example();const raw=p.timeline[0],compiled=compileScene(raw,p,{});
  const s=settings(p),kwargs={};
  const a=sceneFingerprint(raw,compiled,s,{},[],'renderer');
  const b=sceneFingerprint({...raw,elements:[{...raw.elements[0],transform:{scale:1.5}}]},compiled,s,{},[],'renderer');
  assert.notEqual(a,b);
});
test('rebuild must not delete project media stored in output',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-clean-'));
  try {
    fs.mkdirSync(path.join(root,'output'));fs.writeFileSync(path.join(root,'output','keep.wav'),'voice');
    assert.throws(()=>cleanOutput(root,[path.join(root,'output','keep.wav')]));
    assert.ok(fs.existsSync(path.join(root,'output','keep.wav')));
    cleanOutput(root,[path.join(root,'audio','voice.wav')]);
    assert.ok(!fs.existsSync(path.join(root,'output')));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('source cuts remap transcript words to the final timeline',()=>{
  const words=[{word:'INTRO',start:0.5,end:0.9},{word:'BATMAN',start:3.1,end:3.6}];
  const clipped=remapTranscriptWords(words,[{start:0,end:1},{start:3,end:4}]);
  assert.deepEqual(clipped,[{word:'INTRO',start:0.5,end:0.9},{word:'BATMAN',start:1.1,end:1.6}]);
});

test('all shipped edit-plan examples conform to the single schema',()=>{
  const examples=fs.readdirSync(path.join(process.cwd(),'examples')).filter(name=>name.endsWith('.json'));
  assert.ok(examples.length>=5);
  for(const name of examples){
    const file=JSON.parse(fs.readFileSync(path.join(process.cwd(),'examples',name),'utf8'));
    assert.deepEqual(validateShape(file),[],name);
    assert.deepEqual(validatePlan(file),[],name);
  }
});

test('cache visual identity depends on code bytes, not timestamps or nonvisual server files',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-identity-'));
  try{
    for(const dir of ['backend/remotion/src','server'])fs.mkdirSync(path.join(root,dir),{recursive:true});
    const visual=path.join(root,'backend/remotion/src/scene.tsx'),http=path.join(root,'server/http.mjs');
    fs.writeFileSync(visual,'export const frame = 1;');fs.writeFileSync(http,'server-one');
    const initial=rendererIdentity(root);
    fs.utimesSync(visual,new Date(2020,0,1),new Date(2020,0,1));
    assert.equal(rendererIdentity(root),initial);
    fs.writeFileSync(http,'server-two');
    assert.equal(rendererIdentity(root),initial);
    fs.writeFileSync(visual,'export const frame = 2;');
    assert.notEqual(rendererIdentity(root),initial);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('moving an entire scene and editing sound do not invalidate its visual MP4',()=>{
  const p=example(),raw=p.timeline[0],cfg=settings(p),files={};
  const base=sceneFingerprint(raw,compileScene(raw,p,files),cfg,files,[],'renderer');
  const withSound={...raw,transitionOut:'fade',elements:[
    ...raw.elements,{id:'boom',type:'sfx',asset:'project://sfx/boom.wav',at:1,config:{duration:2}}
  ]};
  assert.equal(sceneFingerprint(withSound,compileScene(withSound,p,files),cfg,files,[],'renderer'),base);
  const shifted={...raw,start:10,end:13,elements:raw.elements.map(e=>({
    ...e,start:e.start+10,end:e.end+10
  }))};
  assert.equal(sceneFingerprint(shifted,compileScene(shifted,p,files),cfg,files,[],'renderer'),base);
});
test('narration insertions keep later words in sync and forbid overlapping silent gaps',()=>{
  const inserts=[{at:1,duration:.5},{at:3,duration:1}];
  assert.deepEqual(silenceSourcePositions(inserts),[
    {at:1,duration:.5,sourceAt:1},{at:3,duration:1,sourceAt:2.5}
  ]);
  const words=applyNarrationSilence([{word:'A',start:.25,end:.5},
    {word:'B',start:1.5,end:1.75},{word:'C',start:3,end:3.25}],inserts);
  assert.deepEqual(words.map(w=>w.start),[.25,2,4.5]);
  const p=example();p.audio.silenceInserts=[{at:1,duration:1},{at:1.4,duration:.5}];
  assert.ok(validatePlan(p).some(e=>e.path.includes('silenceInserts')));
  assert.deepEqual(edgeSilenceBounds('',2),{start:0,end:2,empty:false});
});

test('text overlaps report a warning, while separate text regions do not block rendering',()=>{
  const p=example();
  p.timeline[0].elements=[
    {id:'a',type:'text',text:'BATMAN',start:0,end:1.3,cells:[5]},
    {id:'b',type:'text',text:'JASON',start:1,end:2,cells:[5]},
    {id:'different',type:'text',text:'OTHER',start:1,end:2,cells:[1]},
    {id:'later',type:'text',text:'END',start:2.1,end:2.8,cells:[5]}
  ];
  const warns=visualWarnings(p);
  assert.equal(warns.length,1);
  assert.equal(warns[0].code,'text_overlap');
  assert.equal(warns[0].scene,'batman');
  assert.deepEqual(validatePlan(p),[]);
});

test('canonical transcript words win over duplicated segment tokens',()=>{
  const words=[{word:'Batman',start:0,end:0.45},{word:'chega',start:0.45,end:1}];
  const segments=[{start:0,end:1,text:'Batman chega',words}];
  assert.deepEqual(transcriptWords({segments,words}),words);
  assert.deepEqual(transcriptWords({segments}),words);
  assert.deepEqual(transcriptWords({segments:[{start:0,end:1,text:'Batman chega'}]}).map(x=>x.word),['Batman','chega']);
});
