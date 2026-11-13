// Cena HQ BarraLoadingHQ do Content Lab (arquivo único, imports só de React/Remotion).
import { AbsoluteFill, Img, staticFile } from "remotion";
import { jsx } from "react/jsx-runtime";
function HQComicPage({ opacity = 100, src = staticFile("assets/kit/backgrounds/comic-page.png") }) {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) throw Error("opacity must be 0\u2013100");
  return /* @__PURE__ */ jsx(AbsoluteFill, { style: { pointerEvents: "none", opacity: opacity / 100, overflow: "hidden" }, children: /* @__PURE__ */ jsx(Img, { src, style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" } }) });
}

import React from "react";
import { AbsoluteFill as AbsoluteFill2, useCurrentFrame, useVideoConfig } from "remotion";
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
var clamp = (v) => Math.max(0, Math.min(1, v));
var colorValid = (c) => /^#[\da-f]{6}$/i.test(c);
function validateLoading(points, colors, duration) {
  if (points.length < 2 || !colors.length) throw new Error("Informe pelo menos dois pontos de progresso e uma cor.");
  points.forEach((p, i) => {
    if (!Number.isFinite(p.at) || p.at < 0 || p.at > duration || !Number.isFinite(p.value) || p.value < 0 || p.value > 100 || i > 0 && (p.at <= points[i - 1].at || p.value < points[i - 1].value) || !["linear", "smooth"].includes(p.easing ?? "linear")) throw new Error("points: tempos crescentes dentro da cena, value de 0 a 100 sem retroceder, easing linear/smooth.");
  });
  colors.forEach((c, i) => {
    if (!Number.isFinite(c.at) || c.at < 0 || c.at > duration || !colorValid(c.color) || i > 0 && c.at <= colors[i - 1].at) throw new Error("colors: tempos crescentes dentro da cena e cores #RRGGBB.");
  });
}
function progressAt(points, time) {
  if (time <= points[0].at) return points[0].value;
  for (let i = 1; i < points.length; i++) if (time <= points[i].at) {
    const a = points[i - 1], b = points[i];
    let p = clamp((time - a.at) / (b.at - a.at));
    if (b.easing === "smooth") p = p * p * (3 - 2 * p);
    return a.value + (b.value - a.value) * p;
  }
  return points[points.length - 1].value;
}
function colorAt(colors, time) {
  if (time <= colors[0].at) return colors[0].color;
  for (let i = 1; i < colors.length; i++) if (time <= colors[i].at) {
    const a = colors[i - 1], b = colors[i], p = clamp((time - a.at) / (b.at - a.at));
    return "#" + [1, 3, 5].map((k) => Math.round(parseInt(a.color.slice(k, k + 2), 16) * (1 - p) + parseInt(b.color.slice(k, k + 2), 16) * p).toString(16).padStart(2, "0")).join("");
  }
  return colors[colors.length - 1].color;
}
function BarraLoadingHQ({
  backgroundStyle,
  backgroundOpacity = 100,
  points,
  colors,
  position = "bottom",
  width = 86,
  height = 6,
  margin = 7,
  x,
  y,
  trackColor = "#FFF3D6",
  outlineColor = "#101018",
  texture = true,
  opacity = 1
}) {
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig();
  const time = useCurrentFrame() / fps;
  const duration = durationInFrames / fps, last = Math.max(0, (durationInFrames - 1) / fps);
  const inputKey = JSON.stringify({ points, colors, duration, last });
  const { progress, stops } = React.useMemo(() => {
    const p = points ?? [{ at: 0, value: 0 }, { at: last || duration, value: 100 }], c = colors ?? [{ at: 0, color: "#2689FF" }];
    validateLoading(p, c, duration);
    return { progress: p, stops: c };
  }, [inputKey]);
  if (!["top", "bottom", "center"].includes(position) || !colorValid(trackColor) || !colorValid(outlineColor)) throw new Error("Posi\xE7\xE3o inv\xE1lida ou cores fora do formato #RRGGBB.");
  if (!Number.isFinite(width) || width < 5 || width > 96 || !Number.isFinite(height) || height < 1 || height > 20 || !Number.isFinite(margin) || margin < 1 || margin > 35 || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new Error("width: 5\u201396%; height: 1\u201320% do lado menor; margin: 1\u201335%; opacity: 0\u20131.");
  if (x !== void 0 && (!Number.isFinite(x) || x < 0 || x > 100) || y !== void 0 && (!Number.isFinite(y) || y < 0 || y > 100)) throw new Error("x e y: percentual 0\u2013100 do centro da barra.");
  const bw = w * width / 100, bh = Math.min(w, h) * height / 100, ink = Math.max(2, bh * 0.075), shadow = bh * 0.13;
  const cx = w * (x ?? 50) / 100, cy = y !== void 0 ? h * y / 100 : position === "top" ? h * margin / 100 + bh / 2 : position === "center" ? h / 2 : h * (1 - margin / 100) - bh / 2;
  if (cx - bw / 2 < ink || cx + bw / 2 + shadow > w - ink || cy - bh / 2 < ink || cy + bh / 2 + shadow > h - ink) throw new Error("Barra fora da tela: ajuste x/y, width ou margin.");
  const sampleTime = time >= last ? duration : time;
  const value = progressAt(progress, sampleTime), fill = colorAt(stops, sampleTime), id = React.useId().replace(/:/g, "");
  return /* @__PURE__ */ jsxs(AbsoluteFill2, { style: { pointerEvents: "none", opacity, backgroundColor: "transparent" }, children: [
    backgroundStyle === "comic-page" && /* @__PURE__ */ jsx2(HQComicPage, { opacity: backgroundOpacity }),
    /* @__PURE__ */ jsxs("svg", { width: bw + shadow + ink * 2, height: bh + shadow + ink * 2, viewBox: `0 0 ${bw + shadow + ink * 2} ${bh + shadow + ink * 2}`, style: { position: "absolute", left: cx - bw / 2 - ink, top: cy - bh / 2 - ink, overflow: "visible" }, children: [
      /* @__PURE__ */ jsxs("defs", { children: [
        /* @__PURE__ */ jsx2("clipPath", { id: `${id}track`, children: /* @__PURE__ */ jsx2("rect", { x: ink * 2, y: ink * 2, width: bw - ink * 2, height: bh - ink * 2, rx: bh * 0.15 }) }),
        /* @__PURE__ */ jsx2("clipPath", { id: `${id}progress`, children: /* @__PURE__ */ jsx2("rect", { x: ink * 2, y: ink * 2, width: (bw - ink * 2) * value / 100, height: bh - ink * 2 }) }),
        /* @__PURE__ */ jsx2("pattern", { id: `${id}dots`, width: bh * 0.24, height: bh * 0.24, patternUnits: "userSpaceOnUse", children: /* @__PURE__ */ jsx2("circle", { cx: bh * 0.08, cy: bh * 0.08, r: bh * 0.027, fill: outlineColor, opacity: ".25" }) }),
        /* @__PURE__ */ jsx2("pattern", { id: `${id}hatch`, width: bh * 0.6, height: bh, patternUnits: "userSpaceOnUse", children: /* @__PURE__ */ jsx2("path", { d: `M 0 ${bh} L ${bh * 0.55} 0`, stroke: "white", strokeWidth: bh * 0.14, opacity: ".15" }) })
      ] }),
      /* @__PURE__ */ jsx2("rect", { x: ink + shadow, y: ink + shadow, width: bw, height: bh, rx: bh * 0.22, fill: outlineColor }),
      /* @__PURE__ */ jsx2("rect", { x: ink, y: ink, width: bw, height: bh, rx: bh * 0.22, fill: trackColor, stroke: outlineColor, strokeWidth: ink }),
      /* @__PURE__ */ jsx2("g", { clipPath: `url(#${id}track)`, children: /* @__PURE__ */ jsxs("g", { clipPath: `url(#${id}progress)`, children: [
        /* @__PURE__ */ jsx2("rect", { x: ink * 2, y: ink * 2, width: bw - ink * 2, height: bh - ink * 2, fill }),
        texture && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx2("rect", { x: ink * 2, y: ink * 2, width: bw, height: bh, fill: `url(#${id}dots)` }),
          /* @__PURE__ */ jsx2("rect", { x: ink * 2, y: ink * 2, width: bw, height: bh, fill: `url(#${id}hatch)` })
        ] }),
        /* @__PURE__ */ jsx2("path", { d: `M ${ink * 3} ${bh * 0.32} Q ${bw * 0.3} ${bh * 0.22} ${bw * 0.58} ${bh * 0.32} T ${bw - ink * 3} ${bh * 0.3}`, fill: "none", stroke: "white", strokeOpacity: ".52", strokeWidth: bh * 0.09, strokeLinecap: "round" }),
        /* @__PURE__ */ jsx2("path", { d: `M ${ink * 2} ${bh * 0.8} Q ${bw * 0.45} ${bh * 0.7} ${bw - ink * 2} ${bh * 0.81}`, fill: "none", stroke: outlineColor, strokeOpacity: ".18", strokeWidth: bh * 0.13 })
      ] }) })
    ] })
  ] });
}
export const BarraLoadingHQCena = BarraLoadingHQ;
