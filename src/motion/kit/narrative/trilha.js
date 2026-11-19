/**
 * Linha do tempo navegável (cena trilhaViva). A linha pode ter quantos capítulos a história pedir; cada beat é
 * um movimento de câmera sobre ela: de um capítulo (`de`) a outro (`ate`), opcionalmente saindo de dentro do
 * primeiro (`sair`) e entrando no último (`entrar`). Indo para trás, a câmera rebobina. Imagem, vídeo e SFX
 * leem o mesmo cronograma, então som e corte batem no mesmo quadro.
 *
 * Capítulos são numerados a partir de 1, como a pessoa fala ("entra no capítulo 2").
 */
export const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = t => t * t * (3 - 2 * t);

/** Normaliza as props: aceita `capitulos` ou o antigo `fragmentos`, e limita de/ate ao que existe. */
export function timelineProps(props = {}) {
  const chapters = props.capitulos || props.fragmentos || [];
  const n = chapters.length;
  if (!n) return { chapters, n, from: 0, to: 0, enter: false, exit: false, rewind: false };
  const pick = (v, fallback) => Math.max(1, Math.min(n, Math.round(Number.isFinite(v) ? v : fallback)));
  const legacy = !props.capitulos && props.fragmentos; // a trilha antiga percorria tudo e mergulhava no último
  const from = pick(props.de, 1), to = pick(props.ate, n);
  const enter = props.entrar ?? (legacy ? props.mergulhar !== false : false);
  return { chapters, n, from, to, enter: Boolean(enter), exit: Boolean(props.sair), rewind: to < from };
}

/** Frações do beat em que cada fase começa e termina. */
export function timelineSchedule(props) {
  const p = timelineProps(props);
  const exitEnd = p.exit ? .26 : 0;
  const blackout = p.rewind ? .1 : 0;
  const travelStart = Math.max(exitEnd, blackout) + (p.exit || p.rewind ? .02 : .06);
  const enterStart = p.enter ? .68 : 1;
  const travelEnd = p.enter ? .64 : .9;
  return { ...p, exitEnd, blackout, travelStart, travelEnd: Math.max(travelStart + .05, travelEnd), enterStart };
}

/**
 * Estado da câmera num quadro: `pos` é a posição em capítulos (1 = primeiro, fracionária durante a viagem),
 * `zoom` vai de 0 (linha inteira) a 1 (capítulo em tela cheia) e `inside` diz qual capítulo está em tela cheia.
 */
export function timelineState(frame, len, props) {
  const s = timelineSchedule(props); const t = clamp01(frame / Math.max(1, len - 1));
  if (!s.n) return { ...s, t, pos: 0, zoom: 0, inside: 0, current: 0, moving: false, rewinding: false };
  const travel = smooth(clamp01((t - s.travelStart) / (s.travelEnd - s.travelStart)));
  const pos = s.from + (s.to - s.from) * travel;
  const out = s.exit ? 1 - smooth(clamp01(t / s.exitEnd)) : 0;
  const into = s.enter ? smooth(clamp01((t - s.enterStart) / (1 - s.enterStart - .04))) : 0;
  const zoom = Math.max(out, into);
  const inside = out > 0 ? s.from : into > 0 ? s.to : 0;
  const moving = t > s.travelStart && t < s.travelEnd && s.from !== s.to;
  return { ...s, t, pos, zoom, inside, current: Math.round(pos), moving, rewinding: s.rewind && t < s.travelEnd + .03, dark: s.rewind && t < s.blackout ? Math.sin(Math.PI * t / s.blackout) : 0 };
}

/** Frame (no beat) em que a câmera chega em cada capítulo pelo caminho; usado pelos SFX de passagem. */
export function passageFrames(len, props) {
  const s = timelineSchedule(props); if (!s.n || s.from === s.to) return [];
  const step = s.to > s.from ? 1 : -1; const frames = [];
  for (let c = s.from + step; step > 0 ? c <= s.to : c >= s.to; c += step) {
    const k = Math.abs(c - s.from) / Math.abs(s.to - s.from);
    // inverte o smoothstep para achar quando a posição cruza o capítulo
    let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (smooth(m) < k) lo = m; else hi = m; }
    frames.push({ chapter: c, frame: Math.round((s.travelStart + (s.travelEnd - s.travelStart) * hi) * (len - 1)) });
  }
  return frames;
}

/** Linha suave: y em função de x (px) para a linha ondular sem perder a leitura de linha do tempo. */
export const lineY = (x, height, V) => height * (V ? .64 : .56) + Math.sin(x / 640) * height * (V ? .015 : .045);
