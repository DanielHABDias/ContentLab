import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {run} from './exec.mjs';
import {prepareAndTranscribeProject,transcriptStatus,narrationStamp} from './narration-pipeline.mjs';
import {transcriptWords} from './remotion.mjs';
import {probeAudioDuration} from './audio.mjs';

const hasFFmpeg=spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status===0&&
  spawnSync('ffprobe',['-version'],{stdio:'ignore'}).status===0;

test('project narration is processed BEFORE transcription and retains deliberate silence', {skip:!hasFFmpeg},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-project-transcript-'));
 try{
  fs.mkdirSync(path.join(root,'audio'));
  const narration=path.join(root,'audio','voice.wav');
  const inputs=['anullsrc=r=48000:cl=mono:d=0.30',
    'sine=frequency=440:sample_rate=48000:duration=0.60',
    'anullsrc=r=48000:cl=mono:d=0.20',
    'sine=frequency=660:sample_rate=48000:duration=0.60',
    'anullsrc=r=48000:cl=mono:d=0.40'];
  const args=['-hide_banner','-loglevel','error','-y'];
  for(const input of inputs)args.push('-f','lavfi','-i',input);
  await run('ffmpeg',[...args,'-filter_complex',
    '[0:a][1:a][2:a][3:a][4:a]concat=n=5:v=0:a=1[a]','-map','[a]',narration]);
  const plan={project:{name:'voice',format:'youtube_long',profile:'generic'},
    sources:{assets:'assets',transcript:'transcript.json'},
    audio:{narration:'audio/voice.wav',voice:{autoTrimSilence:true,highpassHz:0,normalize:false},
      silenceInserts:[{at:1.10,duration:.55}]},timeline:[]};
  const planFile=path.join(root,'edit_plan.json');
  fs.writeFileSync(planFile,JSON.stringify(plan));
  let seenDuration=0;
  const transcriber=async(prepared,dest)=>{
    seenDuration=await probeAudioDuration(prepared);
    const doc={language:'pt',segments:[{start:0,end:.6,text:'Primeira'},
      {start:1.35,end:1.95,text:'Segunda'}],
      words:[{word:'Primeira',start:0,end:.6},{word:'Segunda',start:1.35,end:1.95}]};
    fs.writeFileSync(path.join(dest,'transcript.json'),JSON.stringify(doc,null,2));
    fs.writeFileSync(path.join(dest,'transcript.txt'),'Primeira Segunda');
    fs.writeFileSync(path.join(dest,'transcript.srt'),'1');
    return {wordCount:2,segmentCount:2,language:'pt',preview:'Primeira Segunda'};
  };
  const result=await prepareAndTranscribeProject(root,{transcriber});
  assert.ok(Math.abs(result.edgeTrim.start-.3)<.07,JSON.stringify(result));
  assert.ok(Math.abs(result.edgeTrim.end-.4)<.07,JSON.stringify(result));
  // .6 + .2 internal pause + .55 inserted pause + .6 = 1.95.
  assert.ok(Math.abs(seenDuration-1.95)<.09,seenDuration);
  assert.deepEqual(transcriptWords(JSON.parse(fs.readFileSync(path.join(root,'transcript.json'),'utf8')))
    .map(x=>x.start),[0,1.35]);
  assert.equal(transcriptStatus(root,plan).status,'ready');
  assert.ok(fs.existsSync(path.join(root,'audio','narration.prepared.wav')));
  const firstStamp=narrationStamp(root,plan);
  plan.audio.silenceInserts=[{at:1.10,duration:.7}];
  fs.writeFileSync(planFile,JSON.stringify(plan));
  assert.notEqual(firstStamp,narrationStamp(root,plan));
  assert.equal(transcriptStatus(root,plan).status,'stale');
  // A manual spelling correction must survive as a backup on regeneration.
  const manually=JSON.parse(fs.readFileSync(path.join(root,'transcript.json'),'utf8'));
  manually.words[0].word='Primeira!';
  fs.writeFileSync(path.join(root,'transcript.json'),JSON.stringify(manually,null,2));
  await prepareAndTranscribeProject(root,{transcriber});
  assert.equal(transcriptStatus(root,plan).status,'ready');
  assert.ok(fs.readdirSync(root).some(x=>x.startsWith('transcript.manual-backup-')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
