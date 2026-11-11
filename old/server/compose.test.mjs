import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {run} from './exec.mjs';
import {composeVisual} from './compose.mjs';
const available=['ffmpeg','ffprobe'].every(bin=>spawnSync(bin,['-version'],{stdio:'ignore'}).status===0);
const required=process.env.CONTENTLAB_REQUIRE_FFMPEG_TEST==='1';

test('parallel composition preserves frames/order and safely copies compatible pieces',{timeout:120000,skip:!available&&!required},async()=>{
  assert.ok(available,'FFmpeg/FFprobe required for composition pixel tests');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-compose-workers-'));
  try{
    const clips=[];
    for(const [i,color]of ['red','green','blue'].entries()){
      const file=path.join(root,i+'.mp4');
      await run('ffmpeg',['-v','error','-y','-f','lavfi','-i',`color=c=${color}:s=160x90:r=30:d=0.6`,'-c:v','libx264','-pix_fmt','yuv420p',file]);clips.push(file);
    }
    const scenes=clips.map((_,i)=>({id:'scene'+i,start:i*.6,end:(i+1)*.6,transitionOut:i===0?'blur_right':i===1?'curtain':'cut',transitionDuration:.1}));
    const cfg={width:160,height:90,fps:30};
    const a=path.join(root,'a.mp4'),b=path.join(root,'b.mp4');
    const first=await composeVisual(scenes,clips,a,cfg,root,{compositionConcurrency:1,cacheDirectory:path.join(root,'pieces')});
    const second=await composeVisual(scenes,clips,b,cfg,root,{compositionConcurrency:2,cacheDirectory:path.join(root,'parallel-pieces')});
    assert.equal(first.assembly.mode,'copy');assert.equal(second.assembly.mode,'copy');
    assert.deepEqual(first.transitions,second.transitions);
    const hash=async file=>(await run('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-f','framemd5','-'])).stdout;
    assert.equal(await hash(a),await hash(b));
    const cachedFile=path.join(root,'cached.mp4');
    await composeVisual(scenes,clips,cachedFile,cfg,root,{cacheDirectory:path.join(root,'parallel-pieces')});
    assert.equal(await hash(b),await hash(cachedFile));
    const encoded=await composeVisual(scenes,clips,path.join(root,'encoded.mp4'),cfg,root,{forceReencode:true});
    assert.equal(encoded.assembly.mode,'encode');assert.equal(encoded.assembly.reason,'explicit-encode');
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'pieces','manifest.json')));
    assert.equal(Object.keys(manifest.entries).length,5);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('incompatible H264 stream parameters use the encode fallback',{timeout:60000,skip:!available&&!required},async()=>{
  assert.ok(available,'FFmpeg/FFprobe required for composition fallback tests');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-compose-fallback-'));
  try{
    const files=[];
    for(const [i,profile]of ['baseline','high'].entries()){
      const file=path.join(root,i+'.mp4');files.push(file);
      await run('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=red:s=160x90:r=30:d=0.5','-c:v','libx264','-profile:v',profile,'-pix_fmt','yuv420p',file]);
    }
    const result=await composeVisual([{id:'a',start:0,end:.5},{id:'b',start:.5,end:1}],files,path.join(root,'out.mp4'),{width:160,height:90,fps:30},root);
    assert.equal(result.assembly.mode,'encode');assert.equal(result.assembly.reason,'incompatible-streams');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
