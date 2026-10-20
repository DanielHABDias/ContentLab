import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {downloadVerified,ensurePortableTool,portableToolPath} from './portable-tools.mjs';
import {prepareFeatures,ensureVoiceModel} from './feature-setup.mjs';
import {ensureWhisperModel} from './whisper-models.mjs';
import {externalToolPath} from './video-external.mjs';

test('verified download accepts exact bytes, rejects tampering and enforces size limit',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-tools-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bytes=Buffer.from('official fixture'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const fetcher=async()=>new Response(bytes);
 const output=path.join(root,'tool');await downloadVerified('https://fixture',output,hash,{fetcher});assert.deepEqual(fs.readFileSync(output),bytes);
 await assert.rejects(downloadVerified('https://fixture',path.join(root,'corrupt'),'0'.repeat(64),{fetcher}),/Checksum/);
 await assert.rejects(downloadVerified('https://fixture',path.join(root,'oversize'),hash,{fetcher,maxBytes:2}),/limite/);
});
test('failed automatic installation cleans staging, never executes unverified bytes and can retry',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-install-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));let executions=0;
 for(let i=0;i<2;i++)await assert.rejects(ensurePortableTool('ytdlp',{root,platform:'linux',arch:'x64',fetcher:async()=>new Response('tampered'),runner:async()=>{executions++;}}),/Checksum/);
 assert.equal(executions,0);assert.deepEqual(fs.readdirSync(path.join(root,'.tools','ytdlp')),[]);
 await assert.rejects(ensurePortableTool('ytdlp',{root,platform:'unknown',arch:'x64'}),/indisponível/);
});
test('downloader resolves local executable without PATH on Linux and Windows',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-resolve-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const platform of ['linux','win32']){const file=portableToolPath('ytdlp',{root,platform});fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fixture');assert.equal(externalToolPath({directory:root,env:{},platform}),file);}
});
test('startup prepares downloads, enhancement and both isolated voice environments',async()=>{
 const calls=[];const dependencies={ensurePortableTool:async name=>calls.push(name),ensureEnhancer:async()=>calls.push('enhancer'),setupRuntime:async()=>calls.push('qwen'),setupChatterbox:async()=>calls.push('chatterbox')};
 await prepareFeatures({update:()=>{}},dependencies);assert.deepEqual(calls,['ytdlp','enhancer','qwen','chatterbox']);
 calls.length=0;await prepareFeatures({mediaOnly:true},dependencies);assert.deepEqual(calls,['ytdlp']);
});
test('chosen voice model automatically prepares and downloads once; cached models stay offline',async()=>{
 let prepared=0,downloads=0,installed=false;
 const deps={setupRuntime:async()=>{prepared++;},setupChatterbox:async()=>{prepared++;},modelState:async()=>({models:[{id:'0.6B',installed}]}),qwenTask:async()=>{downloads++;installed=true;},chatterboxTask:async()=>{throw Error('Wrong engine');}};
 await Promise.all([ensureVoiceModel('0.6B',{},deps),ensureVoiceModel('0.6B',{},deps)]);assert.equal(prepared,1);assert.equal(downloads,1);
 await ensureVoiceModel('0.6B',{},deps);assert.equal(downloads,1);await assert.rejects(ensureVoiceModel('../model',{},deps),/inválido/);
});
test('Whisper quality selects requested local model; bad download is never installed',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-whisper-model-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const base=path.join(root,'models');fs.mkdirSync(base);
 for(const model of ['base','small'])fs.writeFileSync(path.join(base,'ggml-'+model+'.bin'),'cached');
 const options={root,env:{CONTENTLAB_WHISPER_MODEL_DIR:base},runner:async()=>{throw Error('Must stay offline');}};
 assert.equal(await ensureWhisperModel('small',options),path.join(base,'ggml-small.bin'));
 assert.equal(await ensureWhisperModel('base',options),path.join(base,'ggml-base.bin'));
  await assert.rejects(ensureWhisperModel('../invalid',options),/inválido/);
  await assert.rejects(ensureWhisperModel('toString',options),/inválido/);
 // An explicit destination plus fresh custom root tests checksum rejection without downloading a large model.
 const isolatedEnv={CONTENTLAB_WHISPER_MODEL_DIR:base};
 // A cached medium on the host is legitimate reuse; exercise tiny only when absent in the shared cache.
 if(!fs.existsSync(path.join(os.homedir(),'.cache','whisper.cpp','ggml-tiny.bin'))){
  await assert.rejects(ensureWhisperModel('tiny',{root,env:isolatedEnv,runner:async(bin,args)=>{fs.writeFileSync(args[args.indexOf('--output')+1],'tampered');}}),/Checksum/);
  assert.equal(fs.existsSync(path.join(base,'ggml-tiny.bin')),false);assert.ok(!fs.readdirSync(base).some(name=>name.includes('.partial')));
 }
});
