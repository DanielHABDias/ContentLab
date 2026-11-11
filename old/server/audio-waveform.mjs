import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {probeAudioDuration} from './audio.mjs';
import {mediaToolExecutable} from './runtime-tools.mjs';
const cache=new Map(),pending=new Map();let active=0;const waiting=[];
async function slot(){if(active<2){active++;return;}if(waiting.length>=12)throw Error('Aguarde o carregamento das formas de onda.');await new Promise(resolve=>waiting.push(resolve));}
function release(){if(waiting.length)waiting.shift()();else active--;}
export async function audioWaveform(file){
  const stat=fs.statSync(file),key=file+'|'+stat.size+'|'+stat.mtimeMs;
  if(cache.has(key))return cache.get(key);if(pending.has(key))return pending.get(key);
  const task=(async()=>{
    await slot();
    try{
      const duration=await probeAudioDuration(file),count=640,rate=8000;
      if(!Number.isFinite(duration)||duration<=0||duration>14400)throw Error('Duração do áudio não suportada para forma de onda.');
      const peaks=new Float64Array(count);let frame=0,carry=null;
      await new Promise((resolve,reject)=>{
        const child=spawn(mediaToolExecutable('ffmpeg'),['-hide_banner','-loglevel','error','-i',file,'-vn','-ac','1','-ar',String(rate),'-f','s16le','pipe:1'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
        const timeout=setTimeout(()=>child.kill(),120000);let stderr='';
        child.stdout.on('data',chunk=>{
          if(carry!==null){chunk=Buffer.concat([Buffer.from([carry]),chunk]);carry=null;}
          if(chunk.length%2){carry=chunk[chunk.length-1];chunk=chunk.subarray(0,-1);}
          for(let offset=0;offset<chunk.length;offset+=2){const index=Math.min(count-1,Math.floor(frame++/(duration*rate)*count));peaks[index]=Math.max(peaks[index],Math.abs(chunk.readInt16LE(offset))/32768);}
        });
        child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-1000);});
        child.on('error',error=>{clearTimeout(timeout);reject(error);});
        child.on('close',code=>{clearTimeout(timeout);code===0?resolve():reject(Error('Falha ao analisar áudio: '+stderr));});
      });
      const result={duration,peaks:Array.from(peaks,value=>Math.round(value*10000)/10000)};
      if(cache.size>=24)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
    }finally{release();}
  })();pending.set(key,task);
  try{return await task;}finally{pending.delete(key);}
}
export async function sendNarrationAudio(req,res,file){
  res.set('Cache-Control','no-store');
  if(req.query.waveform==='1')return res.json(await audioWaveform(file));
  return res.sendFile(file);
}
