import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
   for(const bin of ['ffmpeg','ffprobe','whisper-cli']){
    const f=path.join(temp,'mockbin',bin);
    fs.writeFileSync(f,'#!/bin/sh\nexit 0\n');
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
