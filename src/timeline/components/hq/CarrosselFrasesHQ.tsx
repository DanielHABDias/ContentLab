// Cena HQ CarrosselFrasesHQ do Content Lab (arquivo único, imports só de React/Remotion).
import { AbsoluteFill, Img, staticFile } from "remotion";
import { jsx } from "react/jsx-runtime";
function HQComicPage({ opacity = 100, src = staticFile("assets/kit/backgrounds/comic-page.png") }) {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) throw Error("opacity must be 0\u2013100");
  return /* @__PURE__ */ jsx(AbsoluteFill, { style: { pointerEvents: "none", opacity: opacity / 100, overflow: "hidden" }, children: /* @__PURE__ */ jsx(Img, { src, style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" } }) });
}

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

import { jsx as jsx3 } from "react/jsx-runtime";
var SceneBackground = ({ backgroundStyle = "halftone", backgroundColor = "#162034", backgroundOpacity = 100, paperTone = "dark", gridBackgroundColor = "#10101A", gridLineColor = "#858595", children }) => /* @__PURE__ */ jsx3(HQBackground, { mode: backgroundStyle, baseColor: backgroundColor, opacity: backgroundOpacity, paperTone, gridBaseColor: gridBackgroundColor, gridColor: gridLineColor, children });

import React2 from "react";
import { AbsoluteFill as AbsoluteFill3, cancelRender, continueRender, delayRender, useCurrentFrame as useCurrentFrame2, useVideoConfig as useVideoConfig2 } from "remotion";

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

import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var clampCarousel = (v) => Math.max(0, Math.min(1, v));
var smoothCarousel = (v) => {
  const t = clampCarousel(v);
  return t * t * (3 - 2 * t);
};
function validateCarousel(phrases, duration, motionDuration) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Dura\xE7\xE3o da cena deve ser positiva.");
  if (!Number.isFinite(motionDuration) || motionDuration < 0) throw new Error("motionDuration deve ser n\xE3o negativo.");
  if (!Array.isArray(phrases) || !phrases.length) throw new Error("Informe phrases com pelo menos uma frase.");
  phrases.forEach((p, i) => {
    if (typeof p.text !== "string" || !p.text.trim() || !Number.isFinite(p.at) || p.at < 0 || p.at >= duration) throw new Error("Frase precisa de text e at dentro da cena.");
    if (i && p.at <= phrases[i - 1].at) throw new Error("at deve ser estritamente crescente.");
    if (i && p.at - phrases[i - 1].at < motionDuration - 1e-7) throw new Error("Intervalo entre chegadas deve ser >= motionDuration.");
    if (!i && p.at > 0 && p.at < motionDuration - 1e-7) throw new Error("Primeiro at deve ser 0 ou >= motionDuration.");
    if (p.color && !/^#[a-f\d]{6}$/i.test(p.color)) throw new Error("Cor da frase deve usar #RRGGBB.");
  });
}
function carouselPosition(phrases, time, motionDuration) {
  let current = -1;
  for (let i = 0; i < phrases.length; i++) {
    const at = phrases[i].at;
    if (time >= at) {
      current = i;
      continue;
    }
    if (motionDuration > 0 && time >= at - motionDuration) return i - 1 + smoothCarousel((time - at + motionDuration) / motionDuration);
    break;
  }
  return current;
}
function carouselTextLayout(ctx, text, family, width, height, maximum) {
  const wrap = (size) => {
    ctx.font = `${size}px ${family}`;
    const lines2 = [];
    for (const paragraph of text.normalize("NFC").toLocaleUpperCase("pt-BR").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && ctx.measureText(line + " " + word).width > width) {
          lines2.push(line);
          line = word;
        } else line += (line ? " " : "") + word;
      }
      lines2.push(line);
    }
    return lines2;
  };
  let lo = 1, hi = maximum;
  for (let i = 0; i < 20; i++) {
    const size = (lo + hi) / 2, lines2 = wrap(size);
    if (lines2.length <= 2 && lines2.length * size * 1.12 <= height && lines2.every((l) => ctx.measureText(l).width <= width)) lo = size;
    else hi = size;
  }
  const lines = wrap(lo);
  if (lines.length > 2) throw new Error("Use frases curtas: no m\xE1ximo duas linhas por frase.");
  return { lines, size: lo, height: lines.length * lo * 1.12 };
}
function CarrosselFrasesHQ({
  phrases,
  fontFamily = "Anton",
  align = "left",
  activeColor = "#F4C542",
  inactiveColor = "#9698A2",
  inactiveOpacity = 0.38,
  inactiveScale = 0.6,
  activeBandColor = "#A0A0A0",
  activeBandOpacity = 0.12,
  motionDuration = 0.45,
  textScale = 1,
  backgroundStyle = "halftone",
  backgroundColor = "#10131E",
  backgroundOpacity = 100,
  paperTone = "light",
  gridBackgroundColor = "#10101A",
  gridLineColor = "#858595",
  assets = {}
}) {
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig2(), frame = useCurrentFrame2();
  validateCarousel(phrases, durationInFrames / fps, motionDuration);
  if (!["left", "right"].includes(align)) throw new Error("align: left ou right.");
  if (![activeColor, inactiveColor].every((c) => /^#[a-f\d]{6}$/i.test(c))) throw new Error("Cores devem usar #RRGGBB.");
  if (!/^#[a-f\d]{6}$/i.test(activeBandColor)) throw new Error("activeBandColor deve usar #RRGGBB.");
  if (!Number.isFinite(activeBandOpacity) || activeBandOpacity < 0 || activeBandOpacity > 1) throw new Error("activeBandOpacity: 0\u20131.");
  if (!Number.isFinite(inactiveOpacity) || inactiveOpacity < 0 || inactiveOpacity > 1) throw new Error("inactiveOpacity: 0\u20131.");
  if (!Number.isFinite(inactiveScale) || inactiveScale < 0.3 || inactiveScale > 0.85) throw new Error("inactiveScale: 0.3\u20130.85.");
  if (!Number.isFinite(textScale) || textScale < 0.25 || textScale > 1) throw new Error("textScale: 0.25\u20131.");
  const url = resolveHQFont(fontFamily, assets), textW = w * 0.84, maximum = Math.min(h * 0.2, w * 0.19) * textScale;
  const [prepared, setPrepared] = React2.useState(null);
  const [handle] = React2.useState(() => delayRender("Preparando Carrossel de Frases HQ"));
  const signature = JSON.stringify({ phrases, fontFamily, url, w, h, textScale });
  React2.useEffect(() => {
    let live = true;
    loadFont({ family: fontFamily, url }).then(() => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) throw new Error("Canvas indispon\xEDvel.");
      const layouts = phrases.map((p) => carouselTextLayout(ctx, p.text, fontFamily, textW, h * 0.24, maximum));
      if (live) setPrepared({ signature, layouts });
      continueRender(handle);
    }).catch(cancelRender);
    return () => {
      live = false;
    };
  }, [signature, handle]);
  const cursor = carouselPosition(phrases, frame / fps, motionDuration);
  const blendColor = (from, to, p) => {
    const a = from.slice(1).match(/../g).map((x) => parseInt(x, 16)), b = to.slice(1).match(/../g).map((x) => parseInt(x, 16));
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * p)).join(",")})`;
  };
  return /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { overflow: "hidden", pointerEvents: "none" }, children: [
    /* @__PURE__ */ jsx4(SceneBackground, { backgroundStyle, backgroundColor, backgroundOpacity, paperTone, gridBackgroundColor, gridLineColor }),
    /* @__PURE__ */ jsx4("div", { "data-active-band": true, style: { position: "absolute", left: 0, top: h * 0.36, width: w, height: h * 0.28, backgroundColor: activeBandColor, opacity: activeBandOpacity } }),
    prepared?.signature === signature && phrases.slice(Math.max(0, Math.floor(cursor) - 2), Math.ceil(cursor) + 3).map((phrase, offset) => {
      const i = Math.max(0, Math.floor(cursor) - 2) + offset;
      const slot = i - cursor;
      if (slot > 2 || slot < -2) return null;
      const layout = prepared.layouts[i], focus = clampCarousel(1 - Math.abs(slot)), scale = inactiveScale + (1 - inactiveScale) * focus;
      const gap = h * 0.045, smallH = layout.height * inactiveScale;
      const yAt = (n) => n >= 2 ? -smallH : n === 1 ? h / 3 - gap - smallH / 2 : n === 0 ? h / 2 : n === -1 ? 2 * h / 3 + gap + smallH / 2 : h + smallH;
      const lower = Math.floor(slot), mix = slot - lower, cy = yAt(lower) + (yAt(lower + 1) - yAt(lower)) * mix;
      const edge = clampCarousel(2 - Math.abs(slot)), opacity = (inactiveOpacity + (1 - inactiveOpacity) * focus) * edge;
      const ink = blendColor(inactiveColor, phrase.color ?? activeColor, focus);
      return /* @__PURE__ */ jsx4("div", { "data-phrase": i, style: {
        position: "absolute",
        left: w * 0.08,
        top: cy - layout.height / 2,
        width: textW,
        height: layout.height,
        scale,
        transformOrigin: align === "left" ? "left center" : "right center",
        fontFamily,
        fontSize: layout.size,
        lineHeight: 1.12,
        textAlign: align,
        color: ink,
        opacity,
        whiteSpace: "pre",
        textShadow: fontFamily === "Anton" ? "none" : `0 ${Math.min(w, h) * 5e-3}px 0 #080A11`,
        WebkitTextStroke: fontFamily === "Anton" ? void 0 : `${Math.min(w, h) * 12e-4}px #080A11`,
        paintOrder: "stroke fill"
      }, children: layout.lines.join("\n") }, i);
    })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const CarrosselFrasesHQCena = CarrosselFrasesHQ;
