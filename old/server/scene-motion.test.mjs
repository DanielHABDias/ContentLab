import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const repo=process.env.CONTENTLAB_REVIEW_REPO??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=process.env.CONTENTLAB_REVIEW_LIBRARY??path.join(repo,'scene-library');
const require=createRequire(path.join(repo,'backend/remotion/package.json')),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const modules=new Map();let config={width:1920,height:1080,fps:30,durationInFrames:210},frame=0;
function load(file){if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,console,Float64Array,Int16Array,require:name=>{
  if(name==='react')return React;if(name==='remotion')return {AbsoluteFill:({children,...props})=>React.createElement('div',props,children),Img:({src,...props})=>React.createElement('img',{src,...props}),useCurrentFrame:()=>frame,useVideoConfig:()=>config};
  if(name==='@remotion/fonts')return {};if(name.startsWith('./'))return load(path.resolve(path.dirname(file),name+'.tsx'));throw Error(name);
 }});return exports;
}
const mod=id=>{const item=JSON.parse(fs.readFileSync(root+'/manifest.json')).find(x=>x.id===id);return load(path.join(root,id,item.file));};
test('HQ motion progress arrives on final displayed frame at multiple FPS',()=>{
 const {progressHQ,edgeTravelHQ}=load(root+'/linha-do-tempo-hq/HQMotion.tsx');
 for(const fps of [24,25,30,60]){assert.equal(progressHQ(7-1/fps,5.95,1.05,fps),1);assert.equal(progressHQ(0,1,1,fps),0);}
 for(const [position,size,viewport] of [[200,40,1920],[50,500,1080]]){assert.ok(position-edgeTravelHQ(position,size,viewport,-1)+size<0);assert.ok(position+edgeTravelHQ(position,size,viewport,1)>viewport);}
});
test('gallery linear depth preparation matches original all-pairs computation',()=>{
 const {galleryDepth,galleryDepths}=mod('galeria-cartas-hq');
 for(const columns of [1,2,3,4])for(const t of [0,.3,2,4,12]){const starts=Array.from({length:40},(_,i)=>i*.7),fast=galleryDepths(columns,starts,t,.65);for(let i=0;i<40;i++)assert.ok(Math.abs(fast[i]-galleryDepth(i,columns,starts,t,.65))<1e-9);}
});
test('carousel arrival and kinetic settlement preserve their timing contracts',()=>{
 const c=mod('carrossel-frases-hq');assert.equal(c.carouselPosition([{text:'A',at:0},{text:'B',at:3}],3,.45),1);
 const text=mod('texto-hq');for(const count of [1,2,20,100]){const p=text.kineticGlyph(1,count-1,count,1);assert.equal(p.opacity,1);assert.equal(p.offset,0);}
 assert.equal(text.prepareTextSteps({text:'UMA IDEIA',entryAnimation:'kinetic',kineticUnit:'word'},4,30)[0].kineticUnit,'word');
 assert.throws(()=>text.prepareTextSteps({text:'A',entryAnimation:'kinetic',kineticUnit:'wrong'},4,30),/kineticUnit/);
});
test('loading holds and dialogue same-speaker continuity survive preparation',()=>{
 const b=mod('barra-loading-hq');assert.equal(b.progressAt([{at:0,value:0},{at:2,value:30},{at:4,value:30}],3),30);
 const d=mod('dialogo-hq'),turns=[{speaker:'left',text:'A',at:0,duration:2},{speaker:'left',text:'B',at:2,duration:2}];
 assert.equal(d.dialogueWeights(turns,2,.45,d.dialogueEvents(turns)).left,1);
 const brain=mod('brainstorm-hq').buildTimeline([{id:'a',text:'A'},{id:'b',text:'B'}],[{node:'a',hold:1},{node:'b',hold:1,moveDuration:.5}],1);
 assert.equal(brain.firstByNode.get('b').arrival,1.5);
});
test('precomputed spiral matches baseline pixel classification in both variants',()=>{
 const {spiralField}=mod('personagem-espiral-legenda'),width=960,height=540,cols=320,rows=180;
 for(const variant of ['espiral','crescente']){const field=spiralField(cols,rows,width,height,variant),radius=Math.hypot(width,height)/2;
  for(const time of [0,.3,1.03,4.97])for(let y=0;y<rows;y+=3)for(let x=0;x<cols;x+=3){const dx=(x+.5)/cols*width-width/2,dy=(y+.5)/rows*height-height/2,d=Math.hypot(dx,dy)/radius,bend=(variant==='crescente'?.55:.42)*d**.85+.02*Math.sin(d*5)*d,rotation=time*(variant==='crescente'?-.09:.075);
   assert.equal(Math.sin(field.phase[y*cols+x]-rotation*10)>0,Math.sin((Math.atan2(dy,dx)-bend-rotation)*10)>0);
  }
 }
});
test('procedural backgrounds render all styles and opacity zero returns no content',()=>{
 const Background=mod('background-hq').default;
 for(const style of ['solid','halftone','stars','film','paper','grid','comic_page']){
  const html=renderToStaticMarkup(React.createElement(Background,{backgroundStyle:style,backgroundOpacity:100}));assert.ok(html.length>10);
  const empty=renderToStaticMarkup(React.createElement(Background,{backgroundStyle:style,backgroundOpacity:0}));
  if(style==='comic_page')assert.ok(empty.includes('opacity:0'));else assert.equal(empty,'');
 }
});
