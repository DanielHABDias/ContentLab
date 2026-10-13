import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {run} from './exec.mjs';
import {composeVisual} from './compose.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-motion-transition-'));
const width=160,height=90,fps=30;
const cfg={width,height,fps};
try{
  const files=[];
  for(const color of ['red','blue']){
    const target=path.join(root,color+'.mp4');
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi',
      '-i',`color=c=${color}:s=${width}x${height}:r=${fps}:d=0.4`,
      '-an','-c:v','libx264','-pix_fmt','yuv420p',target]);
    files.push(target);
  }
  const scenes=type=>[
    {id:'first',start:0,end:0.4,transitionOut:type,transitionDuration:0.1},
    {id:'second',start:0.4,end:0.8,transitionOut:'cut'}
  ];
  for(const type of ['fade','slide_left','blur_left','blur_right','blur_up']){
    const output=path.join(root,type+'.mp4');
    const result=await composeVisual(scenes(type),files,output,cfg,root,{ffmpeg:'ffmpeg'});
    assert.equal(result.transitions.length,1);
    assert.equal(result.transitions[0].duration,0.1,
      'must not stretch 100ms duration for '+type);
    const probe=await run('ffprobe',['-v','error','-count_frames','-select_streams','v:0',
      '-show_entries','stream=nb_read_frames','-of','default=noprint_wrappers=1:nokey=1',output]);
    assert.equal(Number(probe.stdout.trim()),24,
      'two 0.4s scenes must remain exactly 24 frames at 30fps for '+type);
  }
  console.log(JSON.stringify({status:'passed',transitionTypes:5,transitionSeconds:0.1,
    fps,frames:24}));
}finally{
  if(process.env.CONTENTLAB_KEEP_SMOKE!=='1')fs.rmSync(root,{recursive:true,force:true});
}
