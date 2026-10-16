import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {APP_ROOT,projectFile,assetReport,validatePlan,readJson,schema,PlanError,sha} from './plan.mjs';
import {transcriptStatus} from './narration-pipeline.mjs';

const MAX_PLAN=5*1024*1024;
const projectSummary=(p)=>({name:p.project.name,scenes:(p.timeline||[]).map(s=>({id:s.id,start:s.start,end:s.end,elements:s.elements?.length||0}))});
export function loadProject(directory){
  const {root,file}=projectFile(directory);
  const bytes=fs.readFileSync(file);
  if(bytes.length>MAX_PLAN)throw new PlanError([{path:'edit_plan.json',message:'JSON excede 5 MB.'}]);
  const planText=bytes.toString('utf8').replace(/^\uFEFF/,'');
  const revision=crypto.createHash('sha256').update(bytes).digest('hex');
  try{
    const plan=JSON.parse(planText);
    const validation=assetReport(plan,root);
    return {projectRoot:root,planPath:file,planText,revision,
      name:plan.project?.name||path.basename(root),
      scenes:(plan.timeline||[]).map(s=>({id:s.id,start:s.start,end:s.end,elements:s.elements?.length||0})),validation,
       transcription:transcriptStatus(root,plan)};
  }catch(e){
    return {projectRoot:root,planPath:file,planText,revision,name:path.basename(root),scenes:[],
      validation:{valid:false,errors:[{path:'edit_plan.json',message:e.message}],missingAssets:[],resolvedAssets:{}}};
  }
}
export function saveProject(directory,planText,expectedRevision){
  const {root,file}=projectFile(directory);
  if(typeof planText!=='string'||Buffer.byteLength(planText)>MAX_PLAN)throw new PlanError([{path:'planText',message:'Plano excede 5 MB.'}]);
  if(!expectedRevision)throw new PlanError([{path:'revision',message:'Recarregue o projeto antes de salvar.'}]);
  const parsed=JSON.parse(planText);
  const problems=validatePlan(parsed);if(problems.length)throw new PlanError(problems);
  const current=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(current!==expectedRevision)throw new PlanError([{path:'revision',message:'O plano mudou no disco. Recarregue antes de salvar.'}]);
  const temp=path.join(root,'.edit-plan-'+crypto.randomUUID()+'.tmp');
  try{fs.writeFileSync(temp,planText,'utf8');fs.renameSync(temp,file);}
  finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return loadProject(root);
}
export function createProject(parentDirectory,name){
  if(typeof name!=='string'||!/^[-\p{L}\p{N}_][\p{L}\p{N} _.-]{0,79}$/u.test(name)||name.endsWith('.')||name.endsWith(' '))throw new PlanError([{path:'name',message:'Nome de projeto inválido.'}]);
  const parent=fs.realpathSync(parentDirectory);
  const root=path.join(parent,name);
  if(fs.existsSync(root))throw new PlanError([{path:'name',message:'Já existe um projeto com esse nome.'}]);
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(root,'audio'));
  fs.mkdirSync(path.join(root,'assets'));
  const initial={project:{name,format:'youtube_long',profile:'generic'},sources:{assets:'assets',transcript:'transcript.json'},
    audio:{narration:'audio/narration.wav'},timeline:[]};
  fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify(initial,null,2)+'\n');
  return loadProject(root);
}
export function listAssets(directory,subdir){
  const {root}=projectFile(directory);
  if(!subdir)throw new PlanError([{path:'folder',message:'Selecione pasta de assets.'}]);
  const dest=fs.realpathSync(subdir);
  if(dest!==root&&!dest.startsWith(root+path.sep))throw new PlanError([{path:'folder',message:'Pasta precisa estar dentro do projeto.'}]);
  const files=[];
  const walk=directory=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(files.length>=500)return;
      const target=path.join(directory,entry.name);
      if(entry.isSymbolicLink())continue;
      if(entry.isDirectory())walk(target);
      else if(entry.isFile())files.push(target);
    }
  };
  walk(dest);
  files.sort();
  return {folder:dest,relative:path.relative(root,dest).split(path.sep).join('/'),
    assets:files.map(file=>({uri:'project://'+path.relative(root,file).split(path.sep).join('/'),path:file})),
    truncated:files.length===500};
}
const EXT={backgrounds:['.png','.jpg','.jpeg','.webp','.mp4','.mkv','.webm'],
  music:['.mp3','.wav','.ogg','.m4a','.flac'],sfx:['.mp3','.wav','.ogg','.m4a','.flac'],transitions:['.mp4','.mov','.webm']};
export function installedAssets(){
  const result={};for(const [category,extensions] of Object.entries(EXT)){
    const root=path.join(APP_ROOT,'builtin-assets',category),items=[];
    const visit=folder=>{
      for(const item of fs.readdirSync(folder,{withFileTypes:true})){
        const file=path.join(folder,item.name);
        if(item.isSymbolicLink())continue;
        if(item.isDirectory())visit(file);
        else if(item.isFile()&&extensions.includes(path.extname(item.name).toLowerCase()))items.push({name:item.name,uri:'builtin://'+path.relative(path.join(APP_ROOT,'builtin-assets'),file).split(path.sep).join('/'),
          type:/\.(mp4|mov|mkv|webm)$/i.test(item.name)?'video':'image'});
      }
    };
    if(fs.existsSync(root))visit(root);
    result[category]=items.sort((a,b)=>a.name.localeCompare(b.name));
  }return result;
}
export function registry(){
  return {layouts:['fullscreen','3x3','custom_grid','three_columns','left_right','character_vs','center_column'],
    transitions:['cut','fade','blur_left','blur_right','blur_up','blur_down','slide_left','flip','curtain'],
    motions:['cut','none','fade','fade_out','slide_up','pop_in','float_soft','wiggle_soft','slow_zoom_in','slow_zoom_out','pan','pulse_soft'],
    motion_enter:['cut','none','fade','pop_in','slide_from_left','slide_from_right','slide_up','slide_down','center_reveal'],
    motion_idle:['none','float_soft','wiggle_soft','pulse_soft','slow_zoom_in','slow_zoom_out','pan'],
    motion_exit:['cut','none','fade','fade_out','slide_to_left','slide_to_right','slide_to_bottom','center_close'],
    text_styles:['impact','impact_yellow','paper_word','versus_big','word_pop','anton','bangers'],
    caption_styles:['anton_karaoke','bangers_highlight_block'],
    overlay_styles:['green_screen','green_screen_default','green_screen_soft'],filter_styles:['dim','crt_tv']};
}
export function visualContext(directory){
  const {root}=projectFile(directory);
  const list=listAssets(root,root);
  const transcript=path.join(root,'transcript.json');
  let segments=null;
  try{const t=readJson(transcript);segments=t.segments?.slice(0,2000)||null;}catch{}
  return {schema:schema(),projectAssets:list.assets.map(a=>a.uri),builtin:installedAssets(),
    transcript:segments,plugins:registry()};
}
