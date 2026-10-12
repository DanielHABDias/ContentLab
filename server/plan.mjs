import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCHEMA_PATH = path.join(APP_ROOT, 'schemas', 'edit_plan.schema.json');
export const FORMATS = {youtube_long:[1920,1080,30],youtube_short:[1080,1920,30],custom:[1920,1080,30]};
const MEDIA = new Set(['video','image','overlay','sfx']);
const LAYOUTS = new Set(['fullscreen','3x3','custom_grid','three_columns','left_right','character_vs','nox']);
const TRANSITIONS = new Set(['cut','fade','blur_left','blur_right','blur_up','slide_left']);
const AUTO_CELLS = {
  three_columns:[[1,4,7],[2,5,8],[3,6,9]],
  character_vs:[[1,4,7],[3,6,9]],
  left_right:[[1,4,7],[3,6,9]],
  nox:[[2,5,8]],
};
export class PlanError extends Error {
  constructor(errors) {super('Plano de edição inválido.');this.name='PlanError';this.issues=errors;}
}
export function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
export function sha(data){return crypto.createHash('sha256').update(typeof data==='string'?data:JSON.stringify(data)).digest('hex');}
export function schema(){return readJson(SCHEMA_PATH);}
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function validateShape(obj, definition=schema()) {
  const errors=[];
  const root=definition;
  const visit=(node,rule,p)=>{
    if(rule.$ref){const found=rule.$ref.split('/').slice(1).reduce((a,k)=>a?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],root);if(!found){errors.push({path:p,message:'Schema inválido.'});return;}return visit(node,found,p);}
    if(rule.oneOf){if(!rule.oneOf.some(one=>{const old=errors.length;visit(node,one,p);const ok=errors.length===old;errors.length=old;return ok;})) errors.push({path:p,message:'Formato não permitido.'});return;}
    if(rule.type){
      const valid={object:isObject(node),array:Array.isArray(node),integer:Number.isInteger(node),
        number:typeof node==='number'&&Number.isFinite(node),string:typeof node==='string',boolean:typeof node==='boolean'}[rule.type];
      if(!valid){errors.push({path:p,message:'Tipo inválido: esperado '+rule.type});return;}
    }
    if(rule.const!==undefined&&node!==rule.const){errors.push({path:p,message:'Valor não permitido.'});return;}
    if(rule.enum&&!rule.enum.includes(node)){errors.push({path:p,message:'Opção não permitida.'});return;}
    if(typeof node==='number'){
      if(rule.minimum!==undefined&&node<rule.minimum)errors.push({path:p,message:'Abaixo do mínimo.'});
      if(rule.maximum!==undefined&&node>rule.maximum)errors.push({path:p,message:'Acima do máximo.'});
      if(rule.exclusiveMinimum!==undefined&&node<=rule.exclusiveMinimum)errors.push({path:p,message:'Valor deve ser maior que '+rule.exclusiveMinimum});
    }
    if(typeof node==='string'&&rule.minLength!==undefined&&node.length<rule.minLength)errors.push({path:p,message:'Texto obrigatório.'});
    if(isObject(node)){
      for(const key of rule.required||[])if(!(key in node))errors.push({path:p+'.'+key,message:'Campo obrigatório.'});
      for(const [key,value] of Object.entries(node)){
        if(rule.properties?.[key])visit(value,rule.properties[key],p+'.'+key);
        else if(rule.additionalProperties===false)errors.push({path:p+'.'+key,message:'Campo não previsto no schema.'});
      }
    }
    if(Array.isArray(node)){
      if(rule.minItems!==undefined&&node.length<rule.minItems)errors.push({path:p,message:'Lista insuficiente.'});
      if(rule.uniqueItems&&new Set(node.map(JSON.stringify)).size!==node.length)errors.push({path:p,message:'Valores duplicados.'});
      if(rule.items)node.forEach((item,i)=>visit(item,rule.items,p+'.'+i));
    }
  };
  visit(obj,definition,'$');
  return errors;
}
export function validatePlan(plan){
  const issues=validateShape(plan);
  if(!isObject(plan)||!Array.isArray(plan.timeline))return issues;
  const a=plan.audio||{};
  if(a.narrationTrim&&a.sourceCuts?.length)
    issues.push({path:'audio.narrationTrim',message:'Escolha narrationTrim OU sourceCuts para a narração, não os dois.'});
  if(a.narrationTrim&&!(a.narrationTrim.end>a.narrationTrim.start))
    issues.push({path:'audio.narrationTrim',message:'O fim do trim da narração deve superar o início.'});
  for(let i=0;i<(a.sourceCuts||[]).length;i++){
    const cut=a.sourceCuts[i];
    if(!(cut.end>cut.start))
      issues.push({path:'audio.sourceCuts.'+i,message:'O fim do recorte da narração deve superar o início.'});
  }
  for(let i=0;i<(a.music||[]).length;i++){
    const m=a.music[i],path='audio.music.'+i,clip=m.end-m.start;
    if(!(clip>0))issues.push({path,message:'Música deve terminar após seu início na timeline.'});
    if(m.sourceEnd!==undefined&&!(m.sourceEnd>(m.sourceStart??0)))
      issues.push({path:path+'.sourceEnd',message:'sourceEnd deve ser posterior a sourceStart.'});
    if(m.fadeIn!==undefined&&m.fadeIn>clip)
      issues.push({path:path+'.fadeIn',message:'Fade-in não pode exceder a duração da música na timeline.'});
    if(m.fadeOut!==undefined&&m.fadeOut>clip)
      issues.push({path:path+'.fadeOut',message:'Fade-out não pode exceder a duração da música na timeline.'});
    if(m.loop===false&&m.sourceEnd!==undefined&&m.sourceEnd-(m.sourceStart??0)+0.001<clip)
      issues.push({path:path+'.loop',message:'Sem loop, o trecho da fonte não cobre a duração escolhida.'});
  }
  const inserts=plan.audio?.silenceInserts||[];
  let previousGapEnd=-1;
  for(let i=0;i<inserts.length;i++){
    const gap=inserts[i];
    if(gap.at<previousGapEnd)
      issues.push({path:'audio.silenceInserts.'+i,message:'Pausas da narração fora de ordem ou sobrepostas.'});
    previousGapEnd=Math.max(previousGapEnd,gap.at+gap.duration);
  }
  const ids=new Set();
  let lastEnd=0;
  for(let i=0;i<plan.timeline.length;i++){
    const scene=plan.timeline[i],p='timeline.'+i;
    if(!isObject(scene))continue;
    if(ids.has(scene.id))issues.push({path:p+'.id',message:'ID de cena duplicado.'});
    ids.add(scene.id);
    if(!(scene.end>scene.start))issues.push({path:p,message:'Fim deve ser maior que início.'});
    if(scene.start<lastEnd)issues.push({path:p+'.start',message:'Cenas não podem se sobrepor.'});
    lastEnd=Math.max(scene.end||0,lastEnd);
    const layout=typeof scene.layout==='string'?scene.layout:scene.layout?.preset||scene.layout?.grid||'fullscreen';
    if(!LAYOUTS.has(layout))issues.push({path:p+'.layout',message:'Layout desconhecido.'});
    if(scene.transitionOut&&!TRANSITIONS.has(scene.transitionOut))issues.push({path:p+'.transitionOut',message:'Transição desconhecida.'});
    if(scene.transitionDuration>(scene.end-scene.start)/2)issues.push({path:p+'.transitionDuration',message:'Transição excede metade da cena.'});
    const duration=scene.end-scene.start;
    const keyframes=[{frames:scene.camera?.keyframes,p:p+'.camera.keyframes'},...(scene.elements||[]).map((e,j)=>({frames:e.keyframes,p:p+'.elements.'+j+'.keyframes'}))];
    for(const {frames,p:where}of keyframes){
      let t=-1;
      for(const frame of frames||[]){
        if(!(frame.t>t&&frame.t<=duration))issues.push({path:where,message:'Keyframes fora de ordem ou da cena.'});
        t=frame.t;
      }
    }
    const seen=new Set();
    for(let j=0;j<(scene.elements||[]).length;j++){
      const e=scene.elements[j],q=p+'.elements.'+j;
      if(!isObject(e))continue;
      if(e.type!=='sfx'&&!e.id)issues.push({path:q+'.id',message:'Camada visual requer ID.'});
      if(e.id&&seen.has(e.id))issues.push({path:q+'.id',message:'ID de camada duplicado.'});
      if(e.id)seen.add(e.id);
      const a=e.start??scene.start,b=e.end??scene.end;
      if(e.type==='sfx'){if((e.at??a)<scene.start||(e.at??a)>=scene.end)issues.push({path:q+'.at',message:'SFX fora da cena.'});}
      else if(a<scene.start||b>scene.end||b<=a)issues.push({path:q,message:'Intervalo fora da cena.'});
      if(MEDIA.has(e.type)&&!e.asset)issues.push({path:q+'.asset',message:'Mídia sem arquivo.'});
    }
  }
  return issues;
}
export function validateOrThrow(plan){const issues=validatePlan(plan);if(issues.length)throw new PlanError(issues);return plan;}
export function settings(plan){
  const [width,height,fps]=FORMATS[plan.project.format]||FORMATS.youtube_long;
  return {width:plan.project.resolution?.width??width,height:plan.project.resolution?.height??height,
    fps:plan.project.fps??fps,seed:plan.project.seed??0,name:plan.project.name};
}
export function projectFile(directory){
  if(typeof directory!=='string'||!directory.trim())throw new PlanError([{path:'projectRoot',message:'Informe a pasta do projeto.'}]);
  const root=fs.realpathSync(path.resolve(directory)),file=path.join(root,'edit_plan.json');
  if(!fs.existsSync(file))throw new PlanError([{path:'projectRoot',message:'A pasta precisa conter edit_plan.json.'}]);
  return {root,file};
}
export function resolveAsset(uri,root){
  if(typeof uri!=='string')throw new PlanError([{path:'asset',message:'URI de mídia inválido.'}]);
  let base,relative;
  if(uri.startsWith('project://')){base=root;relative=uri.slice(10);}
  else if(uri.startsWith('builtin://')){base=path.join(APP_ROOT,'builtin-assets');relative=uri.slice(10);}
  else throw new PlanError([{path:'asset',message:'Asset deve usar project:// ou builtin://: '+uri}]);
  if(!relative||path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))throw new PlanError([{path:'asset',message:'Caminho inseguro: '+uri}]);
  const target=path.resolve(base,relative),relativeCheck=path.relative(path.resolve(base),target);
  if(relativeCheck.startsWith('..')||path.isAbsolute(relativeCheck))throw new PlanError([{path:'asset',message:'Caminho fora do projeto.'}]);
  if(fs.existsSync(target)){
    const real=fs.realpathSync(target),r=path.relative(path.resolve(base),real);
    if(r.startsWith('..')||path.isAbsolute(r))throw new PlanError([{path:'asset',message:'Link fora da raiz de assets.'}]);
  }
  return target;
}
export function visualWarnings(plan){
  const result=[],textTypes=new Set(['text','caption','kinetic_text']);
  const {width,height}=settings(plan);
  for(const scene of plan.timeline||[]){
    const texts=(scene.elements||[]).filter(item=>textTypes.has(item.type));
    for(let a=0;a<texts.length;a++)for(let b=a+1;b<texts.length;b++){
      const left=texts[a],right=texts[b];
      const start=Math.max(left.start??scene.start,right.start??scene.start);
      const end=Math.min(left.end??scene.end,right.end??scene.end);
      if(end<=start+0.04)continue;
      const [ax,ay,aw,ah]=region(left.cells,width,height);
      const [bx,by,bw,bh]=region(right.cells,width,height);
      const ox=Math.max(0,Math.min(ax+aw,bx+bw)-Math.max(ax,bx));
      const oy=Math.max(0,Math.min(ay+ah,by+bh)-Math.max(ay,by));
      if(ox*oy/Math.max(1,Math.min(aw*ah,bw*bh))<0.35)continue;
      result.push({code:'text_overlap',scene:scene.id,
        message:'As camadas '+(left.id||'texto '+(a+1))+' e '+(right.id||'texto '+(b+1))+
          ' dividem região e tempo ('+start.toFixed(2)+'–'+end.toFixed(2)+'s). Verifique se é intencional.'});
    }
  }
  return result;
}
export function assetReport(plan,root){
  const issues=validatePlan(plan),uris=new Set();
  if(issues.length){
    const defaults=(plan&&typeof plan==='object'&&plan.project?.format)?
      settings({...plan,project:plan.project}):{width:1920,height:1080,fps:30};
    return {valid:false,errors:issues,missingAssets:[],resolvedAssets:{},warnings:[],
      narration:null,duration:0,scenes:0,sceneCount:0,elementCount:0,
      resolution:{width:defaults.width,height:defaults.height},fps:defaults.fps};
  }
  for(const music of plan.audio?.music||[])if(music.asset)uris.add(music.asset);
  for(const scene of plan.timeline||[]){
    if(scene.background?.asset)uris.add(scene.background.asset);
    for(const e of scene.elements||[])for(const key of ['asset','fontAsset'])if(e[key])uris.add(e[key]);
  }
  const resolvedAssets={},missingAssets=[];
  for(const uri of uris){
    try {const dest=resolveAsset(uri,root);resolvedAssets[uri]=dest;if(!fs.existsSync(dest))missingAssets.push({asset:uri,path:dest});}
    catch(e){issues.push(...(e.issues||[{path:'asset',message:e.message}]));}
  }
  const narration=path.resolve(root,plan.audio?.narration||'');
  if(path.relative(root,narration).startsWith('..'))issues.push({path:'audio.narration',message:'Narração fora do projeto.'});
  else if(!fs.existsSync(narration))missingAssets.push({asset:'audio.narration',path:narration});
  const transcript=plan.sources?.transcript?path.resolve(root,plan.sources.transcript):null;
  if(transcript&&path.relative(root,transcript).startsWith('..'))issues.push({path:'sources.transcript',message:'Transcrição fora do projeto.'});
  else if(transcript&&!fs.existsSync(transcript)&&plan.timeline?.some(s=>s.elements?.some(e=>e.type==='caption')))missingAssets.push({asset:'sources.transcript',path:transcript});
  return {valid:!issues.length&&!missingAssets.length,errors:issues,missingAssets,resolvedAssets,
    warnings:visualWarnings(plan),
    narration,duration:Math.max(0,...(plan.timeline||[]).map(s=>s.end||0)),
    scenes:plan.timeline?.length||0,sceneCount:plan.timeline?.length||0,
    elementCount:plan.timeline?.reduce((n,s)=>n+(s.elements?.length||0),0)||0,
    resolution:{width:settings(plan).width,height:settings(plan).height},fps:settings(plan).fps};
}
export function region(cells,width,height){
  if(!cells?.length)return [0,0,width,height];
  const cols=cells.map(x=>(x-1)%3),rows=cells.map(x=>Math.floor((x-1)/3));
  const left=Math.round(Math.min(...cols)*width/3),top=Math.round(Math.min(...rows)*height/3);
  return [left,top,Math.round((Math.max(...cols)+1)*width/3)-left,Math.round((Math.max(...rows)+1)*height/3)-top];
}
export function compileScene(scene,plan,resolvedAssets){
  const s=settings(plan),layout=typeof scene.layout==='string'?scene.layout:scene.layout?.preset||scene.layout?.grid||'fullscreen';
  let visual=0;
  const elements=(scene.elements||[]).map((e,i)=>{
    let cells=e.cells;
    if(['image','video'].includes(e.type)){if(!cells)cells=AUTO_CELLS[layout]?.[visual];visual++;}
    return {...e,id:e.id||'sfx-'+i,start:e.start??scene.start,end:e.end??scene.end,
      z:e.z??i,region:region(cells,s.width,s.height),asset_path:e.asset?resolvedAssets[e.asset]:null,
      font_path:e.fontAsset?resolvedAssets[e.fontAsset]:null};
  }).sort((a,b)=>a.z-b.z);
  return {...scene,background:scene.background||{color:'#000000'},camera:scene.camera||{keyframes:[]},
    elements,background_path:scene.background?.asset?resolvedAssets[scene.background.asset]:null};
}
