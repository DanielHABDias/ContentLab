import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {APP_ROOT} from './plan.mjs';
import {run} from './exec.mjs';
import {ensurePython} from './portable-tools.mjs';

export const CHATTERBOX_MODEL='chatterbox-multilingual';
export const CHATTERBOX_LABEL='Chatterbox Multilingual V3 · expressivo';
const base=path.join(APP_ROOT,'.tools','chatterbox');
const python=()=>process.env.CONTENTLAB_CHATTERBOX_PYTHON||path.join(base,'venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const worker=path.join(APP_ROOT,'server','chatterbox_worker.py');
let runtimeCheck=null,runtimeCheckedAt=0,runtimePython=null;
export async function chatterboxReady(){
  const executable=python();
  if(!fs.existsSync(executable))return false;
  if(runtimePython!==executable||Date.now()-runtimeCheckedAt>30000||!runtimeCheck){
    runtimePython=executable;runtimeCheckedAt=Date.now();
    runtimeCheck=run(executable,['-c','from chatterbox.mtl_tts import ChatterboxMultilingualTTS; import soundfile']).then(()=>true,()=>false);
  }
  return runtimeCheck;
}
export async function setupChatterbox(update=()=>{},signal){
  if(await chatterboxReady())return;
  if(process.env.CONTENTLAB_CHATTERBOX_PYTHON)throw Error('O Python Chatterbox configurado não tem as dependências necessárias.');
  fs.mkdirSync(base,{recursive:true});
  if(fs.lstatSync(base).isSymbolicLink())throw Error('Diretório Chatterbox inválido.');
  if(!fs.existsSync(python())){
    await run(await ensurePython({update,signal}),['-m','venv',path.join(base,'venv')],{signal});
  }
  const onOutput=chunk=>update(String(chunk).trim().slice(-350));
  update('Preparando Chatterbox isoladamente (CPU). Download de dependências pode demorar...');
  await run(python(),['-m','pip','install','torch==2.6.0','torchaudio==2.6.0','--index-url','https://download.pytorch.org/whl/cpu'],{signal,onOutput});
  await run(python(),['-m','pip','install','chatterbox-tts==0.1.7','soundfile'],{signal,onOutput});
  runtimeCheck=null;
  if(!await chatterboxReady())throw Error('Falha ao validar o ambiente Chatterbox. Consulte o log; Qwen permanece independente.');
}
export async function chatterboxTask(request,{signal,update=()=>{}}={}){
  if(request.model!==CHATTERBOX_MODEL)throw Error('Modelo Chatterbox inválido.');
  if(!await chatterboxReady())throw Error('Prepare o ambiente Chatterbox em Configurações primeiro.');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-chatterbox-')),file=path.join(folder,'request.json');
  fs.writeFileSync(file,JSON.stringify(request),{mode:0o600});let pending='';
  try{
    const result=await run(python(),[worker,file],{signal,onOutput:(chunk,stream)=>{
      if(stream==='stdout'){pending+=chunk;const lines=pending.split('\n');pending=lines.pop();for(const line of lines){try{const event=JSON.parse(line);if(event.message)update(event.message);}catch{}}}
      else if(/Downloading|Fetching|\d+%/.test(chunk))update(chunk.trim().slice(-350));
    }});
    const event=result.stdout.trim().split('\n').reverse().map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(e=>e?.done);
    return event||{};
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
}
export async function chatterboxState(){
  const ready=await chatterboxReady();let installed=false;
  if(ready){try{installed=(await chatterboxTask({action:'state',model:CHATTERBOX_MODEL})).installed===true;}catch{}}
  return {runtimeReady:ready,model:{id:CHATTERBOX_MODEL,label:CHATTERBOX_LABEL,engine:'chatterbox',installed}};
}
