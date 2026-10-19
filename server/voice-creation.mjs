import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {APP_ROOT} from './plan.mjs';
import {run} from './exec.mjs';
import {voiceStudioFolder} from './voice-studio.mjs';
import {probeAudioDuration} from './audio.mjs';

export const QWEN_MODELS=Object.freeze(['0.6B','1.7B']);
const base=path.join(APP_ROOT,'.tools','qwen');
const pythonPath=()=>process.env.CONTENTLAB_QWEN_PYTHON||path.join(base,'venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const profilesDir=()=>path.join(base,'voices');
const worker=path.join(APP_ROOT,'server','qwen_worker.py');
const uuid=/^[a-f0-9-]{36}$/;
const numeric=(value,fallback,min,max,label)=>{
  const n=value===undefined?fallback:Number(value);
  if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' inválido.');
  return n;
};
export function generationOptions(raw={}){
  if(!QWEN_MODELS.includes(raw.model))throw Error('Modelo Qwen inválido.');
  const text=String(raw.text||'').trim();
  if(!text||text.length>12000)throw Error('Informe de 1 a 12.000 caracteres.');
  const language=raw.language||'Portuguese';
  if(!['Portuguese','English','Spanish','French','German','Italian','Russian','Chinese','Japanese','Korean'].includes(language))throw Error('Idioma inválido.');
  if(!['cpu','cuda'].includes(raw.device||'cpu'))throw Error('Dispositivo inválido.');
  const seed=raw.seed===undefined||raw.seed===''?null:Number(raw.seed);
  if(seed!==null&&(!Number.isSafeInteger(seed)||seed<0||seed>2147483647))throw Error('Seed inválida.');
  // Blank lines are intentional paragraph boundaries; long paragraphs split on punctuation.
  const chunks=[];
  for(const paragraph of text.split(/\n\s*\n/)){
    let buffer='';
    for(const piece of paragraph.match(/[^.!?]+[.!?]*\s*|[.!?]+/g)||[paragraph]){
      if(buffer.length+piece.length>400&&buffer.trim()){chunks.push(buffer.trim());buffer='';}
      if(piece.length>500){if(buffer.trim())chunks.push(buffer.trim());buffer='';for(let i=0;i<piece.length;i+=400)chunks.push(piece.slice(i,i+400).trim());}
      else buffer+=piece;
    }
    if(buffer.trim())chunks.push(buffer.trim());
  }
  return {model:raw.model,chunks,language,device:raw.device||'cpu',seed,
    temperature:numeric(raw.temperature,.9,.1,1.5,'Temperatura'),
    topP:numeric(raw.topP,.9,.1,1,'Top P'),
    repetitionPenalty:numeric(raw.repetitionPenalty,1.05,1,2,'Penalidade'),
    pauseSeconds:numeric(raw.pauseSeconds,.2,0,2,'Pausa entre trechos')};
}
function safeDirectory(directory){
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  if(fs.lstatSync(directory).isSymbolicLink())throw Error('Diretório não pode ser link simbólico.');
  return directory;
}
export function profiles(){
  const directory=safeDirectory(profilesDir());
  return fs.readdirSync(directory).filter(n=>n.endsWith('.json')).flatMap(n=>{
    try{const p=JSON.parse(fs.readFileSync(path.join(directory,n),'utf8'));return [{id:p.id,name:p.name,seconds:p.seconds}];}catch{return [];}
  });
}
export function profile(id){
  if(!uuid.test(String(id)))throw Error('Perfil de voz inválido.');
  const directory=safeDirectory(profilesDir());
  const metadata=path.join(directory,id+'.json'),audio=path.join(directory,id+'.wav');
  if(!fs.existsSync(metadata)||!fs.existsSync(audio)||fs.lstatSync(audio).isSymbolicLink()||fs.lstatSync(metadata).isSymbolicLink())throw Error('Perfil não encontrado.');
  return {...JSON.parse(fs.readFileSync(metadata,'utf8')),audio};
}
export async function saveProfile(file,{name,referenceText,consent},tools={}){
  if(consent!==true&&consent!=='true')throw Error('Confirme autorização para clonar esta voz.');
  name=String(name||'').trim();referenceText=String(referenceText||'').trim();
  if(!name||name.length>100||!referenceText||referenceText.length>3000)throw Error('Informe nome e transcrição fiel da amostra (até 3.000 caracteres).');
  const seconds=await probeAudioDuration(file,tools);
  if(seconds<3||seconds>60)throw Error('A amostra deve ter entre 3 e 60 segundos.');
  const id=crypto.randomUUID(),directory=safeDirectory(profilesDir()),audio=path.join(directory,id+'.wav');
  try{
    await run(tools.ffmpeg||'ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-vn','-ar','24000','-ac','1','-c:a','pcm_s16le',audio]);
    fs.chmodSync(audio,0o600);
    fs.writeFileSync(path.join(directory,id+'.json'),JSON.stringify({id,name,referenceText,seconds,consentAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});
    return {id,name,seconds};
  }catch(e){fs.rmSync(audio,{force:true});throw e;}
}
export async function saveRecording(file,folder,tools={}){
  const root=voiceStudioFolder(folder),directory=safeDirectory(path.join(safeDirectory(path.join(root,'audio')),'takes'));
  const name='recording-'+crypto.randomUUID()+'.wav',output=path.join(directory,name);
  try{
    await run(tools.ffmpeg||'ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-vn','-ar','48000','-ac','1','-c:a','pcm_s24le',output]);
    const duration=await probeAudioDuration(output,tools);
    if(duration<.1)throw Error('Gravação vazia.');
    // Future macro pipeline hook. Never process or overwrite a raw take here.
    return {file:output,relative:'audio/takes/'+name,duration};
  }catch(e){fs.rmSync(output,{force:true});throw e;}
}
export async function runtimeReady(){
  try{await run(pythonPath(),['-c','import qwen_tts, torch, soundfile, huggingface_hub']);return true;}catch{return false;}
}
export async function setupRuntime(update,signal){
  if(await runtimeReady())return;
  if(process.env.CONTENTLAB_QWEN_PYTHON)throw Error('O Python configurado não contém qwen-tts e PyTorch.');
  safeDirectory(base);
  const venv=path.join(base,'venv');
  if(!fs.existsSync(pythonPath())){
    let created=false;
    for(const [binary,prefix] of (process.platform==='win32'?[['py',['-3.12']],['python',[]]]:[['python3.12',[]],['python3',[]]])){
      try{await run(binary,[...prefix,'-c','import sys; assert (3,10)<=sys.version_info[:2]<=(3,12)']);
        await run(binary,[...prefix,'-m','venv',venv],{signal});created=true;break;}catch(e){if(signal?.aborted)throw e;}
    }
    if(!created)throw Error('Instale Python 3.12 com suporte a venv e tente novamente.');
  }
  const log=chunk=>update(String(chunk).trim().slice(-350));
  update('Instalando PyTorch CPU em ambiente isolado...');
  await run(pythonPath(),['-m','pip','install','torch','torchaudio','--index-url','https://download.pytorch.org/whl/cpu'],{signal,onOutput:log});
  await run(pythonPath(),['-m','pip','install','qwen-tts==0.1.1','soundfile','transformers==4.57.3'],{signal,onOutput:log});
  if(!await runtimeReady())throw Error('Não foi possível validar o ambiente Qwen.');
}
export async function modelState(){
  // HF checks are performed through the same Python/cache used for generation.
  const ready=await runtimeReady();
  let installed=[];
  if(ready){try{
    const {stdout}=await run(pythonPath(),['-c',"import json; from huggingface_hub import snapshot_download; found=[]\nfor s in ['0.6B','1.7B']:\n try:\n  p=snapshot_download('Qwen/Qwen3-TTS-12Hz-'+s+'-Base',local_files_only=True); from pathlib import Path; assert list(Path(p).glob('*.safetensors')); found.append(s)\n except Exception: pass\nprint(json.dumps(found))"]);
    installed=JSON.parse(stdout.trim().split('\n').at(-1));
  }catch{}}
  return {runtimeReady:ready,models:QWEN_MODELS.map(id=>({id,installed:installed.includes(id)})),profiles:profiles()};
}
export async function qwenTask(request,{signal,update=()=>{}}={}){
  if(!QWEN_MODELS.includes(request.model))throw Error('Modelo inválido.');
  if(!await runtimeReady())throw Error('Prepare o ambiente de IA primeiro.');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-qwen-'));
  const requestFile=path.join(directory,'request.json');
  fs.writeFileSync(requestFile,JSON.stringify(request),{mode:0o600});
  let pending='';
  try{await run(pythonPath(),[worker,requestFile],{signal,onOutput:(chunk,stream)=>{
    if(stream==='stdout'){
      pending+=chunk;const lines=pending.split('\n');pending=lines.pop();
      for(const line of lines){try{const event=JSON.parse(line);if(event.message)update(event.message);}catch{}}
    }else if(/\d+%|Downloading|Fetching/.test(chunk))update(chunk.trim().slice(-300));
  }});}finally{fs.rmSync(directory,{recursive:true,force:true});}
}
