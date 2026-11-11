import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {APP_ROOT,projectFile} from './plan.mjs';

export const libraryRoot=path.join(APP_ROOT,'scene-library');
export const sceneLibrary=()=>JSON.parse(fs.readFileSync(path.join(libraryRoot,'manifest.json'),'utf8'));
export function libraryFile(id,name){
 const item=sceneLibrary().find(x=>x.id===id);
 if(!item||typeof name!=='string'||name!==path.basename(name))throw Error('Arquivo de preset inválido.');
 const allowed=[item.file,'README.md',...(item.companions||[]).map(x=>path.basename(x)),...item.examples.map(x=>path.basename(x)),...item.previews.map(x=>path.basename(x))];
 if(!allowed.includes(name))throw Error('Arquivo não pertence ao preset.');
 return path.join(libraryRoot,id,name);
}
export function installScenePreset(directory,id){
 const item=sceneLibrary().find(x=>x.id===id);if(!item)throw Error('Preset desconhecido.');
 const {root}=projectFile(directory),folder=path.join(root,'custom-scenes');
 if(fs.existsSync(folder)&&fs.lstatSync(folder).isSymbolicLink())throw Error('custom-scenes não pode ser link simbólico.');
 fs.mkdirSync(folder,{recursive:true});
 const target=path.join(folder,item.file);
 const files=[item.file,...(item.companions||[]).map(x=>path.basename(x))].map(name=>({
  name,target:path.join(folder,name),bytes:fs.readFileSync(libraryFile(id,name))
 }));
 // Check EVERY destination before writing any file; a shared helper conflict
 // must not leave the primary module partially installed.
 for(const file of files)if(fs.existsSync(file.target)){
  if(fs.lstatSync(file.target).isSymbolicLink()||!fs.statSync(file.target).isFile()||!fs.readFileSync(file.target).equals(file.bytes))throw Error('Já existe outra versão de '+file.name+'. Preserve-a ou renomeie-a antes de instalar. Nada foi sobrescrito.');
 }
 for(const file of files)if(!fs.existsSync(file.target))fs.writeFileSync(file.target,file.bytes,{flag:'wx'});
 return {module:item.module,hash:crypto.createHash('sha256').update(files[0].bytes).digest('hex'),file:target,
  example:JSON.parse(fs.readFileSync(path.join(APP_ROOT,item.examples[0]),'utf8'))};
}
