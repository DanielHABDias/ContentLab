import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function mediaToolExecutable(name,{directory=root,platform=process.platform,env=process.env}={}){
  if(name!=='ffmpeg'&&name!=='ffprobe')return name;
  const configured=env[name==='ffmpeg'?'CONTENTLAB_FFMPEG':'CONTENTLAB_FFPROBE'];
  if(configured)return configured;
  // The bootstrap installs a verified portable pair in .tools. Favor it even
  // when a different, older system FFmpeg appears first on PATH.
  const executable=path.join(directory,'.tools','ffmpeg',
    name+(platform==='win32'?'.exe':''));
  return fs.existsSync(executable)?executable:name;
}
export function ffmpegFilterAvailable(stdout,filter){
  const escaped=filter.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('^\\s*\\S+\\s+'+escaped+'\\s','m').test(String(stdout));
}
