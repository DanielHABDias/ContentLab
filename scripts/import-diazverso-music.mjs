#!/usr/bin/env node
// Local-only installer for music already obtained legitimately by the operator.
// Deliberately does not download, share, commit, or grant a license to any audio.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(repoRoot,'builtin-assets','music');
const tracks=[
  'A Great Darkness Approaches, Can You Feel It_ - ELPHNT.mp3',
  'Elegy - Asher Fulero.mp3',
  'Frightmare - Jimena Contreras.mp3',
];
function usage(){
 console.log('Importar faixas locais licenciadas na biblioteca PRIVADA deste computador.');
 console.log('Uso: node scripts/import-diazverso-music.mjs --source <pasta-com-MP3s> --confirm-rights [--dry-run]');
 console.log('Confirme primeiro o tipo de licença e atribuição na Biblioteca de áudio do YouTube Studio.');
 console.log('A cópia é LOCAL; não envie os MP3s para GitHub ou outro repositório público.');
 console.log('Faixas:', ...tracks.map(t=>'\n  '+t));
}
const args=process.argv.slice(2);if(args.includes('--help')){usage();process.exit(0)}
const ix=args.indexOf('--source');if(ix===-1||!args[ix+1]){usage();process.exitCode=2}else{
 const source=path.resolve(args[ix+1]);
 const dry=args.includes('--dry-run');
 if(!dry&&!args.includes('--confirm-rights')){
  console.error('Importação recusada: informe --confirm-rights após conferir licença e condições de atribuição.');process.exitCode=2;
 }else{
  if(!fs.existsSync(source)||!fs.statSync(source).isDirectory())throw Error('Pasta de origem não existe: '+source);
  const sha=(p)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  if(!dry)fs.mkdirSync(destination,{recursive:true});
  let copied=0,skipped=0,missing=0;
  for(const filename of tracks){
   const input=path.join(source,filename),target=path.join(destination,filename);
   if(!fs.existsSync(input)){console.log('AUSENTE:',filename);missing++;continue;}
   if(!fs.statSync(input).isFile())throw Error('Origem inválida: '+filename);
   const st=fs.statSync(input);
   if(st.size<1024)throw Error('MP3 suspeitamente pequeno: '+filename);
   const magic=fs.readFileSync(input).subarray(0,3);
   if(magic.toString('ascii')!=='ID3'&&magic[0]!==0xFF)throw Error('Não parece MP3: '+filename);
   if(fs.existsSync(target)){
     if(sha(input)!==sha(target))throw Error('Conflito de conteúdo; não sobrescrever automaticamente: '+filename);
     console.log('JÁ INSTALADO:',filename);skipped++;continue;
   }
   if(dry){console.log('SERIA INSTALADO:',filename);continue;}
   fs.copyFileSync(input,target,fs.constants.COPYFILE_EXCL);
   copied++;console.log('INSTALADO LOCALMENTE:',filename);
  }
  console.log(JSON.stringify({copied,skipped,missing,dryRun:dry,location:destination},null,2));
 }
}