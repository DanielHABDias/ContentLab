import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {APP_ROOT,projectFile} from './plan.mjs';

export const libraryRoot=path.join(APP_ROOT,'scene-library');
export const sceneLibrary=()=>JSON.parse(fs.readFileSync(path.join(libraryRoot,'manifest.json'),'utf8'));
export function libraryFile(id,name){
 const item=sceneLibrary().find(x=>x.id===id);
 if(!item||typeof name!=='string'||name!==path.basename(name))throw Error('Arquivo de preset inválido.');
 const allowed=[item.file,'README.md',...item.examples.map(x=>path.basename(x)),...item.previews.map(x=>path.basename(x))];
 if(!allowed.includes(name))throw Error('Arquivo não pertence ao preset.');
 return path.join(libraryRoot,id,name);
}
export function installScenePreset(directory,id){
 const item=sceneLibrary().find(x=>x.id===id);if(!item)throw Error('Preset desconhecido.');
 const {root}=projectFile(directory),folder=path.join(root,'custom-scenes');
 if(fs.existsSync(folder)&&fs.lstatSync(folder).isSymbolicLink())throw Error('custom-scenes não pode ser link simbólico.');
 fs.mkdirSync(folder,{recursive:true});
 const target=path.join(folder,item.file),bytes=fs.readFileSync(libraryFile(id,item.file));
 if(fs.existsSync(target)){
  if(fs.lstatSync(target).isSymbolicLink()||!fs.statSync(target).isFile()||!fs.readFileSync(target).equals(bytes))throw Error('Já existe outra versão de '+item.file+'. Preserve-a ou renomeie-a antes de instalar. Nada foi sobrescrito.');
 }else fs.writeFileSync(target,bytes,{flag:'wx'});
 return {module:item.module,hash:crypto.createHash('sha256').update(bytes).digest('hex'),file:target,
  example:JSON.parse(fs.readFileSync(path.join(APP_ROOT,item.examples[0]),'utf8'))};
}
