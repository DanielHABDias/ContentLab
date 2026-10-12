import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {run} from './exec.mjs';
import {renderProject} from './render.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-node-smoke-'));
try{
  fs.mkdirSync(path.join(root,'audio'));
  const wav=path.join(root,'audio','narration.wav');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi',
    '-i','sine=frequency=440:sample_rate=16000:duration=1','-ac','1',wav]);
  const plan={
    project:{name:'smoke-node',format:'custom',profile:'generic',resolution:{width:320,height:180},fps:10},
    audio:{narration:'audio/narration.wav',voice:{normalize:false,highpassHz:0}},
    timeline:[{id:'scene-01',start:0,end:1,layout:'fullscreen',
      background:{color:'#182238'},elements:[
        {id:'title',type:'text',text:'NODE + REMOTION',style:'impact',start:0,end:1}
      ],transitionOut:'cut'}]
  };
  const file=path.join(root,'edit_plan.json');
  fs.writeFileSync(file,JSON.stringify(plan));
  const a=await renderProject(root,{cacheMode:'rebuild'});
  assert.ok(fs.statSync(a.output).size>1000);
  assert.equal(a.sceneCache.renderedCount,1);
  const b=await renderProject(root,{cacheMode:'reuse'});
  assert.equal(b.cacheHit,true);
  plan.timeline[0].elements[0].text='NOVO TEXTO';
  fs.writeFileSync(file,JSON.stringify(plan));
  const c=await renderProject(root,{cacheMode:'reuse'});
  assert.equal(c.sceneCache.renderedCount,1);
  console.log(JSON.stringify({status:'passed',renderer:'Remotion/Node',outputBytes:fs.statSync(c.output).size}));
}finally{
  if(process.env.CONTENTLAB_KEEP_SMOKE!=='1')fs.rmSync(root,{recursive:true,force:true});
}
