import fs from 'node:fs';
import path from 'node:path';
import {run} from './exec.mjs';
import {SegmentCache,statIdentity} from './cache.mjs';
import {sha} from './plan.mjs';

const fileLine=file=>"file '"+path.resolve(file).replace(/\\/g,'/').replace(/'/g,"'\\''")+"'\n";
const encoding=['-c:v','libx264','-preset','veryfast','-crf','18','-threads',String(Math.max(1,Number(process.env.CONTENTLAB_COMPOSE_THREADS||2)))];
const D=n=>Number(n).toFixed(6);
const durationOf=(scene)=>scene.end-scene.start;
const identity=(sources,params)=>sha({sources:sources.map(statIdentity),params,code:'composer-1'});
async function ffconcat(files,output,work,ffmpeg,signal,copy=false){
  const manifest=path.join(work,'segments-'+Math.random().toString(16).slice(2)+'.ffconcat');
  fs.writeFileSync(manifest,'ffconcat version 1.0\n'+files.map(fileLine).join(''));
  try{
    const args=['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',manifest,'-an'];
    if(copy)args.push('-c:v','copy');
    else args.push(...encoding,'-pix_fmt','yuv420p');
    args.push(output);
    await run(ffmpeg,args,{signal});
  }finally{fs.rmSync(manifest,{force:true});}
}
function normalizedTransition(scene,next){
  if(!next||!scene||!scene.transitionOut||scene.transitionOut==='cut')return {type:'cut',seconds:0};
  const type=scene.transitionOut;
  const seconds=Math.min(
    Number(scene.transitionDuration||0.35),
    durationOf(scene)/2,durationOf(next)/2
  );
  return {type,seconds:Math.max(0,seconds)};
}
export async function composeVisual(scenes,segments,output,settings,work,{ffmpeg='ffmpeg',signal,cacheDirectory}={}){
  const pieces=[],fps=settings.fps,w=settings.width,h=settings.height;
  const pieceCache=cacheDirectory?new SegmentCache(cacheDirectory):null;
  const boundaries=segments.slice(0,-1).map((_,i)=>normalizedTransition(scenes[i],scenes[i+1]));
  if(boundaries.every(t=>t.type==='cut'||t.seconds<=0)){
    await ffconcat(segments,output,work,ffmpeg,signal,true);
    return {transitions:[]};
  }
  const transitions=[];
  for(let i=0;i<segments.length;i++){
    const scene=scenes[i],segment=segments[i],boundary=boundaries[i]||{type:'cut',seconds:0};
    const seconds=boundary.type==='cut'?0:Math.round(boundary.seconds*fps)/fps;
    const bodyTime=Math.max(0,durationOf(scene)-seconds);
    if(bodyTime>1/fps){
      const params={kind:'body',bodyTime,fps,encoding},id='body:'+scene.id+':'+D(bodyTime);
      const key=identity([segment],params);
      let piece=pieceCache?.lookup(id,key);
      if(!piece){
        const temp=path.join(work,'body-'+i+'.mp4');
        await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',segment,
          '-t',D(bodyTime),'-an','-r',String(fps),...encoding,'-pix_fmt','yuv420p',temp],{signal});
        piece=pieceCache?pieceCache.save(id,key,temp):temp;
      }
      pieces.push(piece);
    }
    if(seconds<=0)continue;
    const next=segments[i+1],type=boundary.type;
    const params={kind:'transition',type,seconds,tailTime:bodyTime,fps,w,h,encoding};
    const id='transition:'+scene.id+':'+scenes[i+1].id+':'+type+':'+D(seconds);
    const key=identity([segment,next],params);
    let piece=pieceCache?.lookup(id,key);
    if(!piece){
      const frame=path.join(work,'next-first-'+i+'.png');
      await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',next,'-frames:v','1',frame],{signal});
      const temp=path.join(work,'transition-'+i+'.mp4');
      let graph;
      if(type==='fade'){
        graph='[0:v]fps='+fps+',scale='+w+':'+h+',trim=duration='+D(seconds)+',setpts=PTS-STARTPTS[tail];'+
          '[1:v]fps='+fps+',scale='+w+':'+h+',trim=duration='+D(seconds)+',setpts=PTS-STARTPTS[first];'+
          '[tail][first]xfade=transition=fade:duration='+D(seconds)+':offset=0,format=yuv420p[out]';
      }else{
        let outgoing='x=0:y=0',incoming='x=0:y=0';
        const dur=D(seconds);
        if(['blur_left','slide_left'].includes(type)){
          outgoing="x='-"+w+"*t/"+dur+"':y=0";incoming="x='"+w+"-"+w+"*t/"+dur+"':y=0";
        }else if(type==='blur_right'){
          outgoing="x='"+w+"*t/"+dur+"':y=0";incoming="x='-"+w+"+"+w+"*t/"+dur+"':y=0";
        }else if(type==='blur_up'){
          outgoing="x=0:y='-"+h+"*t/"+dur+"'";incoming="x=0:y='"+h+"-"+h+"*t/"+dur+"'";
        }
        const blur=type.startsWith('blur_')?',gblur=sigma=2':'';
        graph='[0:v]fps='+fps+',scale='+w+':'+h+',format=rgba[tail];'+
          '[1:v]fps='+fps+',scale='+w+':'+h+',format=rgba[first];'+
          'color=c=black:s='+w+'x'+h+':r='+fps+':d='+D(seconds)+'[base];'+
          '[base][tail]overlay='+outgoing+':eval=frame[tmp];'+
          '[tmp][first]overlay='+incoming+':eval=frame'+blur+',format=yuv420p[out]';
      }
      await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss',D(bodyTime),
        '-t',D(seconds),'-i',segment,'-loop','1','-framerate',String(fps),'-i',frame,
        '-filter_complex',graph,'-map','[out]','-frames:v',String(Math.max(1,Math.round(seconds*fps))),
        '-an','-r',String(fps),...encoding,'-pix_fmt','yuv420p',temp],{signal});
      piece=pieceCache?pieceCache.save(id,key,temp):temp;
    }
    pieces.push(piece);
    transitions.push({from:scene.id,to:scenes[i+1].id,type,duration:seconds});
  }
  if(!pieces.length)throw Error('A montagem não gerou trechos.');
  await ffconcat(pieces,output,work,ffmpeg,signal,false);
  return {transitions};
}
