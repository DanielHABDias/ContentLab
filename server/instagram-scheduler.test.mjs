import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  INSTAGRAM_SCHEDULED_URL,instagramCaption,instagramScheduleParts,
  instagramButtonExpression,instagramNoticeExpression,instagramToggleExpression,
  instagramCalendarDayExpression,instagramConfirmationObserverExpression,
  instagramSpinTimeExpression,instagramDateTriggerExpression,
  prepareInstagramScheduledReel
} from './instagram-scheduler.mjs';

function fixture(t){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'cl-instagram-scheduler-'));
  t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
  const videoPath=path.join(folder,'final.mp4');
  const coverAPath=path.join(folder,'cover.png');
  fs.writeFileSync(videoPath,Buffer.from('video'));
  fs.writeFileSync(coverAPath,Buffer.from('image'));
  return {videoPath,coverAPath};
}
const item=(overrides={})=>({titleA:'Meu Short',description:'Descrição do vídeo',
  tags:['anime','diazverso'],kind:'short',scheduledAt:'2031-11-06T12:00',...overrides});
function browser({confirmed=true,failAt='',login=false,url=INSTAGRAM_SCHEDULED_URL}={}){
  const commands=[],uploads=[],progress=[];
  const cdp={async eval(expression){
    commands.push(expression);
    if(expression==='location.href')return url;
    if(expression.includes('location.pathname'))return login;
    if(expression==='(window.__contentlabInstagramScheduleSuccess||null)')
      return confirmed?'Seu Reels foi programado para a data escolhida':null;
    if(failAt==='cover'&&expression.includes('["selecionar do computador"')&&
      (expression.includes('foto da capa')||expression.includes('cover photo')))return false;
    if(failAt&&failAt!=='cover'&&expression.includes(failAt))return false;
    return true;
  }};
  const session={async navigate(platform){
    assert.equal(platform,'instagram');
    return cdp;
  }};
  const upload=async(_,file,options)=>{uploads.push({file,options});return true;};
  return {session,commands,uploads,progress,upload};
}
test('legenda tem linhas em branco, Link do canal na bio e não acrescenta tags',()=>{
  const caption=instagramCaption(item());
  assert.equal(caption.text,'Meu Short\n\nLink do canal na bio\n\nDescrição do vídeo');
  assert.ok(!caption.text.includes('#anime'));
  assert.equal(caption.truncated,false);
  const long=instagramCaption(item({description:'x'.repeat(2900)}));
  assert.equal(long.text.length,2200);
  assert.equal(long.truncated,true);
  assert.ok(long.text.startsWith('Meu Short\n\nLink do canal na bio\n\n'));
});
test('data validada e URL específica do Instagram',()=>{
  assert.equal(INSTAGRAM_SCHEDULED_URL,'https://www.instagram.com/scheduled_content/');
  assert.deepEqual(instagramScheduleParts('2031-11-06T12:00',new Date('2030-01-01')),
    {date:'2031-11-06',time:'12:00'});
  assert.throws(()=>instagramScheduleParts('2031-02-30T12:00',new Date('2030-01-01')),/inválida/);
  assert.throws(()=>instagramScheduleParts('2020-11-06T12:00',new Date('2030-01-01')),/inválida|passada/);
});
test('expressões identificam corte por title, botão exato e aviso específico de Reels',()=>{
  assert.match(instagramButtonExpression(['selecionar corte'],{title:true}),/getAttribute\('title'\)/);
  assert.match(instagramButtonExpression(['programar','schedule']),/names.includes/);
  assert.match(instagramButtonExpression(['selecionar do computador'],{scope:'foto da capa'}),/foto da capa/);
  assert.match(instagramNoticeExpression(),/reels/i);
  assert.match(instagramNoticeExpression(),/entendi/);
  assert.match(instagramToggleExpression(['ocultar número de curtidas e visualizações']),/aria-checked/);
  assert.match(instagramCalendarDayExpression('2031-11-06'),/2031-11-06/);
  assert.match(instagramSpinTimeExpression('12:35'),/spinbutton/);
  assert.match(instagramDateTriggerExpression(),/\\d\{4\}/);
  assert.match(instagramConfirmationObserverExpression(),/MutationObserver/);
});
test('Reels agendado só é confirmado depois do clique final e do aviso de sucesso',async t=>{
  const files=fixture(t),b=browser();
  const result=await prepareInstagramScheduledReel(b.session,item(),{
    ...files,upload:b.upload,delayMs:0,now:new Date('2030-01-01'),
    awaitStep:async(cdp,expr)=>cdp.eval(expr),
    progress:text=>b.progress.push(text),confirmTimeout:20
  });
  assert.equal(result.status,'scheduled');
  assert.equal(result.verified,true);
  assert.equal(result.verification,'instagram_ui');
  assert.match(result.confirmationText,/programado/);
  assert.deepEqual(b.uploads.map(x=>path.basename(x.file)),['final.mp4','cover.png']);
  assert.ok(b.progress.some(x=>x.includes('Selecionar corte')));
  assert.ok(b.progress.some(x=>x.includes('Original')));
  assert.ok(b.progress.some(x=>x.toLowerCase().includes('foto da capa')));
  assert.ok(b.progress.some(x=>x.includes('Configurações avançadas')));
  assert.ok(b.progress.some(x=>x.includes('Ocultar número')));
  assert.ok(b.commands.findIndex(x=>x.includes('MutationObserver'))<
    b.commands.findIndex(x=>x.includes('["programar","schedule"]')),
    'observador de confirmação precisa existir antes do clique final');
  assert.ok(b.commands.some(x=>x.includes('2031-11-06')));
  assert.ok(b.commands.some(x=>x.includes('12:00')));
});
test('sem confirmação, parar sem afirmar que agendou nem clicar duas vezes',async t=>{
  const files=fixture(t),b=browser({confirmed:false});
  const result=await prepareInstagramScheduledReel(b.session,item(),{
    ...files,upload:b.upload,delayMs:0,now:new Date('2030-01-01'),
    awaitStep:async(cdp,expr)=>cdp.eval(expr),confirmTimeout:10
  });
  assert.equal(result.status,'awaiting_review');
  assert.match(result.warnings.join(' '),/NÃO repita/);
  assert.equal(b.commands.filter(x=>x.includes('["programar","schedule"]')).length,1);
});
test('falha na capa impede clique final para evitar programação incorreta',async t=>{
  const files=fixture(t),b=browser({failAt:'cover'});
  await assert.rejects(()=>prepareInstagramScheduledReel(b.session,item(),{
    ...files,upload:b.upload,delayMs:0,now:new Date('2030-01-01')
  }),/Foto da capa/);
  assert.equal(b.commands.filter(x=>x.includes('["programar","schedule"]')).length,0);
});
test('login expirado e URL fora de Conteúdo programado não enviam arquivos',async t=>{
  const files=fixture(t),b=browser({login:true});
  await assert.rejects(()=>prepareInstagramScheduledReel(b.session,item(),{
    ...files,upload:b.upload,delayMs:0,now:new Date('2030-01-01')
  }),/Instagram|Login/);
  assert.equal(b.uploads.length,0);
  const other=browser({url:'https://www.instagram.com/'});
  await assert.rejects(()=>prepareInstagramScheduledReel(other.session,item(),{
    ...files,upload:other.upload,delayMs:0,now:new Date('2030-01-01'),
    awaitStep:async(cdp,expr)=>cdp.eval(expr)
  }),/Conteúdo programado/);
  assert.equal(other.uploads.length,0);
});
