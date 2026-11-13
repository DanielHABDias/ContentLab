// Cena HQ PersonagemEspiralLegenda do Content Lab (arquivo único, imports só de React/Remotion).
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

import { AbsoluteFill, Img, staticFile } from "remotion";
import { jsx } from "react/jsx-runtime";
function HQComicPage({ opacity = 100, src = staticFile("assets/kit/backgrounds/comic-page.png") }) {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) throw Error("opacity must be 0\u2013100");
  return /* @__PURE__ */ jsx(AbsoluteFill, { style: { pointerEvents: "none", opacity: opacity / 100, overflow: "hidden" }, children: /* @__PURE__ */ jsx(Img, { src, style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" } }) });
}

import React from "react";
import { AbsoluteFill as AbsoluteFill2, Img as Img2, delayRender, continueRender, cancelRender, useCurrentFrame, useVideoConfig } from "remotion";

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

import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
var clamp = (v) => Math.max(0, Math.min(1, v));
function spiralField(columns, rows, width, height, variant) {
  const phase = new Float64Array(columns * rows), grain = new Int16Array(columns * rows), radius = Math.hypot(width, height) / 2;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const dx = (x + 0.5) / columns * width - width / 2, dy = (y + 0.5) / rows * height - height / 2, d = Math.hypot(dx, dy) / radius;
    const bend = (variant === "crescente" ? 0.55 : 0.42) * Math.pow(d, 0.85) + 0.02 * Math.sin(d * 5) * d, i = y * columns + x;
    phase[i] = (Math.atan2(dy, dx) - bend) * 10;
    grain[i] = (x * 137 + y * 53 + x * y * 7) % 19 - 9;
  }
  return { phase, grain };
}
function Spiral({ variant, time, width, height }) {
  const canvas = React.useRef(null);
  const pixel = Math.max(2, Math.min(width, height) / 180);
  const columns = Math.ceil(width / pixel);
  const rows = Math.ceil(height / pixel);
  const field = React.useMemo(() => spiralField(columns, rows, width, height, variant), [columns, rows, width, height, variant]);
  const buffer = React.useRef(null);
  React.useLayoutEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) throw new Error("Canvas indispon\xEDvel para a espiral pixelada.");
    const pixels = buffer.current?.width === columns && buffer.current?.height === rows ? buffer.current : ctx.createImageData(columns, rows);
    buffer.current = pixels;
    const rotation = time * (variant === "crescente" ? -0.09 : 0.075) * 10;
    for (let i = 0; i < field.phase.length; i++) {
      const dark = Math.sin(field.phase[i] - rotation) > 0;
      const value = Math.max(0, Math.min(255, (dark ? variant === "crescente" ? 52 : 8 : 226) + field.grain[i]));
      const j = i * 4;
      pixels.data[j] = value;
      pixels.data[j + 1] = value;
      pixels.data[j + 2] = value;
      pixels.data[j + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }, [columns, rows, field, variant, time]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx2("canvas", { ref: canvas, width: columns, height: rows, style: { position: "absolute", width: "100%", height: "100%", imageRendering: "pixelated" } }),
    /* @__PURE__ */ jsx2(AbsoluteFill2, { style: { opacity: 0.32, backgroundImage: "radial-gradient(#000 0.75px, transparent 1.15px)", backgroundSize: "3px 3px" } }),
    /* @__PURE__ */ jsx2(AbsoluteFill2, { style: { backgroundImage: "radial-gradient(ellipse at center, transparent 14%, #0002 48%, #000B 100%)" } })
  ] });
}
function PersonagemEspiralLegenda({
  backgroundStyle,
  backgroundOpacity = 100,
  fontFamily = "Anton",
  assets = {},
  backgroundVariant = "espiral",
  captions,
  words,
  transcriptOffset = 0,
  entryDuration = 0.6,
  entryDelay = 0,
  characterScale = 1,
  headAnchor = { x: 0.5, y: 0.3 },
  sway = 0.65,
  maxWords = 5,
  captionColor = "#FFFFFF",
  highlightColors = ["#175AE8", "#F22932", "#111111"]
}) {
  const fontUrl = resolveHQFont(fontFamily, assets);
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const duration = durationInFrames / fps;
  if (!assets.character || !fontUrl) throw new Error("Informe assets.character (PNG transparente) e fontUrl.");
  if (!["espiral", "crescente"].includes(backgroundVariant)) throw new Error("backgroundVariant deve ser espiral ou crescente.");
  if (![entryDuration, characterScale].every((n) => Number.isFinite(n) && n > 0) || !Number.isFinite(entryDelay) || entryDelay < 0 || entryDelay + entryDuration > duration) throw new Error("Entrada e escala inv\xE1lidas ou entrada maior que a cena.");
  if (![headAnchor.x, headAnchor.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) || !Number.isFinite(sway) || sway < 0) throw new Error("headAnchor usa coordenadas de 0 a 1; sway deve ser >= 0.");
  if (!Number.isInteger(maxWords) || maxWords < 1 || maxWords > 8) throw new Error("maxWords deve ser de 1 a 8.");
  if (!Number.isFinite(transcriptOffset) || transcriptOffset < 0) throw new Error("transcriptOffset deve ser >= 0.");
  if (!highlightColors.length || ![captionColor, ...highlightColors].every((c) => /^#[a-f\d]{6}$/i.test(c))) throw new Error("Informe cores #RRGGBB e ao menos uma cor de destaque.");
  if (captions !== void 0 && words !== void 0) throw new Error("Use captions OU words, n\xE3o os dois.");
  const cues = React.useMemo(() => {
    const value = captions ?? (words ?? []).filter((word) => word.end > transcriptOffset && word.start < transcriptOffset + duration).map((word) => ({
      text: word.word ?? word.text ?? "",
      startMs: Math.max(0, word.start - transcriptOffset) * 1e3,
      endMs: Math.min(duration, word.end - transcriptOffset) * 1e3,
      timestampMs: null,
      confidence: null
    }));
    value.forEach((cue, i) => {
      if (!cue.text?.trim() || !Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs) || cue.startMs < 0 || cue.endMs <= cue.startMs || cue.endMs > duration * 1e3 + 1 || i > 0 && cue.startMs < value[i - 1].endMs) throw new Error("Legendas requerem palavras ordenadas, sem sobreposi\xE7\xE3o e dentro da cena.");
    });
    return value;
  }, [captions, words, transcriptOffset, duration]);
  const [bounds, setBounds] = React.useState(null);
  const [handle] = React.useState(() => delayRender("Preparando personagem e legenda"));
  React.useEffect(() => {
    let live = true;
    const ready = imageBoundsHQ(assets.character);
    Promise.all([ready, loadFont({ family: fontFamily, url: fontUrl })]).then(([box]) => {
      if (live) setBounds(box);
      continueRender(handle);
    }).catch(cancelRender);
    return () => {
      live = false;
    };
  }, [assets.character, fontUrl, fontFamily, handle]);
  const p = clamp((t - entryDelay) / entryDuration);
  const arrival = 1 - Math.pow(1 - p, 4);
  const baseHeight = bounds ? Math.min(h * 1.4, w * 0.92 * bounds.height / bounds.width) : h * 1.4;
  const charH = baseHeight * characterScale;
  const charW = bounds ? charH * bounds.width / bounds.height : 0;
  const scale = bounds ? charH / bounds.height : 1;
  const unit = Math.min(w, h) / 1080;
  const angle = Math.sin(t * 2.1) * sway * arrival;
  const pages = React.useMemo(() => {
    const groups = [];
    for (const cue of cues) {
      const previous = groups.at(-1);
      if (!previous || previous.length >= maxWords || previous.at(-1).pageBreakAfter || cue.startMs - previous.at(-1).endMs > 600) groups.push([cue]);
      else previous.push(cue);
    }
    return groups;
  }, [cues, maxWords]);
  const page = pages.find((group) => t * 1e3 >= group[0].startMs && t * 1e3 < group.at(-1).endMs);
  return /* @__PURE__ */ jsxs(AbsoluteFill2, { style: { overflow: "hidden", background: backgroundStyle === "comic-page" ? "transparent" : "#080808" }, children: [
    backgroundStyle === "comic-page" ? /* @__PURE__ */ jsx2(HQComicPage, { opacity: backgroundOpacity }) : /* @__PURE__ */ jsx2(Spiral, { variant: backgroundVariant, time: t, width: w, height: h }),
    bounds && /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      left: w / 2 - charW * headAnchor.x,
      top: h / 2 - charH * headAnchor.y,
      width: charW,
      height: charH,
      translate: `0 ${(1 - arrival) * (h + charH)}px`,
      rotate: `${angle}deg`,
      transformOrigin: `${headAnchor.x * 100}% ${headAnchor.y * 100}%`
    }, children: /* @__PURE__ */ jsx2(Img2, { src: assets.character, style: {
      position: "absolute",
      left: -bounds.x * scale,
      top: -bounds.y * scale,
      width: bounds.sourceWidth * scale,
      height: bounds.sourceHeight * scale,
      maxWidth: "none"
    } }) }),
    page && /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      left: "8%",
      width: "84%",
      bottom: h * 0.075,
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: `${8 * unit}px ${12 * unit}px`,
      fontFamily,
      fontSize: (w > h ? 65 : 76) * unit,
      lineHeight: 1.15,
      color: captionColor,
      textTransform: "uppercase",
      textShadow: fontFamily === "Anton" ? "none" : `${3 * unit}px ${4 * unit}px ${3 * unit}px #000`,
      WebkitTextStroke: fontFamily === "Anton" ? "0px transparent" : `${1.3 * unit}px #000`,
      zIndex: 10
    }, children: page.map((cue, i) => {
      const active = t * 1e3 >= cue.startMs && t * 1e3 < cue.endMs;
      return /* @__PURE__ */ jsx2("span", { style: {
        background: active ? highlightColors[i % highlightColors.length] : "transparent",
        padding: `${4 * unit}px ${10 * unit}px`,
        borderRadius: 10 * unit,
        overflowWrap: "anywhere",
        maxWidth: "100%"
      }, children: cue.text.trim() }, `${cue.startMs}-${i}`);
    }) })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const PersonagemEspiralLegendaCena = PersonagemEspiralLegenda;
