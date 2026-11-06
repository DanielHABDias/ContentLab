import {createPreset,createStylePreset,validateScore,INSTRUMENTS} from "./music/model.js";
import {renderAudio} from "./music/synth.js";
import {createMusicAutomationEditor} from "./music-automation.js";
import {toWav} from "./music/wav.js";
import {toMidi} from "./music/midi.js";

const $=id=>document.getElementById(id);
if($("panel-music"))initializeMusicStudio();

function initializeMusicStudio(){
  let score=createStylePreset("cinematic",600),busy=false,previousUrl=null,hasFullRender=false;
  const expanded=new Set(),status=(message,error=false)=>{
    $("musicStatus").textContent=message;$("musicStatus").dataset.error=String(error);
  };
  const safe=fn=>async()=>{try{await fn();}catch(error){status(error.message||"Falha ao editar a composição.",true);}};
  const controls=["musicPreset","musicVariation","musicAddTrack","musicApplyJson","musicPreview",
    "musicRender","musicDownloadMidi"];
  function setBusy(value){
    busy=value;
    for(const id of controls)$(id).disabled=value;
    $("musicDownload").hidden=value||!previousUrl||!hasFullRender;
  }
  function invalidateAudio(){
    if(previousUrl){URL.revokeObjectURL(previousUrl);previousUrl=null;}
    hasFullRender=false;
    $("musicAudio").pause();$("musicAudio").removeAttribute("src");
    $("musicAudio").hidden=true;$("musicDownload").hidden=true;
  }
  function commit(next,message="Composição atualizada."){
    if(busy)throw Error("Finalize a renderização antes de editar.");
    score=validateScore(next);invalidateAudio();refresh();status(message);
  }
  const editor=createMusicAutomationEditor($("musicTimeline"),{
    getScore:()=>score,
    onChange:next=>{
      if(busy)throw Error("Finalize a renderização antes de editar curvas.");
      score=validateScore(next);invalidateAudio();syncJson();
    },
    onStatus:(message,error=false)=>status(message,error)
  });
  function syncJson(){
    $("musicJson").value=JSON.stringify(score,null,2);
    editor.render();
  }
  function field(label,text,type,value,onChange,options){
    const div=document.createElement("label");div.className="music-field";
    const heading=document.createElement("span");heading.textContent=label;div.append(heading);
    let input;
    if(type==="select"){
      input=document.createElement("select");
      for(const option of options){
        const node=document.createElement("option");node.value=option;node.textContent=option;
        input.append(node);
      }
    }else{
      input=document.createElement("input");input.type=type;
      if(type==="number"){input.step=label==="Tempo (beat)"||label==="Duração"?"0.125":"1";
        input.min="0";}
    }
    if(type==="checkbox")input.checked=Boolean(value);else input.value=String(value);
    input.setAttribute("aria-label",text);
    input.addEventListener(type==="checkbox"?"change":"change",()=>onChange(input));
    div.append(input);return div;
  }
  function editTrack(index,key,value){
    const draft=structuredClone(score);
    draft.tracks[index][key]=value;
    commit(draft,"Faixa atualizada.");
  }
  function editNote(trackIndex,clipIndex,noteIndex,key,value){
    const draft=structuredClone(score),note=draft.tracks[trackIndex].clips[clipIndex].notes[noteIndex];
    note[key]=value;
    commit(draft,"Nota modificada.");
  }
  function renderTracks(){
    const host=$("musicTracks");host.replaceChildren();
    const isV2=score.schemaVersion===2;
    $("musicLegacyFields").hidden=isV2;
    $("musicAddTrack").hidden=!isV2;
    $("musicDownloadMidi").hidden=!isV2;
    if(!isV2){
      const p=document.createElement("p");p.className="music-tracks-legacy";
      p.textContent="Este JSON é da versão antiga: melodia, ritmo e progressões são fixos. Escolha um estilo e clique em Carregar arranjo para criar um projeto novo em JSON v2 com faixas independentes.";
      host.append(p);return;
    }
    score.tracks.forEach((track,index)=>{
      const card=document.createElement("div");card.className="music-track";
      const bar=document.createElement("div");bar.className="music-track-bar";
      bar.append(
        field("Faixa","Nome da faixa", "text",track.name,input=>editTrack(index,"name",input.value)),
        field("Instrumento","Instrumento da faixa","select",track.instrument,
          input=>editTrack(index,"instrument",input.value),INSTRUMENTS));
      const vol=document.createElement("div");vol.className="music-field";
      const volumeTitle=document.createElement("label");volumeTitle.textContent="Volume "+Math.round(track.gain*100)+"%";
      const volume=document.createElement("input");volume.type="range";volume.min=0;volume.max=100;
      volume.value=String(Math.round(track.gain*100));volume.setAttribute("aria-label","Volume da faixa "+track.name);
      volume.addEventListener("change",()=>editTrack(index,"gain",Number(volume.value)/100));
      vol.append(volumeTitle,volume);bar.append(vol);
      const buttons=document.createElement("div");buttons.className="music-track-controls";
      const mutelabel=document.createElement("label");mutelabel.textContent="Mudo ";
      const mute=document.createElement("input");mute.type="checkbox";mute.checked=Boolean(track.muted);
      mute.setAttribute("aria-label","Silenciar faixa "+track.name);
      mute.addEventListener("change",()=>editTrack(index,"muted",mute.checked));
      mutelabel.append(mute);buttons.append(mutelabel);
      const remove=document.createElement("button");remove.type="button";
      remove.className="btn btn-ghost btn-sm";remove.textContent="×";
      remove.title="Excluir faixa";remove.disabled=score.tracks.length<=1;
      remove.addEventListener("click",()=>safe(()=>{
        const draft=structuredClone(score);draft.tracks.splice(index,1);
        expanded.delete(track.id);commit(draft,"Faixa excluída.");
      })());buttons.append(remove);bar.append(buttons);card.append(bar);
      const details=document.createElement("details");details.open=expanded.has(track.id);
      const summary=document.createElement("summary");
      summary.textContent="Editar padrão · "+track.clips.length+" clipes · "+track.clips.reduce((n,c)=>n+c.notes.length,0)+" notas programadas";
      details.append(summary);
      details.addEventListener("toggle",()=>{if(details.open)expanded.add(track.id);else expanded.delete(track.id);});
      const desc=document.createElement("p");desc.className="music-pattern-intro";
      desc.textContent="Cada nota usa posição em beats, duração em beats, altura MIDI e força. O clipe repete sua sequência. Para vários padrões diferentes ou seções exclusivas, edite tracks[].clips no JSON à direita.";
      details.append(desc);
      if(track.clips.length){
        const clip=track.clips[0];
        const patternActions=document.createElement("div");patternActions.className="music-pattern-actions";
        const info=document.createElement("span");info.className="music-pattern-intro";
        info.textContent="Padrão: "+clip.lengthBeats+" beats · "+clip.repeats+" repetições";
        patternActions.append(info);
        const addNote=document.createElement("button");addNote.className="btn btn-secondary btn-sm";
        addNote.type="button";addNote.textContent="+ Nota";
        addNote.addEventListener("click",()=>safe(()=>{
          const draft=structuredClone(score),c=draft.tracks[index].clips[0];
          if(c.notes.length>=512)throw Error("Limite de 512 notas por clipe.");
          const beat=Number((c.lengthBeats/2).toFixed(3));
          c.notes.push({beat,durationBeats:Math.min(.5,c.lengthBeats-beat),pitch:60,velocity:.55});
          commit(draft,"Nota adicionada ao padrão.");
        })());patternActions.append(addNote);details.append(patternActions);
        const list=document.createElement("div");list.className="music-pattern-notes";
        clip.notes.forEach((note,noteIndex)=>{
          const row=document.createElement("div");row.className="music-note-row";
          const columns=[
            ["Tempo (beat)","beat",note.beat],
            ["Duração","durationBeats",note.durationBeats],
            ["Nota MIDI","pitch",note.pitch],
            ["Força (%)","velocity",Math.round(note.velocity*100)]
          ];
          for(const [label,key,current] of columns){
            const col=document.createElement("label");col.textContent=label;
            const input=document.createElement("input");input.type="number";input.value=String(current);
            input.min=key==="durationBeats"?"0.015":"0";
            input.max=key==="velocity"?"100":key==="pitch"?"108":undefined;
            input.step=key==="pitch"||key==="velocity"?"1":"0.125";
            input.setAttribute("aria-label",label+" da nota "+(noteIndex+1)+" da faixa "+track.name);
            input.addEventListener("change",()=>safe(()=>{
              const raw=Number(input.value);editNote(index,0,noteIndex,key,key==="velocity"?raw/100:raw);
            })());col.append(input);row.append(col);
          }
          const removeNote=document.createElement("button");removeNote.type="button";
          removeNote.className="btn btn-ghost btn-sm";removeNote.textContent="×";removeNote.title="Remover nota";
          removeNote.addEventListener("click",()=>safe(()=>{
            const draft=structuredClone(score);draft.tracks[index].clips[0].notes.splice(noteIndex,1);
            commit(draft,"Nota removida do padrão.");
          })());
          row.append(removeNote);list.append(row);
        });
        details.append(list);
      }else{
        const empty=document.createElement("p");empty.className="music-pattern-intro";
        empty.textContent="Esta faixa usa notas independentes, sem clipe de repetição. Para editá-las, use tracks[].notes no JSON.";
        details.append(empty);
      }
      card.append(details);host.append(card);
    });
  }
  function refresh(){
    for(const [id,key] of [["musicTitle","title"],["musicDuration","durationSeconds"],
      ["musicBpm","bpm"],["musicSeed","seed"]])$(id).value=score[key];
    const v2=score.schemaVersion===2;
    $("musicStyle").value=v2?score.style||"cinematic":"legacy";
    $("musicMode").value=v2?"tense":score.mode;
    $("musicMelody").value=v2?"sparse":score.melody;
    $("musicMaster").value=String(Math.round(score.masterVolume*100));
    $("musicMasterValue").textContent=Math.round(score.masterVolume*100)+"%";
    $("musicBpm").min=v2?"40":"45";$("musicBpm").max=v2?"240":"130";
    const previewMax=Math.max(0,score.durationSeconds-1);
    $("musicPreviewAt").max=String(previewMax);
    if(Number($("musicPreviewAt").value)>=score.durationSeconds)$("musicPreviewAt").value="0";
    renderTracks();syncJson();
  }
  function updateFields(){
    const draft=structuredClone(score),duration=Number($("musicDuration").value);
    const old=score.durationSeconds;
    draft.title=$("musicTitle").value;draft.durationSeconds=duration;
    draft.bpm=Number($("musicBpm").value);
    draft.seed=Number($("musicSeed").value);
    draft.masterVolume=Number($("musicMaster").value)/100;
    if(draft.schemaVersion!==2){
      draft.mode=$("musicMode").value;draft.melody=$("musicMelody").value;
    }
    if(old!==duration&&duration>=5&&duration<=900){
      draft.automation=draft.automation.map((point,index)=>({
        ...point,time:index===draft.automation.length-1?duration:
          Number((point.time*duration/old).toFixed(6))
      }));
      if(draft.schemaVersion===2){
        // Only extend patterns that already covered the previous song end.
        const beatsOld=old*score.bpm/60,beatsNew=duration*draft.bpm/60;
        for(const track of draft.tracks)for(const clip of track.clips){
          const oldEnd=clip.startBeat+clip.lengthBeats*clip.repeats;
          if(oldEnd>=beatsOld-clip.lengthBeats)
            clip.repeats=Math.max(1,Math.min(2000,Math.ceil((beatsNew-clip.startBeat)/clip.lengthBeats)));
        }
      }else draft.melodyNotes=[];
    }
    try{commit(draft,"Parâmetros atualizados. As notas e os ritmos foram preservados.");}
    catch(error){status(error.message,true);}
  }
  for(const id of ["musicTitle","musicDuration","musicBpm","musicSeed","musicMaster",
    "musicMode","musicMelody"])$(id).addEventListener("change",updateFields);
  $("musicStyle").addEventListener("change",()=>{
    if($("musicStyle").value==="legacy"){
      if(score.schemaVersion===2){$("musicStyle").value=score.style||"cinematic";
        status("O formato v1 existe apenas para compatibilidade. Escolha um estilo novo ou cole seu JSON antigo.",true);}
      return;
    }
    status("Clique em Carregar arranjo do estilo para iniciar uma nova composição; a atual não foi substituída.");
  });
  $("musicPreset").addEventListener("click",()=>safe(()=>{
    const style=$("musicStyle").value;
    if(style==="legacy")throw Error("Selecione um dos cinco estilos para criar a partitura v2.");
    commit(createStylePreset(style,Number($("musicDuration").value)||600),
      "Novo arranjo "+style+" criado com instrumentos e padrões diferentes.");
  })());
  $("musicVariation").addEventListener("click",()=>safe(()=>{
    const draft=structuredClone(score);draft.seed=(score.seed+1)%2147483648;
    if(draft.schemaVersion===2){
      const tonal=draft.tracks.find(t=>["piano","electric-piano","synth-lead",
        "pluck","guitar","flute","cavaquinho"].includes(t.instrument) &&t.clips.some(c=>c.notes.length));
      if(!tonal)throw Error("Nenhuma faixa melódica encontrada para variar. Edite notas manualmente.");
      const notes=tonal.clips.find(c=>c.notes.length).notes;
      notes.forEach((n,i)=>{
        if(i%3===draft.seed%3)n.pitch=Math.max(24,Math.min(108,n.pitch+(draft.seed%2?2:-2)));
        n.velocity=Math.max(.1,Math.min(1,Number((n.velocity*(i%2?.96:1.04)).toFixed(4))));
      });
      commit(draft,"Motivo variado: notas e dinâmica foram modificadas, não apenas volume.");
    }else commit(draft,"Variação da versão 1 aplicada.");
  })());
  $("musicAddTrack").addEventListener("click",()=>safe(()=>{
    if(score.schemaVersion!==2)throw Error("Faixas personalizadas exigem JSON v2.");
    const draft=structuredClone(score);
    if(draft.tracks.length>=32)throw Error("Limite de 32 faixas.");
    let n=1;while(draft.tracks.some(t=>t.id==="custom-"+n))n++;
    draft.tracks.push({id:"custom-"+n,name:"Instrumento "+n,instrument:"piano",gain:.6,pan:0,muted:false,
      clips:[{startBeat:0,lengthBeats:4,
        repeats:Math.ceil(draft.durationSeconds*draft.bpm/60/4),
        notes:[{beat:0,durationBeats:1,pitch:60,velocity:.55}]}],notes:[]});
    expanded.add("custom-"+n);commit(draft,"Faixa criada. Abra Editar padrão para compor suas notas.");
  })());
  $("musicApplyJson").addEventListener("click",()=>safe(()=>{
    commit(JSON.parse($("musicJson").value),
      "JSON aplicado: faixas, instrumentos, notas, ritmos e automações foram atualizados.");
  })());
  function download(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  $("musicDownloadJson").addEventListener("click",()=>safe(()=>{
    download(new Blob([JSON.stringify(score,null,2)],{type:"application/json"}),"contentlab-composicao.json");
  })());
  $("musicDownloadMidi").addEventListener("click",()=>safe(()=>{
    download(toMidi(validateScore(score)),"contentlab-composicao.mid");
    status("MIDI multifaixa exportado. Abra em uma DAW para escolher SoundFonts ou instrumentos realistas.");
  })());
  async function generate(full){
    if(busy)return;
    setBusy(true);
    try{
      score=validateScore(score);
      const from=full?0:Math.max(0,Math.min(Math.floor(Number($("musicPreviewAt").value)||0),score.durationSeconds-1));
      const seconds=full?score.durationSeconds:Math.min(30,score.durationSeconds-from);
      status(full?"Renderizando música completa em WAV...":"Preparando prévia de "+from+" s...");
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const buffer=await renderAudio(score,seconds,from),blob=toWav(buffer);
      if(previousUrl)URL.revokeObjectURL(previousUrl);
      previousUrl=URL.createObjectURL(blob);hasFullRender=full;
      $("musicAudio").src=previousUrl;$("musicAudio").hidden=false;
      $("musicDownload").href=previousUrl;
      $("musicDownload").download=(score.title.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,65)||"trilha")+".wav";
      $("musicDownload").hidden=!hasFullRender;
      status((full?"Música completa":"Prévia")+" pronta: "+seconds+" segundos, seguindo a partitura do JSON.");
      $("musicAudio").play().catch(()=>{});
    }finally{setBusy(false);}
    $("musicDownload").hidden=!hasFullRender;
  }
  $("musicPreview").addEventListener("click",()=>safe(()=>generate(false))());
  $("musicRender").addEventListener("click",()=>safe(()=>generate(true))());
  refresh();status("Compositor v2: escolha um gênero, edite notas por faixa e ouça uma prévia.");
}
