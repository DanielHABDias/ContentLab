// Cena PaginaHQCenas do plugin Diazverso 1.3.0, compilada por scripts/build-diazverso-scenes.mjs. Não editar à mão.
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
var clampHQ = (v) => Math.max(0, Math.min(1, v));
function progressHQ(time, start, duration, fps) {
  if (time >= start + duration - 1 / fps - 1e-8) return 1;
  return clampHQ((time - start) / Math.max(1 / fps, duration - 1 / fps));
}

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/PaginaHQCenas.tsx
import React2 from "react";
import {
  AbsoluteFill as AbsoluteFill3,
  Freeze,
  Img as Img2,
  OffthreadVideo,
  cancelRender,
  continueRender,
  delayRender,
  interpolateColors,
  useCurrentFrame as useCurrentFrame2,
  useVideoConfig as useVideoConfig2
} from "remotion";

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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/PaginaHQCenas.tsx
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var clamp = (n) => Math.max(0, Math.min(1, n));
var ease = (n) => {
  const t = clamp(n);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
var mix = (a, b, p) => a + (b - a) * p;
function intervalsFor(panel, focus, enter, end) {
  const intervals = focus.filter((cue) => cue.panel === panel).map((cue) => ({
    at: cue.at,
    until: Math.min(cue.until, enter?.at ?? end, end)
  })).filter((cue) => cue.until > cue.at);
  if (enter?.panel === panel) intervals.push({ at: enter.at, until: end });
  intervals.sort((a, b) => a.at - b.at);
  const merged = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval.at <= last.until) last.until = Math.max(last.until, interval.until);
    else merged.push({ ...interval });
  }
  return merged;
}
function TileVideo({ src, sourceStart, elapsed, crt, unit, fit = "cover" }) {
  const { fps } = useVideoConfig2();
  return /* @__PURE__ */ jsxs2(Fragment2, { children: [
    /* @__PURE__ */ jsx4(Freeze, { frame: Math.round(elapsed * fps), children: /* @__PURE__ */ jsx4(
      OffthreadVideo,
      {
        src,
        muted: true,
        trimBefore: Math.round(sourceStart * fps),
        style: { position: "absolute", width: "100%", height: "100%", objectFit: fit, objectPosition: "center" }
      }
    ) }),
    crt && /* @__PURE__ */ jsx4(AbsoluteFill3, { style: {
      pointerEvents: "none",
      backgroundImage: `radial-gradient(circle at center, transparent 45%, #0006 100%), repeating-linear-gradient(to bottom, #0004 0px, #0004 ${unit}px, #FFFFFF08 ${2 * unit}px, transparent ${4 * unit}px)`,
      backgroundSize: `100% 100%, 100% ${4 * unit}px`
    } })
  ] });
}
function parallaxCamera(time, focus, duration) {
  let position = 0;
  for (const cue of focus) {
    if (time < cue.at) break;
    const next = cue.panel - 1;
    position = mix(position, next, ease((time - cue.at) / duration));
  }
  return position;
}
function panelGeometry(w, h, layout, index) {
  if (layout === "parallax") return { x: w * (w > h ? 0.21 : 0.14), y: h * (w > h ? 0.24 : 0.3), width: w * (w > h ? 0.58 : 0.72), height: h * (w > h ? 0.6 : 0.4), angle: 0 };
  if (layout === "split") return w > h ? { x: w * (index === 0 ? 0.055 : 0.555), y: h * 0.28, width: w * 0.39, height: h * 0.57, angle: index === 0 ? -1 : 1 } : { x: w * 0.1, y: h * (index === 0 ? 0.16 : 0.59), width: w * 0.8, height: h * 0.29, angle: index === 0 ? -1 : 1 };
  if (layout === "asymmetric") return w > h ? index === 0 ? { x: w * 0.07, y: h * 0.23, width: w * 0.57, height: h * 0.64, angle: -2 } : { x: w * 0.68, y: h * 0.32, width: w * 0.25, height: h * 0.48, angle: 2 } : index === 0 ? { x: w * 0.08, y: h * 0.16, width: w * 0.84, height: h * 0.37, angle: -1.4 } : { x: w * 0.2, y: h * 0.59, width: w * 0.72, height: h * 0.27, angle: 1.8 };
  const horizontal = w > h, tileH = h * (horizontal ? 0.36 : 0.38), yTop = h * (horizontal ? 0.1 : 0.09), yGap = h * (horizontal ? 0.055 : 0.04);
  return { x: w * (0.055 + index % 2 * 0.46), y: yTop + Math.floor(index / 2) * (tileH + yGap), width: w * 0.43, height: tileH, angle: 0 };
}
function validatePanelLayout(panels, layout, duration, entryDuration, heading) {
  if (!["grid", "asymmetric", "split", "parallax"].includes(layout)) throw new Error("panelLayout: grid, asymmetric, split ou parallax.");
  const count = layout === "grid" ? 4 : 2;
  if (!Array.isArray(panels) || (layout === "parallax" ? panels.length < 2 || panels.length > 4 : panels.length !== count)) throw new Error(`panelLayout ${layout} requer ${layout === "parallax" ? "2 a 4" : count} panels.`);
  if (typeof heading !== "string" || heading.length > 80) throw new Error("heading: texto com at\xE9 80 caracteres.");
  if (layout !== "grid" && (!Number.isFinite(entryDuration) || entryDuration <= 0 || entryDuration > duration)) throw new Error("entryDuration deve ser positiva e caber na cena.");
  panels.forEach((p, i) => {
    if (!["video", "image"].includes(p.mediaType ?? "video")) throw new Error("mediaType: video ou image.");
    if (!["cover", "contain"].includes(p.fit ?? "cover")) throw new Error("fit: cover ou contain.");
    if (p.accentColor && !/^#[a-f\d]{6}$/i.test(p.accentColor)) throw new Error("accentColor do painel: #RRGGBB.");
    if (p.backgroundColor && !/^#[a-f\d]{6}$/i.test(p.backgroundColor)) throw new Error("backgroundColor do painel: #RRGGBB.");
    if (layout !== "grid") {
      const at = p.at ?? i * 0.55;
      if (!Number.isFinite(at) || at < 0 || at + entryDuration > duration + 1e-8) throw new Error("Entrada do painel precisa caber na cena.");
    }
  });
}
function PaginaHQCenas({ fontFamily = "Anton", backgroundStyle = "halftone", backgroundOpacity = 100, paperTone = "light", gridBackgroundColor = "#10101A", gridLineColor = "#858595", panels, focus, enter, backgroundColor = "#E8C64F", accentColor = "#2676E8", panelLayout = "grid", parallaxDuration = 0.65, splitColors = ["#D92F45", "#2459C9"], dividerColor = "#111723", heading = "", headingColor = "#111723", entryDuration = 0.55, assets = {} }) {
  const fontUrl = panels?.some((p) => p.label) || panelLayout !== "grid" && heading ? resolveHQFont(fontFamily, assets) : "";
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig2();
  const frame = useCurrentFrame2();
  const time = frame / fps;
  const duration = durationInFrames / fps;
  const horizontal = w > h;
  const unit = Math.min(w, h) / 1080;
  validatePanelLayout(panels, panelLayout, duration, entryDuration, heading);
  const rangeKey = JSON.stringify({ focus, enter, duration });
  const preparedRanges = React2.useMemo(() => panels.map((_, i) => intervalsFor(i + 1, [...focus].sort((a, b) => a.at - b.at), enter, duration)), [rangeKey, panels.length]);
  const panelCount = panels.length, asymmetric = panelLayout !== "grid", split = panelLayout === "split", parallax = panelLayout === "parallax";
  if (parallax && (!Number.isFinite(parallaxDuration) || parallaxDuration <= 0 || parallaxDuration > duration)) throw new Error("parallaxDuration deve ser positiva e caber na cena.");
  if (split && (!Array.isArray(splitColors) || splitColors.length !== 2 || !splitColors.every((c) => /^#[a-f\d]{6}$/i.test(c)) || !/^#[a-f\d]{6}$/i.test(dividerColor))) throw new Error("splitColors: duas cores #RRGGBB; dividerColor: #RRGGBB.");
  if (!Array.isArray(focus)) throw new Error("PaginaHQCenas requer focus com os tempos de destaque.");
  if (!/^#[0-9a-fA-F]{6}$/.test(backgroundColor) || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
    throw new Error("As cores devem usar #RRGGBB.");
  }
  const ordered = [...focus].sort((a, b) => a.at - b.at);
  ordered.forEach((cue, index) => {
    if (!Number.isInteger(cue.panel) || cue.panel < 1 || cue.panel > panelCount || !Number.isFinite(cue.at) || !Number.isFinite(cue.until) || cue.at < 0 || cue.until <= cue.at || cue.until > duration + 1 / fps) {
      throw new Error(`focus requer panel de 1 a ${panelCount} e at/until v\xE1lidos dentro da cena.`);
    }
    if (index && cue.at < ordered[index - 1].until) throw new Error("Os intervalos de focus n\xE3o podem se sobrepor.");
    if (parallax && cue.until - cue.at < parallaxDuration - 1e-8) throw new Error("Cada focus deve durar ao menos parallaxDuration.");
  });
  if (enter && (!Number.isInteger(enter.panel) || enter.panel < 1 || enter.panel > panelCount || !Number.isFinite(enter.at) || enter.at < 0 || !Number.isFinite(enter.duration ?? 1.1) || (enter.duration ?? 1.1) <= 0 || enter.at + (enter.duration ?? 1.1) > duration + 1 / fps)) {
    throw new Error(`enter deve apontar para panel de 1 a ${panelCount} e terminar dentro da cena.`);
  }
  panels.forEach((panel) => {
    if (!assets[panel.asset]) throw new Error(`Asset ausente: ${panel.asset}`);
    if (!Number.isFinite(panel.sourceStart ?? 0) || (panel.sourceStart ?? 0) < 0) throw new Error("sourceStart deve ser um tempo positivo ou zero.");
  });
  if (!/^#[a-f\d]{6}$/i.test(headingColor)) throw new Error("headingColor: #RRGGBB.");
  const labels = panels.some((panel) => panel.label) || asymmetric && Boolean(heading);
  if (labels && !fontUrl) throw new Error("Informe fontUrl para usar etiquetas nos quadros.");
  const [fontHandle] = React2.useState(() => labels ? delayRender("Carregando etiquetas da p\xE1gina HQ") : null);
  React2.useEffect(() => {
    if (fontHandle === null) return;
    loadFont({ family: fontFamily, url: fontUrl }).then(() => continueRender(fontHandle)).catch((error) => cancelRender(error));
  }, [fontHandle, fontUrl, fontFamily]);
  const zoom = enter ? ease(progressHQ(time, enter.at, enter.duration ?? 1.1, fps)) : 0;
  const drift = 1 - zoom;
  const boardX = Math.sin(time * 0.7) * w * 3e-3 * drift;
  const boardY = Math.sin(time * 0.9 + 0.4) * h * 4e-3 * drift;
  const boardAngle = Math.sin(time * 0.6) * 0.25 * drift;
  const target = enter && time >= enter.at ? enter.panel : null;
  const camera = parallax ? parallaxCamera(Math.min(time, enter?.at ?? duration), ordered, parallaxDuration) : 0;
  return /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { overflow: "hidden" }, children: [
    /* @__PURE__ */ jsx4(SceneBackground, { ...{ backgroundStyle, backgroundColor, backgroundOpacity, paperTone, gridBackgroundColor, gridLineColor }, children: /* @__PURE__ */ jsx4(AbsoluteFill3, { style: {
      opacity: 0.23 * (1 - zoom),
      backgroundImage: `radial-gradient(#080A11 ${3 * unit}px, transparent ${3.7 * unit}px)`,
      backgroundSize: `${19 * unit}px ${19 * unit}px`
    } }) }),
    split && /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { pointerEvents: "none", opacity: backgroundOpacity / 100 * (1 - zoom) }, children: [
      splitColors.map((color, i) => {
        const reveal = ease((time - (panels[i].at ?? i * 0.55)) / entryDuration);
        return /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: horizontal ? `${i * 50}%` : 0, top: horizontal ? 0 : `${i * 50}%`, width: horizontal ? "50%" : "100%", height: horizontal ? "100%" : "50%", backgroundColor: color, backgroundImage: `radial-gradient(#080A1138 ${3 * unit}px, transparent ${3.7 * unit}px)`, backgroundSize: `${19 * unit}px ${19 * unit}px`, clipPath: horizontal ? `inset(0 ${i === 0 ? (1 - reveal) * 100 : 0}% 0 ${i === 1 ? (1 - reveal) * 100 : 0}%)` : `inset(${i === 1 ? (1 - reveal) * 100 : 0}% 0 ${i === 0 ? (1 - reveal) * 100 : 0}% 0)` } }, i);
      }),
      /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: horizontal ? "calc(50% - 4px)" : "5%", top: horizontal ? "22%" : "calc(50% - 4px)", width: horizontal ? 8 * unit : "90%", height: horizontal ? "70%" : 8 * unit, background: dividerColor, transformOrigin: horizontal ? "top" : "left", transform: `${horizontal ? "scaleY" : "scaleX"}(${ease((time - Math.max(...panels.map((p, i) => (p.at ?? i * 0.55) + entryDuration))) / 0.35)})` } })
    ] }),
    /* @__PURE__ */ jsx4(AbsoluteFill3, { style: { translate: `${boardX}px ${boardY}px`, rotate: `${boardAngle}deg` }, children: panels.map((panel, index) => {
      const number = index + 1;
      const ranges = preparedRanges[index];
      const elapsed = ranges.reduce((sum, range) => sum + Math.max(0, Math.min(time, range.until) - range.at), 0);
      const active = ranges.find((range) => range.at <= time && time < range.until);
      const previous = ranges.filter((range) => range.until <= time).at(-1);
      const light = asymmetric && ordered.length === 0 && !enter ? 1 : active ? ease((time - active.at) / 0.24) : previous ? 1 - ease((time - previous.until) / 0.24) : 0;
      const selected = target === number;
      const expand = selected ? zoom : 0;
      const base = panelGeometry(w, h, panelLayout, index), relative = index - camera, depth = Math.min(3, Math.abs(relative));
      const layerScale = parallax ? 1 - depth * 0.12 : 1;
      const tileW = base.width * layerScale, tileH = base.height * layerScale;
      const x = parallax ? base.x + (base.width - tileW) / 2 + relative * w * 0.18 : base.x;
      const y = parallax ? base.y + (base.height - tileH) / 2 + depth * h * 0.025 : base.y;
      const angle = parallax ? relative * 4 : base.angle;
      const border = 8 * unit * (1 - expand);
      const arrival = asymmetric ? ease((time - (panel.at ?? index * 0.55)) / entryDuration) : ease(time / 0.38);
      return /* @__PURE__ */ jsxs2("div", { style: {
        position: "absolute",
        left: mix(x, 0, expand),
        top: mix(y, 0, expand),
        width: mix(tileW, w, expand),
        height: mix(tileH, h, expand),
        zIndex: selected ? 200 : parallax ? 100 - Math.round(depth * 20) : active ? 3 : 1,
        boxSizing: "border-box",
        overflow: "hidden",
        border: `${border}px solid ${interpolateColors(light, [0, 1], ["#F5EFDE", asymmetric ? panel.accentColor ?? accentColor : accentColor])}`,
        background: asymmetric ? panel.backgroundColor ?? "#F5EFDE" : "#080A11",
        opacity: selected ? arrival : arrival * (1 - zoom),
        boxShadow: `${10 * unit * (1 - expand)}px ${13 * unit * (1 - expand)}px 0 #080A11`,
        translate: split ? `${horizontal ? (index === 0 ? -1 : 1) * (1 - arrival) * w * 0.2 : 0}px ${horizontal ? 0 : (index === 0 ? -1 : 1) * (1 - arrival) * h * 0.18}px` : `0 ${(1 - arrival) * (asymmetric ? 90 : 35) * unit}px`,
        rotate: asymmetric ? `${angle * (1 - expand)}deg` : void 0
      }, children: [
        /* @__PURE__ */ jsx4(AbsoluteFill3, { style: { filter: `grayscale(${1 - light}) brightness(${0.26 + 0.74 * light})` }, children: panel.mediaType === "image" ? /* @__PURE__ */ jsxs2(Fragment2, { children: [
          /* @__PURE__ */ jsx4(Img2, { src: assets[panel.asset], style: { position: "absolute", width: "100%", height: "100%", objectFit: panel.fit ?? "cover" } }),
          panel.crt && /* @__PURE__ */ jsx4(AbsoluteFill3, { style: { pointerEvents: "none", backgroundImage: `repeating-linear-gradient(to bottom, #0004 0px, #0004 ${unit}px, transparent ${4 * unit}px)` } })
        ] }) : /* @__PURE__ */ jsx4(TileVideo, { src: assets[panel.asset], sourceStart: panel.sourceStart ?? 0, elapsed, crt: panel.crt ?? false, unit, fit: panel.fit }) }),
        panel.label && /* @__PURE__ */ jsx4("div", { style: {
          position: "absolute",
          left: 16 * unit,
          bottom: 13 * unit,
          padding: `${7 * unit}px ${14 * unit}px`,
          background: "#080A11",
          color: "#FFFFFF",
          fontFamily,
          fontSize: asymmetric ? Math.min((horizontal ? 46 : 44) * unit, tileW * 0.82 / Math.max(1, panel.label.length * 0.58)) : (horizontal ? 36 : 31) * unit,
          opacity: (1 - expand) * (0.45 + 0.55 * light)
        }, children: panel.label.toLocaleUpperCase("pt-BR") })
      ] }, number);
    }) }),
    asymmetric && heading && /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: w * 0.08, right: w * 0.08, top: h * 0.06, color: headingColor, fontFamily, fontSize: Math.min(58 * unit, w * 0.82 / Math.max(1, heading.length * 0.58)), textTransform: "uppercase", lineHeight: 1.15, borderBottom: `${5 * unit}px solid ${accentColor}`, paddingBottom: 14 * unit, opacity: 1 - zoom }, children: heading })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const PaginaHQCenasCena = PaginaHQCenas;
