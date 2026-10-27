import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {APP_ROOT} from './plan.mjs';

function harness({deny=false,fetcher}={}){
  const elements=new Map(),handlers={};let stopped=0,recorder=null,clock=0,tick,panel;
  const generic=()=>({children:[],style:{},value:'80',scrollLeft:0,querySelector(){return {value:'80'};},append(...items){this.children.push(...items);},setAttribute(){},closest(){return {after(){}};},after(){},focus(){},setPointerCapture(){},getBoundingClientRect(){return {left:0,width:900};},clientWidth:900,getContext(){return {scale(){},fillText(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};}});
  const element=id=>{
    if(!elements.has(id))elements.set(id,{id,value:'',disabled:false,hidden:id==='panel-transcription',textContent:'',files:[],options:[],
      ...generic(),value:'',listeners:{},addEventListener(type,handler){this.listeners[type]=handler;},setAttribute(){},children:[],append(...items){this.children.push(...items);},replaceChildren(...values){this.options=values;this.children=[...values];},add(option){this.options.push(option);}});
    return elements.get(id);
  };
  const stream={getTracks:()=>[{stop(){stopped++;}}]};
  class FakeRecorder{
    static isTypeSupported(){return true;}
    constructor(){this.state='inactive';this.mimeType='audio/webm';recorder=this;}
    start(){this.state='recording';this.started=clock;}pause(){this.state='paused';}resume(){this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable({data:new Blob([JSON.stringify({duration:(clock-this.started)/1000})])});return this.onstop();}
  }
  class FakeContext{
    constructor(){this.state='running';}
    async decodeAudioData(bytes){const duration=JSON.parse(new TextDecoder().decode(bytes)).duration,length=Math.round(duration*48000);return {length,numberOfChannels:1,getChannelData:()=>new Float32Array(length).fill(.1)};}
    resume(){return Promise.resolve();}close(){return Promise.resolve();}
    createAnalyser(){return {fftSize:256,getFloatTimeDomainData(samples){samples.fill(.1);}};}
    createMediaStreamSource(){return {connect(){}};}
  }
  const mediaDevices={async getUserMedia(){if(deny)throw Error('Microfone não autorizado');return stream;},async enumerateDevices(){return [{kind:'audioinput',label:'Microfone de teste',deviceId:'fake'}];}};
  element('transcriptionProjectRoot').value='/test-project';
  const sandbox={document:{head:generic(),getElementById:element,addEventListener(name,fn){handlers[name]=fn;},createElement:tag=>{const obj=generic();if(tag==='section'){panel=obj;const nodes=new Map();obj.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,generic());return nodes.get(selector);};}return obj;},createTextNode:text=>({textContent:text})},window:{MediaRecorder:FakeRecorder,addEventListener(){}},navigator:{mediaDevices},
    FormData,fetch:fetcher|| (async()=>({ok:true,json:async()=>({takes:[],revision:'test-revision',relative:'audio/recording-test.wav',jobId:'test-job'})})),
    MediaRecorder:FakeRecorder,AudioContext:FakeContext,performance:{now:()=>clock},Blob,File,
    URL:{createObjectURL:()=> 'blob:local-test',revokeObjectURL(){}},Option:class{constructor(text,value){this.text=text;this.value=value;}},
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},setInterval(fn){tick=fn;return 1;},clearInterval(){tick=null;},Date,
  };
  vm.runInNewContext(fs.readFileSync(APP_ROOT+'/frontend/static/recording-timeline.js','utf8'),sandbox);
  vm.runInNewContext(fs.readFileSync(APP_ROOT+'/frontend/static/voice-creation.js','utf8'),sandbox);
  return {element,get panel(){return panel;},keydown:handlers.keydown,get recorder(){return recorder;},get stopped(){return stopped;},advance(ms){clock+=ms;tick?.();}};
}
test('recorder uses permission, pauses time, previews raw take and releases microphone',async()=>{
  const h=harness();await h.element('voiceRecordStart').onclick();
  assert.equal(h.recorder.state,'recording');assert.equal(h.element('voiceRecordStart').disabled,false);assert.equal(h.element('voiceRecordStart').textContent,'Pausar');assert.equal(h.element('voiceRecordPause').hidden,true);
  h.advance(2000);assert.equal(h.element('voiceRecordTime').textContent,'00:00:02');
  await h.element('voiceRecordPause').onclick();h.advance(5000);assert.equal(h.element('voiceRecordTime').textContent,'00:00:02');
  await h.element('voiceRecordPause').onclick();h.advance(1000);assert.equal(h.element('voiceRecordTime').textContent,'00:00:03');
  await h.element('voiceRecordStop').onclick();assert.equal(h.stopped,2);
  assert.equal(h.element('voiceTakeAudio').src,'blob:local-test');
  assert.equal(h.element('voiceRecordSave').disabled,true);
  assert.match(h.element('voiceCreationStatus').textContent,/Clipe salvo/);
  assert.equal(h.element('voiceReferenceRecording').disabled,false);
});
test('permission denial is visible and does not leave recorder running',async()=>{
  const h=harness({deny:true});await h.element('voiceRecordStart').onclick();
  assert.match(h.element('voiceCreationStatus').textContent,/não autorizado/);
  assert.equal(h.element('voiceRecordStart').disabled,false);assert.equal(h.recorder,null);
});
test('mouse cut, undo, continuation and close export only the edited clip as WAV',async()=>{
 let saved;
 const h=harness({fetcher:async(url,options)=>{if(url==='/api/voice/recordings')saved=await options.body.get('file').arrayBuffer();return {ok:true,json:async()=>({takes:[],revision:'r'})};}});
 await h.element('voiceRecordStart').onclick();h.advance(4000);await h.element('voiceRecordPause').onclick();
 const canvas=h.panel.querySelector('canvas');
 const select=()=>{canvas.onpointerdown({clientX:80,pointerId:1,preventDefault(){}});canvas.onpointermove({clientX:240});canvas.onpointerup();};select();
 h.panel.querySelector('[data-action="delete"]').onclick();assert.match(h.panel.querySelector('[data-info]').textContent,/2.00/);
 h.panel.querySelector('[data-action="undo"]').onclick();assert.match(h.panel.querySelector('[data-info]').textContent,/1.00–3.00/);
 h.panel.querySelector('[data-action="delete"]').onclick();await h.element('voiceRecordPause').onclick();h.advance(1000);await h.element('voiceRecordStop').onclick();
 assert.equal(new DataView(saved).getUint32(40,true),3*48000*2);
 assert.equal(h.element('voiceRecordStart').textContent,'Gravar');
});
test('recording forwards breath attenuation including zero, and recipes control import independently',async()=>{
  let body;
  const h=harness({fetcher:async(url,options)=>{
    if(url==='/api/voice/finalize')body=JSON.parse(options.body);
    return {ok:true,json:async()=>url==='/api/voice/finalize'?{jobId:'breath'}:{status:'done',result:{duration:1,takeCount:1}}};
  }});
  h.element('voiceRecordReduceBreaths').checked=true;h.element('voiceRecordBreathStrength').value='0';
  await h.element('voiceRecordFinalize').onclick();
  assert.equal(body.treatment.reduceBreaths,true);assert.equal(body.treatment.breathReductionStrength,0);
  h.element('voiceTreatmentRecipe').value='preserve';h.element('voiceTreatmentRecipe').onchange();
  assert.equal(h.element('transcriptionReduceBreaths').checked,false);
  assert.equal(h.element('voiceRecordReduceBreaths').checked,true);
  h.element('voiceTreatmentRecipe').value='strong';h.element('voiceTreatmentRecipe').onchange();
  assert.equal(h.element('transcriptionReduceBreaths').checked,true);
  h.element('transcriptionBreathStrength').listeners.change();assert.equal(h.element('voiceTreatmentRecipe').value,'custom');
});
test('switching voice model restores Voicebox sampling and neutral expression',()=>{
  const h=harness();
  for(const [model,temperature,repetition] of [['chatterbox-multilingual',.8,2],['0.6B',.9,1.05],['1.7B',.9,1.05]]){
    h.element('voiceAiModel').value=model;h.element('voiceAiModel').listeners.change();
    assert.equal(h.element('voiceTemperature').value,temperature);assert.equal(h.element('voiceTopP').value,1);assert.equal(h.element('voiceRepetition').value,repetition);
    assert.equal(h.element('voiceParagraphPause').value,0);assert.equal(h.element('voiceExaggeration').value,.5);assert.equal(h.element('voiceCfgWeight').value,.5);
  }
});
test('finalization clearly completes beside recorder without waiting for AI model discovery',async()=>{
  let discovered=false;
  const h=harness({fetcher:async url=>{
    if(url==='/api/voice/state'){discovered=true;throw Error('IA indisponível');}
    const value=url==='/api/voice/finalize'?{jobId:'final'}:url==='/api/voice/jobs/final'?{
      status:'done',message:'Concluído',result:{projectRoot:'/canonical-project',relative:'audio/narration.wav',duration:2,wordCount:3,takeCount:1,preview:'Minha narração pronta'}
    }:{takes:[],revision:'current'};
    return {ok:true,json:async()=>value};
  }});
  await h.element('voiceRecordFinalize').onclick();
  assert.equal(discovered,false);
  assert.match(h.element('voiceRecordProgress').textContent,/Concluído!/);
  assert.match(h.element('voiceRecordProgress').className,/complete/);
  assert.equal(h.element('voiceRecordProgress').hidden,false);
  assert.equal(h.element('voiceFinalDetails').open,true);
  assert.equal(h.element('voiceFinalTranscript').value,'Minha narração pronta');
  assert.equal(h.element('voiceRecordStart').disabled,false);
  assert.equal(h.element('voiceRecordFinalize').textContent,'Finalizar narração e transcrever');
});
test('enhancement preview forwards controls and exposes before/after without replacing final narration',async()=>{
  let submitted;
  const h=harness({fetcher:async(url,options)=>{
    let result;
    if(url==='/api/voice/enhancement/preview'){submitted=Object.fromEntries(options.body.entries());result={jobId:'preview-test'};}
    else if(url==='/api/voice/jobs/preview-test')result={status:'done',result:{preview:true}};
    else result={takes:[],revision:'current'};
    return {ok:true,json:async()=>result};
  }});
  assert.equal(h.element('voiceEnhancementPreview').disabled,true);
  h.element('voiceEnhancementEngine').value='deepfilter';h.element('voiceEnhancementMode').value='strong';h.element('voiceEnhancementStrength').value='65';
  h.element('voiceEnhancementEngine').onchange();
  assert.equal(h.element('voiceEnhancementPreview').disabled,false);
  await h.element('voiceEnhancementPreview').onclick();
  assert.equal(submitted.enhancementMode,'strong');assert.equal(submitted.enhancementStrength,'65');
  assert.equal(submitted.kind,'recording');
  assert.equal(h.element('voiceEnhancementPreviewResult').hidden,false);
  assert.match(h.element('voiceEnhancementBefore').src,/variant=original/);
  assert.match(h.element('voiceEnhancementAfter').src,/preview-test\/audio$/);
  assert.match(h.element('voiceCreationStatus').textContent,/Seus arquivos não foram alterados/);
  assert.equal(h.element('voiceFinalAudio').src,undefined);
});
test('saved voices render before optional runtime discovery completes',async()=>{
  let release,checking=false;
  const h=harness({fetcher:async url=>{
    if(url==='/api/voice/profiles')return {ok:true,json:async()=>({profiles:[{id:'voice-one',name:'Minha voz',seconds:20}]})};
    checking=true;await new Promise(resolve=>{release=resolve;});return {ok:true,json:async()=>({models:[],runtimeReady:false})};
  }});
  const loading=h.element('voiceStateRefresh').onclick();
  for(let i=0;i<10&&!checking;i++)await Promise.resolve();
  assert.equal(checking,true);
  assert.equal(h.element('voiceProfile').value,'voice-one');
  assert.match(h.element('voiceProfileHint').textContent,/Minha voz/);
  const card=h.element('voiceProfilesList').children[0];
  assert.equal(card.children[0].textContent,'Minha voz');
  assert.match(card.children[2].src,/profiles\/voice-one\/audio$/);
  release();await loading;
});
test('treatment recipes configure controls without applying them to recording finalization',async()=>{
  let body;
  const h=harness({fetcher:async(url,options)=>({ok:true,json:async()=>{
    if(url==='/api/voice/finalize'){body=JSON.parse(options.body);return {jobId:'final'};}
    if(url==='/api/voice/jobs/final')return {status:'done',result:{relative:'audio/narration.wav',projectRoot:'/test-project',duration:1,takeCount:1,wordCount:1}};
    return {takes:[],revision:'new'};
  }})});
  h.element('voiceTreatmentRecipe').value='strong';h.element('voiceTreatmentRecipe').onchange();
  assert.equal(h.element('transcriptionCompression').checked,true);assert.equal(h.element('transcriptionDeesser').checked,true);
  assert.equal(h.element('voiceEnhancementEngine').value,'deepfilter');
  await h.element('voiceRecordFinalize').onclick();assert.equal(body.enhancement.enhancementEngine,'off');
  assert.equal(body.treatment.enabled,true);assert.equal(body.treatment.enhancementEngine,'deepfilter');assert.equal(body.treatment.enhancementMode,'strong');assert.equal(body.treatment.removeMiddleSilence,false);
  h.element('voiceRecordTreatmentEnabled').checked=false;await h.element('voiceRecordFinalize').onclick();assert.equal(body.treatment.enabled,false);
  h.element('voiceTreatmentRecipe').value='preserve';h.element('voiceTreatmentRecipe').onchange();
  assert.equal(h.element('transcriptionRemoveMiddle').checked,false);assert.equal(h.element('transcriptionNormalize').checked,true);
});
test('expressive voice presets reach generation and select isolated installer',async()=>{
  const calls=[];
  const h=harness({fetcher:async(url,options)=>{
    if(options?.body)calls.push({url,body:JSON.parse(options.body)});
    return {ok:true,json:async()=>url.startsWith('/api/voice/jobs/')?{status:'done',result:{preview:true}}:url==='/api/voice/takes'?{takes:[],revision:'r'}:{jobId:'job'}};
  }});
  h.element('voiceAiModel').value='chatterbox-multilingual';h.element('voiceAiModel').listeners.change();
  assert.equal(h.element('voiceExpressiveControls').hidden,false);
  h.element('voiceDeliveryPreset').value='dramatic';h.element('voiceDeliveryPreset').listeners.change();
  assert.equal(h.element('voiceExaggeration').value,.75);assert.equal(h.element('voiceCfgWeight').value,.3);
  h.element('voiceProfile').value='voice';h.element('voiceAiText').value='Agora, a resposta!';
  await h.element('voiceAiGenerate').onclick();
  const body=calls.find(c=>c.url==='/api/voice/generate').body;
  assert.equal(body.exaggeration,.75);assert.equal(body.cfgWeight,.3);assert.equal(body.model,'chatterbox-multilingual');
  assert.equal(body.enhancement.enhancementEngine,'off');
  h.element('voiceModelInstallSelect').value='chatterbox-multilingual';await h.element('voiceRuntimeSetup').onclick();
  assert.equal(calls.find(c=>c.url==='/api/voice/runtime').body.engine,'chatterbox');
  h.element('voiceAiModel').value='0.6B';h.element('voiceAiModel').listeners.change();assert.equal(h.element('voiceExpressiveControls').hidden,true);
});
