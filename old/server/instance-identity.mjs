import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sources=[
  'server/http.mjs','server/voice-studio.mjs','server/exec.mjs',
  'server/runtime-tools.mjs','server/instance-identity.mjs',
  'scripts/bootstrap-linux.sh','scripts/bootstrap-windows.ps1'
];
export function instanceIdentity(directory=root){
  const directoryId=crypto.createHash('sha256').update(path.resolve(directory)).digest('hex');
  const hash=crypto.createHash('sha256').update(directoryId);
  for(const relative of sources){
    const file=path.join(directory,relative);
    hash.update(relative).update(fs.existsSync(file)?fs.readFileSync(file):'missing');
  }
  return {directoryId,signature:hash.digest('hex')};
}
export function startupAction(remote,current,{hasLocalPid=false}={}){
  if(!remote)return 'start';
  if(remote.backend!=='node'||remote.renderer!=='remotion')return 'occupied';
  if(remote.directoryId&&remote.directoryId!==current.directoryId)return 'occupied';
  if(remote.signature===current.signature)return 'reuse';
  // An old server without identity can only be restarted if this launcher
  // previously started it (its per-user pid file is available).
  if(!remote.directoryId&&!hasLocalPid)return 'occupied';
  return 'restart';
}
