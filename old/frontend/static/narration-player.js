/* Real waveform player. Existing <audio> IDs/events remain the playback source. */
(()=>{
  const scope='#panel-recording audio,#panel-voiceai audio,#panel-transcription audio,#panel-voice-settings audio,#voiceCaptureTools audio';
  const players=new Map();
  const icons={play:'<path d="m9 5 10 7-10 7Z"/>',pause:'<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>',volume:'<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 8c3 2 3 6 0 8" fill="none" stroke="currentColor" stroke-width="1.8"/>',mute:'<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="1.8"/>'};
  const icon=name=>'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">'+icons[name]+'</svg>';
  const time=n=>{n=Number.isFinite(n)?Math.max(0,n):0;const seconds=Math.floor(n);return (seconds>=3600?Math.floor(seconds/3600)+':':'')+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');};
  const node=(tag,className,text)=>{const element=document.createElement(tag);element.className=className;if(text)element.textContent=text;return element;};
  const button=(label,className,html)=>{const el=node('button',className);el.type='button';el.setAttribute('aria-label',label);el.title=label;if(html)el.innerHTML=html;return el;};
  function enhance(audio){
    if(players.has(audio))return;
    const wrapper=node('div','audio-wave-player'),play=button('Reproduzir áudio','audio-wave-play',icon('play'));
    wrapper.setAttribute('role','group');wrapper.setAttribute('aria-label',audio.getAttribute('aria-label')||'Player de áudio');
    const body=node('div','audio-wave-body'),canvas=node('canvas','audio-wave-canvas'),info=node('div','audio-wave-info');
    canvas.setAttribute('role','slider');canvas.setAttribute('aria-label','Posição no áudio');canvas.setAttribute('aria-valuemin','0');canvas.tabIndex=0;
    const clock=node('span','audio-wave-clock','00:00 / 00:00'),state=node('span','audio-wave-state','Carregando forma de onda…');state.setAttribute('role','status');
    info.append(clock,state);body.append(canvas,info);
    const tools=node('div','audio-wave-tools'),speed=button('Alterar velocidade de reprodução','audio-wave-speed'),mute=button('Silenciar áudio','audio-wave-mute',icon('volume'));
    speed.textContent='1×';const volume=node('input','audio-wave-volume');volume.type='range';volume.min='0';volume.max='1';volume.step='0.05';volume.value=String(audio.volume);volume.setAttribute('aria-label','Volume do áudio');
    tools.append(speed,mute,volume);wrapper.append(play,body,tools);
    const player={wrapper,source:'',peaks:null,duration:0,controller:null,raf:null,visible:false,loaded:false};players.set(audio,player);
    audio.before(wrapper);wrapper.append(audio);audio.controls=false;audio.classList.add('audio-wave-source');
    function duration(){return Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:player.duration;}
    function draw(){
      if(wrapper.hidden)return;
      const rect=canvas.getBoundingClientRect();if(rect.width<=0)return;
      const ratio=window.devicePixelRatio||1,w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      const ctx=canvas.getContext('2d');if(!ctx)return;
      ctx.clearRect(0,0,w,h);const progress=duration()?Math.min(1,audio.currentTime/duration()):0;
      const bars=Math.max(1,Math.floor(rect.width/4)),values=player.peaks;
      if(values?.length){
        const maximum=Math.max(.02,...values),step=w/bars;
        for(let i=0;i<bars;i++){
          const a=Math.floor(i/bars*values.length),b=Math.max(a+1,Math.floor((i+1)/bars*values.length));let peak=0;
          for(let n=a;n<b;n++)peak=Math.max(peak,values[n]||0);
          const height=Math.max(2*ratio,Math.min(h*.88,Math.pow(peak/maximum,.7)*h*.88));
          ctx.fillStyle=i/bars<progress?'#426e66':'#b9c5c1';ctx.fillRect(i*step,(h-height)/2,Math.max(ratio,step-2*ratio),height);
        }
      }else{ctx.fillStyle='#d6dedb';ctx.fillRect(0,h/2,w,ratio);}
      if(progress>0){ctx.fillStyle='#263f39';ctx.fillRect(progress*(w-ratio),2*ratio,ratio,h-4*ratio);}
      const clockText=time(audio.currentTime)+' / '+time(duration());if(clock.textContent!==clockText)clock.textContent=clockText;canvas.setAttribute('aria-valuemax',String(duration()||0));canvas.setAttribute('aria-valuenow',String(audio.currentTime||0));canvas.setAttribute('aria-valuetext',time(audio.currentTime)+' de '+time(duration()));
    }
    function tick(){draw();if(!audio.paused&&!audio.ended)player.raf=requestAnimationFrame(tick);}
    function sync(){
      const playing=!audio.paused&&!audio.ended,playIcon=playing?'pause':'play',muteIcon=audio.muted||audio.volume===0?'mute':'volume';
      if(play.dataset.icon!==playIcon){play.innerHTML=icon(playIcon);play.dataset.icon=playIcon;}play.setAttribute('aria-label',playing?'Pausar áudio':'Reproduzir áudio');play.title=playing?'Pausar áudio':'Reproduzir áudio';
      play.disabled=!audio.getAttribute('src');if(mute.dataset.icon!==muteIcon){mute.innerHTML=icon(muteIcon);mute.dataset.icon=muteIcon;}mute.setAttribute('aria-label',audio.muted?'Ativar som':'Silenciar áudio');mute.title=audio.muted?'Ativar som':'Silenciar áudio';volume.value=String(audio.muted?0:audio.volume);
      if(speed.textContent!==audio.playbackRate+'×')speed.textContent=audio.playbackRate+'×';draw();
    }
    async function load(){
      const source=audio.getAttribute('src');if(!source||player.loaded||!player.visible||wrapper.hidden)return;
      player.loaded=true;const controller=new AbortController();player.controller=controller;let context=null;
      state.textContent='Analisando áudio…';
      try{
        let data;
        if(source.startsWith('blob:')){
          const response=await fetch(source,{signal:controller.signal}),blob=await response.blob();
          if(blob.size>48*1024*1024)throw Error('Tomada grande: ouça a versão salva para visualizar a onda.');
          context=new AudioContext();const decoded=await context.decodeAudioData(await blob.arrayBuffer());
          const peaks=new Array(640).fill(0),step=Math.max(1,Math.ceil(decoded.length/640));
          for(let channel=0;channel<decoded.numberOfChannels;channel++){const samples=decoded.getChannelData(channel);for(let i=0;i<samples.length;i++)peaks[Math.min(639,Math.floor(i/step))]=Math.max(peaks[Math.min(639,Math.floor(i/step))],Math.abs(samples[i]));}
          data={peaks,duration:decoded.duration};
        }else{
          const url=new URL(source,location.href);
          if(url.origin!==location.origin||!/^\/api\/(voice|transcription)\//.test(url.pathname))throw Error('Fonte não suportada para forma de onda.');
          url.searchParams.set('waveform','1');const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Forma de onda indisponível.');data=await response.json();
        }
        if(controller.signal.aborted||player.source!==source)return;
        if(!Array.isArray(data.peaks)||!data.peaks.length||data.peaks.length>2000||data.peaks.some(n=>!Number.isFinite(n)||n<0||n>1))throw Error('Forma de onda inválida.');
        player.peaks=data.peaks;player.duration=data.duration;state.textContent='';sync();
      }catch(error){if(!controller.signal.aborted){state.textContent='Onda indisponível · reprodução disponível';draw();}}
      finally{if(context){await context.close().catch(()=>{});context=null;}}
    }
    function sourceChanged(){
      const source=audio.getAttribute('src')||'',hidden=audio.hidden||!source;if(wrapper.hidden!==hidden)wrapper.hidden=hidden;
      if(source!==player.source){player.controller?.abort();player.source=source;player.peaks=null;player.duration=0;player.loaded=false;state.textContent='Carregando forma de onda…';}
      sync();load();
    }
    player.sync=sourceChanged;player.dispose=()=>{audio.pause();player.controller?.abort();cancelAnimationFrame(player.raf);intersection?.unobserve(wrapper);resize?.disconnect();};
    play.onclick=async()=>{
      if(audio.paused){for(const other of players.keys())if(other!==audio)other.pause();try{await audio.play();}catch{state.textContent='Não foi possível reproduzir este áudio.';}}
      else audio.pause();sync();
    };
    const seek=fraction=>{if(duration()>0){audio.currentTime=Math.min(duration(),Math.max(0,fraction*duration()));draw();}};
    canvas.onpointerdown=event=>{const rect=canvas.getBoundingClientRect();seek((event.clientX-rect.left)/rect.width);};
    canvas.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End',' '].includes(event.key)){event.preventDefault();if(event.key===' ')play.click();else seek(event.key==='Home'?0:event.key==='End'?1:(audio.currentTime+(event.key==='ArrowRight'?5:-5))/(duration()||1));}};
    mute.onclick=()=>{audio.muted=!audio.muted;sync();};volume.oninput=()=>{audio.volume=Number(volume.value);audio.muted=false;sync();};
    speed.onclick=()=>{const rates=[1,1.25,1.5,2];audio.playbackRate=rates[(rates.indexOf(audio.playbackRate)+1)%rates.length];sync();};
    for(const name of ['loadedmetadata','durationchange','timeupdate','pause','ended','volumechange','ratechange','emptied'])audio.addEventListener(name,sync);
    audio.addEventListener('play',()=>{cancelAnimationFrame(player.raf);sync();tick();});audio.addEventListener('error',()=>{state.textContent='Áudio indisponível. Verifique o arquivo.';});
    const resize=typeof ResizeObserver!=='undefined'?new ResizeObserver(draw):null;resize?.observe(canvas);
    const intersection=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{for(const entry of entries){player.visible=entry.isIntersecting;if(player.visible){draw();load();}}}):null;
    if(intersection)intersection.observe(wrapper);else player.visible=true;
    sourceChanged();
  }
  function scan(){
    for(const audio of document.querySelectorAll(scope))enhance(audio);
    for(const [audio,player] of players){if(!audio.isConnected){player.dispose();players.delete(audio);}else player.sync();}
  }
  new MutationObserver(records=>{if(records.some(record=>record.attributeName==='src'||record.attributeName==='hidden'||record.type==='childList'&&[...record.addedNodes,...record.removedNodes].some(n=>n.nodeType===1&&(n.matches('audio')||n.querySelector('audio')))))scan();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','hidden']});
  scan();
})();
