// Cena TextoHQ do plugin Diazverso 1.2.0, compilada por scripts/build-diazverso-scenes.mjs. Não editar à mão.
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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/TextoHQ.tsx
import React2 from "react";
import { AbsoluteFill as AbsoluteFill3, cancelRender, continueRender, delayRender, useCurrentFrame as useCurrentFrame2, useVideoConfig as useVideoConfig2 } from "remotion";

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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/TextoHQ.tsx
import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var clampText = (x) => Math.max(0, Math.min(1, x));
var easeText = (x) => {
  const p = clampText(x);
  return p * p * (3 - 2 * p);
};
function prepareTextSteps(props, duration, fps) {
  if (props.text !== void 0 && props.texts !== void 0) throw new Error("Use text OU texts, n\xE3o os dois.");
  const sequence = props.texts !== void 0;
  const raw = sequence ? props.texts : [{ text: props.text ?? "", at: 0, duration }];
  if (!Array.isArray(raw) || !raw.length) throw new Error("TextoHQ requer text ou texts n\xE3o vazio.");
  return raw.map((item, i) => {
    if (!item.text?.trim() || !Number.isFinite(item.at) || item.at < 0 || !Number.isFinite(item.duration) || item.duration <= 0 || item.at + item.duration > duration + 1e-7 || i > 0 && item.at < raw[i - 1].at + raw[i - 1].duration - 1e-7) throw new Error("Cada texto exige text, at e duration dentro da cena, ordenados e sem sobreposi\xE7\xE3o.");
    const s = { ...props, ...item };
    const entrance = s.entryAnimation === null ? "none" : s.entryAnimation ?? "escrita", exit = s.exitAnimation ?? "none";
    const delay = s.entryDelay ?? (sequence || entrance === "none" ? 0 : Math.min(0.12, item.duration * 0.1));
    const exitTime = exit === "fechar" ? s.exitDuration ?? 0.5 : 0;
    const available = item.duration - delay - exitTime;
    const write = s.writeDuration ?? 1.8;
    if (!["abrir", "escrita", "kinetic", "none"].includes(entrance) || !["fechar", "none"].includes(exit)) throw new Error("Entrada: abrir/escrita/kinetic/none; sa\xEDda: fechar/none.");
    if (entrance === "kinetic" && !["letter", "word"].includes(s.kineticUnit ?? "letter")) throw Error("kineticUnit: letter ou word.");
    if (entrance === "kinetic" && (!["up", "down", "left", "right"].includes(s.kineticDirection ?? "up") || !Number.isFinite(s.kineticStagger ?? 0.035) || (s.kineticStagger ?? 0.035) < 0 || (s.kineticStagger ?? 0.035) > 0.15 || s.kineticAccentColor !== void 0 && !/^#[a-f\d]{6}$/i.test(s.kineticAccentColor))) throw new Error("Kinetic: direction up/down/left/right; stagger 0\u20130.15 s; accentColor #RRGGBB.");
    if (!Number.isFinite(delay) || delay < 0 || !Number.isFinite(write) || write <= 0 || !Number.isFinite(exitTime) || exitTime < 0 || available < 1 / fps || exit === "fechar" && exitTime < 1 / fps || s.entryDuration !== void 0 && (!Number.isFinite(s.entryDuration) || s.entryDuration <= 0)) throw new Error("Tempos de anima\xE7\xE3o inv\xE1lidos ou maiores que o intervalo do texto.");
    const entryTime = s.entryDuration ?? Math.min(write, Math.max(1 / fps, available - Math.min(0.35, item.duration * 0.15)));
    if (entrance !== "none" && entryTime > available + 1e-7) throw new Error("Entrada e sa\xEDda n\xE3o cabem no intervalo do texto.");
    const family = s.fontFamily ?? "Bangers", color = s.textColor ?? "#FFFFFF", scale = s.textScale ?? 1;
    if (!["Bangers", "Anton"].includes(family) || !/^#[a-f\d]{6}$/i.test(color) || !Number.isFinite(scale) || scale < 0.2 || scale > 1) throw new Error("Fonte: Bangers/Anton; textColor: #RRGGBB; textScale: 0.2\u20131.");
    return {
      ...s,
      text: item.text.normalize("NFC").toLocaleUpperCase("pt-BR").trim(),
      at: item.at,
      duration: item.duration,
      fontFamily: family,
      textColor: color,
      textScale: scale,
      entryAnimation: entrance,
      exitAnimation: exit,
      entryDelay: delay,
      entryDuration: entryTime,
      exitDuration: exitTime
    };
  });
}
function activeTextIndex(steps, frame, fps) {
  return steps.findIndex((s) => frame >= Math.ceil(s.at * fps - 1e-8) && frame < Math.ceil((s.at + s.duration) * fps - 1e-8));
}
function kineticGlyph(local, index, count, duration, stagger = 0.035) {
  const gap = Math.min(stagger, duration * 0.65 / Math.max(1, count - 1));
  const progress = clampText((local - index * gap) / Math.max(1e-6, duration - (count - 1) * gap));
  const p = easeText(progress);
  return { opacity: p, offset: 1 - p, scale: (0.65 + 0.35 * p) * (1 + 0.12 * Math.sin(Math.PI * p)), rotation: -12 * (1 - p) };
}
function fitHQText(text, family, width, height, scale) {
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
  let low = 1, high = Math.max(width, height);
  for (let i = 0; i < 20; i++) {
    const size = (low + high) / 2, lines = wrap(size);
    if (lines.length * size * 1.16 <= height && lines.every((l) => ctx.measureText(l).width <= width)) low = size;
    else high = size;
  }
  return { lines: wrap(low), fontSize: low * scale };
}
function TextoHQ(props) {
  const { width, height, fps, durationInFrames } = useVideoConfig2();
  const frame = useCurrentFrame2();
  const inputKey = JSON.stringify(props);
  const steps = React2.useMemo(() => prepareTextSteps(props, durationInFrames / fps, fps), [inputKey, durationInFrames, fps]), assets = props.assets ?? {};
  const urls = steps.map((s2) => resolveHQFont(s2.fontFamily, assets));
  const [layouts, setLayouts] = React2.useState(null);
  const [handle] = React2.useState(() => delayRender("Preparando Texto HQ"));
  const signature = JSON.stringify({ steps, urls, width, height });
  React2.useEffect(() => {
    let live = true;
    Promise.all(steps.map((s2, i) => loadFont({ family: s2.fontFamily, url: urls[i] }))).then(() => {
      if (!live) return;
      setLayouts(steps.map((s2) => fitHQText(s2.text, s2.fontFamily, width * (width > height ? 0.84 : 0.8) * (s2.entryAnimation === "kinetic" ? 0.88 : 1), height * (width > height ? 0.64 : 0.66) * (s2.entryAnimation === "kinetic" ? 0.82 : 1), s2.textScale)));
      continueRender(handle);
    }).catch((error) => {
      if (live) cancelRender(error);
    });
    return () => {
      live = false;
    };
  }, [signature, handle]);
  const index = activeTextIndex(steps, frame, fps), s = index < 0 ? void 0 : steps[index], layout = index < 0 ? void 0 : layouts?.[index];
  const bg = s ?? props, unit = Math.min(width, height) / 1080;
  const local = s ? frame / fps - s.at : 0;
  const p = s ? s.entryAnimation === "none" ? local >= s.entryDelay ? 1 : 0 : clampText((local - s.entryDelay) / s.entryDuration) : 0;
  const opening = easeText(p), closing = s?.exitAnimation === "fechar" ? easeText((local - (s.duration - s.exitDuration)) / Math.max(1 / fps, s.exitDuration - 1 / fps)) : 0;
  const openMask = s?.entryAnimation === "abrir" && opening < 1 ? `linear-gradient(to right, transparent ${50 - opening * 55 - 5}%, black ${50 - opening * 55}%, black ${50 + opening * 55}%, transparent ${50 + opening * 55 + 5}%)` : void 0;
  const closeMask = closing > 0 ? `linear-gradient(to right, black ${50 - closing * 60 - 5}%, transparent ${50 - closing * 60}%, transparent ${50 + closing * 60}%, black ${50 + closing * 60 + 5}%)` : void 0;
  const units = (line) => s?.entryAnimation === "kinetic" && s.kineticUnit === "word" ? line.split(/(\s+)/).filter(Boolean) : Array.from(line);
  const total = layout?.lines.reduce((a, l) => a + units(l).length, 0) ?? 0, visible = s?.entryAnimation === "escrita" ? Math.floor(p * total) : total;
  let letter = 0;
  return /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { overflow: "hidden", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ jsx4(SceneBackground, { ...bg, children: /* @__PURE__ */ jsx4(AbsoluteFill3, { style: { pointerEvents: "none", opacity: 0.28, backgroundImage: `radial-gradient(circle, #080A11 ${3.2 * unit}px, transparent ${3.8 * unit}px)`, backgroundSize: `${18 * unit}px ${18 * unit}px` } }) }),
    s && layout && /* @__PURE__ */ jsx4("div", { style: { position: "relative", width: width > height ? "84%" : "80%", textAlign: "center", opacity: (s.entryAnimation === "abrir" ? opening : p > 0 ? 1 : 0) * (1 - closing), maskImage: closeMask, WebkitMaskImage: closeMask }, children: /* @__PURE__ */ jsx4("div", { style: { fontFamily: s.fontFamily, fontSize: layout.fontSize, lineHeight: 1.16, color: s.textColor, WebkitTextStroke: s.fontFamily === "Anton" ? "0px transparent" : `${2 * unit}px #080A11`, textShadow: s.fontFamily === "Anton" ? "none" : `${9 * unit}px ${12 * unit}px 0 #080A11`, maskImage: openMask, WebkitMaskImage: openMask }, children: layout.lines.map((line, i) => /* @__PURE__ */ jsx4("div", { style: { whiteSpace: "pre" }, children: units(line).map((char, j) => {
      const n = letter++;
      if (s.entryAnimation !== "kinetic") return /* @__PURE__ */ jsx4("span", { style: { opacity: n < visible ? 1 : 0 }, children: char }, j);
      const k = kineticGlyph(local - s.entryDelay, n, total, s.entryDuration, s.kineticStagger), direction = s.kineticDirection ?? "up", distance = Math.min(layout.fontSize * 0.55, 100 * unit);
      return /* @__PURE__ */ jsx4("span", { style: { display: "inline-block", opacity: k.opacity, color: s.kineticAccentColor && n % 5 === 0 ? s.kineticAccentColor : void 0, translate: `${direction === "left" ? k.offset * distance : direction === "right" ? -k.offset * distance : 0}px ${direction === "up" ? k.offset * distance : direction === "down" ? -k.offset * distance : 0}px`, rotate: `${k.rotation}deg`, scale: k.scale }, children: char }, j);
    }) }, i)) }) })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const TextoHQCena = TextoHQ;
