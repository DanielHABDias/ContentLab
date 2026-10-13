/**
 * Cross-platform desktop launcher. The actual server is a detached Node process;
 * closing the terminal used to launch it does NOT stop the Content Lab.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {instanceIdentity,startupAction} from './instance-identity.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||5000);
const url='http://127.0.0.1:'+port;
const runtime=process.platform==='win32'?
  path.join(process.env.LOCALAPPDATA||os.homedir(),'ContentLab','runtime'):
  path.join(process.env.XDG_STATE_HOME||path.join(os.homedir(),'.local','state'),'contentlab');
const logfile=path.join(runtime,'server.log');
const pidfile=path.join(runtime,'server.pid');

async function healthInfo(){
  try{
    const response=await fetch(url+'/health',{signal:AbortSignal.timeout(1100)});
    if(!response.ok)throw Error('A porta '+port+' está ocupada por outra aplicação.');
    return await response.json();
  }catch(error){
    if(String(error.message).includes('ocupada'))throw error;
    return null;
  }
}
async function check(){
  const info=await healthInfo();
  return info?.backend==='node'&&info.renderer==='remotion';
}
async function waitForStop(){
  for(let i=0;i<40;i++){
    await new Promise(resolve=>setTimeout(resolve,250));
    if(!await healthInfo())return;
  }
  throw Error('O servidor anterior não foi encerrado. Use o botão Encerrar no Studio e abra novamente.');
}
function openBrowser(){
  const cmd=process.platform==='win32'?'cmd':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['/c','start','""',url]:[url];
  const child=spawn(cmd,args,{detached:true,stdio:'ignore',windowsHide:true,shell:false});
  child.on('error',()=>{console.log('Abra no navegador: '+url);});
  child.unref();
}
async function start(){
  const running=await healthInfo(),local=instanceIdentity(root);
  const action=startupAction(running,local,{hasLocalPid:fs.existsSync(pidfile)});
  if(action==='occupied')throw Error(
    'Há outro servidor na porta '+port+'. Encerre-o antes de iniciar este Content Lab.');
  if(action==='reuse'){
    openBrowser();
    console.log('Content Lab atualizado já estava iniciado. '+url);
    return;
  }
  if(action==='restart'){
    console.log('Versão antiga do Content Lab detectada. Reiniciando servidor local...');
    const response=await fetch(url+'/api/shutdown',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({force:false}),signal:AbortSignal.timeout(3000)
    });
    if(response.status===409)throw Error(
      'O Content Lab antigo está processando tarefas. Termine-as e use Encerrar antes de atualizar.');
    if(!response.ok)throw Error(
      'Falha ao encerrar a versão antiga. Use Encerrar no Studio e abra novamente.');
    await waitForStop();
  }
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
