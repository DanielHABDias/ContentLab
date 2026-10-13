import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {renderRemotionScene} from './remotion.mjs';
import {compileScene,validatePlan} from './plan.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-word-stack-'));
const width=640,height=360,fps=12;
const panel='#707070',background='#101010';
const plan={
  project:{name:'word-stack-visual-test',format:'custom',profile:'generic',resolution:{width,height},fps},
  sources:{assets:'assets'},
  audio:{narration:'audio/narration.wav'},
  timeline:[{
    id:'stack',start:0,end:3.4,layout:'fullscreen',
    background:{color:background},
    elements:[{
      id:'phrases',type:'kinetic_text',style:'word_stack_vertical',start:0,end:3.4,
      // Deliberately TWO columns: the active row must still span the entire frame.
      cells:[1,2,4,5,7,8],fontScale:0.95,
      textStyle:{fontFamily:'Anton',uppercase:true,color:'#FFFFFF',outlineWidth:0},
      config:{
        items:[
          {text:'BATMAN NÃO É JUIZ',start:0,end:0.85},
          {text:'BATMAN NÃO É O CARRASCO DE GOTHAM',start:0.85,end:1.7},
          {text:'A JUSTIÇA NÃO É VINGANÇA',start:1.7,end:2.55},
          {text:'ELE ESCOLHE SALVAR',start:2.55,end:3.4}
        ],
        transitionDuration:.18,direction:'down',align:'left',
        panelColor:panel,panelOpacity:1,panelRadius:0,slotGap:.24,
        activeScale:1.45,inactiveScale:.72,inactiveOpacity:.4,inactiveColor:'#AAAAAA'
      }
    }],
    transitionOut:'cut'
  }]
};
const rgb=(image,x,y)=>Array.from(image.subarray((y*width+x)*3,(y*width+x)*3+3));
const brightness=p=>p.reduce((a,b)=>a+b,0)/3;
function frame(file,time){
  const f=spawnSync('ffmpeg',['-hide_banner','-loglevel','error',
    '-ss',String(time),'-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{
    encoding:null,maxBuffer:width*height*6,timeout:90_000});
  assert.equal(f.status,0,String(f.stderr));
  assert.equal(f.stdout.length,width*height*3);
  return f.stdout;
}
function maxLuma(image,minY,maxY){
  let max=0;
  for(let y=minY;y<maxY;y+=2)for(let x=25;x<width-25;x+=2){
    max=Math.max(max,brightness(rgb(image,x,y)));
  }
  return max;
}
try{
  assert.deepEqual(validatePlan(plan),[]);
  const scene=compileScene(plan.timeline[0],plan,{});
  assert.deepEqual(scene.elements[0].region,[0,0,Math.round(width*2/3),height]);
  const output=path.join(root,'stack.mp4');
  await renderRemotionScene(scene,{width,height,fps},[],output);
  assert.ok(fs.statSync(output).size>3000);
  for(const time of [1.2,2.0]){
    const image=frame(output,time);
    // Band only in the middle row, but from left to right edge of the
    // entire 640px canvas, NOT cut off at x=426 (two selected columns).
    for(const x of [3,420,636]){
      const sample=rgb(image,x,180);
      assert.ok(Math.abs(brightness(sample)-112)<19,
        'Full width band failed at x='+x+': '+sample+' t='+time);
    }
    assert.ok(brightness(rgb(image,3,20))<35,'Upper row has an unintended background card');
    assert.ok(brightness(rgb(image,636,340))<35,'Lower row has an unintended background card');
    assert.ok(maxLuma(image,126,233)>165,'Center active phrase must be prominent');
    assert.ok(maxLuma(image,4,120)<150,'Upper inactive phrase must be faded');
    assert.ok(maxLuma(image,241,356)<150,'Lower inactive phrase must be faded');
    assert.ok(maxLuma(image,4,120)>27,'Next phrase must appear in the upper row');
    assert.ok(maxLuma(image,241,356)>27,'Previous phrase must appear in the lower row');
  }
  console.log(JSON.stringify({status:'passed',kind:'word-stack-visual',
    framesChecked:[1.2,2.0],canvas:`${width}x${height}`,cells:[1,2,4,5,7,8],
    fullWidthPanel:true,upperBottomAnchored:true,lowerTopAnchored:true}));
}finally{
  if(process.env.CONTENTLAB_KEEP_SMOKE!=='1')fs.rmSync(root,{recursive:true,force:true});
}
