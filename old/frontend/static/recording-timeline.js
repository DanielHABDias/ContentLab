/* PCM edits are sample-accurate; MediaRecorder is stopped at each pause so
   each decoded segment is a complete container, never a partial WebM chunk. */
((global)=>{
  const cut=(samples,start,end)=>{
    const a=Math.max(0,Math.min(samples.length,Math.round(start))),b=Math.max(a,Math.min(samples.length,Math.round(end)));
    const out=new Float32Array(samples.length-(b-a));out.set(samples.subarray(0,a));out.set(samples.subarray(b),a);return out;
  };
  const join=(a,b)=>{const out=new Float32Array(a.length+b.length);out.set(a);out.set(b,a.length);return out;};
  // A fixed time resolution keeps waveform detail when zooming into long takes.
  function envelope(samples,block=128){const low=new Float32Array(Math.ceil(samples.length/block)),high=new Float32Array(low.length);for(let n=0;n<low.length;n++){let min=1,max=-1;const end=Math.min(samples.length,(n+1)*block);for(let i=n*block;i<end;i++){const x=samples[i];if(x<min)min=x;if(x>max)max=x;}low[n]=min;high[n]=max;}return {low,high,block};}
  const sampleAt=(x,left,scroll,pps,rate,length)=>Math.max(0,Math.min(length,Math.round((x-left+scroll)/pps*rate)));
  function wav(samples,rate){
    const bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes);
    const str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
    str(0,'RIFF');v.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);
    samples.forEach((x,i)=>{x=Math.max(-1,Math.min(1,x));v.setInt16(44+i*2,x<0?Math.round(x*32768):Math.round(x*32767),true);});return bytes;
  }
  if(typeof module!=='undefined')module.exports={cut,join,wav,envelope,sampleAt};
  global.RecordingTimeline={cut,join,wav,envelope,sampleAt,attach};
  function attach({onStart,onDirty,onState,onSave,status}){
    const $=id=>document.getElementById(id),rate=48000;
    let samples=new Float32Array(),undo=[],selection=null,drag=null,media=null,stream=null,ctx=null,source=null,analyser=null,raf=null,timer=null;
    let state='inactive',locked=false,started=0,chunks=[],live=[],decoderError=null,epoch=0,cachedSamples=null,peaks={low:[],high:[],block:128},cursor=0,playRaf=null;
    const panel=document.createElement('section');panel.className='recording-timeline';panel.hidden=true;
    panel.innerHTML='<header class="rt-heading"><div><strong>Tomada em edição</strong><small>MONO · 48 kHz</small></div><span data-state>Pausado</span></header><div class="rt-scroll" tabindex="0" aria-label="Linha do tempo com rolagem horizontal"><div class="rt-track"><canvas tabindex="0" aria-label="Forma de onda. Clique para posicionar; arraste para selecionar um trecho."></canvas></div></div><footer class="rt-toolbar"><div class="rt-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="listen" title="Ouvir a partir do cursor ou somente a seleção">▶ Ouvir</button><button type="button" class="btn btn-ghost btn-sm" data-action="undo" title="Desfazer corte (Ctrl/Cmd+Z)">↶ Desfazer</button><button type="button" class="btn btn-ghost btn-sm" data-action="delete" hidden>Apagar seleção</button></div><span role="status" aria-live="polite" data-info></span><label class="rt-zoom">− <input data-zoom type="range" min="24" max="320" value="80" aria-label="Zoom da linha do tempo"> +</label></footer><p class="rt-hint">Espaço pausa/continua · Arraste para selecionar · Delete apaga · Ctrl/Cmd+Z desfaz</p>';
    $('voiceRecordStop').closest('.row').after(panel);
    const zoom=panel.querySelector('[data-zoom]'),viewport=panel.querySelector('.rt-scroll'),track=panel.querySelector('.rt-track'),badge=panel.querySelector('[data-state]');
    const pps=()=>Math.max(24,Math.min(320,Number(zoom.value)||80));let previousPps=pps();
    zoom.oninput=()=>{const time=(viewport.scrollLeft+(viewport.clientWidth||900)/2)/previousPps;previousPps=pps();draw();viewport.scrollLeft=Math.max(0,time*pps()-(viewport.clientWidth||900)/2);draw();};viewport.onscroll=()=>draw();
    const recovery=document.createElement('button');recovery.type='button';recovery.className='btn btn-secondary';recovery.textContent='Tentar ler trecho capturado novamente';recovery.hidden=true;panel.append(recovery);
    const canvas=panel.querySelector('canvas'),info=panel.querySelector('[data-info]'),button=n=>panel.querySelector('[data-action="'+n+'"]');
    const css=document.createElement('style');css.textContent='.recording-timeline{margin:18px 0;border:1px solid #dce3e5;border-radius:14px;background:#fff;min-width:0;overflow:hidden}.rt-heading{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #e9edef}.rt-heading strong{font-size:14px;font-weight:600}.rt-heading small{font-size:10px;color:#7e8c91;letter-spacing:.1em;margin-left:14px}.rt-heading [data-state]{font-size:12px;color:#6d7d84}.rt-heading [data-state].is-recording{color:#b23d4e}.rt-scroll{overflow-x:auto;overflow-y:hidden;scrollbar-width:auto;scrollbar-color:#aab8bd #f1f4f5;overscroll-behavior-x:contain}.rt-track{height:210px;position:relative}.recording-timeline canvas{display:block;position:sticky;left:0;height:210px;background:#fafcfc;touch-action:none;cursor:crosshair;outline-offset:-2px}.rt-toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:9px 12px}.rt-actions{display:flex;gap:3px;align-items:center}.rt-actions button{font-size:12px;min-height:32px}.rt-zoom{display:flex!important;align-items:center;gap:8px;color:#8a999f;font-size:15px;margin:0!important}.rt-zoom input{width:96px!important;min-height:0!important;padding:0!important;accent-color:#667f89}.recording-timeline [data-info]{font:12px ui-monospace,monospace;color:#63777f}.rt-hint{font-size:11px;color:#809096;margin:0;padding:0 16px 12px}.recording-timeline [hidden]{display:none!important}@media(max-width:600px){.rt-heading small{display:none}.rt-hint{line-height:1.6}.rt-toolbar{gap:8px}}';document.head.append(css);
    function controls(){
      onState(state);$('voiceRecordStart').disabled=locked;$('voiceRecordStart').textContent=locked?'Aguarde…':state==='recording'?'Pausar':samples.length||state==='paused'?'Continuar':'Gravar';
      $('voiceRecordPause').hidden=true;$('voiceRecordStop').textContent='Salvar clipe';
      $('voiceRecordPause').disabled=locked||state==='inactive';$('voiceRecordPause').textContent=state==='paused'?'Continuar':'Pausar';
      $('voiceRecordStop').disabled=locked||(!samples.length&&state!=='recording');
      for(const action of ['listen','delete'])button(action).disabled=locked||state==='recording'||!samples.length;
      button('undo').disabled=locked||state==='recording'||!undo.length;
      button('delete').hidden=!selection||selection[1]<=selection[0];
      badge.textContent=locked?'Processando…':state==='recording'?'● Gravando':samples.length?'Pausado':'Pronto para gravar';badge.className=state==='recording'?'is-recording':'';
    }
    function draw(){
      if(cachedSamples!==samples){peaks=envelope(samples);cachedSamples=samples;}
      const w=Math.max(240,Math.round(viewport.clientWidth||900)),h=210,dpr=global.devicePixelRatio||1;canvas.style.width=w+'px';canvas.width=w*dpr;canvas.height=h*dpr;
      const c=canvas.getContext('2d');c.scale(dpr,dpr);c.fillStyle='#fafcfc';c.fillRect(0,0,w,h);
      const liveCount=state==='recording'?Math.max(0,Math.round((performance.now()-started)/1000*rate)):0,total=Math.max(1,samples.length+liveCount);
      const duration=total/rate,width=Math.max(w,Math.ceil((duration+2)*pps()));track.style.width=width+'px';
      if(state==='recording'&&duration*pps()>viewport.scrollLeft+w-50)viewport.scrollLeft=Math.max(0,duration*pps()-w+80);
      const left=viewport.scrollLeft||0,offset=left/pps();c.fillStyle='#edf4f2';c.fillRect(-left,31,duration*pps(),164);
      const step=[.1,.25,.5,1,2,5,10,30,60].find(s=>s*pps()>=65)||60;
      c.font='10px ui-monospace,monospace';c.textBaseline='alphabetic';
      for(let t=Math.ceil(offset/step)*step;t<=offset+w/pps();t+=step){const x=t*pps()-left;c.strokeStyle='#e0e7e7';c.beginPath();c.moveTo(x,25);c.lineTo(x,h);c.stroke();c.fillStyle='#829197';c.fillText(`${Math.floor(t/60)}:${(t%60).toFixed(step<1?1:0).padStart(2,'0')}`,x+4,18);}
      const mid=112,amp=70;c.strokeStyle='#4d8178';c.lineWidth=1;
      for(let x=0;x<w;x++){const from=Math.floor((offset+x/pps())*rate),to=Math.min(samples.length,Math.ceil((offset+(x+1)/pps())*rate));let min=0,max=0;
        for(let i=Math.floor(from/peaks.block);i<Math.ceil(to/peaks.block);i++){min=Math.min(min,peaks.low[i]||0);max=Math.max(max,peaks.high[i]||0);}
        if(from>=samples.length&&live.length){const t=(from-samples.length)/rate;const item=live[Math.min(live.length-1,Math.floor(t/Math.max(.001,liveCount/rate)*live.length))];min=item?.min||0;max=item?.max||0;}
        c.beginPath();c.moveTo(x,mid-max*amp);c.lineTo(x,mid-min*amp);c.stroke();}
      c.strokeStyle='#b9cdc7';c.beginPath();c.moveTo(0,mid);c.lineTo(Math.min(w,duration*pps()-left),mid);c.stroke();
      if(selection){c.fillStyle='rgba(79,135,183,.19)';c.fillRect(selection[0]/rate*pps()-left,28,(selection[1]-selection[0])/rate*pps(),h-28);}
      const head=(state==='recording'?duration:cursor)*pps()-left;c.strokeStyle=state==='recording'?'#c14d5e':'#637e8a';c.beginPath();c.moveTo(head,25);c.lineTo(head,h);c.stroke();
      info.textContent=selection?`Selecionado: ${(selection[0]/rate).toFixed(2)}–${(selection[1]/rate).toFixed(2)} s`:`Clipe: ${(samples.length/rate).toFixed(2)} s`;
      $('voiceRecordTime').textContent=new Date((samples.length+liveCount)/rate*1000).toISOString().slice(11,19);
    }
    function stopPlayback(){cancelAnimationFrame(playRaf);if(source){source.onended=null;try{source.stop();}catch{}source=null;}button('listen').textContent='▶ Ouvir';}
    function release(){cancelAnimationFrame(raf);clearInterval(timer);stream?.getTracks().forEach(t=>t.stop());stream=null;analyser=null;$('voiceLevel').value=0;}
    async function context(){if(!ctx||ctx.state==='closed')ctx=new AudioContext({sampleRate:rate});await ctx.resume();return ctx;}
    async function start(){
      if(locked||state==='recording')return;
      if(samples.length/rate>=1200)throw Error('Feche este clipe de 20 minutos e comece o próximo.');
      if(!navigator.mediaDevices?.getUserMedia||!global.MediaRecorder)throw Error('Gravação indisponível neste navegador. Abra o Content Lab em localhost com acesso ao microfone.');
      if(decoderError)throw Error('Use Tentar ler trecho capturado novamente antes de continuar. Não feche a página.');
      locked=true;controls();stopPlayback();
      try{if(!samples.length&&state==='inactive')await onStart();
        const audio=await context(),deviceId=$('voiceMicrophone').value;
        stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:deviceId?{exact:deviceId}:undefined,sampleRate:{ideal:rate},channelCount:{ideal:1},echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
        const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
        media=new MediaRecorder(stream,mime?{mimeType:mime}:{});chunks=[];live=[];decoderError=null;
        media.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        media.onerror=()=>{decoderError=Error('Falha na captura. Pause para recuperar o áudio disponível.');status(decoderError.message);};
        analyser=audio.createAnalyser();analyser.fftSize=1024;audio.createMediaStreamSource(stream).connect(analyser);
        media.start(1000);started=performance.now();state='recording';selection=null;panel.hidden=false;onDirty(true);
        const values=new Float32Array(analyser.fftSize);
        const meter=()=>{if(state!=='recording'||!analyser)return;analyser.getFloatTimeDomainData(values);const min=values.reduce((p,x)=>Math.min(p,x),0),max=values.reduce((p,x)=>Math.max(p,x),0);live.push({min,max});$('voiceLevel').value=Math.max(-min,max);raf=requestAnimationFrame(meter);};meter();
        timer=setInterval(()=>{draw();if(samples.length/rate+(performance.now()-started)/1000>=1200)pause().then(()=>status('Limite de 20 minutos deste clipe. Feche a tomada e inicie a próxima.')).catch(e=>status(e.message));},200);
        status('Gravando neste clipe. Espaço para pausar e corrigir.');
      }catch(error){release();state=samples.length?'paused':'inactive';throw error;}
      finally{locked=false;controls();}
    }
    async function pause(){
      if(locked||(state!=='recording'&&!decoderError))return;
      locked=true;controls();state='paused';
      try{if(media.state!=='inactive')await new Promise((resolve,reject)=>{media.onstop=resolve;try{media.stop();}catch(e){reject(e);}});release();
        const blob=new Blob(chunks,{type:media.mimeType});if(!blob.size)throw decoderError||Error('Não houve áudio neste trecho.');
        const audio=await context(),buffer=await audio.decodeAudioData(await blob.arrayBuffer());
        // AudioContext resamples to 48 kHz; downmix every channel to mono.
        const mono=new Float32Array(buffer.length);for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<mono.length;i++)mono[i]+=data[i]/buffer.numberOfChannels;}
        samples=join(samples,mono);cursor=samples.length/rate;undo=[];chunks=[];decoderError=null;recovery.hidden=true;draw();status('Pausado. Arraste na onda para selecionar o erro; Delete apaga.');
      }catch(error){release();decoderError=error;recovery.hidden=false;status('Trecho capturado preservado na memória, mas não decodificado: '+error.message+' Use Tentar ler trecho capturado novamente. Não feche a página.');throw error;}
      finally{locked=false;controls();}
    }
    recovery.onclick=()=>pause().catch(e=>status(e.message));
    async function finish(){
      if(locked)return;if(state==='recording')await pause();if(decoderError)throw decoderError;if(!samples.length)throw Error('O clipe está vazio. Grave antes de fechar.');
      locked=true;controls();stopPlayback();
      try{await onSave(new Blob([wav(samples,rate)],{type:'audio/wav'}));samples=new Float32Array();cursor=0;viewport.scrollLeft=0;undo=[];selection=null;state='inactive';epoch++;onDirty(false);draw();status('Clipe salvo. Clique em Gravar para começar o próximo.',true);}
      finally{locked=false;controls();}
    }
    function remove(){if(locked||state==='recording'||!selection)return;stopPlayback();if(selection[1]<=selection[0])return;
      undo.push({samples,selection:[...selection]});while(undo.length>1&&(undo.length>10||undo.reduce((n,x)=>n+x.samples.byteLength,0)>192*1024*1024))undo.shift();cursor=selection[0]/rate;samples=cut(samples,...selection);selection=null;onDirty(true);draw();controls();status('Trecho apagado. Continuar grava no fim do clipe.');}
    function restore(){if(locked||state==='recording'||!undo.length)return;stopPlayback();const old=undo.pop();samples=old.samples;selection=old.selection;onDirty(true);draw();controls();}
    button('delete').onclick=remove;button('undo').onclick=restore;
    button('listen').onclick=async()=>{try{if(locked||state==='recording'||!samples.length)return;if(source){stopPlayback();return;}const token=epoch,audio=await context();if(token!==epoch||state==='recording')return;
      const [a,b]=selection||[cursor>=samples.length/rate?0:Math.round(cursor*rate),samples.length];if(b<=a)return;const buffer=audio.createBuffer(1,b-a,rate);buffer.copyToChannel(samples.subarray(a,b),0);source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);source.start();button('listen').textContent='■ Parar';const began=audio.currentTime;source.onended=()=>{cursor=b/rate;stopPlayback();draw();};const animate=()=>{if(!source)return;cursor=Math.min(b/rate,a/rate+audio.currentTime-began);draw();playRaf=requestAnimationFrame(animate);};animate();
    }catch(e){status(e.message);}};
    const point=e=>sampleAt(e.clientX,canvas.getBoundingClientRect().left,viewport.scrollLeft||0,pps(),rate,samples.length);
    canvas.onpointerdown=e=>{if(locked||state==='recording'||!samples.length)return;e.preventDefault();stopPlayback();canvas.focus();canvas.setPointerCapture(e.pointerId);drag=point(e);selection=[drag,drag];draw();};
    canvas.onpointermove=e=>{if(drag===null)return;const p=point(e);selection=[Math.min(drag,p),Math.max(drag,p)];draw();};
    canvas.onpointerup=canvas.onpointercancel=()=>{if(selection){cursor=selection[0]/rate;if(selection[1]===selection[0])selection=null;}drag=null;draw();controls();};
    document.addEventListener('keydown',e=>{
      if($('panel-recording').hidden||e.defaultPrevented||e.repeat||e.isComposing||e.target.closest('input,textarea,select,button,a,[contenteditable="true"]'))return;
      if(e.code==='Space'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();(state==='recording'?pause():start()).catch(err=>status(err.message));}
      else if(['Delete','Backspace'].includes(e.key)&&selection){e.preventDefault();remove();}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore();}
    });
    css.textContent+='.rt-scroll::-webkit-scrollbar{height:12px;display:block}.rt-scroll::-webkit-scrollbar-track{background:#eef2f3}.rt-scroll::-webkit-scrollbar-thumb{background:#b3c0c3;border:3px solid #eef2f3;border-radius:8px}';
    window.addEventListener('resize',draw);
    window.addEventListener('workspacechange',()=>{stopPlayback();requestAnimationFrame(draw);});
    if(global.ResizeObserver)new global.ResizeObserver(()=>draw()).observe(viewport);
    panel.hidden=false;controls();draw();
    return {start,pause,finish,get state(){return state;}};
  }
})(typeof window==='undefined'?globalThis:window);
