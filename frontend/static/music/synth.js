import {arrange,seeded} from "./arrange.js";
import {levelAt,DRUM_INSTRUMENTS} from "./model.js";
import {loadSamples,sampleForEvent} from "./samples.js";
const RATE=48000;
const freq=midi=>440*2**((midi-69)/12);
const tone={
  "sub-bass":{wave:"sine",cutoff:230,amp:.54,attack:.025,release:.20},
  "808":{wave:"sine",cutoff:330,amp:.63,attack:.01,release:.40},
  bass:{wave:"triangle",cutoff:650,amp:.42,attack:.014,release:.17},
  piano:{wave:"triangle",cutoff:2500,amp:.40,attack:.006,release:.23},
  "electric-piano":{wave:"sine",cutoff:2200,amp:.42,attack:.006,release:.23},
  pad:{wave:"sawtooth",cutoff:850,amp:.18,attack:.18,release:.55},
  strings:{wave:"sawtooth",cutoff:1450,amp:.17,attack:.22,release:.46},
  organ:{wave:"sine",cutoff:2200,amp:.32,attack:.012,release:.13},
  "synth-lead":{wave:"sawtooth",cutoff:3500,amp:.27,attack:.01,release:.15},
  pluck:{wave:"triangle",cutoff:2400,amp:.32,attack:.004,release:.15},
  guitar:{wave:"sawtooth",cutoff:2100,amp:.23,attack:.005,release:.16},
  "distorted-guitar":{wave:"sawtooth",cutoff:1700,amp:.23,attack:.006,release:.19},
  cavaquinho:{wave:"triangle",cutoff:4100,amp:.35,attack:.003,release:.08},
  flute:{wave:"sine",cutoff:4000,amp:.36,attack:.06,release:.18},
  brass:{wave:"sawtooth",cutoff:2100,amp:.22,attack:.05,release:.2},
  keys:{wave:"triangle",cutoff:2000,amp:.32,attack:.012,release:.16},
  lead:{wave:"sine",cutoff:1450,amp:.24,attack:.02,release:.16}
};
function envelope(gain,start,duration,peak,attack=.02,release=.15){
  const g=gain.gain,end=Math.max(start+.005,start+duration);
  const rise=Math.max(.002,Math.min(attack,duration*.3));
  const tail=Math.max(.002,Math.min(release,duration*.55));
  g.setValueAtTime(0,start);
  g.linearRampToValueAtTime(Math.max(.00001,peak),start+rise);
  g.exponentialRampToValueAtTime(Math.max(.0001,peak*.55),
    Math.max(start+rise+.001,end-tail));
  g.linearRampToValueAtTime(0,end);
}
function connectPan(ctx,source,dest,pan){
  if(pan&&ctx.createStereoPanner){
    const p=ctx.createStereoPanner();p.pan.value=pan;
    source.connect(p);p.connect(dest);
  }else source.connect(dest);
}
function sampledInstrument(ctx,destination,event,offset,duration,samples){
  const sourceInfo=sampleForEvent(event);
  if(!sourceInfo)return false;
  const buffer=samples.get(sourceInfo.key);
  if(!buffer)throw Error("Gravação CC0 não carregada: "+sourceInfo.file);
  const start=Math.max(0,event.start-offset);
  const elapsed=Math.max(0,offset-event.start);
  const wanted=Math.min(event.duration-elapsed,duration-start);
  const sourceOffset=elapsed*sourceInfo.playbackRate;
  const available=(buffer.duration-sourceOffset)/sourceInfo.playbackRate;
  const length=Math.min(wanted,available);
  if(length<=.002||start>=duration)return true;
  const src=ctx.createBufferSource();src.buffer=buffer;
  src.playbackRate.value=sourceInfo.playbackRate;
  const gain=ctx.createGain();
  const peak=Math.min(.9,event.velocity*.86);
  const rise=Math.min(.008,length*.20),tail=Math.min(.09,length*.25);
  gain.gain.setValueAtTime(0,start);
  gain.gain.linearRampToValueAtTime(peak,start+rise);
  gain.gain.setValueAtTime(peak,Math.max(start+rise,start+length-tail));
  gain.gain.linearRampToValueAtTime(0,start+length);
  let end=gain;
  if(event.instrument==="distorted-guitar"){
    const distortion=ctx.createWaveShaper();
    const amount=3.2,curve=new Float32Array(4096);
    for(let i=0;i<curve.length;i++){
      const x=i*2/(curve.length-1)-1;
      curve[i]=Math.tanh(amount*x)/Math.tanh(amount);
    }
    distortion.curve=curve;distortion.oversample="4x";
    gain.connect(distortion);
    const lowpass=ctx.createBiquadFilter();lowpass.type="lowpass";
    lowpass.frequency.value=3800;distortion.connect(lowpass);end=lowpass;
  }
  connectPan(ctx,end,destination,event.pan);
  src.connect(gain);
  src.start(start,sourceOffset,length);
  return true;
}

function tonal(ctx,destination,event,offset,duration,samples){
  if(sampledInstrument(ctx,destination,event,offset,duration,samples))return;
  const start=Math.max(0,event.start-offset),elapsed=Math.max(0,offset-event.start);
  if(start>=duration)return;
  const sustain=Math.min(event.duration-elapsed,duration-start);
  if(sustain<=0)return;
  const standard=tone[event.instrument||event.voice]||tone.pluck;
  const custom=event.sound||{};
  const preset={...standard,...(custom.wave?{wave:custom.wave}:{}),...(custom.cutoff?{cutoff:custom.cutoff}:{}),
    ...(custom.attack?{attack:custom.attack}:{}),...(custom.release?{release:custom.release}:{}),
    ...(custom.amp!==undefined?{amp:custom.amp}:{})};
  const filter=ctx.createBiquadFilter();filter.type="lowpass";
  filter.frequency.value=preset.cutoff;filter.Q.value=.58;
  connectPan(ctx,filter,destination,event.pan);
  const gain=ctx.createGain();gain.connect(filter);
  const amp=event.velocity*preset.amp;
  envelope(gain,start,sustain,amp,preset.attack,preset.release);
  const osc=ctx.createOscillator();osc.type=preset.wave;osc.frequency.value=freq(event.pitch);
  if(event.sound?.detune!==undefined)osc.detune.value=event.sound.detune;
  osc.connect(gain);osc.start(start);osc.stop(start+sustain);
  if(event.sound?.layerWave||["piano","electric-piano","guitar","distorted-guitar","cavaquinho","strings","organ"].includes(event.instrument)){
    const o=ctx.createOscillator();o.type=event.sound?.layerWave|| (event.instrument==="organ"?"sine":"triangle");
    o.frequency.value=freq(event.pitch)*(event.instrument==="organ"?2:1.997);
    const layer=ctx.createGain();layer.gain.value=event.sound?.layerGain??.095;layer.connect(gain);
    o.connect(layer);o.start(start);o.stop(start+sustain);
  }
}
function noiseBuffer(ctx,seed){
  const buffer=ctx.createBuffer(1,Math.floor(RATE*.75),RATE),data=buffer.getChannelData(0),rand=seeded(seed+191);
  for(let i=0;i<data.length;i++)data[i]=(rand()*2-1)*.72;
  return buffer;
}
function percussion(ctx,destination,event,offset,duration,noise){
  if(event.start<offset)return; // Do not retrigger a transient before a preview.
  const start=Math.max(0,event.start-offset);
  if(start>=duration)return;
  const kind=event.instrument||event.voice;
  const length=Math.min(event.duration,duration-start);
  if(length<=0)return;
  const gain=ctx.createGain();connectPan(ctx,gain,destination,event.pan);
  const low=["kick","surdo","tom"].includes(kind);
  if(low){
    envelope(gain,start,length,event.velocity*(kind==="kick"?.55:.43),.003,.10);
    const osc=ctx.createOscillator();osc.type="sine";
    const a=kind==="kick"?115:kind==="surdo"?95:180,b=kind==="kick"?48:kind==="surdo"?55:85;
    osc.frequency.setValueAtTime(a,start);
    osc.frequency.exponentialRampToValueAtTime(b,start+Math.min(.14,length));
    osc.connect(gain);osc.start(start);osc.stop(start+length);
    return;
  }
  const filter=ctx.createBiquadFilter();
  filter.type=["snare","clap","pandeiro"].includes(kind)?"bandpass":"highpass";
  const hz={snare:1600,clap:1950,hat:6300,shaker:5600,pandeiro:4200,tamborim:3400,rim:5000,cowbell:2700};
  filter.frequency.value=hz[kind]||5200;filter.Q.value=kind==="cowbell"?4:.65;
  const source=ctx.createBufferSource();source.buffer=noise;source.connect(filter).connect(gain);
  envelope(gain,start,length,event.velocity*(kind==="hat"?.22:kind==="shaker"?.19:.36),.002,.06);
  source.start(start,0,Math.min(length,noise.duration));
  if(["tamborim","cowbell","rim"].includes(kind)){
    const osc=ctx.createOscillator();osc.type=kind==="cowbell"?"square":"triangle";
    osc.frequency.value=kind==="cowbell"?580:kind==="rim"?950:720;
    const p=ctx.createGain();p.gain.value=.12;p.connect(gain);osc.connect(p);
    osc.start(start);osc.stop(start+length);
  }
}
function routeMaster(ctx,score,duration,offset){
  const master=ctx.createGain(),comp=ctx.createDynamicsCompressor();
  comp.threshold.value=-20;comp.knee.value=17;comp.ratio.value=2.6;
  comp.attack.value=.013;comp.release.value=.25;
  master.connect(comp).connect(ctx.destination);
  const delay=ctx.createDelay(.8),feedback=ctx.createGain(),wet=ctx.createGain();
  delay.delayTime.value=.29;feedback.gain.value=.17;wet.gain.value=.11;
  master.connect(delay);delay.connect(feedback).connect(delay);delay.connect(wet).connect(comp);
  const automation=score.automation;
  master.gain.setValueAtTime(score.masterVolume*levelAt(score,offset).volume,0);
  for(let i=1;i<automation.length;i++){
    const point=automation[i];
    if(point.time<=offset)continue;
    if(point.time>offset+duration){
      master.gain.linearRampToValueAtTime(
        score.masterVolume*levelAt(score,offset+duration).volume,duration);
      break;
    }
    master.gain.linearRampToValueAtTime(score.masterVolume*point.volume,point.time-offset);
  }
  return master;
}
export async function renderAudio(score,seconds=score.durationSeconds,startSeconds=0){
  const offset=Math.max(0,Math.min(startSeconds,score.durationSeconds-1));
  const duration=Math.min(score.durationSeconds-offset,seconds);
  const ctx=new OfflineAudioContext(2,Math.ceil(duration*RATE),RATE);
  const master=routeMaster(ctx,score,duration,offset),noise=noiseBuffer(ctx,score.seed);
  const events=arrange(score,offset+duration)
    .filter(event=>event.start+event.duration>offset);
  const samples=await loadSamples(ctx,events);
  for(const event of events){
    if(DRUM_INSTRUMENTS.includes(event.instrument||event.voice))
      percussion(ctx,master,event,offset,duration,noise);
    else tonal(ctx,master,event,offset,duration,samples);
  }
  return ctx.startRendering();
}
