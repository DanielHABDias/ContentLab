import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const statIdentity=file=>{
  const s=fs.statSync(file,{bigint:true});
  return {path:path.resolve(file),size:String(s.size),mtimeNs:String(s.mtimeNs)};
};
const manifestWrite=(file, data)=>{
  const temp=path.join(path.dirname(file),'.manifest-'+crypto.randomUUID()+'.tmp');
  try {fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n');fs.renameSync(temp,file);}
  finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
};
export function idFilename(id){
  const name=String(id).replace(/[^a-zA-Z0-9_-]/g,'-').replace(/^-+|-+$/g,'').slice(0,64)||'scene';
  const tag=crypto.createHash('sha256').update(String(id)).digest('hex').slice(0,16);
  return name+'-'+tag+'.mp4';
}
export class SegmentCache{
  constructor(directory){
    this.directory=path.resolve(directory);
    if(fs.existsSync(this.directory)&&fs.lstatSync(this.directory).isSymbolicLink())throw Error('Cache não pode ser link simbólico.');
    fs.mkdirSync(this.directory,{recursive:true});
    this.manifest=path.join(this.directory,'manifest.json');
    if(fs.existsSync(this.manifest)&&fs.lstatSync(this.manifest).isSymbolicLink())throw Error('Manifesto não pode ser link simbólico.');
    try {
      const data=JSON.parse(fs.readFileSync(this.manifest,'utf8'));
      this.entries=data.format==='contentlab-segments'&&data.entries&&typeof data.entries==='object'?data.entries:{};
    } catch{this.entries={};}
  }
  destination(id){return path.join(this.directory,idFilename(id));}
  lookup(id,fingerprint){
    const entry=this.entries[id],file=this.destination(id);
    if(entry?.fingerprint!==fingerprint||!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())return null;
    try{
      const st=statIdentity(file);
      return st.size==='0'||st.size!==entry.size||st.mtimeNs!==entry.mtimeNs?null:file;
    }catch{return null;}
  }
  save(id,fingerprint,staged){
    const target=this.destination(id);
    if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('Destino de cache inseguro.');
    fs.renameSync(staged,target);
    const st=statIdentity(target);
    if(st.size==='0')throw Error('Cena sem vídeo: '+id);
    this.entries[id]={fingerprint,file:path.basename(target),size:st.size,mtimeNs:st.mtimeNs};
    manifestWrite(this.manifest,{format:'contentlab-segments',entries:this.entries});
    return target;
  }
  valid(){return Object.entries(this.entries).every(([id,entry])=>this.lookup(id,entry.fingerprint));}
}
export function rendererIdentity(appRoot){
  const files=[];
  for(const directory of ['backend/remotion/src','server']){
    const root=path.join(appRoot,directory);
    if(!fs.existsSync(root))continue;
    const walk=dir=>{
      for(const e of fs.readdirSync(dir,{withFileTypes:true})){
        const full=path.join(dir,e.name);
        if(e.isDirectory())walk(full);
        else if(/\.(tsx?|mjs|js)$/.test(e.name))files.push(statIdentity(full));
      }
    };
    walk(root);
  }
  const lock=path.join(appRoot,'backend/remotion/package-lock.json');
  if(fs.existsSync(lock))files.push(statIdentity(lock));
  return hash(files.sort((a,b)=>a.path.localeCompare(b.path)));
}
export function sceneFingerprint(raw,compiled,settings,resolvedAssets,words,rendererKey){
  const uris=new Set();
  if(raw.background?.asset)uris.add(raw.background.asset);
  for(const e of raw.elements||[])for(const k of ['asset','fontAsset'])if(e[k])uris.add(e[k]);
  const relevant=(raw.elements||[]).some(e=>e.type==='caption'||e.type==='kinetic_text');
  return hash({
    rendererKey,
    scene:raw,
    settings:{width:settings.width,height:settings.height,fps:settings.fps,seed:settings.seed},
    assets:[...uris].sort().map(uri=>[uri,resolvedAssets[uri]&&fs.existsSync(resolvedAssets[uri])?statIdentity(resolvedAssets[uri]):null]),
    transcript:relevant?words.filter(w=>w.end>compiled.start&&w.start<compiled.end):[],
  });
}
export function cleanOutput(root,dependencies=[]){
  const out=path.join(path.resolve(root),'output');
  if(fs.existsSync(out)&&fs.lstatSync(out).isSymbolicLink())throw Error('output não pode ser link simbólico.');
  for(const src of dependencies){
    if(!src)continue;
    const f=path.resolve(src);
    if(f===out||f.startsWith(out+path.sep))throw Error('Um asset de entrada está em output; recusei apagar os arquivos.');
  }
  if(fs.existsSync(out))fs.rmSync(out,{recursive:true,force:false});
}
