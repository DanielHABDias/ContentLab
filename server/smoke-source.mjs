import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {run} from './exec.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-local-source-'));
process.env.CONTENTLAB_SOURCE_CACHE=path.join(root,'cache');
try{
  const {importLocalSource,downloadInternetVideo,resolveSource,cachedSource,listSources,exportCut,removeSource}=await import('./source.mjs');
  const input=path.join(root,'local-video.mp4');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','color=c=red:s=320x180:r=15:d=2',
    '-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=2',
    '-map','0:v','-map','1:a','-c:v','libx264','-pix_fmt','yuv420p',
    '-c:a','aac','-t','2',input]);
  const first=await importLocalSource(input);
  assert.equal(first.origin,'local');
  assert.ok(first.duration>1.8);
  assert.equal(listSources().length,1);
  assert.equal((await importLocalSource(input)).key,first.key);
  assert.ok(cachedSource(first.key).size_bytes>0);
  const folder=path.join(root,'exports');fs.mkdirSync(folder);
  const full=await exportCut(first,{folder,filename:'Vídeo Completo',mode:'video',full:true});
  const audio=await exportCut(first,{folder,filename:'Áudio Extraído',mode:'audio',
    full:false,start:0.4,end:1.4});
  assert.ok(fs.statSync(full).size>2000);
  assert.ok(fs.statSync(audio).size>500);
  const internetUrl='https://vimeo.com/12345';
  let downloaderCalled=0;
  const web=await downloadInternetVideo(internetUrl,()=>{},{
    metadata:async()=>({title:'Teste Vimeo',thumbnail:'',duration:2}),
    downloader:async(url,folder,{update})=>{
      assert.equal(url,internetUrl);
      downloaderCalled++;
      await fs.promises.copyFile(input,path.join(folder,'video.mp4'));
      update(85,'Importado');
    }
  });
  assert.equal(web.origin,'internet');
  assert.equal(web.title,'Teste Vimeo');
  assert.ok(web.duration>1.8);
  assert.equal(downloaderCalled,1);
  assert.equal((await resolveSource(internetUrl)).key,web.key,
    'O download externo em cache não deve chamar o yt-dlp novamente.');
  const webCut=await exportCut(web,{folder,filename:'Trecho importado',mode:'video',
    full:false,start:0.3,end:1.3});
  assert.ok(fs.statSync(webCut).size>500);
  removeSource(web.key);
  removeSource(first.key);
  assert.equal(listSources().length,0);
  console.log(JSON.stringify({status:'passed',cached:true,videoBytes:fs.statSync(full).size,
    audioBytes:fs.statSync(audio).size}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
