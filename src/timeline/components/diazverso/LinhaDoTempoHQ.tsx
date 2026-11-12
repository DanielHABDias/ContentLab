// Cena LinhaDoTempoHQ do plugin Diazverso 1.3.0, compilada por scripts/build-diazverso-scenes.mjs. Não editar à mão.
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
function fitLabelHQ(text, family, width, height, maximum, lineHeight = 1.08) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("Canvas indispon\xEDvel.");
  const wrap = (size) => {
    ctx.font = `${size}px ${family}`;
    const lines = [];
    for (const paragraph of text.normalize("NFC").toLocaleUpperCase("pt-BR").split("\n")) {
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
  let lo = 0.5, hi = maximum;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2, lines = wrap(mid);
    if (lines.length * mid * lineHeight <= height && lines.every((l) => ctx.measureText(l).width <= width)) lo = mid;
    else hi = mid;
  }
  return { lines: wrap(lo), size: lo };
}

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/LinhaDoTempoHQ.tsx
import React2 from "react";
import { AbsoluteFill as AbsoluteFill3, Freeze, OffthreadVideo, useCurrentFrame as useCurrentFrame2, useVideoConfig as useVideoConfig2, delayRender, continueRender, cancelRender } from "remotion";

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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/LinhaDoTempoHQ.tsx
import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var clamp = (v) => Math.max(0, Math.min(1, v));
var ease = (v) => {
  const p = clamp(v);
  return p * p * p * (p * (p * 6 - 15) + 10);
};
var mix = (a, b, p) => a + (b - a) * p;
function LinhaDoTempoHQ({
  fontFamily = "Anton",
  backgroundStyle = "halftone",
  backgroundOpacity = 100,
  paperTone = "light",
  gridBackgroundColor = "#10101A",
  gridLineColor = "#858595",
  clips,
  direction = "forward",
  backgroundColor = "#E8C64F",
  accentColor = "#2676E8",
  textColor = "#FFFFFF",
  startDelay = 0.3,
  moveDuration = 0.8,
  enterDuration = 1.05,
  enterLast = true,
  assets = {}
}) {
  const fontUrl = resolveHQFont(fontFamily, assets);
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig2();
  const t = useCurrentFrame2() / fps;
  const horizontal = w > h;
  const u = Math.min(w, h) / 1080;
  if (!Array.isArray(clips) || !clips.length) throw new Error("Informe pelo menos um clip.");
  if (!["forward", "reverse"].includes(direction)) throw new Error("direction deve ser forward ou reverse.");
  if (![backgroundColor, accentColor, textColor].every((c) => /^#[a-f\d]{6}$/i.test(c))) throw new Error("Use cores #RRGGBB.");
  if (!Number.isFinite(startDelay) || startDelay < 0 || !Number.isFinite(moveDuration) || moveDuration <= 0 || !Number.isFinite(enterDuration) || enterDuration <= 0) throw new Error("Tempos de movimento inv\xE1lidos.");
  clips.forEach((c) => {
    if (!assets[c.asset]) throw new Error(`Asset ausente: ${c.asset}`);
    if (!Number.isFinite(c.hold ?? 2) || (c.hold ?? 2) < 0.35 || !Number.isFinite(c.sourceStart ?? 0) || (c.sourceStart ?? 0) < 0) throw new Error("hold deve ser >= .35 e sourceStart >= 0.");
  });
  if (!fontUrl) throw new Error("Informe fontUrl.");
  const [labels, setLabels] = React2.useState(null);
  const [fontHandle] = React2.useState(() => delayRender("Carregando Bangers da linha do tempo"));
  React2.useEffect(() => {
    loadFont({ family: fontFamily, url: fontUrl }).then(() => {
      setLabels(clips.map((c) => ({ title: fitLabelHQ(c.title ?? "", fontFamily, w * (horizontal ? 0.55 : 0.84), h * 0.13, (horizontal ? 72 : 94) * u), subtitle: fitLabelHQ(c.subtitle ?? "", fontFamily, w * (horizontal ? 0.55 : 0.84), h * 0.07, (horizontal ? 38 : 49) * u) })));
      continueRender(fontHandle);
    }).catch(cancelRender);
  }, [fontUrl, fontFamily, JSON.stringify(clips), w, h, fontHandle]);
  const indices = clips.map((_, i) => i);
  if (direction === "reverse") indices.reverse();
  let cursor = startDelay;
  const schedule = indices.map((index, order) => {
    const at = cursor;
    const end = at + (clips[index].hold ?? 2);
    cursor = end + (order < clips.length - 1 ? moveDuration : 0);
    return { index, at, end };
  });
  const last = schedule[schedule.length - 1];
  const minimum = last.end + (enterLast ? enterDuration : 0);
  if (minimum > durationInFrames / fps + 1 / fps) throw new Error(`Cena curta: requer pelo menos ${minimum.toFixed(3)} segundos.`);
  const activeOrder = Math.max(0, schedule.findLastIndex((c) => t >= c.at));
  const current = schedule[activeOrder];
  const next = schedule[activeOrder + 1];
  const spacing = w * (horizontal ? 0.78 : 1.08);
  const travel = next ? ease((t - current.end) / moveDuration) : 0;
  const camera = mix(current.index * spacing, (next?.index ?? current.index) * spacing, travel);
  const zoom = enterLast ? ease(progressHQ(t, last.end, enterDuration, fps)) : 0;
  const lineY = h * (horizontal ? 0.72 : 0.59);
  const cw = w * (horizontal ? 0.55 : 0.84);
  const ch = h * (horizontal ? 0.55 : 0.3);
  const top = lineY - ch - h * 0.055;
  const origin = w / 2 - camera;
  const progressStart = direction === "forward" ? 0 : camera;
  const progressEnd = direction === "forward" ? camera : (clips.length - 1) * spacing;
  return /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { overflow: "hidden", fontFamily }, children: [
    /* @__PURE__ */ jsx4(SceneBackground, { ...{ backgroundStyle, backgroundColor, backgroundOpacity, paperTone, gridBackgroundColor, gridLineColor }, children: /* @__PURE__ */ jsx4(AbsoluteFill3, { style: { opacity: 0.24 * (1 - zoom), backgroundImage: `radial-gradient(#080A11 ${3 * u}px, transparent ${3.8 * u}px)`, backgroundSize: `${19 * u}px ${19 * u}px` } }) }),
    /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { translate: `${Math.sin(t * 0.8) * 3 * u * (1 - zoom)}px ${Math.sin(t) * 4 * u * (1 - zoom)}px`, rotate: `${Math.sin(t * 0.6) * 0.18 * (1 - zoom)}deg` }, children: [
      /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: origin - w, top: lineY - 8 * u, width: (clips.length - 1) * spacing + 2 * w, height: 16 * u, background: "#FAF7E9", border: `${4 * u}px solid #080A11`, boxSizing: "border-box", opacity: 1 - zoom } }),
      /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: origin + progressStart, top: lineY - 4 * u, width: Math.max(0, progressEnd - progressStart), height: 8 * u, background: accentColor, opacity: 1 - zoom } }),
      schedule.map((cue, order) => {
        const c = clips[cue.index];
        const final = order === schedule.length - 1;
        const expanding = final ? zoom : 0;
        const revealDuration = Math.min(0.3, (c.hold ?? 2) * 0.3), dimDuration = Math.min(0.24, (c.hold ?? 2) * 0.3);
        const reveal = ease((t - cue.at) / revealDuration);
        const leave = !final ? ease((t - (cue.end - dimDuration)) / dimDuration) : 0;
        const light = reveal * (1 - leave);
        const elapsed = Math.max(0, Math.min(t, final && enterLast ? durationInFrames / fps : cue.end - (final ? 0 : dimDuration)) - cue.at);
        const x = origin + cue.index * spacing;
        return /* @__PURE__ */ jsxs2(React2.Fragment, { children: [
          /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: x - 18 * u, top: lineY - 18 * u, width: 36 * u, height: 36 * u, borderRadius: "50%", background: t >= cue.at ? accentColor : "#FAF7E9", border: `${5 * u}px solid #080A11`, boxSizing: "border-box", opacity: 1 - zoom } }),
          /* @__PURE__ */ jsxs2("div", { style: {
            position: "absolute",
            left: x - cw / 2,
            top: lineY + 43 * u,
            width: cw,
            textAlign: "center",
            opacity: reveal * (1 - zoom),
            color: textColor,
            fontFamily,
            textTransform: "uppercase",
            background: "transparent",
            textShadow: fontFamily === "Anton" ? "none" : `${4 * u}px ${5 * u}px 0 #080A11, ${7 * u}px ${9 * u}px ${2 * u}px #080A1180`
          }, children: [
            /* @__PURE__ */ jsx4("div", { style: { fontSize: labels?.[cue.index].title.size ?? (horizontal ? 72 : 94) * u, lineHeight: 1.08, whiteSpace: "pre" }, children: labels?.[cue.index].title.lines.join("\n") ?? c.title }),
            /* @__PURE__ */ jsx4("div", { style: { fontSize: labels?.[cue.index].subtitle.size ?? (horizontal ? 38 : 49) * u, marginTop: 14 * u, lineHeight: 1.08, whiteSpace: "pre" }, children: labels?.[cue.index].subtitle.lines.join("\n") ?? c.subtitle })
          ] }),
          /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: mix(x - cw / 2, 0, expanding), top: mix(top + (1 - reveal) * 40 * u, 0, expanding), width: mix(cw, w, expanding), height: mix(ch, h, expanding), boxSizing: "border-box", border: `${8 * u * (1 - expanding)}px solid ${accentColor}`, background: "#080A11", overflow: "hidden", opacity: reveal * (final ? 1 : 1 - zoom), zIndex: final && zoom > 0 ? 20 : 2, boxShadow: `${11 * u * (1 - expanding)}px ${13 * u * (1 - expanding)}px 0 #080A11` }, children: /* @__PURE__ */ jsxs2(AbsoluteFill3, { style: { filter: `grayscale(${1 - light}) brightness(${0.32 + 0.68 * light})` }, children: [
            (Math.abs(x - w / 2) < w + cw || expanding > 0) && /* @__PURE__ */ jsx4(Freeze, { frame: Math.round(elapsed * fps), children: /* @__PURE__ */ jsx4(OffthreadVideo, { src: assets[c.asset], muted: true, trimBefore: Math.round((c.sourceStart ?? 0) * fps), style: { position: "absolute", width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" } }) }),
            c.crt && /* @__PURE__ */ jsx4(AbsoluteFill3, { style: { backgroundImage: `radial-gradient(circle, transparent 45%, #0006 100%), repeating-linear-gradient(to bottom, #0004 0px, #0004 ${u}px, #FFFFFF08 ${2 * u}px, transparent ${4 * u}px)` } })
          ] }) })
        ] }, cue.index);
      }),
      /* @__PURE__ */ jsx4("div", { style: { position: "absolute", left: w / 2 - 9 * u, top: lineY - 9 * u, width: 18 * u, height: 18 * u, borderRadius: "50%", background: "#FFFFFF", opacity: (1 - zoom) * ease((t - startDelay) / 0.2), zIndex: 5 } })
    ] })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const LinhaDoTempoHQCena = LinhaDoTempoHQ;
