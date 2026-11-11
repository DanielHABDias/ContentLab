#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {projectFile,validatePlan,PlanError} from './plan.mjs';
const target=process.argv[2];
if(!target){
  console.error('Uso: node server/migrate.mjs PASTA_DO_PROJETO');
  process.exitCode=2;
}else{
  try{
    const {root,file}=projectFile(target);
    const data=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
    if(Object.hasOwn(data,'version'))delete data.version;
    const issues=validatePlan(data);
    if(issues.length)throw new PlanError(issues);
    const before=fs.readFileSync(file,'utf8');
    const after=JSON.stringify(data,null,2)+'\n';
    if(before===after)console.log('O edit_plan.json já está no contrato único.');
    else{
      const stamp=new Date().toISOString().replace(/[:.]/g,'-');
      const backup=path.join(root,'edit_plan.backup-'+stamp+'.json');
      fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
      const temp=path.join(root,'.edit-plan-migration.tmp');
      try{fs.writeFileSync(temp,after);fs.renameSync(temp,file);}
      finally{if(fs.existsSync(temp))fs.rmSync(temp,{force:true});}
      console.log('Plano migrado. Backup: '+backup);
    }
  }catch(e){console.error(e.message);if(e.issues)console.error(e.issues);process.exitCode=2;}
}
