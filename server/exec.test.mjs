import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {run} from './exec.mjs';

test('aborting a child waits until its final output and process cleanup',{skip:process.platform==='win32'},async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-abort-'));
  const marker=path.join(root,'done'),controller=new AbortController();
  try{
    const script=`const fs=require('node:fs');process.on('SIGTERM',()=>setTimeout(()=>{fs.writeFileSync(process.argv[1],'closed');process.exit(0)},40));console.log('ready');setInterval(()=>{},1000);`;
    await assert.rejects(run(process.execPath,['-e',script,marker],{
      signal:controller.signal,onOutput:message=>{if(message.includes('ready'))controller.abort();}
    }),error=>error.name==='AbortError');
    assert.equal(fs.readFileSync(marker,'utf8'),'closed');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('failed subprocess spawn still rejects without hanging',async()=>{
  await assert.rejects(run('contentlab-executable-that-does-not-exist',[]),/ENOENT/);
});
