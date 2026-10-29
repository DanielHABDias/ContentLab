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
test('declarações de IA e promoção paga são aplicadas como Não por padrão',async()=>{
  const calls=[];
  const cdp={async eval(expression){calls.push(expression);return true;}};
  const result=await applyYouTubeDisclosures(cdp,{}, {delayMs:0});
  assert.equal(result.length,0);
  assert.equal(calls.length,2,'as duas respostas são tentadas mesmo sem campos no rascunho');
  assert.match(disclosureExpression('altered'),/conteúdo alterado/);
  assert.match(disclosureExpression('promotion'),/promoção paga/);
  const missing=await applyYouTubeDisclosures({eval:async()=>false},{}, {delayMs:0});
  assert.equal(missing.length,2,'não afirmar que selecionou opções ausentes');
  assert.ok(missing.every(x=>x.includes('Confira')||x.includes('confira')));
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
    if(expression.includes('#datepicker-trigger'))return false;
    return true;
  }};
  assert.equal(await prepareYouTubeSchedule(cdp,'2031-05-04T12:00',{delayMs:0}),false);
});

test('se o Studio usar calendário e menu de horário próprios, tentar ambos antes de pedir revisão',async()=>{
  const visited=[];
  const cdp={
    async eval(expression){
      visited.push(expression);
      if(expression.includes('ytcp-datetime-picker')&&expression.includes('2031-05-04'))return false;
      if(expression.includes('ytcp-datetime-picker')&&expression.includes('17:00'))return false;
      if(expression==='navigator.language')return 'pt-BR';
      return true;
    },
    async send(method,params){visited.push(method+':'+params.type);return {};}
  };
  assert.equal(await prepareYouTubeSchedule(cdp,'2031-05-04T17:00',{delayMs:0}),true);
  assert.ok(visited.some(x=>x.includes('#datepicker-trigger')));
  assert.ok(visited.some(x=>x.includes('04/05/2031')));
  assert.ok(visited.some(x=>x.includes('#time-of-day-trigger')));
  assert.ok(visited.some(x=>x.includes('ytcp-time-of-day-picker')));
  assert.equal(visited.filter(x=>x.startsWith('Input.dispatchKeyEvent')).length,2);
});
