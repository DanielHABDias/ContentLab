import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {APP_ROOT} from './plan.mjs';
import {run} from './exec.mjs';
import {probeAudioDuration} from './audio.mjs';

// Pinned upstream release; SHA-256 checked before executing downloaded code.
const release='https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/';
const builds={
  'linux-x64':['deep-filter-0.5.6-x86_64-unknown-linux-musl','70775e251eee44c0f2451a1e833326cf8bcbbe304d3e7cd12851e6fce72ef7da'],
  'win32-x64':['deep-filter-0.5.6-x86_64-pc-windows-msvc.exe','75e11fa16445f560cb6b021521ddb89e89270d13b83089705d98776f58fd7915']
};
let installing=null;
export function enhancementOptions(raw={}){
  const engine=raw.enhancementEngine??'off',mode=raw.enhancementMode??'natural';
  const strength=Number(raw.enhancementStrength??80);
  if(!['off','deepfilter'].includes(engine))throw Error('Aprimoramento de voz desconhecido.');
  if(!['natural','strong'].includes(mode))throw Error('Modo de aprimoramento inválido.');
  if(!Number.isFinite(strength)||strength<0||strength>100)throw Error('Intensidade deve ficar entre 0 e 100%.');
  return {enhancementEngine:engine,enhancementMode:mode,enhancementStrength:strength};
}
function checkedDirectory(directory){
  fs.mkdirSync(directory,{recursive:true});
  if(fs.lstatSync(directory).isSymbolicLink()||!fs.statSync(directory).isDirectory())throw Error('Pasta do aprimoramento inválida.');
  return directory;
}
export async function ensureEnhancer({signal,update=()=>{}}={}){
  const build=builds[process.platform+'-'+process.arch];
  if(!build)throw Error('Download automático do aprimoramento disponível em Linux x64 e Windows x64.');
  const directory=checkedDirectory(path.join(checkedDirectory(path.join(APP_ROOT,'.tools')),'voice-enhancement'));
  const executable=path.join(directory,build[0]);
  const valid=file=>fs.existsSync(file)&&!fs.lstatSync(file).isSymbolicLink()&&fs.statSync(file).isFile()&&crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===build[1];
  if(valid(executable))return executable;
  if(installing){await installing;signal?.throwIfAborted();return ensureEnhancer({signal,update});}
  installing=(async()=>{
    update('Baixando aprimoramento de voz por IA (35 MB, somente no primeiro uso)...');
    const temporary=executable+'.download-'+crypto.randomUUID();
    try{
      const response=await fetch(release+build[0],{signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(180000)])});
      if(!response.ok||!response.body)throw Error('Não foi possível baixar DeepFilterNet: HTTP '+response.status);
      const fd=fs.openSync(temporary,'wx',0o700);let size=0;
      try{for await(const chunk of response.body){size+=chunk.length;if(size>80*1024*1024)throw Error('Download do aprimoramento excedeu o limite.');fs.writeFileSync(fd,chunk);}}finally{fs.closeSync(fd);}
      if(!valid(temporary))throw Error('A verificação de integridade do aprimoramento falhou.');
      fs.chmodSync(temporary,0o700);fs.renameSync(temporary,executable);
    }finally{fs.rmSync(temporary,{force:true});}
  })();
  try{await installing;}finally{installing=null;}
  return executable;
}
export async function enhanceVoice(input,output,raw={}, {signal,update=()=>{},ffmpeg='ffmpeg',ffprobe='ffprobe',runner=run,installer=ensureEnhancer}={}){
  const options=enhancementOptions(raw);
  if(options.enhancementEngine==='off'||options.enhancementStrength===0){fs.copyFileSync(input,output);return {applied:false,...options};}
  const executable=await installer({signal,update});
  const stage=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-enhance-'));
  try{
    signal?.throwIfAborted();
    update('Separando a voz do ruído com IA ('+(options.enhancementMode==='strong'?'limpeza forte':'natural')+')...');
    const source=path.join(stage,'source.wav'),out=path.join(stage,'out');fs.mkdirSync(out);
    const duration=await probeAudioDuration(input,{ffprobe,signal});
    await runner(ffmpeg,['-hide_banner','-loglevel','error','-i',input,'-vn','-ar','48000','-ac','1','-c:a','pcm_s16le',source],{signal});
    // Delay compensation is mandatory: words must stay at their original timestamps.
    await runner(executable,['-D',...(options.enhancementMode==='strong'?['--pf']:[]),'-o',out,source],{signal});
    const files=fs.readdirSync(out).filter(name=>name.toLowerCase().endsWith('.wav'));
    if(files.length!==1)throw Error('O aprimoramento não produziu um áudio válido.');
    const cleaned=path.join(out,files[0]);
    const cleanedDuration=await probeAudioDuration(cleaned,{ffprobe,signal});
    if(Math.abs(cleanedDuration-duration)>.1)throw Error('O aprimoramento alterou a duração. O original foi preservado.');
    const mix=options.enhancementStrength/100;
    await runner(ffmpeg,['-hide_banner','-loglevel','error','-i',source,'-i',cleaned,'-filter_complex',
      `[0:a][1:a]amix=inputs=2:weights='${1-mix} ${mix}':normalize=0:duration=first,apad=whole_dur=${duration},atrim=end=${duration}[a]`,
      '-map','[a]','-ar','48000','-ac','1','-c:a','pcm_s16le',output],{signal});
    signal?.throwIfAborted();
    if(Math.abs(await probeAudioDuration(output,{ffprobe,signal})-duration)>.002)throw Error('Duração final do aprimoramento inválida.');
    return {applied:true,version:'DeepFilterNet 0.5.6',...options};
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
