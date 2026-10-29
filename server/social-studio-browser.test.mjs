import test from 'node:test';
import assert from 'node:assert/strict';
import {resetSocialStudioTabs,validateStudioUrl} from './social-studio-browser.mjs';

const urls={
  youtube:'https://studio.youtube.com/',
  tiktok:'https://www.tiktok.com/tiktokstudio',
  instagram:'https://www.instagram.com/scheduled_content/'
};
function fakeBrowser(initial=[]){
  const pages=new Map(initial.map(p=>[p.targetId,{...p,type:'page'}]));
  const history=[],clients=[],closed=[];
  let seq=0;
  const control={
    async send(method,params={}){
      history.push({method,...params});
      if(method==='Target.getTargets')return {targetInfos:[...pages.values()]};
      if(method==='Target.createTarget'){
        const targetId='new-'+(++seq);
        pages.set(targetId,{targetId,type:'page',url:params.url});
        return {targetId};
      }
      if(method==='Target.closeTarget'){
        closed.push(params.targetId);
        pages.delete(params.targetId);
        return {success:true};
      }
      if(method==='Target.activateTarget')return {};
      throw Error('Comando inesperado '+method);
    }
  };
  const connectTarget=async id=>{
    assert.ok(pages.has(id),'a conexão deve ser uma página aberta');
    const client={id,close(){},
      async send(method,params){
        clients.push({id,method,...params});
        if(method==='Page.navigate'){
          pages.get(id).url=params.url;
          return {frameId:'frame'};
        }
        throw Error('Comando inesperado '+method);
      }};
    return client;
  };
  return {control,connectTarget,pages,history,clients,closed};
}
test('Configuração TikTok: limpa YouTube, Instagram e aba restaurada, mantendo uma única aba',async()=>{
  const mock=fakeBrowser([
    {targetId:'yt',url:urls.youtube},
    {targetId:'tk',url:'https://www.tiktok.com/login'},
    {targetId:'ig',url:urls.instagram},
    {targetId:'random',url:'https://example.com'}
  ]);
  const result=await resetSocialStudioTabs(mock.control,{
    ordered:['tiktok'],urls,connectTarget:mock.connectTarget
  });
  assert.deepEqual([...result.targets.keys()],['tiktok']);
  assert.equal(result.targets.get('tiktok'),'tk');
  assert.deepEqual([...mock.pages.values()].map(x=>x.url),[urls.tiktok]);
  assert.deepEqual(mock.closed.sort(),['ig','random','yt']);
  assert.ok(mock.clients.some(x=>x.id==='tk'&&x.method==='Page.navigate'&&x.url===urls.tiktok));
  assert.ok(mock.history.some(x=>x.method==='Target.activateTarget'&&x.targetId==='tk'));
  assert.ok(!mock.history.some(x=>/clearBrowserCookies|clearDataForOrigin/i.test(x.method)));
});
test('Configuração da próxima rede substitui a aba antiga sem novo perfil',async()=>{
  const mock=fakeBrowser([{targetId:'tk',url:urls.tiktok}]);
  const first=await resetSocialStudioTabs(mock.control,{ordered:['tiktok'],urls,connectTarget:mock.connectTarget});
  assert.equal(mock.pages.size,1);
  first.clients.get('tiktok').close();
  const second=await resetSocialStudioTabs(mock.control,{ordered:['instagram'],urls,connectTarget:mock.connectTarget});
  assert.deepEqual([...second.targets.keys()],['instagram']);
  assert.equal(mock.pages.size,1);
  assert.equal([...mock.pages.values()][0].url,urls.instagram);
  assert.deepEqual(mock.closed,[],'reaproveitar a única aba, sem fechar o navegador');
});
test('Pipeline abre somente YouTube/TikTok/Instagram requisitados, fechando todas as abas anteriores',async()=>{
  const mock=fakeBrowser([
    {targetId:'ig',url:urls.instagram},
    {targetId:'restore',url:'chrome://newtab/'},
    {targetId:'unrelated',url:'https://example.com'}
  ]);
  const first=await resetSocialStudioTabs(mock.control,{
    ordered:['youtube','tiktok','instagram'],urls,connectTarget:mock.connectTarget
  });
  assert.equal(first.targets.size,3);
  assert.equal(new Set(first.targets.values()).size,3);
  assert.deepEqual([...mock.pages.values()].map(x=>x.url).sort(),
    [urls.youtube,urls.tiktok,urls.instagram].sort());
  assert.equal(mock.pages.size,3);
  assert.ok(mock.closed.includes('restore')&&mock.closed.includes('unrelated'));
  const second=await resetSocialStudioTabs(mock.control,{
    ordered:['youtube','instagram'],urls,connectTarget:mock.connectTarget
  });
  assert.deepEqual([...second.targets.keys()],['youtube','instagram']);
  assert.deepEqual([...mock.pages.values()].map(x=>x.url).sort(),[urls.youtube,urls.instagram].sort());
  assert.equal(mock.pages.size,2);
});
test('Se Chromium iniciou sem abas, criar a primeira antes das demais sem encerrar o navegador',async()=>{
  const mock=fakeBrowser();
  const session=await resetSocialStudioTabs(mock.control,{
    ordered:['instagram'],urls,connectTarget:mock.connectTarget
  });
  assert.equal(session.targets.size,1);
  assert.equal(mock.pages.size,1);
  assert.ok([...mock.pages.values()][0].url.startsWith('https://www.instagram.com/'));
  assert.deepEqual(mock.closed,[]);
});
test('Não fecha perfis/cookies ou alvos de serviço: apenas páginas do navegador dedicado',async()=>{
  const mock=fakeBrowser([{targetId:'initial',url:'chrome://newtab/'}]);
  const original=mock.control.send.bind(mock.control);
  mock.control.send=async(method,params)=>{
    if(method==='Target.getTargets'){
      const result=await original(method,params);
      return {targetInfos:[...result.targetInfos,
        {targetId:'worker',type:'service_worker',url:'chrome-extension://worker'}]};
    }
    return original(method,params);
  };
  await resetSocialStudioTabs(mock.control,{ordered:['youtube'],urls,connectTarget:mock.connectTarget});
  assert.ok(!mock.closed.includes('worker'));
  assert.ok(!mock.history.some(x=>/clearBrowserCookies|clearDataForOrigin|disposeBrowserContext/i.test(x.method)));
});

test('navegação do Instagram sempre resolve para Conteúdo programado',()=>{
  assert.equal(validateStudioUrl('instagram','https://www.instagram.com/'),
    'https://www.instagram.com/scheduled_content/');
  assert.equal(validateStudioUrl('instagram','https://www.instagram.com/p/ABC123/?foo=1'),
    'https://www.instagram.com/scheduled_content/');
  assert.throws(()=>validateStudioUrl('instagram','https://instagram.com.attacker.example/scheduled_content/'),/oficial/);
});
