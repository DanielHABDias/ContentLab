// Cena HQ CaixinhaHQ do Content Lab (arquivo único, imports só de React/Remotion).
import { AbsoluteFill, Img, staticFile } from "remotion";
import { jsx } from "react/jsx-runtime";
function HQComicPage({ opacity = 100, src = staticFile("assets/kit/backgrounds/comic-page.png") }) {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) throw Error("opacity must be 0\u2013100");
  return /* @__PURE__ */ jsx(AbsoluteFill, { style: { pointerEvents: "none", opacity: opacity / 100, overflow: "hidden" }, children: /* @__PURE__ */ jsx(Img, { src, style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" } }) });
}

import React from "react";
import { AbsoluteFill as AbsoluteFill2, useCurrentFrame, useVideoConfig, delayRender, continueRender, cancelRender } from "remotion";

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
var presets = {
  inscricao: { text: "INSCREVA-SE", box: "#E62F3F", color: "#FFFFFF", icon: "youtube" },
  like: { text: "DEIXE O LIKE", box: "#236CE5", color: "#FFFFFF", icon: "like" },
  sininho: { text: "ATIVE O SININHO", box: "#F4C542", color: "#080A11", icon: "sininho" },
  produto: { text: "INDICA\xC7\xC3O DE PRODUTO", box: "#FFFFFF", color: "#080A11", icon: "seta" },
  instagram: {
    text: "SIGA NO INSTAGRAM",
    box: "#C13584",
    color: "#FFFFFF",
    icon: "instagram",
    gradient: "linear-gradient(35deg, #FEDA75 0%, #FA7E1E 22%, #D62976 48%, #962FBF 72%, #4F5BD5 100%)"
  },
  livre: { text: "SEU TEXTO AQUI", box: "#FFFFFF", color: "#080A11", icon: "none" }
};
var clamp = (x) => Math.max(0, Math.min(1, x));
var ease = (x) => {
  const p = clamp(x);
  return p * p * (3 - 2 * p);
};
function pop(x) {
  const p = clamp(x);
  if (p < 0.65) return 1.12 * (1 - Math.pow(1 - p / 0.65, 3));
  return 1.12 - 0.12 * ease((p - 0.65) / 0.35);
}
function Icon({ name, size }) {
  if (name === "none") return null;
  return /* @__PURE__ */ jsxs("svg", { width: size, height: size, viewBox: "0 0 64 64", "aria-hidden": true, style: { flexShrink: 0 }, children: [
    name === "youtube" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2("rect", { x: "2", y: "10", width: "60", height: "44", rx: "12", fill: "#FFFFFF", stroke: "#080A11", strokeWidth: "2" }),
      /* @__PURE__ */ jsx2("path", { d: "M27 21L45 32L27 43Z", fill: "#E62F3F" })
    ] }),
    name === "like" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2("circle", { cx: "32", cy: "32", r: "30", fill: "#FFFFFF", stroke: "#080A11", strokeWidth: "2" }),
      /* @__PURE__ */ jsx2("path", { d: "M14 29H23V49H14ZM26 48V28L34 13C42 12 41 22 38 27H49Q53 27 51 33L47 47Q46 50 41 50Z", fill: "#236CE5", stroke: "#080A11", strokeWidth: "2", strokeLinejoin: "round" })
    ] }),
    name === "sininho" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2("path", { d: "M15 44L20 37V26Q20 14 32 14Q44 14 44 26V37L49 44Z", fill: "#080A11" }),
      /* @__PURE__ */ jsx2("path", { d: "M27 49Q32 57 37 49M32 8V14", fill: "none", stroke: "#080A11", strokeWidth: "5", strokeLinecap: "round" }),
      /* @__PURE__ */ jsx2("path", { d: "M11 18L7 28M53 18L57 28", stroke: "#080A11", strokeWidth: "3", strokeLinecap: "round" })
    ] }),
    name === "seta" && /* @__PURE__ */ jsx2("path", { d: "M27 8H37V37H51L32 57L13 37H27Z", fill: "#080A11" }),
    name === "instagram" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2("rect", { x: "7", y: "7", width: "50", height: "50", rx: "15", fill: "none", stroke: "#FFFFFF", strokeWidth: "5" }),
      /* @__PURE__ */ jsx2("circle", { cx: "32", cy: "32", r: "12", fill: "none", stroke: "#FFFFFF", strokeWidth: "5" }),
      /* @__PURE__ */ jsx2("circle", { cx: "47", cy: "17", r: "3.5", fill: "#FFFFFF" })
    ] })
  ] });
}
function CaixinhaHQ({
  backgroundStyle,
  backgroundOpacity = 100,
  fontFamily = "Anton",
  preset = "inscricao",
  corner = "inferior-direito",
  animation = "lateral",
  exitAnimation,
  motionCurve = "smooth",
  text,
  instagramHandle,
  boxColor,
  textColor,
  icon,
  at = 0,
  holdDuration = 5,
  animationDuration = 0.4,
  action = "auto",
  actionAt,
  actionDuration,
  assets = {}
}) {
  const fontUrl = resolveHQFont(fontFamily, assets);
  const { width: w, height: h, fps, durationInFrames } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  if (!Object.hasOwn(presets, preset)) throw new Error("Preset inv\xE1lido. Use inscricao, like, sininho, produto, instagram ou livre.");
  if (!["superior-esquerdo", "superior-direito", "inferior-esquerdo", "inferior-direito", "centro"].includes(corner)) throw new Error("Posi\xE7\xE3o inv\xE1lida: use um dos quatro cantos ou centro.");
  const exit = exitAnimation ?? animation;
  if (![animation, exit].every((a) => ["lateral", "vertical", "pop"].includes(a))) throw new Error("Anima\xE7\xE3o deve ser lateral, vertical ou pop.");
  if (![at, holdDuration, animationDuration].every(Number.isFinite) || at < 0 || holdDuration <= 0 || animationDuration < 2 / fps) throw new Error("Tempos inv\xE1lidos: dura\xE7\xE3o das anima\xE7\xF5es deve ser >= 2 frames.");
  const end = at + 2 * animationDuration + holdDuration;
  if (end > durationInFrames / fps + 1 / fps) throw new Error(`Cena curta: a caixinha termina em ${end.toFixed(3)} s. Aumente end da cena ou reduza holdDuration.`);
  if (!["auto", "clique", "sininho", "pulo", "none"].includes(action)) throw new Error("action inv\xE1lida.");
  const gesture = action === "auto" ? preset === "inscricao" || preset === "like" || preset === "instagram" ? "clique" : preset === "sininho" ? "sininho" : preset === "produto" ? "pulo" : "none" : action;
  const actionLength = actionDuration ?? Math.min(0.45, holdDuration);
  const actionCenter = actionAt ?? at + animationDuration + holdDuration / 2;
  if (gesture !== "none" && (!Number.isFinite(actionLength) || actionLength < 2 / fps || !Number.isFinite(actionCenter) || actionCenter - actionLength / 2 < at + animationDuration - 1e-8 || actionCenter + actionLength / 2 > at + animationDuration + holdDuration + 1e-8)) throw new Error("A a\xE7\xE3o deve caber no tempo de leitura, sem sobrepor entrada/sa\xEDda. actionAt \xE9 seu centro, em segundos relativos \xE0 cena.");
  const style = presets[preset];
  const accountHandle = instagramHandle?.trim();
  if (preset === "instagram" && text === void 0 && accountHandle && !/^@?[A-Za-z0-9._]{1,30}$/.test(accountHandle)) {
    throw new Error("instagramHandle deve ser um @ do Instagram v\xE1lido (letras, n\xFAmeros, ponto ou _; at\xE9 30 caracteres).");
  }
  const instagramText = preset === "instagram" && accountHandle ? `${style.text} @${accountHandle.replace(/^@/, "")}` : style.text;
  const phrase = (text ?? instagramText).normalize("NFC").toLocaleUpperCase("pt-BR").trim();
  const fill = boxColor ?? style.box;
  const color = textColor ?? style.color;
  const symbol = icon ?? style.icon;
  if (!phrase) throw new Error("O texto n\xE3o pode ser vazio.");
  if (![fill, color].every((c) => /^#[a-f\d]{6}$/i.test(c))) throw new Error("Cores devem usar #RRGGBB.");
  if (!["youtube", "like", "sininho", "seta", "instagram", "none"].includes(symbol)) throw new Error("\xCDcone inv\xE1lido.");
  if (!fontUrl) throw new Error("Informe fontUrl.");
  const u = Math.min(w, h) / 1080;
  const center = corner === "centro";
  const boxW = w * (center ? w > h ? 0.62 : 0.86 : w > h ? 0.34 : 0.82);
  const padding = (center ? 38 : 27) * u;
  const maxTextSize = (center ? 104 : 68) * u;
  const iconSize = symbol === "none" ? 0 : (center ? 100 : 70) * u;
  const gap = iconSize ? 20 * u : 0;
  const available = boxW - 2 * padding - iconSize - gap - 12 * u;
  const [layout, setLayout] = React.useState(null);
  const [handle] = React.useState(() => delayRender("Preparando caixinha HQ Bangers"));
  React.useEffect(() => {
    loadFont({ family: fontFamily, url: fontUrl }).then(() => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) throw new Error("Canvas indispon\xEDvel.");
      const wrap = (size2) => {
        ctx.font = `${size2}px ${fontFamily}`;
        const lines2 = [];
        let line = "";
        for (const word of phrase.split(/\s+/)) {
          if (line && ctx.measureText(line + " " + word).width > available) {
            lines2.push(line);
            line = word;
          } else line += (line ? " " : "") + word;
        }
        if (line) lines2.push(line);
        return lines2;
      };
      let size = maxTextSize;
      let lines = wrap(size);
      while (size > 1 && (lines.length > 2 || lines.some((line) => ctx.measureText(line).width > available))) {
        size *= 0.94;
        lines = wrap(size);
      }
      setLayout({ lines, size });
      continueRender(handle);
    }).catch(cancelRender);
  }, [fontUrl, fontFamily, phrase, available, u, maxTextSize, handle]);
  const boxH = Math.max(iconSize, (layout?.lines.length ?? 1) * (layout?.size ?? maxTextSize) * 1.08) + 2 * padding + 12 * u;
  const right = corner.endsWith("direito");
  const top = corner.startsWith("superior");
  const marginX = w * 0.055;
  const marginY = h * (w > h ? 0.075 : 0.1);
  const enterP = clamp((t - at) / animationDuration);
  const exitAt = at + animationDuration + holdDuration;
  const exitP = clamp((t - exitAt) / Math.max(1 / fps, animationDuration - 1 / fps));
  const offset = (kind, amount, leaving = false) => ({
    x: kind === "lateral" ? (center ? leaving ? 1 : -1 : right ? 1 : -1) * (center ? w / 2 + boxW / 2 + 30 * u : boxW + marginX + 30 * u) * amount : 0,
    y: kind === "vertical" ? (center ? leaving ? -1 : 1 : top ? -1 : 1) * (center ? h / 2 + boxH / 2 + 30 * u : boxH + marginY + 30 * u) * amount : 0
  });
  if (!["smooth", "snappy"].includes(motionCurve)) throw Error("motionCurve: smooth ou snappy.");
  const incoming = offset(animation, 1 - (motionCurve === "snappy" ? 1 - Math.pow(1 - enterP, 3) : ease(enterP)));
  const outgoing = offset(exit, motionCurve === "snappy" ? exitP ** 3 : ease(exitP), true);
  const scale = (animation === "pop" ? pop(enterP) : 1) * (exit === "pop" ? 1 - ease(exitP) : 1);
  const actionP = clamp((t - (actionCenter - actionLength / 2)) / actionLength);
  const pulse = Math.pow(Math.sin(Math.PI * actionP), 2);
  const actionScale = gesture === "clique" ? 1 - 0.12 * pulse : 1;
  const actionY = gesture === "pulo" ? -32 * u * pulse : 0;
  const actionAngle = gesture === "sininho" ? Math.sin(actionP * Math.PI * 8) * Math.sin(actionP * Math.PI) * 4 : 0;
  const outline = color.toUpperCase() === "#080A11" || color.toUpperCase() === "#000000" ? "#FFFFFF55" : "#080A11";
  if (!layout || t < at || t >= end) return backgroundStyle === "comic-page" ? /* @__PURE__ */ jsx2(HQComicPage, { opacity: backgroundOpacity }) : null;
  return /* @__PURE__ */ jsxs(AbsoluteFill2, { style: { pointerEvents: "none", overflow: "hidden" }, children: [
    backgroundStyle === "comic-page" && /* @__PURE__ */ jsx2(HQComicPage, { opacity: backgroundOpacity }),
    /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      left: center ? (w - boxW) / 2 : right ? w - marginX - boxW : marginX,
      top: center ? (h - boxH) / 2 : top ? marginY : h - marginY - boxH,
      width: boxW,
      minHeight: boxH,
      translate: `${incoming.x + outgoing.x}px ${incoming.y + outgoing.y}px`,
      scale,
      transformOrigin: center ? "center" : `${right ? "right" : "left"} ${top ? "top" : "bottom"}`,
      opacity: animation === "pop" ? clamp(enterP * 5) : 1
    }, children: /* @__PURE__ */ jsxs("div", { style: {
      width: "100%",
      minHeight: boxH,
      boxSizing: "border-box",
      border: `${6 * u}px solid #080A11`,
      background: boxColor ?? style.gradient ?? fill,
      boxShadow: `${12 * u}px ${13 * u}px 0 #080A11`,
      scale: actionScale,
      translate: `0 ${actionY}px`,
      rotate: `${actionAngle}deg`,
      transformOrigin: "center",
      padding: `${padding}px`,
      display: "flex",
      alignItems: "center",
      gap,
      isolation: "isolate"
    }, children: [
      /* @__PURE__ */ jsx2(AbsoluteFill2, { style: { zIndex: -1, opacity: 0.15, backgroundImage: `radial-gradient(#080A11 ${4.5 * u}px, transparent ${5 * u}px)`, backgroundSize: `${23 * u}px ${23 * u}px` } }),
      /* @__PURE__ */ jsx2(Icon, { name: symbol, size: iconSize }),
      /* @__PURE__ */ jsx2("div", { style: {
        fontFamily,
        fontSize: layout.size,
        lineHeight: 1.08,
        color,
        WebkitTextStroke: fontFamily === "Anton" ? "0px transparent" : `${0.8 * u}px ${outline}`,
        textShadow: fontFamily === "Anton" ? "none" : `${2 * u}px ${3 * u}px 0 ${color === "#080A11" ? "#00000033" : "#080A1166"}`,
        whiteSpace: "pre",
        flex: 1,
        minWidth: 0,
        textAlign: center ? "center" : "left"
      }, children: layout.lines.join("\n") })
    ] }) })
  ] });
}
function resolveHQFont(family, assets) {
  if (family !== "Bangers" && family !== "Anton") throw new Error("fontFamily deve ser Bangers ou Anton.");
  const key = family === "Anton" ? "anton" : "bangers";
  if (!assets[key]) throw new Error(`Informe assets.${key} para a fonte ${family}.`);
  return assets[key];
}
export const CaixinhaHQCena = CaixinhaHQ;
