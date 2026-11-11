#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildMarkdown,buildHtml,figureAssets} from '../server/docs.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const outputs=[
  {name:'docs/Documentacao-ContentLab.md',content:buildMarkdown()},
  {name:'docs/Documentacao-ContentLab.html',content:buildHtml({standalone:true})},
  ...figureAssets()
];
let mismatches=0;
for(const {name,content} of outputs){
  const dest=path.join(root,name);
  if(check){
    if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8')!==content){
      console.error('Documentação desatualizada: '+name);
      mismatches++;
    }
  }else{
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,content,'utf8');
    console.log('Gerado: '+name);
  }
}
if(mismatches)process.exitCode=1;
else console.log(check?'Documentação e SVGs sincronizados com o schema.':'Documentação gerada.');
