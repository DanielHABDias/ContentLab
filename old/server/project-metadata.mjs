import fs from 'node:fs';
import path from 'node:path';

// Arquivos técnicos não são entregáveis do projeto. Aceitamos a raiz como legado.
const NAMES=new Set(['narration.build.json','transcript.build.json']);
export function buildMetadataPath(root,name,{write=false}={}){
  if(!NAMES.has(name))throw Error('Metadado técnico desconhecido.');
  const directory=path.join(root,'.contentlab','build');
  const target=path.join(directory,name);
  if(write){
    for(const folder of [path.join(root,'.contentlab'),directory]){
      if(fs.existsSync(folder)){
        const stat=fs.lstatSync(folder);
        if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('Diretório de metadados inválido: '+folder);
      }else fs.mkdirSync(folder);
    }
    if(fs.existsSync(target)&&(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink()))
      throw Error('Arquivo técnico inválido.');
    return target;
  }
  if(fs.existsSync(target)){
    if(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink())throw Error('Arquivo técnico inválido.');
    return target;
  }
  return path.join(root,name);
}
export function cleanLegacyBuildMetadata(root,name){
  if(!NAMES.has(name))throw Error('Metadado técnico desconhecido.');
  const old=path.join(root,name);
  if(fs.existsSync(old)&&fs.lstatSync(old).isFile()&&!fs.lstatSync(old).isSymbolicLink())
    fs.rmSync(old);
}
