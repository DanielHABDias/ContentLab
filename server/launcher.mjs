/**
 * Cross-platform desktop launcher. The actual server is a detached Node process;
 * closing the terminal used to launch it does NOT stop the Content Lab.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||5000);
const url='http://127.0.0.1:'+port;
const runtime=process.platform==='win32'?
  path.join(process.env.LOCALAPPDATA||os.homedir(),'ContentLab','runtime'):
  path.join(process.env.XDG_STATE_HOME||path.join(os.homedir(),'.local','state'),'contentlab');
const logfile=path.join(runtime,'server.log');
const pidfile=path.join(runtime,'server.pid');

async function check(){
  try{
    const response=await fetch(url+'/health',{signal:AbortSignal.timeout(700)});
    const info=await response.json();
    if(response.ok&&info.backend==='node'&&info.renderer==='remotion')return true;
    throw Error('A porta '+port+' já está ocupada por outra aplicação.');
  }catch(e){
    if(String(e.message).includes('ocupada'))throw e;
    return false;
  }
}
function openBrowser(){
  const cmd=process.platform==='win32'?'cmd':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['/c','start','""',url]:[url];
  const child=spawn(cmd,args,{detached:true,stdio:'ignore',windowsHide:true,shell:false});
  child.on('error',()=>{console.log('Abra no navegador: '+url);});
  child.unref();
}
async function start(){
  if(await check()){openBrowser();console.log('Content Lab já estava iniciado. '+url);return;}
  fs.mkdirSync(runtime,{recursive:true});
  const log=fs.openSync(logfile,'a');
  let child;
  try{
    child=spawn(process.execPath,[path.join(root,'server','http.mjs')],{
      cwd:root,detached:true,windowsHide:true,
      stdio:['ignore',log,log],env:{...process.env,CONTENTLAB_LAUNCHED:'1'}
    });
    child.unref();
  }finally{fs.closeSync(log);}
  fs.writeFileSync(pidfile,String(child.pid));
  for(let retry=0;retry<60;retry++){
    await new Promise(resolve=>setTimeout(resolve,200));
    if(await check()){
      openBrowser();
      console.log('Content Lab iniciado em segundo plano: '+url);
      console.log('Log: '+logfile);
      return;
    }
    try{process.kill(child.pid,0);}catch{break;}
  }
  throw Error('Não foi possível iniciar o servidor Node. Veja o log em '+logfile);
}
async function stop(){
  if(!await check()){console.log('Content Lab não está em execução.');return;}
  const response=await fetch(url+'/api/shutdown',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({force:true})
  });
  if(!response.ok)throw Error('Não foi possível encerrar o Content Lab.');
  console.log('Encerramento solicitado.');
}
try{
  if(process.argv.includes('--stop'))await stop();
  else if(process.argv.includes('--status'))console.log(await check()?'Em execução: '+url:'Parado.');
  else await start();
}catch(error){console.error(error.message);process.exitCode=1;}
