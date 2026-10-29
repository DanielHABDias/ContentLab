import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSocialDraft,listSocialDrafts,deleteSocialDraft,socialDraftMedia} from './social-drafts.mjs';

const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82]);
const mp4=Buffer.from([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0]);
const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-drafts-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=(name,bytes)=>{
    const p=path.join(root,name);fs.writeFileSync(p,bytes);
    return {path:p,originalname:name};
  };
  return {root:path.join(root,'saved'),video:file('video.mp4',mp4),a:file('a.png',png),b:file('b.png',png)};
};
const confirmed={youtube:true,instagram:false,tiktok:true};
test('Shorts: aceita uma rede confirmada e uma thumbnail; salva no disco local',t=>{
  const f=fixture(t);
  const item=createSocialDraft({
    root:f.root,
    body:{kind:'short',titleA:'Um Short',description:'Uma descrição',tags:'#nerd, arte',platforms:'["youtube","tiktok"]',scheduledAt:'2026-11-10T18:00'},
    files:{video:[f.video],coverA:[f.a]},confirmed
  });
  assert.equal(item.kind,'short');assert.deepEqual(item.tags,['nerd','arte']);
  assert.deepEqual(item.platforms,['youtube','tiktok']);
  assert.equal(item.titleB,null);assert.equal(listSocialDrafts(f.root).length,1);
  assert.equal(fs.readFileSync(socialDraftMedia(item.id,'video',f.root)).equals(mp4),true);
  assert.equal(fs.readFileSync(socialDraftMedia(item.id,'coverA',f.root)).equals(png),true);
  assert.throws(()=>socialDraftMedia(item.id,'coverB',f.root));
  assert.equal(deleteSocialDraft(item.id,f.root),true);
  assert.equal(listSocialDrafts(f.root).length,0);
});
test('longos: apenas TikTok e Instagram, dois títulos diferentes e duas capas',t=>{
  const f=fixture(t);
  const body={kind:'long',titleA:'Título A',titleB:'Título B',platforms:'["tiktok"]',description:'',tags:''};
  const item=createSocialDraft({root:f.root,body,files:{video:[f.video],coverA:[f.a],coverB:[f.b]},confirmed});
  assert.equal(item.titleB,'Título B');
  assert.ok(fs.existsSync(socialDraftMedia(item.id,'coverB',f.root)));
  assert.throws(()=>createSocialDraft({root:f.root,body:{...body,platforms:'["youtube"]'},files:{video:[f.video],coverA:[f.a],coverB:[f.b]},confirmed}),/compatível/);
  assert.throws(()=>createSocialDraft({root:f.root,body:{...body,platforms:'["instagram"]'},files:{video:[f.video],coverA:[f.a],coverB:[f.b]},confirmed}),/confirmada/);
  assert.throws(()=>createSocialDraft({root:f.root,body:{...body,titleB:'Título A'},files:{video:[f.video],coverA:[f.a],coverB:[f.b]},confirmed}),/títulos diferentes/);
  assert.throws(()=>createSocialDraft({root:f.root,body,files:{video:[f.video],coverA:[f.a]},confirmed}),/thumbnail/);
});
test('não aceita caminho forjado, vídeo inválido nem redes não confirmadas',t=>{
  const f=fixture(t),body={kind:'short',titleA:'Vídeo',platforms:'["youtube"]'};
  assert.throws(()=>createSocialDraft({root:f.root,body:{...body,platforms:'["instagram"]'},files:{video:[f.video],coverA:[f.a]},confirmed}),/confirmada/);
  const invalid={...f.video,originalname:'virus.mp4',path:f.a.path};
  assert.throws(()=>createSocialDraft({root:f.root,body,files:{video:[invalid],coverA:[f.a]},confirmed}),/Formato/);
  assert.throws(()=>socialDraftMedia('../../outside','video',f.root));
});
