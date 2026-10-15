// Pesquisa de mídia externa com prévias; downloads passam exclusivamente pelo backend local.
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  if(!$('panel-library'))return;
  const names={commons:'Wikimedia Commons',archive:'Internet Archive',youtube:'YouTube',pinterest:'Pinterest'};
  let chosen=null,requestId=0,downloading=false,lastImportedKey=null;
  const label=(text,cls)=>{const span=document.createElement('span');span.textContent=text;span.className=cls||'';return span;};
  const feedback=(text,error=false)=>{
    $('libraryFeedback').textContent=text;
    $('libraryFeedback').classList.toggle('library-is-error',error);
  };
  const downloadState=(text,error=false)=>{
    $('libraryDownloadState').textContent=text;
    $('libraryDownloadState').classList.toggle('library-is-error',error);
  };
  const allowedLink=value=>{
    try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}
  };
  const choose=(item,card)=>{
    chosen=item;
    for(const el of $('libraryResults').querySelectorAll('.library-result'))
      el.classList.toggle('is-selected',el===card);
    $('librarySelected').textContent=item.title+' · '+names[item.provider]+' · '+item.license;
    $('libraryRights').checked=false;
    $('libraryDownload').disabled=true;
    $('libraryOpenVideos').hidden=true;
    downloadState('Confira a licença na página de origem e confirme sua autorização para importar.');
  };
  const makeCard=item=>{
    const card=document.createElement('article');
    card.className='library-result';
    const media=document.createElement('div');media.className='library-result-cover';
    const src=allowedLink(item.preview);
    if(src){const img=document.createElement('img');img.src=src;img.alt='';
      img.loading='lazy';img.referrerPolicy='no-referrer';media.append(img);}
    else media.append(label(item.kind==='video'?'▶':'▣','library-fallback-icon'));
    media.append(label(item.kind==='video'?'VÍDEO':'IMAGEM','library-kind'));
    const body=document.createElement('div');body.className='library-result-body';
    body.append(label(names[item.provider],'library-provider'));
    const heading=document.createElement('h4');heading.textContent=item.title;
    heading.title=item.title;body.append(heading);
    const credit=document.createElement('p');credit.className='library-credit';
    credit.textContent='Crédito: '+(item.credit||'Consultar origem');body.append(credit);
    const rights=document.createElement('p');rights.className='library-license';
    rights.textContent=item.license;body.append(rights);
    const controls=document.createElement('div');controls.className='library-card-actions';
    const original=document.createElement('a');original.className='btn btn-ghost btn-sm';
    original.href=allowedLink(item.pageUrl)||'#';original.target='_blank';
    original.rel='noopener noreferrer';original.textContent='Ver origem ↗';controls.append(original);
    const select=document.createElement('button');select.type='button';
    select.className='btn btn-secondary btn-sm';select.textContent='Selecionar';
    select.addEventListener('click',()=>choose(item,card));controls.append(select);
    body.append(controls);card.append(media,body);
    return card;
  };
  async function search(){
    const q=$('libraryQuery').value.trim();
    if(q.length<2){feedback('Digite pelo menos dois caracteres.',true);return;}
    const ticket=++requestId;
    $('librarySearchBtn').disabled=true;
    const source=$('librarySource').value;
    const hasPinterest=['popular','pinterest','all'].includes(source);
    $('libraryFallback').hidden=!hasPinterest;
    $('libraryPinterestExternal').href='https://www.pinterest.com/search/pins/?'+
      new URLSearchParams({q});
    $('libraryTikTokSearch').href='https://www.tiktok.com/search?'+new URLSearchParams({q});
    feedback('Pesquisando nas fontes disponíveis…');
    $('libraryResults').replaceChildren();
    $('libraryResultCount').textContent='';
    chosen=null;$('libraryDownload').disabled=true;$('libraryRights').checked=false;
    $('librarySelected').textContent='Selecione um resultado para importar.';
    try{
      const params=new URLSearchParams({q,source:$('librarySource').value,kind:$('libraryKind').value});
      const response=await fetch('/api/library/search?'+params,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Falha na pesquisa.');
      if(ticket!==requestId)return;
      const items=data.items||[];
      if(!items.length){
        const empty=document.createElement('div');empty.className='library-empty';
        empty.textContent='Nenhum resultado público encontrado. Experimente outro assunto, altere a fonte ou abra a pesquisa no site original.';
        $('libraryResults').append(empty);
      }else for(const item of items)$('libraryResults').append(makeCard(item));
      $('libraryResultCount').textContent=items.length+' resultado(s)';
      feedback(data.warnings?.length?
        'Algumas fontes não responderam: '+data.warnings.join(' · '):
        items.length+' resultado(s) encontrados. Confira se possui autorização para reutilizá-los.',
        Boolean(data.warnings?.length));
    }catch(error){
      if(ticket!==requestId)return;
      feedback(error.message||'Não foi possível pesquisar.',true);
    }finally{if(ticket===requestId)$('librarySearchBtn').disabled=false;}
  }
  $('librarySearchForm').addEventListener('submit',event=>{event.preventDefault();search();});
  for(const shortcut of document.querySelectorAll('[data-library-search]'))
    shortcut.addEventListener('click',()=>{
      $('libraryQuery').value=shortcut.dataset.librarySearch;search();
    });
  $('libraryRights').addEventListener('change',()=>{
    $('libraryDownload').disabled=!chosen||!$('libraryRights').checked||downloading;
  });
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  $('libraryDownload').addEventListener('click',async()=>{
    if(!chosen||!$('libraryRights').checked||downloading)return;
    downloading=true;$('libraryDownload').disabled=true;
    $('libraryProgress').hidden=false;$('libraryProgressFill').style.width='2%';
    $('libraryOpenVideos').hidden=true;
    lastImportedKey=null;
    downloadState('Iniciando a importação…');
    try{
      const response=await fetch('/api/library/download',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key:chosen.key,acknowledgeRights:true})
      });
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Não foi possível iniciar.');
      let last=null;
      for(let i=0;i<600;i++){
        await sleep(750);
        const progress=await fetch('/api/library/jobs/'+encodeURIComponent(result.id),{cache:'no-store'});
        last=await progress.json();
        if(!progress.ok)throw Error(last.error||'Não foi possível acompanhar o download.');
        $('libraryProgressFill').style.width=(last.percent||0)+'%';
        downloadState(last.message||'Baixando…');
        if(last.status!=='running')break;
      }
      if(last?.status==='error')throw Error(last.error||'Falha na transferência.');
      if(last?.status!=='done')throw Error('Tempo de espera excedido. Confira o processo no servidor.');
      downloadState((last.result?.kind==='video'?'Vídeo no cache de cortes: ':'Imagem salva: ')+
        (last.result?.filePath||'Concluído'));
      $('libraryOpenVideos').hidden=last.result?.kind!=='video';
      lastImportedKey=last.result?.cachedKey||null;
    }catch(error){downloadState(error.message||'Importação interrompida.',true);}
    finally{downloading=false;$('libraryDownload').disabled=!$('libraryRights').checked||!chosen;}
  });
  $('libraryOpenVideos').addEventListener('click',()=>{
    $('tab-videos').click();
    if(lastImportedKey)document.dispatchEvent(new CustomEvent('contentlab:library-video-imported',{
      detail:{key:lastImportedKey}
    }));
  });
})();
