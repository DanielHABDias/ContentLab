import {createPreset,validateScore,levelAt} from "./music/model.js";
import {renderAudio} from "./music/synth.js";
import {createMusicAutomationEditor} from "./music-automation.js";
import {toWav} from "./music/wav.js";

const $=id=>document.getElementById(id);
if($("panel-music"))initializeMusicStudio();

function initializeMusicStudio(){
  let score=validateScore(createPreset()),busy=false,previousUrl=null,hasFullRender=false;
  const status=(message,error=false)=>{
    $("musicStatus").textContent=message;$("musicStatus").dataset.error=String(error);
  };
  const safe=(fn)=>async()=>{try{await fn();}catch(error){status(error.message||"Erro ao gerar música.",true);}};
  const controls=["musicPreset","musicVariation","musicApplyJson","musicPreview","musicRender"];
  function setBusy(value){
    busy=value;for(const name of controls)$(name).disabled=value;
    $("musicDownload").hidden=value||!previousUrl||!hasFullRender;
  }
  function invalidateAudio(){
    if(previousUrl){URL.revokeObjectURL(previousUrl);previousUrl=null;}
    hasFullRender=false;
    $("musicAudio").pause();
    $("musicAudio").removeAttribute("src");
    $("musicAudio").hidden=true;
    $("musicDownload").hidden=true;
  }
  const editor=createMusicAutomationEditor($("musicTimeline"),{
    getScore:()=>score,
    onChange:next=>{
      if(busy)throw Error("Finalize a renderização antes de editar as curvas.");
      score=validateScore(next);
      invalidateAudio();
      syncJson();
    },
    onStatus:(message,error=false)=>status(message,error)
  });
  function syncJson(){
    $("musicJson").value=JSON.stringify(score,null,2);
    editor.render();
  }
  function refresh(){
    for(const [id,key] of [["musicTitle","title"],["musicDuration","durationSeconds"],["musicBpm","bpm"],
      ["musicSeed","seed"],["musicMode","mode"],["musicMelody","melody"]])$(id).value=score[key];
    $("musicMaster").value=String(Math.round(score.masterVolume*100));
    $("musicMasterValue").textContent=Math.round(score.masterVolume*100)+"%";
    syncJson();
    $("musicPreviewAt").max=String(Math.max(0,score.durationSeconds-1));
    if(Number($("musicPreviewAt").value)>=score.durationSeconds)$("musicPreviewAt").value="0";
  }
  function updateFields(){
    const duration=Number($("musicDuration").value),previous=score.durationSeconds,draft=structuredClone(score);
    draft.title=$("musicTitle").value;draft.durationSeconds=duration;draft.bpm=Number($("musicBpm").value);
    draft.seed=Number($("musicSeed").value);draft.mode=$("musicMode").value;
    draft.melody=$("musicMelody").value;draft.masterVolume=Number($("musicMaster").value)/100;
    if(previous!==duration && duration>=5 && duration<=900){
      draft.automation=draft.automation.map((point,index)=>({
        ...point,time:index===draft.automation.length-1?duration:Number((point.time*duration/previous).toFixed(3))
      }));
      draft.melodyNotes=[]; // explicit notes cannot safely be rescaled automatically
    }
    try{score=validateScore(draft);$("musicMasterValue").textContent=Math.round(score.masterVolume*100)+"%";
      invalidateAudio();syncJson();status("Composição atualizada.");}
    catch(error){status(error.message,true);}
  }
  for(const id of ["musicTitle","musicDuration","musicBpm","musicSeed","musicMode","musicMelody","musicMaster"])
    $(id).addEventListener("change",updateFields);
  $("musicPreset").addEventListener("click",()=>{score=validateScore(createPreset());invalidateAudio();refresh();status("Preset de suspense carregado.");});
  $("musicVariation").addEventListener("click",()=>{score.seed=(score.seed+1)%2147483648;invalidateAudio();refresh();status("Nova variação melódica criada.");});
  $("musicApplyJson").addEventListener("click",()=>safe(()=>{
    score=validateScore(JSON.parse($("musicJson").value));invalidateAudio();refresh();status("JSON aplicado. A próxima renderização seguirá estes dados.");
  })());
  $("musicDownloadJson").addEventListener("click",()=>safe(()=>{
    const text=JSON.stringify(score,null,2),url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="contentlab-trilha.json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  })());
  async function generate(full){
    if(busy)return;
    setBusy(true);
    try{
      score=validateScore(score);
      const from=full?0:Math.max(0,Math.min(Math.floor(Number($("musicPreviewAt").value)||0),score.durationSeconds-1));
      const seconds=full?score.durationSeconds:Math.min(30,score.durationSeconds-from);
      status(full?"Renderizando composição completa em WAV...":"Preparando prévia a partir de "+from+"s...");
      // Let the UI paint before OfflineAudioContext schedules the graph.
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const buffer=await renderAudio(score,seconds,from),blob=toWav(buffer);
      if(previousUrl)URL.revokeObjectURL(previousUrl);
      previousUrl=URL.createObjectURL(blob);
      hasFullRender=full;
      $("musicAudio").src=previousUrl;$("musicAudio").hidden=false;
      $("musicDownload").href=previousUrl;
      $("musicDownload").download=(score.title.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,65)||"trilha")+".wav";
      $("musicDownload").hidden=!hasFullRender;
      status((full?"Trilha inteira":"Prévia")+" pronta: "+seconds+" segundos de música instrumental original.");
      $("musicAudio").play().catch(()=>{});
    }finally{setBusy(false);}
    $("musicDownload").hidden=!hasFullRender;
  }
  $("musicPreview").addEventListener("click",()=>safe(()=>generate(false))());
  $("musicRender").addEventListener("click",()=>safe(()=>generate(true))());
  refresh();status("Arraste os pontos do gráfico; dê dois cliques para adicionar. Prévia de 30 s; exportação até 15 min.");
}
