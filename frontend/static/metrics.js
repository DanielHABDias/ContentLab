/* Dashboard de métricas: apenas leitura, nenhuma publicação. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  if(!$('panel-metrics'))return;
  const networks=['youtube','instagram','tiktok'];
  const names={youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok'};
  const fmt=new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1});
  const full=new Intl.NumberFormat('pt-BR');
  const dateFmt=new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'});
  let focus=null,results={},connection={},busy=false,queuedRequest=null,sequence=0;

  const message=(text)=>{$('metricsFeedback').textContent=text||'';};
  const isConnected=name=>Boolean(connection[name]?.connected);
  const number=(value)=>value===null||value===undefined?'—':fmt.format(value);
  const date=(value)=>{const d=new Date(value);return Number.isFinite(d.getTime())?dateFmt.format(d):'Data não disponível';};
  const tag=name=>names[name]||name;
  const place=(root,child)=>root.append(child);
  function el(name,css,text){
    const node=document.createElement(name);
    if(css)node.className=css;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function empty(target,msg){target.replaceChildren(el('div','metrics-empty',msg));}
  function limitTitle(text,count=65){
    const value=String(text||'Sem título').trim();
    return value.length>count?value.slice(0,count-1)+'…':value;
  }
  function allRows(){
    const chosen=focus?[focus]:networks;
    return chosen.flatMap(name=>results[name]?.status==='ok'?[results[name].data]:[]);
  }
  function normalizeVideos(kind){
    return allRows().flatMap(data=>Array.isArray(data[kind])?data[kind]:[]);
  }
  function stat(label,value,detail){
    const node=el('div','metrics-stat');
    place(node,el('span','',label));
    place(node,el('strong','',value));
    place(node,el('small','',detail));
    return node;
  }
  function renderStats(){
    const datasets=allRows();
    const uploaded=normalizeVideos('recent');
    const validViews=uploaded.filter(v=>v.views!==null&&v.views!==undefined);
    const validLikes=uploaded.filter(v=>v.likes!==null&&v.likes!==undefined);
    const sumViews=validViews.reduce((a,v)=>a+v.views,0);
    const sumLikes=validLikes.reduce((a,v)=>a+v.likes,0);
    const latest=uploaded.filter(v=>v.publishedAt)
      .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt))[0];
    const scheduled=normalizeVideos('scheduled');
    const grid=$('metricsStatGrid');grid.replaceChildren();
    place(grid,stat('Último vídeo',latest?limitTitle(latest.title,30):'—',
      latest?(tag(latest.platform)+' · '+(latest.views===null?'Views indisponíveis':number(latest.views)+' visualizações')):'Sem vídeos publicados na consulta'));
    place(grid,stat('Visualizações',validViews.length?number(sumViews):'—',
      'Apenas '+full.format(validViews.length)+' vídeo(s) com dados disponíveis'));
    place(grid,stat('Curtidas',validLikes.length?number(sumLikes):'—',
      'Nos '+full.format(validLikes.length)+' vídeo(s) com contagem retornada'));
    const ytVisible=!focus||focus==='youtube';
    const ytLoaded=ytVisible&&results.youtube?.status==='ok';
    place(grid,stat('Agendados no YouTube',ytLoaded?String(scheduled.length):'—',
      ytLoaded?'Identificados nos uploads recentes do YouTube':
        'Selecione ou conecte o YouTube para consultar'));
    if(focus&&datasets[0]?.channel){
      const channel=datasets[0].channel;
      if(channel.subscribers!==null&&channel.subscribers!==undefined)
        place(grid,stat('Inscritos',number(channel.subscribers),'Canal: '+channel.name));
      if(channel.followers!==null&&channel.followers!==undefined)
        place(grid,stat('Seguidores',number(channel.followers),'Perfil: '+channel.name));
    }
    if(!datasets.length)message('Não há dados disponíveis dessas contas no momento.');
  }
  function renderVideoList(id,items,{scheduled=false,emptyText}={}){
    const root=$(id);root.replaceChildren();
    if(!items.length){empty(root,emptyText);return;}
    for(const item of items.slice(0,12)){
      const row=el('div','metrics-video-item');
      const name=el('div','metrics-video-name');
      const title=limitTitle(item.title,96);
      if(item.url){
        const link=el('a','',title);
        link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';
        place(name,link);
      }else place(name,el('strong','',title));
      const small=el('small','',tag(item.platform)+' · '+date(scheduled?item.scheduledAt:item.publishedAt));
      place(name,small);
      const value=el('div','metrics-video-values');
      place(value,el('strong','',scheduled?'Programado':number(item.views)));
      place(value,el('small','',scheduled?'YouTube':item.views===null?'Views não disponíveis':'visualizações'));
      if(!scheduled){
        const meta=[];
        if(item.likes!==null)meta.push(number(item.likes)+' curtidas');
        if(item.comments!==null)meta.push(number(item.comments)+' comentários');
        if(item.shares!==null)meta.push(number(item.shares)+' compartilhamentos');
        if(meta.length)place(name,el('small','',meta.join(' · ')));
      }
      row.append(name,value);place(root,row);
    }
  }
  function renderTop(){
    const valid=normalizeVideos('top').filter(v=>v.views!==null)
      .sort((a,b)=>b.views-a.views).slice(0,7);
    const root=$('metricsBars');root.replaceChildren();
    if(!valid.length){empty(root,'Nenhuma contagem de visualizações foi disponibilizada para criar a comparação.');return;}
    const max=Math.max(1,...valid.map(v=>v.views));
    for(const v of valid){
      const row=el('div','metrics-bar-row');
      const title=el('div','metrics-bar-title',tag(v.platform)+' · '+v.title);
      title.title=v.title;
      const track=el('div','metrics-bar-track');
      const bar=el('span','');
      bar.style.width=Math.max(1,(v.views/max)*100)+'%';
      track.append(bar);
      row.append(title,track,el('div','metrics-bar-count',number(v.views)));
      root.append(row);
    }
  }
  function renderNotes(){
    const root=$('metricsNotes');root.replaceChildren();
    const chosen=focus?[focus]:networks;
    for(const name of chosen){
      if(!isConnected(name)){
        place(root,el('div','metrics-note',tag(name)+': conta não conectada. Abra Publicações para configurar e autorizar o acesso.'));
        continue;
      }
      const result=results[name];
      if(result?.status==='error'){
        const note=el('div','metrics-note is-warning',tag(name)+': '+result.message+
          ' Se faltar permissão de leitura, reconecte a conta em Publicações.');
        place(root,note);
      }else if(result?.status==='ok'&&result.data?.note){
        place(root,el('div','metrics-note',tag(name)+': '+result.data.note));
      }
    }
    if(!root.childElementCount)place(root,el('div','metrics-note','As contagens dependem das APIs e podem levar algum tempo para refletir novas publicações.'));
  }
  function render(){
    const any=networks.some(isConnected);
    $('metricsConnectionGate').hidden=any;
    $('metricsDashboard').hidden=!any;
    for(const name of networks){
      const btn=$('metricsFilter-'+name);
      btn.setAttribute('aria-pressed',String(focus===name));
      btn.classList.toggle('is-disconnected',!isConnected(name));
      $('metricsFilterStatus-'+name).textContent=isConnected(name)?
        (results[name]?.status==='error'?'Consulta indisponível':'Conectado'):'Não conectado';
    }
    if(!any)return;
    $('metricsViewTitle').textContent=focus?'Métricas · '+tag(focus):'Visão geral';
    const timestamps=allRows().map(r=>Date.parse(r.updatedAt)).filter(Number.isFinite);
    $('metricsUpdated').textContent=timestamps.length?
      'Última consulta: '+date(new Date(Math.max(...timestamps)).toISOString()):
      'Dados disponíveis após a consulta das plataformas.';
    renderStats();
    const recent=normalizeVideos('recent').sort((a,b)=>
      (Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
    renderVideoList('metricsRecent',recent,{emptyText:'Nenhum vídeo recente disponível para este filtro.'});
    const planned=normalizeVideos('scheduled').sort((a,b)=>
      (Date.parse(a.scheduledAt)||0)-(Date.parse(b.scheduledAt)||0));
    renderVideoList('metricsScheduled',planned,{scheduled:true,
      emptyText:focus&&focus!=='youtube'?'Os agendamentos disponíveis são exclusivos do YouTube.':
        'Nenhum agendamento encontrado nos uploads recentes do YouTube.'});
    renderTop();renderNotes();
  }
  async function load({refresh=false}={}){
    if(busy){
      queuedRequest=queuedRequest===null?refresh:(queuedRequest||refresh);
      return;
    }
    const call=++sequence;
    busy=true;$('metricsRefresh').disabled=true;
    message('Consultando os dados disponíveis...');
    try{
      const url='/api/social/metrics?platform='+(focus||'general')+(refresh?'&refresh=1':'');
      const response=await fetch(url,{cache:'no-store'});
      const body=await response.json();
      if(!response.ok)throw Error(body.error||'Não foi possível consultar as métricas.');
      if(call!==sequence)return;
      connection=body.connected||{};
      if(refresh||!focus)results={...body.platforms};
      else results={...results,...body.platforms};
      render();
      const errors=Object.entries(body.platforms||{}).filter(([,v])=>v.status==='error').length;
      message(errors?'Algumas plataformas não retornaram dados. Confira as mensagens abaixo.':
        'Dados carregados das contas autorizadas.');
    }catch(error){message(error.message||'Erro inesperado na consulta.');}
    finally{
      busy=false;$('metricsRefresh').disabled=false;
      if(queuedRequest!==null){
        const pending=queuedRequest;queuedRequest=null;
        load({refresh:pending});
      }
    }
  }
  for(const name of networks){
    $('metricsFilter-'+name).addEventListener('click',()=>{
      focus=focus===name?null:name;
      render();
      load();
    });
  }
  $('metricsRefresh').addEventListener('click',()=>load({refresh:true}));
  $('metricsGoConnect').addEventListener('click',()=>$('tab-publications').click());
  $('tab-metrics').addEventListener('click',()=>load());
  if(location.hash==='#metrics')load();
})();
