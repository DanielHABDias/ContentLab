import fs from 'node:fs';
import path from 'node:path';
import {run} from './exec.mjs';
import {SegmentCache,statIdentity} from './cache.mjs';
import {sha} from './plan.mjs';

const fileLine=file=>"file '"+path.resolve(file).replace(/\\/g,'/').replace(/'/g,"'\\''")+"'\n";
const encoding=['-c:v','libx264','-preset','veryfast','-crf','18','-threads',String(Math.max(1,Number(process.env.CONTENTLAB_COMPOSE_THREADS||2)))];
const D=n=>Number(n).toFixed(6);
const durationOf=scene=>scene.end-scene.start;
const identity=(sources,params)=>sha({sources:sources.map(statIdentity),params,code:'composer-7-flip-curtain'});
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
  const seconds=Math.min(Number(scene.transitionDuration||0.35),durationOf(scene)/2,durationOf(next)/2);
  return {type,seconds:Math.max(0,seconds)};
}
export async function composeVisual(scenes,segments,output,settings,work,{ffmpeg='ffmpeg',signal,cacheDirectory}={}){
  const pieces=[],fps=settings.fps,w=settings.width,h=settings.height;
  const pieceCache=cacheDirectory?new SegmentCache(cacheDirectory):null;
  const boundaries=segments.slice(0,-1).map((_,i)=>{
    const boundary=normalizedTransition(scenes[i],scenes[i+1]);
    // Video is discrete; 0.1 seconds at 30 fps is exactly three frames.
    // Never add a minimum duration or stretch the authored transition.
    return {...boundary,seconds:boundary.type==='cut'?0:Math.round(boundary.seconds*fps)/fps};
  });
  if(boundaries.every(t=>t.type==='cut'||t.seconds<=0)){
    await ffconcat(segments,output,work,ffmpeg,signal,true);
    return {transitions:[]};
  }
  const transitions=[];
  // Keep the FULL duration of every scene. A transition occupies the beginning of
  // the incoming scene: incoming frames 0..d are blended with the outgoing still.
  // The incoming body then begins at d, without repeating, freezing, or skipping
  // incoming motion. Narration/SFX continue to match their JSON timestamps.
  for(let i=0;i<segments.length;i++){
    const segment=segments[i],scene=scenes[i];
    const boundary=boundaries[i-1]||{type:'cut',seconds:0};
    const seconds=boundary.seconds;
    if(i>0&&boundary.type!=='cut'&&seconds>0){
      const previous=segments[i-1],previousScene=scenes[i-1];
      const type=boundary.type;
      const params={kind:'transition',type,seconds,fps,w,h,encoding,mode:'incoming-realtime'};
      const id='transition:'+previousScene.id+':'+scene.id+':'+type+':'+D(seconds);
      const key=identity([previous,segment],params);
      let piece=pieceCache?.lookup(id,key);
      if(!piece){
        const frame=path.join(work,'out-last-'+i+'.png');
        // Scene durations are authored in decimal seconds, but the encoded clip
        // ends on a frame boundary. Seeking to duration - 1/fps can land after
        // its final PTS; ffmpeg then exits successfully without writing a PNG.
        await run(ffmpeg,['-hide_banner','-loglevel','error','-y',
          '-sseof','-0.07','-i',previous,'-frames:v','1',frame],{signal});
        if(!fs.existsSync(frame)||fs.statSync(frame).size===0){
          await run(ffmpeg,['-hide_banner','-loglevel','error','-y',
            '-i',previous,'-frames:v','1',frame],{signal});
        }
        if(!fs.existsSync(frame)||fs.statSync(frame).size===0)
          throw Error('Não foi possível extrair um quadro para a transição: '+previousScene.id);
        const temp=path.join(work,'transition-'+i+'.mp4');
        const incoming='[1:v]fps='+fps+',scale='+w+':'+h+',trim=duration='+D(seconds)+
          ',setpts=PTS-STARTPTS,format=yuv420p[first];';
        const outgoing='[0:v]fps='+fps+',scale='+w+':'+h+
          ',trim=duration='+D(seconds)+',setpts=PTS-STARTPTS,format=yuv420p[tail];';
        let graph;
        // The last transition frame must ALREADY be at its final position.
        // Using t/seconds stops one frame short and causes a visible jump when
        // the unmodified incoming body starts. Easing affects shape, not time.
        const frames=Math.round(seconds*fps);
        const travel=Math.max(1/fps/100, (frames-1)/fps);
        const phase=frames>1
          ? '(0.5-0.5*cos(PI*min(1,max(0,t/'+D(travel)+'))))'
          : '1';
        if(type==='fade'){
          // Custom smootherstep fade keeps velocity/acceleration at zero
          // on both ends of the blend, without changing its frame count.
          // FFmpeg xfade's P starts at 1 (outgoing) and decreases to 0
          // (incoming). Invert it AND settle by the last sampled frame.
          const fadePhase=frames>1
            ? 'min(1,max(0,(1-P)*'+frames+'/'+(frames-1)+'))'
            : '1';
          const eased='('+fadePhase+')*('+fadePhase+')*('+fadePhase+')*('+
            fadePhase+'*('+fadePhase+'*6-15)+10)' ;
          graph=outgoing+incoming+
            '[tail][first]xfade=transition=custom:duration='+D(seconds)+
            ":offset=0:expr='A*(1-"+eased+")+B*"+eased+"',format=yuv420p[out]";
        }else if(type==='curtain'){
          graph=outgoing+incoming+"[first][tail]overlay=x='-"+w+"*"+phase+"':y=0:eval=frame,format=yuv420p[out]";
        }else if(type==='flip'){
          // Inverse-sample two faces around their vertical center axis.
          const q=phase.replaceAll('t/', 'T/');
          const squeeze='max(0.001,abs(cos(PI*'+q+')))';
          const sourceX='(X-W/2)/'+squeeze+'+W/2';
          const mask='between(X,W/2-W/2*'+squeeze+',W/2+W/2*'+squeeze+')';
          const face=(input,name,visible)=>'['+input+']format=yuva444p,geq='+
            "lum='lum("+sourceX+",Y)':cb='cb("+sourceX+",Y)':cr='cr("+sourceX+",Y)':"+
            "a='255*"+mask+'*'+visible+"'["+name+'];';
          graph=outgoing+incoming+face('tail','oldFace','lt('+q+',0.5)')+
            face('first','newFace','gte('+q+',0.5)')+
            'color=c=black:s='+w+'x'+h+':r='+fps+':d='+D(seconds)+'[base];'+
            '[base][oldFace]overlay=0:0[tmp];[tmp][newFace]overlay=0:0,format=yuv420p[out]';
        }else{
          let moveOld='x=0:y=0',moveNew='x=0:y=0';
          if(['slide_left','blur_left'].includes(type)){
            moveOld="x='-"+w+"*"+phase+"':y=0";
            moveNew="x='"+w+"-"+w+"*"+phase+"':y=0";
          }else if(type==='blur_right'){
            moveOld="x='"+w+"*"+phase+"':y=0";
            moveNew="x='-"+w+"+"+w+"*"+phase+"':y=0";
          }else if(type==='blur_up'){
            moveOld="x=0:y='-"+h+"*"+phase+"'";
            moveNew="x=0:y='"+h+"-"+h+"*"+phase+"'";
          }else if(type==='blur_down'){
            moveOld="x=0:y='"+h+"*"+phase+"'";
            moveNew="x=0:y='-"+h+"+"+h+"*"+phase+"'";
          }
          const moving=outgoing+incoming+
            'color=c=black:s='+w+'x'+h+':r='+fps+':d='+D(seconds)+'[base];'+
            '[base][tail]overlay='+moveOld+':eval=frame[tmp];'+
            '[tmp][first]overlay='+moveNew+':eval=frame,format=yuv420p[moving]';
          if(type.startsWith('blur_')){
            // Blur is strongest halfway through the motion but ZERO on
            // the first and last frame. Prevents a blurry/sharp hard cut.
            // Aggressive full-frame whip blur inspired by rapid mobile edits.
            // Directional Gaussian uses a wider streak along travel, applies to
            // the WHOLE composite (including footage/overlays), and stays sharp
            // at the first and last frames to prevent a snap on entry/exit.
            const weight=frames>1
              ? '(0.995*sin(PI*min(1,max(0,T/'+D(travel)+'))))'
              : '0';
            // Keep the same cinematic streak at 1080x1920, but scale it down
            // for small previews so it does not erase the motion direction.
            const anisotropic=['blur_left','blur_right'].includes(type)
              ? 'gblur=sigma='+D(Math.min(56,w*.14))+':sigmaV='+D(Math.min(22,h*.14))+':steps=2'
              : 'gblur=sigma='+D(Math.min(22,w*.14))+':sigmaV='+D(Math.min(56,h*.14))+':steps=2';
            graph=moving+
              ';[moving]split[sharp][blurSrc];[blurSrc]'+anisotropic+'[blurry];'+
              "[sharp][blurry]blend=all_expr='A*(1-"+weight+")+B*"+weight+"'[out]";
          }else{
            graph=moving+';[moving]null[out]';
          }
        }
        await run(ffmpeg,['-hide_banner','-loglevel','error','-y',
          '-loop','1','-framerate',String(fps),'-t',D(seconds),'-i',frame,
          '-i',segment,'-filter_complex',graph,'-map','[out]',
          '-frames:v',String(Math.round(seconds*fps)),
          '-an','-r',String(fps),...encoding,'-pix_fmt','yuv420p',temp],{signal});
        piece=pieceCache?pieceCache.save(id,key,temp):temp;
      }
      pieces.push(piece);
      transitions.push({from:previousScene.id,to:scene.id,type,duration:seconds,at:scene.start});
    }
    const bodyStart=seconds>0?seconds:0;
    const bodyTime=Math.max(0,durationOf(scene)-bodyStart);
    if(bodyTime>1/(fps*2)){
      const params={kind:'body',bodyStart,bodyTime,fps,encoding};
      const id='body:'+scene.id+':'+D(bodyStart)+':'+D(bodyTime);
      const key=identity([segment],params);
      let piece=pieceCache?.lookup(id,key);
      if(!piece){
        const temp=path.join(work,'body-'+i+'.mp4');
        await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',segment,
          '-ss',D(bodyStart),'-t',D(bodyTime),'-an','-r',String(fps),
          ...encoding,'-pix_fmt','yuv420p',temp],{signal});
        piece=pieceCache?pieceCache.save(id,key,temp):temp;
      }
      pieces.push(piece);
    }
  }
  if(!pieces.length)throw Error('A montagem não gerou trechos.');
  await ffconcat(pieces,output,work,ffmpeg,signal,false);
  return {transitions};
}
