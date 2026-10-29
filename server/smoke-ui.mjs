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
    const items=[];
    window.fetch=(url,options)=>{
      if(!String(url).startsWith('/api/social-browser/'))return window.__socialOriginalFetch(url,options);
      const endpoint=String(url),body=typeof options?.body==='string'?JSON.parse(options.body):null;
      const keys=['tiktok','instagram','youtube'];
      if(endpoint==='/api/social-browser/settings'){
        const confirmed=Object.fromEntries(keys.map(p=>[p,settings.browser===body.browser&&settings.urls[p]===body.urls[p]&&settings.confirmed[p]]));
        settings={...body,confirmed};
      }else if(endpoint.includes('/confirm/')){
        settings.confirmed[endpoint.split('/').at(-1)]=true;
      }else if(endpoint==='/api/social-browser/drafts'&&options?.method==='POST'){
        const form=options.body;
        const item={id:'00000000-1111-4444-8888-'+String(items.length+1).padStart(12,'0'),
          kind:form.get('kind'),titleA:form.get('titleA'),titleB:form.get('titleB'),description:form.get('description'),
          tags:form.get('tags').split(',').map(x=>x.trim()).filter(Boolean),
          platforms:JSON.parse(form.get('platforms')),fileName:form.get('video').name,scheduledAt:form.get('scheduledAt')};
        items.unshift(item);
        return Promise.resolve(new Response(JSON.stringify({item}),{status:201,headers:{'Content-Type':'application/json'}}));
      }else if(endpoint==='/api/social-browser/drafts'){
        return Promise.resolve(new Response(JSON.stringify({items}),{status:200,headers:{'Content-Type':'application/json'}}));
      }
      const ready=!!settings.browser&&keys.some(p=>settings.confirmed[p]);
      const result=endpoint.includes('/open/')?
        {opened:true,label:endpoint.split('/').at(-1),loginVerified:false}:
        {browsers:[{id:'system',label:'Padrão do sistema',available:true}],platforms:{},settings,ready};
      return Promise.resolve(new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}}));
    };
  })()`);
  await evaluate('document.getElementById("workspace-group-social-trigger").click()');
  await evaluate('document.getElementById("tab-publications").click()');
  await wait(()=>evaluate('document.getElementById("panel-settings").hidden===false'),'First social visit redirects to settings');
  assert.equal(await evaluate('document.getElementById("socialGoPublications").disabled'),true);
  assert.equal(await evaluate('document.getElementById("socialClientId")'),null,'Legacy OAuth credentials removed');
  await evaluate('document.getElementById("socialSaveSettings").click()');
  await wait(()=>evaluate('document.getElementById("socialOpen-tiktok").disabled===false'),'Settings saved');
  await evaluate('document.getElementById("socialOpen-tiktok").click()');
  await wait(()=>evaluate('document.getElementById("socialConfirm-tiktok").disabled===false'),'TikTok login opened');
  await evaluate('document.getElementById("socialConfirm-tiktok").click()');
  await wait(()=>evaluate('document.getElementById("socialGoPublications").disabled===false'),
    'One confirmed social network unlocks Publications');
  await evaluate('document.getElementById("socialGoPublications").click()');
  await wait(()=>evaluate('document.getElementById("publishReady").hidden===false'),'New board appears');
  assert.equal(await evaluate('document.getElementById("publishNetwork-tiktok").classList.contains("is-connected")'),true);
  assert.equal(await evaluate('document.getElementById("publishNetwork-youtube").classList.contains("is-disabled")'),true);
  assert.equal(await evaluate('document.getElementById("publishDraftCount").textContent'),'0');
  assert.equal(await evaluate('document.getElementById("publishEmptyCard").classList.contains("is-first")'),true);
  await evaluate('document.getElementById("publishEmptyCard").click()');
  assert.equal(await evaluate('document.getElementById("publishComposerDialog").open'),true);
  assert.equal(await evaluate('document.getElementById("publishLongCovers").hidden'),true,
    'Short has one cover and optional visual frame extraction');
  await evaluate('document.querySelector("#publishComposerForm input[value=long]").click()');
  assert.equal(await evaluate('document.getElementById("publishLongCovers").hidden'),false);
  assert.equal(await evaluate('document.querySelector("#publishDestinations input[value=youtube]").disabled'),true,
    'Long format excludes YouTube as specified');
  assert.equal(await evaluate('document.querySelector("#publishDestinations input[value=tiktok]").disabled'),false);
  await evaluate(`(() => {
    const assign=(id,file)=>{
      const input=document.getElementById(id),files=new DataTransfer();
      files.items.add(file);input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    };
    const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82]);
    const video=new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0]);
    assign('publishVideoFile',new File([video],'longo.mp4',{type:'video/mp4'}));
    assign('publishCoverA',new File([png],'a.png',{type:'image/png'}));
    assign('publishCoverB',new File([png],'b.png',{type:'image/png'}));
    document.getElementById('publishTitleA').value='Título A';
    document.getElementById('publishTitleB').value='Título B';
    document.querySelector('#publishDestinations input[value=tiktok]').click();
    document.getElementById('publishComposerForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  })()`);
  await wait(()=>evaluate('document.getElementById("publishDraftCount").textContent==="1"'),
    'Long-form A/B draft is added to the board');
  assert.equal(await evaluate('document.querySelector(".publish-draft-ab").textContent.includes("Título B")'),true);
  await evaluate('document.getElementById("publishAddVideo").click()');
  await evaluate(`(() => {
    const input=document.getElementById('publishVideoFile'),files=new DataTransfer();
    files.items.add(new File([new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109])],'curto.mp4',{type:'video/mp4'}));
    input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    const cover=document.getElementById('publishShortCoverFile'),covers=new DataTransfer();
    covers.items.add(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'capa.png',{type:'image/png'}));
    cover.files=covers.files;cover.dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('publishTitleA').value='Meu Short';
    document.querySelector('#publishDestinations input[value=tiktok]').click();
    document.getElementById('publishComposerForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  })()`);
  await wait(()=>evaluate('document.getElementById("publishDraftCount").textContent==="2"'),
    'Second short adds to existing list without sending to platforms');
  assert.equal(await evaluate('document.querySelectorAll(".publish-draft-card").length'),2);
  await evaluate('document.getElementById("publishManageAccounts").click()');
  await evaluate('document.getElementById("socialUrl-youtube").value="https://studio.youtube.com/channel/UCother";document.getElementById("socialSaveSettings").click()');
  await wait(()=>evaluate('document.getElementById("socialGoPublications").disabled===false'),
    'Changing an unconfirmed YouTube URL does not disable confirmed TikTok');
  await evaluate('window.fetch=window.__socialOriginalFetch');
  await evaluate('document.getElementById("tab-videos").click()');
  assert.equal(await evaluate('document.getElementById("workspace-group-social-items").hidden'),true);
  
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
