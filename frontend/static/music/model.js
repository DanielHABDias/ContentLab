// Content Lab music score: JSON contract and deterministic presets.
export function createPreset(durationSeconds = 600) {
  return {
    title: "VD 008 - Sombras do Carnificina",
    durationSeconds, bpm: 72, seed: 8008,
    mode: "tense", melody: "sparse", masterVolume: 0.72,
    automation: [
      {time: 0, volume: .30, intensity: .20},
      {time: durationSeconds * .20, volume: .34, intensity: .32},
      {time: durationSeconds * .45, volume: .42, intensity: .52},
      {time: durationSeconds * .75, volume: .55, intensity: .82},
      {time: durationSeconds * .90, volume: .50, intensity: .73},
      {time: durationSeconds, volume: 0, intensity: .12}
    ],
    melodyNotes: []
  };
}
const number = (value, min, max, name) => {
  if(typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw Error(name + " deve estar entre " + min + " e " + max + ".");
  return value;
};
export function validateScore(value) {
  if(!value || typeof value !== "object" || Array.isArray(value))throw Error("JSON musical inválido.");
  const score = structuredClone(value);
  if(typeof score.title !== "string" || !score.title.trim() || score.title.length > 120)throw Error("Informe um título de até 120 caracteres.");
  number(score.durationSeconds, 5, 900, "Duração");
  number(score.bpm, 45, 130, "BPM");
  number(score.seed, 0, 2147483647, "Seed");
  if(!Number.isInteger(score.seed))throw Error("Seed precisa ser um número inteiro.");
  number(score.masterVolume, 0, 1, "Volume geral");
  if(!["tense","warm","melancholic"].includes(score.mode))throw Error("Clima musical inválido.");
  if(!["sparse","balanced","none"].includes(score.melody))throw Error("Modo de melodia inválido.");
  if(!Array.isArray(score.automation) || score.automation.length < 2 || score.automation.length > 64)
    throw Error("Defina entre 2 e 64 pontos de automação.");
  for(let index = 0; index < score.automation.length; index++) {
    const point = score.automation[index];
    if(!point || typeof point !== "object")throw Error("Ponto de automação inválido.");
    number(point.time, 0, score.durationSeconds, "Tempo");
    number(point.volume, 0, 1, "Volume");
    number(point.intensity, 0, 1, "Tensão");
    if(index && point.time <= score.automation[index - 1].time)throw Error("Os tempos devem estar em ordem crescente e sem duplicatas.");
  }
  if(score.automation[0].time !== 0 || score.automation.at(-1).time !== score.durationSeconds)
    throw Error("Automação deve começar em 0 e terminar na duração da música.");
  if(!Array.isArray(score.melodyNotes) || score.melodyNotes.length > 3000)throw Error("Melodia manual inválida.");
  for(const note of score.melodyNotes) {
    if(!note || typeof note !== "object")throw Error("Nota manual inválida.");
    number(note.time, 0, score.durationSeconds, "Tempo da nota");
    number(note.duration, .05, 16, "Duração da nota");
    number(note.pitch, 36, 96, "Altura MIDI");
    number(note.velocity, .01, 1, "Intensidade da nota");
    if(!Number.isInteger(note.pitch) || note.time + note.duration > score.durationSeconds + .00001)
      throw Error("A nota manual ultrapassa a duração ou possui pitch não inteiro.");
  }
  return score;
}
export function levelAt(score, time) {
  const points = score.automation, t = Math.max(0, Math.min(time, score.durationSeconds));
  for(let i = 1; i < points.length; i++){
    if(t <= points[i].time){
      const a = points[i - 1], b = points[i], f = (t - a.time) / (b.time - a.time);
      return {volume: a.volume + (b.volume - a.volume) * f,
        intensity: a.intensity + (b.intensity - a.intensity) * f};
    }
  }
  const last = points.at(-1);
  return {volume:last.volume,intensity:last.intensity};
}
