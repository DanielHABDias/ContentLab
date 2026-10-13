import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {mediaToolExecutable,ffmpegFilterAvailable} from './runtime-tools.mjs';
import {run} from './exec.mjs';
import {instanceIdentity,startupAction} from './instance-identity.mjs';

test('FFmpeg filter list must contain an actual rubberband filter entry',()=>{
  const filterList='Filters:\n .. rubberband A->A Pitch-shift audio\n .. equalizer A->A';
  assert.equal(ffmpegFilterAvailable(filterList,'rubberband'),true);
  assert.equal(ffmpegFilterAvailable('built with --enable-librubberband','rubberband'),false);
  assert.equal(ffmpegFilterAvailable(' .. notrubberband A->A dummy','rubberband'),false);
});

test('media tool resolver pins bootstrapped binary and avoids stale system FFmpeg',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-media-path-'));
  try{
    const dir=path.join(root,'.tools','ffmpeg');
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'ffmpeg'),'mock');
    fs.writeFileSync(path.join(dir,'ffprobe'),'mock');
    const local=mediaToolExecutable('ffmpeg',{directory:root,platform:'linux',env:{}});
    assert.equal(local,path.join(dir,'ffmpeg'));
    assert.equal(mediaToolExecutable('ffprobe',{directory:root,platform:'linux',env:{}}),
      path.join(dir,'ffprobe'));
    const explicitlyPinned='/valid/special/ffmpeg';
    assert.equal(mediaToolExecutable('ffmpeg',{directory:root,platform:'linux',
      env:{CONTENTLAB_FFMPEG:explicitlyPinned}}),explicitlyPinned);
    assert.equal(mediaToolExecutable('zenity',{directory:root,platform:'linux',env:{}}),'zenity');
    const windowDir=path.join(dir,'ffmpeg.exe');
    fs.writeFileSync(windowDir,'mock');
    assert.equal(mediaToolExecutable('ffmpeg',{directory:root,platform:'win32',env:{}}),windowDir);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('spawn uses pinned FFmpeg executable rather than PATH', {skip:process.platform==='win32'},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-pinned-ffmpeg-'));
  const previous=process.env.CONTENTLAB_FFMPEG;
  try{
    const executable=path.join(dir,'ffmpeg');
    fs.writeFileSync(executable,'#!/bin/sh\nprintf " .. rubberband A->A Pitch-shift\\n"\n',{mode:0o755});
    process.env.CONTENTLAB_FFMPEG=executable;
    const info=await run('ffmpeg',['-hide_banner','-filters']);
    assert.equal(ffmpegFilterAvailable(info.stdout,'rubberband'),true);
  }finally{
    if(previous===undefined)delete process.env.CONTENTLAB_FFMPEG;
    else process.env.CONTENTLAB_FFMPEG=previous;
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('launcher restarts stale versions and reuses only matching instance',()=>{
 const current={directoryId:'same-directory',signature:'v2'};
 const remote={backend:'node',renderer:'remotion',directoryId:'same-directory',signature:'v1'};
 assert.equal(startupAction(null,current),'start');
 assert.equal(startupAction({...remote,signature:'v2'},current),'reuse');
 assert.equal(startupAction(remote,current),'restart');
 assert.equal(startupAction({backend:'node',renderer:'remotion'},current,{hasLocalPid:true}),'restart');
 assert.equal(startupAction({backend:'node',renderer:'remotion'},current),'occupied');
 assert.equal(startupAction({...remote,directoryId:'other'},current),'occupied');
 assert.equal(startupAction({backend:'other'},current),'occupied');
});

test('runtime fingerprint changes when backend files change',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-instance-'));
 try{
   const base=path.join(root,'server');fs.mkdirSync(base,{recursive:true});
   const before=instanceIdentity(root);
   fs.writeFileSync(path.join(base,'voice-studio.mjs'),'new version');
   const after=instanceIdentity(root);
   assert.equal(after.directoryId,before.directoryId);
   assert.notEqual(after.signature,before.signature);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
