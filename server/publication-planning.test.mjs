import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const file=path.resolve('frontend/static/publication-planning.js');
const globals={Date, Object, Error, Number, String, Array};
vm.runInNewContext(fs.readFileSync(file,'utf8'),globals,{filename:file});
const {suggestSchedule,compatiblePlatforms,parseLocal}=globals.ContentLabPublicationPlanning;
const at=(day,hour,min=0)=>new Date(2026,9,day,hour,min);

test('destinos por formato: Shorts usam três; longos usam YouTube e Instagram',()=>{
  assert.deepEqual(Array.from(compatiblePlatforms('short')),['youtube','tiktok','instagram']);
  assert.deepEqual(Array.from(compatiblePlatforms('long')),['youtube','instagram']);
  assert.deepEqual(Array.from(compatiblePlatforms('other')),[]);
});
test('primeiro Short hoje ao meio-dia só até 10:00; depois, amanhã',()=>{
  assert.equal(suggestSchedule('short',[],at(29,9,59)),'2026-10-29T12:00');
  assert.equal(suggestSchedule('short',[],at(29,10,0)),'2026-10-29T12:00');
  assert.equal(suggestSchedule('short',[],at(29,10,1)),'2026-10-30T12:00');
  assert.equal(suggestSchedule('short',[],at(29,23,59)),'2026-10-30T12:00');
});
test('primeiro longo hoje 17h só até 15:00; depois amanhã',()=>{
  assert.equal(suggestSchedule('long',[],at(29,14,59)),'2026-10-29T17:00');
  assert.equal(suggestSchedule('long',[],at(29,15)),'2026-10-29T17:00');
  assert.equal(suggestSchedule('long',[],at(29,15,1)),'2026-10-30T17:00');
});
test('próxima publicação usa o dia seguinte do último item, independente do formato',()=>{
  const first={kind:'long',scheduledAt:'2026-10-29T17:00'};
  assert.equal(suggestSchedule('short',[first],at(29,9)),'2026-10-30T12:00');
  const second={kind:'short',scheduledAt:'2026-10-30T12:00'};
  assert.equal(suggestSchedule('long',[second,first],at(29,9)),'2026-10-31T17:00');
  const custom={kind:'long',scheduledAt:'2026-11-08T07:30'};
  assert.equal(suggestSchedule('short',[custom,second,first],at(29,9)),'2026-11-09T12:00');
});
test('nunca sugere data passada; ignora entradas sem agendamento e datas inválidas',()=>{
  assert.equal(suggestSchedule('short',[{scheduledAt:'2025-01-02T08:00'}],at(29,11)),'2026-10-30T12:00');
  assert.equal(suggestSchedule('long',[{scheduledAt:''},{scheduledAt:'2026-10-31T12:00'}],at(29,9)),'2026-11-01T17:00');
  assert.equal(parseLocal('2026-02-30T13:00'),null);
  assert.equal(parseLocal('2026-10-29T25:00'),null);
  assert.equal(suggestSchedule('short',[{scheduledAt:'2026-02-30T12:00'}],at(29,9)),'2026-10-29T12:00');
  assert.equal(suggestSchedule('short',[{scheduledAt:'2026-10-31T17:00'}],at(29,9)),'2026-11-01T12:00');
});
