import {ensurePortableTool} from './portable-tools.mjs';
import {ensureEnhancer} from './voice-enhancement.mjs';
import {setupRuntime,qwenTask,modelState,VOICE_MODELS} from './voice-creation.mjs';
import {setupChatterbox,chatterboxTask,CHATTERBOX_MODEL} from './chatterbox.mjs';

const pending=new Map();
export async function ensureVoiceModel(model,{signal,update=()=>{}}={},dependencies={setupRuntime,setupChatterbox,qwenTask,chatterboxTask,modelState}){
  if(!VOICE_MODELS.includes(model))throw Error('Modelo de voz inválido.');
  if(pending.has(model)){await pending.get(model);signal?.throwIfAborted();return;}
  const task=(async()=>{
    await (model===CHATTERBOX_MODEL?dependencies.setupChatterbox:dependencies.setupRuntime)(update,signal);
    const state=await dependencies.modelState();
    if(!state.models.find(item=>item.id===model)?.installed){
      update('Baixando modelo de voz selecionado automaticamente. Pode levar vários minutos...');
      await (model===CHATTERBOX_MODEL?dependencies.chatterboxTask:dependencies.qwenTask)({action:'download',model},{signal,update});
    }
  })();pending.set(model,task);
  try{await task;}finally{pending.delete(model);}
}
export async function prepareFeatures({signal,update=console.log,mediaOnly=false}={},dependencies={ensurePortableTool,ensureEnhancer,setupRuntime,setupChatterbox}){
  await dependencies.ensurePortableTool('ytdlp',{signal,update});
  if(mediaOnly)return;
  await dependencies.ensureEnhancer({signal,update});
  await dependencies.setupRuntime(update,signal);
  await dependencies.setupChatterbox(update,signal);
  update('Downloads e ambientes de voz prontos. Modelos de clonagem são baixados automaticamente ao escolher Gerar.');
}
