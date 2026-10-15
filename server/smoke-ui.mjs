import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {run} from './exec.mjs';
import {APP_ROOT,assetReport,compileScene,settings} from './plan.mjs';
import {sceneFingerprint,rendererIdentity,SegmentCache} from './cache.mjs';

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
const sceneTemp=path.join(root,'batman-render.mp4');
await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi',
  '-i','color=c=navy:s=320x180:r=30:d=3','-an','-c:v','libx264','-pix_fmt','yuv420p',sceneTemp]);
const resolved=assetReport(plan,root).resolvedAssets;
const fingerprint=sceneFingerprint(plan.timeline[0],compileScene(plan.timeline[0],plan,resolved),
  settings(plan),resolved,[],rendererIdentity(APP_ROOT));
new SegmentCache(path.join(root,'output','final','scenes')).save('batman',fingerprint,sceneTemp);
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
  },'Chrome CDP',160);
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
  assert.equal(await evaluate('getComputedStyle(document.getElementById("panel-videos")).animationName'),
    'studio-panel-appear','Workspace opens with a subtle entrance transition');
  await evaluate('document.getElementById("tab-transcription").click()');
  assert.equal(await evaluate('getComputedStyle(document.getElementById("panel-transcription")).animationName'),
    'studio-panel-appear','Narration workspace animates on navigation');
  assert.equal(await evaluate('document.getElementById("panel-videos").hidden'),true,
    'Inactive workspace must stay hidden and non-interactive');
  assert.equal(await evaluate('getComputedStyle(document.getElementById("loadBtn")).transitionProperty.includes("transform")'),true,
    'Buttons must provide a transform-based tactile response');
  await evaluate('document.getElementById("tab-videos").click()');
  assert.equal(await evaluate('document.querySelectorAll(".workspace-tab").length'),6,
    'Six workspaces include Multi-editor and Publications');
  await evaluate('document.getElementById("tab-publications").click()');
  assert.equal(await evaluate('document.getElementById("panel-publications").hidden'),false,
    'Publications workspace must open');
  assert.equal(await evaluate('document.getElementById("publishSubmit").disabled'),true,
    'Publishing remains disabled in the interface-only version');
  assert.equal(await evaluate('!!document.getElementById("socialCredentialsForm")'),true,
    'OAuth credentials form must exist in the Publications workspace');
  assert.equal(await evaluate('!!document.getElementById("socialConnect-youtube")'),true,
    'YouTube login must be accessible from the Publications workspace');
  const socialStatus = await evaluate('(async () => { const r=await fetch("/api/social/status"); return {ok:r.ok,body:await r.json()}; })()');
  assert.equal(socialStatus.ok,true);
  assert.equal(typeof socialStatus.body.providers.youtube.configured,'boolean');
  assert.equal(JSON.stringify(socialStatus.body).includes('access_token'),false,
    'OAuth status must never expose tokens');

  await evaluate(`(() => {
    const input = document.getElementById("publishFiles");
    const files = new DataTransfer();
    files.items.add(new File(["demo"], "SH_0005-final.mp4", {type: "video/mp4"}));
    input.files = files.files;
    input.dispatchEvent(new Event("change", {bubbles: true}));
    const title = document.getElementById("publishTitle");
    title.value = "Batman #Shorts";
    title.dispatchEvent(new Event("input", {bubbles: true}));
    const description = document.getElementById("publishDescription");
    description.value = "Análise DC #Shorts";
    description.dispatchEvent(new Event("input", {bubbles: true}));
  })()`);
  assert.equal(await evaluate('document.getElementById("publishYoutubeTitle").textContent'),
    'Batman #Shorts','YouTube keeps the original title');
  assert.equal(await evaluate('document.getElementById("publishInstagramText").textContent'),
    'Batman #Viral\n\nAnálise DC #Viral','Instagram combines title and description');
  assert.equal(await evaluate('document.getElementById("publishTiktokText").textContent'),
    'Batman #Viral\n\nAnálise DC #Viral','TikTok combines title and description');
  assert.equal(await evaluate('document.getElementById("publishVideoList").children.length'),1,
    'Selected video appears in the mock library');
  await evaluate('document.getElementById("publishFormat").value="16:9";document.getElementById("publishFormat").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.getElementById("publishPlatform-tiktok").disabled'),true,
    'TikTok must be unavailable when horizontal 16:9 is selected');
  assert.equal(await evaluate('document.getElementById("publishTiktokChoice").classList.contains("is-unavailable")'),true,
    'TikTok must be visually muted for horizontal media');
  await evaluate('document.getElementById("publishFormat").value="9:16";document.getElementById("publishFormat").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.getElementById("publishPlatform-tiktok").disabled'),false,
    'TikTok becomes available for vertical 9:16 media');

  await evaluate('document.getElementById("tab-multieditor").click()');
  assert.equal(await evaluate('document.getElementById("panel-multieditor").hidden'),false);
  assert.equal(await evaluate('!!document.querySelector("#panel-multieditor #queueFolders")'),true,
    'Multi-editor must accept ordered folder paths');
  assert.equal(await evaluate('!!document.querySelector("#panel-multieditor #editorPlanText")'),false,
    'The batch workspace must not expose the individual JSON editor');
  await evaluate('document.getElementById("tab-videos").click()');
  assert.equal(await evaluate('document.querySelectorAll("#tab-guide, #panel-guide").length'),0,
    'Obsolete project guide must not be rendered');
  await send('Page.navigate',{url:'http://127.0.0.1:'+appPort+'/?legacy-guide=1#guide'});
  await wait(()=>evaluate('document.readyState === "complete" && location.hash==="#docs"'),
    'Legacy guide deep links redirect to documentation');
  assert.equal(await evaluate('document.getElementById("tab-docs").getAttribute("aria-selected")'),'true');

  assert.equal(await evaluate('document.querySelectorAll("#motionAddScene,#motionLeftAsset,#motionRightAsset").length'),0,
    'Fixed left/right motion wizard must not exist');
  await evaluate('document.getElementById("tab-docs").click()');
  await wait(()=>evaluate('!!document.getElementById("docsManual").contentDocument?.getElementById("fieldSearch")'),'Documentation iframe');
  assert.equal(await evaluate('document.getElementById("docsManual").contentDocument.body.textContent.includes("narration.prepared.wav")'),true,
    'Consolidated project setup must be present in the manual');

  const total=await evaluate('document.getElementById("docsManual").contentDocument.querySelectorAll("[data-field]").length');
  assert.ok(total>=125,'Documentation iframe must list all canonical JSON fields');
  const downloads=await evaluate('document.querySelectorAll("#panel-docs .docs-download-buttons a").length');
  assert.equal(downloads,3);
  await evaluate('const doc=document.getElementById("docsManual").contentDocument;const search=doc.getElementById("fieldSearch");search.value="silenceInserts";search.dispatchEvent(new Event("input"))');
  const matches=await evaluate('document.getElementById("docsManual").contentDocument.querySelectorAll("[data-field]:not(.hidden-row)").length');
  assert.ok(matches>0&&matches<total,'Searching documentation must filter fields');
  const docsScreen=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(os.tmpdir(),'contentlab-docs-ui.png'),Buffer.from(docsScreen.data,'base64'));
  await evaluate('document.getElementById("tab-editor").click()');
  await evaluate('document.getElementById("editorProjectRoot").value='+JSON.stringify(root));
  await evaluate('document.getElementById("editorLoad").click()');
  await wait(()=>evaluate('document.querySelectorAll("#visualSceneList .visual-scene").length === 2'),'Storyboarding scene list');
  assert.equal(await evaluate('document.getElementById("visualSelectedSceneTitle").textContent'),'batman');
  await wait(()=>evaluate('document.getElementById("visualSceneVideo").readyState >= 1'),'Cached MP4 loads');
  assert.equal(await evaluate('document.getElementById("visualSelectedSceneCache").textContent'),'Em cache');
  await evaluate('document.querySelectorAll("#visualSceneList .visual-scene")[1].click()');
  assert.equal(await evaluate('document.getElementById("visualSelectedSceneTitle").textContent'),'jason');
  await evaluate('document.getElementById("visualSceneSearch").value="batman"; document.getElementById("visualSceneSearch").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.querySelectorAll("#visualSceneList .visual-scene").length'),1);
  await evaluate('document.getElementById("visualSceneSearch").value=""; document.getElementById("visualSceneSearch").dispatchEvent(new Event("input"))');
  await evaluate('document.getElementById("visualAddScene").click()');
  assert.equal(await evaluate('JSON.parse(document.getElementById("editorPlanText").value).timeline.length'),3);
  assert.equal(await evaluate('JSON.parse(document.getElementById("editorPlanText").value).timeline.at(-1).elements.length'),0,
    'Timeline creates unrestricted empty scene instead of forced two-image layout');
  assert.equal(await evaluate('document.getElementById("visualSceneFields").textContent.includes("Editar propriedades avançadas")'),true,
    'Timeline keeps advanced background, grid, camera and animation controls');

  await evaluate('document.querySelector(".scene-action-row button:nth-child(2)").click()');
  assert.equal(await evaluate('JSON.parse(document.getElementById("editorPlanText").value).timeline.length'),4);
  await evaluate('document.getElementById("visualUndo").click()');
  assert.equal(await evaluate('JSON.parse(document.getElementById("editorPlanText").value).timeline.length'),3);
  await evaluate('document.getElementById("visualRedo").click()');
  assert.equal(await evaluate('JSON.parse(document.getElementById("editorPlanText").value).timeline.length'),4);
  await evaluate('document.querySelectorAll("#visualSceneList .visual-scene")[0].click()');
  await evaluate('document.querySelector(".scene-action-row button:first-child").click()');
  const ripple=await evaluate('JSON.parse(document.getElementById("editorPlanText").value)');
  assert.equal(ripple.timeline.length,5);
  assert.equal(ripple.timeline[1].start,3);
  assert.equal(ripple.timeline[2].start,8);
  assert.equal(ripple.audio.silenceInserts.length,2);
  assert.equal(ripple.audio.silenceInserts[0].at,3);
  assert.equal(ripple.audio.silenceInserts[0].duration,5);
  await evaluate('document.getElementById("visualUndo").click()');
  assert.equal(await evaluate('JSON.parse(document.getElementById("editorPlanText").value).timeline.length'),4);
  await evaluate('document.getElementById("visualRedo").click()');
  assert.equal(await evaluate('JSON.parse(document.getElementById("editorPlanText").value).timeline.length'),5);
  assert.equal(await evaluate('document.getElementById("editorSave").disabled'),false);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const screenshot=path.join(os.tmpdir(),'contentlab-studio-ui.png');
  fs.writeFileSync(screenshot,Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',sceneCount:5,logo:true,
    screenshot,errors:errors.length}));
}finally{
  ws?.close();
  service.kill();chrome.kill();
  // Chrome writes its profile for a moment after receiving SIGTERM.
  await Promise.race([
    new Promise(resolve=>chrome.once('exit',resolve)),
    sleep(2000)
  ]);
  try {
    await fs.promises.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:200});
  } catch(error) {
    if(!['ENOTEMPTY','EBUSY','EPERM'].includes(error.code))throw error;
    console.warn('Chrome temporary profile cleanup deferred to CI runner:',error.code);
  }
}
