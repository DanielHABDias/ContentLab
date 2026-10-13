import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import {APP_ROOT} from './plan.mjs';
import {buildMarkdown,buildHtml,figureAssets} from './docs.mjs';

// Single canonical entry skill; specialized capabilities are kept in skills/.
const instruction=fs.readFileSync(path.join(APP_ROOT,'skills/contentlab-direcao/SKILL.md'),'utf8');
export function streamSkillZip(response){
  response.setHeader('Content-Type','application/zip');
  response.setHeader('Content-Disposition','attachment; filename="ContentLab-Skill.zip"');
  const zip=archiver('zip',{zlib:{level:8}});
  zip.on('error',err=>response.destroy(err));
  zip.pipe(response);
  zip.append(instruction,{name:'SKILL.md'});
  for(const skill of [
    'contentlab-composicao','contentlab-motion','contentlab-timeline-audio',
    'contentlab-contrato','contentlab-revisao','diazverso-video','gsb-contentlab'
  ]){
    const relative=`skills/${skill}/SKILL.md`;
    zip.file(path.join(APP_ROOT,relative),{name:relative});
  }
  zip.file(path.join(APP_ROOT,'skills/README.md'),{name:'skills/README.md'});
  zip.append(buildMarkdown(),{name:'docs/Documentacao-ContentLab.md'});
  zip.append(buildHtml({standalone:true}),{name:'docs/Documentacao-ContentLab.html'});
  for(const figure of figureAssets())
    zip.append(figure.content,{name:figure.name});
  for(const file of [
    'schemas/edit_plan.schema.json','EDIT_PLAN_REFERENCE.md','MOTION_DESIGN_JSON.md','SCENE_CACHE.md',
    'CORRECOES_CACHE_AUDIO_TRANSICOES.md',
    'examples/minimal-edit-plan.json','examples/motion-grid.json',
    'examples/motion-storyboard.json','examples/tipografia.json',
    'examples/word-stack.json','examples/audio-phase8-edit-plan.json'
  ]){
    const source=path.join(APP_ROOT,file);
    if(fs.existsSync(source))zip.file(source,{name:file});
  }
  return zip.finalize();
}
