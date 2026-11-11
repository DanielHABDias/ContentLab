#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {readJson,assetReport,projectFile,PlanError} from './plan.mjs';
import {renderProject} from './render.mjs';
import {installedAssets,registry} from './project.mjs';

async function main(){
  const [command,directory,...flags]=process.argv.slice(2);
  if(command==='plugins'){console.log(JSON.stringify(registry(),null,2));return;}
  if(!['validate','render'].includes(command)||!directory){
    console.error('Uso: node server/cli.mjs validate|render PASTA_DO_PROJETO [--rebuild] [--gpu]');
    process.exitCode=2;return;
  }
  const {root,file}=projectFile(directory),plan=readJson(file);
  if(command==='validate'){
    const report=assetReport(plan,root);
    console.log(JSON.stringify(report,null,2));
    if(!report.valid)process.exitCode=2;
    return;
  }
  const report=await renderProject(root,{
    cacheMode:flags.includes('--rebuild')?'rebuild':'reuse',
    hardwareAccel:flags.includes('--gpu'),
    progress:(stage,current,total,scene)=>console.error('['+stage+'] '+current+'/'+total+' '+scene),
  });
  console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{
  console.error(JSON.stringify({error:e.message,issues:e.issues||[]},null,2));
  process.exitCode=2;
});
