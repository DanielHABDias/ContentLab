import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// Custom TSX is executable application code. Load it only from a LOCAL project's
// custom-scenes directory, never from a URL, JSON string or untrusted upload.
const allowed=/\.(tsx?|jsx?|json|css|svg)$/i;
const maxFiles=240, maxBytes=8*1024*1024;

function sourcesFor(modulePath){
  if(!modulePath||path.extname(modulePath).toLowerCase()!=='.tsx')
    throw Error('Cena programável requer um módulo .tsx.');
  const real=fs.realpathSync(modulePath);
  let sourceDir=path.dirname(real);
  while(path.basename(sourceDir)!=='custom-scenes'){
    const parent=path.dirname(sourceDir);
    if(parent===sourceDir)throw Error('TSX deve pertencer à pasta custom-scenes do projeto.');
    sourceDir=parent;
  }
  const files=[];
  let total=0;
  function visit(folder){
    for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
      const full=path.join(folder,entry.name);
      if(entry.isSymbolicLink())throw Error('Links simbólicos não são permitidos nos módulos TSX.');
      if(entry.isDirectory()){visit(full);continue;}
      if(!entry.isFile()||!allowed.test(entry.name))continue;
      const st=fs.statSync(full);
      total+=st.size;
      files.push({full,relative:path.relative(sourceDir,full)});
      if(files.length>maxFiles||total>maxBytes)
        throw Error('Pasta custom-scenes excede 240 arquivos ou 8 MB de fontes.');
    }
  }
  visit(sourceDir);
  if(!files.some(x=>x.full===real))
    throw Error('Arquivo TSX não encontrado dentro de custom-scenes.');
  return {sourceDir,files:files.sort((a,b)=>a.relative.localeCompare(b.relative)),moduleRelative:path.relative(sourceDir,real)};
}

export function customSceneSourceFingerprint(modulePath){
  const {files}=sourcesFor(modulePath);
  return files.map(({full,relative})=>[relative.replaceAll(path.sep,'/'),
    crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')]);
}

export function stageCustomScene(config,remotionDirectory){
  const {files,moduleRelative}=sourcesFor(config.module_path);
  const directory=fs.mkdtempSync(path.join(remotionDirectory,'.contentlab-custom-'));
  try{
    for(const {full,relative} of files){
      const destination=path.join(directory,'custom-scenes',relative);
      fs.mkdirSync(path.dirname(destination),{recursive:true});
      fs.copyFileSync(full,destination);
    }
    const specifier='./custom-scenes/'+moduleRelative.split(path.sep).join('/');
    // Keep the default scene composition as an optional underlying layer.
    // In "replace" mode the user's component owns the entire visual scene.
    const entry=`import React from 'react';
import {AbsoluteFill,Composition,registerRoot,staticFile} from 'remotion';
import {Scene} from '../src/scene';
import UserScene from ${JSON.stringify(specifier)};
const sample:any={width:1920,height:1080,fps:30,durationInFrames:90,
  scene:{id:'sample',start:0,end:3,background:{color:'#000'},camera:{},elements:[]},words:[],customAssets:{}};
const Combined=(props:any)=>{
  const config=props.scene.customComponent||{};
  const assets=Object.fromEntries(Object.entries(props.customAssets||{}).map(([name,file])=>[name,staticFile(String(file))]));
  // Editorial TSX is composited ABOVE the ordinary Scene. Elements with high
  // z (e.g. Minecraft green-screen intro z=900) need a separate foreground
  // pass AFTER UserScene; otherwise z only orders elements INSIDE Scene.
  const isForeground=(element:any)=>element.type==='overlay' &&
    (Number(element.z)>=900 || element.data?.config?.alwaysOnTop===true || element.data?.alwaysOnTop===true);
  const foreground=(props.scene.elements||[]).filter(isForeground);
  const normal=(props.scene.elements||[]).filter((element:any)=>!isForeground(element));
  const baseProps={...props,scene:{...props.scene,elements:normal}};
  const overlayProps={...props,scene:{...props.scene,elements:foreground,
    background:{color:'transparent'},backgroundSrc:null,camera:{keyframes:[]}}};
  return <AbsoluteFill>
    {config.mode==='overlay' && <Scene {...baseProps}/>}
    <UserScene {...(config.props||{})} assets={assets} />
    {foreground.length>0 && <Scene {...overlayProps}/>}
  </AbsoluteFill>;
};
const Root=()=> <Composition id="Scene" component={Combined}
  width={1920} height={1080} fps={30} durationInFrames={90}
  defaultProps={sample}
  calculateMetadata={({props})=>({
    width:props.width,height:props.height,fps:props.fps,durationInFrames:props.durationInFrames,
  })}/>;
registerRoot(Root);
`;
    const entryPath=path.join(directory,'index.tsx');
    fs.writeFileSync(entryPath,entry);
    return {directory,entry:entryPath};
  }catch(e){fs.rmSync(directory,{recursive:true,force:true});throw e;}
}
