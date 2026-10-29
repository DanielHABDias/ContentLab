/* Publicações: preparação local de vídeos, sem envio a redes sociais. */
(()=>{
  const $=id=>document.getElementById(id);
  if(!$('socialBrowserSelect')||!$('publishComposerDialog')||!window.ContentLabPublicationPlanning)return;
  const planning=window.ContentLabPublicationPlanning;
  const platforms=['youtube','tiktok','instagram'],names={youtube:'YouTube',tiktok:'TikTok',instagram:'Instagram'};
  let settings=null,ready=false,opened=new Set(),loading=false,drafts=[],videoUrl=null,coverUrls=[],captured=null,selectedVideo=null;
  let editingId=null,selectedIds=new Set(),session=null;
  const notice=(message,error=false)=>{
    $('socialSetupStatus').textContent=message||'';
    $('socialSetupStatus').classList.toggle('social-error',error);
  };
  const status=(message,error=false)=>{
    $('publishStatus').textContent=message||'';
    $('publishStatus').classList.toggle('social-error',error);
  };
  const feedback=(message,error=false)=>{
    $('publishComposerFeedback').textContent=message||'';
    $('publishComposerFeedback').classList.toggle('social-error',error);
  };
  async function request(url,options={}){
    const response=await fetch(url,{cache:'no-store',...options});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Não foi possível concluir a operação.');
    return data;
  }
  const post=(url,body={})=>request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const normalizeUrl=url=>{try{return new URL(url.trim()).href;}catch{return url.trim();}};
  const draftSettings=()=>({browser:$('socialBrowserSelect').value,urls:Object.fromEntries(platforms.map(p=>[p,normalizeUrl($('socialUrl-'+p).value)]))});
  const changed=()=>{
    if(!settings)return true;
    const value=draftSettings();
    return settings.browser!==value.browser||platforms.some(p=>settings.urls[p]!==value.urls[p]);
  };
  function renderConnections(){
    const pending=changed();
    const done=!pending&&ready;
    for(const p of platforms){
      const active=!pending&&settings?.confirmed[p]===true;
      $('socialState-'+p).textContent=active?'Login conferido':'Não conferido';
      $('socialState-'+p).classList.toggle('is-confirmed',active);
      $('socialOpen-'+p).disabled=!settings?.browser||pending;
      $('socialConfirm-'+p).disabled=pending||!opened.has(p)||active;
      const pill=$('publishNetwork-'+p);
      if(pill){
        pill.classList.toggle('is-connected',active);
        pill.classList.toggle('is-disabled',!active);
        $('publishNetworkStatus-'+p).textContent=active?'Login confirmado':'Não configurado';
      }
    }
    const count=platforms.filter(p=>settings?.confirmed[p]===true).length;
    $('socialSetupSummary').textContent=done?
      count+' rede(s) confirmada(s). Você já pode preparar a lista e conectar outras quando quiser.':
      pending?'Salve as alterações antes de conferir os logins.':
      'Abra e confirme pelo menos uma plataforma. '+count+' de 3 conferida(s).';
    $('socialGoPublications').disabled=!done;
    $('publishSetupGate').hidden=done;
    $('publishReady').hidden=!done;
    $('publishConnectionGate')?.setAttribute('hidden','');
    if(pending)notice('Há mudanças não salvas. Salve para revalidar os endereços.');
    updateDestinations();
  }
  const goSettings=()=>$('tab-settings').click();
  $('publishGoSettings').onclick=goSettings;
  $('publishManageAccounts').onclick=goSettings;
  $('socialGoPublications').onclick=()=>{if(ready&&!changed())$('tab-publications').click();};
  function setBrowserChoices(browsers){
    const selector=$('socialBrowserSelect');
    selector.replaceChildren();
    for(const entry of browsers){
      const option=new Option(entry.label+(entry.available?'':' · não encontrado'),entry.id);
      option.disabled=!entry.available;selector.add(option);
    }
    $('socialBrowserDetection').textContent=browsers[0]?.label||'Use o navegador padrão do sistema.';
  }
  async function loadSettings(){
    if(loading)return;loading=true;
    try{
      const data=await request('/api/social-browser/setup');
      setBrowserChoices(data.browsers);
      settings=data.settings;ready=data.ready===true;opened.clear();
      $('socialBrowserSelect').value=settings.browser||'system';
      for(const p of platforms)$('socialUrl-'+p).value=settings.urls[p];
      notice(settings.browser?'Configuração local carregada.':'Primeiro acesso: escolha o navegador e salve as URLs.');
      renderConnections();
      if(location.hash==='#publications'&&!ready)goSettings();
    }catch(error){notice(error.message,true);}
    finally{loading=false;}
  }
  for(const id of ['socialBrowserSelect',...platforms.map(p=>'socialUrl-'+p)]){
    $(id).addEventListener('input',()=>{opened.clear();renderConnections();});
    $(id).addEventListener('change',()=>{opened.clear();renderConnections();});
  }
  $('socialSaveSettings').onclick=async()=>{
    const button=$('socialSaveSettings');button.disabled=true;
    try{
      const data=await post('/api/social-browser/settings',draftSettings());
      settings=data.settings;ready=data.ready;opened.clear();
      notice('Navegador e URLs salvos neste computador.');
      renderConnections();
    }catch(error){notice(error.message,true);}
    finally{button.disabled=false;}
  };
  for(const p of platforms){
    $('socialOpen-'+p).onclick=async()=>{
      try{
        if(changed())throw Error('Salve primeiro o navegador e as URLs.');
        const data=await post('/api/social-browser/open/'+p);
        if(!data.opened)throw Error('Não foi possível abrir a página.');
        opened.add(p);notice('Abrimos '+data.label+'. Confira o login no navegador e confirme abaixo.');
        renderConnections();
      }catch(error){notice(error.message,true);}
    };
    $('socialConfirm-'+p).onclick=async()=>{
      try{
        const data=await post('/api/social-browser/confirm/'+p);
        settings=data.settings;ready=data.ready;opened.delete(p);
        notice(names[p]+' confirmado por você. '+(ready?'A aba Publicações está liberada.':'Confirme pelo menos uma rede para continuar.'));
        renderConnections();
      }catch(error){notice(error.message,true);}
    };
  }
  const kind=()=>document.querySelector('#publishComposerForm input[name="kind"]:checked')?.value||'short';
  const allowed=()=>planning.compatiblePlatforms(kind());
  function updateDestinations(selectDefaults=false){
    const compatible=allowed(),available=[];
    for(const p of platforms){
      const node=document.querySelector('#publishDestinations [data-platform="'+p+'"]');
      if(!node)continue;
      const input=node.querySelector('input');
      const enabled=!!settings?.confirmed[p]&&compatible.includes(p)&&!changed();
      input.disabled=!enabled;
      if(selectDefaults)input.checked=enabled;
      else if(!enabled)input.checked=false;
      node.classList.toggle('is-disabled',!enabled);
      node.classList.toggle('is-unconfigured',settings?.confirmed[p]!==true||changed());
      node.classList.toggle('is-incompatible',!compatible.includes(p));
      node.classList.toggle('is-selected',input.checked);
      if(enabled)available.push(names[p]);
    }
    $('publishDestinationHint').textContent=available.length?
      'Pré-selecionadas: '+available.join(', ')+'. Você pode desmarcar qualquer destino.':
      'Nenhuma rede compatível foi confirmada para este formato. Volte às Configurações para habilitar uma.';
  }
  for(const el of document.querySelectorAll('#publishDestinations input')){
    el.addEventListener('change',()=>updateDestinations());
  }
  for(const node of document.querySelectorAll('#publishDestinations .publish-destination')){
    node.addEventListener('click',event=>{
      const platform=node.dataset.platform;
      if(settings?.confirmed[platform]===true&&!changed())return;
      event.preventDefault();
      const message=names[platform]+' ainda não foi configurado. Abra Configurações de redes sociais, confirme o login e volte para selecionar.';
      $('publishUnavailableWarning').hidden=false;
      $('publishUnavailableWarning').textContent=message;
      feedback(message,true);
    });
  }
  function releaseVideo(){
    if(videoUrl){URL.revokeObjectURL(videoUrl);videoUrl=null;}
    for(const url of coverUrls)URL.revokeObjectURL(url);
    coverUrls=[];
    const video=$('publishFrameVideo');
    video.pause();video.removeAttribute('src');video.load();
    $('publishFrameImage').hidden=true;
    $('publishFrameImage').removeAttribute('src');
    captured=null;selectedVideo=null;
  }
  const timecode=value=>{
    const seconds=Math.max(0,Number(value)||0);
    return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(Math.floor(seconds%60)).padStart(2,'0');
  };
  function applySuggestedSchedule(){
    const input=$('publishScheduleAt');
    input.value=planning.suggestSchedule(kind(),drafts,new Date());
    const hasPrevious=drafts.some(item=>planning.parseLocal(item.scheduledAt));
    $('publishScheduleAdvice').textContent=hasPrevious?
      'Sugestão automática: próximo dia depois do último vídeo da lista.':
      'Sugestão automática: primeiro horário com pelo menos 2 horas de antecedência.';
  }
  $('publishScheduleReset').addEventListener('click',applySuggestedSchedule);
  $('publishScheduleAt').addEventListener('input',()=>{
    $('publishScheduleAdvice').textContent='Data ajustada manualmente. Você pode reaplicar a sugestão.';
  });
  function refreshKind(){
    $('publishUnavailableWarning').hidden=true;
    const long=kind()==='long';
    $('publishTitleBWrap').hidden=!long;
    $('publishTitleB').required=long;
    $('publishTitleALabel').textContent=long?'Título A · teste A/B':'Título do vídeo';
    $('publishLongCovers').hidden=!long;
    $('publishShortCover').hidden=long;
    $('publishCoverHeading').textContent=long?'Duas thumbnails para teste A/B':'Sua thumbnail · imagem ou frame do vídeo';
    updateDestinations(true);
    applySuggestedSchedule();
  }
  document.querySelectorAll('#publishComposerForm input[name="kind"]').forEach(el=>el.addEventListener('change',refreshKind));
  function previewImage(file,id){
    const image=$(id);image.hidden=!file;
    if(!file){image.removeAttribute('src');return;}
    const url=URL.createObjectURL(file);
    coverUrls.push(url);image.src=url;
  }
  for(const [field,preview,name] of [['publishCoverA','publishLongPreviewA','publishCoverNameA'],['publishCoverB','publishLongPreviewB','publishCoverNameB']]){
    $(field).addEventListener('change',()=>{
      const file=$(field).files[0];previewImage(file,preview);
      $(name).textContent=file?file.name:'Nenhuma imagem selecionada';
    });
  }
  $('publishVideoFile').addEventListener('change',()=>{
    const file=$('publishVideoFile').files[0];
    releaseVideo();selectedVideo=file||null;
    $('publishFileCaption').textContent=file?file.name:'Selecionar vídeo do computador';
    $('publishVideoMeta').textContent=file?(file.size/1024/1024).toFixed(1)+' MB · prévia disponível abaixo':'';
    $('publishFrameSeek').disabled=true;
    $('publishCaptureFrame').disabled=true;
    $('publishFramePlaceholder').hidden=!file;
    if(!file)return;
    videoUrl=URL.createObjectURL(file);
    const video=$('publishFrameVideo');video.src=videoUrl;video.load();
  });
  const frameVideo=$('publishFrameVideo');
  frameVideo.addEventListener('loadedmetadata',()=>{
    $('publishFrameSeek').max=String(Math.max(0,frameVideo.duration-.05));
    $('publishFrameSeek').value='0';
    $('publishFrameSeek').disabled=!Number.isFinite(frameVideo.duration)||frameVideo.duration<=0;
    $('publishCaptureFrame').disabled=$('publishFrameSeek').disabled;
    $('publishFramePlaceholder').hidden=true;
    $('publishFrameTime').textContent='00:00';
  });
  $('publishFrameSeek').addEventListener('input',()=>{
    const seconds=Number($('publishFrameSeek').value);
    $('publishFrameTime').textContent=timecode(seconds);
    frameVideo.currentTime=seconds;
    $('publishFrameImage').hidden=true;
    captured=null;
  });
  const frameBlob=()=>new Promise((resolve,reject)=>{
    const video=frameVideo;
    if(!video.videoWidth||!video.videoHeight)return reject(Error('Ainda não há frame disponível. Tente selecionar outro momento.'));
    const canvas=document.createElement('canvas');
    canvas.width=Math.min(1280,video.videoWidth);
    canvas.height=Math.round(canvas.width*video.videoHeight);
    canvas.height=Math.round(canvas.height/video.videoWidth);
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Falha ao extrair o frame.')),'image/png');
  });
  $('publishCaptureFrame').onclick=async()=>{
    try{
      captured=await frameBlob();
      const file=$('publishShortCoverFile');file.value='';
      $('publishShortCoverName').textContent='Frame capturado em '+timecode(frameVideo.currentTime);
      previewImage(new File([captured],'frame.png',{type:'image/png'}),'publishFrameImage');
      $('publishCoverFeedback').textContent='Frame de '+timecode(frameVideo.currentTime)+' capturado como thumbnail. A imagem será salva com o vídeo.';
    }catch(error){feedback(error.message,true);}
  };
  $('publishShortCoverFile').addEventListener('change',()=>{
    const image=$('publishShortCoverFile').files[0];
    if(image){
      captured=null;previewImage(image,'publishFrameImage');
      $('publishShortCoverName').textContent=image.name;
      $('publishCoverFeedback').textContent='Thumbnail personalizada selecionada: '+image.name;
    }else{
      $('publishFrameImage').hidden=true;
      $('publishShortCoverName').textContent='Nenhuma imagem selecionada';
      $('publishCoverFeedback').textContent='Selecione um frame do vídeo para criar sua thumbnail.';
    }
  });
  async function openComposer(item=null){
    if(!ready||changed())return goSettings();
    // Atualizar a lista antes da sugestão, inclusive se outra aba adicionou um item.
    try{const data=await request('/api/social-browser/drafts');drafts=data.items||[];renderDrafts();}
    catch(error){status(error.message,true);return;}
    const dialog=$('publishComposerDialog');
    const current=item?.id?drafts.find(d=>d.id===item.id):null;
    editingId=current?.id||null;
    $('publishComposerForm').reset();releaseVideo();
    $('publishComposerTitle').textContent=editingId?'Editar vídeo da lista':'Preparar publicação';
    $('publishComposerSave').textContent=editingId?'Salvar alterações':'＋ Adicionar à lista';
    $('publishEditMediaHint').hidden=!editingId;
    $('publishVideoFile').required=!editingId;
    $('publishUnavailableWarning').hidden=true;
    $('publishFileCaption').textContent='Selecionar vídeo do computador';
    $('publishVideoMeta').textContent='';
    for(const id of ['publishCoverNameA','publishCoverNameB','publishShortCoverName'])$(id).textContent='Nenhuma imagem selecionada';
    $('publishFramePlaceholder').hidden=false;
    $('publishFrameSeek').disabled=true;
    $('publishCaptureFrame').disabled=true;
    $('publishFrameTime').textContent='00:00';
    $('publishCoverFeedback').textContent='Sem imagem pronta? Escolha um momento do vídeo e capture.';
    feedback('');
    for(const id of ['publishLongPreviewA','publishLongPreviewB','publishFrameImage'])$(id).hidden=true;
    refreshKind();
    if(current){
      document.querySelector('#publishComposerForm input[name="kind"][value="'+current.kind+'"]').checked=true;
      refreshKind();
      $('publishTitleA').value=current.titleA||'';
      $('publishTitleB').value=current.titleB||'';
      $('publishDescription').value=current.description||'';
      $('publishTags').value=(current.tags||[]).join(', ');
      $('publishScheduleAt').value=current.scheduledAt||'';
      $('publishScheduleAdvice').textContent='Data do vídeo mantida. Altere se quiser.';
      $('publishFileCaption').textContent=current.fileName||'Vídeo salvo';
      $('publishVideoMeta').textContent='Vídeo salvo na lista · escolha outro arquivo somente para trocar';
      for(const p of platforms){
        const input=document.querySelector('#publishDestinations input[value="'+p+'"]');
        input.checked=!input.disabled&&current.platforms.includes(p);
      }
      updateDestinations();
      const setExisting=(id,kind,name)=>{
        if(!current.media?.[kind])return;
        $(id).src=safeUrl(current.id,kind);$(id).hidden=false;
        $(name).textContent='Imagem atual · selecione outra para trocar';
      };
      if(current.kind==='long'){
        setExisting('publishLongPreviewA','coverA','publishCoverNameA');
        setExisting('publishLongPreviewB','coverB','publishCoverNameB');
      }else{
        setExisting('publishFrameImage','coverA','publishShortCoverName');
      }
      const video=$('publishFrameVideo');
      video.src=safeUrl(current.id,'video');video.load();
      $('publishCoverFeedback').textContent='Thumbnail atual preservada. Você pode escolher outra imagem ou capturar um novo frame.';
    }
    dialog.showModal();
  }
  const closeComposer=()=>{releaseVideo();$('publishComposerDialog').close();editingId=null;};
  $('publishAddVideo').onclick=()=>openComposer();
  $('publishEmptyCard').onclick=()=>openComposer();
  $('publishComposerClose').onclick=closeComposer;
  $('publishComposerCancel').onclick=closeComposer;
  $('publishComposerDialog').addEventListener('close',()=>{releaseVideo();editingId=null;});
  function el(tag,className,textValue){
    const item=document.createElement(tag);
    if(className)item.className=className;
    if(textValue!==undefined)item.textContent=textValue;
    return item;
  }
  const safeUrl=(id,type)=>'/api/social-browser/drafts/'+encodeURIComponent(id)+'/media/'+type;
  function updateSelection(){
    selectedIds=new Set([...selectedIds].filter(id=>drafts.some(d=>d.id===id)));
    const count=selectedIds.size;
    $('publishSelectionBar').hidden=count===0;
    $('publishSelectedCount').textContent=String(count);
    $('publishPrepareBrowser').disabled=count===0;
  }
  $('publishClearSelection').onclick=()=>{selectedIds.clear();renderDrafts();};
  function renderDrafts(){
    const list=$('publishDraftList');list.replaceChildren();
    $('publishDraftCount').textContent=String(drafts.length);
    $('publishEmptyCard').classList.toggle('is-first',drafts.length===0);
    $('publishEmptyCard').querySelector('.publish-empty-copy strong').textContent=
      drafts.length?'Adicionar outro vídeo à lista':'Seu primeiro vídeo entra aqui';
    $('publishEmptyCard').querySelector('.publish-empty-copy em').textContent=
      drafts.length?'＋ Preparar próximo vídeo':'＋ Adicionar primeiro vídeo';
    for(const [index,item] of drafts.entries()){
      const card=el('article','publish-draft-card');
      card.classList.toggle('is-picked',selectedIds.has(item.id));
      const picker=el('label','publish-draft-picker');
      const check=el('input');check.type='checkbox';check.checked=selectedIds.has(item.id);
      check.setAttribute('aria-label','Selecionar '+item.titleA+' para abrir redes');
      check.addEventListener('change',()=>{
        if(check.checked)selectedIds.add(item.id);else selectedIds.delete(item.id);
        card.classList.toggle('is-picked',check.checked);updateSelection();
      });
      picker.append(check,el('span','','Selecionar'));
      const thumb=el('div','publish-draft-thumb '+(item.kind==='short'?'is-short':'is-long'));
      const img=el('img');img.alt='Capa do vídeo';img.loading='lazy';img.src=safeUrl(item.id,'coverA');
      thumb.append(img,el('span','publish-draft-thumb-label',item.kind==='long'?'VÍDEO LONGO':'SHORT'));
      const content=el('div','publish-draft-content');
      const meta=el('div','publish-draft-meta');
      meta.append(el('span','publish-draft-num','#'+String(index+1).padStart(2,'0')),el('span','publish-draft-state','● Rascunho local'));
      content.append(meta,el('h4','',item.titleA));
      if(item.titleB)content.append(el('p','publish-draft-ab','A/B · '+item.titleB));
      if(item.description)content.append(el('p','publish-draft-desc',item.description));
      const chips=el('div','publish-draft-chips');
      for(const p of item.platforms||[])chips.append(el('span','publish-chip platform-'+p,names[p]||p));
      if(item.scheduledAt)chips.append(el('span','publish-chip','◷ '+item.scheduledAt.replace('T',' · ')));
      if(item.titleB)chips.append(el('span','publish-chip','A/B: 2 títulos + 2 capas'));
      for(const t of (item.tags||[]).slice(0,4))chips.append(el('span','publish-tag','#'+t));
      content.append(chips);
      const tail=el('div','publish-draft-tail');
      tail.append(el('span','publish-file-label',item.fileName||'Vídeo local'));
      const edit=el('button','publish-draft-edit','✎ Editar');
      edit.type='button';edit.onclick=()=>openComposer(item);
      const preview=el('a','publish-draft-preview','↗ Ver vídeo');
      preview.href=safeUrl(item.id,'video');preview.target='_blank';preview.rel='noopener noreferrer';
      const remove=el('button','publish-draft-remove','Excluir');
      remove.type='button';remove.title='Excluir rascunho e cópias locais';
      remove.onclick=async()=>{
        if(!confirm('Excluir este item da lista e suas cópias locais?'))return;
        try{
          await request('/api/social-browser/drafts/'+encodeURIComponent(item.id),{method:'DELETE'});
          drafts=drafts.filter(d=>d.id!==item.id);renderDrafts();status('Vídeo removido da lista.');
        }catch(error){status(error.message,true);}
      };
      tail.append(edit,preview,remove);content.append(tail);
      card.append(picker,thumb,content);list.append(card);
    }
    updateSelection();
  }
  async function loadDrafts(){
    try{const data=await request('/api/social-browser/drafts');drafts=data.items||[];renderDrafts();}
    catch(error){status(error.message,true);}
  }
  $('publishComposerForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const button=$('publishComposerSave');
    if(button.disabled)return;
    try{
      if(!ready||changed())throw Error('Confirme uma rede em Configurações.');
      const video=$('publishVideoFile').files[0],long=kind()==='long';
      if(!video&&!editingId)throw Error('Selecione um vídeo do computador.');
      if(!/\.(mp4|webm|mov|m4v)$/i.test(video.name))throw Error('Use vídeo MP4 ou WebM.');
      const coverA=long?$('publishCoverA').files[0]:$('publishShortCoverFile').files[0]||
        (captured?new File([captured],'frame.png',{type:'image/png'}):null);
      const coverB=long?$('publishCoverB').files[0]:null;
      const previous=editingId?drafts.find(d=>d.id===editingId):null;
      const retainA=previous?.media?.coverA;
      const retainB=long&&previous?.media?.coverB;
      if((!coverA&&!retainA)||(long&&!coverB&&!retainB))
        throw Error(long?'Selecione as duas thumbnails para o teste A/B.':'Escolha uma thumbnail ou capture um frame do vídeo.');
      if(long&&$('publishTitleA').value.trim()===$('publishTitleB').value.trim())
        throw Error('O teste A/B precisa de títulos diferentes.');
      const chosen=platforms.filter(p=>document.querySelector('#publishDestinations input[value="'+p+'"]').checked);
      if(!chosen.length)throw Error('Selecione pelo menos um destino habilitado.');
      const form=new FormData();
      if(video)form.append('video',video);
      if(coverA)form.append('coverA',coverA);
      if(coverB)form.append('coverB',coverB);
      for(const key of ['titleA','titleB','description','tags','scheduledAt'])form.append(key, $('publish'+({titleA:'TitleA',titleB:'TitleB',description:'Description',tags:'Tags',scheduledAt:'ScheduleAt'}[key])).value);
      form.append('kind',kind());form.append('platforms',JSON.stringify(chosen));
      button.disabled=true;button.textContent='Salvando vídeo...';feedback('Copiando o vídeo e as imagens para a lista local...');
      const edited=Boolean(editingId);
      const data=await request(edited?'/api/social-browser/drafts/'+encodeURIComponent(editingId):'/api/social-browser/drafts',
        {method:edited?'PUT':'POST',body:form});
      if(edited)drafts=drafts.map(d=>d.id===editingId?data.item:d);
      else drafts.unshift(data.item);
      renderDrafts();closeComposer();
      status(edited?'Informações e arquivos do vídeo atualizados localmente.':'Vídeo adicionado e salvo localmente. Nenhum arquivo foi enviado às redes.');
    }catch(error){feedback(error.message,true);}
    finally{button.disabled=false;button.textContent=editingId?'Salvar alterações':'＋ Adicionar à lista';}
  });
  function renderPublicationSession(result){
    session=result;
    const panel=$('publishSessionPanel'),tabs=$('publishSessionTabs');
    tabs.replaceChildren();panel.hidden=!result;
    if(!result)return;
    for(const tab of result.tabs){
      const row=el('li','');
      row.append(el('strong','',String(tab.index).padStart(2,'0')+' · '+names[tab.platform]));
      const link=el('a','',tab.url);link.href=tab.url;link.target='_blank';link.rel='noopener noreferrer';
      row.append(link);tabs.append(row);
    }
    $('publishSessionVideos').textContent=result.videos.length+' vídeo(s) vinculados às abas, conforme os destinos escolhidos.';
  }
  $('publishPrepareBrowser').onclick=async()=>{
    const button=$('publishPrepareBrowser');button.disabled=true;
    try{
      const result=await request('/api/social-browser/prepare',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({draftIds:[...selectedIds]})
      });
      renderPublicationSession(result.session);
      status('Navegador visível solicitado com '+result.session.tabs.length+' aba(s). Nenhum vídeo foi enviado.');
    }catch(error){status(error.message,true);}
    finally{button.disabled=selectedIds.size===0;}
  };
  request('/api/social-browser/session').then(data=>renderPublicationSession(data.session)).catch(()=>{});
  window.addEventListener('workspacechange',event=>{
    if(event.detail.name==='publications'){
      if(!settings){loadSettings();return;}
      renderConnections();
      if(!ready||changed())goSettings();
      else loadDrafts();
    }else if(event.detail.name==='settings')loadSettings();
  });
  loadSettings();loadDrafts();
})();
