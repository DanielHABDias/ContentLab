import fs from 'node:fs';
import path from 'node:path';
import {APP_ROOT,readJson,assetReport,settings,compileScene,projectFile} from './plan.mjs';
import {sceneFingerprint,rendererIdentity,idFilename,statIdentity} from './cache.mjs';
import {transcriptWords,remapTranscriptWords} from './remotion.mjs';

function inspectStored(root,id) {
  const directory=path.join(root,'output','final','scenes');
  const manifest=path.join(directory,'manifest.json');
  if(!fs.existsSync(manifest)||fs.lstatSync(manifest).isSymbolicLink())return null;
  let entry;
  try {
    const data=readJson(manifest);
    if(data.format!=='contentlab-segments')return null;
    entry=data.entries?.[id];
  }catch{return null;}
  if(!entry||entry.file!==idFilename(id)||typeof entry.fingerprint!=='string')return null;
  const file=path.join(directory,idFilename(id));
  try{
    if(fs.lstatSync(file).isSymbolicLink())return null;
    const stat=statIdentity(file);
    if(stat.size==='0'||stat.size!==entry.size||stat.mtimeNs!==entry.mtimeNs)return null;
    return {file,fingerprint:entry.fingerprint,size:Number(stat.size)};
  }catch{return null;}
}
export function sceneCacheOverview(directory){
  const {root,file}=projectFile(directory),plan=readJson(file);
  const report=assetReport(plan,root);
  if(!report.valid)return {scenes:[],error:'O plano precisa ser válido para conferir o cache.'};
  const words=plan.sources?.transcript&&fs.existsSync(path.resolve(root,plan.sources.transcript))?
    remapTranscriptWords(transcriptWords(readJson(path.resolve(root,plan.sources.transcript))),plan.audio.sourceCuts):[];
  const identity=rendererIdentity(APP_ROOT),cfg=settings(plan);
  return {scenes:plan.timeline.map(scene=>{
    const stored=inspectStored(root,scene.id);
    if(!stored)return {id:scene.id,status:'missing',size:0};
    const compiled=compileScene(scene,plan,report.resolvedAssets);
    const fingerprint=sceneFingerprint(scene,compiled,cfg,report.resolvedAssets,words,identity);
    return {id:scene.id,status:fingerprint===stored.fingerprint?'ready':'changed',size:stored.size};
  })};
}
export function savedSceneFile(directory,id){
  const {root,file}=projectFile(directory);
  const plan=readJson(file);
  if(!plan.timeline.some(scene=>scene.id===id))return null;
  return inspectStored(root,id)?.file||null;
}
