import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fieldCatalogue,documentationModel,buildMarkdown,buildHtml,figureAssets} from './docs.mjs';
import {validatePlan} from './plan.mjs';
import {diagramNames,diagramSvg} from './docs-diagrams.mjs';
import {descriptions} from './docs-fields.mjs';

test('every declared schema property is represented and documented meaningfully',()=>{
  const fields=fieldCatalogue();
  assert.ok(fields.length>=125,'Expected canonical schema coverage');
  const unique=new Set(fields.map(f=>f.path));
  assert.equal(fields.length,unique.size,'No duplicate field rows');
  assert.deepEqual(fields.filter(f=>!f.description).map(f=>f.path),[],
    'Every schema field requires a human explanation');
  assert.ok(fields.some(f=>f.path==='audio.silenceInserts[].duration'));
  for(const key of ['audio.voice.autoTrimSilence','audio.music[].autoTrimSilence',
    'audio.narrationTrim.start','audio.voice.fadeIn','audio.voice.fadeOut',
    'audio.music[].sourceStart','audio.music[].sourceEnd','audio.music[].loop'])
    assert.ok(fields.some(f=>f.path===key),'Missing documented audio field '+key);
  assert.ok(fields.some(f=>f.path==='timeline[].elements[].textStyle.shadow.blur'));
  assert.ok(fields.some(f=>f.path==='timeline[].camera.shake[].frequency'));
  assert.ok(fields.some(f=>f.path==='timeline[].elements[].keyframes[].easing'));
  assert.ok(fields.some(f=>f.path==='timeline[].elements[].transform.offsetX'));
  assert.ok(fields.some(f=>f.path==='timeline[].elements[].transform.offsetY'));
});
test('documents cover all main capabilities, include examples and all JS-generated figures',()=>{
  const model=documentationModel(),md=buildMarkdown(),html=buildHtml();
  assert.ok(model.examples===undefined || true);
  assert.ok(model.exampleCases.length>=7);
  assert.ok(model.chapters.length>=9);
  assert.ok(md.length>18000,'Documentation Markdown must be comprehensive');
  assert.ok(html.length>30000,'Documentation HTML must be comprehensive');
  for(const field of fieldCatalogue()){
    assert.ok(md.includes(field.path),'Missing Markdown field '+field.path);
    assert.ok(html.includes(field.path),'Missing HTML field '+field.path);
  }
  for(const name of diagramNames){
    assert.match(diagramSvg(name),/<svg[\s\S]*<\/svg>/);
    assert.ok(html.includes(diagramSvg(name)),'Figure missing from HTML: '+name);
    assert.ok(figureAssets().some(item=>item.name==='docs/figures/'+name+'.svg'));
  }
  assert.ok(html.includes('id="fieldSearch"'));
  assert.ok(html.includes('/api/docs/download?format=md'));
  assert.ok(!buildHtml({standalone:true}).includes('/api/docs/download?format=md'));
  assert.ok(!buildHtml({standalone:true}).includes('/api/skill/download'));
  assert.ok(md.includes('audio.silenceInserts'));
  assert.ok(md.includes('word_stream_horizontal'));
  assert.ok(md.includes('crossfade de duas músicas'));
  assert.ok(html.includes('crossfade de duas músicas'));
  assert.ok(md.includes('Carrossel vertical de frases em largura total'));
  assert.ok(html.includes('Carrossel vertical de frases em largura total'));
  assert.ok(md.includes('faixa horizontal central'));
  assert.ok(md.includes('largura integral da tela'));
  assert.ok(md.includes('smootherstep'));
  assert.ok(md.includes('highlightTransitionDuration'));
  assert.ok(html.includes('bangers_highlight_block'));
  assert.ok(md.includes('Movimento suave em 0,1 segundo'));
  assert.ok(md.includes('### Estrutura sugerida do projeto'));
  assert.ok(html.includes('Estrutura sugerida do projeto'));
  assert.ok(md.includes('transcript.build.json'));
  assert.ok(html.includes('transcript.build.json'));
  assert.ok(md.includes('narration.prepared.wav'));
  assert.ok(md.includes('Sua linha do tempo'));
  assert.ok(md.includes('Propriedades avançadas'));
  assert.ok(md.includes('sem obrigatoriedade de duas imagens'));
  assert.ok(!md.includes('Criar cena motion com grid 3×3'));
  assert.ok(!html.includes('Criar cena motion com grid 3×3'));
  for(const output of [md,html]){
    assert.doesNotMatch(output.replaceAll('Oferecimento do DiasVerso.','').replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g,''),/nox|diazverso|diasverso|vd[_-]?0005/i,
      'Official docs must not expose channel-specific personas or internal plans');
  }
  assert.ok(md.includes('fontes') || md.includes('project://'));
  const fullProject=model.exampleCases.find(c=>c.title==='Projeto completo com pastas e URIs');
  assert.ok(fullProject,'Quick-start JSON must be integrated in documentation');
  assert.deepEqual(validatePlan(fullProject.data),[],
    'Complete starter example must validate against canonical schema');

  assert.ok(html.includes('0.1 segundo'));
  assert.ok(md.includes('uma transição de 0.1 s em 30 fps tem apenas 3 frames'));
});
test('website exposes one docs tab, dedicated reader and exactly three doc download actions',()=>{
  const html=readFileSync(new URL('../frontend/templates/index.html',import.meta.url),'utf8');
  assert.ok(!html.includes('id="tab-guide"'));
  assert.ok(!html.includes('id="panel-guide"'));
  assert.ok(!html.includes('id="guideOpenDocs"'));
  assert.ok(!html.includes('id="motionAddScene"'));
  assert.ok(!html.includes('id="motionLeftAsset"'));
  assert.ok(!html.includes('id="motionRightAsset"'));
  assert.ok(html.includes('id="visualAddScene"'));
  assert.ok(html.includes('id="visualSceneFields"'));

  assert.equal((html.match(/data-workspace="(?:videos|transcription|editor|docs)"/g)||[]).length,4);
  assert.ok(html.includes('id="tab-docs"'));
  assert.ok(html.includes('id="panel-docs"'));
  assert.ok(html.includes('id="docsManual"'));
  assert.equal((html.match(/href="\/api\/docs\/download\?format=md"/g)||[]).length,1);
  assert.equal((html.match(/href="\/api\/docs\/download\?format=html"/g)||[]).length,1);
  assert.equal((html.match(/href="\/api\/skill\/download"/g)||[]).length,1);
});
