import {createPreset,validateScore,levelAt} from "./music/model.js";
import {renderAudio} from "./music/synth.js";
import {toWav} from "./music/wav.js";

const $=id=>document.getElementById(id);
if($("panel-music"))initializeMusicStudio();

function initializeMusicStudio(){
  let score=validateScore(createPreset()),busy=false,previousUrl=null;
  const status=(message,error=false)=>{
    $("musicStatus").textContent=message;$("musicStatus").dataset.error=String(error);
  };
  const safe=(fn)=>async()=>{try{await fn();}catch(error){status(error.message||"Erro ao gerar música.",true);}};
  const controls=["musicPreset","musicVariation","musicAddMarker","musicApplyJson","musicPreview","musicRender"];
  function setBusy(value){
    busy=value;for(const name of controls)$(name).disabled=value;
    $("musicDownload").hidden=value||!previousUrl;
  }
  function paintTimeline(){
    const points=score.automation, width=640,height=136,pad=24;
    const x=t=>pad+(width-2*pad)*t/score.durationSeconds;
    const y=v=>height-pad-(height-2*pad)*v;
    const path=kind=>points.map((p,i)=>(i?"L":"M")+x(p.time).toFixed(1)+","+y(p[kind]).toFixed(1)).join(" ");
    const circles=points.map(p=>'<circle cx="'+x(p.time).toFixed(1)+'" cy="'+y(p.volume).toFixed(1)+'" r="3.8" fill="#2365d5"/>').join("");
    $("musicTimeline").innerHTML='<path d="'+path("intensity")+'" fill="none" stroke="#db6b58" stroke-width="2.5" stroke-dasharray="6 4"/>'+
      '<path d="'+path("volume")+'" fill="none" stroke="#2365d5" stroke-width="3"/>'+circles+
      '<text x="20" y="12" fill="#6f7786" font-size="11">Volume (azul) · Tensão (laranja)</text>'+
      '<text x="20" y="132" fill="#6f7786" font-size="10">0:00</text>'+
      '<text x="620" y="132" fill="#6f7786" font-size="10" text-anchor="end">'+Math.floor(score.durationSeconds/60)+":"+String(Math.floor(score.durationSeconds%60)).padStart(2,"0")+"</text>";
  }
  function syncJson(){
    $("musicJson").value=JSON.stringify(score,null,2);
    paintTimeline();
  }
  function editMarker(index,key,next){
    const draft=structuredClone(score);draft.automation[index][key]=next;
    try{score=validateScore(draft);syncJson();status("Ponto atualizado.");}
    catch(error){status(error.message,true);}
  }
  function markerInput(type,value,disabled=false){
    const input=document.createElement("input");
    input.type=type;input.value=String(value);input.disabled=disabled;
    return input;
  }
  function renderMarkers(){
    const host=$("musicMarkers");host.replaceChildren();
    score.automation.forEach((point,index)=>{
      const row=document.createElement("div");row.className="music-marker";
      const time=markerInput("number",Number(point.time.toFixed(1)),index===0||index===score.automation.length-1);
      time.min=0;time.max=score.durationSeconds;time.step=".1";time.setAttribute("aria-label","Tempo em segundos");
      const volume=markerInput("range",Math.round(point.volume*100));
      const intensity=markerInput("range",Math.round(point.intensity*100));
      for(const [input,key,multiplier] of [[time,"time",1],[volume,"volume",.01],[intensity,"intensity",.01]]){
        if(input.type==="range"){input.min=0;input.max=100;input.step=1;}
        input.addEventListener("input",()=>editMarker(index,key,Number(input.value)*multiplier));
        input.addEventListener("change",renderMarkers);
      }
      volume.setAttribute("aria-label","Volume no ponto "+index);
      intensity.setAttribute("aria-label","Tensão no ponto "+index);
      const remove=document.createElement("button");remove.type="button";remove.textContent="×";
      remove.className="btn btn-ghost btn-sm";remove.title="Remover ponto";remove.disabled=index===0||index===score.automation.length-1;
      remove.addEventListener("click",()=>safe(()=>{
        const draft=structuredClone(score);draft.automation.splice(index,1);
        score=validateScore(draft);refresh();status("Ponto removido.");
      })());
      row.append(time,volume,intensity,remove);host.append(row);
    });
  }
  function refresh(){
    for(const [id,key] of [["musicTitle","title"],["musicDuration","durationSeconds"],["musicBpm","bpm"],
      ["musicSeed","seed"],["musicMode","mode"],["musicMelody","melody"]])$(id).value=score[key];
    $("musicMaster").value=String(Math.round(score.masterVolume*100));
    $("musicMasterValue").textContent=Math.round(score.masterVolume*100)+"%";
    renderMarkers();syncJson();
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
      renderMarkers();syncJson();status("Composição atualizada.");}
    catch(error){status(error.message,true);}
  }
  for(const id of ["musicTitle","musicDuration","musicBpm","musicSeed","musicMode","musicMelody","musicMaster"])
    $(id).addEventListener("change",updateFields);
  $("musicPreset").addEventListener("click",()=>{score=validateScore(createPreset());refresh();status("Preset de suspense carregado.");});
  $("musicVariation").addEventListener("click",()=>{score.seed=(score.seed+1)%2147483648;refresh();status("Nova variação melódica criada.");});
  $("musicAddMarker").addEventListener("click",()=>safe(()=>{
    if(score.automation.length===64)throw Error("Limite de 64 pontos.");
    let widest=0,index=0;
    for(let i=1;i<score.automation.length;i++){
      const gap=score.automation[i].time-score.automation[i-1].time;
      if(gap>widest){widest=gap;index=i;}
    }
    if(widest<=.2)throw Error("Não há espaço suficiente para outro ponto.");
    const time=Number(((score.automation[index-1].time+score.automation[index].time)/2).toFixed(3));
    const levels=levelAt(score,time),draft=structuredClone(score);
    draft.automation.splice(index,0,{time,volume:levels.volume,intensity:levels.intensity});
    score=validateScore(draft);refresh();status("Novo ponto adicionado à linha do tempo.");
  })());
  $("musicApplyJson").addEventListener("click",()=>safe(()=>{
    score=validateScore(JSON.parse($("musicJson").value));refresh();status("JSON aplicado. A próxima renderização seguirá estes dados.");
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
      $("musicAudio").src=previousUrl;$("musicAudio").hidden=false;
      $("musicDownload").href=previousUrl;
      $("musicDownload").download=(score.title.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,65)||"trilha")+".wav";
      $("musicDownload").hidden=!full;
      status((full?"Trilha inteira":"Prévia")+" pronta: "+seconds+" segundos de música instrumental original.");
      $("musicAudio").play().catch(()=>{});
    }finally{setBusy(false);}
    $("musicDownload").hidden=!full;
  }
  $("musicPreview").addEventListener("click",()=>safe(()=>generate(false))());
  $("musicRender").addEventListener("click",()=>safe(()=>generate(true))());
  refresh();status("Edite os pontos de volume e tensão. Prévia de 30 s; exportação até 15 min.");
}
