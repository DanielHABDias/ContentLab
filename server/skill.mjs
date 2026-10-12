import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import {APP_ROOT} from './plan.mjs';

const skillText="---\nname: contentlab-edicao\ndescription: Criar edit_plan.json no contrato único do Content Lab/Remotion\n---\n\n# Skill de edição do Content Lab\n\nVocê produz somente edit_plan.json, sem campo version no objeto JSON.\nLeia EDIT_PLAN_REFERENCE.md, MOTION_DESIGN_JSON.md e schemas/edit_plan.schema.json incluídos neste ZIP.\n\n- Cada cena possui ID estável, start, end, elements e limites temporais válidos.\n- IDs das camadas visuais são únicos dentro da cena.\n- Use apenas project:// e builtin:// para mídia realmente presente.\n- Para personagens transparentes use cells [2,5,8] se devem ocupar o centro.\n- Ajuste tamanho com transform.scale e preserve proporção da imagem.\n- Vídeo 1920x1080 não deve receber zoom implícito num projeto 1920x1080.\n- Prefira fit contain para clipes de gameplay onde o quadro inteiro deve ser preservado.\n- Evite dois textos que permaneçam visíveis sobrepostos sem intenção.\n- Use animações determinísticas baseadas no tempo/frame.\n- Preserve os IDs antigos de cenas para aproveitar cache incremental.\n- O motor visual é Remotion, e FFmpeg faz mixagem e composição final.\n- Valide JSON e assets antes de renderizar; não envie JS arbitrário no plano.\n";
export function streamSkillZip(response){
  response.setHeader('Content-Type','application/zip');
  response.setHeader('Content-Disposition','attachment; filename="ContentLab-Edicao.zip"');
  const archive=archiver('zip',{zlib:{level:7}});
  archive.on('error',error=>response.destroy(error));
  archive.pipe(response);
  archive.append(skillText,{name:'SKILL.md'});
  for(const file of [
    'schemas/edit_plan.schema.json','EDIT_PLAN_REFERENCE.md','MOTION_DESIGN_JSON.md',
    'MOTION_ENGINE_STRATEGY.md','SCENE_CACHE.md',
    'examples/motion-grid.json','examples/motion-storyboard.json',
    'examples/word-stack.json','examples/tipografia.json'
  ]){
    const source=path.join(APP_ROOT,file);
    if(fs.existsSync(source))archive.file(source,{name:file});
  }
  return archive.finalize();
}
