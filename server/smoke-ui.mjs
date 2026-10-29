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
  assert.equal(await evaluate('document.querySelectorAll(".workspace-tab[data-workspace]").length'),12,
    'Original workspaces, thumbnails, recording, AI narration and voice settings remain available');
  assert.equal(await evaluate('document.querySelectorAll(".workspace-tabs > .workspace-tab, .workspace-tabs > .workspace-group").length'),8,
    'Sidebar has eight top-level entries, with narration and settings grouped');
  assert.equal(await evaluate('document.getElementById("workspace-group-editor-items").hidden'),true,
    'Editor submenu starts collapsed');
  assert.equal(await evaluate('document.getElementById("workspace-group-social-items").hidden'),true,
    'Social submenu starts collapsed');

  assert.equal(await evaluate('document.querySelector("#panel-videos .source-tab span").textContent'),'Link da internet',
    'Video source now accepts a general supported site URL');
  assert.equal(await evaluate('document.querySelector("label[for=url]").textContent'),'Link da internet',
    'URL field label matches internet video import');
  assert.equal(await evaluate('document.getElementById("url").placeholder.includes("TikTok")'),true,
    'Source explains support for compatible public video sites');
  await evaluate('document.getElementById("tab-library").click()');
  assert.equal(await evaluate('document.getElementById("panel-library").hidden'),false,
    'Online media library is a dedicated workspace');
  assert.equal(await evaluate('location.hash'),'#library',
    'Media library preserves deep links');
  assert.equal(await evaluate('document.getElementById("libraryResults").textContent.includes("Busque acima")'),true,
    'Library starts with a useful search prompt');
  assert.equal(await evaluate('document.getElementById("libraryDownload").disabled'),true,
    'No download without choosing content and confirming reuse rights');
  assert.equal(await evaluate('document.getElementById("librarySource").value'),'popular',
    'YouTube and Pinterest are the default source');
  assert.equal(await evaluate('document.querySelector("#librarySource option[value=youtube]").textContent.includes("busca normal")'),true,
    'Ordinary YouTube search is available without Creative Commons filter');
  assert.equal(await evaluate('!!document.querySelector("#librarySource option[value=pinterest]")'),true,
    'Pinterest is a first-class selectable source');
  assert.equal(await evaluate('!!document.querySelector("#librarySource option[value=youtube-cc]")'),true,
    'Creative Commons remains optional');

  await evaluate("(() => {\n window.__libraryOriginalFetch=window.fetch;\n window.fetch=(url,opts)=>{\n   if(!String(url).startsWith('/api/library/search'))return window.__libraryOriginalFetch(url,opts);\n   const data={items:[{provider:'pinterest',kind:'image',key:'opaque-media-key',title:'Pin de cinema',credit:'Autora A',license:'Licença não verificada',pageUrl:'https://www.pinterest.com/pin/123456789/',preview:'https://i.pinimg.com/originals/aa/test.jpg'}],warnings:[]};\n   return Promise.resolve(new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}}));\n };\n})()");
  await evaluate('document.getElementById("libraryQuery").value="cinema";document.getElementById("librarySearchBtn").click()');
  await wait(()=>evaluate('document.querySelectorAll(".library-result").length===1'),
    'Library renders image results from local search API');
  assert.equal(await evaluate('document.querySelector(".library-provider").textContent'),'Pinterest',
    'Pinterest media appears as a previewable result');
  assert.equal(await evaluate('document.getElementById("libraryFallback").hidden'),false,
    'Fallback to official Pinterest search is available');
  assert.equal(await evaluate('document.getElementById("libraryTikTokSearch").href.includes("cinema")'),true,
    'TikTok external discovery retains the search term');
  await evaluate('document.querySelector(".library-result .library-card-actions button").click()');
  assert.equal(await evaluate('document.getElementById("libraryDownload").disabled'),true,
    'Selecting an asset alone does not enable download');
  await evaluate('document.getElementById("libraryRights").click()');
  assert.equal(await evaluate('document.getElementById("libraryDownload").disabled'),false,
    'Only confirmed rights allow starting an import');
  await evaluate('window.fetch=window.__libraryOriginalFetch');
  await evaluate('document.getElementById("tab-videos").click()');
  await evaluate('document.getElementById("workspace-group-editor-trigger").click()');
  assert.equal(await evaluate('document.getElementById("workspace-group-editor-trigger").getAttribute("aria-expanded")'),'true',
    'Editor category expands on click');
  assert.equal(await evaluate('document.getElementById("workspace-group-editor-items").hidden'),false,
    'Editor submenu exposes automatic and multi-editor choices');
  assert.equal(await evaluate('document.getElementById("panel-videos").hidden'),false,
    'Expanding a group does not interrupt the current workspace');
  await evaluate('document.getElementById("tab-editor").click()');
  assert.equal(await evaluate('document.getElementById("panel-editor").hidden'),false,
    'Editor automático still works through its nested item');
  assert.equal(await evaluate('document.getElementById("workspace-group-editor-trigger").classList.contains("is-group-active")'),true,
    'Editor group indicates an active nested workspace');
  await evaluate('document.getElementById("tab-multieditor").click()');
  assert.equal(await evaluate('document.getElementById("panel-multieditor").hidden'),false,
    'Multi-editor still opens from the same group');
  await evaluate('document.getElementById("workspace-group-editor-trigger").click()');
  assert.equal(await evaluate('document.getElementById("workspace-group-editor-items").hidden'),true,
    'Clicking expanded Editor collapses its submenu');
  assert.equal(await evaluate('document.getElementById("panel-multieditor").hidden'),false,
    'Collapsing a category preserves the active editor panel');

  await evaluate(`(() => {
    window.__socialOriginalFetch=window.fetch;
    const urls={tiktok:'https://www.tiktok.com/tiktokstudio',instagram:'https://www.instagram.com/',youtube:'https://studio.youtube.com/'};
    let settings={browser:null,urls,confirmed:{tiktok:false,instagram:false,youtube:false}};
    window.fetch=(url,options)=>{
      if(!String(url).startsWith('/api/social-browser/'))return window.__socialOriginalFetch(url,options);
      const path=String(url),body=options?.body?JSON.parse(options.body):null;
      const keys=['tiktok','instagram','youtube'];
      if(path==='/api/social-browser/settings'){
        const confirmed=Object.fromEntries(keys.map(p=>[p,settings.browser===body.browser&&settings.urls[p]===body.urls[p]&&settings.confirmed[p]]));
        settings={...body,confirmed};
      }else if(path.includes('/confirm/')){
        const p=path.split('/').at(-1);
        settings.confirmed[p]=true;
      }
      const ready=!!settings.browser&&keys.every(p=>settings.confirmed[p]);
      const result=path.endsWith('/open/tiktok')||path.endsWith('/open/instagram')||path.endsWith('/open/youtube')?
        {opened:true,label:path.split('/').at(-1),loginVerified:false}:
        {browsers:[{id:'system',label:'Padrão do sistema',available:true}],platforms:{},settings,ready};
      return Promise.resolve(new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}}));
    };
  })()`);
  await evaluate('document.getElementById("workspace-group-social-trigger").click()');
  assert.equal(await evaluate('document.getElementById("workspace-group-social-items").hidden'),false,
    'Social category includes Publications');
  assert.equal(await evaluate('document.getElementById("tab-metrics")'),null,
    'Old OAuth metrics tab is removed');
  await evaluate('document.getElementById("tab-publications").click()');
  await wait(()=>evaluate('document.getElementById("panel-settings").hidden===false'),
    'First entry forwards to social browser settings');
  assert.equal(await evaluate('document.getElementById("socialBrowserSelect").value'),'system');
  assert.equal(await evaluate('document.getElementById("socialGoPublications").disabled'),true,
    'Publishing remains locked before logins');
  assert.equal(await evaluate('document.getElementById("socialClientId")'),null,
    'Obsolete Google/Instagram/TikTok OAuth credential form is removed');
  await evaluate('document.getElementById("socialUrl-youtube").value="https://studio.youtube.com/channel/UCexample";document.getElementById("socialSaveSettings").click()');
  await wait(()=>evaluate('document.getElementById("socialOpen-youtube").disabled===false'),
    'Save local browser and URL configuration');
  for(const p of ['tiktok','instagram','youtube']){
    await evaluate('document.getElementById("socialOpen-"+'+JSON.stringify(p)+').click()');
    await wait(()=>evaluate('document.getElementById("socialConfirm-"+'+JSON.stringify(p)+').disabled===false'),
      'Open official site and require explicit user confirmation');
    await evaluate('document.getElementById("socialConfirm-"+'+JSON.stringify(p)+').click()');
    await wait(()=>evaluate('document.getElementById("socialState-"+'+JSON.stringify(p)+').textContent==="Login conferido"'),
      'Store account confirmation after opening the site');
  }
  assert.equal(await evaluate('document.getElementById("socialGoPublications").disabled'),false,
    'Three confirmed platforms unlock Publications');
  await evaluate('document.getElementById("socialGoPublications").click()');
  assert.equal(await evaluate('document.getElementById("publishReady").hidden'),false,
    'Only the new ready screen is shown; no automatic upload controls');
  assert.equal(await evaluate('document.getElementById("publishSubmit")'),null,
    'Old automatic publisher has been removed');
  await evaluate('document.getElementById("publishManageAccounts").click()');
  await evaluate('document.getElementById("socialUrl-youtube").value="https://studio.youtube.com/channel/UCother";document.getElementById("socialSaveSettings").click()');
  await wait(()=>evaluate('document.getElementById("socialGoPublications").disabled===true'),
    'Switching Google/YouTube profiles invalidates previous confirmation');
  await evaluate('window.fetch=window.__socialOriginalFetch');
  await evaluate('document.getElementById("tab-videos").click()');
  assert.equal(await evaluate('document.getElementById("workspace-group-social-items").hidden'),true,
    'Direct workspaces close the nested social menu');

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
