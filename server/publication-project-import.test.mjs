import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectPublicationProject,discoverPublicationProjects,importPublicationProjects} from './publication-project-import.mjs';
import {listSocialDrafts,socialDraftMedia,updateSocialDraft} from './social-drafts.mjs';

const mp4=Buffer.from([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0,0,0,0,0]);
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82]);
const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70,0,1,0,1,0,0]);
const confirmed={youtube:true,instagram:true,tiktok:true};
function fixture(t){
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-publication-import-'));
  t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
  const drafts=path.join(parent,'drafts');
  function project(name,format='youtube_short',{twoCovers=false,validVideo=true}={}){
    const root=path.join(parent,name);
    fs.mkdirSync(path.join(root,'output','final'),{recursive:true});
    fs.mkdirSync(path.join(root,'thumbnails'),{recursive:true});
    fs.writeFileSync(path.join(root,'edit_plan.json'),JSON.stringify({
      project:{name,format,profile:'generic'},audio:{narration:'audio/narration.wav'},timeline:[]
    }));
    fs.writeFileSync(path.join(root,'output','final','final.mp4'),validVideo?mp4:Buffer.from('not an mp4'));
    const old=path.join(root,'thumbnails','older.png');
    fs.writeFileSync(old,png);
    fs.utimesSync(old,new Date('2020-01-01T00:00:00Z'),new Date('2020-01-01T00:00:00Z'));
    const newest=path.join(root,'thumbnails','newest.jpeg');
    fs.writeFileSync(newest,jpeg);
    fs.utimesSync(newest,new Date('2030-01-01T00:00:00Z'),new Date('2030-01-01T00:00:00Z'));
    if(!twoCovers)fs.rmSync(old);
    return root;
  }
  return {parent,drafts,project};
}
test('reconhece edit_plan.json e output/final/final.mp4; a thumbnail mais nova é escolhida',t=>{
  const f=fixture(t);
  const folder=f.project('Short pronto','youtube_short',{twoCovers:true});
  const item=inspectPublicationProject(folder);
  assert.equal(item.kind,'short');
  assert.equal(item.format,'youtube_short');
  assert.equal(item.videoName,'final.mp4');
  assert.equal(item.coverAName,'newest.jpeg');
  assert.equal(item.coverBName,null);
  assert.equal(item.name,'Short pronto');
});
test('pasta pai encontra projetos imediatos, ignora subpastas internas e relata projetos incompletos',t=>{
  const f=fixture(t);
  const short=f.project('Um short');
  const long=f.project('Um longo','youtube_long',{twoCovers:true});
  const broken=f.project('Faltou vídeo');
  fs.rmSync(path.join(broken,'output','final','final.mp4'));
  const result=discoverPublicationProjects([f.parent,short]);
  assert.equal(result.items.length,2);
  assert.deepEqual(result.items.map(x=>x.projectRoot).sort(),[short,long].sort());
  assert.equal(result.skipped.length,1);
  assert.match(result.skipped[0].reason,/Vídeo final/);
});
test('vídeo longo importa duas capas, ou usa uma provisória e solicita revisão A/B',t=>{
  const f=fixture(t);
  const folder=f.project('Episódio longo','youtube_long');
  const inspect=inspectPublicationProject(folder);
  assert.equal(inspect.kind,'long');
  assert.equal(inspect.needsReview,true);
  assert.equal(inspect.coverBName,'newest.jpeg');
  const [item]=importPublicationProjects([
    {projectRoot:folder,scheduledAt:'2031-04-02T17:00'}
  ],{root:f.drafts,confirmed,now:new Date('2026-10-29T10:00:00')});
  assert.equal(item.kind,'long');
  assert.equal(item.sourceProject,folder);
  assert.equal(item.needsReview,true);
  assert.notEqual(item.titleA,item.titleB);
  assert.deepEqual(item.platforms,['youtube','instagram']);
  assert.deepEqual(fs.readFileSync(socialDraftMedia(item.id,'coverA',f.drafts)),
    fs.readFileSync(socialDraftMedia(item.id,'coverB',f.drafts)));
  const updated=updateSocialDraft(item.id,{root:f.drafts,body:{
    kind:'long',titleA:'Episódio final',titleB:'Episódio alternativo',
    platforms:'["youtube"]',scheduledAt:'2031-04-02T17:00'},files:{},confirmed});
  assert.equal(updated.needsReview,false,'editar permite finalizar a configuração A/B depois');
});
test('importa em ordem visual fornecida, salva a data de cada item e não duplica projetos',t=>{
  const f=fixture(t);
  const short=f.project('Short','youtube_short');
  const long=f.project('Longo','youtube_long',{twoCovers:true});
  const created=importPublicationProjects([
    {projectRoot:long,scheduledAt:'2031-05-03T17:00',titleA:'Outro título'},
    {projectRoot:short,scheduledAt:'2031-05-04T12:00'}
  ],{root:f.drafts,confirmed,now:new Date('2026-10-29T10:00:00')});
  assert.deepEqual(created.map(x=>x.kind),['long','short']);
  assert.deepEqual(created.map(x=>x.scheduledAt),['2031-05-03T17:00','2031-05-04T12:00']);
  assert.equal(created[0].titleA,'Outro título');
  assert.deepEqual(created[1].platforms,['youtube','tiktok','instagram']);
  assert.deepEqual(listSocialDrafts(f.drafts).map(x=>x.titleA),['Outro título','Short'],
    'A lista deve preservar a ordenação visual da revisão');
  assert.throws(()=>importPublicationProjects([
    {projectRoot:long,scheduledAt:'2031-05-06T17:00'}
  ],{root:f.drafts,confirmed}),/já importado/);
  assert.equal(listSocialDrafts(f.drafts).length,2);
});
test('valida todos os projetos antes de importar e reverte cópias em caso de arquivo inválido',t=>{
  const f=fixture(t);
  const good=f.project('Válido');
  const bad=f.project('Vídeo corrompido','youtube_short',{validVideo:false});
  assert.throws(()=>importPublicationProjects([
    {projectRoot:bad,scheduledAt:'2031-05-05T12:00'},
    {projectRoot:good,scheduledAt:'2031-05-04T12:00'}
  ],{root:f.drafts,confirmed,now:new Date('2026-10-29T10:00:00')}),/Formato de vídeo/);
  assert.equal(listSocialDrafts(f.drafts).length,0);
  assert.throws(()=>importPublicationProjects([
    {projectRoot:good,scheduledAt:'2020-01-01T12:00'}
  ],{root:f.drafts,confirmed}),/passada/);
  assert.equal(listSocialDrafts(f.drafts).length,0);
});
test('projetos com formato customizado sem resolução conhecida exigem ajuste no Edit Plan',t=>{
  const f=fixture(t),folder=f.project('Custom','custom');
  assert.throws(()=>inspectPublicationProject(folder),/Formato indefinido/);
  const plan=path.join(folder,'edit_plan.json');
  const body=JSON.parse(fs.readFileSync(plan,'utf8'));
  body.project.resolution={width:1080,height:1920};
  fs.writeFileSync(plan,JSON.stringify(body));
  assert.equal(inspectPublicationProject(folder).kind,'short');
});
