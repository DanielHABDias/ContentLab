import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {APP_ROOT} from './plan.mjs';
import {run} from './exec.mjs';
import {runRemotionWithEncodingFallback} from './remotion-encoding.mjs';
import {stageCustomScene} from './custom-scenes.mjs';

const REMOTION_DIR=path.join(APP_ROOT,'backend','remotion');
const GREEN_SCREEN_STYLES=new Set(['green_screen','green_screen_default','green_screen_soft']);
/**
 * Remotion's parallel encoding pipes frames to an encoder while Chromium
 * continues producing them. A closed encoder pipe can surface as an unhandled
 * write EPIPE near the end of an otherwise valid custom TSX scene.
 *
 * Prefer the sequential frame-render -> encode path for reliable local jobs.
 * Users who have verified parallel encoding on their machine may opt in.
 * https://www.remotion.dev/docs/options/disallow-parallel-encoding
 */
export function remotionCliRenderOptions(env=process.env){
  return [
    '--log',env.CONTENTLAB_REMOTION_DEBUG==='1'?'verbose':'info',
    ...(env.CONTENTLAB_REMOTION_PARALLEL_ENCODING==='1'?[]:['--disallow-parallel-encoding']),
  ];
}

export function transcriptWords(transcript){
  if(!transcript)return [];
  const words=[];
  const add=w=>{
    const word=String(w.word||w.text||'').trim(),start=Number(w.start),end=Number(w.end);
    if(word&&Number.isFinite(start)&&end>start)words.push({word,start,end});
  };
  for(const w of transcript.words||[])add(w);
  // Canonical word-level timestamps take precedence over duplicate segment summaries.
  if(words.length)return words.sort((a,b)=>a.start-b.start||a.end-b.end);
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
export function applyNarrationSilence(words,inserts=[]){
  const shifted=words.map(word=>({...word}));
  for(const {at,duration} of [...inserts].sort((a,b)=>a.at-b.at)){
    for(const word of shifted){
      if(word.start>=at){
        word.start=Number((word.start+duration).toFixed(6));
        word.end=Number((word.end+duration).toFixed(6));
      }else if(word.end>at){
        word.end=Number((word.end+duration).toFixed(6));
      }
    }
  }
  return shifted;
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
export async function renderRemotionScene(scene,settings,words,output,{signal,hardwareAccel=false,onHardwareFallback}={}){
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
  // The Remotion video layer does not interpret the green_screen style itself.
  // Prepare an alpha WebM for the VISUAL layer; audio is mixed separately from
  // the original asset by the Node/FFmpeg audio pipeline.
  const keyedOverlays=new Map();
  try{
    for(const element of scene.elements){
      if(element.type!=='overlay'||!GREEN_SCREEN_STYLES.has(element.style)||!element.asset_path)continue;
      const config=element.config||{};
      const color=String(config.keyColor||'#00FF00');
      const similarity=Number(config.similarity??0.28);
      const blend=Number(config.blend??0.08);
      if(!/^#[0-9a-fA-F]{6}$/.test(color)||!Number.isFinite(similarity)||similarity<0.01||similarity>1||
         !Number.isFinite(blend)||blend<0||blend>1)
        throw Error('Parâmetros de chroma key inválidos na camada '+element.id+'.');
      const output=path.join(work,'chroma-'+keyedOverlays.size+'.webm');
      const filter='format=rgba,colorkey=0x'+color.slice(1)+':'+similarity+':'+blend+',format=yuva420p';
      await run(process.env.FFMPEG_PATH||'ffmpeg',[
        '-nostdin','-hide_banner','-loglevel','error','-i',element.asset_path,
        '-vf',filter,'-an','-c:v','libvpx-vp9','-b:v','0','-crf','28',
        '-auto-alt-ref','0','-y',output,
      ],{signal});
      if(!fs.existsSync(output)||fs.statSync(output).size===0)throw Error('Chroma key não gerou vídeo com transparência.');
      keyedOverlays.set(element,output);
    }
  }catch(error){fs.rmSync(work,{recursive:true,force:true});throw error;}
  const elements=scene.elements.filter(e=>e.type!=='sfx').map((e,i)=>{
    const data={...e};
    for(const key of ['asset_path','font_path','region','z'])delete data[key];
    if(e.type==='kinetic_text')data.phraseWords=phraseWords(e.text,e.start,e.end,words);
    const fontPath=e.font_path||bundledFont(e);
    return {id:e.id,type:e.type,start:e.start,end:e.end,z:e.z,region:e.region,
      src:linked(keyedOverlays.get(e)||e.asset_path),fontSrc:linked(fontPath),fontFamily:'contentlab-font-'+i,data};
  });
  const customAssets={};
  for(const [name,uri] of Object.entries(scene.customComponent?.assets||{}))
    customAssets[name]=linked(scene.customComponent?.assetPaths?.[name]);
  const props={width:settings.width,height:settings.height,fps:settings.fps,
    durationInFrames:Math.max(1,Math.round((scene.end-scene.start)*settings.fps)),
    scene:{id:scene.id,start:scene.start,end:scene.end,background:scene.background,
      backgroundSrc:linked(scene.background_path),camera:scene.camera,elements,customComponent:scene.customComponent?{mode:scene.customComponent.mode||'replace',props:scene.customComponent.props||{}}:undefined},words,customAssets};
  const propsFile=path.join(work,'props.json');
  fs.writeFileSync(propsFile,JSON.stringify(props));
  let custom=null;
  try{
    if(scene.customComponent)custom=stageCustomScene(scene.customComponent,REMOTION_DIR);
  }catch(error){fs.rmSync(work,{recursive:true,force:true});throw error;}
  const entry=custom?.entry||path.join(REMOTION_DIR,'src','index.ts');
  const command=[cli,'render',entry,'Scene',output,
    '--props',propsFile,'--public-dir',publicDir,'--codec','h264',
    '--timeout',String(Math.max(30000,Number(process.env.CONTENTLAB_REMOTION_TIMEOUT_MS||90000))),
    '--concurrency',String(Math.max(1,Number(process.env.CONTENTLAB_REMOTION_CONCURRENCY||1))),
    ...remotionCliRenderOptions(),'--overwrite'];
  if(hardwareAccel)command.push('--hardware-acceleration=if-possible');
  try{
    await runRemotionWithEncodingFallback(command,{
      hardwareAccel,signal,
      execute:args=>run(process.execPath,args,{cwd:REMOTION_DIR,signal}),
      onFallback:()=>{
        console.warn('[ContentLab] NVENC indisponível. Repetindo esta cena com H.264 por CPU; GPU desativada para as próximas cenas.');
        onHardwareFallback?.();
      },
    });
    if(!fs.existsSync(output)||fs.statSync(output).size===0)throw Error('O Remotion não gerou MP4.');
    return output;
  }finally{
    fs.rmSync(work,{recursive:true,force:true});
    if(custom?.directory)fs.rmSync(custom.directory,{recursive:true,force:true});
  }
}
