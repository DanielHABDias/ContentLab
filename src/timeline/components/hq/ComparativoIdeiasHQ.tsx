// Cena HQ ComparativoIdeiasHQ do Content Lab (arquivo único, imports só de React/Remotion).
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
function edgeTravelHQ(position, size, viewport, direction, margin = 30) {
  return direction < 0 ? position + size + margin : direction > 0 ? viewport - position + margin : 0;
}

import React2 from "react";
import { AbsoluteFill as AbsoluteFill3, Img as Img2, cancelRender, continueRender, delayRender, useCurrentFrame as useCurrentFrame2, useVideoConfig as useVideoConfig2 } from "remotion";

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
var clamp = (v) => Math.max(0, Math.min(1, v));
var ease = (v) => {
  const p = clamp(v);
  return 1 - Math.pow(1 - p, 3);
};
function comparisonLayout(count, w, h, hasTitle = false) {
  if (![2, 3, 4].includes(count)) throw new Error("Comparativo requer de 2 a 4 itens.");
  const horizontal = w > h;
  const top = hasTitle ? 0.2 : 0.09;
  const bottom = 0.91;
  const make = (x, y, width, height2, fromX, fromY) => ({ x: x * w, y: y * h, width: width * w, height: height2 * h, fromX, fromY });
  if (horizontal && count < 4) {
    const gap = 0.045;
    const width = (0.86 - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, i) => make(
      0.07 + i * (width + gap),
      top,
      width,
      bottom - top,
      i === 0 ? -1 : i === count - 1 ? 1 : 0,
      count === 3 && i === 1 ? -1 : 0
    ));
  }
  if (!horizontal && count === 2) {
    const height2 = (bottom - top - 0.045) / 2;
    return [make(0.09, top, 0.82, height2, 0, -1), make(0.09, top + height2 + 0.045, 0.82, height2, 0, 1)];
  }
  const height = (bottom - top - 0.055) / 2;
  if (!horizontal && count === 3) return [
    make(0.2, top, 0.6, height, 0, -1),
    make(0.07, top + height + 0.055, 0.4, height, -1, 1),
    make(0.53, top + height + 0.055, 0.4, height, 1, 1)
  ];
  return Array.from({ length: 4 }, (_, i) => make(
    i % 2 ? 0.53 : 0.07,
    top + Math.floor(i / 2) * (height + 0.055),
    0.4,
    height,
    i % 2 ? 1 : -1,
    i < 2 ? -1 : 1
  ));
}
function fitText(text, width, height, maximum, fontFamily = "Bangers") {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("Canvas indispon\xEDvel.");
  const wrap = (size) => {
    ctx.font = `${size}px ${fontFamily}`;
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (ctx.measureText(word).width > width) {
        if (line) {
          lines.push(line);
          line = "";
        }
        for (const char of Array.from(word)) {
          if (line && ctx.measureText(line + char).width > width) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      } else if (line && ctx.measureText(line + " " + word).width > width) {
        lines.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
    return lines;
  };
  let low = 1, high = maximum;
  for (let i = 0; i < 18; i++) {
    const size = (low + high) / 2;
    const lines = wrap(size);
    if (lines.length <= 3 && lines.length * size * 1.08 <= height && lines.every((line) => ctx.measureText(line).width <= width)) low = size;
    else high = size;
  }
  return { lines: wrap(low), size: low };
}
var imageBounds = imageBoundsHQ;
function ComparativoIdeiasHQ({
  fontFamily = "Anton",
  backgroundStyle = "halftone",
  backgroundOpacity = 100,
  paperTone = "light",
  gridBackgroundColor = "#10101A",
  gridLineColor = "#858595",
  items,
  title = "",
  backgroundColor = "#D6AD42",
  textColor = "#FFFFFF",
  startDelay = 0.15,
  stagger = 0.45,
  entryDuration = 0.6,
  textDuration = 0.25,
  assets = {}
}) {
  const fontUrl = resolveHQFont(fontFamily, assets);
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig2();
  const t = useCurrentFrame2() / fps;
  if (!Array.isArray(items) || ![2, 3, 4].includes(items.length)) throw new Error("Informe items com 2, 3 ou 4 imagens.");
  if (!fontUrl) throw new Error("Informe fontUrl.");
  if (![backgroundColor, textColor].every((c) => /^#[a-f\d]{6}$/i.test(c))) throw new Error("Cores devem usar #RRGGBB.");
  if (![startDelay, stagger, entryDuration, textDuration].every(Number.isFinite) || startDelay < 0 || stagger < 0 || entryDuration <= 0 || textDuration <= 0) throw new Error("Tempos inv\xE1lidos.");
  const starts = items.map((item, i) => item.at ?? startDelay + i * stagger);
  items.forEach((item, i) => {
    if (!item.text?.trim() || !assets[item.asset]) throw new Error("Cada item precisa de text e uma chave asset existente.");
    if (!Number.isFinite(starts[i]) || starts[i] < 0 || starts[i] + entryDuration + textDuration > durationInFrames / fps + 1e-8) throw new Error("Imagem e texto devem terminar de entrar antes do fim da cena.");
  });
  const slots = comparisonLayout(items.length, w, h, Boolean(title.trim()));
  const unit = Math.min(w, h) / 1080;
  const [prepared, setPrepared] = React2.useState(null);
  const [handle] = React2.useState(() => delayRender("Preparando comparativo de ideias"));
  const signature = JSON.stringify({ items, assets, w, h, title });
  React2.useEffect(() => {
    let live = true;
    Promise.all([loadFont({ family: fontFamily, url: fontUrl }), Promise.all(items.map((item) => imageBounds(assets[item.asset])))]).then(([, bounds]) => {
      if (!live) return;
      const labels = items.map((item, i) => fitText(
        item.text.normalize("NFC").toLocaleUpperCase("pt-BR").trim(),
        slots[i].width * 0.94,
        slots[i].height * 0.25,
        Math.min(88 * unit, slots[i].width * 0.16),
        fontFamily
      ));
      const heading = title.trim() ? fitText(title.toLocaleUpperCase("pt-BR"), w * 0.84, h * 0.1, 94 * unit, fontFamily) : null;
      setPrepared({ bounds, labels, heading });
      continueRender(handle);
    }).catch((error) => {
      if (live) cancelRender(error);
    });
    return () => {
      live = false;
    };
  }, [signature, fontFamily, fontUrl, handle]);
  const textStyle = {
    fontFamily,
    color: textColor,
    lineHeight: 1.08,
    whiteSpace: "pre",
    WebkitTextStroke: fontFamily === "Anton" ? "0px transparent" : `${1.5 * unit}px #080A11`,
    textShadow: fontFamily === "Anton" ? "none" : `${5 * unit}px ${7 * unit}px 0 #080A11`
  };
  return /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { overflow: "hidden" }, children: [
    /* @__PURE__ */ jsx4(SceneBackground, { ...{ backgroundStyle, backgroundColor, backgroundOpacity, paperTone, gridBackgroundColor, gridLineColor }, children: /* @__PURE__ */ jsx4(AbsoluteFill3, { style: { opacity: 0.17, backgroundImage: `radial-gradient(#080A11 ${3.2 * unit}px, transparent ${3.8 * unit}px)`, backgroundSize: `${19 * unit}px ${19 * unit}px` } }) }),
    prepared?.heading && /* @__PURE__ */ jsx4("div", { style: { ...textStyle, position: "absolute", left: "8%", top: "6%", width: "84%", textAlign: "center", fontSize: prepared.heading.size }, children: prepared.heading.lines.join("\n") }),
    prepared && items.map((item, i) => {
      const slot = slots[i];
      const box = prepared.bounds[i];
      const label = prepared.labels[i];
      const progress = ease((t - starts[i]) / entryDuration);
      const labelP = ease((t - starts[i] - entryDuration) / textDuration);
      const imageH = slot.height * 0.69;
      const size = Math.min(slot.width * 0.92 / box.width, imageH / box.height);
      const imageW = box.width * size;
      const visibleH = box.height * size;
      return /* @__PURE__ */ jsxs2(React2.Fragment, { children: [
        /* @__PURE__ */ jsx4("div", { style: {
          position: "absolute",
          left: slot.x + (slot.width - imageW) / 2,
          top: slot.y + (imageH - visibleH) / 2,
          width: imageW,
          height: visibleH,
          overflow: "hidden",
          opacity: t < starts[i] ? 0 : 1,
          translate: `${slot.fromX * edgeTravelHQ(slot.x + (slot.width - imageW) / 2, imageW, w, slot.fromX, 30 * unit) * (1 - progress)}px ${slot.fromY * edgeTravelHQ(slot.y + (imageH - visibleH) / 2, visibleH, h, slot.fromY, 30 * unit) * (1 - progress)}px`
        }, children: /* @__PURE__ */ jsx4(Img2, { src: assets[item.asset], style: {
          position: "absolute",
          left: -box.x * size,
          top: -box.y * size,
          width: box.sourceWidth * size,
          height: box.sourceHeight * size,
          maxWidth: "none"
        } }) }),
        /* @__PURE__ */ jsx4("div", { style: {
          ...textStyle,
          position: "absolute",
          left: slot.x + slot.width * 0.03,
          top: slot.y + slot.height * 0.74,
          width: slot.width * 0.94,
          height: slot.height * 0.25,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          fontSize: label.size,
          opacity: labelP,
          translate: `0 ${(1 - labelP) * 12 * unit}px`
        }, children: label.lines.join("\n") })
      ] }, i);
    })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const ComparativoIdeiasHQCena = ComparativoIdeiasHQ;
