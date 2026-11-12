// Cena DialogoHQ do plugin Diazverso 1.2.0, compilada por scripts/build-diazverso-scenes.mjs. Não editar à mão.
// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/HQComicPage.tsx
import { AbsoluteFill, Img, staticFile } from "remotion";
import { jsx } from "react/jsx-runtime";
function HQComicPage({ opacity = 100, src = staticFile("assets/brand/backgrounds/comic-page.png") }) {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) throw Error("opacity must be 0\u2013100");
  return /* @__PURE__ */ jsx(AbsoluteFill, { style: { pointerEvents: "none", opacity: opacity / 100, overflow: "hidden" }, children: /* @__PURE__ */ jsx(Img, { src, style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" } }) });
}

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/motion/hq-background.tsx
import React from "react";
import { AbsoluteFill as AbsoluteFill2, useCurrentFrame, useVideoConfig } from "remotion";
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
function hqGridOffset(time) {
  return (time * 28 % 84 + 84) % 84;
}
function hqPaperPose(time) {
  return Math.floor(Math.max(0, time) * 6) % 8;
}
function BackgroundLayer({ mode = "halftone", baseColor = "#162034", opacity = 100, paperTone = "dark", gridBaseColor = "#10101A", gridColor = "#858595", children }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const uid = React.useId().replace(/:/g, "");
  const stars = React.useMemo(() => mode === "stars" && opacity > 0 ? Array.from({ length: 270 }, (_, i) => {
    const rand2 = (n) => {
      const a = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return a - Math.floor(a);
    };
    return { phase: rand2(i + 5), x: rand2(i + 700) - 0.5, y: rand2(i + 1300) - 0.5, radius: 1 + rand2(i + 1700) * 5 };
  }) : [], [mode, opacity]);
  if (mode === "comic-page") return /* @__PURE__ */ jsx2(HQComicPage, { opacity });
  if (opacity === 0) return null;
  if (!["halftone", "solid", "stars", "film", "paper", "grid"].includes(mode)) throw new Error("mode: halftone, solid, stars, film, paper ou grid.");
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) throw new Error("opacity deve ser 0\u2013100 (%).");
  if (!/^#[0-9a-f]{6}$/i.test(baseColor)) throw new Error("baseColor deve usar #RRGGBB.");
  if (!["light", "dark"].includes(paperTone)) throw new Error("paperTone: light ou dark.");
  if (![gridBaseColor, gridColor].every((c) => /^#[0-9a-f]{6}$/i.test(c))) throw new Error("Cores da grade devem usar #RRGGBB.");
  if (mode === "halftone" || mode === "solid") return /* @__PURE__ */ jsx2(AbsoluteFill2, { style: { pointerEvents: "none", backgroundColor: baseColor, opacity: opacity / 100 }, children: mode === "halftone" && /* @__PURE__ */ jsx2(AbsoluteFill2, { style: { opacity: 0.24, backgroundImage: `radial-gradient(#080A11 ${Math.min(width, height) * 3e-3}px, transparent ${Math.min(width, height) * 36e-4}px)`, backgroundSize: `${Math.min(width, height) * 0.018}px ${Math.min(width, height) * 0.018}px` } }) });
  const H = 1e3, W = 1e3 * width / height;
  const rand = (n) => {
    const a = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return a - Math.floor(a);
  };
  const dots = /* @__PURE__ */ jsx2("pattern", { id: `${uid}dots`, width: "14", height: "14", patternUnits: "userSpaceOnUse", children: /* @__PURE__ */ jsx2("circle", { cx: "4", cy: "4", r: "1.7", fill: "#000000", opacity: ".16" }) });
  let content;
  if (mode === "stars") {
    content = /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: "#080B13" }),
      stars.map((star, i) => {
        const phase = (star.phase + t * 0.025) % 1, z = 0.18 + phase * 0.82;
        const x = W / 2 + star.x * W * 2.25 * z, y = H / 2 + star.y * H * 2.25 * z;
        const r = star.radius * z, opacity2 = Math.min(1, phase * 8, (1 - phase) * 10);
        return /* @__PURE__ */ jsxs("g", { opacity: opacity2, children: [
          /* @__PURE__ */ jsx2("circle", { cx: x + 1.4, cy: y + 1.4, r: r + 1, fill: "#000000" }),
          /* @__PURE__ */ jsx2("circle", { cx: x, cy: y, r, fill: i % 6 === 0 ? "#CCD6ED" : "#FFF8E6" }),
          r > 3.5 && /* @__PURE__ */ jsx2("path", { d: `M ${x - r * 0.4} ${y - r * 0.5} l ${r * 0.6} 0`, stroke: "white", strokeWidth: 1.1 })
        ] }, i);
      }),
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: `url(#${uid}dots)`, opacity: ".22" })
    ] });
  } else if (mode === "film") {
    const tick = Math.floor(t * 12);
    content = /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: "#10100F" }),
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: "#E3DDC8", opacity: 0.015 + rand(tick + 2400) * 0.018 }),
      Array.from({ length: 7 }, (_, i) => {
        const x = rand(i + 2500) * W + (rand(tick + i * 17) - 0.5) * 4;
        return /* @__PURE__ */ jsx2("path", { d: `M ${x} -10 Q ${x + 6} 350 ${x - 3} 660 T ${x + 4} 1010`, fill: "none", stroke: "#DDD6BC", strokeWidth: i % 3 === 0 ? 1.6 : 0.7, opacity: 0.12 + rand(tick + i) * 0.16 }, i);
      }),
      Array.from({ length: 70 }, (_, i) => {
        const x = rand(tick * 71 + i + 3e3) * W, y = rand(tick * 73 + i + 5e3) * H;
        return /* @__PURE__ */ jsx2("path", { d: `M ${x} ${y} q 6 -5 3 -12 t 5 -5`, fill: "none", stroke: "#EFE9CF", strokeWidth: 0.7 + rand(i) * 1.4, opacity: 0.08 + rand(i + 17) * 0.22 }, i);
      }),
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: `url(#${uid}dots)` }),
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: `url(#${uid}vignette)` })
    ] });
  } else if (mode === "paper") {
    const dark = paperTone === "dark", step = 135, pose = hqPaperPose(t);
    const cols = Math.ceil(W / step) + 1, rows = 9;
    const vertex = (x, y) => ({ x: x * step + (x > 0 && x < cols ? (rand(x + y * 31 + pose * 103) - 0.5) * 90 : 0), y: y * step + (y > 0 && y < rows ? (rand(x + y * 47 + 80 + pose * 103) - 0.5) * 85 : 0) });
    content = /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: dark ? "#252936" : "#EEE9DD" }),
      /* @__PURE__ */ jsx2("g", { children: Array.from({ length: cols * rows }, (_, i) => {
        const x = i % cols, y = Math.floor(i / cols), a = vertex(x, y), b = vertex(x + 1, y), c = vertex(x + 1, y + 1), d = vertex(x, y + 1);
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx2("polygon", { points: `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`, fill: rand(i + 91) > 0.5 ? "#FFFFFF" : "#000000", opacity: dark ? 0.035 + rand(i) * 0.08 : 0.025 + rand(i) * 0.1 }),
          /* @__PURE__ */ jsx2("polygon", { points: `${a.x},${a.y} ${c.x},${c.y} ${d.x},${d.y}`, fill: rand(i + 711) > 0.5 ? "#FFFFFF" : "#000000", opacity: dark ? 0.03 + rand(i + 30) * 0.07 : 0.02 + rand(i + 30) * 0.09 }),
          /* @__PURE__ */ jsx2("path", { d: `M ${a.x} ${a.y} L ${c.x} ${c.y}`, stroke: dark ? "#090D17" : "#706B62", strokeWidth: "1.1", opacity: ".15" }),
          /* @__PURE__ */ jsx2("path", { d: `M ${a.x + 2} ${a.y} L ${c.x + 2} ${c.y}`, stroke: "#FFFFFF", strokeWidth: "1.6", opacity: dark ? 0.045 : 0.28 })
        ] }, i);
      }) }),
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: `url(#${uid}dots)`, opacity: dark ? 0.55 : 0.3 })
    ] });
  } else {
    const spacing = 84, shiftX = hqGridOffset(t), shiftY = 0;
    content = /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: gridBaseColor }),
      /* @__PURE__ */ jsxs("g", { stroke: gridColor, strokeWidth: "2", opacity: ".62", children: [
        Array.from({ length: Math.ceil(W / spacing) + 3 }, (_, i) => /* @__PURE__ */ jsx2("path", { d: `M ${(i - 1) * spacing + shiftX} -20 L ${(i - 1) * spacing + shiftX} 1020` }, `x${i}`)),
        Array.from({ length: 15 }, (_, i) => /* @__PURE__ */ jsx2("path", { d: `M -20 ${(i - 1) * spacing + shiftY} L ${W + 20} ${(i - 1) * spacing + shiftY}` }, `y${i}`))
      ] }),
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: `url(#${uid}dots)`, opacity: ".45" }),
      /* @__PURE__ */ jsx2("rect", { width: W, height: H, fill: `url(#${uid}vignette)`, opacity: ".28" })
    ] });
  }
  return /* @__PURE__ */ jsx2(AbsoluteFill2, { style: { pointerEvents: "none", overflow: "hidden", opacity: opacity / 100 }, children: /* @__PURE__ */ jsxs("svg", { width: "100%", height: "100%", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", style: { position: "absolute", inset: 0 }, children: [
    /* @__PURE__ */ jsxs("defs", { children: [
      dots,
      /* @__PURE__ */ jsxs("radialGradient", { id: `${uid}vignette`, children: [
        /* @__PURE__ */ jsx2("stop", { offset: "35%", stopColor: "#000000", stopOpacity: "0" }),
        /* @__PURE__ */ jsx2("stop", { offset: "100%", stopColor: "#000000", stopOpacity: ".75" })
      ] })
    ] }),
    content
  ] }) });
}
var HQBackground = (props) => /* @__PURE__ */ jsxs(Fragment, { children: [
  /* @__PURE__ */ jsx2(BackgroundLayer, { ...props }),
  props.children
] });

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/SceneBackground.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
var SceneBackground = ({ backgroundStyle = "halftone", backgroundColor = "#162034", backgroundOpacity = 100, paperTone = "dark", gridBackgroundColor = "#10101A", gridLineColor = "#858595", children }) => /* @__PURE__ */ jsx3(HQBackground, { mode: backgroundStyle, baseColor: backgroundColor, opacity: backgroundOpacity, paperTone, gridBaseColor: gridBackgroundColor, gridColor: gridLineColor, children });

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/HQMotion.tsx
var boundsCache = /* @__PURE__ */ new Map();
function imageBoundsHQ(src) {
  if (boundsCache.has(src)) return boundsCache.get(src);
  const pending = (async () => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Imagem inv\xE1lida: " + src));
      image.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indispon\xEDvel.");
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3] > 12) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    if (x1 < 0) throw new Error("Imagem totalmente transparente.");
    return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, sourceWidth: canvas.width, sourceHeight: canvas.height };
  })();
  boundsCache.set(src, pending);
  if (boundsCache.size > 32) boundsCache.delete(boundsCache.keys().next().value);
  pending.catch(() => {
    if (boundsCache.get(src) === pending) boundsCache.delete(src);
  });
  return pending;
}

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/DialogoHQ.tsx
import React2 from "react";
import { AbsoluteFill as AbsoluteFill3, Img as Img2, cancelRender, continueRender, delayRender, useCurrentFrame as useCurrentFrame2, useVideoConfig as useVideoConfig2 } from "remotion";

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/load-font.ts
var cache = /* @__PURE__ */ new Map();
function loadFont({ family, url }) {
  if (!family?.trim() || !url?.trim() || url.length > 4096) return Promise.reject(new Error("Provide a licensed local font URL and family"));
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.reject(new Error("Font loading precisa do navegador de render"));
  const resolved = new URL(url, document.baseURI);
  if (!["http:", "https:"].includes(resolved.protocol)) return Promise.reject(new Error("Use a font served by the editing project"));
  const key = JSON.stringify([family, resolved.href]);
  if (cache.has(key)) return cache.get(key);
  const promise = new FontFace(family, `url(${JSON.stringify(resolved.href)})`).load().then((font) => {
    document.fonts.add(font);
  });
  cache.set(key, promise);
  if (cache.size > 32) cache.delete(cache.keys().next().value);
  promise.catch(() => {
    if (cache.get(key) === promise) cache.delete(key);
  });
  return promise;
}

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/DialogoHQ.tsx
import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var clampDialogue = (x) => Math.max(0, Math.min(1, x));
var easeDialogue = (x) => {
  const p = clampDialogue(x);
  return p * p * (3 - 2 * p);
};
function validateDialogue(turns, duration, motionDuration) {
  if (!Array.isArray(turns) || !turns.length) throw new Error("Informe turns com pelo menos uma fala.");
  if (!Number.isFinite(motionDuration) || motionDuration < 0) throw new Error("motionDuration deve ser n\xE3o negativo.");
  turns.forEach((turn, i) => {
    if (!["left", "right"].includes(turn.speaker) || !turn.text?.trim() || !Number.isFinite(turn.at) || turn.at < 0 || !Number.isFinite(turn.duration) || turn.duration <= 0 || turn.at + turn.duration > duration + 1e-7 || i > 0 && turn.at < turns[i - 1].at + turns[i - 1].duration - 1e-7) throw new Error("Falas: speaker left/right, text, at/duration dentro da cena, ordenados e sem sobreposi\xE7\xE3o.");
    if (!["escrita", "none"].includes(turn.animation ?? "escrita")) throw new Error("animation deve ser escrita ou none.");
    const delay = turn.textDelay ?? 0, write = turn.writeDuration ?? Math.min(1.2, Math.max(0.01, (turn.duration - delay) * 0.55));
    if (!Number.isFinite(delay) || delay < 0 || delay >= turn.duration || !Number.isFinite(write) || write <= 0 || (turn.animation ?? "escrita") === "escrita" && delay + write > turn.duration + 1e-7) throw new Error("textDelay e writeDuration precisam caber na fala.");
    if (turn.textColor && !/^#[a-f\d]{6}$/i.test(turn.textColor)) throw new Error("textColor deve usar #RRGGBB.");
  });
}
function dialogueEvents(turns) {
  return turns.flatMap((turn) => [{ at: turn.at, order: 1, left: turn.speaker === "left" ? 1 : 0, right: turn.speaker === "right" ? 1 : 0 }, { at: turn.at + turn.duration, order: 0, left: 0, right: 0 }]).sort((a, b) => a.at - b.at || a.order - b.order);
}
function dialogueWeights(turns, time, motionDuration, events = dialogueEvents(turns)) {
  let origin = { left: 0, right: 0 }, target = { left: 0, right: 0 }, start = 0;
  const sample = (at) => {
    const p = motionDuration === 0 ? 1 : easeDialogue((at - start) / motionDuration);
    return { left: origin.left + (target.left - origin.left) * p, right: origin.right + (target.right - origin.right) * p };
  };
  for (const event of events) {
    if (event.at > time) break;
    origin = sample(event.at);
    target = { left: event.left, right: event.right };
    start = event.at;
  }
  return sample(time);
}
function dialogueTurnIndex(turns, frame, fps) {
  return turns.findIndex((turn) => frame >= Math.ceil(turn.at * fps - 1e-8) && frame < Math.ceil((turn.at + turn.duration) * fps - 1e-8));
}
var dialogueImageBounds = imageBoundsHQ;
function dialogueTextLayout(text, family, width, height, maximum) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("Canvas indispon\xEDvel.");
  const wrap = (size) => {
    ctx.font = `${size}px ${family}`;
    const lines = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && ctx.measureText(line + " " + word).width > width) {
          lines.push(line);
          line = word;
        } else line += (line ? " " : "") + word;
      }
      lines.push(line);
    }
    return lines;
  };
  let low = 1, high = maximum;
  for (let i = 0; i < 18; i++) {
    const size = (low + high) / 2, lines = wrap(size);
    if (lines.length * size * 1.15 <= height && lines.every((line) => ctx.measureText(line).width <= width)) low = size;
    else high = size;
  }
  return { lines: wrap(low), size: low };
}
function DialogoHQ({
  left,
  right,
  turns,
  fontFamily = "Anton",
  textColor = "#FFFFFF",
  motionDuration = 0.45,
  highlightOpacity = 85,
  backgroundStyle = "halftone",
  backgroundColor = "#10131E",
  backgroundOpacity = 100,
  paperTone = "light",
  gridBackgroundColor = "#10101A",
  gridLineColor = "#858595",
  assets = {}
}) {
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig2();
  const frame = useCurrentFrame2(), time = frame / fps, portrait = h > w, u = Math.min(w, h) / 1080;
  validateDialogue(turns, durationInFrames / fps, motionDuration);
  const fontUrl = resolveHQFont(fontFamily, assets);
  if (!left?.asset || !right?.asset || !assets[left.asset] || !assets[right.asset]) throw new Error("Informe left/right.asset e os arquivos em assets.");
  const colors = [left.color ?? "#2676E8", right.color ?? "#EF3F49"];
  if (![...colors, textColor].every((c) => /^#[a-f\d]{6}$/i.test(c))) throw new Error("Cores devem usar #RRGGBB.");
  if (!Number.isFinite(highlightOpacity) || highlightOpacity < 0 || highlightOpacity > 100) throw new Error("highlightOpacity: 0\u2013100%.");
  if (!Number.isFinite(backgroundOpacity) || backgroundOpacity < 0 || backgroundOpacity > 100) throw new Error("backgroundOpacity: 0\u2013100%.");
  for (const p of [left, right]) if (!Number.isFinite(p.scale ?? 1) || (p.scale ?? 1) < 0.5 || (p.scale ?? 1) > 1) throw new Error("scale de participante: 0.5\u20131.");
  const textWidth = w * (portrait ? 0.78 : 0.4), textHeight = h * (portrait ? 0.29 : 0.52);
  const [prepared, setPrepared] = React2.useState(null);
  const [handle] = React2.useState(() => delayRender("Preparando Di\xE1logo HQ"));
  const signature = JSON.stringify({ left, right, turns, fontFamily, fontUrl, w, h, assets });
  React2.useEffect(() => {
    let live = true;
    Promise.all([loadFont({ family: fontFamily, url: fontUrl }), dialogueImageBounds(assets[left.asset]), dialogueImageBounds(assets[right.asset])]).then(([, a, b]) => {
      if (!live) return;
      setPrepared({ bounds: [a, b], texts: turns.map((t) => dialogueTextLayout(t.text.normalize("NFC").toLocaleUpperCase("pt-BR"), fontFamily, textWidth, textHeight, (portrait ? 95 : 110) * u)), names: [left, right].map((p) => dialogueTextLayout((p.name ?? "").toLocaleUpperCase("pt-BR"), fontFamily, textWidth, h * 0.05, 38 * u)) });
      continueRender(handle);
    }).catch((error) => {
      if (live) cancelRender(error);
    });
    return () => {
      live = false;
    };
  }, [signature, handle]);
  const events = React2.useMemo(() => dialogueEvents(turns), [turns]);
  const index = dialogueTurnIndex(turns, frame, fps), turn = index < 0 ? void 0 : turns[index], weights = dialogueWeights(turns, time, motionDuration, events);
  const isRight = turn?.speaker === "right", layout = index < 0 ? void 0 : prepared?.texts[index];
  const delay = turn?.textDelay ?? 0, local = turn ? time - turn.at : 0;
  const write = turn?.writeDuration ?? Math.min(1.2, Math.max(0.01, ((turn?.duration ?? 1) - delay) * 0.55));
  const progress = turn ? turn.animation === "none" ? local >= delay ? 1 : 0 : clampDialogue((local - delay) / write) : 0;
  const total = layout?.lines.reduce((a, line) => a + Array.from(line).length, 0) ?? 0;
  const visible = turn?.animation === "none" ? total : Math.floor(progress * total);
  let letter = 0;
  return /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { overflow: "hidden" }, children: [
    /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { opacity: backgroundOpacity / 100, pointerEvents: "none" }, children: [
      /* @__PURE__ */ jsx4(SceneBackground, { ...{ backgroundStyle, backgroundColor, paperTone, gridBackgroundColor, gridLineColor } }),
      colors.map((color, i) => /* @__PURE__ */ jsx4(AbsoluteFill3, { style: { opacity: (i === 0 ? weights.left : weights.right) * highlightOpacity / 100, background: `linear-gradient(to ${i === 0 ? "right" : "left"}, ${color} 0%, ${color}B8 24%, ${color}00 72%)` } }, i))
    ] }),
    prepared && [left, right].map((participant, i) => {
      const active = i === 0 ? weights.left : weights.right, b = prepared.bounds[i];
      const fit = Math.min(w * (portrait ? 0.59 : 0.38) / b.width, h * (portrait ? 0.48 : 0.92) / b.height) * (participant.scale ?? 1) * (0.88 + 0.12 * active);
      const iw = b.width * fit, ih = b.height * fit;
      const idleX = i === 0 ? 0 : w, activeX = w * (portrait ? i === 0 ? 0.29 : 0.71 : i === 0 ? 0.19 : 0.81), cx = idleX + (activeX - idleX) * active;
      return /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: cx - iw / 2, top: h * 0.98 - ih, width: iw, height: ih, overflow: "hidden", zIndex: active > 0.5 ? 2 : 1, filter: `grayscale(${1 - active}) brightness(${0.55 + 0.45 * active})`, opacity: 0.45 + 0.55 * active }, children: /* @__PURE__ */ jsx4(Img2, { src: assets[participant.asset], style: { position: "absolute", left: -b.x * fit, top: -b.y * fit, width: b.sourceWidth * fit, height: b.sourceHeight * fit, maxWidth: "none" } }) }, i);
    }),
    turn && layout && progress > 0 && /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", zIndex: 3, left: portrait ? w * 0.11 : w * (isRight ? 0.17 : 0.43), top: h * (portrait ? 0.11 : 0.18), width: textWidth, fontFamily, textAlign: portrait ? "center" : "left", color: turn.textColor ?? textColor, textShadow: fontFamily === "Anton" ? "none" : `${4 * u}px ${6 * u}px 0 #080A11`, WebkitTextStroke: fontFamily === "Anton" ? "0px transparent" : `${1.2 * u}px #080A11` }, children: [
      prepared?.names[isRight ? 1 : 0].lines.some((l) => l.length > 0) && /* @__PURE__ */ jsx4("div", { style: { fontSize: prepared.names[isRight ? 1 : 0].size, lineHeight: 1.1, marginBottom: h * 0.035, color: colors[isRight ? 1 : 0], whiteSpace: "pre" }, children: prepared.names[isRight ? 1 : 0].lines.join("\n") }),
      /* @__PURE__ */ jsx4("div", { style: { fontSize: layout.size, lineHeight: 1.15 }, children: layout.lines.map((line, i) => /* @__PURE__ */ jsx4("div", { style: { whiteSpace: "pre" }, children: Array.from(line).map((c, j) => /* @__PURE__ */ jsx4("span", { style: { opacity: letter++ < visible ? 1 : 0 }, children: c }, j)) }, i)) })
    ] })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const DialogoHQCena = DialogoHQ;
