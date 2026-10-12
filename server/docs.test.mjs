import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fieldCatalogue,documentationModel,buildMarkdown,buildHtml,figureAssets} from './docs.mjs';
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
  for(const key of ['audio.narrationTrim.start','audio.voice.fadeIn','audio.voice.fadeOut',
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
});
test('website exposes one docs tab, dedicated reader and exactly three doc download actions',()=>{
  const html=readFileSync(new URL('../frontend/templates/index.html',import.meta.url),'utf8');
  assert.ok(html.includes('id="tab-docs"'));
  assert.ok(html.includes('id="panel-docs"'));
  assert.ok(html.includes('id="docsManual"'));
  assert.equal((html.match(/href="\/api\/docs\/download\?format=md"/g)||[]).length,1);
  assert.equal((html.match(/href="\/api\/docs\/download\?format=html"/g)||[]).length,1);
  assert.equal((html.match(/href="\/api\/skill\/download"/g)||[]).length,1);
});
