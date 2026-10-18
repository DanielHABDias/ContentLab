(function thumbnailStudio() {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas = $("thumb-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", {alpha: false});
  const DB_NAME = "contentlab-thumbnails";
  const DB_STORE = "workspace";
  const fileReader = $("thumb-image-file");
  const safe = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(+v) ? +v : min));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const emptyFigure = (x, scale, glowColor) => ({
    image: null, x, y: .54, scale, opacity: 100, rotate: 0,
    flip: false, glowColor, glowOpacity: 35, glowSize: 45
  });
  const freshState = () => ({
    version: 1,
    name: "Diazverso",
    media: {},
    background: {
      style: "halftone", color: "#233D76", paperTone: "dark",
      textureOpacity: 36, photo: null, photoOpacity: 42,
      photoX: .5, photoY: .5, photoScale: 1,
      shadowOpacity: 78, shadowHeight: 55
    },
    base: {
      center: emptyFigure(.50, .91, "#76BFFF"),
      left: emptyFigure(.17, .76, "#F34961"),
      right: emptyFigure(.83, .76, "#3E9CFF"),
      title: {
        text: "A VERDADE\nREVELADA", x: .50, y: .64, size: .165,
        font: "Anton", color: "#F8E568", outlineColor: "#F8E568",
        stroke: 5, glowOpacity: 35, glowSize: 24, tracking: 1.5
      },
      subtitle: {
        text: "", x: .50, y: .88, size: .062, font: "Bangers",
        color: "#FFFFFF", boxColor: "#111827", opacity: 92
      }
    },
    variants: [],
    selected: "base"
  });
  let state = freshState();
  let selectedLayer = "center";
  let dragging = null;
  let imageTarget = "center";
  let frameRequested = false;
  let saveTimeout = null;
  let currentSeq = 0;
  const images = new Map();
  let fontsPromise = null;
  const FONT_URLS = {
    Anton: "/api/thumbnails/font/anton",
    Bangers: "/api/thumbnails/font/bangers"
  };
  const $status = $("thumb-status");
  function status(message, error = false) {
    $status.textContent = message;
    $status.style.color = error ? "#B53E4D" : "#246FC4";
  }
  const filenames = (name) => String(name || "diazverso")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "thumbnail";
  const currentVariant = () => state.variants.find(v => v.id === state.selected) || null;
  const currentLayers = () => currentVariant()?.layers || state.base;
  const currentFormat = () => currentVariant()?.format || "long";
  function dimensions(format) {
    if (format === "vertical") return {w: 1080, h: 1920};
    if (format === "square") return {w: 1080, h: 1080};
    return {w: 1280, h: 720};
  }
  function viewFor(id) {
    const variant = state.variants.find(v => v.id === id);
    return {
      layers: variant ? variant.layers : state.base,
      background: state.background,
      format: variant ? variant.format : "long"
    };
  }
  function validateProject(candidate) {
    if (!candidate || candidate.version !== 1 || !candidate.base || !candidate.background ||
        !candidate.media || typeof candidate.media !== "object" || Array.isArray(candidate.media) ||
        !candidate.base.center || !candidate.base.title || !Array.isArray(candidate.variants) ||
        candidate.variants.length > 30) throw Error("O projeto não tem o formato de thumbnails esperado.");
    if (!candidate.variants.every(v => v && typeof v.id === "string" && v.layers &&
        ["vertical", "square", "long"].includes(v.format))) throw Error("Há versões inválidas no projeto.");
    const imageOk = v => v == null || (typeof v === "string" && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(v));
    const imageReferenceOk = id => id == null || (
      typeof id === "string" && Object.prototype.hasOwnProperty.call(candidate.media, id)
      && imageOk(candidate.media[id])
    );
    if (!imageReferenceOk(candidate.background.photo)) throw Error("Imagem de fundo inválida no projeto.");
    if (Object.keys(candidate.media).length > 110 || Object.values(candidate.media).some(v => !imageOk(v)))
      throw Error("Há imagens inválidas no projeto importado.");
    const groups = [candidate.base, ...candidate.variants.map(v => v.layers)];
    if (groups.some(l => !["center","left","right"].every(k => l[k] && imageReferenceOk(l[k].image))))
      throw Error("O projeto possui um asset inválido ou uma camada ausente.");
    return candidate;
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(Error("IndexedDB indisponível."));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || Error("Falha ao abrir o armazenamento local."));
    });
  }
  function collectUnusedMedia() {
    const used = new Set([state.background.photo]);
    for (const layers of [state.base,...state.variants.map(v=>v.layers)]) {
      for (const k of ["left","center","right"]) used.add(layers[k]?.image);
    }
    for (const key of Object.keys(state.media)) {
      if (!used.has(key)) {delete state.media[key];images.delete(key);}
    }
  }
  async function saveLocal() {
    collectUnusedMedia();
    const db = await openDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(state, "draft");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
  async function restoreLocal() {
    try {
      const db = await openDB();
      const draft = await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const req = tx.objectStore(DB_STORE).get("draft");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      if (draft) state = validateProject(draft);
      status(draft ? "Projeto recuperado automaticamente neste navegador." : "Pronto: importe PNGs, escolha camadas e arraste na prévia.");
    } catch {
      status("Armazenamento local indisponível. Use Baixar projeto JSON para guardar seu trabalho.", true);
    }
  }
  function changed(refreshProperties = false) {
    state.name = $("thumb-project-name").value.trim() || "Diazverso";
    window.clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      saveLocal().catch(() => status("Não foi possível salvar automaticamente. Exporte o JSON para preservar a edição.", true));
    }, 650);
    schedule();
    if (refreshProperties) { drawLayerList(); drawProperties(); }
  }
  function photo(src) {
    if (!src) return Promise.resolve(null);
    const url = state.media?.[src];
    if (!url) return Promise.reject(Error("Imagem referenciada não encontrada no projeto."));
    if (!images.has(src)) {
      images.set(src, new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(Error("Não foi possível carregar uma imagem. Reimporte o arquivo."));
        img.src = url;
      }));
    }
    return images.get(src);
  }
  async function fonts() {
    if (!fontsPromise) {
      fontsPromise = Promise.all(Object.entries(FONT_URLS).map(async ([family, url]) => {
        const f = new FontFace("Thumb" + family, `url(${url})`);
        try { await f.load(); document.fonts.add(f); }
        catch { status("Fonte " + family + " não encontrada no aplicativo. A prévia usará fallback.", true); }
      }));
    }
    return fontsPromise;
  }
  const fontName = (v) => v === "Bangers" ? '"ThumbBangers", Impact, sans-serif' : '"ThumbAnton", Impact, sans-serif';
  const rand = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  function cover(draw, img, w, h, x = .5, y = .5, scale = 1) {
    const factor = Math.max(w / img.width, h / img.height) * safe(scale, .25, 5);
    const rw = img.width * factor, rh = img.height * factor;
    draw.drawImage(img, (w - rw) / 2 + (x - .5) * w, (h - rh) / 2 + (y - .5) * h, rw, rh);
  }
  function texture(draw, w, h, b) {
    const opacity = safe(b.textureOpacity, 0, 100) / 100;
    if (!opacity || b.style === "solid" || b.style === "none") return;
    draw.save(); draw.globalAlpha = opacity;
    if (b.style === "halftone") {
      draw.fillStyle = "#090E1D";
      const step = Math.max(8, Math.round(w / 80));
      for (let y = step / 2; y < h; y += step)
        for (let x = step / 2; x < w; x += step) {
          draw.beginPath();
          draw.arc(x, y, Math.max(1.3, step * .17), 0, 2 * Math.PI);
          draw.fill();
        }
    } else if (b.style === "grid") {
      draw.strokeStyle = "#F4F5FF";
      draw.lineWidth = Math.max(1, w / 900);
      const step = w / 16;
      for (let x = 0; x < w; x += step) {draw.beginPath();draw.moveTo(x, 0);draw.lineTo(x, h);draw.stroke();}
      for (let y = 0; y < h; y += step) {draw.beginPath();draw.moveTo(0, y);draw.lineTo(w, y);draw.stroke();}
    } else if (b.style === "stars") {
      draw.fillStyle = "#FFFFFF";
      for (let i = 0; i < 230; i++) {
        const x = rand(i + 84) * w, y = rand(i + 420) * h;
        draw.beginPath();draw.arc(x, y, .7 + rand(i + 600) * (w / 440), 0, 2 * Math.PI);draw.fill();
      }
    } else if (b.style === "film") {
      for (let i = 0; i < 1900; i++) {
        const v = rand(i * 6.1) * w, y = rand(i * 2.8) * h;
        draw.fillStyle = i % 3 ? "#D6D1C6" : "#0D1117";
        draw.fillRect(v, y, 1 + rand(i) * 2, 1 + rand(i + 14) * 2);
      }
      draw.strokeStyle = "#E2D9B9"; draw.lineWidth = w / 1400;
      for (let i = 0; i < 8; i++) {
        const x = rand(i + 220) * w;
        draw.beginPath();draw.moveTo(x, 0);draw.lineTo(x + rand(i) * 10, h);draw.stroke();
      }
    } else if (b.style === "paper") {
      draw.fillStyle = b.paperTone === "light" ? "#F3E9D9" : "#0A101D";
      draw.globalAlpha = opacity * .7; draw.fillRect(0, 0, w, h);
      draw.strokeStyle = b.paperTone === "light" ? "#574E46" : "#B8BEC9";
      draw.lineWidth = 1.5;
      draw.globalAlpha = opacity * .65;
      for (let i = 0; i < 55; i++) {
        const x = rand(i + 300) * w, y = rand(i + 600) * h;
        draw.beginPath();draw.moveTo(x, y);
        draw.lineTo(x + (rand(i + 800) - .5) * w * .28, y + (rand(i + 900) - .5) * h * .32);draw.stroke();
      }
    }
    draw.restore();
  }
  function light(draw, w, h, layer) {
    if (!layer?.glowOpacity || !layer.glowColor) return;
    const x = safe(layer.x, -.5, 1.5) * w, y = safe(layer.y, -.5, 1.5) * h;
    const radius = Math.max(5, Math.min(w, h) * safe(layer.glowSize, 0, 150) / 100);
    const gradient = draw.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, hex(layer.glowColor, safe(layer.glowOpacity, 0, 100) / 100));
    gradient.addColorStop(.48, hex(layer.glowColor, safe(layer.glowOpacity, 0, 100) / 280));
    gradient.addColorStop(1, hex(layer.glowColor, 0));
    draw.save();draw.fillStyle = gradient;
    draw.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
    draw.restore();
  }
  function hex(color, a) {
    const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color || "#000000");
    if (!match) return `rgba(0,0,0,${a})`;
    return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${a})`;
  }
  function figureBounds(layer, img, w, h) {
    const length = Math.max(10, h * safe(layer.scale, .05, 3));
    const ratio = img ? img.width / img.height : .70;
    return {x: safe(layer.x, -.5, 1.5) * w - length * ratio / 2,
      y: safe(layer.y, -.5, 1.5) * h - length / 2,
      w: length * ratio, h: length};
  }
  function figure(draw, w, h, layer, img) {
    if (!img) return;
    const r = figureBounds(layer, img, w, h);
    draw.save();
    draw.globalAlpha = safe(layer.opacity, 0, 100) / 100;
    draw.translate(r.x + r.w / 2, r.y + r.h / 2);
    draw.rotate(safe(layer.rotate, -180, 180) * Math.PI / 180);
    draw.scale(layer.flip ? -1 : 1, 1);
    draw.drawImage(img, -r.w / 2, -r.h / 2, r.w, r.h);
    draw.restore();
  }
  function makeTitleLines(draw, title, maxW) {
    const raw = String(title.text || "").toLocaleUpperCase("pt-BR");
    const lines = [];
    for (const paragraph of raw.split(/\n/)) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(""); continue; }
      let current = words.shift();
      for (const word of words) {
        const candidate = current + " " + word;
        if (draw.measureText(candidate).width > maxW && current) {
          lines.push(current);current = word;
        } else current = candidate;
      }
      lines.push(current);
    }
    return lines.slice(0, 5);
  }
  function titleDraw(draw, w, h, title, filled) {
    if (!title?.text) return;
    draw.save();
    let size = w * safe(title.size, .04, .36);
    let lines = [];
    for (let n = 0; n < 14; n++) {
      draw.font = `900 ${size}px ${fontName(title.font)}`;
      lines = makeTitleLines(draw, title, w * .89);
      const largest = Math.max(...lines.map(line => draw.measureText(line).width), 0);
      if (largest <= w * .91 && lines.length * size * .89 <= h * .8) break;
      size *= .92;
    }
    draw.textAlign = "center";draw.textBaseline = "middle";draw.lineJoin = "round";
    const lineH = size * .91;
    const top = safe(title.y, -.5, 1.5) * h - (lines.length - 1) * lineH / 2;
    draw.lineWidth = Math.max(1, safe(title.stroke, 0, 24) * w / 1280);
    for (let i = 0; i < lines.length; i++) {
      const y = top + i * lineH;
      const x = safe(title.x, -.5, 1.5) * w;
      if (filled) {
        const alpha = safe(title.glowOpacity, 0, 100) / 100;
        if (alpha > 0) {
          draw.shadowColor = hex(title.color, alpha);
          draw.shadowBlur = safe(title.glowSize, 0, 100) * w / 1280;
        }
        draw.fillStyle = title.color || "#F8E568";
        draw.fillText(lines[i], x, y);
        draw.shadowBlur = 0;
      } else {
        draw.strokeStyle = title.outlineColor || title.color || "#F8E568";
        draw.strokeText(lines[i], x, y);
      }
    }
    draw.restore();
  }
  function subtitleDraw(draw, w, h, subtitle) {
    if (!subtitle?.text) return;
    draw.save();
    const size = w * safe(subtitle.size, .015, .20);
    draw.font = `900 ${size}px ${fontName(subtitle.font)}`;
    draw.textBaseline = "middle";draw.textAlign = "center";
    const label = String(subtitle.text).toLocaleUpperCase("pt-BR");
    const width = Math.min(w * .95, draw.measureText(label).width + size * .75);
    const height = size * 1.35;
    const x = safe(subtitle.x, 0, 1) * w, y = safe(subtitle.y, 0, 1) * h;
    draw.globalAlpha = safe(subtitle.opacity, 0, 100) / 100;
    draw.fillStyle = subtitle.boxColor || "#111827";
    draw.fillRect(x - width / 2, y - height / 2, width, height);
    draw.fillStyle = subtitle.color || "#FFFFFF";
    // Keep the text inside the label, including a long word.
    let fontSize = size;
    while (fontSize > size * .5 && draw.measureText(label).width > width * .91) {
      fontSize *= .94;draw.font = `900 ${fontSize}px ${fontName(subtitle.font)}`;
    }
    draw.fillText(label, x, y);
    draw.restore();
  }
  function shadow(draw, w, h, b) {
    const opacity = safe(b.shadowOpacity, 0, 100) / 100;
    const size = Math.max(1, h * safe(b.shadowHeight, 0, 100) / 100);
    if (!opacity) return;
    const fade = draw.createLinearGradient(0, h, 0, h - size);
    fade.addColorStop(0, hex("#000000", opacity));
    fade.addColorStop(.40, hex("#000000", opacity * .48));
    fade.addColorStop(1, hex("#000000", 0));
    draw.save(); draw.fillStyle = fade;
    draw.fillRect(0, h - size, w, size);draw.restore();
  }
  function selectionOutline(draw, w, h, view, chosen, loaded) {
    if (!chosen) return;
    draw.save();draw.lineWidth = Math.max(2, w / 600);
    draw.setLineDash([w / 120, w / 150]);draw.strokeStyle = "#7CC0FF";
    if (["center", "left", "right"].includes(chosen) && loaded[chosen]) {
      const r = figureBounds(view.layers[chosen], loaded[chosen], w, h);
      draw.strokeRect(r.x, r.y, r.w, r.h);
    } else if (chosen === "title") {
      const t = view.layers.title;
      draw.strokeRect((t.x - .46) * w, (t.y - .12) * h, .92 * w, .24 * h);
    } else if (chosen === "subtitle") {
      const s = view.layers.subtitle;
      draw.strokeRect((s.x - .25) * w, (s.y - .045) * h, .50 * w, .09 * h);
    } else if (chosen === "background") {
      draw.strokeRect(w * .018, h * .018, w * .964, h * .964);
    }
    draw.restore();
  }
  async function paint(target, view, highlight = null, preview = false, sequence = null) {
    await fonts();
    const assets = [...["left", "right", "center"].map(k => view.layers[k]?.image),
      view.background.photo];
    await Promise.all(assets.map(src => photo(src)));
    const loaded = {};
    for (const k of ["left", "right", "center"]) loaded[k] = view.layers[k]?.image ? await photo(view.layers[k].image) : null;
    const bgImage = view.background.photo ? await photo(view.background.photo) : null;
    if (sequence !== null && sequence !== currentSeq) return null;
    const finalSize = dimensions(view.format);
    const ratio = preview ? Math.min(1, 960 / Math.max(finalSize.w, finalSize.h)) : 1;
    const w = Math.round(finalSize.w * ratio), h = Math.round(finalSize.h * ratio);
    target.width = w;target.height = h;
    const draw = target.getContext("2d");
    const b = view.background;
    draw.fillStyle = b.style === "paper" && b.paperTone === "light" ? "#EFE6D7" : b.color || "#233D76";
    draw.fillRect(0, 0, w, h);
    if (bgImage) {
      draw.save();draw.globalAlpha = safe(b.photoOpacity, 0, 100) / 100;
      cover(draw, bgImage, w, h, b.photoX, b.photoY, b.photoScale);draw.restore();
    }
    texture(draw, w, h, b);
    if (loaded.left) light(draw, w, h, view.layers.left);
    if (loaded.right) light(draw, w, h, view.layers.right);
    if (loaded.center) light(draw, w, h, view.layers.center);
    figure(draw, w, h, view.layers.left, loaded.left);
    figure(draw, w, h, view.layers.right, loaded.right);
    shadow(draw, w, h, b);
    titleDraw(draw, w, h, view.layers.title, true);
    figure(draw, w, h, view.layers.center, loaded.center);
    titleDraw(draw, w, h, view.layers.title, false);
    subtitleDraw(draw, w, h, view.layers.subtitle);
    if (highlight) selectionOutline(draw, w, h, view, highlight, loaded);
    return loaded;
  }
  function schedule() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(async () => {
      frameRequested = false;
      const seq = ++currentSeq;
      try {
        const loaded = await paint(canvas, viewFor(state.selected), selectedLayer, true, seq);
        if (seq === currentSeq && loaded) hitImages = loaded;
      } catch (e) { status(e.message || "Falha na prévia.", true); }
    });
  }
  let hitImages = {};
  const layersList = [
    ["background", "Fundo e imagem"],
    ["left", "Personagem esquerdo"],
    ["right", "Personagem direito"],
    ["title", "Anton · texto duplo"],
    ["center", "Personagem principal"],
    ["subtitle", "Etiqueta opcional"]
  ];
  function drawLayerList() {
    const list = $("thumb-layer-list");list.replaceChildren();
    for (const [key, name] of layersList) {
      const item = document.createElement("button");item.type = "button";
      item.className = "thumb-layer-button";item.dataset.layer = key;
      item.setAttribute("aria-pressed", String(key === selectedLayer));
      item.textContent = name;
      const tag = document.createElement("small");
      tag.textContent = key === "background" ? "global" : "editável";
      item.append(tag);
      item.addEventListener("click", () => {
        selectedLayer = key;drawLayerList();drawProperties();schedule();
      });
      list.append(item);
    }
  }
  function drawProperties() {
    const host = $("thumb-layer-properties");host.replaceChildren();
    const key = selectedLayer, layers = currentLayers();
    const value = key === "background" ? state.background : layers[key];
    const heading = document.createElement("h3");
    heading.textContent = layersList.find(v => v[0] === key)[1];
    host.append(heading);
    const addField = (labelText, input, outputValue, change) => {
      const label = document.createElement("label");
      label.textContent = labelText;label.append(input);
      if (outputValue !== undefined) {
        const out = document.createElement("output");out.textContent = String(outputValue);label.append(out);
        input.addEventListener("input", () => {out.textContent = input.value; change(input.value);});
      } else input.addEventListener(input.type === "checkbox" ? "change" : "input", () => change(input.type === "checkbox" ? input.checked : input.value));
      host.append(label);return input;
    };
    const range = (label, field, min, max, step, unit = "") => {
      const input = document.createElement("input");input.type = "range";
      input.min = min;input.max = max;input.step = step;input.value = value[field];
      addField(label, input, value[field] + unit, v => {
        value[field] = +v; const o=input.parentElement.querySelector("output");if(o)o.textContent=v+unit;
        changed();
      });
    };
    const color = (label, field) => {
      const input = document.createElement("input");input.type="color";input.value=value[field] || "#FFFFFF";
      addField(label,input,undefined,v=>{value[field]=v;changed();});
    };
    const text = (label, field) => {
      const input = document.createElement("textarea");
      input.rows = 2;input.value = value[field] || "";input.maxLength=120;
      input.style.minHeight="65px";input.style.resize="vertical";
      addField(label,input,undefined,v=>{value[field]=v;changed();});
    };
    const options = (label, field, values) => {
      const select=document.createElement("select");
      for(const [id,labelText] of values){const o=document.createElement("option");o.value=id;o.textContent=labelText;select.append(o);}
      select.value=value[field];
      addField(label,select,undefined,v=>{value[field]=v;changed();});
    };
    if (key === "background") {
      const note = document.createElement("p");note.className="thumb-hint";
      note.textContent="Estas alterações são compartilhadas automaticamente com todos os Shorts.";
      host.append(note);
      range("Posição horizontal da imagem","photoX",-0.5,1.5,.01);
      range("Posição vertical da imagem","photoY",-0.5,1.5,.01);
      range("Zoom da imagem","photoScale",.5,3,.02);
    } else if (key === "title") {
      text("Frase principal (Enter quebra a linha)","text");
      options("Fonte","font",[["Anton","Anton"],["Bangers","Bangers"]]);
      color("Cor do preenchimento","color");
      color("Cor do contorno","outlineColor");
      range("Tamanho","size",.05,.34,.005);
      range("Contorno fino","stroke",1,15,.5);
      range("Brilho do preenchimento","glowOpacity",0,100,1,"%");
      range("Espalhamento glow","glowSize",0,80,1);
      range("Posição X","x",-.5,1.5,.01);
      range("Posição Y","y",-.5,1.5,.01);
    } else if (key === "subtitle") {
      text("Legenda opcional","text");
      options("Fonte","font",[["Bangers","Bangers"],["Anton","Anton"]]);
      color("Cor do texto","color");color("Cor da caixa","boxColor");
      range("Opacidade da caixa","opacity",0,100,1,"%");
      range("Tamanho","size",.015,.14,.005);
      range("Posição X","x",0,1,.01);
      range("Posição Y","y",0,1,.01);
    } else {
      const upload=document.createElement("button");upload.type="button";upload.className="btn btn-secondary btn-sm";
      upload.textContent=value.image?"Substituir PNG":"Escolher PNG";
      upload.onclick=()=>{imageTarget=key;fileReader.click();};
      host.append(upload);
      if(value.image) {
        const remove=document.createElement("button");remove.type="button";remove.className="btn btn-ghost btn-sm";
        remove.textContent="Remover";remove.style.marginLeft="6px";
        remove.onclick=()=>{value.image=null;changed(true);};
        host.append(remove);
      }
      range("Posição X","x",-.5,1.5,.01);
      range("Posição Y","y",-.5,1.5,.01);
      range("Escala","scale",.08,2.2,.01);
      range("Opacidade","opacity",0,100,1,"%");
      range("Rotação","rotate",-180,180,1);
      color("Cor da luz","glowColor");
      range("Força da luz","glowOpacity",0,100,1,"%");
      range("Raio da luz","glowSize",1,150,1);
      const input=document.createElement("input");input.type="checkbox";input.checked=!!value.flip;
      const label=document.createElement("label");label.className="thumb-check";label.append(input,document.createTextNode("Espelhar personagem"));
      host.append(label);input.onchange=()=>{value.flip=input.checked;changed();};
    }
    if (currentVariant()) {
      const info=document.createElement("div");info.className="thumb-variant-meta";
      info.textContent=key==="background"?"O fundo é o mesmo em todas as versões.":"Mudanças aqui afetam somente este Short.";
      host.append(info);
    }
  }
  function drawVariants() {
    const host=$("thumb-variants");host.replaceChildren();
    const options=[{id:"base",name:"Vídeo longo · 16:9",format:"long"},...state.variants];
    for(const variant of options){
      const b=document.createElement("button");b.type="button";b.className="thumb-variant";
      b.setAttribute("role","tab");b.setAttribute("aria-selected",String(variant.id===state.selected));
      b.textContent=variant.name || "Short";
      b.addEventListener("click",()=>{
        state.selected=variant.id;drawVariants();drawProperties();changed();
      });
      host.append(b);
    }
    const current=currentVariant();
    $("thumb-canvas-label").textContent=current ? `${current.name} · ${current.format==="vertical"?"9:16":current.format==="square"?"1:1":"16:9"}` : "Vídeo longo · 16:9";
    $("thumb-remove-variant").disabled=!current;
  }
  function bindGlobal() {
    $("thumb-project-name").value=state.name;
    const bind = (id, field, read) => {
      const node=$(id);
      node.value=state.background[field];
      const output=$(id+"-value");
      if(output)output.textContent=node.value+"%";
      node.oninput=()=>{
        state.background[field]=read?read(node.value):node.value;
        if(output)output.textContent=node.value+"%";
        changed();if(field==="style"||field==="paperTone")drawProperties();
      };
    };
    bind("thumb-bg-style","style");
    bind("thumb-bg-color","color");
    bind("thumb-paper-tone","paperTone");
    bind("thumb-texture-opacity","textureOpacity",Number);
    bind("thumb-photo-opacity","photoOpacity",Number);
    bind("thumb-shadow-opacity","shadowOpacity",Number);
    bind("thumb-shadow-height","shadowHeight",Number);
    $("thumb-project-name").oninput=()=>changed();
    $("thumb-upload-bg").onclick=()=>{imageTarget="background";fileReader.click();};
    $("thumb-remove-bg").onclick=()=>{state.background.photo=null;changed(true);};
  }
  function newVariant() {
    const index=state.variants.length+1;
    if(index>30)return status("O limite é de 30 versões por projeto.",true);
    const v={id:"short-"+Date.now()+"-"+index,name:"Short "+index,format:"vertical",layers:clone(state.base)};
    // Portrait needs a slightly smaller centered headline, but keeps the same design and image layers.
    v.layers.title.size=Math.min(v.layers.title.size,.18);
    state.variants.push(v);state.selected=v.id;
    selectedLayer="center";changed(true);drawVariants();status("Short criado. O fundo e a iluminação já vieram da thumbnail principal.");
  }
  function duplicateVariant() {
    const original=currentVariant();
    if(!original) return newVariant();
    if(state.variants.length>=30)return status("Limite de 30 versões.",true);
    const v=clone(original);v.id="short-"+Date.now()+"-"+state.variants.length;
    v.name=original.name+" cópia";state.variants.push(v);state.selected=v.id;
    changed(true);drawVariants();
  }
  function removeVariant() {
    const original=currentVariant();
    if(!original)return;
    if(!confirm(`Excluir apenas a versão "${original.name}"?`))return;
    state.variants=state.variants.filter(v=>v.id!==original.id);
    state.selected="base";changed(true);drawVariants();
  }
  function variantMetaControls() {
    const section=$("thumb-variants");
    const controls=document.createElement("div");controls.className="thumb-inline";
    const current=currentVariant();
    if(!current)return;
    const name=document.createElement("input");name.type="text";name.value=current.name;name.maxLength=80;name.placeholder="Nome do Short";
    const sel=document.createElement("select");
    for(const [id,label] of [["vertical","9:16 • vertical"],["square","1:1 • quadrado"],["long","16:9 • horizontal"]]){
      const o=document.createElement("option");o.value=id;o.textContent=label;sel.append(o);
    }
    sel.value=current.format;
    controls.append(name,sel);
    name.oninput=()=>{current.name=name.value;changed();};
    name.onchange=()=>drawVariants();
    sel.onchange=()=>{current.format=sel.value;drawVariants();changed();};
    section.after(controls);
  }
  function refreshVariantControls() {
    document.querySelectorAll("#panel-thumbnails > .thumb-app .thumb-variants + .thumb-inline")
      .forEach(n=>n.remove());
    variantMetaControls();
  }
  function fullUi() {
    bindGlobal();drawLayerList();drawProperties();drawVariants();refreshVariantControls();schedule();
  }
  let hitTimer=null;
  function pointerCoords(event) {
    const rect=canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height};
  }
  function boxContains(p,layer,img,w,h) {
    const r=figureBounds(layer,img,w,h);
    return p.x*w>=r.x&&p.x*w<=r.x+r.w&&p.y*h>=r.y&&p.y*h<=r.y+r.h;
  }
  function hitTest(p) {
    const view=viewFor(state.selected),size=dimensions(view.format);
    if(selectedLayer==="background")return "background";
    if(selectedLayer==="title")return "title";
    if(selectedLayer==="subtitle")return "subtitle";
    const order=["center","right","left"];
    if(order.includes(selectedLayer)&&hitImages[selectedLayer]&&boxContains(p,view.layers[selectedLayer],hitImages[selectedLayer],size.w,size.h))return selectedLayer;
    for(const key of order)if(hitImages[key]&&boxContains(p,view.layers[key],hitImages[key],size.w,size.h))return key;
    return "title";
  }
  canvas.addEventListener("pointerdown",event=>{
    if(event.button!==0)return;
    const p=pointerCoords(event);
    const chosen=hitTest(p);
    selectedLayer=chosen;drawLayerList();drawProperties();
    const current=chosen==="background"?state.background:currentLayers()[chosen];
    dragging={id:event.pointerId,key:chosen,start:p,x:current.x??current.photoX,y:current.y??current.photoY};
    if(chosen==="background"){dragging.x=current.photoX;dragging.y=current.photoY;}
    canvas.setPointerCapture(event.pointerId);schedule();
  });
  canvas.addEventListener("pointermove",event=>{
    if(!dragging||dragging.id!==event.pointerId)return;
    const p=pointerCoords(event),dx=p.x-dragging.start.x,dy=p.y-dragging.start.y;
    const key=dragging.key,current=key==="background"?state.background:currentLayers()[key];
    if(key==="background"){
      current.photoX=+safe(dragging.x+dx,-.5,1.5).toFixed(3);
      current.photoY=+safe(dragging.y+dy,-.5,1.5).toFixed(3);
    }else{
      current.x=+safe(dragging.x+dx,-.5,1.5).toFixed(3);
      current.y=+safe(dragging.y+dy,-.5,1.5).toFixed(3);
    }
    changed();
    // Atualizar valores na lateral só no fim do arraste; não recriar dezenas
    // de controles por frame em resoluções altas.
  });
  const stopDrag=()=>{if(dragging){dragging=null;drawProperties();}};
  canvas.addEventListener("pointerup",stopDrag);
  canvas.addEventListener("pointercancel",stopDrag);
  canvas.addEventListener("keydown",event=>{
    const delta={"ArrowLeft":[-.005,0],"ArrowRight":[.005,0],"ArrowUp":[0,-.005],"ArrowDown":[0,.005]}[event.key];
    if(!delta)return;
    event.preventDefault();
    const current=selectedLayer==="background"?state.background:currentLayers()[selectedLayer];
    const x=selectedLayer==="background"?"photoX":"x",y=selectedLayer==="background"?"photoY":"y";
    current[x]=safe(current[x]+delta[0],-.5,1.5);
    current[y]=safe(current[y]+delta[1],-.5,1.5);
    changed();drawProperties();
  });
  async function imagePicked(event) {
    const file=event.target.files?.[0];
    if(!file)return;
    event.target.value="";
    if(!["image/png","image/jpeg","image/webp"].includes(file.type))
      return status("Use PNG, JPG ou WebP para seus personagens e fundos.",true);
    if(file.size>18*1024*1024)
      return status("A imagem excede 18 MB. Exporte uma versão otimizada antes de importar.",true);
    const url=await new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(Error("Falha na leitura da imagem."));
      reader.readAsDataURL(file);
    });
    const assetId = "img-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,9);
    state.media[assetId]=url;
    if(imageTarget==="background")state.background.photo=assetId;
    else currentLayers()[imageTarget].image=assetId;
    changed(true);status("Imagem carregada. Arraste na prévia e ajuste escala/opacidade no painel.");
  }
  fileReader.addEventListener("change",event=>imagePicked(event).catch(e=>status(e.message,true)));
  function download(blob,name){
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;
    document.body.append(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(a.href),60000);
  }
  async function renderBlob(id) {
    const offscreen=document.createElement("canvas");
    await paint(offscreen,viewFor(id),null);
    return await new Promise((resolve,reject)=>{
      offscreen.toBlob(b=>b?resolve(b):reject(Error("Falha na exportação PNG.")),"image/png");
    });
  }
  async function exportCurrent() {
    status("Gerando PNG em resolução final...");
    try {
      const id=state.selected;const selected=currentVariant();
      const name=filenames(state.name)+"-"+filenames(selected?.name||"video-longo")+".png";
      download(await renderBlob(id),name);status("PNG exportado em resolução original.");
    }catch(e){status(e.message,true);}
  }
  const CRC_TABLE=(()=>{const table=[];for(let n=0;n<256;n++){
    let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;table.push(c>>>0);
  }return table;})();
  const crc32=(bytes)=>{
    let crc=0xFFFFFFFF;
    for(const b of bytes)crc=CRC_TABLE[(crc^b)&0xFF]^(crc>>>8);
    return (crc^0xFFFFFFFF)>>>0;
  };
  function zipStore(entries) {
    const encoder=new TextEncoder(),parts=[],central=[];
    let offset=0,centralSize=0;
    const u16=(v,i,n)=>v.setUint16(i,n,true),u32=(v,i,n)=>v.setUint32(i,n>>>0,true);
    for(const {name,bytes} of entries) {
      const filename=encoder.encode(name),crc=crc32(bytes);
      const local=new Uint8Array(30+filename.length),head=new DataView(local.buffer);
      u32(head,0,0x04034B50);u16(head,4,20);u16(head,6,0x0800);
      u16(head,8,0);u32(head,14,crc);u32(head,18,bytes.length);u32(head,22,bytes.length);
      u16(head,26,filename.length);local.set(filename,30);
      parts.push(local,bytes);
      const item=new Uint8Array(46+filename.length),view=new DataView(item.buffer);
      u32(view,0,0x02014B50);u16(view,4,20);u16(view,6,20);u16(view,8,0x0800);
      u16(view,10,0);u32(view,16,crc);u32(view,20,bytes.length);
      u32(view,24,bytes.length);u16(view,28,filename.length);
      u32(view,42,offset);item.set(filename,46);central.push(item);
      centralSize+=item.length;offset+=local.length+bytes.length;
    }
    const eocd=new Uint8Array(22),tail=new DataView(eocd.buffer);
    u32(tail,0,0x06054B50);u16(tail,8,entries.length);u16(tail,10,entries.length);
    u32(tail,12,centralSize);u32(tail,16,offset);
    return new Blob([...parts,...central,eocd],{type:"application/zip"});
  }
  async function exportAll() {
    const button=$("thumb-export-all");button.disabled=true;
    try {
      const all=[{id:"base",name:"video-longo"},...state.variants];
      if(all.length>31)throw Error("Limite de 31 thumbnails por exportação.");
      const entries=[];
      for(let i=0;i<all.length;i++){
        status(`Gerando thumbnail ${i+1} de ${all.length}...`);
        const entry=all[i];const png=await renderBlob(entry.id);
        const bytes=new Uint8Array(await png.arrayBuffer());
        entries.push({name:`${String(i+1).padStart(2,"0")}-${filenames(entry.name)}.png`,bytes});
      }
      collectUnusedMedia();
      entries.push({name:"projeto-thumbnail.json",bytes:new TextEncoder().encode(JSON.stringify(state,null,2))});
      download(zipStore(entries),filenames(state.name)+"-thumbnails.zip");
      status(`${all.length} PNG(s) e projeto editável reunidos em um ZIP.`);
    }catch(e){status(e.message,true);}finally{button.disabled=false;}
  }
  function exportJson() {
    collectUnusedMedia();
    download(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),
      filenames(state.name)+"-thumbnails.json");status("Projeto JSON exportado com os assets incorporados.");
  }
  async function importJson(event) {
    const f=event.target.files?.[0];event.target.value="";
    if(!f)return;
    if(f.size>90*1024*1024)return status("Projeto excede 90 MB.",true);
    try {
      const imported=validateProject(JSON.parse(await f.text()));
      state=imported;images.clear();
      if(state.selected!=="base"&&!state.variants.some(v=>v.id===state.selected))state.selected="base";
      selectedLayer="center";fullUi();changed();
      status("Projeto restaurado com versões e imagens.");
    }catch(e){status(e.message,true);}
  }
  $("thumb-json-file").addEventListener("change",importJson);
  $("thumb-import-json").onclick=()=>$("thumb-json-file").click();
  $("thumb-download-json").onclick=exportJson;
  $("thumb-export-current").onclick=exportCurrent;
  $("thumb-export-all").onclick=exportAll;
  $("thumb-add-variant").onclick=()=>{newVariant();refreshVariantControls();};
  $("thumb-batch-create").onclick=()=>{
    const phrases=$("thumb-batch-titles").value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    if(!phrases.length)return status("Informe pelo menos uma frase.",true);
    if(phrases.length+state.variants.length>30)return status("O projeto aceita até 30 versões.",true);
    const now=Date.now();
    for(const [i,phrase] of phrases.entries()){
      const index=state.variants.length+1;
      const layer=clone(state.base);
      layer.title.text=phrase.slice(0,120);
      layer.title.size=Math.min(layer.title.size,.18);
      state.variants.push({id:"short-"+now+"-"+index+"-"+i,name:"Short "+index,format:"vertical",layers:layer});
    }
    state.selected=state.variants[state.variants.length-1].id;
    $("thumb-batch-titles").value="";
    selectedLayer="center";changed(true);drawVariants();refreshVariantControls();
    status(phrases.length+" versões criadas. Agora substitua o personagem em cada Short e exporte o ZIP.");
  };
  $("thumb-duplicate-variant").onclick=()=>{duplicateVariant();refreshVariantControls();};
  $("thumb-remove-variant").onclick=()=>{removeVariant();refreshVariantControls();};
  document.addEventListener("click",event=>{
    if(event.target.closest("#thumb-variants .thumb-variant"))
      setTimeout(refreshVariantControls,0);
  });
  restoreLocal().finally(()=>{fullUi();});
})();
