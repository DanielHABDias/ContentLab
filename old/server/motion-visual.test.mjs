import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {run} from './exec.mjs';
import {composeVisual} from './compose.mjs';

const exists=cmd=>spawnSync(cmd,['-version'],{stdio:'ignore'}).status===0;
const available=exists('ffmpeg')&&exists('ffprobe');
const required=process.env.CONTENTLAB_REQUIRE_FFMPEG_TEST==='1';
test('0.1-second fade / slide / blur transitions remain 0.1 seconds and end on the right frame',
 {skip:!available&&!required,timeout:120000},async()=>{
  assert.ok(available,'FFmpeg/FFprobe required: pixel test must not be skipped in smoke CI');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-smooth-'));
  try {
    const fps=30,w=160,h=90;
    const videos=[];
    for(const color of ['red','blue']){
      const video=path.join(folder,color+'.mp4');
      await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
        'color=c='+color+':s='+w+'x'+h+':r='+fps+':d=0.5',
        '-c:v','libx264','-pix_fmt','yuv420p',video]);
      videos.push(video);
    }
    for(const type of ['fade','slide_left','blur_left','blur_right','blur_up','blur_down','flip','curtain']){
      const output=path.join(folder,type+'.mp4');
      const scenes=[{id:'red',start:0,end:0.5,transitionOut:type,transitionDuration:0.1},
        {id:'blue',start:0.5,end:1,transitionOut:'cut'}];
      const result=await composeVisual(scenes,videos,output,{width:w,height:h,fps},folder);
      assert.equal(result.transitions.length,1,type);
      assert.ok(Math.abs(result.transitions[0].duration-0.1)<1e-8,type);
      const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration',
        '-of','default=noprint_wrappers=1:nokey=1',output],{encoding:'utf8'});
      assert.equal(probe.status,0,String(probe.stderr));
      const seconds=Number(probe.stdout.trim());
      assert.ok(Math.abs(seconds-1)<1/fps+0.02,`${type} changed the total video duration: ${seconds}`);
      // Last 0.1-second transition frame should be fully the incoming scene,
      // avoiding the old abrupt snap as the main body begins.
      const sample=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-ss',
        String(.5+2/fps+.005),'-i',output,'-frames:v','1','-f','rawvideo',
        '-pix_fmt','rgb24','-'],{encoding:null,maxBuffer:4*w*h,timeout:20000});
      assert.equal(sample.status,0,String(sample.stderr));
      assert.equal(sample.stdout.length,w*h*3);
      const offset=(45*w+80)*3;
      const [red,green,blue]=sample.stdout.subarray(offset,offset+3);
      assert.ok(blue>120&&blue>red*2&&blue>green*2,
        `${type}: final transition frame not settled on incoming blue (${red},${green},${blue})`);
      if(type==='blur_down'){
        // Halfway through, the new blue scene enters from the top while the
        // outgoing red scene leaves through the bottom.
        const midpoint=spawnSync('ffmpeg',['-hide_banner','-loglevel','error',
          '-i',output,'-vf','select=eq(n\\,16)','-frames:v','1','-f','rawvideo',
          '-pix_fmt','rgb24','-'],{encoding:null,maxBuffer:4*w*h,timeout:20000});
        assert.equal(midpoint.status,0,String(midpoint.stderr));
        const top=(10*w+80)*3,bottom=(80*w+80)*3;
        assert.ok(midpoint.stdout[top+2]>midpoint.stdout[top],
          'blur_down should bring the incoming blue scene from the top');
        assert.ok(midpoint.stdout[bottom]>midpoint.stdout[bottom+2],
          'blur_down should move the outgoing red scene toward the bottom');
      }
    }
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('Flip compresses two faces and Curtain reveals a stationary incoming shot, in both formats',
 {skip:!available&&!required,timeout:120000},async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'cl-flip-curtain-'));
 try{for(const [w,h]of [[160,90],[90,160]]){
  const videos=[];
  for(const color of ['red','blue']){const file=path.join(folder,color+w+'.mp4');await run('ffmpeg',['-v','error','-y','-f','lavfi','-i',`color=c=${color}:s=${w}x${h}:r=30:d=1`,'-c:v','libx264','-pix_fmt','yuv420p',file]);videos.push(file);}
  const pixel=(file,frame,x,y)=>{
   const r=spawnSync('ffmpeg',['-v','error','-i',file,'-vf',`select=eq(n\\,${frame})`,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:w*h*4});
   assert.equal(r.status,0,String(r.stderr));assert.equal(r.stdout.length,w*h*3);return [...r.stdout.subarray((y*w+x)*3,(y*w+x)*3+3)];
  };
  for(const type of ['flip','curtain']){
   const out=path.join(folder,type+w+'.mp4');await composeVisual([{id:'a',start:0,end:1,transitionOut:type,transitionDuration:.4},{id:'b',start:1,end:2,transitionOut:'cut'}],videos,out,{width:w,height:h,fps:30},folder);
   const first=pixel(out,30,Math.floor(w/2),Math.floor(h/2)),last=pixel(out,41,Math.floor(w/2),Math.floor(h/2));
   assert.ok(first[0]>150&&first[2]<60,type+' starts on outgoing');assert.ok(last[2]>150&&last[0]<60,type+' settles on incoming');
   if(type==='flip'){
    const middle=pixel(out,34,Math.floor(w/2),Math.floor(h/2)),edge=pixel(out,34,2,Math.floor(h/2));
    assert.ok(middle[0]>100,'front face visible before half-turn');assert.ok(Math.max(...edge)<45,'face narrows during flip');
    const back=pixel(out,37,Math.floor(w/2),Math.floor(h/2));assert.ok(back[2]>100,'incoming face visible after half-turn');
   }else{
    const left=pixel(out,35,5,Math.floor(h/2)),right=pixel(out,35,w-6,Math.floor(h/2));
    assert.ok(left[0]>100&&right[2]>100,'curtain slides the old shot off the stationary new shot');
   }
  }
 }}finally{fs.rmSync(folder,{recursive:true,force:true});}
});
