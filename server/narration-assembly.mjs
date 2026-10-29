import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {run} from './exec.mjs';
import {voiceStudioFolder} from './voice-studio.mjs';
import {probeAudioDuration} from './audio.mjs';
import {transcribeAudio,transcriptTextLines} from './transcribe.mjs';

const pattern=/^(recording-|narration\.ai-)[a-f0-9-]{36}\.wav$/;
const manifest='narration.takes.json';
const srtTime=seconds=>{const ms=Math.round(seconds*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');};
export function boundedTranscript(doc,duration){
  const bound=entries=>entries.map(item=>({...item,start:Math.max(0,Number(item.start)),end:Math.min(duration,Number(item.end))})).filter(item=>Number.isFinite(item.start)&&Number.isFinite(item.end)&&item.end>item.start);
  if(!Array.isArray(doc.words)||!Array.isArray(doc.segments))throw Error('A transcrição deve conter palavras e trechos.');
  const result={...doc,words:bound(doc.words),segments:bound(doc.segments)};
  if(!result.words.length||!result.segments.length)throw Error('Não foram reconhecidas palavras dentro da duração da narração.');
  return result;
}
function audioDirectory(folder){const root=voiceStudioFolder(folder);fs.mkdirSync(path.join(root,'audio'),{recursive:true});return path.join(root,'audio');}
export function takesDirectory(folder){
  const directory=path.join(audioDirectory(folder),'takes');
  fs.mkdirSync(directory,{recursive:true});
  if(fs.lstatSync(directory).isSymbolicLink()||!fs.statSync(directory).isDirectory())throw Error('Pasta de tomadas inválida.');
  return directory;
}
export function resolveTake(folder,name){
  if(!pattern.test(String(name)))throw Error('Tomada inválida.');
  const directory=takesDirectory(folder);
  // Read older projects without moving or deleting existing recordings automatically.
  const current=path.join(directory,name),file=fs.existsSync(current)?current:path.join(audioDirectory(folder),name);
  if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile())throw Error('Tomada não encontrada.');
  return file;
}
function atomic(source,dest){const tmp=dest+'.next-'+crypto.randomUUID();try{fs.copyFileSync(source,tmp);fs.renameSync(tmp,dest);}finally{fs.rmSync(tmp,{force:true});}}
function writeManifest(folder,takes){
  const directory=takesDirectory(folder),file=path.join(directory,manifest),tmp=file+'.next-'+crypto.randomUUID();
  try{fs.writeFileSync(tmp,JSON.stringify({version:1,takes},null,2));fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}
  return takeList(folder);
}
export function takeList(folder){
  const directory=takesDirectory(folder),current=path.join(directory,manifest),file=fs.existsSync(current)?current:path.join(audioDirectory(folder),manifest);
  if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('Manifesto não pode ser link simbólico.');
  const text=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  const takes=text?JSON.parse(text).takes:[];
  if(!Array.isArray(takes))throw Error('Lista de tomadas inválida.');
  return {takes,revision:crypto.createHash('sha256').update(text).digest('hex')};
}
export function addTake(folder,{relative,duration,kind},replaceKind=false){
  const name=path.basename(relative);resolveTake(folder,name);
  if(!['recording','qwen'].includes(kind))throw Error('Tipo de tomada inválido.');
  const {takes}=takeList(folder);
  if(replaceKind)for(const take of takes)if(take.kind===kind)take.selected=false;
  takes.push({name,duration,kind,selected:true,createdAt:new Date().toISOString()});
  return writeManifest(folder,takes);
}
export async function rescanTakes(folder){
  const current=takeList(folder),found=new Map();
  for(const directory of [audioDirectory(folder),takesDirectory(folder)]){
    for(const item of fs.readdirSync(directory,{withFileTypes:true}))if(item.isFile()&&pattern.test(item.name))found.set(item.name,path.join(directory,item.name));
  }
  const takes=current.takes.filter(t=>found.has(t.name));
  for(const [name,file] of found){
    if(takes.some(t=>t.name===name)||takes.length>=1000)continue;
    try{const duration=await probeAudioDuration(file);takes.push({name,duration,kind:name.startsWith('recording-')?'recording':'qwen',selected:true,createdAt:fs.statSync(file).mtime.toISOString()});}catch{}
  }
  return JSON.stringify(current.takes)===JSON.stringify(takes)?current:writeManifest(folder,takes);
}
export function editTakes(folder,items,revision){
  const current=takeList(folder);
  if(current.revision!==revision)throw Error('As tomadas mudaram. Atualize a lista antes de editar.');
  if(!Array.isArray(items)||items.length!==current.takes.length||new Set(items.map(i=>i.name)).size!==items.length)throw Error('A lista deve preservar todas as tomadas; desmarque em vez de apagar.');
  const takes=items.map(item=>{
    const original=current.takes.find(t=>t.name===item.name);
    if(!original||typeof item.selected!=='boolean')throw Error('Tomada ou seleção inválida.');
    resolveTake(folder,item.name);return {...original,selected:item.selected};
  });return writeManifest(folder,takes);
}
export function deleteTake(folder,name,revision){
  const current=takeList(folder);
  if(current.revision!==revision)throw Error('As tomadas mudaram. Atualize a lista antes de excluir.');
  if(!current.takes.some(t=>t.name===name))throw Error('Tomada não encontrada.');
  const file=resolveTake(folder,name),trash=path.join(takesDirectory(folder),'.trash');
  fs.mkdirSync(trash,{recursive:true});
  if(fs.lstatSync(trash).isSymbolicLink()||!fs.statSync(trash).isDirectory())throw Error('Pasta de recuperação inválida.');
  const destination=fs.mkdtempSync(path.join(trash,'take-')),moved=[];
  try{
    for(const source of [file,file+'.json']){
      if(!fs.existsSync(source))continue;
      if(fs.lstatSync(source).isSymbolicLink()||!fs.statSync(source).isFile())throw Error('Arquivo da tomada inválido.');
      const target=path.join(destination,path.basename(source));fs.renameSync(source,target);moved.push({source,target});
    }
    return {...writeManifest(folder,current.takes.filter(t=>t.name!==name)),recovery:path.relative(voiceStudioFolder(folder),destination).split(path.sep).join('/')};
  }catch(error){
    for(const {source,target} of moved.reverse())fs.renameSync(target,source);
    fs.rmdirSync(destination);throw error;
  }
}
export function transcriptionOptions(raw={}){
  const model=raw.model||'base',language=raw.language??'pt',detail=raw.detail||'words';
  if(!['tiny','base','small','medium'].includes(model)||!['pt','en','es',''].includes(language)||!['words','segments'].includes(detail))throw Error('Opções de transcrição inválidas.');
  return {model,language,detail};
}
export async function finalizeTakes(folder,{kind='recording',transcription={},signal,update=()=>{},transcriber=transcribeAudio,ffmpeg='ffmpeg',ffprobe='ffprobe'}={}){
  const root=voiceStudioFolder(folder),directory=audioDirectory(root);
  if(!['recording','qwen'].includes(kind))throw Error('Tipo de narração inválido.');
  const takes=takeList(root).takes.filter(t=>t.kind===kind&&t.selected);
  if(!takes.length||takes.length>100)throw Error('Selecione de 1 a 100 tomadas.');
  const options=transcriptionOptions(transcription),revision=takeList(root).revision;
  const staging=fs.mkdtempSync(path.join(root,'.narration-assembly-'));
  const destinations=['audio/narration.wav','transcript.json','transcript.txt','transcript.srt','narration.build.json','transcript.build.json'];
  try{
    for(const name of destinations){const file=path.join(root,name);if(fs.existsSync(file)&&(!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink()))throw Error('Saída inválida ou link simbólico: '+name);}
    update('Unindo '+takes.length+' tomada(s), preservando os arquivos originais...');
    const inputs=takes.map(t=>resolveTake(root,t.name));
    // All streams are resampled before concat; no cuts, normalization or macros.
    const filters=inputs.map((_,i)=>`[${i}:a]aresample=48000,aformat=sample_fmts=${kind==='recording'?'s32':'s16'}:channel_layouts=mono[a${i}]`);
    filters.push(inputs.map((_,i)=>`[a${i}]`).join('')+`concat=n=${inputs.length}:v=0:a=1[out]`);
    const assembled=path.join(staging,'narration.wav');
    await run(ffmpeg,['-hide_banner','-loglevel','error',...inputs.flatMap(f=>['-i',f]),'-filter_complex',filters.join(';'),'-map','[out]','-c:a',kind==='recording'?'pcm_s24le':'pcm_s16le',assembled],{signal});
    // Finalização não processa áudio: todos os tratamentos ocorrem somente na aba Tratamento.
    update('Transcrevendo a narração final, já unificada...');
    const result=await transcriber(assembled,staging,{...options,signal,update});
    for(const name of ['transcript.json','transcript.txt','transcript.srt'])if(!fs.existsSync(path.join(staging,name)))throw Error('A transcrição não produziu '+name);
    if(signal?.aborted)throw Error('Finalização cancelada.');
    if(takeList(root).revision!==revision)throw Error('A seleção mudou durante a finalização. Tente novamente.');
    const duration=await probeAudioDuration(assembled,{ffprobe,signal});
    const transcript=boundedTranscript(JSON.parse(fs.readFileSync(path.join(staging,'transcript.json'),'utf8')),duration);
    fs.writeFileSync(path.join(staging,'transcript.json'),JSON.stringify(transcript,null,2)+'\n');
    const text=transcriptTextLines(transcript,options.detail).join('\n');
    fs.writeFileSync(path.join(staging,'transcript.txt'),text+'\n');
    fs.writeFileSync(path.join(staging,'transcript.srt'),transcript.segments.map((item,i)=>`${i+1}\n${srtTime(item.start)} --> ${srtTime(item.end)}\n${item.text}\n`).join('\n'));
    const source='audio/narration.wav';
    // Preserve a complete previous bundle, not only its corrected transcription.
    const previous=destinations.filter(name=>fs.existsSync(path.join(root,name)));
    const backup=previous.length?path.join(root,'narration-backup-'+Date.now()+'-'+crypto.randomUUID()):null;
    if(backup)for(const name of previous){const dest=path.join(backup,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,name),dest);}
    try{
      atomic(assembled,path.join(directory,'narration.wav'));
      for(const name of ['transcript.json','transcript.txt','transcript.srt'])atomic(path.join(staging,name),path.join(root,name));
      const stat=fs.statSync(path.join(directory,'narration.wav'));
      const meta={version:1,mode:'voice-studio',kind,source,output:'audio/narration.wav',neutral:source,outputIdentity:{size:stat.size,mtimeMs:stat.mtimeMs},duration,
        options:{voicePreset:'original',pitchSemitones:0,removeMiddleSilence:false,enhancementEngine:'off'},enhancement:{applied:false},treatment:null,processing:[],takes:takes.map(t=>t.name),...options,generatedAt:new Date().toISOString()};
      for(const name of ['narration.build.json','transcript.build.json']){const tmp=path.join(staging,name);fs.writeFileSync(tmp,JSON.stringify({...meta,narrationStamp:null},null,2));atomic(tmp,path.join(root,name));}
    }catch(error){
      for(const name of destinations){if(previous.includes(name))atomic(path.join(backup,name),path.join(root,name));else fs.rmSync(path.join(root,name),{force:true});}throw error;
    }
    return {...result,treatment:null,wordCount:transcript.words.length,segmentCount:transcript.segments.length,preview:text.slice(0,4500),relative:'audio/narration.wav',source,duration,takeCount:takes.length,projectRoot:root,backup:backup?path.basename(backup):null};
  }finally{fs.rmSync(staging,{recursive:true,force:true});}
}
