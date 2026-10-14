import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('bootstrap shell and Windows launcher references are present',()=>{
 for(const file of ['run.sh','iniciar.bat','iniciar.vbs','scripts/bootstrap-linux.sh','scripts/bootstrap-windows.ps1']){
   assert.ok(fs.existsSync(path.join(root,file)),file);
 }
 assert.match(fs.readFileSync(path.join(root,'run.sh'),'utf8'),/contentlab_bootstrap/);
 assert.match(fs.readFileSync(path.join(root,'iniciar.bat'),'utf8'),/bootstrap-windows\.ps1/);
 assert.match(fs.readFileSync(path.join(root,'scripts/bootstrap-windows.ps1'),'utf8'),/Ensure-Model/);
 assert.match(fs.readFileSync(path.join(root,'scripts/bootstrap-linux.sh'),'utf8'),/cl_install_model/);
});

test('Linux bootstrap shell parses with bash', {skip:process.platform==='win32'},()=>{
 const result=spawnSync('bash',['-n','run.sh','scripts/bootstrap-linux.sh','instalar-atalho.sh'],{cwd:root});
 assert.equal(result.status,0,String(result.stderr));
});

test('Linux dependency checks reuse valid installs and reinstall only when manifest changes',
 {skip:process.platform==='win32'||Number(process.versions.node.split('.')[0])<22},
 ()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-bootstrap-test-'));
  try{
   fs.mkdirSync(path.join(temp,'backend','remotion'),{recursive:true});
   fs.mkdirSync(path.join(temp,'mockbin'));
   fs.writeFileSync(path.join(temp,'package.json'),'{"dependencies":{"express":"1"}}');
   fs.writeFileSync(path.join(temp,'backend','remotion','package-lock.json'),'{"lockfileVersion":3}');
   fs.writeFileSync(path.join(temp,'fake-model.bin'),'whisper-model-for-test');
   // This fixture tests dependency reuse, not Node installation. Present a
   // Node 22 executable so the bootstrap does not prepend a real downloaded
   // npm ahead of the mocked npm on hosts running a newer Node major.
   const node=path.join(temp,'mockbin','node');
   fs.writeFileSync(node,'#!/bin/sh\nif [ "$1" = "-p" ]; then echo 22; else exec "'+process.execPath+'" "$@"; fi\n');
   fs.chmodSync(node,0o755);
   for(const bin of ['ffmpeg','ffprobe','whisper-cli']){
    const f=path.join(temp,'mockbin',bin);
    fs.writeFileSync(f,bin==='ffmpeg'?
      '#!/bin/sh\nif [ "$1" = "-hide_banner" ] && [ "$2" = "-filters" ]; then printf " .. rubberband A->A Pitch-shift audio\\n"; fi\nexit 0\n':
      '#!/bin/sh\nexit 0\n');
    fs.chmodSync(f,0o755);
   }
   const npm=path.join(temp,'mockbin','npm');
   fs.writeFileSync(npm,'#!/usr/bin/env bash\n'+
     'echo "install" >> "$CL_MOCK_INSTALL_LOG"\n'+
     'if [ "$1" = "ci" ]; then\n'+
     '  mkdir -p "$CL_MOCK_ROOT/backend/remotion/node_modules/remotion"\n'+
     '  echo "{}" > "$CL_MOCK_ROOT/backend/remotion/node_modules/remotion/package.json"\n'+
     'else\n'+
     '  mkdir -p "$CL_MOCK_ROOT/node_modules/express"\n'+
     '  echo "{}" > "$CL_MOCK_ROOT/node_modules/express/package.json"\n'+
     'fi\n');
   fs.chmodSync(npm,0o755);
   const script='source scripts/bootstrap-linux.sh\n'+
     'CL_ROOT="$CL_MOCK_ROOT"\nCL_TOOLS="$CL_ROOT/.tools"\n'+
     'contentlab_bootstrap\ncontentlab_bootstrap\n';
   const env={...process.env,CL_MOCK_ROOT:temp,
     CL_MOCK_INSTALL_LOG:path.join(temp,'installs.log'),
     CONTENTLAB_WHISPER_MODEL:path.join(temp,'fake-model.bin'),
     CONTENTLAB_BOOTSTRAP_SKIP_BROWSER:'1',
     PATH:path.join(temp,'mockbin')+path.delimiter+process.env.PATH};
   let result=spawnSync('bash',['-c',script],{cwd:root,env,encoding:'utf8',timeout:30000});
   assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
   const log=()=>fs.readFileSync(path.join(temp,'installs.log'),'utf8').trim().split('\n').length;
   assert.equal(log(),2,'server and remotion installed only once');
   fs.writeFileSync(path.join(temp,'package.json'),'{"dependencies":{"express":"2"}}');
   result=spawnSync('bash',['-c','source scripts/bootstrap-linux.sh; CL_ROOT="$CL_MOCK_ROOT"; CL_TOOLS="$CL_ROOT/.tools"; contentlab_bootstrap'],{
     cwd:root,env,encoding:'utf8',timeout:30000
   });
   assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
   assert.equal(log(),3,'changed project dependencies trigger one install');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 });

test('Linux bootstrap detects missing rubberband and installs verified portable FFmpeg only once',
 {skip:process.platform==='win32'},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-rubberband-setup-'));
 try{
   const mockbin=path.join(temp,'mockbin'),packageDir=path.join(temp,'package'),
     packageBin=path.join(packageDir,'ffmpeg-master-latest-linux64-gpl','bin');
   fs.mkdirSync(mockbin,{recursive:true});
   fs.mkdirSync(packageBin,{recursive:true});
   for(const file of ['ffmpeg','ffprobe']){
     const system=path.join(mockbin,file);
     fs.writeFileSync(system,'#!/bin/sh\nif [ "$1" = "-hide_banner" ]; then echo " .. aecho A->A"; fi\nexit 0\n');
     fs.chmodSync(system,0o755);
     const portable=path.join(packageBin,file);
     fs.writeFileSync(portable,file==='ffmpeg'?
       '#!/bin/sh\nif [ "$1" = "-hide_banner" ]; then echo " .. rubberband A->A Pitch-shift"; fi\nexit 0\n':
       '#!/bin/sh\nexit 0\n');
     fs.chmodSync(portable,0o755);
   }
   const archive=path.join(temp,'ffmpeg-master-latest-linux64-gpl.tar.xz');
   const archiveName='ffmpeg-master-latest-linux64-gpl';
   let x=spawnSync('tar',['-cJf',archive,'-C',packageDir,archiveName],{encoding:'utf8'});
   assert.equal(x.status,0,x.stderr);
   const hash=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
   const manifest=path.join(temp,'checksums.sha256');
   fs.writeFileSync(manifest,hash+'  '+path.basename(archive)+'\n');
   const env={...process.env,CL_MOCK_ROOT:temp,CL_MOCK_ARCHIVE:archive,
     CL_MOCK_MANIFEST:manifest,CL_MOCK_DOWNLOAD_LOG:path.join(temp,'downloads.log'),
     PATH:mockbin+path.delimiter+process.env.PATH};
   const script='source scripts/bootstrap-linux.sh\n'+
    'CL_ROOT="$CL_MOCK_ROOT"; CL_TOOLS="$CL_ROOT/.tools"\n'+
    'cl_download(){ if [[ "$1" == *checksums.sha256 ]]; then cp "$CL_MOCK_MANIFEST" "$2"; else cp "$CL_MOCK_ARCHIVE" "$2"; fi; echo download >> "$CL_MOCK_DOWNLOAD_LOG"; }\n'+
    'cl_install_ffmpeg\ncl_install_ffmpeg\n'+
    'cl_ffmpeg_supports_rubberband\n';
   x=spawnSync('bash',['-c',script],{cwd:root,env,encoding:'utf8',timeout:30000});
   assert.equal(x.status,0,x.stdout+'\n'+x.stderr);
   assert.match(x.stdout,/rubberband instalados/);
   assert.equal(fs.readFileSync(env.CL_MOCK_DOWNLOAD_LOG,'utf8').trim().split('\n').length,2,
     'Portable build downloaded only on first run');
   assert.ok(fs.existsSync(path.join(temp,'.tools','ffmpeg','ffmpeg')));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
