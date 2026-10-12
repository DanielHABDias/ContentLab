import {spawn} from 'node:child_process';
export async function run(bin,args,{cwd,signal,onOutput}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{cwd,signal,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk.toString();if(stdout.length>100000)stdout=stdout.slice(-100000);onOutput?.(chunk.toString(),'stdout');});
    child.stderr.on('data',chunk=>{stderr+=chunk.toString();if(stderr.length>100000)stderr=stderr.slice(-100000);onOutput?.(chunk.toString(),'stderr');});
    child.on('error',reject);
    child.on('close',(code,signalled)=>{
      if(code===0)resolve({stdout,stderr});
      else reject(new Error(String(bin)+' falhou ('+(code??signalled)+'): '+(stderr||stdout).slice(-8000)));
    });
  });
}
export async function which(bin){
  try{await run(bin,['-version']);return bin;}catch(e){throw Error(bin+' não encontrado no PATH: '+e.message);}
}
