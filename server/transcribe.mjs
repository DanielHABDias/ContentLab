import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {run} from './exec.mjs';

const parseTime=value=>{
  if(typeof value==='number')return value/1000;
  const match=String(value||'').match(/(\d+):(\d+):(\d+)[.,](\d+)/);
  if(!match)return NaN;
  return Number(match[1])*3600+Number(match[2])*60+Number(match[3])+Number('0.'+match[4]);
};
function normalizeNative(doc){
  const raw=doc.transcription||doc.segments||[];
  const segments=[];
  for(const item of raw){
    const start=item.offsets?.from!==undefined?Number(item.offsets.from)/1000:
      Number.isFinite(item.start)?Number(item.start):parseTime(item.timestamps?.from);
    const end=item.offsets?.to!==undefined?Number(item.offsets.to)/1000:
      Number.isFinite(item.end)?Number(item.end):parseTime(item.timestamps?.to);
    const text=String(item.text||item.word||'').trim();
    if(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&text)segments.push({start,end,text});
  }
  return segments;
}
const formatTime=seconds=>{
  const t=Math.max(0,Math.round(seconds*1000)),h=Math.floor(t/3600000),m=Math.floor(t/60000)%60,
    s=Math.floor(t/1000)%60,ms=t%1000;
  return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+','+String(ms).padStart(3,'0');
};
export async function transcribeAudio(file,projectRoot,{model='base',language='pt',signal,update=()=>{}}={}){
  const bin=process.env.CONTENTLAB_WHISPER_CLI||'whisper-cli';
  const models=process.env.CONTENTLAB_WHISPER_MODEL_DIR||path.join(os.homedir(),'.cache','whisper.cpp');
  const modelFile=process.env.CONTENTLAB_WHISPER_MODEL||path.join(models,'ggml-'+model+'.bin');
  if(!fs.existsSync(modelFile))throw Error('Modelo whisper.cpp não instalado: '+modelFile);
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-transcribe-'));
  try{
    const converted=path.join(work,'voice-16k.wav'),prefix=path.join(work,'result');
    update('Convertendo áudio para 16 kHz...');
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',file,'-ar','16000','-ac','1','-c:a','pcm_s16le',converted],{signal});
    update('Executando transcrição pelo whisper.cpp...');
    await run(bin,['-m',modelFile,'-f',converted,'-l',language||'pt','-ml','1','-sow','-oj','-of',prefix],{signal});
    const nativeJson=prefix+'.json';
    if(!fs.existsSync(nativeJson))throw Error('Whisper.cpp não produziu arquivo JSON.');
    const segments=normalizeNative(JSON.parse(fs.readFileSync(nativeJson,'utf8')));
    if(!segments.length)throw Error('Não foi possível reconhecer falas na gravação.');
    // -ml 1 + -sow make whisper.cpp emit word-sized timestamped
    // segments instead of spreading sentence durations evenly across tokens.
    const words=segments.flatMap(segment=>{
      const tokens=segment.text.split(/\s+/).filter(Boolean);
      const step=(segment.end-segment.start)/tokens.length;
      return tokens.map((word,i)=>({word,
        start:Number((segment.start+i*step).toFixed(3)),
        end:Number((segment.start+(i+1)*step).toFixed(3))}));
    });
    // Readable segments remain separate from word-level timing. Audio gaps
    // between individual words remain present in the timestamp sequence.
    const grouped=[];let current=null;
    for(const word of words){
      if(!current||word.start-current.end>.65||current.end-current.start>5||
        /[.!?]$/.test(current.text)){
        current={start:word.start,end:word.end,text:word.word};grouped.push(current);
      }else{
        current.end=word.end;
        current.text+=(/^[,.;!?]/.test(word.word)?'':' ')+word.word;
      }
    }
    const doc={language,segments:grouped,words,wordTiming:'whisper-word-segments'};
    fs.writeFileSync(path.join(projectRoot,'transcript.json'),JSON.stringify(doc,null,2)+'\n');
    fs.writeFileSync(path.join(projectRoot,'transcript.txt'),grouped.map(s=>'['+s.start.toFixed(2)+' → '+s.end.toFixed(2)+'] '+s.text).join('\n')+'\n');
    const srt=grouped.map((s,i)=>(i+1)+'\n'+formatTime(s.start)+' --> '+formatTime(s.end)+'\n'+s.text+'\n').join('\n');
    fs.writeFileSync(path.join(projectRoot,'transcript.srt'),srt);
    update('Transcrição concluída.');
    return {segmentCount:grouped.length,wordCount:words.length,language,preview:grouped.map(s=>s.text).join('\n').slice(0,4500)};
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
