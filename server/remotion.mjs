import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {APP_ROOT} from './plan.mjs';
import {run} from './exec.mjs';

const REMOTION_DIR=path.join(APP_ROOT,'backend','remotion');
export function transcriptWords(transcript){
  if(!transcript)return [];
  const words=[];
  const add=w=>{
    const word=String(w.word||w.text||'').trim(),start=Number(w.start),end=Number(w.end);
    if(word&&Number.isFinite(start)&&end>start)words.push({word,start,end});
  };
  for(const w of transcript.words||[])add(w);
  for(const segment of transcript.segments||[]){
    if(segment.words?.length){for(const w of segment.words)add(w);continue;}
    const items=String(segment.text||'').trim().split(/\s+/).filter(Boolean);
    if(!items.length)continue;
    const start=Number(segment.start||0),end=Number(segment.end||0);
    const step=Math.max(0.04,(end-start)/items.length);
    items.forEach((word,index)=>add({word,start:start+index*step,end:Math.min(end,start+(index+1)*step)}));
  }
  return words.sort((a,b)=>a.start-b.start||a.end-b.end);
}
function normalize(value){return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();}
export function remapTranscriptWords(words,cuts=[]){
  if(!cuts?.length)return words;
  let offset=0;
  const remapped=[];
  for(const cut of cuts){
    for(const word of words){
      const left=Math.max(Number(cut.start),word.start),right=Math.min(Number(cut.end),word.end);
      if(right>left)remapped.push({word:word.word,
        start:Number((offset+left-cut.start).toFixed(6)),
        end:Number((offset+right-cut.start).toFixed(6))});
    }
    offset+=Number(cut.end)-Number(cut.start);
  }
  return remapped;
}
export function phraseWords(text,start,end,words){
  const tokens=String(text||'').trim().split(/\s+/).filter(Boolean);
  if(!tokens.length)return [];
  const candidates=words.filter(w=>w.end>start&&w.start<end),wanted=tokens.map(normalize);
  for(let i=0;i+candidates.length>=i+tokens.length&&i+tokens.length<=candidates.length;i++)
    if(candidates.slice(i,i+tokens.length).map(w=>normalize(w.word)).every((v,j)=>v===wanted[j]))return candidates.slice(i,i+tokens.length);
  const step=Math.max(0.04,(end-start)/tokens.length);
  return tokens.map((word,i)=>({word,start:start+i*step,end:Math.min(end,start+(i+1)*step)}));
}
function bundledFont(item){
  const family=item.textStyle?.fontFamily||(['anton','anton_white','word_stack_vertical','word_stream_horizontal'].includes(item.style)?'Anton':item.style==='bangers'?'Bangers':'Arial');
  return family.toLowerCase().includes('banger')?path.join(APP_ROOT,'builtin-assets','fonts','Bangers-Regular.ttf'):
         family.toLowerCase().includes('anton')?path.join(APP_ROOT,'builtin-assets','fonts','Anton-Regular.ttf'):null;
}
export async function renderRemotionScene(scene,settings,words,output,{signal,hardwareAccel=false}={}){
  const cli=path.join(REMOTION_DIR,'node_modules','@remotion','cli','remotion-cli.js');
  if(!fs.existsSync(cli))throw Error('Dependências Remotion não instaladas. Rode npm ci --prefix backend/remotion.');
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-remotion-'));
  const publicDir=path.join(work,'public');
  fs.mkdirSync(publicDir);
  const files=new Map();
  const linked=(file,label)=>{
    if(!file||!fs.existsSync(file))return null;
    const source=fs.realpathSync(file);
    if(files.has(source))return files.get(source);
    const name='media-'+files.size+path.extname(source).toLowerCase();
    const dest=path.join(publicDir,name);
    try{fs.linkSync(source,dest);}catch{fs.copyFileSync(source,dest);}
    files.set(source,name);
    return name;
  };
  const elements=scene.elements.filter(e=>e.type!=='sfx').map((e,i)=>{
    const data={...e};
    for(const key of ['asset_path','font_path','region','z'])delete data[key];
    if(e.type==='kinetic_text')data.phraseWords=phraseWords(e.text,e.start,e.end,words);
    const fontPath=e.font_path||bundledFont(e);
    return {id:e.id,type:e.type,start:e.start,end:e.end,z:e.z,region:e.region,
      src:linked(e.asset_path),fontSrc:linked(fontPath),fontFamily:'contentlab-font-'+i,data};
  });
  const props={width:settings.width,height:settings.height,fps:settings.fps,
    durationInFrames:Math.max(1,Math.round((scene.end-scene.start)*settings.fps)),
    scene:{id:scene.id,start:scene.start,end:scene.end,background:scene.background,
      backgroundSrc:linked(scene.background_path),camera:scene.camera,elements},words};
  const propsFile=path.join(work,'props.json');
  fs.writeFileSync(propsFile,JSON.stringify(props));
  const command=[cli,'render',path.join(REMOTION_DIR,'src','index.ts'),'Scene',output,
    '--props',propsFile,'--public-dir',publicDir,'--codec','h264',
    '--timeout',String(Math.max(30000,Number(process.env.CONTENTLAB_REMOTION_TIMEOUT_MS||90000))),
    '--concurrency',String(Math.max(1,Number(process.env.CONTENTLAB_REMOTION_CONCURRENCY||1))),
    '--log','info','--overwrite'];
  if(hardwareAccel)command.push('--hardware-acceleration=if-possible');
  try{
    await run(process.execPath,command,{cwd:REMOTION_DIR,signal});
    if(!fs.existsSync(output)||fs.statSync(output).size===0)throw Error('O Remotion não gerou MP4.');
    return output;
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
