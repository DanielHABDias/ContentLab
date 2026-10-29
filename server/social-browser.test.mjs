import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {socialUrl,readSocialBrowser,saveSocialBrowser,openSocialBrowser,
  confirmSocialBrowser,socialBrowserReady,detectBrowsers} from './social-browser.mjs';

const urls={tiktok:'https://www.tiktok.com/tiktokstudio',instagram:'https://www.instagram.com/scheduled_content/',youtube:'https://studio.youtube.com/'};
const browsers=[{id:'system',available:true,label:'Padrão do sistema'},{id:'chrome',available:true,label:'Google Chrome'},
  {id:'firefox',available:false,label:'Firefox (crawler indisponível)'}];
test('URLs só aceitam hosts HTTPS oficiais',()=>{
  assert.equal(socialUrl('youtube','https://studio.youtube.com/channel/UCexample?authuser=2'),
    'https://studio.youtube.com/channel/UCexample?authuser=2');
  for(const url of ['http://studio.youtube.com/','https://studio.youtube.com.evil.test/',
    'https://evil.test@studio.youtube.com/','file:///tmp/secret','javascript:alert(1)'])
    assert.throws(()=>socialUrl('youtube',url));
  assert.throws(()=>socialUrl('twitter','https://studio.youtube.com/'));
});
test('configuração abre e confirma no perfil persistente do crawler, não no navegador pessoal',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-social-browser-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'settings','social-browser.json');
  assert.equal(readSocialBrowser(file).browser,null);
  const original=saveSocialBrowser({browser:'chrome',urls},{file,browsers});
  assert.equal(original.browser,'chrome');
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).version,2);
  const calls=[];
  const openSession=async opts=>{
    calls.push(opts);
    return {
      navigate:async platform=>{assert.deepEqual(opts.platforms,[platform]);assert.equal(opts.config.browser,'chrome');},
      close:()=>calls.push('closed')
    };
  };
  assert.throws(()=>confirmSocialBrowser('tiktok',{file}),/Abra/);
  for(const platform of Object.keys(urls)){
    const result=await openSocialBrowser(platform,{file,browsers,openSession});
    assert.equal(result.profile,'social-studio-profile');
    assert.equal(result.loginVerified,false,'clicar em Abrir não comprova login');
    assert.equal(result.opened,true);
    const confirmed=confirmSocialBrowser(platform,{file});
    assert.equal(confirmed.confirmed[platform],true);
    assert.equal(socialBrowserReady(readSocialBrowser(file)),true);
  }
  assert.equal(calls.filter(c=>c==='closed').length,3);
  const changed=saveSocialBrowser({browser:'chrome',urls:{...urls,youtube:'https://studio.youtube.com/channel/UCdifferent'}},{file,browsers});
  assert.equal(changed.confirmed.youtube,false);
  assert.equal(changed.confirmed.instagram,true);
  assert.equal(changed.confirmed.tiktok,true);
  assert.throws(()=>saveSocialBrowser({browser:'firefox',urls},{file,browsers}),/navegador disponível/);
  assert.deepEqual(readSocialBrowser(file),changed);
});
test('confirmações v1 feitas no navegador pessoal são invalidadas na migração',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-social-browser-v1-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'social-browser.json');
  fs.writeFileSync(file,JSON.stringify({version:1,browser:'chrome',urls,
    confirmed:{youtube:true,tiktok:true,instagram:true}}));
  const migrated=readSocialBrowser(file);
  assert.equal(migrated.browser,'chrome');
  assert.deepEqual(migrated.urls,urls);
  assert.deepEqual(migrated.confirmed,{youtube:false,tiktok:false,instagram:false});
  assert.equal(socialBrowserReady(migrated),false);
  const saved=saveSocialBrowser({browser:'chrome',urls},{file,browsers});
  assert.equal(saved.confirmed.youtube,false);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).version,2);
});
test('configuração corrompida usa padrões sem acessar arquivos de credenciais',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-social-browser-bad-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'setup.json');
  fs.writeFileSync(file,'{');
  const settings=readSocialBrowser(file);
  assert.equal(settings.browser,null);
  assert.deepEqual(settings.urls,urls);
  assert.equal(socialBrowserReady(settings),false);
  const detected=detectBrowsers();
  assert.equal(detected[0].id,'system');
  assert.equal(detected[0].available,true);
  assert.equal(detected.find(x=>x.id==='firefox').available,false);
});

test('Instagram migra a URL raiz anterior para /scheduled_content/ sem perder login',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-instagram-url-migrate-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'social-browser.json');
  fs.writeFileSync(file,JSON.stringify({version:2,browser:'chrome',
    urls:{...urls,instagram:'https://www.instagram.com/'},
    confirmed:{youtube:false,tiktok:false,instagram:true}}));
  const loaded=readSocialBrowser(file);
  assert.equal(loaded.urls.instagram,'https://www.instagram.com/scheduled_content/');
  assert.equal(loaded.confirmed.instagram,true);
  assert.equal(socialUrl('instagram','https://instagram.com/'),
    'https://instagram.com/scheduled_content/');
  const saved=saveSocialBrowser({browser:'chrome',urls},{file,browsers});
  assert.equal(saved.confirmed.instagram,true);
});
