import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneWorkerLimit,runSceneWorkers} from './scene-workers.mjs';
const GiB=1024**3;
const resources={cpus:12,totalMemory:16*GiB,availableMemory:10*GiB};
const limit=options=>sceneWorkerLimit({resources,frameConcurrency:1,count:10,...options});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('scene workers default to up to three CPU/RAM-aware workers, without multiplying frame workers',()=>{
  assert.equal(limit(),3);
  assert.equal(limit({count:2}),2);
  assert.equal(limit({requested:2}),2);
  assert.equal(limit({resources:{...resources,cpus:8}}),2);
  assert.equal(limit({resources:{...resources,availableMemory:8*GiB}}),2);
  assert.equal(limit({count:1}),1);
  assert.equal(limit({requested:1}),1);
  assert.equal(limit({hardwareAccel:true}),1);
  assert.equal(limit({frameConcurrency:2}),1);
  assert.equal(limit({frameConcurrency:'50%'}),1);
  assert.equal(limit({width:3840,height:2160}),1);
  for(const update of [{cpus:4},{availableMemory:4*GiB},{totalMemory:6*GiB}])
    assert.equal(limit({resources:{...resources,...update}}),1);
  for(const requested of [0,4,-1,'bad',1.5,Infinity])assert.throws(()=>limit({requested}));
});

test('workers overlap, cap at three and process every index exactly once',async()=>{
  let active=0,peak=0;const seen=[];
  await runSceneWorkers(7,async index=>{
    active++;peak=Math.max(peak,active);seen.push(index);await tick();active--;
  },{concurrency:3});
  assert.equal(peak,3);assert.equal(active,0);assert.deepEqual(seen,[0,1,2,3,4,5,6]);
});

test('three slots start only remaining work and honor a reduced live limit of two',async()=>{
  for(const count of [1,2,7]){
    let active=0,peak=0;const seen=[];
    await runSceneWorkers(count,async index=>{seen.push(index);active++;peak=Math.max(peak,active);await tick();active--;},
      {concurrency:3,canStartAnother:current=>current<2});
    assert.equal(peak,Math.min(count,2));assert.deepEqual(seen,Array.from({length:count},(_,i)=>i));
  }
});

test('memory pressure temporarily serializes work, without dropping tasks',async()=>{
  let active=0,peak=0;
  await runSceneWorkers(4,async()=>{active++;peak=Math.max(peak,active);await tick();active--;},
    {concurrency:2,canStartAnother:()=>false});
  assert.equal(peak,1);
});

test('first failure cancels siblings, drains cleanup and starts no queued scene',async()=>{
  const seen=[],cleaned=[];
  await assert.rejects(runSceneWorkers(8,async(index,signal)=>{
    seen.push(index);
    try{
      if(index===0){await tick();throw Error('original failure');}
      await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    }finally{await tick();cleaned.push(index);}
  },{concurrency:2}),/original failure/);
  assert.deepEqual(seen,[0,1]);assert.deepEqual(cleaned.sort(),[0,1]);
});

test('external cancellation drains active workers; pre-aborted signals start nothing',async()=>{
  const controller=new AbortController();let calls=0,active=0;
  await assert.rejects(runSceneWorkers(5,async(index,signal)=>{
    calls++;active++;
    try{await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));}
    finally{await tick();active--;}
  },{concurrency:2,signal:controller.signal,canStartAnother:()=>{setImmediate(()=>controller.abort());return true;}}),/cancelado/);
  assert.equal(calls,2);assert.equal(active,0);
  await assert.rejects(runSceneWorkers(5,async()=>{calls++;},{concurrency:2,signal:controller.signal}),/cancelado/);
  assert.equal(calls,2);
});
