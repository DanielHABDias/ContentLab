import {arrange,seeded} from "./arrange.js";
import {levelAt} from "./model.js";
const RATE = 32000;
const freq = midi => 440 * 2 ** ((midi - 69) / 12);
function envelope(gain, start, duration, peak, release = .15) {
  const g = gain.gain, end = Math.max(start + .005, start + duration);
  const attack = Math.min(.035, duration * .20), tail = Math.min(release, duration * .55);
  g.setValueAtTime(0,start);
  g.linearRampToValueAtTime(peak,start+attack);
  g.exponentialRampToValueAtTime(Math.max(.0001,peak*.55),Math.max(start+attack+.001,end-tail));
  g.linearRampToValueAtTime(0,end);
}
function tonal(ctx, destination, event, offset, duration) {
  const start = Math.max(0,event.start-offset);
  if(start >= duration)return;
  const elapsed = Math.max(0,offset-event.start);
  const sustain = Math.min(event.duration-elapsed,duration-start);
  if(sustain <= 0)return;
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = event.voice === "pad" ? 950 : event.voice === "keys" ? 2000 : event.voice === "bass" ? 380 : 1450;
  filter.Q.value = .38;
  gain.connect(filter).connect(destination);
  const voice = event.voice;
  const amp = event.velocity * (voice === "bass" ? .38 : voice === "pad" ? .22 : voice === "keys" ? .32 : .24);
  envelope(gain,start,sustain,amp,voice==="pad"?.56:.16);
  const osc = ctx.createOscillator();
  osc.type = voice==="keys" ? "triangle" : voice==="pad" ? "sawtooth" : "sine";
  osc.frequency.value = freq(event.pitch);
  if(voice==="keys")osc.detune.value = -5;
  osc.connect(gain);osc.start(start);osc.stop(start+sustain);
}
function noiseBuffer(ctx,seed) {
  const buffer=ctx.createBuffer(1,Math.floor(RATE*.6),RATE),data=buffer.getChannelData(0),random=seeded(seed+191);
  for(let i=0;i<data.length;i++)data[i]=(random()*2-1)*.75;
  return buffer;
}
function percussion(ctx,destination,event,offset,duration,noise) {
  // Do not retrigger a percussive transient that happened before the preview.
  if(event.start<offset)return;
  const start = Math.max(0,event.start-offset);
  if(start >= duration)return;
  const end = Math.min(event.duration,duration-start);
  const gain=ctx.createGain();
  gain.connect(destination);
  if(event.voice==="kick"){
    envelope(gain,start,end,event.velocity*.48,.09);
    const osc=ctx.createOscillator();osc.type="sine";
    osc.frequency.setValueAtTime(115,start);
    osc.frequency.exponentialRampToValueAtTime(47,start+Math.min(.16,end));
    osc.connect(gain);osc.start(start);osc.stop(start+end);
    return;
  }
  const src=ctx.createBufferSource();src.buffer=noise;
  const filter=ctx.createBiquadFilter();filter.type=event.voice==="snare"?"bandpass":"highpass";
  filter.frequency.value=event.voice==="snare"?1600:6300;
  src.connect(filter).connect(gain);
  envelope(gain,start,end,event.velocity*(event.voice==="hat"?.16:.38),Math.min(.08,end*.45));
  src.start(start,0,Math.min(end,noise.duration));
}
function routeMaster(ctx, score, duration, offset){
  const master=ctx.createGain(),comp=ctx.createDynamicsCompressor();
  comp.threshold.value=-20;comp.knee.value=17;comp.ratio.value=2.6;
  comp.attack.value=.013;comp.release.value=.25;
  master.connect(comp).connect(ctx.destination);
  // Single subtle feedback delay; reverb-like atmosphere, no external samples.
  const delay=ctx.createDelay(.8),feedback=ctx.createGain(),wet=ctx.createGain();
  delay.delayTime.value=.29;feedback.gain.value=.19;wet.gain.value=.13;
  master.connect(delay);delay.connect(feedback).connect(delay);delay.connect(wet).connect(comp);
  const automation=score.automation;
  master.gain.setValueAtTime(score.masterVolume*levelAt(score,offset).volume,0);
  for(let i=1;i<automation.length;i++){
    const point=automation[i];
    if(point.time<=offset)continue;
    if(point.time>offset+duration) {
      master.gain.linearRampToValueAtTime(
        score.masterVolume*levelAt(score,offset+duration).volume,duration);
      break;
    }
    master.gain.linearRampToValueAtTime(score.masterVolume*point.volume,point.time-offset);
  }
  return master;
}
export async function renderAudio(score, seconds = score.durationSeconds, startSeconds = 0) {
  const offset=Math.max(0,Math.min(startSeconds,score.durationSeconds-1));
  const duration=Math.min(score.durationSeconds-offset,seconds);
  const ctx=new OfflineAudioContext(2,Math.ceil(duration*RATE),RATE);
  const master=routeMaster(ctx,score,duration,offset),noise=noiseBuffer(ctx,score.seed);
  for(const event of arrange(score,offset+duration)){
    if(event.start+event.duration<=offset)continue;
    if(["kick","snare","hat"].includes(event.voice))percussion(ctx,master,event,offset,duration,noise);
    else tonal(ctx,master,event,offset,duration);
  }
  return ctx.startRendering();
}
