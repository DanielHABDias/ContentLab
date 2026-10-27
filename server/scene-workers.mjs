import fs from 'node:fs';
import os from 'node:os';

const GiB=1024**3;
export function renderResources(){
  let available=os.freemem();
  // Linux freemem excludes reclaimable page cache. MemAvailable is the
  // kernel's estimate of memory usable without swapping other applications.
  if(process.platform==='linux')try{
    const match=fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+) kB/m);
    if(match)available=Number(match[1])*1024;
  }catch{}
  const constrained=process.constrainedMemory?.()||0;
  if(constrained>0)available=Math.min(available,process.availableMemory?.()??constrained);
  return {cpus:os.availableParallelism?.()||os.cpus().length,totalMemory:Math.min(os.totalmem(),constrained||Infinity),availableMemory:available};
}

// These are independent Remotion subprocesses, not JS worker threads. Keep
// frame concurrency separate so the two levels never multiply accidentally.
export function sceneWorkerLimit({width=1920,height=1080,count=1,hardwareAccel=false,
  requested=process.env.CONTENTLAB_SCENE_CONCURRENCY,
  frameConcurrency=process.env.CONTENTLAB_REMOTION_CONCURRENCY,
  resources=renderResources()}={}){
  const explicit=requested===undefined||requested===''?3:Number(requested);
  if(!Number.isInteger(explicit)||explicit<1||explicit>3)
    throw Error('CONTENTLAB_SCENE_CONCURRENCY deve ser 1, 2 ou 3.');
  if(hardwareAccel||Number(frameConcurrency||1)!==1)return 1;
  const perWorker=Math.max(2.5,width*height/(1920*1080)*1.5)*GiB;
  const cpuLimit=resources.cpus>=9?3:resources.cpus>=6?2:1;
  const totalLimit=Math.max(1,Math.floor((resources.totalMemory-4*GiB)/perWorker));
  const availableLimit=Math.max(1,Math.floor((resources.availableMemory-2*GiB)/perWorker));
  return Math.max(1,Math.min(explicit,count,cpuLimit,totalLimit,availableLimit));
}

export async function runSceneWorkers(count,worker,{concurrency=1,signal,canStartAnother=()=>true}={}){
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>3)throw Error('Concorrência de cenas inválida.');
  const controller=new AbortController();
  const cancel=()=>controller.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)cancel();
  let next=0,failure=null,active=0;
  const waiting=new Set();
  const wake=()=>{for(const resolve of waiting)resolve();waiting.clear();};
  controller.signal.addEventListener('abort',wake);
  async function loop(){
    while(next<count&&!controller.signal.aborted){
      // Under pressure, let existing work finish instead of opening another
      // Chromium. Wake on completion/cancel, without polling or busy-waiting.
      try{
        if(active>0&&!canStartAnother(active)){
          await new Promise(resolve=>waiting.add(resolve));continue;
        }
      }catch(error){if(!failure){failure=error;controller.abort();}break;}
      const index=next++;active++;
      try{await worker(index,controller.signal);}
      catch(error){if(!failure){failure=error;controller.abort();}}
      finally{active--;wake();}
    }
  }
  try{
    await Promise.allSettled(Array.from({length:Math.min(count,concurrency)},()=>loop()));
    if(failure)throw failure;
    if(controller.signal.aborted)throw Error('Render cancelado.');
  }finally{signal?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',wake);}
}
