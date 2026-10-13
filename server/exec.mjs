import {spawn} from 'node:child_process';
import {mediaToolExecutable} from './runtime-tools.mjs';
export async function run(bin,args,{cwd,signal,onOutput}={}){
  return new Promise((resolve,reject)=>{
    const executable=mediaToolExecutable(bin);
    const child=spawn(executable,args,{cwd,signal,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk.toString();if(stdout.length>100000)stdout=stdout.slice(-100000);onOutput?.(chunk.toString(),'stdout');});
    child.stderr.on('data',chunk=>{stderr+=chunk.toString();if(stderr.length>100000)stderr=stderr.slice(-100000);onOutput?.(chunk.toString(),'stderr');});
    child.on('error',reject);
    child.on('close',(code,signalled)=>{
      if(code===0){resolve({stdout,stderr});return;}
      // Preserve both CLI stdout (often bundler diagnostics) and stderr (uncaught failures).
      const output=[stdout,stderr].filter(Boolean).join('\n').slice(-16000);
      // EPIPE is a symptom: a downstream pipe (often a media subprocess)
      // closed, not proof that the scene's JSON is malformed.
      const hint=/\bEPIPE\b/.test(output)&&String(args[0]||'').includes('remotion-cli')
        ? '\nDiagnóstico: o subprocesso Remotion perdeu uma conexão de escrita (EPIPE). '+
          'Confira o log da cena, o navegador de renderização, o FFmpeg e a memória. '+
          'Inicie o Content Lab por run.sh/iniciar.bat para usar o Node 22 LTS testado.' : '';
      reject(new Error(String(executable)+' falhou ('+(code??signalled)+'): '+output+hint));
    });
  });
}
export async function which(bin){
  try{await run(bin,['-version']);return bin;}catch(e){throw Error(bin+' não encontrado no PATH: '+e.message);}
}
