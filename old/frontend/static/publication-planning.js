/* Regras puras de planejamento local para a lista de publicações. Sem agendamento remoto. */
(function (root) {
  'use strict';
  const HOURS = Object.freeze({short:12,long:17});
  const pad = n => String(n).padStart(2,'0');
  function serialize(date) {
    return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+
      'T'+pad(date.getHours())+':'+pad(date.getMinutes());
  }
  function parseLocal(value) {
    if (typeof value!=='string') return null;
    const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const [year,month,day,hour,minute]=match.slice(1).map(Number);
    const date=new Date(year,month-1,day,hour,minute);
    if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day||
       date.getHours()!==hour||date.getMinutes()!==minute)return null;
    return date;
  }
  function suggestSchedule(kind,items=[],now=new Date()) {
    if (!Object.hasOwn(HOURS,kind))throw Error('Formato de vídeo inválido.');
    const hour=HOURS[kind];
    if (!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Data atual inválida.');
    // A primeira publicação precisa de no mínimo duas horas de antecedência.
    const earliest=new Date(now.getFullYear(),now.getMonth(),now.getDate(),hour);
    if (now.getTime()>earliest.getTime()-2*60*60*1000)earliest.setDate(earliest.getDate()+1);
    const last=Array.isArray(items)?items.find(item=>parseLocal(item?.scheduledAt)):null;
    if (!last)return serialize(earliest);
    // Para os próximos, usar a data do item mais recentemente adicionado,
    // seja Short ou longo, mesmo se o usuário personalizou o horário dele.
    const previous=parseLocal(last.scheduledAt);
    const next=new Date(previous.getFullYear(),previous.getMonth(),previous.getDate()+1,hour);
    return serialize(next>earliest?next:earliest);
  }
  const compatiblePlatforms=kind=>kind==='long'?['youtube','instagram']:
    kind==='short'?['youtube','tiktok','instagram']:[];
  root.ContentLabPublicationPlanning=Object.freeze({suggestSchedule,compatiblePlatforms,parseLocal});
})(globalThis);
