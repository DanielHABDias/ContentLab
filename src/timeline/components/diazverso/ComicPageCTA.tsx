// Cena ComicPageCTA do plugin Diazverso 1.3.0, compilada por scripts/build-diazverso-scenes.mjs. Não editar à mão.
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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/ComicPageCTA.tsx
import React from "react";
import {
  AbsoluteFill as AbsoluteFill2,
  Img as Img2,
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

// ../DiazVerso-Plugin/skills/diazverso-decupagem/references/scenes/ComicPageCTA.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var clamp = (n) => Math.max(0, Math.min(1, n));
var ease = (n) => {
  const x = clamp(n);
  return x * x * (3 - 2 * x);
};
function ComicPageCTA({
  backgroundStyle,
  backgroundOpacity = 100,
  fontFamily = "Anton",
  timingScale = 1,
  fadeOutDuration,
  characterScale = 1,
  channelName = "",
  topTitle = "CONTINUE ESSA HIST\xD3RIA!",
  subscribeText = "INSCREVA-SE",
  calloutText = "VAI L\xC1 ASSISTIR!",
  headline = "A AN\xC1LISE COMPLETA",
  stripeColor = "#EF3F49",
  leftTitle = "ASSISTA TAMB\xC9M",
  rightTitle = "PR\xD3XIMO V\xCDDEO",
  assets = {}
}) {
  const fontUrl = resolveHQFont(fontFamily, assets);
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig();
  const horizontal = w > h;
  if (!fontUrl) throw new Error("ComicPageCTA requer fontUrl.");
  if (!horizontal && !assets.thumbnail) throw new Error("ComicPageCTA vertical requer assets.thumbnail.");
  if (!assets.character) throw new Error("ComicPageCTA requer assets.character nas duas orienta\xE7\xF5es.");
  if (!/^#[0-9a-fA-F]{6}$/.test(stripeColor)) {
    throw new Error("ComicPageCTA requer stripeColor no formato #RRGGBB.");
  }
  const [textFit, setTextFit] = React.useState(null);
  if (!Number.isFinite(timingScale) || timingScale < 0.5 || timingScale > 2 || !Number.isFinite(characterScale) || characterScale < 0.5 || characterScale > 1.5 || fadeOutDuration !== void 0 && (!Number.isFinite(fadeOutDuration) || fadeOutDuration < 0 || fadeOutDuration > durationInFrames / fps)) throw Error("timingScale: 0.5\u20132; characterScale: 0.5\u20131.5; fadeOutDuration deve caber na cena.");
  const [handle] = React.useState(() => delayRender("Carregando Bangers na CTA"));
  React.useEffect(() => {
    loadFont({ family: fontFamily, url: fontUrl }).then(() => {
      setTextFit({ top: fitLabelHQ(topTitle, fontFamily, w * 0.84, h * (horizontal ? 0.15 : 0.12), horizontal ? 98 * h / 1080 : Math.min(118 * w / 1080, w * 0.109), horizontal ? 1 : 0.87), headline: fitLabelHQ(headline, fontFamily, w * 0.73, h * 0.08, Math.min(45 * w / 1080, w * 0.046), 0.9) });
      continueRender(handle);
    }).catch((error) => cancelRender(error));
  }, [fontUrl, fontFamily, w, h, topTitle, headline, handle]);
  const frame = useCurrentFrame();
  const p = frame / Math.max(1, durationInFrames - 1);
  const seconds = frame / fps / timingScale;
  const pageIn = ease((seconds - 0.06) / 0.38);
  const cardIn = ease((seconds - 0.06) / 0.48);
  const bubbleIn = ease((seconds - 0.11) / 0.3);
  const characterIn = ease((seconds - 0.62) / 0.38);
  const camera = ease((seconds - 0.62) / 0.4);
  const ink = "#080A11";
  const paper = "#F8ECD4";
  const red = "#EF3F49";
  if (horizontal) {
    const unit = h / 1080;
    const blue = "#2676E8";
    const yellow = "#F4C542";
    const cardStyle = {
      position: "absolute",
      top: "32%",
      width: "31%",
      boxSizing: "border-box",
      aspectRatio: "16 / 9",
      border: `${7 * unit}px solid ${ink}`,
      background: "#1D273B"
    };
    const labelStyle = {
      position: "absolute",
      top: "69%",
      width: "31%",
      boxSizing: "border-box",
      padding: `${10 * unit}px ${12 * unit}px`,
      fontFamily,
      background: ink,
      color: "#FFFFFF",
      fontSize: 54 * unit,
      lineHeight: 1.05,
      textAlign: "center",
      overflowWrap: "break-word"
    };
    return /* @__PURE__ */ jsxs(AbsoluteFill2, { style: { background: backgroundStyle === "comic-page" ? "transparent" : paper, overflow: "hidden", fontFamily }, children: [
      backgroundStyle === "comic-page" && /* @__PURE__ */ jsx2(HQComicPage, { opacity: backgroundOpacity }),
      backgroundStyle !== "comic-page" && /* @__PURE__ */ jsx2(AbsoluteFill2, { style: {
        opacity: 0.16,
        backgroundImage: `radial-gradient(${ink} ${2 * unit}px, transparent ${2.5 * unit}px)`,
        backgroundSize: `${22 * unit}px ${22 * unit}px`
      } }),
      /* @__PURE__ */ jsx2("div", { style: {
        position: "absolute",
        left: "-5%",
        top: "8%",
        width: "110%",
        height: "19%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: stripeColor,
        rotate: "-3deg",
        borderTop: `${7 * unit}px solid ${ink}`,
        borderBottom: `${7 * unit}px solid ${ink}`,
        translate: `0 ${(1 - pageIn) * -h * 0.4}px`
      }, children: /* @__PURE__ */ jsx2("div", { style: {
        textAlign: "center",
        color: "#FFFFFF",
        WebkitTextStroke: fontFamily === "Anton" ? "0px transparent" : `${2 * unit}px ${ink}`,
        textShadow: fontFamily === "Anton" ? "none" : `${5 * unit}px ${6 * unit}px 0 ${ink}`,
        fontSize: textFit?.top.size ?? 98 * unit,
        lineHeight: 1,
        opacity: pageIn
      }, children: topTitle }) }),
      /* @__PURE__ */ jsx2("div", { style: {
        ...cardStyle,
        left: "5%",
        background: blue,
        boxShadow: `${12 * unit}px ${14 * unit}px 0 ${blue}`,
        translate: `${(1 - cardIn) * -w * 0.5}px 0`,
        opacity: cardIn
      }, children: assets.thumbnailLeft && /* @__PURE__ */ jsx2(Img2, { src: assets.thumbnailLeft, style: { width: "100%", height: "100%", objectFit: "cover" } }) }),
      /* @__PURE__ */ jsx2("div", { style: {
        ...cardStyle,
        right: "5%",
        background: red,
        boxShadow: `${12 * unit}px ${14 * unit}px 0 ${red}`,
        translate: `${(1 - cardIn) * w * 0.5}px 0`,
        opacity: cardIn
      }, children: assets.thumbnailRight && /* @__PURE__ */ jsx2(Img2, { src: assets.thumbnailRight, style: { width: "100%", height: "100%", objectFit: "cover" } }) }),
      /* @__PURE__ */ jsx2("div", { style: {
        position: "absolute",
        left: "43%",
        top: "35%",
        width: "14%",
        aspectRatio: "1",
        boxSizing: "border-box",
        borderRadius: "50%",
        border: `${7 * unit}px solid ${ink}`,
        overflow: "hidden",
        background: yellow,
        boxShadow: `${9 * unit}px ${11 * unit}px 0 ${yellow}`,
        scale: 0.4 + 0.6 * bubbleIn,
        opacity: bubbleIn
      }, children: assets.channelIcon && /* @__PURE__ */ jsx2(Img2, { src: assets.channelIcon, style: { width: "100%", height: "100%", objectFit: "cover" } }) }),
      /* @__PURE__ */ jsx2("div", { style: {
        position: "absolute",
        left: "-14.5%",
        bottom: "-2.5%",
        width: "43%",
        aspectRatio: "1280 / 698",
        translate: `0 ${(1 - characterIn) * h * 0.45}px`,
        filter: `drop-shadow(${8 * unit}px ${8 * unit}px 0 ${ink})`,
        pointerEvents: "none"
      }, children: /* @__PURE__ */ jsx2(Img2, { src: assets.character, style: { width: "100%", height: "100%", objectFit: "contain", scale: characterScale, transformOrigin: "center bottom" } }) }),
      /* @__PURE__ */ jsx2("div", { style: { ...labelStyle, left: "15%", width: "21%", opacity: cardIn }, children: leftTitle.toLocaleUpperCase("pt-BR") }),
      /* @__PURE__ */ jsx2("div", { style: { ...labelStyle, right: "5%", opacity: cardIn }, children: rightTitle.toLocaleUpperCase("pt-BR") }),
      /* @__PURE__ */ jsx2("div", { style: { ...labelStyle, top: "66%", left: "39%", width: "22%", opacity: bubbleIn }, children: subscribeText }),
      /* @__PURE__ */ jsx2("div", { style: {
        position: "absolute",
        bottom: "7%",
        width: "100%",
        textAlign: "center",
        fontSize: 32 * unit,
        color: ink,
        opacity: pageIn
      }, children: channelName })
    ] });
  }
  const v = w / 1080;
  return /* @__PURE__ */ jsxs(AbsoluteFill2, { style: {
    overflow: "hidden",
    background: backgroundStyle === "comic-page" ? "transparent" : ink,
    fontFamily,
    opacity: fadeOutDuration === void 0 ? Math.min(1, (1 - p) * 24) : fadeOutDuration === 0 ? 1 : clamp((durationInFrames - 1 - frame) / Math.max(1, fadeOutDuration * fps - 1))
  }, children: [
    backgroundStyle !== "comic-page" && /* @__PURE__ */ jsx2(AbsoluteFill2, { style: { background: paper, transform: `translateX(${(1 - pageIn) * w}px)` } }),
    backgroundStyle === "comic-page" && /* @__PURE__ */ jsx2(HQComicPage, { opacity: backgroundOpacity }),
    backgroundStyle !== "comic-page" && /* @__PURE__ */ jsx2(AbsoluteFill2, { style: {
      opacity: 0.19,
      backgroundImage: `radial-gradient(${ink} 2px, transparent 2.5px)`,
      backgroundSize: "22px 22px"
    } }),
    /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      width: w * 1.5,
      height: h * 0.15,
      left: -w * 0.25,
      top: h * 0.12,
      transform: "rotate(-12deg)",
      background: stripeColor,
      borderTop: `9px solid ${ink}`,
      borderBottom: `9px solid ${ink}`
    } }),
    /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      zIndex: 4,
      left: w * 0.055,
      top: h * 0.055,
      width: w * 0.89,
      boxSizing: "border-box",
      padding: `${34 * v}px ${12 * v}px ${18 * v}px`,
      background: paper,
      border: `${8 * v}px solid ${ink}`,
      boxShadow: `${12 * v}px ${14 * v}px 0 ${red}`,
      color: ink,
      fontSize: textFit?.top.size ?? Math.min(118 * w / 1080, w * 0.109),
      lineHeight: 0.87,
      textAlign: "center",
      transform: `translateY(${(1 - pageIn) * -h * 0.2}px) rotate(-2deg)`
    }, children: topTitle }),
    /* @__PURE__ */ jsxs("div", { style: {
      position: "absolute",
      zIndex: 7,
      left: w * 0.1,
      top: h * 0.22,
      width: w * 0.79,
      background: ink,
      border: `${9 * v}px solid ${ink}`,
      boxShadow: `${18 * v}px ${20 * v}px 0 ${red}`,
      transform: `translateX(${(1 - cardIn) * w}px) rotate(${(1 - cardIn) * 8 - 2}deg) scale(${1 + camera * 0.045})`,
      transformOrigin: "50% 30%"
    }, children: [
      /* @__PURE__ */ jsx2("div", { style: { height: w * 0.79 * 9 / 16, background: "#303847", overflow: "hidden" }, children: /* @__PURE__ */ jsx2(Img2, { src: assets.thumbnail, style: { width: "100%", height: "100%", objectFit: "cover" } }) }),
      /* @__PURE__ */ jsx2("div", { style: {
        padding: `${14 * v}px ${22 * v}px ${11 * v}px`,
        background: paper,
        color: ink,
        fontSize: textFit?.headline.size ?? Math.min(45 * w / 1080, w * 0.046),
        lineHeight: 0.9
      }, children: headline.toLocaleUpperCase("pt-BR") })
    ] }),
    /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      zIndex: 6,
      left: -w * 0.58,
      bottom: -h * 0.035,
      width: w * 1.93,
      height: w * 1.93 * 698 / 1280,
      transform: `translateY(${(1 - characterIn) * h * 0.54}px) rotate(-3deg)`,
      filter: `drop-shadow(${17 * v}px ${13 * v}px 0 #080A11)`
    }, children: /* @__PURE__ */ jsx2(Img2, { src: assets.character, style: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      scale: characterScale,
      transformOrigin: "center bottom",
      objectPosition: "center bottom"
    } }) }),
    /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      zIndex: 8,
      right: w * 0.035,
      bottom: h * 0.12,
      width: w * 0.49,
      padding: `${20 * v}px ${14 * v}px ${14 * v}px`,
      border: `${8 * v}px solid ${ink}`,
      borderRadius: "48% 48% 42% 43%",
      color: ink,
      background: "#FFFFFF",
      boxShadow: `${12 * v}px ${13 * v}px 0 ${red}`,
      fontSize: Math.min(73 * v, w * 0.07),
      lineHeight: 0.87,
      textAlign: "center",
      transform: `scale(${0.2 + 0.8 * bubbleIn}) rotate(${(1 - bubbleIn) * 14 - 6}deg)`,
      opacity: bubbleIn
    }, children: calloutText }),
    /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      zIndex: 8,
      right: w * 0.05,
      bottom: h * 0.035,
      color: ink,
      fontSize: 36 * v,
      opacity: bubbleIn
    }, children: channelName })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const ComicPageCTACena = ComicPageCTA;
