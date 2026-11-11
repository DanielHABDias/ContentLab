import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {APP_ROOT} from './plan.mjs';
import {run} from './exec.mjs';

const hashes={
  tiny:'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
  base:'60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  small:'1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
  medium:'6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208'
};
const pending=new Map();
export async function ensureWhisperModel(model,{env=process.env,root=APP_ROOT,signal,update=()=>{},runner=run}={}){
  if(!Object.hasOwn(hashes,model))throw Error('Modelo de transcrição inválido.');
  if(env.CONTENTLAB_WHISPER_MODEL){
    if(!fs.existsSync(env.CONTENTLAB_WHISPER_MODEL))throw Error('O modelo personalizado configurado não existe.');
    return env.CONTENTLAB_WHISPER_MODEL;
  }
  const base=env.CONTENTLAB_WHISPER_MODEL_DIR||path.join(root,'.tools','models'),name='ggml-'+model+'.bin';
  const target=path.join(base,name),cached=path.join(os.homedir(),'.cache','whisper.cpp',name);
  const exists=file=>fs.existsSync(file)&&fs.statSync(file).isFile()&&fs.statSync(file).size>0;
  if(exists(target))return target;if(exists(cached))return cached;
  if(pending.has(target)){await pending.get(target);signal?.throwIfAborted();return target;}
  const task=(async()=>{
    fs.mkdirSync(base,{recursive:true});if(fs.lstatSync(base).isSymbolicLink())throw Error('Pasta de modelos inválida.');
    const temp=target+'.partial-'+crypto.randomUUID();
    try{
      update('Baixando automaticamente Whisper '+model+'; o primeiro uso pode levar vários minutos...');
      const url='https://huggingface.co/ggerganov/whisper.cpp/resolve/main/'+name;
      // curl is prepared by the Linux bootstrap; ships with supported Windows 10/11.
      await runner(process.platform==='win32'?'curl.exe':'curl',['--fail','--location','--retry','3','--connect-timeout','20','--max-time','3600','--max-filesize','1700000000','--output',temp,url],{signal});
      const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(temp))hash.update(chunk);
      if(hash.digest('hex')!==hashes[model])throw Error('Checksum inválido do modelo Whisper; download não será usado.');
      fs.renameSync(temp,target);return target;
    }finally{fs.rmSync(temp,{force:true});}
  })();pending.set(target,task);
  try{return await task;}finally{pending.delete(target);}
}
