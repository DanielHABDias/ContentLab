// Music score v2: notes, clips, tracks and instruments drive the music.
// Version 1 scores are still accepted and rendered by the legacy arranger.
export const INSTRUMENTS=[
  "custom-synth","sub-bass","808","bass","piano","electric-piano","pad","strings","organ",
  "synth-lead","pluck","guitar","distorted-guitar","cavaquinho","flute","brass",
  "kick","snare","hat","clap","shaker","tom","surdo","pandeiro","tamborim","rim","cowbell"
];
export const DRUM_INSTRUMENTS=["kick","snare","hat","clap","shaker","tom","surdo","pandeiro","tamborim","rim","cowbell"];
const limits=(v,min,max,label)=>{
  if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)
    throw Error(label+" deve estar entre "+min+" e "+max+".");
  return v;
};
const integer=(v,min,max,label)=>{
  limits(v,min,max,label);
  if(!Number.isInteger(v))throw Error(label+" deve ser inteiro.");
};
export function createPreset(durationSeconds=600){
  return {
    title:"VD 008 - Sombras do Carnificina",durationSeconds,bpm:72,seed:8008,
    mode:"tense",melody:"sparse",masterVolume:.72,
    automation:[
      {time:0,volume:.30,intensity:.20},
      {time:durationSeconds*.20,volume:.34,intensity:.32},
      {time:durationSeconds*.45,volume:.42,intensity:.52},
      {time:durationSeconds*.75,volume:.55,intensity:.82},
      {time:durationSeconds*.90,volume:.50,intensity:.73},
      {time:durationSeconds,volume:0,intensity:.12}
    ],melodyNotes:[]
  };
}
const note=(beat,durationBeats,pitch,velocity=.65)=>({beat,durationBeats,pitch,velocity});
const clip=(startBeat,lengthBeats,repeats,notes)=>({startBeat,lengthBeats,repeats,notes});
const track=(id,name,instrument,gain,clips,pan=0)=>({id,name,instrument,gain,pan,muted:false,clips,notes:[]});
const chord=(at,tones,length=3.6,velocity=.4)=>tones.map(p=>note(at,length,p,velocity));
const hit=(at,velocity=.65,durationBeats=.18)=>note(at,durationBeats,60,velocity);
function styleTracks(style,repeats){
  if(style==="rock")return [
    track("guitar","Guitarra base","distorted-guitar",.43,[clip(0,8,repeats,[
      ...chord(0,[40,47,52],.78,.52),...chord(1,[40,47,52],.72,.44),
      ...chord(2,[43,50,55],.8,.55),...chord(3,[43,50,55],.7,.44),
      ...chord(4,[45,52,57],.8,.55),...chord(5,[45,52,57],.7,.44),
      ...chord(6,[38,45,50],.8,.55),...chord(7,[38,45,50],.7,.44)])],-.24),
    track("bass","Baixo elétrico","bass",.66,[clip(0,8,repeats,[0,1,2,3,4,5,6,7].map((b)=>note(b,.85,[40,40,43,43,45,45,38,38][b],.69)))]),
    track("kick","Bumbo","kick",.72,[clip(0,4,repeats*2,[hit(0,.92),hit(2,.84)])]),
    track("snare","Caixa","snare",.63,[clip(0,4,repeats*2,[hit(1,.82),hit(3,.89)])]),
    track("hat","Chimbal","hat",.43,[clip(0,4,repeats*2,Array.from({length:8},(_,i)=>hit(i*.5,i%2?.42:.58,.09)))]),
    track("lead","Guitarra solo","guitar",.44,[clip(16,8,Math.max(1,repeats-2),[note(0,.8,64,.55),note(1,1.2,67,.54),note(3,.6,69,.65),note(4,1.5,67,.51),note(6,1.5,62,.48)])],.2)
  ];
  if(style==="funk")return [
    track("tambor","Batida tamborzão","kick",.83,[clip(0,4,repeats*2,[hit(0,1),hit(.75,.65),hit(1.5,.87),hit(2.75,.9),hit(3.5,.68)])]),
    track("clap","Palmas e caixa","clap",.61,[clip(0,4,repeats*2,[hit(1,.86),hit(2.5,.61),hit(3,.92)])]),
    track("hat","Chimbal rápido","hat",.44,[clip(0,4,repeats*2,Array.from({length:16},(_,i)=>hit(i*.25,i%4===0?.68:.39,.05)))]),
    track("bass808","Sub 808","808",.86,[clip(0,8,repeats,[
      note(0,.8,36,.9),note(1.5,.45,36,.82),note(2.75,1,34,.82),
      note(4,.8,33,.90),note(5.5,.4,33,.8),note(6.75,1,31,.8)])]),
    track("hook","Sintetizador","synth-lead",.33,[clip(0,8,repeats,[
      note(.5,.22,72,.6),note(1,.25,75,.52),note(3,.5,70,.65),
      note(4.5,.22,72,.6),note(5,.25,75,.52),note(7,.5,67,.65)])])
  ];
  if(style==="pagode")return [
    track("cavaquinho","Cavaquinho sincopado","cavaquinho",.58,[clip(0,8,repeats,[
      ...chord(.5,[62,66,69],.24,.53),...chord(1.5,[62,66,69],.26,.61),
      ...chord(2.75,[62,66,69],.22,.57),...chord(3.5,[62,66,69],.23,.56),
      ...chord(4.5,[60,64,67],.24,.53),...chord(5.5,[60,64,67],.26,.6),
      ...chord(6.75,[60,64,67],.22,.56),...chord(7.5,[60,64,67],.23,.58)])],.13),
    track("surdo","Surdo","surdo",.78,[clip(0,4,repeats*2,[hit(0,.84,.45),hit(2,.95,.43)])]),
    track("pandeiro","Pandeiro","pandeiro",.62,[clip(0,4,repeats*2,Array.from({length:8},(_,i)=>hit(i*.5,i%2?.50:.75,.15)))]),
    track("tamborim","Tamborim","tamborim",.45,[clip(0,4,repeats*2,[hit(.75,.6),hit(1.5,.68),hit(2.75,.83),hit(3.5,.6)])]),
    track("bass","Baixo","bass",.61,[clip(0,8,repeats,[note(0,1.6,38,.73),note(2,.85,45,.5),note(4,1.6,36,.71),note(6,.85,43,.5)])]),
    track("melody","Linha melódica","flute",.29,[clip(8,8,Math.max(1,repeats-1),[note(0,.9,74,.58),note(1,1,72,.54),note(3,.8,71,.51),note(4.5,1.1,69,.57),note(6,1.2,71,.49)])],-.13)
  ];
  if(style==="lofi")return [
    track("keys","Teclas suaves","electric-piano",.58,[clip(0,16,Math.ceil(repeats/2),[
      ...chord(0,[60,64,67,71],3.5,.5),...chord(4,[57,60,64,69],3.5,.46),
      ...chord(8,[53,57,60,64],3.5,.5),...chord(12,[55,59,62,65],3.5,.46)])],-.17),
    track("bass","Baixo arredondado","bass",.59,[clip(0,16,Math.ceil(repeats/2),[note(0,3,36,.7),note(4,3,33,.65),note(8,3,29,.65),note(12,3,31,.69)])]),
    track("kick","Bumbo leve","kick",.48,[clip(0,4,repeats*2,[hit(0,.73),hit(2.5,.50)])]),
    track("snare","Caixa suave","snare",.36,[clip(0,4,repeats*2,[hit(1,.6),hit(3,.55)])]),
    track("hat","Chimbal suave","hat",.35,[clip(0,4,repeats*2,[hit(.5,.33,.07),hit(1.5,.4,.07),hit(2.5,.32,.07),hit(3.5,.4,.07)])]),
    track("lead","Melodia espaçada","pluck",.43,[clip(0,16,Math.ceil(repeats/2),[
      note(1,.8,76,.48),note(2.5,1.3,74,.54),note(5,.9,72,.5),
      note(7,1.1,69,.57),note(9,.8,72,.5),note(10.5,1.1,76,.54),
      note(13,1.4,71,.5)])],.2)
  ];
  // Original suspense arrangement: low cinematic pulses, sparse piano and dark pad.
  return [
    track("drone","Drone grave","sub-bass",.77,[clip(0,16,Math.ceil(repeats/2),[
      note(0,7.7,36,.78),note(8,7.7,33,.74)])]),
    track("pulse","Pulso sombrio","808",.45,[clip(0,8,repeats,[
      note(0,.9,36,.66),note(3,.7,36,.47),note(5.5,1.1,33,.53)])]),
    track("piano","Piano isolado","piano",.44,[clip(0,16,Math.ceil(repeats/2),[
      note(1,1.35,60,.53),note(4,1.4,63,.43),note(7.25,2,55,.47),
      note(10,1.2,58,.44),note(13,2,60,.53)])],.13),
    track("strings","Cordas escuras","strings",.29,[clip(0,16,Math.ceil(repeats/2),[
      ...chord(0,[48,55,60],7.8,.39),...chord(8,[45,52,57],7.8,.38)])],-.19),
    track("lowtom","Percussão distante","tom",.35,[clip(0,8,repeats,[hit(0,.53,.35),hit(6.5,.44,.3)])])
  ];
}
export const STYLES=["cinematic","lofi","rock","funk","pagode"];
export function createStylePreset(style="cinematic",durationSeconds=600){
  if(!STYLES.includes(style))throw Error("Estilo não reconhecido.");
  const bpms={cinematic:68,lofi:76,rock:124,funk:150,pagode:96},bpm=bpms[style],beats=durationSeconds*bpm/60;
  const repetitions=Math.ceil(beats/8);
  const names={cinematic:"Trilha cinematográfica sombria",lofi:"Lo-fi instrumental",rock:"Rock instrumental",funk:"Funk instrumental",pagode:"Pagode instrumental"};
  const score={schemaVersion:2,title:names[style],durationSeconds,bpm,beatsPerBar:4,
    seed:8008,masterVolume:.72,style,automation:[
      {time:0,volume:.65,intensity:.38},
      {time:durationSeconds*.35,volume:.7,intensity:.52},
      {time:durationSeconds*.75,volume:.73,intensity:.66},
      {time:durationSeconds*.94,volume:.60,intensity:.45},
      {time:durationSeconds,volume:0,intensity:.20}
    ],tracks:styleTracks(style,repetitions)};
  return validateScore(score);
}
function validateAutomation(score){
  if(!Array.isArray(score.automation)||score.automation.length<2||score.automation.length>64)
    throw Error("Defina entre 2 e 64 pontos de automação.");
  score.automation.forEach((point,index)=>{
    if(!point||typeof point!=="object")throw Error("Ponto de automação inválido.");
    limits(point.time,0,score.durationSeconds,"Tempo");
    limits(point.volume,0,1,"Volume");
    limits(point.intensity,0,1,"Tensão");
    if(index&&point.time<=score.automation[index-1].time)
      throw Error("Os tempos devem estar em ordem crescente e sem duplicatas.");
  });
  if(score.automation[0].time!==0||score.automation.at(-1).time!==score.durationSeconds)
    throw Error("Automação deve começar em 0 e terminar na duração da música.");
}
const validNote=(n,maxBeat)=>{
  if(!n||typeof n!=="object")throw Error("Nota musical inválida.");
  limits(n.beat,0,maxBeat,"Posição da nota em beats");
  limits(n.durationBeats,.015,64,"Duração da nota em beats");
  integer(n.pitch,24,108,"Altura MIDI");
  limits(n.velocity,.001,1,"Velocidade da nota");
};
function validateV2(score){
  if(score.style!==undefined&&typeof score.style!=="string")throw Error("Nome do estilo inválido.");
  integer(score.beatsPerBar,1,12,"Batidas por compasso");
  if(!Array.isArray(score.tracks)||score.tracks.length<1||score.tracks.length>32)
    throw Error("A composição deve conter entre 1 e 32 faixas.");
  const ids=new Set(),maxBeats=score.durationSeconds*score.bpm/60;
  let events=0;
  score.tracks.forEach((t,index)=>{
    if(!t||typeof t!=="object"||typeof t.id!=="string"||!/^[a-zA-Z0-9_-]{1,40}$/.test(t.id)||ids.has(t.id))
      throw Error("ID de faixa inválido ou repetido na posição "+index+".");
    ids.add(t.id);
    if(typeof t.name!=="string"||!t.name.trim()||t.name.length>80)
      throw Error("Nome de faixa inválido.");
    if(!INSTRUMENTS.includes(t.instrument))throw Error("Instrumento não reconhecido: "+t.instrument);
    if(t.sound!==undefined){
      if(!t.sound||typeof t.sound!=="object"||Array.isArray(t.sound))
        throw Error("Configuração do sintetizador inválida.");
      const waves=["sine","triangle","square","sawtooth"];
      if(t.sound.wave!==undefined&&!waves.includes(t.sound.wave))
        throw Error("Onda do sintetizador inválida.");
      if(t.sound.layerWave!==undefined&&!waves.includes(t.sound.layerWave))
        throw Error("Onda da camada adicional inválida.");
      for(const [key,min,max] of [
        ["cutoff",80,18000],["attack",.001,3],["release",.005,6],
        ["layerGain",0,1],["detune",-1200,1200],["amp",0,1]
      ]){
        if(t.sound[key]!==undefined)limits(t.sound[key],min,max,"Parâmetro "+key);
      }
    }
    limits(t.gain,0,1,"Volume da faixa");
    if(t.pan!==undefined)limits(t.pan,-1,1,"Panorama");
    if(t.muted!==undefined&&typeof t.muted!=="boolean")throw Error("Mute deve ser booleano.");
    if(!Array.isArray(t.notes)||t.notes.length>3000)throw Error("Notas diretas da faixa inválidas.");
    if(!Array.isArray(t.clips)||t.clips.length>128)throw Error("Clipes da faixa inválidos.");
    t.notes.forEach(n=>{validNote(n,maxBeats);events++;});
    t.clips.forEach(c=>{
      if(!c||typeof c!=="object")throw Error("Clipe inválido.");
      limits(c.startBeat,0,maxBeats,"Início do clipe");
      limits(c.lengthBeats,.125,256,"Comprimento do clipe");
      integer(c.repeats,1,2000,"Repetições do clipe");
      if(!Array.isArray(c.notes)||c.notes.length>512)throw Error("Notas do clipe inválidas.");
      c.notes.forEach(n=>{
        validNote(n,c.lengthBeats);
        if(n.beat+n.durationBeats>c.lengthBeats+1e-7)throw Error("Nota ultrapassa o tamanho do clipe.");
      });
      const active=Math.max(0,Math.min(c.repeats,Math.ceil((maxBeats-c.startBeat)/c.lengthBeats)));
      events+=active*c.notes.length;
    });
  });
  if(events>30000)throw Error("Composição muito densa: máximo de 30.000 eventos audíveis.");
}
export function validateScore(value){
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("JSON musical inválido.");
  const score=structuredClone(value),v2=score.schemaVersion===2;
  if(score.schemaVersion!==undefined&&!v2)throw Error("Versão de JSON musical não suportada.");
  if(typeof score.title!=="string"||!score.title.trim()||score.title.length>120)
    throw Error("Informe um título de até 120 caracteres.");
  limits(score.durationSeconds,5,900,"Duração");
  limits(score.bpm,v2?40:45,v2?240:130,"BPM");
  integer(score.seed,0,2147483647,"Seed");
  limits(score.masterVolume,0,1,"Volume geral");
  validateAutomation(score);
  if(v2)validateV2(score);
  else {
    if(!["tense","warm","melancholic"].includes(score.mode))throw Error("Clima musical inválido.");
    if(!["sparse","balanced","none"].includes(score.melody))throw Error("Modo de melodia inválido.");
    if(!Array.isArray(score.melodyNotes)||score.melodyNotes.length>3000)throw Error("Melodia manual inválida.");
    for(const n of score.melodyNotes){
      if(!n||typeof n!=="object")throw Error("Nota manual inválida.");
      limits(n.time,0,score.durationSeconds,"Tempo da nota");
      limits(n.duration,.05,16,"Duração da nota");
      integer(n.pitch,36,96,"Altura MIDI");
      limits(n.velocity,.01,1,"Intensidade da nota");
      if(n.time+n.duration>score.durationSeconds+1e-5)throw Error("A nota manual ultrapassa a duração.");
    }
  }
  return score;
}
export function levelAt(score,time){
  const points=score.automation,t=Math.max(0,Math.min(time,score.durationSeconds));
  for(let i=1;i<points.length;i++){
    if(t<=points[i].time){
      const a=points[i-1],b=points[i],f=(t-a.time)/(b.time-a.time);
      return {volume:a.volume+(b.volume-a.volume)*f,
        intensity:a.intensity+(b.intensity-a.intensity)*f};
    }
  }
  const last=points.at(-1);return {volume:last.volume,intensity:last.intensity};
}
