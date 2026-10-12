import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {run} from './exec.mjs';
import {transcribeAudio} from './transcribe.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-transcribe-smoke-'));
try{
  const model=path.join(root,'ggml-base.bin');
  fs.writeFileSync(model,'mock-model');
  const fake=path.join(root,'fake-whisper-cli.sh');
  fs.writeFileSync(fake,[
    '#!/bin/sh',
    'while [ "$#" -gt 0 ]; do',
    '  if [ "$1" = "-of" ]; then prefix="$2"; shift 2; else shift; fi',
    'done',
    'printf \'{"transcription":[{"offsets":{"from":0,"to":1250},"text":"O Batman nao mata."}]}\\n\' > "${prefix}.json"'
  ].join('\n')+'\n',{mode:0o755});
  process.env.CONTENTLAB_WHISPER_CLI=fake;
  process.env.CONTENTLAB_WHISPER_MODEL=model;
  const input=path.join(root,'narration.wav');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','sine=frequency=460:sample_rate=16000:duration=1.5',
    '-c:a','pcm_s16le',input]);
  const result=await transcribeAudio(input,root,{model:'base',language:'pt'});
  assert.equal(result.segmentCount,1);
  assert.equal(result.wordCount,4);
  const json=JSON.parse(fs.readFileSync(path.join(root,'transcript.json'),'utf8'));
  assert.equal(json.segments[0].text,'O Batman nao mata.');
  assert.equal(json.words.length,4);
  assert.ok(fs.readFileSync(path.join(root,'transcript.srt'),'utf8').includes('00:00:01,250'));
  console.log(JSON.stringify({status:'passed',segmentCount:result.segmentCount,wordCount:result.wordCount}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
