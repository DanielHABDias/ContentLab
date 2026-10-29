import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
 TIKTOK_UPLOAD_URL,TIKTOK_ACTION_DELAY_MS,tiktokCaption,
 tiktokScheduleParts,tiktokButtonExpression,tiktokScheduleToggleExpression,
 tiktokUploadInputExpression,tiktokCalendarDayExpression,
 tiktokScheduleSuccessObserver,prepareTikTokScheduledVideo
} from './tiktok-scheduler.mjs';

const video=(extra={})=>({titleA:'Título do vídeo',description:'Descrição original',
  tags:['não-adicionar-tag'],kind:'short',scheduledAt:'2031-11-06T12:00',...extra});
function fixture(t){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'cl-tiktok-agendamento-'));
  t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
  const videoPath=path.join(folder,'final.mp4'),coverAPath=path.join(folder,'capa.png');
  fs.writeFileSync(videoPath,Buffer.from('arquivo-video'));
  fs.writeFileSync(coverAPath,Buffer.from('arquivo-capa'));
  return {videoPath,coverAPath};
}
function browser({success=true,failAt='',login=false,url=TIKTOK_UPLOAD_URL}={}){
  const steps=[],uploads=[],progress=[];
  const cdp={async eval(expr){
    steps.push(expr);
    if(expr==='location.href')return url;
    if(expr.includes('location.pathname'))return login;
    if(expr==='(window.__contentlabTikTokScheduleSuccess||null)')
      return success?'Seu vídeo foi agendado com sucesso':null;
    if(failAt&&expr.includes(failAt))return false;
    return true;
  }};
  const session={async navigate(platform){
    assert.equal(platform,'tiktok');
    return cdp;
  }};
  return {session,steps,uploads,progress,upload:async(_cdp,file,options)=>{
    uploads.push({file,options});return true;
  },awaitStep:async(cdp,expr)=>cdp.eval(expr)};
}
test('legenda idêntica ao Instagram, com linhas em branco e sem tags',()=>{
  const caption=tiktokCaption(video());
  assert.equal(caption.text,'Título do vídeo\n\nLink do canal na bio\n\nDescrição original');
  assert.equal(caption.truncated,false);
  assert.ok(!caption.text.includes('#não-adicionar-tag'));
  const long=tiktokCaption(video({description:'x'.repeat(3000)}));
  assert.equal(long.text.length,2200);
  assert.equal(long.truncated,true);
});
test('URL oficial e janela de agendamento são validadas antes de iniciar o upload',()=>{
  assert.equal(TIKTOK_UPLOAD_URL,
    'https://www.tiktok.com/tiktokstudio/upload?from=creator_center&tab=video');
  assert.ok(TIKTOK_ACTION_DELAY_MS>=950);
  assert.deepEqual(tiktokScheduleParts('2031-11-06T12:00',new Date('2031-11-05T11:00:00')),
    {date:'2031-11-06',time:'12:00'});
  assert.throws(()=>tiktokScheduleParts('2031-02-30T11:00',new Date('2031-01-01')),/inválid/);
  assert.throws(()=>tiktokScheduleParts('2031-11-06T12:00',new Date('2031-11-06T12:00')),/passad/);
  assert.throws(()=>tiktokScheduleParts('2031-11-16T12:00',new Date('2031-11-05T11:00')),/10 dias/);
});
test('controles são específicos: selecionar vídeo, editar/carregar/salvar capa, checkbox e agendar',()=>{
  assert.match(tiktokButtonExpression(['selecionar vídeo']),/selecionar vídeo/);
  assert.match(tiktokButtonExpression(['salvar'],{dialog:true}),/aria-modal/);
  assert.match(tiktokScheduleToggleExpression(),/aria-checked/);
  assert.match(tiktokUploadInputExpression('video'),/mp4/);
  assert.match(tiktokUploadInputExpression('image'),/png/);
  assert.match(tiktokCalendarDayExpression('2031-11-06'),/2031-11-06/);
  assert.match(tiktokScheduleSuccessObserver(),/MutationObserver/);
});
test('agendamento confirmado percorre ordem exigida e inclui upload de thumbnail A',async t=>{
  const paths=fixture(t),mock=browser();
  const result=await prepareTikTokScheduledVideo(mock.session,video(),{
    ...paths,upload:mock.upload,awaitStep:mock.awaitStep,delayMs:0,
    now:new Date('2031-11-05T11:00:00'),confirmTimeout:100,
    progress:step=>mock.progress.push(step)
  });
  assert.equal(result.status,'scheduled');
  assert.equal(result.verified,true);
  assert.equal(result.verification,'tiktok_ui');
  assert.match(result.confirmationText,/agendado/);
  assert.deepEqual(mock.uploads.map(item=>path.basename(item.file)),['final.mp4','capa.png']);
  const expected=['Selecionar vídeo','Carregando o vídeo','Preenchendo a descrição',
    'Editar capa','Carregar capa','Selecionando a thumbnail','Salvar capa',
    'Programar vídeo','Configurando a data','Preparando a confirmação','Aguardando a confirmação'];
  const positions=expected.map(fragment=>mock.progress.findIndex(message=>message.includes(fragment)));
  assert.ok(positions.every(x=>x>=0),JSON.stringify(mock.progress));
  assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
  const observed=mock.steps.findIndex(expr=>expr.includes('MutationObserver'));
  const final=mock.steps.findIndex(expr=>expr.includes('["agendar","schedule"]'));
  assert.ok(observed>=0&&final>observed,'observador instalado ANTES de Agendar');
  assert.ok(mock.steps.some(expr=>expr.includes('2031-11-06')));
  assert.ok(mock.steps.some(expr=>expr.includes('12:00')));
});
test('sem toast de agendamento o clique final não é repetido e a fila pede revisão',async t=>{
  const paths=fixture(t),mock=browser({success:false});
  const result=await prepareTikTokScheduledVideo(mock.session,video(),{
    ...paths,upload:mock.upload,awaitStep:mock.awaitStep,delayMs:0,
    now:new Date('2031-11-05T11:00:00'),confirmTimeout:100
  });
  assert.equal(result.status,'awaiting_review');
  assert.equal(result.verified,false);
  assert.match(result.warnings.join(' '),/NÃO repita/);
  assert.equal(mock.steps.filter(expr=>expr.includes('["agendar","schedule"]')).length,1);
  assert.equal(mock.uploads.length,2);
});
test('falta de capa ou falha no modal interrompe ANTES de Agendar',async t=>{
  const paths=fixture(t),mock=browser({failAt:'["carregar capa"'}); // aparece no seletor exato
  await assert.rejects(()=>prepareTikTokScheduledVideo(mock.session,video(),{
    ...paths,upload:mock.upload,awaitStep:mock.awaitStep,delayMs:0,
    now:new Date('2031-11-05T11:00:00')
  }),/Carregar capa/);
  assert.equal(mock.steps.filter(expr=>expr.includes('["agendar","schedule"]')).length,0);
});
test('URL inesperada e login expirado bloqueiam o upload antes de anexar mídia',async t=>{
  const paths=fixture(t),loggedOut=browser({login:true});
  await assert.rejects(()=>prepareTikTokScheduledVideo(loggedOut.session,video(),{
    ...paths,upload:loggedOut.upload,awaitStep:loggedOut.awaitStep,delayMs:0,
    now:new Date('2031-11-05T11:00:00')
  }),/TikTok/);
  assert.equal(loggedOut.uploads.length,0);
  const invalid=browser({url:'https://www.tiktok.com/tiktokstudio'});
  await assert.rejects(()=>prepareTikTokScheduledVideo(invalid.session,video(),{
    ...paths,upload:invalid.upload,awaitStep:invalid.awaitStep,delayMs:0,
    now:new Date('2031-11-05T11:00:00')
  }),/upload agendado/);
  assert.equal(invalid.uploads.length,0);
});
