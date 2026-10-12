import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
// Only changes to the visual engine should invalidate existing scene MP4s.
// Hash bytes and project-relative names, never checkout-specific mtimes/paths.
export function rendererIdentity(appRoot){
  const files=[];
  const include=file=>{
    if(fs.existsSync(file)&&fs.statSync(file).isFile())
      files.push([path.relative(appRoot,file).split(path.sep).join('/'),
        crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]);
  };
  const walk=directory=>{
    if(!fs.existsSync(directory))return;
    for(const e of fs.readdirSync(directory,{withFileTypes:true})){
      const full=path.join(directory,e.name);
      if(e.isDirectory())walk(full);
      else if(e.isFile()&&/\\.(tsx?|jsx?|ttf|otf)$/i.test(e.name))include(full);
    }
  };
  walk(path.join(appRoot,'backend/remotion/src'));
  walk(path.join(appRoot,'builtin-assets/fonts'));
  include(path.join(appRoot,'server/remotion.mjs'));
  include(path.join(appRoot,'server/plan.mjs'));
  include(path.join(appRoot,'backend/remotion/package-lock.json'));
  return hash({visualEngine:'remotion-visual-2',files:files.sort((a,b)=>a[0].localeCompare(b[0]))});
}
const relativeTime=(value,start)=>typeof value==='number'?Number((value-start).toFixed(6)):value;
export function sceneFingerprint(raw,compiled,settings,resolvedAssets,words,rendererKey){
  const uris=new Set();
  if(raw.background?.asset)uris.add(raw.background.asset);
  const visualElements=(raw.elements||[]).filter(item=>item.type!=='sfx');
  for(const e of visualElements)for(const k of ['asset','fontAsset'])if(e[k])uris.add(e[k]);
  const relevant=visualElements.some(e=>e.type==='caption'||e.type==='kinetic_text');
  const scene={
    ...raw,start:0,end:Number((raw.end-raw.start).toFixed(6)),
    elements:visualElements.map(({muted,trimDb,fadeIn,fadeOut,...item})=>({
      ...item,start:relativeTime(item.start,raw.start),
      end:relativeTime(item.end,raw.start),
      at:relativeTime(item.at,raw.start)
    })),
  };
  delete scene.transitionOut;
  delete scene.transitionDuration;
  if(scene.background){
    scene.background={...scene.background};
    delete scene.background.muted;
  }
  const timestamps=relevant?words.filter(w=>w.end>compiled.start&&w.start<compiled.end)
    .map(w=>({word:w.word,start:relativeTime(w.start,compiled.start),
      end:relativeTime(w.end,compiled.start)})):[];
  return hash({
    rendererKey,scene,
    settings:{width:settings.width,height:settings.height,fps:settings.fps,seed:settings.seed},
    assets:[...uris].sort().map(uri=>[uri,resolvedAssets[uri]&&fs.existsSync(resolvedAssets[uri])?statIdentity(resolvedAssets[uri]):null]),
    transcript:timestamps
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
