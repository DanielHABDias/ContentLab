let duration = 0;
let currentFolder = "";
let videoLoaded = false;
let cacheVideos = [];
let selectedCacheEntry = null;
let currentSourceMode = "youtube";
let currentSourceUrl = "";
let currentCacheKey = "";
let selectedLocalPath = "";
let importedMediaCacheKey = "";
let localImportPoll = null;
let sourceRequestId = 0;

const $ = (id) => document.getElementById(id);

// Areas de trabalho isoladas: trocar de aba preserva o trabalho em andamento.
const workspaces = ["videos", "transcription", "recording", "voiceai", "voice-settings", "editor", "multieditor", "publications", "metrics", "library", "thumbnails", "settings", "docs"];
const workspaceGroupLabels={editor:"Editor",social:"Redes sociais",narration:"Narração",settings:"Configurações"};
const workspaceGroups = {
  narration: ["recording", "voiceai", "transcription"],
  settings: ["settings", "voice-settings"],
  editor: ["editor", "multieditor"],
  social: ["publications", "metrics"]
};
const workspaceGroupFor = (name) =>
  Object.keys(workspaceGroups).find((group) => workspaceGroups[group].includes(name)) || null;

// Only one nested menu stays open at a time. The active panel remains visible
// while a category is expanded, until the user chooses a submenu item.
function expandWorkspaceGroup(name) {
  for (const group of Object.keys(workspaceGroups)) {
    const expanded = group === name;
    const container = $("workspace-group-" + group + "-items");
    const trigger = $("workspace-group-" + group + "-trigger");
    container.hidden = !expanded;
    trigger.setAttribute("aria-expanded", String(expanded));
    trigger.setAttribute("aria-label",
      (expanded ? "Recolher" : "Expandir") +
      (" opções de " + workspaceGroupLabels[group]));
    trigger.classList.toggle("is-expanded", expanded);
  }
}
function showWorkspace(name) {
  if (!workspaces.includes(name)) return;
  expandWorkspaceGroup(workspaceGroupFor(name));
  for (const workspace of workspaces) {
    const active = workspace === name;
    const tab = $("tab-" + workspace);
    const panel = $("panel-" + workspace);
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    // Both direct tabs and expanded nested choices remain keyboard-accessible.
    tab.tabIndex = 0;
    panel.hidden = !active;
    panel.classList.toggle("hidden", !active);
  }
  for (const group of Object.keys(workspaceGroups)) {
    const trigger = $("workspace-group-" + group + "-trigger");
    trigger.classList.toggle("is-group-active", workspaceGroups[group].includes(name));
  }
  if (name === "docs") {
    const manual = $("docsManual");
    if (manual && !manual.hasAttribute("src")) manual.src = manual.dataset.src;
  }
  const voiceArea=["transcription","recording","voiceai"].includes(name);
  for(const [id,visible] of [["voiceProjectShared",false],["voiceStatusShared",voiceArea||name==="voice-settings"]]){const element=$(id);if(element){element.hidden=!visible;element.classList.toggle("hidden",!visible);}}
  history.replaceState(null, "", "#" + name);
  window.dispatchEvent(new CustomEvent("workspacechange",{detail:{name}}));
}
document.querySelectorAll(".workspace-tab[data-workspace]").forEach((tab) => {
  tab.addEventListener("click", () => showWorkspace(tab.dataset.workspace));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const visible = [...document.querySelectorAll(".workspace-tab[data-workspace]")]
      .filter(item => !item.closest(".workspace-subtabs[hidden]"));
    const index = visible.indexOf(tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 :
      (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + visible.length) % visible.length;
    const destination = visible[next];
    showWorkspace(destination.dataset.workspace);
    destination.focus();
  });
});
for (const group of Object.keys(workspaceGroups)) {
  const trigger = $("workspace-group-" + group + "-trigger");
  trigger.addEventListener("click", () => {
    expandWorkspaceGroup(trigger.getAttribute("aria-expanded") === "true" ? null : group);
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    expandWorkspaceGroup(group);
    $("tab-" + workspaceGroups[group][0]).focus();
  });
}
window.addEventListener("hashchange", () => {
  const requested = location.hash.slice(1);
  if (workspaces.includes(requested)) showWorkspace(requested);
});
// Lightweight DOM motion: Remotion remains dedicated to rendered video, not UI clicks.
// Observe visible cards once, then leave the content accessible and interactive.
const studioReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if (!studioReducedMotion.matches && "IntersectionObserver" in window) {
  const studioObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.045, rootMargin: "0px 0px -18px 0px" });
  document.querySelectorAll(".workspace-panel .workspace-intro, .workspace-panel .block, .workspace-panel .editor-project, .workspace-panel .docs-viewer-block").forEach((section, index) => {
    section.classList.add("studio-reveal");
    section.style.setProperty("--reveal-delay", String(Math.min(index % 4, 3) * 45) + "ms");
    studioObserver.observe(section);
  });
}
// Pointer-follow highlights give buttons a tactile press without extra markup.
document.addEventListener("pointerdown", (event) => {
  if (studioReducedMotion.matches) return;
  const button = event.target.closest(".btn");
  if (!button || button.disabled) return;
  const rect = button.getBoundingClientRect();
  button.style.setProperty("--press-x", (event.clientX - rect.left) + "px");
  button.style.setProperty("--press-y", (event.clientY - rect.top) + "px");
});

// Old #guide links now lead directly to the single official reference workspace.
const requestedWorkspace = location.hash.slice(1);
showWorkspace(requestedWorkspace === "guide" ? "docs" :
  workspaces.includes(requestedWorkspace) ? requestedWorkspace : "videos");

function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function parseTime(str) {
  const parts = str.split(":").map((p) => parseInt(p, 10) || 0);
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return s;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  const digits = i >= 3 ? 1 : i === 2 ? 0 : 1;
  return `${n.toFixed(digits)} ${units[i]}`;
}

function activeSourceUrl() {
  if (currentSourceMode !== "youtube") return currentSourceUrl || "";
  return $("url").value.trim();
}

function resetLoadedVideo() {
  sourceRequestId += 1;
  videoLoaded = false;
  duration = 0;
  currentSourceUrl = "";
  currentCacheKey = "";
  $("videoSection").classList.add("hidden");
  $("progressSection").classList.add("hidden");
  const videoEl = $("previewVideo");
  videoEl.pause();
  videoEl.removeAttribute("src");
  videoEl.load();
  resetBatchDraft();
  updateDownloadBtnState();
}

function resetBatchDraft() {
  $("batchText").value = "";
  $("batchValidation").replaceChildren();
  $("batchValidation").classList.add("hidden");
  $("batchItems").replaceChildren();
  $("batchItems").classList.add("hidden");
  $("doneRow").classList.add("hidden");
  $("downloadError").classList.add("hidden");
  window._lastFolder = null;
}

// ---------- preview ----------
async function loadPreview(url) {
  const requestId = sourceRequestId;
  const videoEl = $("previewVideo");
  const errEl = $("previewError");
  errEl.classList.add("hidden");
  videoEl.classList.remove("hidden");
  videoEl.removeAttribute("src");

  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (requestId !== sourceRequestId) return;
    if (!res.ok || data.error) throw new Error(data.error || "Prévia indisponível");
    videoEl.src = `/api/video-proxy/${data.preview_id}`;
    videoEl.load();
  } catch (err) {
    if (requestId !== sourceRequestId) return;
    videoEl.classList.add("hidden");
    errEl.classList.remove("hidden");
  }
}

function loadCachedPreview(cacheKey) {
  const videoEl = $("previewVideo");
  $("previewError").classList.add("hidden");
  videoEl.classList.remove("hidden");
  videoEl.src = `/api/cache-preview/${encodeURIComponent(cacheKey)}`;
  videoEl.load();
}

$("previewVideo").addEventListener("loadedmetadata", () => {
  const mediaDuration = Number($("previewVideo").duration || 0);
  if ((!duration || duration <= 0) && Number.isFinite(mediaDuration) && mediaDuration > 0) {
    duration = mediaDuration;
    $("videoDuration").textContent = fmt(duration);
    setupSlider();
  }
});

$("previewVideo").addEventListener("error", () => {
  if (!videoLoaded || fastToggle?.checked) return;
  $("previewVideo").classList.add("hidden");
  $("previewError").classList.remove("hidden");
});

// ---------- slider ----------
function updateSliderVisual() {
  const s = parseFloat($("startRange").value);
  const e = parseFloat($("endRange").value);
  const max = duration || 1;
  $("sliderRange").style.left = (s / max) * 100 + "%";
  $("sliderRange").style.width = Math.max(0, ((e - s) / max) * 100) + "%";
  $("startTime").value = fmt(s);
  $("endTime").value = fmt(e);
  $("clipLength").textContent = fmt(Math.max(0, e - s));
}

function setupSlider() {
  $("startRange").min = 0;
  $("startRange").max = duration;
  $("endRange").min = 0;
  $("endRange").max = duration;
  $("startRange").value = 0;
  $("endRange").value = duration;
  updateSliderVisual();
}

$("startRange").addEventListener("input", () => {
  const s = parseFloat($("startRange").value);
  const e = parseFloat($("endRange").value);
  if (s > e - 1) $("startRange").value = Math.max(0, e - 1);
  updateSliderVisual();
});

$("endRange").addEventListener("input", () => {
  const s = parseFloat($("startRange").value);
  const e = parseFloat($("endRange").value);
  if (e < s + 1) $("endRange").value = Math.min(duration, s + 1);
  updateSliderVisual();
});

$("startTime").addEventListener("change", () => {
  let v = parseTime($("startTime").value);
  v = Math.min(Math.max(0, v), parseFloat($("endRange").value) - 1);
  $("startRange").value = v;
  updateSliderVisual();
});

$("endTime").addEventListener("change", () => {
  let v = parseTime($("endTime").value);
  v = Math.max(Math.min(duration, v), parseFloat($("startRange").value) + 1);
  $("endRange").value = v;
  updateSliderVisual();
});

$("setStartBtn").addEventListener("click", () => {
  const videoEl = $("previewVideo");
  if (!videoEl.duration) return;
  const t = videoEl.currentTime;
  $("startRange").value = Math.min(t, parseFloat($("endRange").value) - 1);
  updateSliderVisual();
});

$("setEndBtn").addEventListener("click", () => {
  const videoEl = $("previewVideo");
  if (!videoEl.duration) return;
  const t = videoEl.currentTime;
  $("endRange").value = Math.max(t, parseFloat($("startRange").value) + 1);
  updateSliderVisual();
});

$("fullToggle").addEventListener("change", (e) => {
  $("trimControls").classList.toggle("disabled", e.target.checked);
});

// ---------- modo rápido (sem prévia) ----------
const fastToggle = $("fastToggle");
fastToggle.checked = localStorage.getItem("contentlab_fast") === "1";

function applyFastModeUI() {
  const fast = fastToggle.checked;
  const videoEl = $("previewVideo");
  videoEl.classList.toggle("hidden", fast);
  $("fastNote").classList.toggle("hidden", !fast);
  $("setStartBtn").classList.toggle("hidden", fast);
  $("setEndBtn").classList.toggle("hidden", fast);
  if (fast) {
    // corta o buffer da prévia na hora: para de gastar banda imediatamente
    videoEl.pause();
    videoEl.removeAttribute("src");
    videoEl.load();
    $("previewError").classList.add("hidden");
  }
}

fastToggle.addEventListener("change", () => {
  localStorage.setItem("contentlab_fast", fastToggle.checked ? "1" : "0");
  applyFastModeUI();
  // se desligou o modo rápido com um vídeo já carregado, busca a prévia agora
  if (!fastToggle.checked && videoLoaded) {
    if (currentCacheKey) loadCachedPreview(currentCacheKey);
    else if (activeSourceUrl()) loadPreview(activeSourceUrl());
  }
});

applyFastModeUI();

// ---------- modo único / múltiplos ----------
const multiToggle = $("multiToggle");

function selectedMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function updateModeUI() {
  const multiple = multiToggle.checked;
  const mode = selectedMode();

  $("singleModeBlock").classList.toggle("hidden", multiple);
  $("batchBlock").classList.toggle("hidden", !multiple);
  $("downloadBtn").classList.toggle("hidden", multiple);
  $("batchDownloadBtn").classList.toggle("hidden", !multiple);
  $("transcriptOptions").classList.toggle("hidden", mode !== "transcript");

  if (mode === "transcript") {
    $("downloadBtn").textContent = "Gerar transcrição";
    $("batchDownloadBtn").textContent = "Gerar transcrições em lote";
  } else if (mode === "audio") {
    $("downloadBtn").textContent = "Baixar áudio";
    $("batchDownloadBtn").textContent = "Processar áudios em lote";
  } else {
    $("downloadBtn").textContent = "Baixar vídeo";
    $("batchDownloadBtn").textContent = "Processar vídeos em lote";
  }
  updateDownloadBtnState();
}

multiToggle.addEventListener("change", updateModeUI);
document.querySelectorAll('input[name="mode"]').forEach((el) => el.addEventListener("change", updateModeUI));

// ---------- fonte: link da internet, cache ou arquivo local ----------
const sourceModeInputs = document.querySelectorAll('input[name="sourceMode"]');

function updateSourceModeUI() {
  const selected = document.querySelector('input[name="sourceMode"]:checked');
  currentSourceMode = selected ? selected.value : "youtube";
  $("youtubeSourceBlock").classList.toggle("hidden", currentSourceMode !== "youtube");
  $("cacheSourceBlock").classList.toggle("hidden", currentSourceMode !== "cache");
  $("localSourceBlock").classList.toggle("hidden", currentSourceMode !== "local");
  $("loadError").classList.add("hidden");
  resetLoadedVideo();
  if (currentSourceMode === "cache") {
    const importedKey=importedMediaCacheKey;
    importedMediaCacheKey="";
    refreshCacheList(importedKey);
  }
}

sourceModeInputs.forEach((el) => el.addEventListener("change", updateSourceModeUI));
document.addEventListener("contentlab:library-video-imported",(event)=>{
  const key=String(event.detail?.key||"");
  if(!key)return;
  importedMediaCacheKey=key;
  const radio=document.querySelector('input[name="sourceMode"][value="cache"]');
  if(radio){
    radio.checked=true;
    radio.dispatchEvent(new Event("change",{bubbles:true}));
  }
});

$("loadBtn").addEventListener("click", loadVideo);
$("url").addEventListener("keydown", (e) => { if (e.key === "Enter") loadVideo(); });

async function applyLoadedVideo(data, previewKind, previewValue) {
  resetBatchDraft();
  duration = Number(data.duration || 0);
  $("videoTitle").textContent = data.title || "—";
  $("videoDuration").textContent = fmt(duration);
  $("thumb").src = data.thumbnail || "";
  $("thumb").classList.toggle("hidden", !data.thumbnail);
  $("fileName").value = data.title || "";
  $('downloadSourceName').value='';
  $("videoSection").classList.remove("hidden");
  $("progressSection").classList.add("hidden");

  setupSlider();
  videoLoaded = true;
  if (fastToggle.checked) {
    applyFastModeUI();
  } else if (previewKind === "cache") {
    loadCachedPreview(previewValue);
  } else {
    loadPreview(previewValue);
  }
  updateModeUI();
}

async function loadVideo() {
  const url = $("url").value.trim();
  const requestId = ++sourceRequestId;
  $("loadError").classList.add("hidden");
  if (!url) {
    $("loadError").textContent = "Cole um link HTTPS de um vídeo da internet.";
    $("loadError").classList.remove("hidden");
    return;
  }

  $("loadBtn").disabled = true;
  $("loadBtn").textContent = "Carregando...";

  try {
    const res = await fetch("/api/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (requestId !== sourceRequestId) return;
    if (!res.ok || data.error) throw new Error(data.error || "Erro desconhecido");

    currentSourceMode = "youtube";
    currentSourceUrl = url;
    currentCacheKey = "";
    await applyLoadedVideo(data, "youtube", url);
  } catch (err) {
    if (requestId !== sourceRequestId) return;
    $("loadError").textContent = err.message;
    $("loadError").classList.remove("hidden");
  } finally {
    $("loadBtn").disabled = false;
    $("loadBtn").textContent = "Carregar";
  }
}

function updateCacheSelectionUI() {
  const key = $("cacheSelect").value;
  selectedCacheEntry = cacheVideos.find((item) => item.key === key) || null;
  $("loadCacheBtn").disabled = !selectedCacheEntry;
  $("openCacheBtn").disabled = !selectedCacheEntry;
  $("deleteCacheBtn").disabled = !selectedCacheEntry;
  if (!selectedCacheEntry) {
    $("cacheDetails").textContent = cacheVideos.length ? "Selecione um vídeo já baixado." : "Nenhum vídeo disponível no cache.";
    return;
  }
  const durationText = selectedCacheEntry.duration ? fmt(selectedCacheEntry.duration) : "duração desconhecida";
  const originText = selectedCacheEntry.origin === "local" ? " • arquivo local" : "";
  $("cacheDetails").textContent = `${durationText} • ${formatBytes(selectedCacheEntry.size_bytes)}${originText}${selectedCacheEntry.legacy ? " • cache antigo" : ""}`;
}

async function refreshCacheList(preserveKey = "") {
  const select = $("cacheSelect");
  select.disabled = true;
  select.innerHTML = '<option value="">Carregando cache...</option>';
  $("loadCacheBtn").disabled = true;
  $("openCacheBtn").disabled = true;
  $("deleteCacheBtn").disabled = true;
  try {
    const res = await fetch("/api/cache");
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Não consegui listar o cache.");
    cacheVideos = data.videos || [];
    select.innerHTML = "";
    if (!cacheVideos.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Nenhum vídeo em cache";
      select.appendChild(option);
    } else {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Selecione um vídeo...";
      select.appendChild(placeholder);
      for (const item of cacheVideos) {
        const option = document.createElement("option");
        option.value = item.key;
        option.textContent = `${item.title} — ${formatBytes(item.size_bytes)}`;
        select.appendChild(option);
      }
      if (preserveKey && cacheVideos.some((item) => item.key === preserveKey)) select.value = preserveKey;
    }
    select.disabled = !cacheVideos.length;
    updateCacheSelectionUI();
  } catch (err) {
    cacheVideos = [];
    select.innerHTML = '<option value="">Erro ao carregar cache</option>';
    $("cacheDetails").textContent = err.message;
  }
}

$("cacheSelect").addEventListener("change", updateCacheSelectionUI);
$("refreshCacheBtn").addEventListener("click", () => refreshCacheList($("cacheSelect").value));

$("chooseLocalVideoBtn").addEventListener("click", async () => {
  $("loadError").classList.add("hidden");
  $("localImportStatus").textContent = "";
  try {
    const res = await fetch("/api/choose-video", { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Não foi possível abrir o seletor de vídeo.");
    if (!data.path) return;
    selectedLocalPath = data.path;
    $("localVideoPath").value = data.path;
    $("importLocalVideoBtn").disabled = false;
    resetLoadedVideo();
  } catch (err) {
    $("loadError").textContent = err.message;
    $("loadError").classList.remove("hidden");
  }
});

function stopLocalImportPoll() {
  if (localImportPoll) clearInterval(localImportPoll);
  localImportPoll = null;
}

function pollLocalImport(jobId) {
  stopLocalImportPoll();
  localImportPoll = setInterval(async () => {
    try {
      const res = await fetch(`/api/progress/${jobId}`);
      const job = await res.json();
      if (!res.ok || (job.error && job.status !== "error")) throw new Error(job.error || "Falha ao consultar a importação.");
      const pct = Number(job.percent || 0);
      $("localImportStatus").textContent = `${job.message || "Copiando..."} ${pct ? `(${pct}%)` : ""}`;
      if (job.status === "done") {
        stopLocalImportPoll();
        const entry = job.source;
        if (!entry || !entry.key || !entry.url) throw new Error("A importação terminou sem uma fonte de cache válida.");
        $("localImportStatus").textContent = `Pronto: ${entry.title || entry.original_name || "vídeo local"} está no cache.`;
        $("importLocalVideoBtn").disabled = false;
        $("importLocalVideoBtn").textContent = "Copiar para o cache";
        const selectedMode = document.querySelector('input[name="sourceMode"]:checked')?.value;
        if (selectedMode === "local") {
          currentSourceMode = "local";
          currentSourceUrl = entry.url;
          currentCacheKey = entry.key;
          await applyLoadedVideo(entry, "cache", entry.key);
        }
        refreshCacheList(entry.key);
      } else if (job.status === "error") {
        stopLocalImportPoll();
        throw new Error(job.error || "Erro ao copiar o vídeo para o cache.");
      }
    } catch (err) {
      stopLocalImportPoll();
      $("importLocalVideoBtn").disabled = false;
      $("importLocalVideoBtn").textContent = "Copiar para o cache";
      $("loadError").textContent = err.message;
      $("loadError").classList.remove("hidden");
      $("localImportStatus").textContent = "";
    }
  }, 500);
}

$("importLocalVideoBtn").addEventListener("click", async () => {
  if (!selectedLocalPath) return;
  $("loadError").classList.add("hidden");
  $("importLocalVideoBtn").disabled = true;
  $("importLocalVideoBtn").textContent = "Copiando...";
  $("localImportStatus").textContent = "Preparando importação...";
  resetLoadedVideo();
  try {
    const res = await fetch("/api/local-source/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: selectedLocalPath }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Não foi possível iniciar a cópia.");
    pollLocalImport(data.job_id);
  } catch (err) {
    $("importLocalVideoBtn").disabled = false;
    $("importLocalVideoBtn").textContent = "Copiar para o cache";
    $("localImportStatus").textContent = "";
    $("loadError").textContent = err.message;
    $("loadError").classList.remove("hidden");
  }
});

$("loadCacheBtn").addEventListener("click", async () => {
  updateCacheSelectionUI();
  if (!selectedCacheEntry) return;
  if (!selectedCacheEntry.url) {
    $("loadError").textContent = "Este item de cache não possui uma referência utilizável.";
    $("loadError").classList.remove("hidden");
    return;
  }
  currentSourceMode = "cache";
  currentSourceUrl = selectedCacheEntry.url;
  currentCacheKey = selectedCacheEntry.key;
  $("loadError").classList.add("hidden");
  await applyLoadedVideo(selectedCacheEntry, "cache", selectedCacheEntry.key);
});

$("openCacheBtn").addEventListener("click", async () => {
  updateCacheSelectionUI();
  if (!selectedCacheEntry) return;
  const res = await fetch("/api/cache/open", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: selectedCacheEntry.key }),
  });
  const data = await res.json();
  if (!res.ok || data.error) alert(data.error || "Não consegui abrir a pasta do cache.");
});

let pendingDeleteCache = null;
function openDeleteCacheModal(entry) {
  pendingDeleteCache = entry;
  $("deleteCacheMessage").textContent = `Tem certeza que deseja apagar “${entry.title}”? Serão liberados aproximadamente ${formatBytes(entry.size_bytes)}. O vídeo completo e as transcrições em cache serão removidos.`;
  $("deleteCacheModal").classList.remove("hidden");
}
function closeDeleteCacheModal() {
  pendingDeleteCache = null;
  $("deleteCacheModal").classList.add("hidden");
}

$("deleteCacheBtn").addEventListener("click", () => {
  updateCacheSelectionUI();
  if (selectedCacheEntry) openDeleteCacheModal(selectedCacheEntry);
});
$("cancelDeleteCacheBtn").addEventListener("click", closeDeleteCacheModal);
$("deleteCacheModal").addEventListener("click", (e) => { if (e.target === $("deleteCacheModal")) closeDeleteCacheModal(); });
$("confirmDeleteCacheBtn").addEventListener("click", async () => {
  if (!pendingDeleteCache) return;
  const entry = pendingDeleteCache;
  const btn = $("confirmDeleteCacheBtn");
  btn.disabled = true;
  btn.textContent = "Apagando...";
  try {
    const res = await fetch("/api/cache/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: entry.key }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Não consegui apagar o cache.");
    if (currentCacheKey === entry.key) resetLoadedVideo();
    closeDeleteCacheModal();
    await refreshCacheList();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Apagar definitivamente";
  }
});

updateSourceModeUI();

// ---------- folder ----------
currentFolder = $("folderPath").value.trim();
$("folderPath").addEventListener("input", () => {
  currentFolder = $("folderPath").value.trim();
  updateDownloadBtnState();
});

$("chooseFolderBtn").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/choose-folder", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Seletor indisponível");
    if (data.folder) {
      currentFolder = data.folder;
      $("folderPath").value = data.folder;
    }
  } catch (err) {
    alert("Não foi possível abrir o seletor. Digite o caminho da pasta no campo ao lado.");
  }
  updateDownloadBtnState();
});

function updateDownloadBtnState() {
  const ready = videoLoaded;
  $("downloadBtn").disabled = !ready;
  $("batchDownloadBtn").disabled = !(ready && $("batchText").value.trim());
}


// ---------- cortes em lote ----------
$("batchText").addEventListener("input", () => {
  $("batchValidation").classList.add("hidden");
  updateDownloadBtnState();
});

function renderBatchValidation(errors) {
  const box = $("batchValidation");
  box.innerHTML = "";
  if (!errors || !errors.length) {
    box.classList.add("hidden");
    return;
  }
  const title = document.createElement("strong");
  title.textContent = "Corrija o lote antes de continuar:";
  box.appendChild(title);
  const ul = document.createElement("ul");
  for (const err of errors) {
    const li = document.createElement("li");
    li.textContent = err;
    ul.appendChild(li);
  }
  box.appendChild(ul);
  box.classList.remove("hidden");
}

$("batchDownloadBtn").addEventListener("click", startBatchDownload);

async function startBatchDownload() {
  if($('downloadUseProject').checked&&!window.ContentLabProject?.root){alert('Selecione um projeto ou desmarque a opção de guardar nos assets.');return;}
  const mode = selectedMode();
  const payload = {
    url: activeSourceUrl(),
    mode,
    transcript_model: $("transcriptModel").value,
    folder: currentFolder,
    batch_text: $("batchText").value,
    projectRoot:$("downloadUseProject").checked?window.ContentLabProject?.root:null,sourceName:$("downloadSourceName").value.trim(),
  };

  renderBatchValidation([]);
  $("batchDownloadBtn").disabled = true;
  $("progressSection").classList.remove("hidden");
  $("doneRow").classList.add("hidden");
  $("downloadError").classList.add("hidden");
  $("batchItems").classList.add("hidden");
  $("batchItems").innerHTML = "";
  $("progressFill").classList.remove("indet");
  $("progressFill").style.width = "0%";
  $("progressPct").textContent = "0%";
  $("progressMsg").textContent = "Validando lote...";

  try {
    const res = await fetch("/api/batch-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.validation_errors) renderBatchValidation(data.validation_errors);
      throw new Error(data.error || "Erro ao iniciar lote");
    }
    pollProgress(data.job_id, true);
  } catch (err) {
    showDownloadError(err.message);
    updateDownloadBtnState();
  }
}

function renderBatchItems(items) {
  const box = $("batchItems");
  if (!items || !items.length) {
    box.classList.add("hidden");
    return;
  }
  box.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("div");
    row.className = `batch-item ${item.status || "waiting"}`;
    const status = item.status === "done" ? "✓" : item.status === "error" ? "!" : item.status === "running" ? "…" : "•";
    const label = document.createElement("span");
    label.className = "batch-status";
    label.textContent = status;
    const text = document.createElement("span");
    text.className = "batch-item-text";
    text.textContent = item.error ? `${item.title} — ${item.error}` : item.title;
    row.append(label, text);
    box.appendChild(row);
  }
  box.classList.remove("hidden");
}


// ---------- download ----------
$("downloadBtn").addEventListener("click", startDownload);

async function startDownload() {
  if($('downloadUseProject').checked&&!window.ContentLabProject?.root){alert('Selecione um projeto ou desmarque a opção de guardar nos assets.');return;}
  const full = $("fullToggle").checked;
  const mode = selectedMode();

  const payload = {
    url: activeSourceUrl(),
    mode,
    transcript_model: $("transcriptModel").value,
    full,
    folder: currentFolder,
    filename: $("fileName").value.trim(),
    projectRoot:$("downloadUseProject").checked?window.ContentLabProject?.root:null,sourceName:$("downloadSourceName").value.trim(),
    start: full ? null : parseFloat($("startRange").value),
    end: full ? null : parseFloat($("endRange").value),
  };

  $("downloadBtn").disabled = true;
  $("progressSection").classList.remove("hidden");
  $("doneRow").classList.add("hidden");
  $("downloadError").classList.add("hidden");
  $("progressFill").classList.remove("indet");
  $("progressFill").style.width = "0%";
  $("progressPct").textContent = "0%";
  $("progressMsg").textContent = "Iniciando...";

  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Erro ao iniciar download");

    pollProgress(data.job_id);
  } catch (err) {
    showDownloadError(err.message);
  }
}

function pollProgress(jobId, isBatch = false) {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/progress/${jobId}`);
    const job = await res.json();

    if (job.error && job.status !== "error") {
      clearInterval(interval);
      showDownloadError(job.error);
      return;
    }

    if (job.indeterminate) {
      $("progressFill").classList.add("indet");
      $("progressFill").style.width = "100%";
      $("progressPct").textContent = "—";
    } else {
      $("progressFill").classList.remove("indet");
      $("progressFill").style.width = (job.percent || 0) + "%";
      $("progressPct").textContent = (job.percent || 0) + "%";
    }
    $("progressMsg").textContent = job.message || "";
    if (isBatch) renderBatchItems(job.items || []);

    if (job.status === "done" || job.status === "done_with_errors") {
      clearInterval(interval);
      $("progressMsg").textContent = job.status === "done_with_errors" ? "Lote concluído com erros" : "Concluído";
      $("doneFile").textContent = isBatch ? `${(job.filepaths || []).length} arquivo(s) gerado(s)` : (job.filepath || "");
      $("doneRow").classList.remove("hidden");
      updateDownloadBtnState();
      window._lastFolder = job.folder;
    } else if (job.status === "error") {
      clearInterval(interval);
      showDownloadError(job.error || "Erro desconhecido");
    }
  }, 800);
}

function showDownloadError(msg) {
  $("downloadError").textContent = msg;
  $("downloadError").classList.remove("hidden");
  updateDownloadBtnState();
}

$("openFolderBtn").addEventListener("click", async () => {
  if (!window._lastFolder) return;
  await fetch("/api/open-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: window._lastFolder }),
  });
});

$("newDownloadBtn").addEventListener("click", () => {
  $("progressSection").classList.add("hidden");
  resetBatchDraft();
  $("url").focus();
});

updateModeUI();

// ---------- encerrar aplicativo ----------
async function requestShutdown(force = false) {
  const btn = $("shutdownBtn");
  btn.disabled = true;
  btn.textContent = "Encerrando...";

  try {
    const res = await fetch("/api/shutdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    const data = await res.json();

    if (res.status === 409 && data.requires_force) {
      btn.disabled = false;
      btn.textContent = "Encerrar";
      const ok = window.confirm(
        `Há ${data.active_jobs || 1} download/corte em andamento. Encerrar agora pode interromper o arquivo. Deseja encerrar mesmo assim?`
      );
      if (ok) return requestShutdown(true);
      return;
    }

    if (!res.ok || data.error) throw new Error(data.error || "Não foi possível encerrar.");

    $("shutdownScreen").classList.remove("hidden");
    // window.close() pode ser bloqueado pelo navegador; o processo do DengsClip
    // já será finalizado pelo servidor. A mensagem permanece caso a aba fique aberta.
    setTimeout(() => {
      try { window.close(); } catch (_) {}
    }, 250);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Encerrar";
    alert(err.message || "Não foi possível encerrar o Content Lab.");
  }
}

$("shutdownBtn").addEventListener("click", () => {
  requestShutdown(false);
});

// ---------- transcrição de narração do projeto ----------
let latestVoiceJobId = null;
function updateVoiceAudioPreview(){
  if(!latestVoiceJobId)return;
  const audio=$("transcriptionAudio");
  const wasPlaying=!audio.paused;
  audio.pause();
  audio.src="/api/transcription/jobs/"+encodeURIComponent(latestVoiceJobId)+
    "/audio?variant="+encodeURIComponent($("transcriptionListenVersion").value);
  audio.load();
  if(wasPlaying)audio.play().catch(()=>{});
}
$("transcriptionListenVersion").addEventListener("change",updateVoiceAudioPreview);
let transcriptionPoll = null;
let lastTranscriptionFolder = null;
function transcriptionError(message) {
  $("transcriptionError").textContent = message || "";
  $("transcriptionError").classList.toggle("hidden", !message);
}
$("transcriptionChooseFolder").addEventListener("click", async () => {
  transcriptionError("");
  try {
    const response = await fetch("/api/choose-folder", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível abrir o seletor de pastas.");
    if (data.folder) {$("transcriptionProjectRoot").value = data.folder;$("transcriptionProjectRoot").dispatchEvent(new Event("change"));}
  } catch (_) {
    transcriptionError("Não foi possível abrir o seletor visual. Você também pode digitar o caminho da pasta no campo ao lado.");
  }
});
$("transcriptionUseEditorProject").addEventListener("click", () => {
  const root = editorProject?.projectRoot || $("editorProjectRoot").value.trim();
  if (!root) return transcriptionError("Não há pasta informada no editor. Use Escolher pasta ou digite o caminho acima.");
  $("transcriptionProjectRoot").value = root;
  $("transcriptionProjectRoot").dispatchEvent(new Event("change"));
  transcriptionError("");
});
$("transcriptionOpenFolder").addEventListener("click", async () => {
  if (!lastTranscriptionFolder) return;
  try {
    const response = await fetch("/api/open-folder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: lastTranscriptionFolder }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível abrir a pasta.");
  } catch (error) { transcriptionError(error.message); }
});
function updateTranscriptionScope(){
  const avulso=$('transcriptionScope').value==='standalone';
  for(const node of document.querySelectorAll('#panel-transcription .voice-treatment-step, #voiceEnhancementSettings, #panel-transcription .voice-studio-options'))node.classList.toggle('hidden',avulso);
  $('transcriptionStart').textContent=avulso?'Transcrever arquivo avulso':'Tratar e transcrever narração oficial';
  $('transcriptionFile').parentElement.querySelector('.helper-text').textContent=avulso?'Obrigatório: áudio do computador. Não substitui arquivos do projeto.':'Selecione outro áudio ou deixe vazio para tratar a narração atual do projeto.';
}
$('transcriptionScope').addEventListener('change',updateTranscriptionScope);updateTranscriptionScope();
// Preferências locais: sem dados salvos, prevalecem os padrões do formulário.
const audioTreatmentStorageKey='contentlab.audio-treatment.settings.v1';
const audioTreatmentIds=['voiceTreatmentRecipe','transcriptionTrimEdges','transcriptionRemoveMiddle','transcriptionMinSilence','transcriptionThreshold','transcriptionNormalize','transcriptionTargetLufs','transcriptionHighpass','transcriptionCompression','transcriptionDeesser','transcriptionVoicePreset','transcriptionReduceBreaths','transcriptionBreathStrength','voiceEnhancementEngine','voiceEnhancementMode','voiceEnhancementStrength'];
function audioTreatmentSnapshot(){
  const controls={};
  for(const id of audioTreatmentIds){const node=$(id);controls[id]=node.type==='checkbox'?node.checked:String(node.value);}
  return controls;
}
function applyAudioTreatmentSettings(stored){
  if(stored?.version!==1||!stored.controls||typeof stored.controls!=='object')return;
  for(const id of audioTreatmentIds){
    const node=$(id),value=stored.controls[id];
    if(node.type==='checkbox'){if(typeof value==='boolean')node.checked=value;}
    else if(typeof value==='string'){
      if(node.tagName==='SELECT'&&![...node.options].some(option=>option.value===value))continue;
      if(node.type==='number'||node.type==='range'){
        const number=Number(value);
        if(!Number.isFinite(number)||(node.min!==''&&number<Number(node.min))||(node.max!==''&&number>Number(node.max)))continue;
      }
      node.value=value;
    }
  }
}
async function restoreAudioTreatmentSettings(){
  // Primeiro, aproveite preferências de versões anteriores guardadas no navegador.
  try{const local=window.localStorage?.getItem(audioTreatmentStorageKey);if(local)applyAudioTreatmentSettings(JSON.parse(local));}catch(_){}
  // O arquivo JSON do aplicativo é a fonte principal, inclusive após reiniciar o navegador.
  try{
    const response=await fetch('/api/audio-treatment/preferences');
    if(!response.ok)return;
    const data=await response.json();
    if(data?.controls)applyAudioTreatmentSettings({version:1,controls:data.controls});
  }catch(_){/* Sem arquivo, manter padrões ou preferências legadas válidas. */}
}
function saveAudioTreatmentSettings(){
  try{window.localStorage?.setItem(audioTreatmentStorageKey,JSON.stringify({version:1,controls:audioTreatmentSnapshot()}));}catch(_){}
}
restoreAudioTreatmentSettings();
$("transcriptionStart").addEventListener("click", async () => {
  const root = $("transcriptionProjectRoot").value.trim();
  const file = $("transcriptionFile").files[0];
  const standalone = $("transcriptionScope").value === 'standalone';
  transcriptionError("");
  if (standalone && !file) return transcriptionError("Selecione o áudio para transcrever separadamente.");
  if (!standalone && !root) return transcriptionError("Selecione o projeto no topo para preparar sua narração oficial.");
  if (!standalone && !window.confirm('Isto atualizará a narração e a transcrição oficial deste projeto. Continuar?')) return;
  $("transcriptionStart").disabled = true;
  $("transcriptionResult").classList.add("hidden");
  $("transcriptionStatus").textContent = "Enviando narração...";
  try {
    const form = new FormData();
    form.append("projectRoot", root);
    form.append("scope", standalone ? 'standalone' : 'narration');
    if(!standalone)form.append("audioTreatmentSettings",JSON.stringify(audioTreatmentSnapshot()));
    if (file) form.append("file", file);
    form.append("model", $("transcriptionModel").value);
    form.append("detail", $("transcriptionDetail").value);
    form.append("removeMiddleSilence", String($("transcriptionRemoveMiddle").checked));
    form.append("minSilence", $("transcriptionMinSilence").value);
    form.append("thresholdDb", $("transcriptionThreshold").value);
    form.append("voicePreset", $("transcriptionVoicePreset").value);
    for(const [field,id] of [['trimEdges','transcriptionTrimEdges'],['normalize','transcriptionNormalize'],['compression','transcriptionCompression'],['deesser','transcriptionDeesser']])form.append(field,String($(id).checked));
    form.append('targetLufs',$('transcriptionTargetLufs').value);form.append('highpassHz',$('transcriptionHighpass').value);
    form.append('reduceBreaths',String($('transcriptionReduceBreaths').checked));form.append('breathReductionStrength',$('transcriptionBreathStrength').value);
    form.append("enhancementEngine", $("voiceEnhancementEngine").value);
    form.append("enhancementMode", $("voiceEnhancementMode").value);
    form.append("enhancementStrength", $("voiceEnhancementStrength").value);
    form.append("language", $("transcriptionLanguage").value);
    const response = await fetch("/api/transcription/jobs", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.errors?.map((item) => item.message).join("; ") || data.error || "Falha ao iniciar transcrição.");
    if (transcriptionPoll) clearInterval(transcriptionPoll);
    transcriptionPoll = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/api/transcription/jobs/${data.jobId}`);
        const job = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(job.error || "Transcrição não encontrada.");
        $("transcriptionStatus").textContent = job.message;
        if (job.status === "running") return;
        clearInterval(transcriptionPoll);
        transcriptionPoll = null;
        $("transcriptionStart").disabled = false;
        if (job.status === "error") throw new Error(job.error || "Falha na transcrição.");
        $("transcriptionStats").textContent = `${job.result.segmentCount} trecho(s) · ${job.result.wordCount} palavra(s) · ${job.result.removedCount} silêncio(s) reduzido(s)`;
        $("transcriptionPreview").value = job.result.preview || "Nenhuma fala foi reconhecida. Confira o áudio e tente outro modelo.";
        $("transcriptionPreviewDetail").textContent = job.result.detail === "words" ? "Prévia por palavra — cada linha mostra os tempos reais daquela palavra. O JSON também inclui frases em segments." : "Prévia por trecho — o JSON também mantém os tempos individuais de cada palavra em words.";
        lastTranscriptionFolder = job.projectRoot;
        if(job.scope==='standalone'){
          document.querySelector('#transcriptionResult > .helper-text').textContent='Arquivos salvos: transcript.json, transcript.txt e transcript.srt, na pasta exclusiva indicada abaixo.';
          $("transcriptionResult").classList.remove("hidden");
          $("transcriptionPlanHint").textContent = 'Transcrição avulsa salva em '+job.projectRoot+'. A narração e a transcrição oficial do projeto não foram alteradas.';
          document.querySelector('.voice-studio-compare').classList.add('hidden');
          return;
        }
        saveAudioTreatmentSettings();
        latestVoiceJobId = data.jobId;
        document.querySelector('#transcriptionResult > .helper-text').textContent='Narração e transcrição oficiais salvas no projeto: audio/narration.wav, audio/narration.prepared.wav e transcript.json/TXT/SRT.';
        document.querySelector('.voice-studio-compare').classList.remove('hidden');
        $("transcriptionListenVersion").value = "styled";
        updateVoiceAudioPreview();
        $("transcriptionResult").classList.remove("hidden");
        if (editorProject?.projectRoot === job.projectRoot) {
          try {
            const plan = JSON.parse($("editorPlanText").value);
            plan.audio.narration = job.result.narration;
            plan.sources = { ...(plan.sources || {}), transcript: "transcript.json" };
            $("editorPlanText").value = JSON.stringify(plan, null, 2);
            $("editorPlanText").dispatchEvent(new Event("input"));
            $("transcriptionPlanHint").textContent = "O plano aberto no editor foi atualizado com a narração e a transcrição. Revise e salve o JSON antes de renderizar.";
          } catch (_) {
            $("transcriptionPlanHint").textContent = "Abra o editor e defina audio.narration e sources.transcript no plano.";
          }
        } else {
          $("transcriptionPlanHint").textContent = `Ouça a narração e envie transcript.txt ou transcript.json ao ChatGPT. Depois crie edit_plan.json nesta pasta, usando audio.narration = "${job.result.narration}" e sources.transcript = "transcript.json".`;
        }
      } catch (error) {
        if (transcriptionPoll) clearInterval(transcriptionPoll);
        transcriptionPoll = null;
        $("transcriptionStart").disabled = false;
        transcriptionError(error.message);
      }
    }, 1000);
  } catch (error) {
    $("transcriptionStart").disabled = false;
    $("transcriptionStatus").textContent = "";
    transcriptionError(error.message);
  }
});

// ---------- projeto de edição automática ----------
let editorProject = null;
let editorPoll = null;
let editorDirty = false;
let editorRendering = false;
let editorJobId = null;

function editorError(message) {
  $("editorError").textContent = message || "";
  $("editorError").classList.toggle("hidden", !message);
}

function editorBusy(busy) {
  editorRendering = busy;
  const transcriptReady=['ready','external'].includes(editorProject?.transcription?.status);
  const canRender = !!editorProject?.validation?.valid && transcriptReady && !editorDirty && !busy;
  $("editorReuse").disabled = !canRender;
  $("editorRebuild").disabled = !canRender;
  $("editorSave").disabled = !editorProject || !editorDirty || busy;
  $("editorValidate").disabled = !editorProject || busy;
  $("editorLoad").disabled = busy;
  $("editorChooseFolder").disabled = busy;
  $("editorCreate").disabled = busy;
  $("editorGoNarration").disabled = busy;
  $("editorChooseAssets").disabled = busy;
  $("editorInspectAssets").disabled = busy;
  $("editorCancel").classList.toggle("hidden", !busy);
}

function editorList(id, rows) {
  const target = $(id);
  target.replaceChildren();
  for (const row of rows) {
    const item = document.createElement("li");
    item.textContent = row.text;
    if (row.invalid) item.classList.add("editor-invalid");
    target.appendChild(item);
  }
}

function editorShowValidation(validation, draft = false) {
  const problems = (validation.errors || []).map(item => ({ text: `${item.path}: ${item.message}`, invalid: true }));
  for (const item of validation.missingAssets || []) problems.push({ text: `Ausente: ${item.asset} → ${item.path}`, invalid: true });
  for (const item of validation.warnings || []) problems.push({ text: `Aviso (${item.scene || "visual"}): ${item.message}`, invalid: false });
  if (!problems.length) problems.push({ text: "Plano válido; todos os assets foram encontrados.", invalid: false });
  editorList("editorValidation", problems);
  $("editorDraftState").textContent = draft
    ? "Validação do rascunho. Salve para habilitar o render."
    : validation.valid ? "Plano salvo e pronto para renderizar." : "Plano salvo, mas requer correções antes do render.";
}

function editorSetProgress(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  $("editorProgressFill").style.width = `${value}%`;
  $("editorProgressFill").parentElement.setAttribute("aria-valuenow", String(value));
}

async function editorShowProject(data) {
  editorProject = data;
  $("transcriptionProjectRoot").value = data.projectRoot;
  editorDirty = false;
  $("editorProjectName").textContent = data.name;
  const state=data.transcription?.status;
  $("editorTranscriptState").textContent = ({
    ready:'Transcrição sincronizada com a narração preparada.',
    missing:'Transcrição ainda não gerada. Importe a narração para iniciar automaticamente.',
    stale:'Transcrição desatualizada. Atualize após alterar cortes/pausas.',
    external:data.transcription?.kind==='voice-studio'?'Narração e transcrição preparadas na aba Narração.':'Transcrição externa: confira a sincronização manualmente.'
  })[state]||'Transcrição ainda não disponível.';
  $("editorPlanText").value = data.planText;
  try {
    const source = JSON.parse(data.planText).sources?.assets || "assets";
    $("editorAssetFolder").value = `${data.projectRoot}/${source}`;
  } catch (_) { $("editorAssetFolder").value = `${data.projectRoot}/assets`; }
  editorList("editorAssetLibrary", []);
  const validation = data.validation;
  $("editorSummary").textContent = validation.duration === undefined
    ? "O JSON precisa de correções antes do render."
    : `${data.scenes.length} cena(s) · ${validation.duration}s · ${validation.resolution.width}×${validation.resolution.height} · ${validation.fps} FPS`;
  editorList("editorScenes", data.scenes.map(scene => ({ text: `${scene.id}: ${scene.start}s–${scene.end}s · ${scene.elements} elemento(s)` })));
  editorShowValidation(validation);
  const missing = new Set((validation.missingAssets || []).map(item => item.asset));
  const assets = Object.entries(validation.resolvedAssets || {}).map(([uri, path]) => ({ text: `${uri} → ${path}${missing.has(uri) ? " (ausente)" : ""}`, invalid: missing.has(uri) }));
  if (validation.narration) assets.unshift({ text: `Narração → ${validation.narration}${missing.has("audio.narration") ? " (ausente)" : ""}`, invalid: missing.has("audio.narration") });
  editorList("editorAssets", assets.length ? assets : [{ text: "Nenhum asset referenciado." }]);
  if (!validation.valid) editorError("Corrija os erros de validação antes do render.");
  $("editorDetails").classList.remove("hidden");
  editorBusy(false);
  try {
    const res = await fetch("/api/editor/plugins");
    const plugins = await res.json();
    if (!res.ok) throw new Error("Plugins indisponíveis.");
    editorList("editorPlugins", Object.entries(plugins).map(([kind, names]) => ({ text: `${kind}: ${names.join(", ")}` })));
  } catch (error) { editorList("editorPlugins", [{ text: error.message, invalid: true }]); }
  if (window.visualEditor&&editorProject?.projectRoot===data.projectRoot) await window.visualEditor.load(data);
}

$("editorChooseFolder").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/choose-folder", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Não foi possível escolher a pasta.");
    if (data.folder) $("editorProjectRoot").value = data.folder;
  } catch (error) { editorError(error.message); }
});

$("editorCreate").addEventListener("click", async () => {
  editorError("");
  try {
    if(!window.ContentLabProject?.root)throw Error('Selecione o projeto no topo.');
    const res = await fetch("/api/workspace/edit-plan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectRoot:window.ContentLabProject.root, name: $("editorNewName").value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.errors?.map(item => item.message).join("; ") || data.error || "Falha ao criar projeto.");
    $("editorProjectRoot").value = data.projectRoot;
    await editorShowProject(data);
    await window.ContentLabProject.select(data.projectRoot);
    $("editorStatus").textContent = "Projeto criado. Selecione a narração e adicione cenas ao JSON.";
  } catch (error) { editorError(error.message); }
});

$("editorGoNarration").addEventListener("click",()=>{
  $("transcriptionProjectRoot").value = editorProject?.projectRoot || $("editorProjectRoot").value.trim();
  $("tab-transcription").click();
});
$("editorChooseAssets").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/choose-folder", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Não foi possível escolher a pasta.");
    if (data.folder) $("editorAssetFolder").value = data.folder;
  } catch (error) { editorError(error.message); }
});

$("editorInspectAssets").addEventListener("click", async () => {
  if (!editorProject) return;
  editorError("");
  try {
    const res = await fetch("/api/editor/project/assets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectRoot: editorProject.projectRoot, folder: $("editorAssetFolder").value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.errors?.map(item => item.message).join("; ") || data.error || "Pasta inválida.");
    editorList("editorAssetLibrary", data.assets.length ? data.assets.map(item => ({ text: item.uri })) : [{ text: "Pasta vazia." }]);
    if (data.truncated) $("editorStatus").textContent = "Mostrando os primeiros 500 assets.";
    const plan = JSON.parse($("editorPlanText").value);
    plan.sources = plan.sources || {};
    plan.sources.assets = data.relative;
    $("editorPlanText").value = JSON.stringify(plan, null, 2);
    $("editorPlanText").dispatchEvent(new Event("input"));
  } catch (error) { editorError(error.message); }
});

$("editorLoad").addEventListener("click", async () => {
  const requestedRoot=$('editorProjectRoot').value.trim();
  if (editorDirty && !window.confirm("Descartar alterações não salvas no JSON?")) return;
  editorError("");
  $("editorDetails").classList.add("hidden");
  editorProject = null;
  try {
    const res = await fetch("/api/editor/project", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectRoot: $("editorProjectRoot").value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.errors?.map(item => item.message).join("; ") || data.error || "Projeto inválido.");
    if(requestedRoot!==$('editorProjectRoot').value.trim())return;
    await editorShowProject(data);
    $("editorStatus").textContent = "";
    editorSetProgress(0);
    $("editorVideo").classList.add("hidden");
    $("editorVideo").removeAttribute("src");
    $("editorOutput").textContent = "";
    editorList("editorWarnings", []);
  } catch (error) { editorError(error.message); }
});
window.contentlabEditor={
  canLeave:()=>!editorDirty||window.confirm('Há alterações não salvas no editor. Descartá-las para trocar/recarregar o projeto?'),
  apply:async data=>{
    editorProject=null;editorDirty=false;$('editorDetails').classList.add('hidden');$('editorPlanText').value='';
    $('editorLoad').disabled=!data.hasEditPlan;$('editorCreate').disabled=data.hasEditPlan;
    if(data.hasEditPlan)$('editorLoad').click();
    else {$('editorStatus').textContent='Projeto aberto. Adicione edit_plan.json nesta pasta e clique em Recarregar projeto para editar/renderizar.';editorError('');}
  }
};

$("editorPlanText").addEventListener("input", () => {
  editorDirty = true;
  $("editorDraftState").textContent = "Alterações não salvas. Valide e salve antes do render.";
  editorBusy(editorRendering);
  window.visualEditor?.syncFromJson();
});

$("editorValidate").addEventListener("click", async () => {
  editorError("");
  let plan;
  try { plan = JSON.parse($("editorPlanText").value); }
  catch (error) { editorShowValidation({ errors: [{ path: "JSON", message: error.message }] }, true); return; }
  try {
    const res = await fetch("/api/editor/validate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectRoot: editorProject.projectRoot, plan }),
    });
    const validation = await res.json();
    editorShowValidation(validation, true);
    if (!res.ok && !validation.errors && !validation.missingAssets) throw new Error("Falha na validação.");
  } catch (error) { editorError(error.message); }
});

$("editorSave").addEventListener("click", async () => {
  editorError("");
  try {
    const res = await fetch("/api/editor/project/save", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectRoot: editorProject.projectRoot, planText: $("editorPlanText").value, revision: editorProject.revision }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.errors?.map(item => item.message).join("; ") || data.error || "Falha ao salvar.");
    await editorShowProject(data);
    $("editorStatus").textContent = "Plano salvo.";
  } catch (error) { editorError(error.message); }
});

async function startEditorRender(cacheMode = "reuse") {
  if (cacheMode === "rebuild" && !window.confirm("Refazer tudo apagará a pasta output deste projeto, incluindo vídeos de cenas e renders anteriores. Continuar?")) return;
  if (!editorProject || !editorProject.validation.valid || editorDirty) return;
  editorError("");
  editorBusy(true);
  $("editorStatus").textContent = "Iniciando render...";
  editorSetProgress(0);
  editorList("editorWarnings", []);
  $("editorReportDetails").classList.add("hidden");
  $("editorVideo").classList.add("hidden");
  $("editorVideo").removeAttribute("src");
  $("editorOutput").textContent = "";
  try {
    const res = await fetch("/api/editor/render", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectRoot: editorProject.projectRoot, mode: "final", cacheMode, revision: editorProject.revision, hardwareAccel: $("editorGpu").checked }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Não foi possível iniciar o render.");
    editorJobId = data.jobId;
    if (editorPoll) clearInterval(editorPoll);
    editorPoll = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/editor/jobs/${data.jobId}`);
        const job = await statusRes.json();
        if (!statusRes.ok) throw new Error(job.error || "Render não encontrado.");
        $("editorStatus").textContent = `${job.message} ${job.percent || 0}%`;
        editorSetProgress(job.percent);
        if (job.status === "running") return;
        clearInterval(editorPoll);
        editorPoll = null;
        editorJobId = null;
        editorBusy(false);
        if (job.status === "cancelled") {
          $("editorStatus").textContent = "Render cancelado.";
          return;
        }
        if (job.status === "error") {
          const where = job.sceneId ? `Cena: ${job.sceneId}` : job.stage ? `Etapa: ${job.stage}` : "";
          const kind = job.errorType ? `${job.errorType}: ` : "";
          $("editorStatus").textContent = job.message || "Falha no render.";
          const output = $("editorOutput");
          output.replaceChildren();
          if (job.hasErrorLog) {
            output.append(document.createTextNode("Log de erro: "));
            const link = document.createElement("a");
            link.href = `/api/editor/jobs/${data.jobId}/log`;
            link.textContent = job.errorLog || "baixar log";
            link.target = "_blank";
            output.append(link);
          } else if (job.errorLog) {
            output.textContent = `Log: ${job.errorLog}`;
          }
          editorError([where, `${kind}${job.error || "Render falhou."}`].filter(Boolean).join(" — "));
          return;
        }
        $("editorVideo").src = `/api/editor/media/${data.jobId}`;
        $("editorVideo").classList.remove("hidden");
        $("editorOutput").textContent = `Arquivo: ${job.filepath}`;
        $("editorReport").textContent = JSON.stringify(job.report, null, 2);
        if (job.report?.sceneCache?.enabled) {
          const cache = job.report.sceneCache;
          $("editorStatus").textContent = `Render concluído. ${cache.reusedCount} cena(s) reaproveitada(s), ${cache.renderedCount} renderizada(s).`;
        }
        $("editorReportDetails").classList.remove("hidden");
        const warnings = (job.report?.warnings || []).map(item => ({ text: `${item.code || "Aviso"}: ${item.message || item.scene || JSON.stringify(item)}`, invalid: true }));
        editorList("editorWarnings", warnings);
      } catch (error) {
        if (editorPoll) clearInterval(editorPoll);
        editorPoll = null;
        editorJobId = null;
        editorBusy(false);
        editorError(error.message);
      }
    }, 1000);
  } catch (error) {
    editorJobId = null;
    editorBusy(false);
    editorError(error.message);
  }
}

$("editorReuse").addEventListener("click", () => startEditorRender("reuse"));
$("editorRebuild").addEventListener("click", () => startEditorRender("rebuild"));
$("editorCancel").addEventListener("click", async () => {
  if (!editorJobId) return;
  $("editorCancel").disabled = true;
  try {
    const res = await fetch(`/api/editor/jobs/${editorJobId}/cancel`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Não foi possível cancelar.");
    $("editorStatus").textContent = "Cancelando render...";
  } catch (error) { editorError(error.message); }
  finally { $("editorCancel").disabled = false; }
});


// ---------- Multi-editor automático: fila sequencial de projetos distintos ----------
let queuePoll=null;
let queueJobId=null;
let queueRunning=false;
const queuePaths=()=>Array.from(
  new Set($("queueFolders").value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean))
);
function queueError(message){
  $("queueError").textContent=message||"";
  $("queueError").classList.toggle("hidden",!message);
}
function queueCount(){
  const count=queuePaths().length;
  $("queueFolderCount").textContent=count+" "+(count===1?"pasta":"pastas");
}
function queueAddPath(folder){
  const value=String(folder||"").trim();
  if(!value)return;
  const paths=queuePaths();
  if(!paths.includes(value))paths.push(value);
  $("queueFolders").value=paths.join("\n");
  queueCount();
}
function queueBusy(busy){
  queueRunning=busy;
  for(const id of ["queueStart","queueFolders","queueChooseFolder","queueFromEditor",
    "queueCacheMode","queueGpu","queueContinue"])$(id).disabled=busy;
  $("queueCancel").classList.toggle("hidden",!busy);
}
function queueDraw(job){
  const total=job.items.length;
  const done=job.items.filter(item=>!["waiting","running"].includes(item.status)).length;
  const active=job.items.find(item=>item.status==="running");
  const pct=Math.round(job.items.reduce((sum,item)=>
    sum+(item.status==="done"||item.status==="error"||item.status==="cancelled"?100:item.percent||0),0)/Math.max(1,total));
  $("queueProgressFill").style.width=pct+"%";
  $("queueProgressFill").parentElement.setAttribute("aria-valuenow",String(pct));
  const finished=job.status!=="running";
  queueBusy(!finished);
  $("queueStatus").textContent=finished
    ?"Fila encerrada: "+done+"/"+total+" projetos processados ("+job.status+")."
    :"Executando "+(job.currentIndex+1)+"/"+total+": "+(active?.name||"Preparando")+" — "+(active?.message||"");
  const list=$("queueItems");
  list.replaceChildren();
  for(const item of job.items){
    const li=document.createElement("li");
    li.className="queue-item queue-"+item.status;
    const top=document.createElement("div");
    top.className="queue-item-header";
    const title=document.createElement("strong");
    title.textContent=item.name;
    const flag=document.createElement("span");
    flag.className="queue-item-status";
    const names={waiting:"Aguardando",running:"Renderizando",done:"Concluído",error:"Falhou",cancelled:"Cancelado"};
    flag.textContent=names[item.status]||item.status;
    top.append(title,flag);
    const folder=document.createElement("code");
    folder.textContent=item.projectRoot;
    const detail=document.createElement("p");
    detail.textContent=item.error?"Erro: "+item.error:item.filepath?"Arquivo: "+item.filepath:item.message||"";
    const meter=document.createElement("div");
    meter.className="queue-item-meter";
    const bar=document.createElement("span");
    bar.style.width=String(item.percent||0)+"%";
    meter.append(bar);
    li.append(top,folder,detail,meter);
    list.append(li);
  }
}
async function queueFetch(id){
  const res=await fetch("/api/render-queue/"+encodeURIComponent(id));
  const data=await res.json();
  if(!res.ok)throw Error(data.error||"Não foi possível consultar a fila.");
  return data;
}
function queueStopPoll(){
  if(queuePoll!==null){clearInterval(queuePoll);queuePoll=null;}
}
function queueStartPoll(id){
  queueStopPoll();
  queueJobId=id;
  let fetching=false;
  queuePoll=setInterval(async()=>{
    if(fetching)return;
    fetching=true;
    try{
      const job=await queueFetch(id);
      queueDraw(job);
      if(job.status!=="running"){queueStopPoll();queueJobId=null;}
    }catch(e){queueError(e.message);queueStopPoll();}
    finally{fetching=false;}
  },1000);
}
$("queueFolders").addEventListener("input",queueCount);
$("queueChooseFolder").addEventListener("click",async()=>{
  queueError("");
  try{
    const res=await fetch("/api/choose-folder",{method:"POST"});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||"Não foi possível abrir o seletor.");
    queueAddPath(data.folder);
  }catch(e){queueError(e.message);}
});
$("queueFromEditor").addEventListener("click",()=>{
  const folder=editorProject?.projectRoot||$("editorProjectRoot").value.trim();
  if(!folder){queueError("Abra ou informe primeiro uma pasta na aba Editor automático.");return;}
  queueAddPath(folder);queueError("");
});
$("queueStart").addEventListener("click",async()=>{
  queueError("");
  const roots=queuePaths();
  if(roots.length===0){queueError("Informe pelo menos uma pasta de projeto.");return;}
  if(roots.length>40){queueError("O limite é de 40 projetos por fila.");return;}
  const mode=$("queueCacheMode").value;
  if(mode==="rebuild"&&!window.confirm("Refazer tudo apagará o output atual de CADA projeto na fila. Continuar?"))return;
  queueBusy(true);
  $("queueStatus").textContent="Validando projetos e iniciando a fila...";
  try{
    const res=await fetch("/api/render-queue",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({projectRoots:roots,cacheMode:mode,
        hardwareAccel:$("queueGpu").checked,continueOnError:$("queueContinue").checked})
    });
    const data=await res.json();
    if(!res.ok)throw Error(data.error||"Não foi possível iniciar a fila.");
    queueDraw(data);
    queueStartPoll(data.id);
  }catch(e){queueBusy(false);queueError(e.message);$("queueStatus").textContent="Fila não iniciada.";}
});
$("queueCancel").addEventListener("click",async()=>{
  if(!queueJobId)return;
  $("queueCancel").disabled=true;
  try{
    const res=await fetch("/api/render-queue/"+encodeURIComponent(queueJobId)+"/cancel",{method:"POST"});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||"Não foi possível cancelar.");
    $("queueStatus").textContent="Cancelando a fila e o render atual...";
  }catch(e){queueError(e.message);}
  finally{$("queueCancel").disabled=false;}
});
queueCount();
fetch("/api/render-queue/latest").then(res=>res.ok?res.json():null).then(data=>{
  if(!data?.job)return;
  queueDraw(data.job);
  if(data.job.status==="running")queueStartPoll(data.job.id);
}).catch(()=>{});
