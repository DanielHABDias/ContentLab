// Real, licensed instrument recordings. Notes are sampled, not generated
// from an oscillator. CC0 collections from facebookincubator/Meta-open-sound.
const NOTE=["C","Cs","D","Ds","E","F","Fs","G","Gs","A","As","B"];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const noteName=midi=>NOTE[midi%12]+(Math.floor(midi/12)-1);
const acoustic={
  piano:{collection:"piano",low:21,high:108},
  guitar:{collection:"steel",low:40,high:84},
  "steel-guitar":{collection:"steel",low:40,high:84},
  "nylon-guitar":{collection:"nylon",low:40,high:83},
  "distorted-guitar":{collection:"steel",low:40,high:84}
};
export const SAMPLED_INSTRUMENTS=Object.freeze(Object.keys(acoustic));
const guitarString=(pitch,nylon)=>{
  if(pitch<45)return "LowE";
  if(pitch<=(nylon?63:65))return "A";
  if(pitch<=(nylon?68:70))return "D";
  if(pitch<=(nylon?73:75))return "G";
  if(pitch<=(nylon?77:79))return "B";
  return "HighE";
};
export function sampleForEvent(event){
  const config=acoustic[event.instrument||event.voice];
  if(!config)return null;
  const pitch=clamp(event.pitch,config.low,config.high);
  const layer=clamp(Math.round((event.rawVelocity??event.velocity)*3+.5),1,3);
  const suffix=noteName(pitch),tag="Vel0"+layer;
  let file;
  if(config.collection==="piano"){
    const pianoLayer=clamp(Math.round((event.rawVelocity??event.velocity)*4+.5),1,4);
    file="INSPiano_Vel0"+pianoLayer+"_"+suffix+"_01.ogg";
  }else if(config.collection==="nylon"){
    const style=layer===1?"Finger":"Pick";
    file="INSGuitarNylon_String"+guitarString(pitch,true)+"_"+tag+style+"_"+suffix+"_01.ogg";
  }else file="INSGuitarSteel_String"+guitarString(pitch,false)+"_"+tag+"_"+suffix+"_01.ogg";
  return {collection:config.collection,file,
    key:config.collection+"/"+file,
    playbackRate:2**((event.pitch-pitch)/12),
    license:"CC0-1.0"};
}
export async function loadSamples(ctx,events,onProgress=(loaded,total)=>{}){
  const needed=new Map();
  for(const event of events){
    const sample=sampleForEvent(event);
    if(sample)needed.set(sample.key,sample);
  }
  const samples=new Map(),queue=[...needed.values()];
  let cursor=0,loaded=0;
  async function worker(){
    while(cursor<queue.length){
      const item=queue[cursor++];
      const response=await fetch("/api/music/sample/"+item.collection+"/"+encodeURIComponent(item.file));
      if(!response.ok){
        const details=await response.text().catch(()=>"");
        throw Error("Não foi possível carregar a amostra real "+item.file+
          " (HTTP "+response.status+"). "+details.slice(0,180));
      }
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength<256)throw Error("Amostra de instrumento vazia: "+item.file);
      const audio=await ctx.decodeAudioData(bytes);
      if(!audio?.length||!audio.numberOfChannels)throw Error("Falha ao decodificar "+item.file);
      samples.set(item.key,audio);
      onProgress(++loaded,queue.length);
    }
  }
  await Promise.all(Array.from({length:Math.min(5,queue.length)},()=>worker()));
  return samples;
}
