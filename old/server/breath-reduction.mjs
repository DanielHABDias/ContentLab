import fs from 'node:fs';
import path from 'node:path';
import {setImmediate as yieldThread} from 'node:timers/promises';
import {run} from './exec.mjs';

export function breathOptions(raw={}){
  if(raw.reduceBreaths!==undefined&&typeof raw.reduceBreaths!=='boolean')throw Error('Redução de respiração inválida.');
  const strength=Number(raw.breathReductionStrength??60);
  if(!Number.isFinite(strength)||strength<0||strength>100)throw Error('Intensidade da redução de respiração deve ficar entre 0 e 100.');
  return {reduceBreaths:raw.reduceBreaths===true,breathReductionStrength:strength};
}

// Conservative acoustic heuristic, not a speech recognizer: only short, quiet,
// non-periodic bursts near voiced speech. Never delete samples or gate all audio.
export function breathRanges(features){
  const voiced=f=>f.db> -48&&f.periodicity>.55;
  const candidate=(f,i)=>{
    let reference=-100,nearSpeech=false;
    for(let j=Math.max(0,i-90);j<Math.min(features.length,i+91);j++)if(voiced(features[j])){
      reference=Math.max(reference,features[j].db);
      if(Math.abs(j-i)<10)nearSpeech=true;
    }
    return !nearSpeech&&reference> -48&&f.db> -55&&f.db<reference-10&&f.periodicity<.35&&f.zcr>.07&&f.zcr<.45;
  };
  const ranges=[];let start=null;
  for(let i=0;i<=features.length;i++){
    if(i<features.length&&candidate(features[i],i)){if(start===null)start=i;}
    else if(start!==null){
      const duration=(i-start)*.01;
      if(duration>=.12&&duration<=.75)ranges.push({start:start*.01+.02,end:i*.01-.02});
      start=null;
    }
  }
  return ranges;
}

export async function reduceBreaths(input,output,raw={}, {ffmpeg='ffmpeg',signal,update=()=>{}}={}){
  const options=breathOptions(raw);
  if(!options.reduceBreaths||options.breathReductionStrength===0){fs.copyFileSync(input,output);return {applied:false,ranges:[]};}
  const stage=fs.mkdtempSync(path.join(path.dirname(output),'.breaths-'));
  try{
    update('Atenuando respirações nas pausas, sem encurtar a fala...');
    const analysis=path.join(stage,'analysis.f32'),pcm=path.join(stage,'voice.f32'),treated=path.join(stage,'treated.f32');
    await run(ffmpeg,['-v','error','-y','-i',input,'-vn','-ac','1','-ar','8000','-f','f32le',analysis],{signal});
    const features=[],fd=fs.openSync(analysis,'r'),block=Buffer.alloc(8000*4*30+1280);
    try{
      for(let offset=0;;offset+=8000*4*30){
        signal?.throwIfAborted();
        const n=fs.readSync(fd,block,0,block.length,offset);if(n<1280)break;
        for(let pos=0;pos+1280<=n&&pos<8000*4*30;pos+=320){
          let power=0,crossings=0,periodicity=0;
          for(let k=0;k<320;k++){const x=block.readFloatLE(pos+k*4);power+=x*x;if(k&&x*block.readFloatLE(pos+(k-1)*4)<0)crossings++;}
          for(let lag=20;lag<=100;lag+=2){let dot=0,a=0,b=0;for(let k=lag;k<320;k+=2){const x=block.readFloatLE(pos+k*4),y=block.readFloatLE(pos+(k-lag)*4);dot+=x*y;a+=x*x;b+=y*y;}periodicity=Math.max(periodicity,dot/Math.sqrt(a*b+1e-30));}
          features.push({db:10*Math.log10(power/320+1e-30),zcr:crossings/319,periodicity});
        }
        await yieldThread();
      }
    }finally{fs.closeSync(fd);}
    const ranges=breathRanges(features);
    if(!ranges.length){fs.copyFileSync(input,output);return {applied:false,ranges};}
    await run(ffmpeg,['-v','error','-y','-i',input,'-vn','-ac','1','-ar','48000','-f','f32le',pcm],{signal});
    const source=fs.openSync(pcm,'r'),destination=fs.openSync(treated,'w'),buffer=Buffer.alloc(48000*4);
    let sample=0,index=0;const attenuationDb=options.breathReductionStrength<=60?options.breathReductionStrength*.2:12+(options.breathReductionStrength-60)*.7;
    const minimum=Math.pow(10,-attenuationDb/20);
    try{
      for(;;){signal?.throwIfAborted();const n=fs.readSync(source,buffer,0,buffer.length,null);if(!n)break;
        for(let j=0;j<n;j+=4,sample++){
          const t=sample/48000;while(index<ranges.length&&t>ranges[index].end)index++;
          const r=ranges[index];if(r&&t>=r.start){const edge=Math.min(1,(t-r.start)/.025,(r.end-t)/.025),gain=1-(1-minimum)*(.5-.5*Math.cos(Math.PI*Math.max(0,edge)));buffer.writeFloatLE(buffer.readFloatLE(j)*gain,j);}
        }
        fs.writeSync(destination,buffer,0,n);await yieldThread();
      }
    }finally{fs.closeSync(source);fs.closeSync(destination);}
    await run(ffmpeg,['-v','error','-y','-f','f32le','-ar','48000','-ac','1','-i',treated,'-c:a','pcm_s24le',output],{signal});
    return {applied:true,ranges,attenuationDb};
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
