import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {APP_ROOT} from './plan.mjs';
import {run} from './exec.mjs';

// Official standalone releases, pinned hashes checked before execution.
const builds={
  ytdlp:{version:'2026.08.19',repo:'yt-dlp/yt-dlp',files:{
    'linux-x64':['yt-dlp_linux','58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a'],
    'linux-arm64':['yt-dlp_linux_aarch64','b16e4dab368a816cd05d477d698a605a6ae87ccee1c8ffd38fa21d7254141fcc'],
    'win32-x64':['yt-dlp.exe','66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a'],
    'win32-arm64':['yt-dlp_arm64.exe','05b438997bafc3affdfda9d041353c9d73e04dc842207254b655b0887c4445b0']
  }},
  uv:{version:'0.13.3',repo:'astral-sh/uv',files:{
    'linux-x64':['uv-x86_64-unknown-linux-musl.tar.gz','a36fca4c151d1ac13707984a88a4e2742edec0f2bc1b3e1c18c1c751e4679fd3'],
    'linux-arm64':['uv-aarch64-unknown-linux-musl.tar.gz','4a58785768ab0577497ca7940be2f9fd5a34e48c3fd37923692fc0a81d71ac9f'],
    'win32-x64':['uv-x86_64-pc-windows-msvc.zip','bb701bd35b586c45966654ea2703c9bd116a6a4fc0a8ca755bd644c2c41c5ebe'],
    'win32-arm64':['uv-aarch64-pc-windows-msvc.zip','aeaca1a1b721c1686c09b4aa23d57f938df049bed1b8e534b5bf79a032b8b87b']
  }}
};
const pending=new Map();
function directory(name){fs.mkdirSync(name,{recursive:true});if(fs.lstatSync(name).isSymbolicLink())throw Error('Pasta de ferramenta não pode ser link simbólico.');return name;}
export function portableToolPath(name,{root=APP_ROOT,platform=process.platform}={}){
  return path.join(root,'.tools',name,name==='ytdlp'?'yt-dlp'+(platform==='win32'?'.exe':''):'uv'+(platform==='win32'?'.exe':''));
}
export async function downloadVerified(url,file,hash,{signal,fetcher=fetch,maxBytes=150*1024*1024}={}){
  const response=await fetcher(url,{signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(300000)])});
  if(!response.ok||!response.body)throw Error('Falha no download oficial: HTTP '+response.status);
  const digest=crypto.createHash('sha256');let size=0;const fd=fs.openSync(file,'wx',0o700);
  try{for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes)throw Error('Download excedeu o limite.');digest.update(chunk);fs.writeFileSync(fd,chunk);}}
  finally{fs.closeSync(fd);}
  if(digest.digest('hex')!==hash)throw Error('Checksum SHA256 inválido; ferramenta não será executada.');
}
export async function ensurePortableTool(name,{root=APP_ROOT,platform=process.platform,arch=process.arch,signal,update=()=>{},fetcher=fetch,runner=run}={}){
  const spec=builds[name],build=spec?.files[platform+'-'+arch];
  if(!build)throw Error('Ferramenta '+name+' indisponível para '+platform+'/'+arch+'.');
  const tools=directory(path.join(root,'.tools')),base=directory(path.join(tools,name)),executable=portableToolPath(name,{root,platform});
  const stamp=path.join(base,'installed.json');
  try{
    const metadata=JSON.parse(fs.readFileSync(stamp));
    if(metadata.version===spec.version&&!fs.lstatSync(executable).isSymbolicLink()&&crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex')===metadata.sha256){
      // A stored executable must also match the pinned release (or verified uv archive).
      if(name!=='ytdlp'||metadata.sha256===build[1]){await runner(executable,['--version'],{signal});return executable;}
    }
  }catch(error){if(signal?.aborted)throw error;}
  if(pending.has(executable)){await pending.get(executable);signal?.throwIfAborted();return executable;}
  const promise=(async()=>{
    update('Preparando '+name+' '+spec.version+' automaticamente...');
    const stage=fs.mkdtempSync(path.join(base,'.install-'));
    try{
      const archive=path.join(stage,build[0]);
      await downloadVerified('https://github.com/'+spec.repo+'/releases/download/'+spec.version+'/'+build[0],archive,build[1],{signal,fetcher});
      let source=archive;
      if(name==='uv'){
        if(platform==='win32'){
          const quote=value=>"'"+value.replaceAll("'","''")+"'";
          const command="$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath "+quote(archive)+' -DestinationPath '+quote(path.join(stage,'unpacked'));
          await runner('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{signal});
        }
        else await runner('tar',['-xzf',archive,'-C',stage],{signal});
        const find=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isFile()&&entry.name===path.basename(executable))return file;if(entry.isDirectory()){const found=find(file);if(found)return found;}}};
        source=find(stage);if(!source)throw Error('Arquivo uv ausente no pacote verificado.');
      }
      fs.chmodSync(source,0o700);await runner(source,['--version'],{signal});
      const sha256=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
      fs.renameSync(source,executable);
      fs.writeFileSync(stamp,JSON.stringify({version:spec.version,sha256}));
      return executable;
    }finally{fs.rmSync(stage,{recursive:true,force:true});}
  })();pending.set(executable,promise);
  try{return await promise;}finally{pending.delete(executable);}
}

let pythonInstall;
export async function ensurePython({signal,update=()=>{}}={}){
  if(pythonInstall)return pythonInstall;
  pythonInstall=(async()=>{
    for(const bin of process.platform==='win32'?['python','python3']:['python3.12','python3.11','python3']){
      try{await run(bin,['-c','import sys,venv,ensurepip; assert (3,10)<=sys.version_info[:2]<=(3,12)'],{signal});return bin;}catch(e){if(signal?.aborted)throw e;}
    }
    const uv=await ensurePortableTool('uv',{signal,update});
    const env={...process.env,UV_PYTHON_INSTALL_DIR:path.join(APP_ROOT,'.tools','python'),UV_PYTHON_BIN_DIR:path.join(APP_ROOT,'.tools','python-bin'),UV_CACHE_DIR:path.join(APP_ROOT,'.tools','uv-cache')};
    update('Instalando Python 3.12 portátil dentro do Content Lab...');
    await run(uv,['python','install','3.12','--no-bin','--no-config'],{env,signal,onOutput:chunk=>update(chunk.trim().slice(-300))});
    const {stdout}=await run(uv,['python','find','3.12','--managed-python','--no-config'],{env,signal});
    const executable=stdout.trim();if(!fs.existsSync(executable))throw Error('Python portátil não foi preparado.');
    return executable;
  })();
  try{return await pythonInstall;}catch(e){pythonInstall=null;throw e;}
}
