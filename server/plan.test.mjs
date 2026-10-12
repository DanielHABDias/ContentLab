import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validatePlan, validateShape, settings, region, compileScene, resolveAsset, assetReport, schema} from './plan.mjs';
import {SegmentCache,sceneFingerprint,cleanOutput,idFilename} from './cache.mjs';

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
