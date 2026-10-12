import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';

const port=()=>new Promise(resolve=>{
  const srv=net.createServer();srv.listen(0,'127.0.0.1',()=>{
    const n=srv.address().port;srv.close(()=>resolve(n));
  });
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,message,attempts=80)=>{
  for(let i=0;i<attempts;i++){try{const r=await fn();if(r)return r;}catch{}
    await sleep(200);
  }throw Error('Timeout: '+message);
};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-browser-ui-'));
const appPort=await port(),debugPort=await port();
fs.mkdirSync(path.join(root,'audio'));
fs.writeFileSync(path.join(root,'audio','voice.wav'),'voice-fixture');
const plan={project:{name:'Storyboarding',format:'custom',profile:'generic',
  resolution:{width:640,height:360},fps:30},audio:{narration:'audio/voice.wav'},
  timeline:[
    {id:'batman',start:0,end:3,layout:'3x3',background:{color:'#000000'},
      elements:[{id:'title1',type:'text',text:'BATMAN',start:0,end:3}]},
    {id:'jason',start:3,end:6,layout:'3x3',background:{color:'#101010'},
      elements:[{id:'title2',type:'text',text:'JASON',start:3,end:6}]}
  ]};
fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(plan));
const chromeBin=process.env.CHROME_BIN||'google-chrome';
const service=spawn(process.execPath,['server/http.mjs'],{
  cwd:process.cwd(),env:{...process.env,PORT:String(appPort)},stdio:'ignore'
});
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-gpu',
  '--disable-dev-shm-usage','--hide-scrollbars',
  '--remote-allow-origins=*','--remote-debugging-port='+debugPort,
  '--user-data-dir='+path.join(root,'chrome'),'about:blank'],{stdio:'ignore'});
let ws;
try{
  await wait(async()=>{const response=await fetch('http://127.0.0.1:'+appPort+'/health');return response.ok;},'Node API');
  const pages=await wait(async()=>{
    const res=await fetch('http://127.0.0.1:'+debugPort+'/json/list');
    const items=await res.json();return items.some(x=>x.type==='page')&&items;
  },'Chrome CDP');
  const target=pages.find(x=>x.type==='page');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});
  });
  let next=0;const pending=new Map();const errors=[];
  ws.addEventListener('message',event=>{
    const data=JSON.parse(event.data);
    if(data.method==='Runtime.exceptionThrown')
      errors.push(data.params.exceptionDetails?.text);
    if(data.id&&pending.has(data.id)){
      const {resolve,reject}=pending.get(data.id);pending.delete(data.id);
      if(data.error)reject(Error(JSON.stringify(data.error)));else resolve(data.result);
    }
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++next;pending.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async(expression)=>{
    const res=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(res.exceptionDetails)throw Error(res.exceptionDetails.text);
    return res.result.value;
  };
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:'+appPort+'/'});
  await wait(()=>evaluate('document.readyState === "complete" && !!document.getElementById("editorLoad")'),'Document load');
  assert.equal(await evaluate('getComputedStyle(document.body).backgroundColor'),'rgb(245, 246, 248)');
  await evaluate('document.getElementById("tab-editor").click()');
  await evaluate('document.getElementById("editorProjectRoot").value='+JSON.stringify(root));
  await evaluate('document.getElementById("editorLoad").click()');
  await wait(()=>evaluate('document.querySelectorAll("#visualSceneList .visual-scene").length === 2'),'Storyboarding scene list');
  assert.equal(await evaluate('document.getElementById("visualSelectedSceneTitle").textContent'),'batman');
  await evaluate('document.querySelectorAll("#visualSceneList .visual-scene")[1].click()');
  assert.equal(await evaluate('document.getElementById("visualSelectedSceneTitle").textContent'),'jason');
  await evaluate('document.getElementById("visualSceneSearch").value="batman"; document.getElementById("visualSceneSearch").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.querySelectorAll("#visualSceneList .visual-scene").length'),1);
  await evaluate('document.getElementById("visualSceneSearch").value=""; document.getElementById("visualSceneSearch").dispatchEvent(new Event("input"))');
  await evaluate('document.getElementById("visualAddScene").click()');
  assert.equal(await evaluate('JSON.parse(document.getElementById("editorPlanText").value).timeline.length'),3);
  await evaluate('document.querySelector(".scene-action-row button:nth-child(2)").click()');
  assert.equal(await evaluate('JSON.parse(document.getElementById("editorPlanText").value).timeline.length'),4);
  assert.equal(await evaluate('document.getElementById("editorSave").disabled'),false);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const screenshot=path.join(os.tmpdir(),'contentlab-studio-ui.png');
  fs.writeFileSync(screenshot,Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',sceneCount:4,logo:true,
    screenshot,errors:errors.length}));
}finally{
  ws?.close();
  service.kill();chrome.kill();
  fs.rmSync(root,{recursive:true,force:true});
}
