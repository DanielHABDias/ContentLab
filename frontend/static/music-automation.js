// Visual automation editor shared by the Content Lab music studio.
// The musical score remains the source of truth; all edits pass validateScore.
import {levelAt,validateScore} from "./music/model.js";

export const MUSIC_GRAPH = Object.freeze({width:960,height:344,left:62,right:26,top:46,bottom:48});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const round=(n,places=3)=>Number(n.toFixed(places));
const plotWidth=MUSIC_GRAPH.width-MUSIC_GRAPH.left-MUSIC_GRAPH.right;
const plotHeight=MUSIC_GRAPH.height-MUSIC_GRAPH.top-MUSIC_GRAPH.bottom;
const names={volume:"Volume",intensity:"Tensão"};

export function graphPoint(score,time,value){
  return {x:MUSIC_GRAPH.left+plotWidth*time/score.durationSeconds,
    y:MUSIC_GRAPH.top+plotHeight*(1-value)};
}
export function graphValue(score,x,y){
  return {time:clamp((x-MUSIC_GRAPH.left)/plotWidth*score.durationSeconds,0,score.durationSeconds),
    value:clamp(1-(y-MUSIC_GRAPH.top)/plotHeight,0,1)};
}
export function moveAutomationPoint(score,index,kind,time,value){
  if(!["volume","intensity"].includes(kind))throw Error("Curva de automação inválida.");
  const next=structuredClone(score),points=next.automation;
  if(!Number.isInteger(index)||index<0||index>=points.length)throw Error("Ponto inexistente.");
  if(index>0&&index<points.length-1){
    const before=points[index-1].time,after=points[index+1].time;
    const gap=Math.min(.05,(after-before)/3);
    points[index].time=round(clamp(time,before+gap,after-gap));
    // Preserve strictly increasing values even for very closely spaced JSON nodes.
    points[index].time=clamp(points[index].time,before+gap,after-gap);
  }
  points[index][kind]=round(clamp(value,0,1));
  return validateScore(next);
}
export function insertAutomationPoint(score,time,kind,value){
  if(!["volume","intensity"].includes(kind))throw Error("Curva de automação inválida.");
  if(score.automation.length>=64)throw Error("Limite de 64 pontos no gráfico.");
  const t=round(time);
  if(t<=0||t>=score.durationSeconds)throw Error("Dê dois cliques dentro do gráfico, entre o início e o fim.");
  const index=score.automation.findIndex(p=>p.time>=t);
  if(index<1)throw Error("Escolha um espaço entre dois pontos.");
  if(t-score.automation[index-1].time<.05||score.automation[index].time-t<.05)
    throw Error("Muito perto de outro ponto. Clique mais longe ou arraste o ponto existente.");
  const next=structuredClone(score),levels=levelAt(score,t);
  next.automation.splice(index,0,{time:t,volume:round(levels.volume),intensity:round(levels.intensity),[kind]:round(clamp(value,0,1))});
  return validateScore(next);
}
export function deleteAutomationPoint(score,index){
  if(index<=0||index>=score.automation.length-1)throw Error("O primeiro e o último ponto não podem ser removidos.");
  const next=structuredClone(score);next.automation.splice(index,1);
  return validateScore(next);
}
function clock(t){const n=Math.round(t);return Math.floor(n/60)+":"+String(n%60).padStart(2,"0");}
function toSvgPointer(svg,event,score){
  const bounds=svg.getBoundingClientRect();
  const x=(event.clientX-bounds.left)*MUSIC_GRAPH.width/(bounds.width||MUSIC_GRAPH.width);
  const y=(event.clientY-bounds.top)*MUSIC_GRAPH.height/(bounds.height||MUSIC_GRAPH.height);
  return graphValue(score,x,y);
}
export function createMusicAutomationEditor(svg,{getScore,onChange,onStatus}){
  let active=null,selected=null;
  const hint=document.getElementById("musicChartHint");
  const describe=(score,index,kind)=>{
    const p=score.automation[index];
    return names[kind]+" · "+clock(p.time)+" ("+round(p.time,2)+" s) · "+Math.round(p[kind]*100)+"%";
  };
  function draw(){
    const score=getScore(),pts=score.automation,parts=[];
    parts.push('<rect width="960" height="344" rx="14" fill="#f7f9fd"/>');
    for(let i=0;i<=4;i++){
      const v=i/4,y=graphPoint(score,0,v).y;
      parts.push('<line class="music-grid-line" x1="'+MUSIC_GRAPH.left+'" x2="'+(MUSIC_GRAPH.width-MUSIC_GRAPH.right)+'" y1="'+y+'" y2="'+y+'"/>');
      parts.push('<text class="music-tick" x="'+(MUSIC_GRAPH.left-12)+'" y="'+(y+4)+'" text-anchor="end">'+Math.round(v*100)+'%</text>');
    }
    for(let i=0;i<=5;i++){
      const t=score.durationSeconds*i/5,x=graphPoint(score,t,0).x;
      parts.push('<line class="music-grid-line" x1="'+x+'" x2="'+x+'" y1="'+MUSIC_GRAPH.top+'" y2="'+(MUSIC_GRAPH.height-MUSIC_GRAPH.bottom)+'"/>');
      parts.push('<text class="music-tick" x="'+x+'" y="'+(MUSIC_GRAPH.height-20)+'" text-anchor="middle">'+clock(t)+'</text>');
    }
    parts.push('<text class="music-axis-title" x="'+MUSIC_GRAPH.left+'" y="25">NÍVEL · 0–100%</text>');
    parts.push('<text class="music-axis-title" x="'+(MUSIC_GRAPH.width-MUSIC_GRAPH.right)+'" y="25" text-anchor="end">TEMPO</text>');
    for(const kind of ["volume","intensity"]){
      const path=pts.map((p,i)=>{
        const c=graphPoint(score,p.time,p[kind]);
        return (i?"L":"M")+c.x.toFixed(2)+","+c.y.toFixed(2);
      }).join(" ");
      parts.push('<path class="music-line music-line-'+kind+'" d="'+path+'" fill="none"/>');
    }
    for(const kind of ["intensity","volume"]){
      pts.forEach((p,index)=>{
        const c=graphPoint(score,p.time,p[kind]),picked=selected&&selected.index===index&&selected.kind===kind;
        const label=describe(score,index,kind)+(index===0||index===pts.length-1?" · tempo fixo":"");
        parts.push('<g class="music-point'+(picked?' is-selected':'')+'" data-music-point="'+index+':'+kind+'" data-point-index="'+index+'" data-point-kind="'+kind+'" tabindex="0" role="slider" aria-label="'+label+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(p[kind]*100)+'">');
        parts.push('<circle class="music-point-hit" cx="'+c.x+'" cy="'+c.y+'" r="17"/>');
        parts.push('<circle class="music-point-dot music-point-'+kind+'" cx="'+c.x+'" cy="'+c.y+'" r="7"/>');
        parts.push('<title>'+label+' — arraste, use as setas ou pressione Delete para remover</title></g>');
      });
    }
    svg.innerHTML=parts.join("");
    if(hint&&selected&&pts[selected.index])hint.textContent=describe(score,selected.index,selected.kind);
    else if(hint)hint.textContent="Arraste os círculos para editar · dê dois cliques para criar um ponto · Delete para remover.";
  }
  function commit(next){
    onChange(next);
    draw();
  }
  function getHandle(event){
    return event.target.closest?.("[data-music-point]")||null;
  }
  function focusSelected(){
    if(!selected)return;
    svg.querySelector('[data-music-point="'+selected.index+':'+selected.kind+'"]')?.focus();
  }
  svg.addEventListener("pointerdown",event=>{
    const handle=getHandle(event);
    if(!handle||event.button!==0)return;
    selected={index:Number(handle.dataset.pointIndex),kind:handle.dataset.pointKind};
    active={pointerId:event.pointerId,...selected};
    event.preventDefault();
    try{svg.setPointerCapture(event.pointerId);}catch{} // synthetic events may not own capture
    draw();focusSelected();
  });
  svg.addEventListener("pointermove",event=>{
    if(!active||event.pointerId!==active.pointerId)return;
    event.preventDefault();
    const pos=toSvgPointer(svg,event,getScore());
    try{commit(moveAutomationPoint(getScore(),active.index,active.kind,pos.time,pos.value));}
    catch(error){onStatus(error.message,true);}
  });
  const endDrag=event=>{
    if(!active||event.pointerId!==active.pointerId)return;
    active=null;
    try{if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);}catch{}
    onStatus("Curva atualizada: "+describe(getScore(),selected.index,selected.kind)+".");
  };
  svg.addEventListener("pointerup",endDrag);
  svg.addEventListener("pointercancel",endDrag);
  svg.addEventListener("dblclick",event=>{
    if(getHandle(event))return;
    const score=getScore(),pos=toSvgPointer(svg,event,score);
    const levels=levelAt(score,pos.time);
    const kind=Math.abs(pos.value-levels.volume)<=Math.abs(pos.value-levels.intensity)?"volume":"intensity";
    try{
      const next=insertAutomationPoint(score,pos.time,kind,pos.value);
      selected={index:next.automation.findIndex(p=>p.time===round(pos.time)),kind};
      commit(next);focusSelected();
      onStatus("Ponto criado em "+clock(round(pos.time))+". Arraste para ajustar.");
    }catch(error){onStatus(error.message,true);}
  });
  svg.addEventListener("keydown",event=>{
    const handle=getHandle(event);
    if(!handle)return;
    const index=Number(handle.dataset.pointIndex),kind=handle.dataset.pointKind;
    const arrows=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];
    if(!arrows.includes(event.key)&&!["Delete","Backspace"].includes(event.key))return;
    event.preventDefault();
    selected={index,kind};
    if(event.key==="Delete"||event.key==="Backspace"){
      try{
        const next=deleteAutomationPoint(getScore(),index);
        selected=null;commit(next);onStatus("Ponto removido do gráfico.");
      }catch(error){onStatus(error.message,true);}
      return;
    }
    const current=getScore().automation[index];
    const vertical=event.key==="ArrowUp"||event.key==="ArrowDown";
    const delta=vertical?(event.shiftKey?.05:.01)*(event.key==="ArrowUp"?1:-1):0;
    const timeDelta=vertical?0:(event.shiftKey?1:.1)*(event.key==="ArrowRight"?1:-1);
    try{
      commit(moveAutomationPoint(getScore(),index,kind,current.time+timeDelta,current[kind]+delta));
      focusSelected();
    }catch(error){onStatus(error.message,true);}
  });
  svg.addEventListener("focusin",event=>{
    const handle=getHandle(event);if(!handle)return;
    selected={index:Number(handle.dataset.pointIndex),kind:handle.dataset.pointKind};
    if(hint)hint.textContent=describe(getScore(),selected.index,selected.kind);
  });
  draw();
  return {render:draw};
}
