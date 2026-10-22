/* Recording has explicit finalization treatment; local TTS and import treatment remain separate. */
(()=>{
  const $=id=>document.getElementById(id);if(!$('voiceRecordStart'))return;
  const expressiveModel='chatterbox-multilingual';
  for(const id of ['voiceAiModel','voiceModelInstallSelect'])if(![...$(id).options].some(o=>o.value===expressiveModel))$(id).add(new Option('Chatterbox Multilingual V3 · expressivo',expressiveModel));
  function expressiveControls(){$('voiceExpressiveControls').hidden=$('voiceAiModel').value!==expressiveModel;}
  $('voiceAiModel').addEventListener('change',()=>{expressiveControls();const expressive=$('voiceAiModel').value===expressiveModel;$('voiceTemperature').value=expressive?.8:.9;$('voiceRepetition').value=expressive?2:1.05;$('voiceTopP').value=1;$('voiceParagraphPause').value=0;$('voiceDeliveryPreset').value='neutral';$('voiceExaggeration').value=.5;$('voiceCfgWeight').value=.5;});expressiveControls();
  $('voiceDeliveryPreset').addEventListener('change',()=>{
    const values={neutral:[.5,.5],calm:[.3,.3],dramatic:[.75,.3],energetic:[.85,.4]}[$('voiceDeliveryPreset').value];
    if(values){$('voiceExaggeration').value=values[0];$('voiceCfgWeight').value=values[1];}
  });
  let recorder=null,stream=null,context=null,frame=null,chunks=[],take=null,objectUrl=null;
  let elapsed=0,lastTime=0,timer=null,jobId=null,polling=false,refreshing=false,unsavedTake=false,recordingFolder=null,savingTake=false,takeState=null;
  let savedProfiles=[];
  const status=(message,complete=false)=>{
    $('voiceCreationStatus').textContent=message;
    for(const id of ['voiceRecordProgress','voiceAiProgress']){
      const box=$(id);if(!box)continue;
      box.hidden=!message;box.textContent=message;box.className='voice-progress'+(complete?' voice-progress-complete':'');
    }
  };
  const root=()=>{const folder=$('transcriptionProjectRoot').value.trim();if(!folder)throw Error('Escolha a pasta do vídeo acima.');return folder;};
  async function request(url,options){
    const response=await fetch(url,options),data=await response.json();
    if(!response.ok)throw Error(data.error||'Falha no processamento.');return data;
  }
  const post=(url,body)=>request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const safe=fn=>async()=>{try{await fn();}catch(error){status(error.message);}};
  function release(){
    stream?.getTracks().forEach(track=>track.stop());stream=null;
    if(frame)cancelAnimationFrame(frame);frame=null;
    context?.close().catch(()=>{});context=null;
    clearInterval(timer);timer=null;$('voiceLevel').value=0;
  }
  async function microphones(){
    const devices=await navigator.mediaDevices.enumerateDevices();
    const selected=$('voiceMicrophone').value;$('voiceMicrophone').replaceChildren();
    for(const [index,device] of devices.filter(d=>d.kind==='audioinput').entries()){
      const option=new Option(device.label||`Microfone ${index+1}`,device.deviceId);$('voiceMicrophone').add(option);
    }
    if([...$('voiceMicrophone').options].some(o=>o.value===selected))$('voiceMicrophone').value=selected;
  }
  $('voiceMicrophoneRefresh').onclick=safe(async()=>{
    if(recorder&&recorder.state!=='inactive')throw Error('Finalize a gravação antes de atualizar os microfones.');
    const permission=await navigator.mediaDevices.getUserMedia({audio:true});
    try{await microphones();}finally{permission.getTracks().forEach(t=>t.stop());}
    status('Microfones disponíveis. A captura só começa ao clicar em Gravar.');
  });
  function showTake(blob){
    if(objectUrl)URL.revokeObjectURL(objectUrl);take=blob;unsavedTake=true;objectUrl=URL.createObjectURL(blob);
    $('voiceTakeAudio').src=objectUrl;$('voiceTakeAudio').hidden=false;$('voiceRecordSave').disabled=false;$('voiceRecordSave').hidden=false;
    $('voiceReferenceRecording').disabled=false;
  }
  $('voiceRecordStart').onclick=safe(async()=>{
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Seu navegador não oferece gravação. Use Chrome/Firefox pelo endereço local.');
    if(recorder&&recorder.state!=='inactive')return;
    try{
      recordingFolder=root();
      const deviceId=$('voiceMicrophone').value;
      stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:deviceId?{exact:deviceId}:undefined,sampleRate:{ideal:48000},channelCount:{ideal:1},echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
      await microphones();
      const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
      recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});chunks=[];elapsed=0;lastTime=performance.now();
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onstop=async()=>{
        const blob=new Blob(chunks,{type:recorder.mimeType});release();
        $('voiceRecordStart').disabled=false;$('voiceRecordStop').disabled=true;$('voiceRecordPause').disabled=true;
        if(blob.size){showTake(blob);try{await saveTake(recordingFolder);}catch(error){status('Tomada mantida no navegador: '+error.message+' Use Tentar salvar novamente.');}}
        else status('A gravação não contém áudio.');
      };
      recorder.onerror=()=>{if(recorder.state!=='inactive')recorder.stop();else release();status('Falha na captura de áudio.');};
      recorder.start(1000);$('voiceRecordStart').disabled=true;$('voiceRecordPause').disabled=false;$('voiceRecordStop').disabled=false;
      $('voiceRecordPause').textContent='Pausar';$('voiceRecordSave').disabled=true;
      context=new AudioContext();await context.resume();const analyzer=context.createAnalyser();analyzer.fftSize=256;
      context.createMediaStreamSource(stream).connect(analyzer);const samples=new Float32Array(analyzer.fftSize);
      const level=()=>{analyzer.getFloatTimeDomainData(samples);$('voiceLevel').value=recorder.state==='recording'?Math.min(1,Math.sqrt(samples.reduce((a,n)=>a+n*n,0)/samples.length)*4):0;frame=requestAnimationFrame(level);};level();
      timer=setInterval(()=>{
        const now=performance.now();if(recorder.state==='recording')elapsed+=now-lastTime;lastTime=now;
        $('voiceRecordTime').textContent=new Date(elapsed).toISOString().slice(11,19);
        if(elapsed>3600000)recorder.stop();
      },200);status('Gravando. Permaneça nesta página.');
    }catch(error){release();$('voiceRecordStart').disabled=false;throw error;}
  });
  $('voiceRecordPause').onclick=()=>{
    if(recorder?.state==='recording'){elapsed+=performance.now()-lastTime;recorder.pause();$('voiceRecordPause').textContent='Continuar';}
    else if(recorder?.state==='paused'){recorder.resume();$('voiceRecordPause').textContent='Pausar';}
    lastTime=performance.now();
  };
  $('voiceRecordStop').onclick=()=>{if(recorder&&recorder.state!=='inactive')return recorder.stop();};
  function recordedFile(){if(!take)throw Error('Grave uma tomada primeiro.');const ext=take.type.includes('ogg')?'ogg':take.type.includes('mp4')?'m4a':'webm';return new File([take],'recording.'+ext,{type:take.type});}
  async function useAudio(id,result){
    $('voiceFinalAudio').src='/api/voice/final/audio?projectRoot='+encodeURIComponent(result.projectRoot)+'&t='+Date.now();$('voiceFinalDetails').hidden=false;
    $('voiceFinalDetails').open=true;
    $('voiceFinalSummary').textContent=result.takeCount+' tomada(s) · '+result.duration.toFixed(1)+'s · '+result.wordCount+' palavras. Salvos: audio/narration.wav e transcript.json/txt/srt.';
    $('voiceFinalTranscript').value=result.preview||'';
  }
  function automaticTranscription(){return {model:$('voiceAutomaticModel').value||'base',language:$('voiceAutomaticLanguage').value||'pt',detail:'words'};}
  function enhancement(){return {enhancementEngine:$('voiceEnhancementEngine').value||'off',enhancementMode:$('voiceEnhancementMode').value||'strong',enhancementStrength:Number($('voiceEnhancementStrength').value||100)};}
  function enhancementControls(){
    const off=$('voiceEnhancementEngine').value!=='deepfilter';
    $('voiceEnhancementMode').disabled=off||polling;$('voiceEnhancementStrength').disabled=off||polling;
    $('voiceEnhancementPreview').disabled=off||polling;$('voiceEnhancementEngine').disabled=polling;
    $('voiceEnhancementStrengthValue').textContent=String($('voiceEnhancementStrength').value||100)+'%';
  }
  $('voiceEnhancementEngine').onchange=enhancementControls;$('voiceEnhancementStrength').oninput=enhancementControls;
  $('voiceEnhancementPreview').onclick=safe(async()=>{
    if(polling||savingTake||(recorder&&recorder.state!=='inactive'))throw Error('Finalize a tomada antes de testar.');
    const form=new FormData();form.append('projectRoot',root());
    for(const [key,value] of Object.entries(enhancement()))form.append(key,String(value));
    const importing=!$('panel-transcription').hidden;
    if(importing&&$('transcriptionFile').files[0])form.append('file',$('transcriptionFile').files[0]);
    if(!importing)form.append('kind',!$('panel-recording').hidden?'recording':'qwen');
    $('voiceEnhancementPreviewResult').hidden=true;
    const {jobId:id}=await request('/api/voice/enhancement/preview',{method:'POST',body:form});
    const job=await watch(id);
    if(job?.status==='done'&&job.result?.preview){
      $('voiceEnhancementBefore').src='/api/voice/jobs/'+id+'/audio?variant=original';
      $('voiceEnhancementAfter').src='/api/voice/jobs/'+id+'/audio';
      $('voiceEnhancementPreviewResult').hidden=false;
      status('Teste pronto! Compare Antes e Depois acima. Seus arquivos não foram alterados.',true);
    }
  });
  async function loadTakes(){
    const folder=root(),result=await request('/api/voice/takes?projectRoot='+encodeURIComponent(folder));
    if(folder!==$('transcriptionProjectRoot').value.trim())return;
    takeState={folder,...result};renderTakes();
    if(result.final&&$('voiceFinalDetails').hidden){
      $('voiceFinalDetails').hidden=false;$('voiceFinalDetails').open=false;
      $('voiceFinalAudio').src='/api/voice/final/audio?projectRoot='+encodeURIComponent(folder);
      $('voiceFinalSummary').textContent='Última narração final salva · '+Number(result.final.duration).toFixed(1)+'s · '+result.final.wordCount+' palavras.';
      $('voiceFinalTranscript').value=result.final.preview;
    }
  }
  function renderTakes(){
    for(const [kind,id] of [['recording','voiceRecordingTakes'],['qwen','voiceAiTakes']]){
      const container=$(id);container.replaceChildren();
      const items=(takeState?.takes||[]).filter(t=>t.kind===kind);
      if(!items.length){const empty=document.createElement('p');empty.className='helper-text';empty.textContent='Nenhuma tomada salva nesta pasta.';container.append(empty);}
      items.forEach((take,index)=>{
        const row=document.createElement('div');row.className='voice-take-row';
        const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=take.selected;check.disabled=polling;
        label.append(check,document.createTextNode('Tomada '+(index+1)+' · '+Number(take.duration||0).toFixed(1)+'s'));
        check.onchange=safe(async()=>{const all=takeState.takes.map(t=>({...t,selected:t.name===take.name?check.checked:t.selected}));await updateTakes(all);});
        const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src='/api/voice/takes/'+encodeURIComponent(take.name)+'/audio?projectRoot='+encodeURIComponent(takeState.folder);
        audio.setAttribute('aria-label','Ouvir tomada '+(index+1));row.append(label,audio);
        for(const [step,title] of [[-1,'Subir'],[1,'Descer']]){
          const button=document.createElement('button');button.type='button';button.className='btn btn-ghost btn-sm';button.textContent=title;button.disabled=polling||!items[index+step];
          button.onclick=safe(async()=>{const all=takeState.takes.map(t=>({...t})),a=all.findIndex(t=>t.name===take.name),b=all.findIndex(t=>t.name===items[index+step].name);[all[a],all[b]]=[all[b],all[a]];await updateTakes(all);});row.append(button);
        }
        const remove=document.createElement('button');remove.type='button';remove.className='btn btn-ghost btn-sm voice-take-delete';remove.textContent='Excluir';remove.disabled=polling;
        remove.setAttribute('aria-label','Excluir tomada '+(index+1));
        remove.onclick=safe(async()=>{
          const folder=takeState.folder,revision=takeState.revision;
          if(folder!==root())throw Error('Atualize as tomadas da pasta selecionada.');
          if(!window.confirm('Excluir a tomada '+(index+1)+' da lista? Ela não entrará na próxima finalização. O arquivo será guardado em audio/takes/.trash para recuperação. A narração final atual só muda quando você finalizar novamente.'))return;
          remove.disabled=true;
          try{
            const result=await request('/api/voice/takes/'+encodeURIComponent(take.name),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectRoot:folder,revision})});
            if(folder===$('transcriptionProjectRoot').value.trim()){
              takeState={folder,...result};renderTakes();status('Tomada excluída. Clique em Finalizar narração e transcrever para gerar o áudio com as restantes. Recuperação: '+result.recovery);
            }
          }catch(error){if(folder===$('transcriptionProjectRoot').value.trim())await loadTakes();throw error;}
          finally{remove.disabled=false;}
        });row.append(remove);
        container.append(row);
      });
      $(kind==='recording'?'voiceRecordFinalize':'voiceAiFinalize').disabled=polling||!items.some(t=>t.selected);
    }
  }
  async function updateTakes(takes){
    const folder=root();if(folder!==takeState?.folder)throw Error('Atualize as tomadas da pasta selecionada.');
    try{const result=await post('/api/voice/takes',{projectRoot:folder,takes,revision:takeState.revision});takeState={folder,...result};renderTakes();}
    catch(error){await loadTakes();throw error;}
  }
  async function finalize(kind){
    if(savingTake||unsavedTake||(recorder&&recorder.state!=='inactive'))throw Error('Finalize e salve a tomada antes de unir a narração.');
    const treatment=kind==='recording'?{
      enabled:$('voiceRecordTreatmentEnabled').checked!==false,
      enhancementEngine:$('voiceRecordAi').checked!==false?'deepfilter':'off',enhancementMode:$('voiceRecordAiMode').value||'strong',enhancementStrength:Number($('voiceRecordAiStrength').value||100),
      compression:$('voiceRecordCompression').checked!==false,deesser:$('voiceRecordDeesser').checked!==false,normalize:$('voiceRecordNormalize').checked!==false,
      reduceBreaths:$('voiceRecordReduceBreaths').checked!==false,breathReductionStrength:Number($('voiceRecordBreathStrength').value||60),
      targetLufs:Number($('voiceRecordLufs').value||-16),highpassHz:Number($('voiceRecordHighpass').value||70),trimEdges:$('voiceRecordTrim').checked!==false,removeMiddleSilence:$('voiceRecordMiddle').checked===true
    }:undefined;
    const result=await post('/api/voice/finalize',{projectRoot:root(),kind,treatment,transcription:automaticTranscription(),enhancement:{enhancementEngine:'off'}});await watch(result.jobId);
  }
  $('voiceRecordFinalize').onclick=safe(()=>finalize('recording'));
  $('voiceAiFinalize').onclick=safe(()=>finalize('qwen'));
  $('voiceFinalOpenFolder').onclick=safe(()=>post('/api/open-folder',{folder:root()}));
  $('transcriptionProjectRoot').addEventListener('change',safe(async()=>{$('voiceFinalDetails').hidden=true;await loadTakes();}));
  async function saveTake(folder){
    if(savingTake)throw Error('Aguarde o salvamento da tomada.');
    const file=recordedFile(),form=new FormData();form.append('projectRoot',folder);form.append('file',file);
    savingTake=true;$('voiceRecordStart').disabled=true;$('voiceRecordSave').disabled=true;
    try{const result=await request('/api/voice/recordings',{method:'POST',body:form});unsavedTake=false;
      if(folder===$('transcriptionProjectRoot').value.trim()){takeState={folder,takes:result.takes,revision:result.revision};renderTakes();}
      status('Tomada salva automaticamente. Grave a próxima ou clique em Finalizar narração e transcrever.');
    }finally{savingTake=false;$('voiceRecordStart').disabled=polling;$('voiceRecordSave').disabled=!unsavedTake;$('voiceRecordSave').hidden=!unsavedTake;}
  }
  $('voiceRecordSave').onclick=safe(()=>saveTake(recordingFolder||root()));
  $('voiceReferenceRecording').onclick=safe(async()=>{
    const transfer=new DataTransfer();transfer.items.add(recordedFile());$('voiceReferenceFile').files=transfer.files;status('Tomada selecionada como amostra. Informe a transcrição exata e salve o perfil.');
  });
  function renderProfiles(){
    const container=$('voiceProfilesList');if(!container)return;container.replaceChildren();
    const selected=$('voiceProfile').value;
    if(!savedProfiles.length){const empty=document.createElement('p');empty.className='voice-empty-state';empty.textContent='Nenhuma voz cadastrada. Adicione sua amostra no formulário ao lado.';container.append(empty);}
    for(const voice of savedProfiles){
      const card=document.createElement('article');card.className='voice-profile-card'+(voice.id===selected?' is-selected':'');
      const title=document.createElement('strong');title.textContent=voice.name;
      const detail=document.createElement('p');detail.className='helper-text';detail.textContent=Number(voice.seconds).toFixed(1)+' segundos de referência · armazenada localmente';
      const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src='/api/voice/profiles/'+encodeURIComponent(voice.id)+'/audio';audio.setAttribute('aria-label','Ouvir amostra de '+voice.name);
      const button=document.createElement('button');button.type='button';button.className='btn '+(voice.id===selected?'btn-primary':'btn-secondary')+' btn-sm';button.textContent=voice.id===selected?'Voz selecionada':'Usar esta voz';button.setAttribute('aria-pressed',String(voice.id===selected));
      button.onclick=()=>{$('voiceProfile').value=voice.id;window.localStorage?.setItem('contentlab.voice.profile',voice.id);renderProfiles();$('voiceProfileFeedback').textContent='Voz selecionada: '+voice.name;};
      card.append(title,detail,audio,button);container.append(card);
    }
    const chosen=savedProfiles.find(v=>v.id===selected);$('voiceProfileHint').textContent=chosen?'Voz selecionada: '+chosen.name:'Cadastre uma voz em Configurações para começar.';
  }
  async function refresh(){
    if(refreshing)return;refreshing=true;
    try{
      const list=await request('/api/voice/profiles'),selected=$('voiceProfile').value||window.localStorage?.getItem('contentlab.voice.profile');
      $('voiceProfile').replaceChildren(new Option('Selecione uma voz',''));
      for(const voice of list.profiles)$('voiceProfile').add(new Option(`${voice.name} · ${voice.seconds.toFixed(1)}s`,voice.id));
      if([...$('voiceProfile').options].some(o=>o.value===selected))$('voiceProfile').value=selected;else if(list.profiles.length)$('voiceProfile').value=list.profiles[0].id;
      savedProfiles=list.profiles;renderProfiles();
      const state=await request('/api/voice/state');
      $('voiceRuntimeStatus').textContent=`Qwen: ${state.runtimeReady?'pronto':'será preparado automaticamente'}. Chatterbox: ${state.engines?.chatterbox?.runtimeReady?'pronto':'será preparado automaticamente'}. Gerar baixa o modelo escolhido se necessário. Os botões abaixo permitem antecipar ou reparar.`;
      for(const id of ['voiceAiModel','voiceModelInstallSelect'])for(const model of state.models){const option=[...$(id).options].find(o=>o.value===model.id);if(option)option.textContent=`${model.label||'Qwen '+model.id}${model.installed?' · baixado':''}`;}
      if(state.busyJobId&&!polling)watch(state.busyJobId).catch(e=>status(e.message));
    }finally{refreshing=false;}
  }
  function busy(value){for(const id of ['voiceRuntimeSetup','voiceModelDownload','voiceAiGenerate'])$(id).disabled=value;$('voiceJobCancel').disabled=!value;$('voiceCommonCancel').disabled=!value;$('voiceCommonCancel').hidden=!value;$('voiceRecordStart').disabled=!!(value||savingTake||(recorder&&recorder.state!=='inactive'));renderTakes();}
  async function watch(id){
    if(polling)return;const requestedFolder=$('transcriptionProjectRoot').value.trim();let completed=false;
    polling=true;jobId=id;busy(true);enhancementControls();
    $('voiceRecordFinalize').textContent='Finalizando e transcrevendo…';
    try{
      while(true){
        const job=await request('/api/voice/jobs/'+id);status(job.error||job.message);
        if(job.status!=='running'){
          if(job.status==='done'&&job.result?.relative){
            completed=true;
            if(requestedFolder===$('transcriptionProjectRoot').value.trim()){
              await useAudio(id,job.result);status('Concluído! '+(job.result.treatment?.applied?'Gravação tratada. ':'')+'Narração e transcrição salvas. Ouça o resultado no bloco “Narração e transcrição prontas”. Tomadas originais em audio/takes/; áudio final em audio/narration.wav.',true);
            }else status('Narração e transcrição prontas em '+job.result.projectRoot+'. Selecione essa pasta para revisar.');
          }
          if(job.result?.preview)completed=true;
          return job;
        }
        await new Promise(resolve=>setTimeout(resolve,1200));
      }
    }finally{
      polling=false;busy(false);enhancementControls();$('voiceRecordFinalize').textContent='Finalizar narração e transcrever';
      // Optional model discovery must never delay or replace a successful recording result.
      if(!completed)await refresh().catch(()=>{});
      if($('transcriptionProjectRoot').value.trim())await loadTakes().catch(()=>{});
    }
  }
  $('voiceRuntimeSetup').onclick=safe(async()=>{await watch((await post('/api/voice/runtime',{engine:$('voiceModelInstallSelect').value===expressiveModel?'chatterbox':'qwen'})).jobId);});
  $('voiceModelDownload').onclick=safe(async()=>{await watch((await post('/api/voice/models/download',{model:$('voiceModelInstallSelect').value})).jobId);});
  $('voiceStateRefresh').onclick=safe(refresh);
  $('voiceCommonCancel').onclick=safe(async()=>{if(jobId)await post('/api/voice/jobs/'+jobId+'/cancel',{});});
  $('voiceProfile').addEventListener('change',()=>{window.localStorage?.setItem('contentlab.voice.profile',$('voiceProfile').value);renderProfiles();});
  $('voiceJobCancel').onclick=safe(async()=>{await post('/api/voice/jobs/'+jobId+'/cancel',{});status('Cancelando...');});
  $('voiceProfileSave').onclick=safe(async()=>{
    const file=$('voiceReferenceFile').files[0];if(!file)throw Error('Selecione ou grave uma amostra de 3 a 60 segundos.');
    const form=new FormData();form.append('file',file);form.append('name',$('voiceProfileName').value);form.append('referenceText',$('voiceReferenceText').value);form.append('consent',String($('voiceConsent').checked));
    $('voiceProfileSave').disabled=true;
    try{const voice=await request('/api/voice/profiles',{method:'POST',body:form});await refresh();$('voiceProfile').value=voice.id;window.localStorage?.setItem('contentlab.voice.profile',voice.id);renderProfiles();$('voiceProfileFeedback').textContent='Voz cadastrada e selecionada: '+voice.name;status('Perfil salvo somente neste computador.');}
    catch(error){$('voiceProfileFeedback').textContent=error.message;throw error;}
    finally{$('voiceProfileSave').disabled=false;}
  });
  $('voiceAiGenerate').onclick=safe(async()=>{
    if(!$('voiceProfile').value)throw Error('Selecione um perfil de voz.');
    const body={projectRoot:root(),append:$('voiceAiAppend').checked,transcription:automaticTranscription(),enhancement:{enhancementEngine:'off'},model:$('voiceAiModel').value,profileId:$('voiceProfile').value,text:$('voiceAiText').value,
      language:$('voiceAiLanguage').value,device:$('voiceAiDevice').value,
      temperature:Number($('voiceTemperature').value),topP:Number($('voiceTopP').value),
      repetitionPenalty:Number($('voiceRepetition').value),pauseSeconds:Number($('voiceParagraphPause').value),seed:$('voiceSeed').value,
      ...($('voiceAiModel').value===expressiveModel?{exaggeration:Number($('voiceExaggeration').value),cfgWeight:Number($('voiceCfgWeight').value)}:{})};
    await watch((await post('/api/voice/generate',body)).jobId);
  });
  window.addEventListener('beforeunload',event=>{
    if(unsavedTake||(recorder&&recorder.state!=='inactive')){event.preventDefault();event.returnValue='';}
    else release();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&recorder?.state==='recording')status('Gravação continua ativa. Volte aqui para finalizar.');});
  function workspaceEntered(name){
    if(['recording','voiceai'].includes(name))$('panel-'+name).append($('voiceCaptureTools'));
    if(['voiceai','voice-settings'].includes(name))refresh().catch(error=>status(error.message));
    if(['recording','voiceai'].includes(name)&&$('transcriptionProjectRoot').value.trim())loadTakes().catch(error=>status(error.message));
  }
  $('voiceTreatmentRecipe').onchange=()=>{
    const recipe=$('voiceTreatmentRecipe').value;if(recipe==='custom')return;
    const strong=recipe==='strong',preserve=recipe==='preserve';
    $('transcriptionTrimEdges').checked=true;$('transcriptionRemoveMiddle').checked=!preserve;
    $('transcriptionMinSilence').value='0.7';$('transcriptionThreshold').value='-42';
    $('transcriptionNormalize').checked=true;$('transcriptionTargetLufs').value='-16';$('transcriptionHighpass').value='70';
    $('transcriptionCompression').checked=!preserve;$('transcriptionDeesser').checked=strong;$('transcriptionVoicePreset').value='original';
    $('transcriptionReduceBreaths').checked=!preserve;$('transcriptionBreathStrength').value='60';
    $('voiceEnhancementEngine').value=strong?'deepfilter':'off';$('voiceEnhancementMode').value=strong?'strong':'natural';$('voiceEnhancementStrength').value=strong?'100':'80';enhancementControls();
  };
  for(const id of ['transcriptionReduceBreaths','transcriptionBreathStrength','transcriptionTrimEdges','transcriptionRemoveMiddle','transcriptionMinSilence','transcriptionThreshold','transcriptionNormalize','transcriptionTargetLufs','transcriptionHighpass','transcriptionCompression','transcriptionDeesser','transcriptionVoicePreset','voiceEnhancementEngine','voiceEnhancementMode','voiceEnhancementStrength'])$(id).addEventListener('change',()=>{$('voiceTreatmentRecipe').value='custom';});
  window.addEventListener('workspacechange',event=>workspaceEntered(event.detail.name));
  window.addEventListener('projectwillchange',event=>{if(savingTake||unsavedTake||(recorder&&recorder.state!=='inactive')){event.preventDefault();status('Finalize e salve a tomada antes de trocar ou recarregar o projeto.');}});
  window.addEventListener('projectchanged',()=>{takeState=null;$('voiceFinalDetails').hidden=true;renderTakes();loadTakes().catch(error=>status(error.message));});
  $('voiceRecordSave').hidden=true;$('voiceCommonCancel').hidden=true;renderTakes();enhancementControls();
  workspaceEntered(window.location?.hash?.slice(1));
})();
