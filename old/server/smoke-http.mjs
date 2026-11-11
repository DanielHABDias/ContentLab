import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-http-'));
const port=17000+Math.floor(Math.random()*2000);
const base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server/http.mjs'],{
  cwd:path.resolve('.'),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']
});
let output='';
child.stderr.on('data',chunk=>output+=chunk.toString());
const json=async(endpoint,body)=>{
  const r=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)});return [r.status,await r.json()];
};
try{
  fs.mkdirSync(path.join(root,'audio'));
  fs.writeFileSync(path.join(root,'audio','narration.wav'),'audio-fixture');
  const plan={project:{name:'HTTP-TEST',format:'custom',profile:'generic'},
    audio:{narration:'audio/narration.wav'},
    timeline:[{id:'first',start:0,end:2,background:{color:'#000000'},elements:[]}]};
  const file=path.join(root,'edit_plan.json');
  fs.writeFileSync(file,JSON.stringify(plan,null,2));
  let ready=false;
  for(let i=0;i<60;i++){
    await new Promise(resolve=>setTimeout(resolve,100));
    try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}
    if(child.exitCode!==null)break;
  }
  assert.ok(ready,'Node HTTP server must start. '+output);
  const home=await fetch(base+'/');assert.equal(home.status,200);
  assert.match(await home.text(),/Content Lab/);
  let [status,project]=await json('/api/editor/project',{projectRoot:root});
  assert.equal(status,200);
  assert.equal(project.validation.valid,true);
  assert.ok(project.revision);
  const [contextStatus,context]=await json('/api/editor/visual-context',{projectRoot:root});
  assert.equal(contextStatus,200);
  assert.ok(context.schema.$defs.scene);
  const planNext={...plan,timeline:[{...plan.timeline[0],end:3}]};
  let [saveStatus,saved]=await json('/api/editor/project/save',{
    projectRoot:root,planText:JSON.stringify(planNext),revision:project.revision
  });
  assert.equal(saveStatus,200);
  assert.equal(JSON.parse(saved.planText).timeline[0].end,3);
  const [conflict]=await json('/api/editor/project/save',{
    projectRoot:root,planText:JSON.stringify(planNext),revision:project.revision
  });
  assert.equal(conflict,409);
  const [invalid]=await json('/api/editor/validate',{
    projectRoot:root,plan:{...planNext,version:'0.2'}
  });
  assert.equal(invalid,422);
  const [previewRemoved]=await json('/api/editor/render',{
    projectRoot:root,mode:'preview',cacheMode:'reuse'
  });
  assert.equal(previewRemoved,400);
  const docsView=await fetch(base+'/api/docs/view');
  assert.equal(docsView.status,200);
  const docsPage=await docsView.text();
  assert.ok(docsPage.includes('audio.silenceInserts'));
  assert.ok(docsPage.includes('id="fieldSearch"'));
  assert.ok(docsPage.includes('<svg'));
  const mdFile=await fetch(base+'/api/docs/download?format=md');
  assert.equal(mdFile.status,200);
  assert.match(mdFile.headers.get('content-disposition'),/Documentacao-ContentLab.md/);
  const md=await mdFile.text();
  assert.ok(md.includes('timeline[].elements[].transform.scale'));
  const htmlFile=await fetch(base+'/api/docs/download?format=html');
  assert.equal(htmlFile.status,200);
  assert.match(htmlFile.headers.get('content-disposition'),/Documentacao-ContentLab.html/);
  const htmlDoc=await htmlFile.text();
  assert.ok(htmlDoc.includes('<svg'));
  assert.ok(!htmlDoc.includes('/api/docs/download?format=md'),'Offline HTML must not require server download links');
  const bad=await fetch(base+'/api/docs/download?format=pdf');
  assert.equal(bad.status,400,'Only the 2 documentation export formats are supported');
  const image=await fetch(base+'/api/docs/figures/grid.svg');
  assert.equal(image.status,200);
  assert.match(image.headers.get('content-type'),/svg/);
  const skill=await fetch(base+'/api/skill/download');
  assert.equal(skill.status,200);
  assert.match(skill.headers.get('content-type'),/zip/);
  const bytes=new Uint8Array(await skill.arrayBuffer());
  assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
  const zipIndex=Buffer.from(bytes).toString('latin1');
  for(const required of ['SKILL.md','docs/Documentacao-ContentLab.md',
    'docs/Documentacao-ContentLab.html','docs/figures/grid.svg','schemas/edit_plan.schema.json',
    'MOTION_DESIGN_JSON.md']){
    assert.ok(zipIndex.includes(required),'Skill ZIP is missing '+required);
  }
  const [closeStatus]=await json('/api/shutdown',{force:true});
  assert.equal(closeStatus,200);
  console.log(JSON.stringify({status:'passed',server:'node',html:true,schema:true,skillZipBytes:bytes.length}));
}finally{
  child.kill();
  fs.rmSync(root,{recursive:true,force:true});
}
