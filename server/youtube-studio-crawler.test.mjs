import test from 'node:test';
import assert from 'node:assert/strict';
import {YOUTUBE_ACTION_DELAY_MS,findStudioTagsExpression,fillYouTubeTags,
  disclosureExpression,applyYouTubeDisclosures,selectScheduleCardExpression,
  prepareYouTubeSchedule} from './youtube-studio-crawler.mjs';

test('atraso entre ações do crawler é explícito e tags usam Enter individualmente',async()=>{
  assert.ok(YOUTUBE_ACTION_DELAY_MS>=900);
  assert.match(findStudioTagsExpression(),/tags-container/);
  const calls=[];
  const cdp={
    async eval(expression){calls.push(['eval',expression]);return true;},
    async send(method,params){calls.push([method,params]);return {};}
  };
  assert.equal(await fillYouTubeTags(cdp,['primeira','segunda'],{delayMs:0}),true);
  assert.deepEqual(calls.filter(x=>x[0]==='Input.insertText').map(x=>x[1].text),
    ['primeira','segunda']);
  assert.equal(calls.filter(x=>x[0]==='Input.dispatchKeyEvent'&&x[1].type==='keyDown').length,2);
});
test('declarações negativas só são aplicadas quando confirmadas no rascunho',async()=>{
  const calls=[];
  const cdp={async eval(expression){calls.push(expression);return true;}};
  const unconfirmed=await applyYouTubeDisclosures(cdp,{youtubeNoAi:false,youtubeNoPromotion:false},{delayMs:0});
  assert.equal(unconfirmed.length,2);
  assert.equal(calls.length,0);
  const confirmed=await applyYouTubeDisclosures(cdp,{youtubeNoAi:true,youtubeNoPromotion:true},{delayMs:0});
  assert.equal(confirmed.length,0);
  assert.equal(calls.length,2);
  assert.match(disclosureExpression('altered'),/conteúdo alterado/);
  assert.match(disclosureExpression('promotion'),/promoção paga/);
  const missing=await applyYouTubeDisclosures({eval:async()=>false},
    {youtubeNoAi:true,youtubeNoPromotion:true},{delayMs:0});
  assert.equal(missing.length,2,'não deve afirmar que marcou opções que não encontrou');
});
test('agendamento seleciona somente cartão/radio Schedule e não botão final',async()=>{
  const expr=selectScheduleCardExpression();
  assert.match(expr,/ytcp-visibility-option/);
  assert.doesNotMatch(expr,/button\[id="schedule"\]|button#schedule/);
  const calls=[];
  const cdp={async eval(expression){calls.push(expression);return true;}};
  assert.equal(await prepareYouTubeSchedule(cdp,'2031-05-04T17:00',{delayMs:0}),true);
  assert.equal(calls.length,6,'três próximos, cartão Schedule, data e hora');
  assert.ok(calls[3].includes('#schedule-radio-button')||calls[3].includes('ytcp-visibility-option'));
  assert.ok(calls[4].includes('2031-05-04'));
  assert.ok(calls[5].includes('17:00'));
  assert.equal(await prepareYouTubeSchedule(cdp,'data inválida',{delayMs:0}),false);
});
test('falhas de campos do calendário interrompem com revisão manual, sem publicar',async()=>{
  const cdp={async eval(expression){
    if(expression.includes('ytcp-datetime-picker')&&expression.includes('2031-05-04'))return false;
    return true;
  }};
  assert.equal(await prepareYouTubeSchedule(cdp,'2031-05-04T12:00',{delayMs:0}),false);
});
