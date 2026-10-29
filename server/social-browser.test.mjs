import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {socialUrl,readSocialBrowser,saveSocialBrowser,openSocialBrowser,confirmSocialBrowser,socialBrowserReady,detectBrowsers} from './social-browser.mjs';

const urls={tiktok:'https://www.tiktok.com/tiktokstudio',instagram:'https://www.instagram.com/',youtube:'https://studio.youtube.com/'};
const browsers=[{id:'system',available:true,label:'Padrão do sistema'}];
test('três URLs oficiais aceitam perfis diferentes e recusam exfiltração e protocolos perigosos',()=>{
  assert.equal(socialUrl('youtube','https://studio.youtube.com/channel/UCexample?authuser=2'),'https://studio.youtube.com/channel/UCexample?authuser=2');
  assert.equal(socialUrl('instagram','https://www.instagram.com/accounts/'),'https://www.instagram.com/accounts/');
  for(const url of ['http://studio.youtube.com/','https://studio.youtube.com.evil.test/','https://evil.test@studio.youtube.com/','file:///tmp/secret','javascript:alert(1)']){
    assert.throws(()=>socialUrl('youtube',url));
  }
  assert.throws(()=>socialUrl('twitter','https://studio.youtube.com/'));
});
test('configurações só liberam publicação depois de três confirmações explícitas; troca de perfil invalida a confirmação',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-social-browser-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'settings','social-browser.json');
  assert.equal(readSocialBrowser(file).browser,null);
  assert.equal(socialBrowserReady(readSocialBrowser(file)),false);
  const original=saveSocialBrowser({browser:'system',urls},{file,browsers});
  assert.equal(original.browser,'system');
  assert.equal(socialBrowserReady(original),false);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).version,1);
  const opened=[];
  const launch=(command,args,options)=>{
    opened.push({command,args,options});
    const child=new EventEmitter();child.unref=()=>{};
    queueMicrotask(()=>child.emit('spawn'));
    return child;
  };
  assert.throws(()=>confirmSocialBrowser('tiktok',{file}),/Abra/);
  for(const p of Object.keys(urls)){
    const result=await openSocialBrowser(p,{file,browsers,launch});
    assert.equal(result.loginVerified,false,'abrir o navegador nunca prova login');
    assert.equal(result.opened,true);
    assert.equal(opened.at(-1).args.at(-1),urls[p]);
    assert.equal(opened.at(-1).options.shell,false);
    confirmSocialBrowser(p,{file});
  }
  assert.equal(socialBrowserReady(readSocialBrowser(file)),true);
  const changed=saveSocialBrowser({browser:'system',urls:{...urls,youtube:'https://studio.youtube.com/channel/UCdifferent'}},{file,browsers});
  assert.equal(changed.confirmed.youtube,false);
  assert.equal(changed.confirmed.instagram,true);
  assert.equal(changed.confirmed.tiktok,true);
  assert.equal(socialBrowserReady(changed),false);
  assert.throws(()=>saveSocialBrowser({browser:'unknown',urls},{file,browsers}),/navegador disponível/);
  assert.deepEqual(readSocialBrowser(file),changed,'falha não substitui dados anteriores');
  const detected=detectBrowsers();
  assert.equal(detected[0].id,'system');
  assert.equal(detected[0].available,true);
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
});
