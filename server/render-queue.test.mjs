import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderQueue} from './render-queue.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const fixtures=({renderProject,transcription='ready',isSingleRenderBusy=()=>false}={})=>
  createRenderQueue({
    loadProject:dir=>({projectRoot:'/projects/'+dir,name:dir,
      validation:{valid:true},transcription:{status:transcription}}),
    renderProject:renderProject|| (async root=>({output:root+'/output/final/final.mp4'})),
    isSingleRenderBusy
  });
async function finished(queue,id){
  for(let i=0;i<100;i++){
    const snapshot=queue.get(id);
    if(snapshot.status!=='running')return snapshot;
    await tick();
  }
  throw Error('Fila não terminou.');
}

test('renders projects strictly in the submitted order, never simultaneously',async()=>{
  const events=[],queue=fixtures({renderProject:async root=>{
    events.push('start '+root);await tick();events.push('end '+root);
    return {output:root+'/output/final/final.mp4'};
  }});
  const job=queue.enqueue({projectRoots:['SH_0005','SH_0006','SH_0007']});
  assert.equal(queue.isQueued('/projects/SH_0007'),true);
  assert.throws(()=>queue.enqueue({projectRoots:['extra']}),{statusCode:409});
  const done=await finished(queue,job.id);
  assert.equal(done.status,'done');
  assert.deepEqual(done.items.map(x=>x.status),['done','done','done']);
  assert.deepEqual(events,[
    'start /projects/SH_0005','end /projects/SH_0005',
    'start /projects/SH_0006','end /projects/SH_0006',
    'start /projects/SH_0007','end /projects/SH_0007']);
  assert.equal(queue.isQueued('/projects/SH_0007'),false);
});
test('continues with the next project when opted in',async()=>{
  const queue=fixtures({renderProject:async root=>{
    if(root.endsWith('/SH_0006'))throw Error('MP4 failure');
    return {output:root+'/final.mp4'};
  }});
  const job=queue.enqueue({projectRoots:['SH_0005','SH_0006','SH_0007'],continueOnError:true});
  const done=await finished(queue,job.id);
  assert.equal(done.status,'finished_with_errors');
  assert.deepEqual(done.items.map(x=>x.status),['done','error','done']);
  assert.match(done.items[1].error,/MP4 failure/);
});
test('stops remaining projects after error when continueOnError is false',async()=>{
  const queue=fixtures({renderProject:async root=>{
    if(root.endsWith('/SH_0006'))throw Error('Failed');
    return {output:root+'/final.mp4'};
  }});
  const job=queue.enqueue({projectRoots:['SH_0005','SH_0006','SH_0007'],continueOnError:false});
  const done=await finished(queue,job.id);
  assert.equal(done.status,'cancelled');
  assert.deepEqual(done.items.map(x=>x.status),['done','error','cancelled']);
});
test('rejects duplicate roots, invalid transcription, and manual active renders',()=>{
  const q=fixtures();
  assert.throws(()=>q.enqueue({projectRoots:['A','A']}),{statusCode:422});
  assert.throws(()=>q.enqueue({projectRoots:[]}),{statusCode:400});
  const stale=fixtures({transcription:'stale'});
  assert.throws(()=>stale.enqueue({projectRoots:['A']}),/Prepare a narração/);
  const busy=fixtures({isSingleRenderBusy:root=>root==='/projects/A'});
  assert.throws(()=>busy.enqueue({projectRoots:['A']}),{statusCode:409});
});
test('cancels current render and marks pending projects cancelled',async()=>{
  const queue=fixtures({renderProject:async (_root,{signal})=>
    new Promise((resolve,reject)=>{
      if(signal.aborted)return reject(Error('cancelled'));
      signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});
    })});
  const job=queue.enqueue({projectRoots:['A','B']});
  const cancelling=queue.cancel(job.id);
  assert.equal(cancelling.cancelRequested,true);
  const done=await finished(queue,job.id);
  assert.equal(done.status,'cancelled');
  assert.deepEqual(done.items.map(x=>x.status),['cancelled','cancelled']);
});
