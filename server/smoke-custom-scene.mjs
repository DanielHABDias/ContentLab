import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {APP_ROOT} from './plan.mjs';
import {renderRemotionScene} from './remotion.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-programmable-smoke-'));
try{
  const scenes=path.join(root,'custom-scenes');
  fs.mkdirSync(scenes,{recursive:true});
  const module_path=path.join(scenes,'FollowDot.tsx');
  fs.copyFileSync(path.join(APP_ROOT,'examples/custom-scenes/FollowDot.tsx'),module_path);
  const scene={
    id:'follow-dot',start:0,end:17.7,background:{color:'#090a0e'},camera:{keyframes:[]},
    elements:[],customComponent:{module_path,mode:'replace',
      props:{title:'DIAZVERSO',subtitle:'EVERY MOVE, WRITTEN IN CODE'},assets:{},assetPaths:{}}
  };
  const settings={width:576,height:1024,fps:30};
  const target=path.join(root,'custom.mp4');
  await renderRemotionScene(scene,settings,[],target,{hardwareAccel:false});
  const probe=spawnSync(process.env.FFPROBE_PATH||'ffprobe',
    ['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',target],
    {encoding:'utf8'});
  if(probe.status!==0)throw Error(probe.stderr||'FFprobe failed');
  const duration=Number(probe.stdout);
  if(Math.abs(duration-17.7)>.2)throw Error('Duração incorreta: '+duration);
  for(const t of [1,3,5,8,12,16]){
    const screenshot=path.join(root,'frame-'+t+'.png');
    const result=spawnSync(process.env.FFMPEG_PATH||'ffmpeg',
      ['-v','error','-y','-ss',String(t),'-i',target,'-frames:v','1',screenshot],
      {encoding:'utf8'});
    if(result.status!==0||!fs.existsSync(screenshot)||fs.statSync(screenshot).size<2500)
      throw Error('Frame inválido em '+t+' segundos: '+result.stderr);
  }
  console.log('Custom TSX scene rendered, duration='+duration+'s, six valid frame checkpoints.');
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}
