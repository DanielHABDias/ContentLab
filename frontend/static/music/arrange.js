import {levelAt} from "./model.js";
const chords = {
  tense: [[50,53,57,60,64],[46,50,53,57,60],[43,46,50,53,57],[45,49,52,55,58]],
  warm: [[48,52,55,59,62],[45,48,52,55,59],[41,45,48,52,55],[43,47,50,53,57]],
  melancholic: [[50,53,57,60,64],[46,50,53,57,60],[48,52,55,59,62],[45,48,52,55,59]]
};
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let x = Math.imul(state ^ state >>> 15, 1 | state);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}
export function arrange(score, endSeconds = score.durationSeconds) {
  const random = seeded(score.seed), beat = 60 / score.bpm, bar = 4 * beat;
  const end = Math.min(endSeconds, score.durationSeconds);
  const events = [];
  const add = (start, duration, pitch, velocity, voice) => {
    if(start >= end || duration <= 0)return;
    events.push({start, duration:Math.min(duration, end - start), pitch, velocity, voice});
  };
  const progression = chords[score.mode], bars = Math.ceil(end / bar);
  for(let index = 0; index < bars; index++) {
    const start = index * bar, tones = progression[index % progression.length];
    const intensity = levelAt(score, start).intensity;
    const root = tones[0] - 12;
    for(const pitch of tones.slice(1))add(start, bar * .98, pitch, .15 + intensity * .06, "pad");
    add(start, bar * .80, root, .26 + intensity * .08, "bass");
    if(intensity > .32)add(start + beat * 2, beat * 1.5, root + 7, .16, "bass");
    for(let n = 0; n < 2; n++){
      const t = start + n * 2 * beat + (random() - .5) * .025;
      for(const pitch of tones.slice(1, 4))
        add(Math.max(0,t), beat * (.60 + random() * .16), pitch + 12, .10 + intensity * .05, "keys");
    }
    const density = score.melody === "balanced" ? .80 : score.melody === "sparse" ? .37 : 0;
    const steps = [0,1,2,3,4,5,6,7];
    let last = tones[2] + 12;
    for(const step of steps){
      if(random() > density * (.62 + intensity * .3))continue;
      const candidates = [tones[2] + 12,tones[3] + 12,tones[4] + 12,tones[1] + 24];
      const note = candidates.reduce((best,next)=>Math.abs(next-last) < Math.abs(best-last) ? next : best,candidates[0]);
      const pitch = random() < .35 ? candidates[Math.floor(random() * candidates.length)] : note;
      const offset = (random() - .5) * .055;
      add(Math.max(0,start + step * beat / 2 + offset), beat * (.34 + random() * .48),
        pitch, .12 + intensity * .07, "lead");
      last = pitch;
    }
    if(intensity > .20){
      add(start, .27, 38, .24 + intensity * .12, "kick");
      add(start + beat * 2, .23, 38, .17 + intensity * .08, "kick");
      for(const i of [1,3])add(start + beat * i, .14, 38, .14 + intensity * .11, "snare");
      if(intensity > .40)for(let i=0;i<8;i++){
        const position = start + beat * i / 2;
        if(random() < .72)add(position, .07, 38, .045 + intensity * .04, "hat");
      }
    }
  }
  if(score.melodyNotes.length){
    // Explicit MIDI notes replace the generated lead, but keep harmony and rhythm.
    return [...events.filter(event=>event.voice!=="lead"),
      ...score.melodyNotes.filter(note=>note.time<end).map(note=>({
        start:note.time,duration:Math.min(note.duration,end-note.time),
        pitch:note.pitch,velocity:note.velocity,voice:"lead"}))].sort((a,b)=>a.start-b.start);
  }
  return events.sort((a,b)=>a.start-b.start);
}
