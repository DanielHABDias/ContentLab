import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {run} from './exec.mjs';
import {renderProject} from './render.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-node-composition-'));
try{
  fs.mkdirSync(path.join(root,'audio'));
  for(const [name,duration,freq] of [['narration.wav',2,420],['music.wav',2,220],['impact.wav',0.2,750]]){
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi',
      '-i','sine=frequency='+freq+':sample_rate=48000:duration='+duration,
      '-ac','2',path.join(root,'audio',name)]);
  }
  const plan={project:{name:'smoke-two-scenes',format:'custom',profile:'generic',
    resolution:{width:320,height:180},fps:10},
    sources:{assets:'assets'},audio:{narration:'audio/narration.wav',voice:{normalize:false,highpassHz:0},
      music:[{asset:'project://audio/music.wav',start:0,end:2,trimDb:-16}]},
    timeline:[
      {id:'question',start:0,end:1,layout:'fullscreen',background:{color:'#111111'},
        elements:[{id:'title1',type:'text',text:'BATMAN',style:'impact',start:0,end:1}],
        transitionOut:'fade',transitionDuration:0.2},
      {id:'answer',start:1,end:2,layout:'fullscreen',background:{color:'#222222'},
        elements:[{id:'title2',type:'text',text:'JASON',style:'impact',start:1,end:2},
          {id:'boom',type:'sfx',asset:'project://audio/impact.wav',at:1.2,config:{duration:0.2}}],
        transitionOut:'cut'},
    ]};
  fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(plan));
  const render=await renderProject(root,{cacheMode:'rebuild'});
  assert.equal(render.sceneCache.renderedCount,2);
  assert.equal(render.transitions.length,1);
  assert.ok(render.outputBytes>2000);
  const manifest=path.join(root,'output','final','scenes','manifest.json');
  assert.ok(fs.existsSync(manifest));
  const cached=await renderProject(root,{cacheMode:'reuse'});
  assert.equal(cached.cacheHit,true);
  plan.timeline[1].elements[0].text='RED HOOD';
  fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(plan));
  const changed=await renderProject(root,{cacheMode:'reuse'});
  assert.deepEqual(changed.sceneCache.reused,['question']);
  assert.deepEqual(changed.sceneCache.rendered,['answer']);
  console.log(JSON.stringify({status:'passed',rendered:changed.sceneCache.rendered,
    reused:changed.sceneCache.reused,outputBytes:changed.outputBytes}));
}finally{
  if(process.env.CONTENTLAB_KEEP_SMOKE!=='1')fs.rmSync(root,{recursive:true,force:true});
}
