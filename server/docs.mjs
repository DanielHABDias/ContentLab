import {schema} from './plan.mjs';
import {registry} from './project.mjs';
import {chapters,exampleCases} from './docs-content.mjs';
import {descriptions} from './docs-fields.mjs';
import {documentationCss} from './docs-theme.mjs';
import {diagramNames,diagramSvg} from './docs-diagrams.mjs';

const bt=String.fromCharCode(96);
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const inline=x=>bt+x+bt;
const code=(s,lang='json')=>bt.repeat(3)+lang+'\n'+s+'\n'+bt.repeat(3);
const resolve=(node,defs)=>{
 let curr=node,count=0;
 while(curr?.$ref&&count++<12)curr=defs[curr.$ref.split('/').pop()];
 return curr||{};
};
const example=(path,node)=>{
 const values={
  'project.name':'"Meu vídeo"','project.format':'"youtube_long"','project.profile':'"generic"',
  'project.resolution.width':'1920','project.resolution.height':'1080','project.fps':'30',
  'audio.narration':'"audio/narration.wav"','audio.narrationTrim.start':'2','audio.narrationTrim.end':'30',
  'audio.voice.fadeIn':'0.4','audio.voice.fadeOut':'0.8',
  'audio.music[].sourceStart':'12','audio.music[].sourceEnd':'32',
  'audio.sourceCuts[].start':'0',
  'audio.sourceCuts[].end':'12','audio.music[].asset':'"project://audio/trilha.wav"',
  'audio.silenceInserts[].at':'5','audio.silenceInserts[].duration':'2',
  'timeline[].id':'"batman"','timeline[].start':'0','timeline[].end':'5',
  'timeline[].background.asset':'"project://assets/fundo.mp4"',
  'timeline[].background.fit':'"contain"','timeline[].elements[].id':'"personagem"',
  'timeline[].elements[].type':'"image"','timeline[].elements[].asset':'"project://assets/heroi.png"',
  'timeline[].elements[].cells':'[2,5,8]','timeline[].elements[].fit':'"contain"',
  'timeline[].elements[].at':'1.25','timeline[].elements[].transform.offsetX':'0',
  'timeline[].elements[].transform.offsetY':'24','timeline[].elements[].transform.scale':'1.25',
  'timeline[].transitionOut':'"fade"','timeline[].transitionDuration':'0.35'
 };
 if(values[path])return values[path];
 if(node.enum)return JSON.stringify(node.enum[0]);
 if(node.const)return JSON.stringify(node.const);
 if(node.type==='boolean')return 'true';
 if(node.type==='number'||node.type==='integer')return String(node.exclusiveMinimum!==undefined?node.exclusiveMinimum+1:node.minimum??1);
 if(node.type==='string')return '"exemplo"';
 if(node.type==='array')return '[]';
 return '{}';
};
const constraints=node=>{
 const result=[];
 for(const [key,label] of [['minimum','mín.'],['exclusiveMinimum','maior que'],
 ['maximum','máx.'],['exclusiveMaximum','menor que'],['minLength','mín. caracteres'],
 ['maxLength','máx. caracteres'],['minItems','mín. itens'],['maxItems','máx. itens']])
 if(node[key]!==undefined)result.push(label+' '+node[key]);
 if(node.uniqueItems)result.push('sem duplicatas');
 if(node.enum)result.push('opções: '+node.enum.join(', '));
 if(node.const)result.push('fixo: '+node.const);
 return result.join('; ')||'—';
};
export function fieldCatalogue(){
 const data=schema(),result=[];
 const visit=(node,prefix='',depth=0)=>{
  if(depth>15)throw Error('Schema muito profundo');
  const parent=resolve(node,data.$defs);
  for(const [key,rule] of Object.entries(parent.properties||{})){
   const path=prefix?prefix+'.'+key:key,kind=resolve(rule,data.$defs);
   const field={path,required:(parent.required||[]).includes(key),
     type:kind.type||rule.type||(kind.enum?'enum':kind.oneOf?'texto ou objeto':'objeto'),
     constraints:constraints(kind),
     example:example(path,kind),
     description:descriptions[path]||null};
   result.push(field);
   if(kind.properties)visit(kind,path,depth+1);
   if(kind.items)visit(kind.items,path+'[]',depth+1);
   if(kind.oneOf)for(const option of kind.oneOf)
    if(option.properties)visit(option,path,depth+1);
  }
 };
 visit(data);
 return result;
}
const groupsFor=path=>{
 if(path.startsWith('project'))return 'Projeto';
 if(path.startsWith('sources'))return 'Fontes';
 if(path.startsWith('audio'))return 'Áudio';
 if(path.startsWith('timeline[].elements'))return 'Camadas e seus parâmetros';
 if(path.startsWith('timeline[].background'))return 'Fundo';
 if(path.startsWith('timeline[].camera'))return 'Câmera';
 return 'Cenas e transições';
};
const catalogTypes=[
 ['Layouts','layouts'],['Transições','transitions'],['Animações de entrada','motion_enter'],
 ['Animações contínuas','motion_idle'],['Animações de saída','motion_exit'],
 ['Estilos de texto','text_styles'],['Estilos de legenda','caption_styles'],
 ['Filtros','filter_styles'],['Estilos de overlay','overlay_styles']
];
export function documentationModel(){
 const fields=fieldCatalogue(),grouped={};
 for(const field of fields)(grouped[groupsFor(field.path)]??=[]).push(field);
 const r=registry();
 return {fields,grouped,chapters,exampleCases,resources:catalogTypes.map(([name,key])=>({name,items:r[key]||[]}))};
}
const figureAlt=name=>({
 structure:'Estrutura do edit_plan.json',fitting:'Comparação entre contain e cover',
 grid:'Grade de nove células',layers:'Composição das camadas z',
 timeline:'Timeline com cenas identificadas',audio:'Trim de silêncio nas bordas dos SFX',
 ripple:'Deslocamento de áudio e vídeo após inserir uma cena',
 transitions:'Quadros em movimento durante uma transição'
}[name]||name);
const figureUrl=name=>'https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/'+name+'.svg';
export function buildMarkdown(){
 const model=documentationModel(),out=[
  '# Content Lab — Documentação oficial','','Referência construída a partir de schemas/edit_plan.schema.json e do código atual Node.js, Remotion e FFmpeg.','',
  'Esta documentação diferencia propriedades aceitas pelo schema de comportamentos efetivamente implementados.','',
  '## Índice','','- Visão geral, arquivos, grade, camadas, áudio, timeline, cache, interface e diagnóstico',
  '- Catálogo de recursos implementados','- Referência completa dos campos do JSON',
  '- Exemplos de uso','- Regras de validação',''
 ];
 for(const chapter of chapters){
  out.push('## '+chapter.title,'',...chapter.paragraphs.flatMap(p=>[p,'']),
   '!['+figureAlt(chapter.diagram)+']('+figureUrl(chapter.diagram)+')','');
 }
 out.push('## Catálogo de recursos implementados','');
 for(const section of model.resources){
  out.push('### '+section.name,'',section.items.map(inline).join(' · '),'');
 }
 out.push('## Referência completa dos campos do JSON','',
 'Obrigatório significa exigido dentro do objeto pai. Um bloco opcional pode ter campos obrigatórios quando preenchido.','');
 for(const [title,fields] of Object.entries(model.grouped)){
  out.push('### '+title,'','| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |',
  '|---|---|---|---|---|---|');
  for(const field of fields)out.push('| '+inline(field.path)+' | '+field.type+' | '+(field.required?'Sim':'Não')+
  ' | '+field.constraints.replace(/\|/g,'/')+' | '+inline(field.example)+' | '+(field.description||'Campo declarado no schema sem explicação específica.').replace(/\|/g,'/')+' |');
  out.push('');
 }
 out.push('## Exemplos de uso','',
 'Alguns exemplos abaixo são fragmentos de cena ou áudio. Complete o projeto principal e valide os caminhos antes de renderizar.','');
 for(const c of exampleCases)out.push('### '+c.title,'',c.summary,'',
  code(JSON.stringify(c.data,null,2)),'');
 out.push('## Regras práticas e validação','',
  '- IDs de cena devem ser exclusivos e estáveis, e camadas visuais exigem ID único dentro da cena.',
  '- Cenas são sequenciais, com fim posterior ao início; keyframes são ordenados e relativos ao começo da cena.',
  '- Assets são obrigatórios para image, video, overlay e sfx. Use project:// ou builtin:// para mídias existentes.',
  '- Narração é obrigatória e a transcrição é necessária quando o componente de legenda a exige.',
  '- Sobreposições de texto podem gerar avisos, sem bloquear composições intencionais.',
  '- Pausas internas de SFX são preservadas; somente silêncio inicial/final é removido antes do disparo em at.',
  '- config aceita opções livres, mas só as consumidas pelo renderer alteram o resultado.','');
 return out.join('\n')+'\n';
}
export function buildHtml({standalone=false}={}){
 const model=documentationModel();
 const figures=name=>'<figure>'+diagramSvg(name)+'<figcaption>'+esc(figureAlt(name))+'</figcaption></figure>';
 const links=chapters.map(c=>'<a href="#'+c.id+'">'+esc(c.title)+'</a>').join('')+
  '<a href="#catalogo">Catálogo</a><a href="#campos">Campos do JSON</a><a href="#exemplos">Exemplos</a><a href="#validacao">Validação</a>';
 const intro='<section class="hero"><span class="tag">CONTENT LAB / DOCUMENTAÇÃO OFICIAL</span>'+
  '<h1>Crie. Ajuste.<br>Faça acontecer.</h1>'+
  '<p>Guia completo da ferramenta, recursos já implementados, exemplos de JSON e diagramas gerados com JavaScript.</p>'+
  (standalone?'':'<div class="download-actions"><a href="/api/docs/download?format=md">Documentação .md</a>'+
  '<a href="/api/docs/download?format=html">Documentação .html</a>'+
  '<a href="/api/skill/download">Skill .zip</a></div>')+'</section>';
 const sections=chapters.map(ch=>'<section id="'+ch.id+'"><h2>'+esc(ch.title)+'</h2>'+
  ch.paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')+figures(ch.diagram)+'</section>').join('');
 const catalog='<section id="catalogo"><h2>Catálogo de recursos</h2>'+
 model.resources.map(r=>'<h3>'+esc(r.name)+'</h3><div class="tokens">'+
 r.items.map(value=>'<span class="token">'+esc(value)+'</span>').join('')+'</div>').join('')+'</section>';
 const fields='<section id="campos"><h2>Referência completa do JSON</h2>'+
  '<p>Todos os campos são lidos diretamente do schema instalado. Obrigatório significa exigido dentro do objeto pai.</p>'+
  '<label for="fieldSearch"><strong>Pesquisar campos, tipos e descrições</strong></label>'+
  '<input id="fieldSearch" type="search" placeholder="Ex.: scale, silenceInserts, opacity..." autocomplete="off">'+
  Object.entries(model.grouped).map(([title,rows])=>'<h3>'+esc(title)+' <span class="small">'+rows.length+' campos</span></h3>'+
   '<div class="table-scroll"><table><thead><tr><th>Caminho</th><th>Tipo</th><th>Obrigatório</th><th>Restrições</th><th>Exemplo</th><th>O que faz</th></tr></thead><tbody>'+
   rows.map(f=>'<tr data-field="'+esc((f.path+' '+f.type+' '+f.description).toLowerCase())+'">'+
    '<td><code>'+esc(f.path)+'</code></td><td>'+esc(f.type)+'</td><td>'+(f.required?'Sim':'Não')+
    '</td><td>'+esc(f.constraints)+'</td><td><code>'+esc(f.example)+'</code></td><td>'+
    esc(f.description||'Campo aceito pelo schema.')+'</td></tr>').join('')+'</tbody></table></div>').join('')+'</section>';
 const examples='<section id="exemplos"><h2>Exemplos JSON</h2>'+
  '<p>Fragmentos de cena, elementos e áudio precisam ser integrados a um projeto completo. Confira a validade dos URIs.</p>'+
  exampleCases.map(c=>'<h3>'+esc(c.title)+'</h3><p>'+esc(c.summary)+'</p><pre><code>'+
   esc(JSON.stringify(c.data,null,2))+'</code></pre>').join('')+'</section>';
 const validation='<section id="validacao"><h2>Validação e boas práticas</h2>'+
 '<p>Respeite os tipos, IDs, intervalos, nomes de campos e caminhos de assets. Considere avisos de textos sobrepostos, tempos do áudio e o alinhamento dos efeitos sonoros. A primeira renderização após uma alteração no motor pode revalidar o cache.</p></section>';
 const js='<script>document.getElementById("fieldSearch").addEventListener("input",function(){'+
 'const q=this.value.trim().toLowerCase();document.querySelectorAll("[data-field]").forEach(function(row){'+
 'row.classList.toggle("hidden-row",!row.dataset.field.includes(q));});});</script>';
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width, initial-scale=1">'+
  '<title>Documentação oficial — Content Lab</title><style>'+documentationCss+'</style></head><body>'+
  '<div class="layout"><nav aria-label="Navegação da documentação"><strong>GUIA DE REFERÊNCIA</strong>'+links+
  '</nav><main>'+intro+sections+catalog+fields+examples+validation+
  '<p class="small" style="text-align:center">Content Lab · documentação gerada por JavaScript a partir do schema instalado</p>'+
  '</main></div>'+js+'</body></html>';
}
export function figureAssets(){
 return diagramNames.map(name=>({name:'docs/figures/'+name+'.svg',content:diagramSvg(name)}));
}
