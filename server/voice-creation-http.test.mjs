import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {mountVoiceCreationRoutes} from './voice-creation-routes.mjs';
import {run} from './exec.mjs';

test('voice HTTP upload, retrieval and CSRF checks',async t=>{
  const app=express();app.use(express.json());
  const api=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status(400).json({error:e.message});}};
  mountVoiceCreationRoutes(app,api);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port,root=fs.mkdtempSync(path.join(os.tmpdir(),'voice-http-'));
  t.after(()=>{server.closeAllConnections();server.close();fs.rmSync(root,{recursive:true,force:true});});
  const response=await fetch(base+'/api/voice/runtime',{method:'POST',headers:{Origin:'https://attacker.example'}});
  assert.equal(response.status,403);
  assert.equal((await fetch(base+'/api/voice/recordings',{method:'POST'})).status,400);
  const missing=await fetch(base+'/api/voice/jobs/missing/audio');assert.equal(missing.status,404);
  const library=await fetch(base+'/api/voice/profiles');assert.equal(library.status,200);assert.ok(Array.isArray((await library.json()).profiles));
  assert.equal((await fetch(base+'/api/voice/profiles/invalid/audio')).status,400);
  const invalid=await fetch(base+'/api/voice/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'3B',text:'Teste'})});
  assert.equal(invalid.status,400);
  for(const engine of ['off','unknown','deepfilter']){
    const preview=new FormData();preview.append('projectRoot',root);preview.append('enhancementEngine',engine);
    const result=await fetch(base+'/api/voice/enhancement/preview',{method:'POST',body:preview});
    assert.equal(result.status,400,'Invalid or missing input must not start downloads');
  }
  try{await run('ffmpeg',['-version']);}catch{t.diagnostic('FFmpeg não disponível: upload real não testado.');return;}
  const sample=path.join(root,'sample.wav');await run('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=frequency=330:duration=0.3',sample]);
  const form=new FormData();form.append('projectRoot',root);form.append('file',new Blob([fs.readFileSync(sample)],{type:'audio/wav'}),'sample.wav');
  const saved=await fetch(base+'/api/voice/recordings',{method:'POST',body:form});assert.equal(saved.status,200);
  const value=await saved.json();assert.ok(value.relative.startsWith('audio/takes/recording-'));
  assert.ok(fs.existsSync(path.join(root,value.relative)));
  const audio=await fetch(base+'/api/voice/jobs/'+value.jobId+'/audio');assert.equal(audio.status,200);
  const wav=Buffer.from(await audio.arrayBuffer());assert.equal(wav.toString('ascii',0,4),'RIFF');
  const waveform=await fetch(base+'/api/voice/jobs/'+value.jobId+'/audio?waveform=1');assert.equal(waveform.status,200);
  const peaks=await waveform.json();assert.equal(peaks.peaks.length,640);assert.ok(Math.abs(peaks.duration-.3)<.01);
  assert.equal((await fetch(base+'/api/voice/jobs/missing/audio?waveform=1')).status,404);
  assert.equal(fs.existsSync(path.join(root,'transcript.json')),false);
  const remove=revision=>fetch(base+'/api/voice/takes/'+encodeURIComponent(path.basename(value.relative)),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectRoot:root,revision})});
  assert.equal((await remove('stale')).status,400);
  const removed=await remove(value.revision);assert.equal(removed.status,200);
  assert.equal((await removed.json()).takes.length,0);
  assert.equal((await fetch(base+'/api/voice/takes/'+encodeURIComponent(path.basename(value.relative))+'/audio?projectRoot='+encodeURIComponent(root))).status,404);
});
