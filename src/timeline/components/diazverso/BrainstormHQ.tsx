// Cena BrainstormHQ do plugin Diazverso 1.3.0, compilada por scripts/build-diazverso-scenes.mjs. Não editar à mão.
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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/BrainstormHQ.tsx
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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/BrainstormHQ.tsx
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var smooth = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
function buildTimeline(nodes, steps, zoomOutDuration) {
  if (!nodes.length || !steps.length) throw new Error("Informe nodes e steps.");
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length || nodes.some((n) => !n.id || !n.text?.trim() && !n.asset)) throw new Error("Cada n\xF3 precisa de id \xFAnico e texto ou imagem.");
  nodes.forEach((n) => {
    if (n.x === void 0 !== (n.y === void 0) || n.x !== void 0 && (!Number.isFinite(n.x) || !Number.isFinite(n.y))) throw new Error("Informe x e y juntos, em coordenadas finitas.");
  });
  let cursor = 0;
  const seen = /* @__PURE__ */ new Set();
  const result = steps.map((s, i) => {
    const move = i === 0 ? 0 : s.moveDuration ?? 0.85;
    if (!ids.has(s.node) || !Number.isFinite(s.hold) || s.hold <= 0 || !Number.isFinite(move) || move < 0) throw new Error("Etapas precisam de n\xF3 existente, hold positivo e moveDuration n\xE3o negativo.");
    const from = i === 0 ? void 0 : s.from ?? steps[i - 1].node;
    if (from && !seen.has(from)) throw new Error("from deve apontar para um n\xF3 j\xE1 apresentado.");
    const start = cursor, arrival = start + move;
    cursor = arrival + s.hold;
    seen.add(s.node);
    return { ...s, from, start, arrival, end: cursor, move };
  });
  if (seen.size !== nodes.length) throw new Error("Todos os n\xF3s precisam ser visitados em steps.");
  if (!Number.isFinite(zoomOutDuration) || zoomOutDuration <= 0) throw new Error("zoomOutDuration deve ser positivo.");
  const firstByNode = /* @__PURE__ */ new Map();
  for (const step of result) if (!firstByNode.has(step.node)) firstByNode.set(step.node, step);
  return { steps: result, firstByNode, overviewAt: cursor, minimumDuration: cursor + zoomOutDuration };
}
function BrainstormHQ({ fontFamily = "Anton", backgroundStyle = "halftone", backgroundOpacity = 100, paperTone = "light", gridBackgroundColor = "#10101A", gridLineColor = "#858595", nodes, steps, backgroundColor = "#18243C", cardColor = "#FFF5D7", textColor: suppliedTextColor, lineColor = "#FF435A", zoomOutDuration = 1.4, presentation = "cards", heading = "", pathBend = 0.18, dotColor = "#F4C542", dotSize = 14, assets = {} }) {
  const textColor = suppliedTextColor ?? (["cards", "evidence"].includes(presentation) ? "#172338" : "#FFFFFF");
  const fontUrl = resolveHQFont(fontFamily, assets);
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig2();
  const t = useCurrentFrame2() / fps;
  const timelineKey = JSON.stringify({ nodes, steps, zoomOutDuration });
  const timeline = React2.useMemo(() => buildTimeline(nodes, steps, zoomOutDuration), [timelineKey]);
  if (timeline.minimumDuration > durationInFrames / fps + 1e-6) throw new Error(`Cena curta: m\xEDnimo ${timeline.minimumDuration.toFixed(2)}s; reserve tamb\xE9m tempo para contemplar o mapa.`);
  if (!fontUrl) throw new Error("Informe fontUrl.");
  const [ready, setReady] = React2.useState(false);
  const [handle] = React2.useState(() => delayRender("Carregando Bangers"));
  React2.useEffect(() => {
    loadFont({ family: fontFamily, url: fontUrl }).then(() => {
      setReady(true);
      continueRender(handle);
    }).catch(cancelRender);
  }, [fontUrl, fontFamily, handle]);
  const portrait = h > w;
  const boxes = nodes.map((n, i) => ({ ...n, x: n.x ?? (portrait ? i % 2 * 580 : i % 3 * 580), y: n.y ?? (portrait ? Math.floor(i / 2) * 490 : Math.floor(i / 3) * 490), width: 400, height: n.asset ? n.text ? 390 : 330 : 210 }));
  const box = (id) => boxes.find((n) => n.id === id);
  const fit = (n) => Math.min(w * 0.76 / n.width, h * 0.74 / n.height);
  const bounds = { left: Math.min(...boxes.map((n) => n.x - 225)), right: Math.max(...boxes.map((n) => n.x + 225)), top: Math.min(...boxes.map((n) => n.y - n.height / 2 - 30)), bottom: Math.max(...boxes.map((n) => n.y + n.height / 2 + 30)) };
  const first = box(steps[0].node);
  let cx = first.x, cy = first.y, scale = fit(first);
  timeline.steps.forEach((s, i) => {
    if (!i || t < s.start) return;
    const a = box(steps[i - 1].node), b = box(s.node), p = s.move === 0 ? 1 : smooth((t - s.start) / s.move);
    cx = a.x + (b.x - a.x) * p;
    cy = a.y + (b.y - a.y) * p;
    scale = fit(a) + (fit(b) - fit(a)) * p;
  });
  if (t >= timeline.overviewAt) {
    const p = smooth((t - timeline.overviewAt) / zoomOutDuration);
    cx += ((bounds.left + bounds.right) / 2 - cx) * p;
    cy += ((bounds.top + bounds.bottom) / 2 - cy) * p;
    scale += (Math.min(w * 0.88 / (bounds.right - bounds.left), h * 0.84 / (bounds.bottom - bounds.top)) - scale) * p;
  }
  const uid = React2.useId().replace(/:/g, "");
  if (!["cards", "path", "narrative", "evidence"].includes(presentation)) throw new Error("presentation: cards, path, narrative ou evidence.");
  if (presentation === "evidence") {
    validateNarrative(nodes, heading);
    return /* @__PURE__ */ jsx4(EvidenceHQ, { ...{ nodes, steps, timeline, t, w, h, fontFamily, ready, heading, backgroundStyle, backgroundOpacity, paperTone, gridBackgroundColor, gridLineColor, backgroundColor, cardColor, textColor, lineColor, zoomOutDuration, assets } });
  }
  if (presentation === "path" || presentation === "narrative") {
    validateJourney(pathBend, dotSize, dotColor);
    if (presentation === "narrative") validateNarrative(nodes, heading);
    timeline.steps.forEach((s, i) => {
      if (i && s.connect !== false && s.from !== steps[i - 1].node) throw new Error("No modo path, from deve ser o ponto anterior; use cards para ramifica\xE7\xF5es.");
    });
    return /* @__PURE__ */ jsx4(JourneyHQ, { ...{ nodes, steps, timeline, t, w, h, fontFamily, ready, backgroundStyle, backgroundOpacity, paperTone, gridBackgroundColor, gridLineColor, backgroundColor, textColor, lineColor, pathBend, dotColor, dotSize, zoomOutDuration, assets }, narrative: presentation === "narrative", heading });
  }
  return /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { overflow: "hidden", fontFamily }, children: [
    /* @__PURE__ */ jsx4(SceneBackground, { ...{ backgroundStyle, backgroundColor, backgroundOpacity, paperTone, gridBackgroundColor, gridLineColor }, children: /* @__PURE__ */ jsx4(AbsoluteFill3, { style: { opacity: 0.15, backgroundImage: "radial-gradient(#FFFFFF 1.6px, transparent 2px)", backgroundSize: "12px 12px" } }) }),
    /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${w / 2}px,${h / 2}px) scale(${scale}) translate(${-cx}px,${-cy}px)` }, children: [
      boxes.map((n) => {
        const debut = timeline.firstByNode.get(n.id);
        if (t < debut.start) return null;
        const p = debut.move === 0 ? 1 : smooth((t - debut.start) / Math.max(0.15, debut.move));
        const color = n.color ?? cardColor;
        if (n.asset && !assets[n.asset]) throw new Error(`Asset ausente: ${n.asset}`);
        return /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", left: n.x - 200, top: n.y - n.height / 2, width: 400, height: n.height, boxSizing: "border-box", border: "6px solid #080A10", background: color, boxShadow: "12px 14px 0 #080A10", opacity: p, transform: `scale(${0.86 + 0.14 * p})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 22, gap: 16 }, children: [
          n.asset && /* @__PURE__ */ jsx4(Img2, { src: assets[n.asset], style: { width: "100%", height: n.text ? 245 : 270, objectFit: "contain", minHeight: 0 } }),
          n.text && /* @__PURE__ */ jsx4("div", { style: { color: textColor, fontSize: Math.min(55, 220 / Math.sqrt(Math.max(1, n.text.length / 4))), textTransform: "uppercase", textAlign: "center", lineHeight: 1.1, overflowWrap: "anywhere", textShadow: fontFamily === "Anton" ? "none" : "3px 4px 0 #080A10", WebkitTextStroke: fontFamily === "Anton" ? "0px transparent" : ".7px #080A10", opacity: ready ? 1 : 0 }, children: n.text })
        ] }, n.id);
      }),
      /* @__PURE__ */ jsx4("svg", { style: { position: "absolute", overflow: "visible", width: 1, height: 1 }, children: timeline.steps.map((s, i) => {
        if (!i || s.connect === false || t < s.start || s.from === s.node) return null;
        const a = box(s.from), b = box(s.node);
        const p = s.move === 0 ? 1 : smooth((t - s.start) / s.move);
        const ports = cardPorts(a, b), pa = ports.a, pb = ports.b;
        const d = `M ${pa.x} ${pa.y} C ${pa.x + (pb.x - pa.x) * 0.5} ${pa.y}, ${pa.x + (pb.x - pa.x) * 0.5} ${pb.y}, ${pb.x} ${pb.y}`;
        return /* @__PURE__ */ jsxs2("g", { children: [
          /* @__PURE__ */ jsx4("defs", { children: /* @__PURE__ */ jsx4("mask", { id: `${uid}-${i}`, maskUnits: "userSpaceOnUse", x: Math.min(a.x, b.x) - 500, y: Math.min(a.y, b.y) - 500, width: Math.abs(a.x - b.x) + 1e3, height: Math.abs(a.y - b.y) + 1e3, children: /* @__PURE__ */ jsx4("path", { d, fill: "none", stroke: "white", strokeWidth: 22, pathLength: 1, strokeDasharray: "1", strokeDashoffset: 1 - p }) }) }),
          /* @__PURE__ */ jsx4("path", { d, fill: "none", stroke: "#080A10", strokeWidth: 13, mask: `url(#${uid}-${i})` }),
          /* @__PURE__ */ jsx4("path", { d, fill: "none", stroke: lineColor, strokeWidth: 7, strokeDasharray: "17 12", mask: `url(#${uid}-${i})` })
        ] }, i);
      }) })
    ] })
  ] });
}
function cardPorts(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
  const edge = (n) => Math.min(dx === 0 ? Infinity : n.width / 2 / Math.abs(dx), dy === 0 ? Infinity : n.height / 2 / Math.abs(dy));
  const ea = edge(a), eb = edge(b);
  return { a: { x: a.x + dx * ea, y: a.y + dy * ea }, b: { x: b.x - dx * eb, y: b.y - dy * eb } };
}
function evidenceBoxes(nodes, portrait) {
  return nodes.map((n, i) => ({ ...n, x: n.x ?? (portrait ? i % 2 * 500 : i * 560), y: n.y ?? (portrait ? Math.floor(i / 2) * 620 : i % 2 * 130) }));
}
function evidencePorts(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) throw new Error("Cart\xF5es conectados precisam de posi\xE7\xF5es diferentes.");
  const edge = Math.min(dx === 0 ? Infinity : 180 / Math.abs(dx), dy === 0 ? Infinity : 230 / Math.abs(dy));
  return { a: { x: a.x + dx * edge, y: a.y + dy * edge }, b: { x: b.x - dx * edge, y: b.y - dy * edge } };
}
function evidenceCurve(a, b, p) {
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const control = horizontal ? { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.max(120, Math.abs(b.x - a.x) * 0.45) } : { x: Math.min(a.x, b.x) - Math.max(120, Math.abs(b.y - a.y) * 0.35), y: (a.y + b.y) / 2 };
  const q = Math.max(0, Math.min(1, p)), point = { x: (1 - q) ** 2 * a.x + 2 * (1 - q) * q * control.x + q * q * b.x, y: (1 - q) ** 2 * a.y + 2 * (1 - q) * q * control.y + q * q * b.y };
  const partial = { x: a.x + (control.x - a.x) * q, y: a.y + (control.y - a.y) * q };
  return { point, control, path: `M ${a.x} ${a.y} Q ${partial.x} ${partial.y} ${point.x} ${point.y}` };
}
function EvidenceHQ(p) {
  const { nodes, steps, timeline, t, w, h, fontFamily, ready, heading, cardColor, textColor, lineColor, zoomOutDuration, assets } = p;
  if (![cardColor, textColor, lineColor].every((c) => /^#[a-f\d]{6}$/i.test(c))) throw new Error("Cores de evidence devem usar #RRGGBB.");
  const fitted = React2.useMemo(() => new Map(nodes.map((n) => [n.id, { title: ready && n.text ? narrativeFit(n.text, fontFamily, 300, 66, 43) : void 0, caption: ready && n.subtitle ? narrativeFit(n.subtitle, fontFamily, 300, 48, 24) : void 0 }])), [nodes, fontFamily, ready]);
  const boxes = evidenceBoxes(nodes, h > w), box = (id) => boxes.find((n) => n.id === id);
  const links = timeline.steps.flatMap((s, i) => {
    if (!i || s.connect === false || s.from === s.node) return [];
    const ports = evidencePorts(box(s.from), box(s.node));
    return [{ ...s, index: i, ...ports, curve: evidenceCurve(ports.a, ports.b, 1) }];
  });
  const first = box(steps[0].node);
  let cx = first.x, cy = first.y, scale = Math.min(w * 0.78 / 360, h * 0.64 / 460);
  timeline.steps.forEach((s, i) => {
    if (!i || t < s.start) return;
    const a = box(steps[i - 1].node), b = box(s.node), q = s.move === 0 ? 1 : smooth((t - s.start) / s.move);
    cx = a.x + (b.x - a.x) * q;
    cy = a.y + (b.y - a.y) * q;
  });
  const hull = links.flatMap((l) => [l.a, l.b, l.curve.control]);
  const left = Math.min(...boxes.map((n) => n.x - 210), ...hull.map((n) => n.x - 30)), right = Math.max(...boxes.map((n) => n.x + 210), ...hull.map((n) => n.x + 30));
  const top = Math.min(...boxes.map((n) => n.y - 260), ...hull.map((n) => n.y - 30)), bottom = Math.max(...boxes.map((n) => n.y + 270), ...hull.map((n) => n.y + 30));
  const overview = smooth((t - timeline.overviewAt) / zoomOutDuration), state = narrativeState(timeline, t), u = Math.min(w, h) / 1080;
  if (t >= timeline.overviewAt) {
    cx += ((left + right) / 2 - cx) * overview;
    cy += ((top + bottom) / 2 - cy) * overview;
    scale += (Math.min(w * 0.84 / (right - left), h * 0.72 / (bottom - top)) - scale) * overview;
  }
  return /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { overflow: "hidden", fontFamily }, children: [
    /* @__PURE__ */ jsx4(SceneBackground, { backgroundStyle: p.backgroundStyle, backgroundColor: p.backgroundColor, backgroundOpacity: p.backgroundOpacity, paperTone: p.paperTone, gridBackgroundColor: p.gridBackgroundColor, gridLineColor: p.gridLineColor }),
    /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${w / 2}px,${h / 2}px) scale(${scale}) translate(${-cx}px,${-cy}px)` }, children: [
      boxes.map((n, i) => {
        const debut = timeline.firstByNode.get(n.id);
        if (t < debut.start) return null;
        if (n.asset && !assets[n.asset]) throw new Error("Asset ausente: " + n.asset);
        const reveal = debut.move === 0 ? 1 : smooth((t - debut.start) / debut.move), accent = n.color ?? lineColor;
        let focus = steps[state.index].node === n.id ? 1 : 0;
        if (state.moving >= 0) focus = steps[state.moving].node === n.id ? state.progress : steps[state.moving - 1].node === n.id ? 1 - state.progress : 0;
        const emphasis = focus + (1 - focus) * overview;
        const { title, caption } = fitted.get(n.id);
        return /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", left: n.x - 180, top: n.y - 230, width: 360, height: 460, boxSizing: "border-box", background: cardColor, border: "6px solid #080A10", boxShadow: "12px 14px 0 #080A10", opacity: ready ? reveal * (0.68 + 0.32 * emphasis) : 0, transform: `translateY(${40 * (1 - reveal)}px) scale(${0.94 + 0.06 * reveal})`, overflow: "hidden" }, children: [
          /* @__PURE__ */ jsx4("div", { style: { position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(#080A10 1.5px,transparent 2px)", backgroundSize: "12px 12px" } }),
          /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: 0, right: 0, top: 0, height: 12, background: accent } }),
          /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: 18, top: 24, fontSize: 28, color: textColor }, children: String(i + 1).padStart(2, "0") }),
          n.asset ? /* @__PURE__ */ jsx4(Img2, { src: assets[n.asset], style: { position: "absolute", left: 22, top: 65, width: 304, height: 226, objectFit: "contain", filter: `grayscale(${(1 - emphasis) * 0.85})` } }) : /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: 0, right: 0, top: 80, height: 200, display: "grid", placeItems: "center", fontSize: 135, color: accent }, children: String(i + 1).padStart(2, "0") }),
          /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: 20, right: 20, top: 310, height: 5, background: accent } }),
          title && /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: 24, top: 330, width: 300, height: 66, whiteSpace: "pre", fontSize: title.size, lineHeight: 1.08, color: textColor, textShadow: fontFamily === "Anton" ? "none" : "1px 2px 0 #080A1040" }, children: title.text }),
          caption && /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: 24, top: 398, width: 300, height: 48, whiteSpace: "pre", fontSize: caption.size, lineHeight: 1.08, color: textColor, opacity: 0.8, textShadow: fontFamily === "Anton" ? "none" : "1px 1px 0 #080A1030" }, children: caption.text })
        ] }, n.id);
      }),
      /* @__PURE__ */ jsx4("svg", { style: { position: "absolute", width: 1, height: 1, overflow: "visible", pointerEvents: "none" }, children: links.map((l) => {
        if (t < l.start) return null;
        const q = l.move === 0 ? 1 : smooth((t - l.start) / l.move), d = evidenceCurve(l.a, l.b, q).path;
        return /* @__PURE__ */ jsxs2("g", { opacity: ready ? 1 : 0, children: [
          /* @__PURE__ */ jsx4("path", { d, fill: "none", stroke: "#080A10", strokeWidth: 13, strokeLinecap: "round" }),
          /* @__PURE__ */ jsx4("path", { d, fill: "none", stroke: lineColor, strokeWidth: 7, strokeLinecap: "round" }),
          [l.a, l.b].map((port, i) => /* @__PURE__ */ jsx4("circle", { cx: port.x, cy: port.y, r: 12, fill: box(l.node).color ?? lineColor, stroke: "#080A10", strokeWidth: 4, opacity: i === 0 ? 1 : q }, i))
        ] }, l.index);
      }) })
    ] }),
    heading && /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: w * 0.08, top: h * 0.06, maxWidth: w * 0.68, background: cardColor, color: textColor, borderLeft: `${8 * u}px solid ${lineColor}`, padding: `${10 * u}px ${20 * u}px`, fontSize: Math.min(36 * u, w * 0.035), lineHeight: 1.12, textTransform: "uppercase", overflowWrap: "anywhere", opacity: ready ? 1 : 0 }, children: heading }),
    /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", right: w * 0.08, top: h * 0.06, background: cardColor, color: textColor, padding: `${10 * u}px ${15 * u}px`, fontSize: 32 * u, opacity: ready ? 1 : 0 }, children: [
      String(state.index + 1).padStart(2, "0"),
      " / ",
      String(steps.length).padStart(2, "0")
    ] }),
    /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: w * 0.08, right: w * 0.08, bottom: h * 0.07, display: "flex", gap: 12 * u }, children: timeline.steps.map((s, i) => /* @__PURE__ */ jsx4("div", { style: { height: 8 * u, flex: 1, background: lineColor, opacity: i <= state.index ? 1 : 0.18 } }, i)) })
  ] });
}
function validateJourney(bend, size, color) {
  if (!Number.isFinite(bend) || bend < -1 || bend > 1) throw new Error("pathBend: -1\u20131.");
  if (!Number.isFinite(size) || size < 6 || size > 30) throw new Error("dotSize: 6\u201330 unidades virtuais.");
  if (!/^#[a-f\d]{6}$/i.test(color)) throw new Error("dotColor deve usar #RRGGBB.");
}
function journeyCurve(a, b, p, bend) {
  const q = Math.max(0, Math.min(1, p)), c = { x: (a.x + b.x) / 2 - (b.y - a.y) * bend, y: (a.y + b.y) / 2 + (b.x - a.x) * bend };
  const point = { x: (1 - q) ** 2 * a.x + 2 * (1 - q) * q * c.x + q * q * b.x, y: (1 - q) ** 2 * a.y + 2 * (1 - q) * q * c.y + q * q * b.y };
  const control = { x: a.x + (c.x - a.x) * q, y: a.y + (c.y - a.y) * q };
  return { point, path: `M ${a.x} ${a.y} Q ${control.x} ${control.y} ${point.x} ${point.y}` };
}
function validateNarrative(nodes, heading) {
  if (typeof heading !== "string" || heading.length > 70) throw new Error("heading deve ser texto com at\xE9 70 caracteres.");
  nodes.forEach((n) => {
    if (n.subtitle !== void 0 && (typeof n.subtitle !== "string" || n.subtitle.length > 120)) throw new Error("subtitle deve ser texto com at\xE9 120 caracteres.");
    if (n.color && !/^#[a-f\d]{6}$/i.test(n.color)) throw new Error("Cor do ponto deve usar #RRGGBB.");
  });
}
function narrativeState(timeline, time) {
  let index = 0;
  timeline.steps.forEach((s, i) => {
    if (time >= s.arrival - 1e-8) index = i;
  });
  const moving = timeline.steps.findIndex((s) => s.move > 0 && time >= s.start - 1e-8 && time < s.arrival - 1e-8);
  return { index, moving, progress: moving < 0 ? 1 : smooth((time - timeline.steps[moving].start) / timeline.steps[moving].move) };
}
function narrativeFit(text, font, width, height, max) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("Canvas indispon\xEDvel.");
  const wrap = (size) => {
    ctx.font = `${size}px ${font}`;
    const lines2 = [];
    for (const paragraph of text.toLocaleUpperCase("pt-BR").split("\n")) {
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
  let lo = 1, hi = max;
  for (let i = 0; i < 18; i++) {
    const size = (lo + hi) / 2, lines2 = wrap(size);
    if (lines2.length <= 2 && lines2.length * size * 1.08 <= height && lines2.every((l) => ctx.measureText(l).width <= width)) lo = size;
    else hi = size;
  }
  const lines = wrap(lo);
  if (lines.length > 2) throw new Error("Prefira frases curtas, com at\xE9 duas linhas.");
  return { size: lo, text: lines.join("\n") };
}
function JourneyHQ(p) {
  const { nodes, steps, timeline, t, w, h, fontFamily, ready, textColor, lineColor, pathBend, dotColor, dotSize, zoomOutDuration, assets } = p;
  const fitted = React2.useMemo(() => new Map(nodes.map((n) => [n.id, { title: p.narrative && ready && n.text ? narrativeFit(n.text, fontFamily, 412, n.asset ? 86 : 140, 90) : void 0, subtitle: p.narrative && ready && n.subtitle ? narrativeFit(n.subtitle, fontFamily, 412, 58, 29) : void 0 }])), [nodes, fontFamily, ready, p.narrative]);
  const state = narrativeState(timeline, t), overview = smooth((t - timeline.overviewAt) / zoomOutDuration), u = Math.min(w, h) / 1080;
  if (![textColor, lineColor].every((c) => /^#[a-f\d]{6}$/i.test(c))) throw new Error("Cores do percurso devem usar #RRGGBB.");
  const boxes = nodes.map((n, i) => ({ ...n, x: n.x ?? (h > w ? i % 2 * 580 : i % 3 * 580), y: n.y ?? (h > w ? Math.floor(i / 2) * 490 : Math.floor(i / 3) * 490) }));
  const box = (id) => boxes.find((n) => n.id === id);
  const point = (id) => ({ x: box(id).x, y: box(id).y + 130 });
  let dot = point(steps[0].node);
  timeline.steps.forEach((s, i) => {
    if (!i || t < s.start) return;
    dot = journeyCurve(point(steps[i - 1].node), point(s.node), s.move === 0 ? 1 : smooth((t - s.start) / s.move), pathBend).point;
  });
  let cx = dot.x, cy = dot.y - 130, scale = Math.min(w * 0.78 / 500, h * 0.7 / 350);
  const hull = timeline.steps.flatMap((s, i) => {
    const a = point(i ? steps[i - 1].node : s.node), b = point(s.node);
    return [a, b, { x: (a.x + b.x) / 2 - (b.y - a.y) * pathBend, y: (a.y + b.y) / 2 + (b.x - a.x) * pathBend }];
  });
  const left = Math.min(...boxes.map((n) => n.x - 260), ...hull.map((v) => v.x - 40)), right = Math.max(...boxes.map((n) => n.x + 260), ...hull.map((v) => v.x + 40));
  const top = Math.min(...boxes.map((n) => n.y - 240), ...hull.map((v) => v.y - 40)), bottom = Math.max(...boxes.map((n) => n.y + 180), ...hull.map((v) => v.y + 40));
  if (t >= timeline.overviewAt) {
    const q = smooth((t - timeline.overviewAt) / zoomOutDuration);
    cx += ((left + right) / 2 - cx) * q;
    cy += ((top + bottom) / 2 - cy) * q;
    scale += (Math.min(w * 0.84 / (right - left), h * 0.82 / (bottom - top)) - scale) * q;
  }
  return /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { overflow: "hidden", fontFamily }, children: [
    /* @__PURE__ */ jsx4(SceneBackground, { backgroundStyle: p.backgroundStyle, backgroundColor: p.backgroundColor, backgroundOpacity: p.backgroundOpacity, paperTone: p.paperTone, gridBackgroundColor: p.gridBackgroundColor, gridLineColor: p.gridLineColor }),
    /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${w / 2}px,${h / 2}px) scale(${scale}) translate(${-cx}px,${-cy}px)` }, children: [
      /* @__PURE__ */ jsxs2("svg", { style: { position: "absolute", overflow: "visible", width: 1, height: 1 }, children: [
        timeline.steps.map((s, i) => {
          if (!i || s.connect === false || t < s.start) return null;
          if (s.from !== steps[i - 1].node) throw new Error("No modo path, from deve ser o ponto anterior; use cards para ramifica\xE7\xF5es.");
          const a = point(s.from), b = point(s.node), q = s.move === 0 ? 1 : smooth((t - s.start) / s.move), d = journeyCurve(a, b, q, pathBend).path;
          return /* @__PURE__ */ jsxs2("g", { children: [
            /* @__PURE__ */ jsx4("path", { d, stroke: "#080A10", strokeWidth: 15, fill: "none", strokeLinecap: "round" }),
            /* @__PURE__ */ jsx4("path", { d, stroke: lineColor, strokeWidth: 8, fill: "none", strokeLinecap: "round" }),
            /* @__PURE__ */ jsx4("path", { d, stroke: "#FFF5D7", strokeWidth: 2, opacity: 0.7, fill: "none", strokeLinecap: "round" })
          ] }, i);
        }),
        boxes.map((n) => {
          const debut = timeline.firstByNode.get(n.id);
          if (t < debut.arrival) return null;
          return /* @__PURE__ */ jsxs2("g", { children: [
            /* @__PURE__ */ jsx4("circle", { cx: n.x + 4, cy: n.y + 134, r: 21, fill: "#080A10" }),
            /* @__PURE__ */ jsx4("circle", { cx: n.x, cy: n.y + 130, r: 20, fill: p.backgroundColor ?? "#18243C", stroke: lineColor, strokeWidth: 6 })
          ] }, n.id);
        })
      ] }),
      boxes.map((n) => {
        const debut = timeline.firstByNode.get(n.id);
        if (t < debut.start) return null;
        const q = debut.move === 0 ? 1 : smooth((t - debut.start) / debut.move);
        if (n.asset && !assets[n.asset]) throw new Error("Asset ausente: " + n.asset);
        let focus = steps[state.index].node === n.id ? 1 : 0;
        if (state.moving >= 0) {
          focus = steps[state.moving].node === n.id ? state.progress : steps[state.moving - 1].node === n.id ? 1 - state.progress : 0;
        }
        const dim = p.narrative ? (0.18 + 0.82 * focus) * (1 - overview) + overview : 1;
        const { title, subtitle } = fitted.get(n.id);
        return /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", left: n.x - 220, top: n.y - 190, width: 440, height: 280, opacity: ready ? q * dim : 0, scale: 0.94 + 0.06 * q, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: p.narrative ? 14 : 18 }, children: [
          n.asset && /* @__PURE__ */ jsx4(Img2, { src: assets[n.asset], style: { width: 310, height: p.narrative ? 90 : 145, objectFit: "contain" } }),
          n.text && /* @__PURE__ */ jsx4("div", { style: { width: 440, boxSizing: "border-box", padding: "0 14px", textAlign: "center", textTransform: "uppercase", fontSize: title?.size ?? Math.min(76, 330 / Math.sqrt(Math.max(1, n.text.length / 2))), lineHeight: 1.08, color: n.color ?? textColor, whiteSpace: p.narrative ? "pre" : void 0, overflowWrap: p.narrative ? void 0 : "anywhere", textShadow: fontFamily === "Anton" ? "none" : "4px 5px 0 #080A10", WebkitTextStroke: fontFamily === "Anton" ? "0px transparent" : ".7px #080A10" }, children: title?.text ?? n.text }),
          subtitle && /* @__PURE__ */ jsx4("div", { style: { width: 412, whiteSpace: "pre", textAlign: "center", fontSize: subtitle.size, lineHeight: 1.08, color: textColor, textShadow: fontFamily === "Anton" ? "none" : "1px 2px 0 #080A10" }, children: subtitle.text })
        ] }, n.id);
      }),
      /* @__PURE__ */ jsxs2("svg", { style: { position: "absolute", overflow: "visible", width: 1, height: 1 }, children: [
        /* @__PURE__ */ jsx4("circle", { cx: dot.x + 5, cy: dot.y + 6, r: dotSize + 5, fill: "#080A10" }),
        /* @__PURE__ */ jsx4("circle", { cx: dot.x, cy: dot.y, r: dotSize + 4, fill: "#FFF5D7", stroke: "#080A10", strokeWidth: 3 }),
        /* @__PURE__ */ jsx4("circle", { cx: dot.x, cy: dot.y, r: dotSize, fill: dotColor }),
        /* @__PURE__ */ jsx4("circle", { cx: dot.x - dotSize * 0.25, cy: dot.y - dotSize * 0.3, r: dotSize * 0.25, fill: "white" })
      ] })
    ] }),
    p.narrative && /* @__PURE__ */ jsxs2(Fragment2, { children: [
      /* @__PURE__ */ jsxs2("div", { style: { position: "absolute", left: w * 0.08, right: w * 0.08, top: h * 0.07, display: "flex", gap: 20 * u, alignItems: "flex-start", justifyContent: "space-between", color: textColor, opacity: ready ? 1 : 0 }, children: [
        /* @__PURE__ */ jsx4("div", { style: { maxWidth: "75%", borderLeft: `${8 * u}px solid ${lineColor}`, paddingLeft: 18 * u, fontSize: Math.min(38 * u, w * 0.035), lineHeight: 1.15, textTransform: "uppercase", overflowWrap: "anywhere" }, children: p.heading }),
        /* @__PURE__ */ jsxs2("div", { style: { fontSize: 34 * u, whiteSpace: "nowrap" }, children: [
          String(state.index + 1).padStart(2, "0"),
          " / ",
          String(steps.length).padStart(2, "0")
        ] })
      ] }),
      /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: w * 0.08, right: w * 0.08, bottom: h * 0.09, display: "flex", gap: 12 * u }, children: timeline.steps.map((s, i) => /* @__PURE__ */ jsx4("div", { style: { height: 8 * u, flex: 1, background: i <= state.index ? lineColor : textColor, opacity: i <= state.index ? 1 : 0.16 } }, i)) })
    ] })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const BrainstormHQCena = BrainstormHQ;
