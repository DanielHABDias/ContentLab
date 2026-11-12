// Cena QuadroHQSobreCena do plugin Diazverso 1.2.0, compilada por scripts/build-diazverso-scenes.mjs. Não editar à mão.
// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/HQMotion.tsx
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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/HQComicPage.tsx
import { AbsoluteFill, Img, staticFile } from "remotion";
import { jsx } from "react/jsx-runtime";
function HQComicPage({ opacity = 100, src = staticFile("assets/brand/backgrounds/comic-page.png") }) {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) throw Error("opacity must be 0\u2013100");
  return /* @__PURE__ */ jsx(AbsoluteFill, { style: { pointerEvents: "none", opacity: opacity / 100, overflow: "hidden" }, children: /* @__PURE__ */ jsx(Img, { src, style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" } }) });
}

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/QuadroHQSobreCena.tsx
import React from "react";
import {
  AbsoluteFill as AbsoluteFill2,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig
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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/QuadroHQSobreCena.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var clamp = (value) => Math.max(0, Math.min(1, value));
var ease = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
var readableInk = (hex) => {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1e3;
  return luminance >= 135 ? "#090C12" : "#FFFFFF";
};
function QuadroHQSobreCena({
  backgroundStyle,
  backgroundOpacity = 100,
  fontFamily = "Anton",
  compactAt = 2,
  compactDuration = 0.65,
  compactScale = 0.58,
  upperText,
  lowerText,
  tagColor = "#5CA5AD",
  assets = {}
}) {
  const mainFont = fontFamily ?? "Anton", tagFont = fontFamily ?? "Bangers";
  const mainFontUrl = resolveHQFont(mainFont, assets), tagFontUrl = resolveHQFont(tagFont, assets);
  if (!upperText?.trim() || !lowerText?.trim()) {
    throw new Error("QuadroHQSobreCena requer upperText e lowerText.");
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(tagColor)) {
    throw new Error("tagColor deve ser hexadecimal no formato #RRGGBB.");
  }
  const frame = useCurrentFrame();
  const { fps, width: w, height: h } = useVideoConfig();
  const horizontal = w > h;
  const unit = Math.min(w, h) / 1080;
  const time = frame / fps;
  const frameIn = ease(time / 0.24);
  const mainOpen = ease((time - 0.08) / 0.4);
  const tagOpen = ease((time - 0.2) / 0.3);
  if (!Number.isFinite(compactAt) || compactAt < 0 || !Number.isFinite(compactDuration) || compactDuration <= 0 || !Number.isFinite(compactScale) || compactScale < 0.2 || compactScale > 1) throw Error("compactAt >= 0, compactDuration > 0, compactScale: 0.2\u20131.");
  const compact = horizontal ? ease((time - compactAt) / compactDuration) : 0;
  const panelScale = 1 - (1 - compactScale) * compact;
  const upper = upperText.toLocaleUpperCase("pt-BR");
  const lower = lowerText.toLocaleUpperCase("pt-BR");
  const fontSize = Math.max(46 * unit, Math.min(94 * unit, w * (lower.length > 28 ? 0.058 : lower.length > 19 ? 0.07 : 0.091)));
  const [fitted, setFitted] = React.useState(null);
  const [handle] = React.useState(() => delayRender("Carregando fontes do quadro HQ"));
  React.useEffect(() => {
    Promise.all([
      loadFont({ family: mainFont, url: mainFontUrl }),
      loadFont({ family: tagFont, url: tagFontUrl })
    ]).then(() => {
      setFitted(fitLabelHQ(lowerText, mainFont, w * (horizontal ? 0.65 : 0.9) - 62 * unit, h * (horizontal ? 0.24 : 0.2), fontSize, 0.96));
      continueRender(handle);
    }).catch((error) => cancelRender(error));
  }, [mainFontUrl, tagFontUrl, mainFont, tagFont, lowerText, w, h, handle]);
  const paper = "#F5EFDE";
  const ink = "#111723";
  const tagInk = readableInk(tagColor);
  return /* @__PURE__ */ jsxs(AbsoluteFill2, { style: { background: "transparent", pointerEvents: "none", overflow: "hidden" }, children: [
    backgroundStyle === "comic-page" && /* @__PURE__ */ jsx2(HQComicPage, { opacity: backgroundOpacity }),
    backgroundStyle !== "comic-page" && /* @__PURE__ */ jsx2(AbsoluteFill2, { style: {
      pointerEvents: "none",
      opacity: 0.22,
      backgroundImage: `radial-gradient(circle, #080A11 ${3.2 * unit}px, transparent ${3.8 * unit}px)`,
      backgroundSize: `${18 * unit}px ${18 * unit}px`
    } }),
    /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      inset: "1.5% 3% 2.4%",
      border: `${5 * unit}px solid ${paper}`,
      boxSizing: "border-box",
      opacity: 0.9 * frameIn
    } }),
    /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      top: ".6%",
      left: "5%",
      zIndex: 2,
      fontFamily: mainFont,
      fontSize: 31 * unit,
      letterSpacing: 2 * unit,
      color: paper,
      textShadow: mainFont === "Anton" ? "none" : `${2 * unit}px ${3 * unit}px 0 #090C12`,
      opacity: frameIn
    }, children: upper }),
    /* @__PURE__ */ jsxs("div", { style: {
      position: "absolute",
      zIndex: 3,
      left: "5%",
      right: horizontal ? "30%" : "5%",
      bottom: "5%",
      transform: `scale(${panelScale})`,
      transformOrigin: "left bottom",
      filter: `drop-shadow(${7 * unit}px ${9 * unit}px 0 #05060B)`
    }, children: [
      /* @__PURE__ */ jsx2("div", { style: {
        display: "inline-block",
        background: tagColor,
        color: tagInk,
        padding: `${5 * unit}px ${17 * unit}px ${2 * unit}px`,
        marginBottom: -4 * unit,
        border: `${3 * unit}px solid #0D1016`,
        clipPath: `inset(0 ${(1 - tagOpen) * 100}% 0 0)`,
        transform: "rotate(-1.3deg)",
        fontFamily: tagFont,
        fontSize: 28 * unit,
        letterSpacing: 2 * unit
      }, children: upper }),
      /* @__PURE__ */ jsx2("div", { style: {
        background: paper,
        border: `${6 * unit}px solid #080B11`,
        padding: `${20 * unit}px ${25 * unit}px ${17 * unit}px`,
        clipPath: `inset(0 ${(1 - mainOpen) * 100}% 0 0)`,
        fontFamily: mainFont,
        color: ink,
        fontSize: fitted?.size ?? fontSize,
        whiteSpace: "pre-wrap",
        lineHeight: 0.96,
        letterSpacing: -0.55 * unit,
        overflowWrap: "break-word"
      }, children: fitted?.lines.join("\n") ?? lower })
    ] })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const QuadroHQSobreCenaCena = QuadroHQSobreCena;
