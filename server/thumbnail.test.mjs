import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = path => fs.readFileSync(path, 'utf8');
const html = read(path.join(ROOT, 'frontend/templates/index.html'));
const app = read(path.join(ROOT, 'frontend/static/app.js'));
const script = read(path.join(ROOT, 'frontend/static/thumbnail-studio.js'));
const css = read(path.join(ROOT, 'frontend/static/thumbnail-studio.css'));
const http = read(path.join(ROOT, 'server/http.mjs'));

test('editor visual registrado como workspace real, com IDs e assets locais', () => {
  assert.match(html, /id="tab-thumbnails"/);
  assert.match(html, /id="panel-thumbnails"/);
  assert.match(html, /id="thumb-canvas"/);
  assert.match(html, /id="thumb-export-all"/);
  assert.match(html, /\/static\/thumbnail-studio\.css/);
  assert.match(html, /\/static\/thumbnail-studio\.js/);
  assert.match(app, /"thumbnails"/);
  assert.ok(css.includes('#thumb-canvas'));
  for(const id of [
    'thumb-project-name', 'thumb-json-file','thumb-image-file','thumb-variants','thumb-add-variant',
    'thumb-layer-list','thumb-layer-properties','thumb-bg-style','thumb-bg-color','thumb-paper-tone',
    'thumb-upload-bg','thumb-remove-bg','thumb-photo-opacity','thumb-texture-opacity',
    'thumb-shadow-opacity','thumb-shadow-height','thumb-export-current','thumb-remove-variant',
    'thumb-duplicate-variant','thumb-import-json','thumb-download-json','thumb-canvas-label','thumb-status'
  ]) assert.ok(html.includes('id="' + id + '"'), id);
});

test('javascript e servidor têm sintaxe Node válida', () => {
  for(const filename of ['frontend/static/thumbnail-studio.js','server/http.mjs']) {
    const result = spawnSync(process.execPath,['--check',path.join(ROOT,filename)],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr || filename);
  }
});

test('fontes locais são servidas por allowlist, sem caminho arbitrário', () => {
  assert.match(http,/THUMBNAIL_FONTS=Object\.freeze/);
  assert.match(http,/\/api\/thumbnails\/font\/:font/);
  for (const name of ['Anton-Regular.ttf','Bangers-Regular.ttf']) {
    assert.ok(fs.existsSync(path.join(ROOT,'builtin-assets/fonts',name)),name);
  }
});

test('as versões compartilham fundo, mas conservam personagens e textos independentes', () => {
  assert.match(script,/background: state\.background/);
  assert.match(script,/layers: variant \? variant\.layers : state\.base/);
  assert.match(script,/layers:clone\(state\.base\)/);
  assert.match(script,/state\.background\.photo=assetId/);
  assert.match(script,/currentLayers\(\)\[imageTarget\]\.image=assetId/);
  assert.match(script,/state\.media\[assetId\]=url/);
  assert.match(script,/function collectUnusedMedia\(\)/);
  assert.match(script,/titleDraw\(draw, w, h, view\.layers\.title, true\)/);
  assert.match(script,/figure\(draw, w, h, view\.layers\.center, loaded\.center\)/);
  assert.match(script,/titleDraw\(draw, w, h, view\.layers\.title, false\)/);
});

test('exportação ZIP: CRC32 correto e estrutura ZIP com central directory', async () => {
  const start = script.indexOf('  const CRC_TABLE=');
  const end = script.indexOf('  async function exportAll()', start);
  assert.ok(start > 0 && end > start, 'trecho do ZIP encontrado');
  const factory = new Function('TextEncoder', 'Blob',script.slice(start,end)+'\nreturn {crc32,zipStore};');
  const {crc32,zipStore} = factory(TextEncoder, Blob);
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xCBF43926);
  const content = new TextEncoder().encode('contentlab-thumb');
  const archive = new Uint8Array(await zipStore([{name:'thumb.png',bytes:content}]).arrayBuffer());
  const view = new DataView(archive.buffer);
  assert.equal(view.getUint32(0,true),0x04034B50);
  assert.equal(view.getUint32(archive.length-22,true),0x06054B50);
  assert.equal(view.getUint16(archive.length-14,true),1);
  const centerOffset=view.getUint32(archive.length-6,true);
  assert.equal(view.getUint32(centerOffset,true),0x02014B50);
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));
function drawingSpy() {
  const calls = [];
  const context = new Proxy({}, {
    get: (target, key) => key === 'measureText' ? () => ({width: 100}) :
      target[key] ?? ((...args) => calls.push([key, ...args])),
    set: (target, key, value) => {target[key] = value; calls.push([key, value]); return true;}
  });
  return {context, calls};
}
test('inversão afeta somente marcas da textura, sem pintar a cor base', () => {
  const factory = new Function('safe', 'cover', 'rand', script.slice(script.indexOf('  function texture('), script.indexOf('  function light(')) + ';return texture;');
  const texture = factory(clamp, () => {}, n => (n % 10) / 10);
  for (const style of ['halftone', 'grid', 'stars']) {
    for (const invertEffects of [false, true]) {
      const {context, calls} = drawingSpy();
      texture(context, 1280, 720, {style, textureOpacity: 100, invertEffects});
      const defaultDark = style === 'halftone';
      const expected = defaultDark !== invertEffects ? '#000000' : '#FFFFFF';
      assert.ok(calls.some(([key, value]) => ['fillStyle', 'strokeStyle'].includes(key) && value === expected));
      assert.ok(!calls.some(([key]) => key === 'fillRect'), 'não repinta a base');
    }
  }
  const {context, calls} = drawingSpy();
  texture(context, 1280, 720, {style: 'halftone', textureOpacity: 0, invertEffects: true});
  assert.equal(calls.length, 0);
  assert.ok(html.includes('id="thumb-invert-effects"'));
  assert.match(script, /invert.checked = state.background.invertEffects === true/);
});
test('texturas do TSX são desenhadas sem inverter a composição', () => {
  const factory = new Function('safe', 'cover', script.slice(script.indexOf('  function texture('), script.indexOf('  function light(')) + ';return texture;');
  const texture = factory(clamp, () => {});
  for (const style of ['paper', 'film']) {
    for (const invertEffects of [false, true]) {
      const {context, calls} = drawingSpy();
      texture(context, 1280, 720, {style, paperTone: 'light', textureOpacity: 80, invertEffects}, {});
      assert.equal(context.filter, invertEffects ? 'invert(1)' : 'none');
      assert.ok(calls.some(([key]) => key === 'drawImage'));
    }
  }
});
test('contorno 1 é subpixel e zero desativa a passada de traço', () => {
  const factory = new Function('safe', 'fontName', 'makeTitleLines', script.slice(script.indexOf('  function titleDraw('), script.indexOf('  function subtitleDraw(')) + ';return titleDraw;');
  const title = factory(clamp, () => 'Anton', () => ['TESTE']);
  for (const w of [960, 1280, 1080]) {
    const {context, calls} = drawingSpy();
    title(context, w, 720, {text: 'TESTE', stroke: 1, size: .1, x: .5, y: .5}, false);
    assert.equal(context.lineWidth, .15 * w / 1280);
    assert.match(context.font, /^400 /);
    assert.ok(calls.some(([key]) => key === 'strokeText'));
  }
  const {context, calls} = drawingSpy();
  title(context, 1280, 720, {text: 'TESTE', stroke: 0, size: .1, x: .5, y: .5}, false);
  assert.ok(!calls.some(([key]) => key === 'strokeText'));
});
test('luz lateral segue a borda e é composta acima dos secundários, nunca sobre o protagonista',()=>{
  const factory=new Function('safe','hex',script.slice(script.indexOf('  function light('),script.indexOf('  function hex('))+';return light;');
  const light=factory(clamp,(c,a)=>c+':'+a);
  for(const side of ['left','right']){
    const {context,calls}=drawingSpy();const stops=[];
    context.createLinearGradient=(...args)=>{calls.push(['gradient',...args]);return{addColorStop:(...stop)=>stops.push(stop)};};
    light(context,1280,720,{glowMode:'lateral',glowColor:'#4877BB',glowOpacity:40,glowSize:60},side);
    assert.deepEqual(calls.find(x=>x[0]==='gradient'),side==='left'?['gradient',0,0,768,0]:['gradient',1280,0,512,0]);
    assert.equal(stops.at(-1)[1],'#4877BB:0');
    assert.ok(calls.some(x=>x[0]==='fillRect'&&x[3]===1280&&x[4]===720));
  }
  const lateral=script.indexOf('light(draw, w, h, view.layers[side], side)');
  assert.ok(lateral>script.indexOf('figure(draw, w, h, view.layers.right, loaded.right)'));
  assert.ok(lateral<script.indexOf('shadow(draw, w, h, b)',lateral));
  assert.ok(lateral<script.indexOf('titleDraw(draw, w, h, view.layers.title, true)'));
  assert.ok(lateral<script.indexOf('figure(draw, w, h, view.layers.center, loaded.center)'));
});
test('título com entrelinha configurável conserva alinhamento das duas passadas e fallback anterior',()=>{
 const factory=new Function('safe','fontName','makeTitleLines',script.slice(script.indexOf('  function titleDraw('),script.indexOf('  function subtitleDraw('))+';return titleDraw;');
 const title=factory(clamp,()=> 'Anton',()=>['SEMPRE','VOLTAM']);
 for(const lineHeight of [undefined,.91,1.48]){
  const positions=[];
  for(const filled of [true,false]){
   const {context,calls}=drawingSpy();
   title(context,1280,720,{text:'SEMPRE\nVOLTAM',size:.15,lineHeight,x:.5,y:.5,stroke:6,glowOpacity:0},filled);
   const draws=calls.filter(x=>x[0]===(filled?'fillText':'strokeText'));positions.push(draws.map(x=>x.slice(2)));
   assert.ok(Math.abs(draws[1][3]-draws[0][3]-1280*.15*(lineHeight??.91))<.00001);
  }
  assert.deepEqual(positions[0],positions[1]);
 }
});
test('saída mínima Full HD e opção 4K respeitam orientação; JPG é o formato padrão',()=>{
 const factory=new Function('state','safe',script.slice(script.indexOf('  function dimensions('),script.indexOf('  function viewFor('))+';return {dimensions,exportSettings};');
 for(const resolution of [undefined,'full_hd','4k']){
  const {dimensions,exportSettings}=factory({output:resolution?{resolution,format:'jpeg'}:undefined},clamp);
  const scale=resolution==='4k'?2:1;
  assert.deepEqual(dimensions('long'),{w:1920*scale,h:1080*scale});
  assert.deepEqual(dimensions('vertical'),{w:1080*scale,h:1920*scale});
  assert.deepEqual(dimensions('square'),{w:1920*scale,h:1920*scale});
  assert.equal(exportSettings().mime,'image/jpeg');assert.equal(exportSettings().extension,'jpg');
 }
 for(const format of ['png','webp'])assert.equal(factory({output:{format}},clamp).exportSettings().mime,'image/'+format);
 for(const id of ['thumb-output-resolution','thumb-output-format','thumb-light-left-opacity','thumb-light-right-opacity'])assert.ok(html.includes('id="'+id+'"'));
});
test('foto contextual centralizada, cover/contain e valores ausentes sem coordenadas NaN',()=>{
 const factory=new Function('safe',script.slice(script.indexOf('  function cover('),script.indexOf('  function texture('))+';return cover;');
 const cover=factory(clamp),img={width:400,height:400};
 for(const coords of [[undefined,undefined,undefined],[null,null,null],[NaN,NaN,NaN],[.5,.5,1]]){
  const {context,calls}=drawingSpy();cover(context,img,1920,1080,...coords);
  assert.deepEqual(calls.find(x=>x[0]==='drawImage'),['drawImage',img,0,-420,1920,1920]);
 }
 const {context,calls}=drawingSpy();cover(context,img,1920,1080,.5,.5,1,'contain');
 assert.deepEqual(calls.find(x=>x[0]==='drawImage'),['drawImage',img,420,0,1080,1080]);
});
test('degradês independentes funcionam sem PNGs e página HQ permanece entre foto e personagens',()=>{
 const factory=new Function('safe','hex',script.slice(script.indexOf('  function sideLights('),script.indexOf('  function figure('))+';return sideLights;');
 const lights=factory(clamp,(c,a)=>c+':'+a);const {context,calls}=drawingSpy();let gradients=0;
 context.createLinearGradient=()=>{gradients++;return{addColorStop(){}};};
 lights(context,1920,1080,{left:{color:'#0088FF',opacity:80,reach:55},right:{color:'#FFDD00',opacity:75,reach:55}});
 assert.equal(gradients,2);assert.equal(calls.filter(x=>x[0]==='fillRect').length,2);
 const paint=script.slice(script.indexOf('  async function paint('),script.indexOf('  function schedule('));
 const photo=paint.indexOf('cover(draw, bgImage'),texture=paint.indexOf('texture(draw, w, h, b, bgTexture)'),secondary=paint.indexOf('figure(draw, w, h, view.layers.left');
 assert.ok(photo<texture&&texture<secondary);
 assert.ok(paint.indexOf('sideLights(draw, w, h, b.sideLights)')>secondary);
 assert.ok(paint.indexOf('sideLights(draw, w, h, b.sideLights)')<paint.indexOf('figure(draw, w, h, view.layers.center'));
});
test('padrão dos secundários é opaco e nenhuma textura é desenhada acima deles',()=>{
 const factory=new Function('emptyFigure',script.slice(script.indexOf('  const freshState ='),script.indexOf('  let state ='))+';return freshState;');
 const fresh=factory(()=>({opacity:100}));
 assert.equal(fresh().base.left.opacity,100);assert.equal(fresh().base.right.opacity,100);
 const paint=script.slice(script.indexOf('  async function paint('),script.indexOf('  function schedule('));
 assert.equal((paint.match(/texture\(draw,/g)||[]).length,1);
 assert.ok(paint.indexOf('texture(draw,')<paint.indexOf('figure(draw,'));
});
test('papel mostra somente tom; demais fundos mostram somente cor base, preservando valores',()=>{
 const factory=new Function('state','$',script.slice(script.indexOf('  function syncBackgroundControls('),script.indexOf('  function bindGlobal('))+';return syncBackgroundControls;');
 for(const style of ['paper','halftone','film','stars','grid','comic_page','solid','none']){
  const labels={color:{},tone:{}};
  const fields={'thumb-bg-color':{value:'#123456',closest:()=>labels.color},'thumb-paper-tone':{value:'dark',closest:()=>labels.tone}};
  factory({background:{style}},id=>fields[id])();
  assert.equal(labels.color.hidden,style==='paper');assert.equal(labels.tone.hidden,style!=='paper');
  assert.equal(fields['thumb-bg-color'].disabled,style==='paper');assert.equal(fields['thumb-paper-tone'].disabled,style!=='paper');
  assert.equal(fields['thumb-bg-color'].value,'#123456');assert.equal(fields['thumb-paper-tone'].value,'dark');
 }
 assert.match(css,/\.thumb-panel label\[hidden\]\{display:none\}/);
 assert.match(script,/if\(field==="style"\)syncBackgroundControls\(\)/);
});
