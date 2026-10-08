let duration = 0;
let currentFolder = "";
let videoLoaded = false;
let cacheVideos = [];
let selectedCacheEntry = null;
let currentSourceMode = "youtube";
let currentSourceUrl = "";
let currentCacheKey = "";
let sourceRequestId = 0;

const $ = (id) => document.getElementById(id);

// Areas de trabalho isoladas: trocar de aba preserva o trabalho em andamento.
const workspaces = ["videos", "transcription", "editor", "guide"];
function showWorkspace(name) {
  for (const workspace of workspaces) {
    const active = workspace === name;
    const tab = $(`tab-${workspace}`);
    const panel = $(`panel-${workspace}`);
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    panel.hidden = !active;
    panel.classList.toggle("hidden", !active);
  }
  history.replaceState(null, "", `#${name}`);
}
document.querySelectorAll(".workspace-tab").forEach((tab) => {
  tab.addEventListener("click", () => showWorkspace(tab.dataset.workspace));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = workspaces.indexOf(tab.dataset.workspace);
    const next = event.key === "Home" ? 0 : event.key === "End" ? workspaces.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + workspaces.length) % workspaces.length;
    showWorkspace(workspaces[next]);
    $(`tab-${workspaces[next]}`).focus();
  });
});
showWorkspace(workspaces.includes(location.hash.slice(1)) ? location.hash.slice(1) : "videos");

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
  if (currentSourceMode === "cache") return currentSourceUrl || "";
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
    if (currentSourceMode === "cache" && currentCacheKey) loadCachedPreview(currentCacheKey);
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

// ---------- fonte: YouTube ou cache ----------
const sourceModeInputs = document.querySelectorAll('input[name="sourceMode"]');

function updateSourceModeUI() {
  const selected = document.querySelector('input[name="sourceMode"]:checked');
  currentSourceMode = selected ? selected.value : "youtube";
  $("youtubeSourceBlock").classList.toggle("hidden", currentSourceMode !== "youtube");
  $("cacheSourceBlock").classList.toggle("hidden", currentSourceMode !== "cache");
  $("loadError").classList.add("hidden");
  resetLoadedVideo();
  if (currentSourceMode === "cache") refreshCacheList();
}

sourceModeInputs.forEach((el) => el.addEventListener("change", updateSourceModeUI));

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
    $("loadError").textContent = "Cole um link do YouTube.";
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
  $("cacheDetails").textContent = `${durationText} • ${formatBytes(selectedCacheEntry.size_bytes)}${selectedCacheEntry.legacy ? " • cache antigo" : ""}`;
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

$("loadCacheBtn").addEventListener("click", async () => {
  updateCacheSelectionUI();
  if (!selectedCacheEntry) return;
  if (!selectedCacheEntry.url) {
    $("loadError").textContent = "Este cache antigo não possui a URL original salva. Abra a pasta do cache ou carregue o link uma vez para recriar os metadados.";
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
  const ready = videoLoaded && currentFolder;
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
  const mode = selectedMode();
  const payload = {
    url: activeSourceUrl(),
    mode,
    transcript_model: $("transcriptModel").value,
    folder: currentFolder,
    batch_text: $("batchText").value,
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
  const full = $("fullToggle").checked;
  const mode = selectedMode();

  const payload = {
    url: activeSourceUrl(),
    mode,
    transcript_model: $("transcriptModel").value,
    full,
    folder: currentFolder,
    filename: $("fileName").value.trim(),
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
    if (data.folder) $("transcriptionProjectRoot").value = data.folder;
  } catch (_) {
    transcriptionError("Não foi possível abrir o seletor visual. Você também pode digitar o caminho da pasta no campo ao lado.");
  }
});
$("transcriptionUseEditorProject").addEventListener("click", () => {
  const root = editorProject?.projectRoot || $("editorProjectRoot").value.trim();
  if (!root) return transcriptionError("Não há pasta informada no editor. Use Escolher pasta ou digite o caminho acima.");
  $("transcriptionProjectRoot").value = root;
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
$("transcriptionStart").addEventListener("click", async () => {
  const root = $("transcriptionProjectRoot").value.trim();
  const file = $("transcriptionFile").files[0];
  transcriptionError("");
  if (!root || !file) return transcriptionError("Escolha a pasta de destino e selecione a narração.");
  $("transcriptionStart").disabled = true;
  $("transcriptionResult").classList.add("hidden");
  $("transcriptionStatus").textContent = "Enviando narração...";
  try {
    const form = new FormData();
    form.append("projectRoot", root);
    form.append("file", file);
    form.append("model", $("transcriptionModel").value);
    form.append("detail", $("transcriptionDetail").value);
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
        $("transcriptionStats").textContent = `${job.result.segmentCount} trecho(s) · ${job.result.wordCount} palavra(s) · ${job.result.language || "idioma não identificado"}`;
        $("transcriptionPreview").value = job.result.preview || "Nenhuma fala foi reconhecida. Confira o áudio e tente outro modelo.";
        lastTranscriptionFolder = job.projectRoot;
        $("transcriptionResult").classList.remove("hidden");
        if (editorProject?.projectRoot === job.projectRoot) {
          try {
            const plan = JSON.parse($("editorPlanText").value);
            plan.audio.narration = job.narration;
            plan.sources = { ...(plan.sources || {}), transcript: "transcript.json" };
            $("editorPlanText").value = JSON.stringify(plan, null, 2);
            $("editorPlanText").dispatchEvent(new Event("input"));
            $("transcriptionPlanHint").textContent = "O plano aberto no editor foi atualizado com a narração e a transcrição. Revise e salve o JSON antes de renderizar.";
          } catch (_) {
            $("transcriptionPlanHint").textContent = "Abra o editor e defina audio.narration e sources.transcript no plano.";
          }
        } else {
          $("transcriptionPlanHint").textContent = `Agora revise a transcrição e envie transcript.txt ou transcript.json à IA junto com o roteiro e os assets. Depois, salve o plano gerado como edit_plan.json nesta pasta; nele, use audio.narration = "${job.narration}" e sources.transcript = "transcript.json".`;
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
  const canRender = !!editorProject?.validation?.valid && !editorDirty && !busy;
  $("editorPreview").disabled = !canRender;
  $("editorFinal").disabled = !canRender;
  $("editorSave").disabled = !editorProject || !editorDirty || busy;
  $("editorValidate").disabled = !editorProject || busy;
  $("editorLoad").disabled = busy;
  $("editorChooseFolder").disabled = busy;
  $("editorCreate").disabled = busy;
  $("editorChooseNarration").disabled = busy;
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
  if (window.visualEditor) await window.visualEditor.load(data);
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
    const res = await fetch("/api/editor/project/create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentRoot: $("editorProjectRoot").value.trim(), name: $("editorNewName").value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.errors?.map(item => item.message).join("; ") || data.error || "Falha ao criar projeto.");
    $("editorProjectRoot").value = data.projectRoot;
    await editorShowProject(data);
    $("editorStatus").textContent = "Projeto criado. Selecione a narração e adicione cenas ao JSON.";
  } catch (error) { editorError(error.message); }
});

$("editorChooseNarration").addEventListener("click", () => $("editorNarrationFile").click());
$("editorNarrationFile").addEventListener("change", async () => {
  const file = $("editorNarrationFile").files[0];
  if (!file || !editorProject) return;
  editorError("");
  try {
    const plan = JSON.parse($("editorPlanText").value);
    const form = new FormData();
    form.append("projectRoot", editorProject.projectRoot);
    form.append("file", file);
    const res = await fetch("/api/editor/project/narration", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.errors?.map(item => item.message).join("; ") || data.error || "Falha ao importar narração.");
    plan.audio.narration = data.relative;
    $("editorPlanText").value = JSON.stringify(plan, null, 2);
    $("editorPlanText").dispatchEvent(new Event("input"));
    $("editorStatus").textContent = `Narração importada: ${data.relative}. Salve o plano.`;
  } catch (error) { editorError(error.message); }
  finally { $("editorNarrationFile").value = ""; }
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
    const backgrounds = $("motionProjectBackgroundOptions");
    backgrounds.replaceChildren();
    data.assets.filter(item => /\.(png|jpe?g|webp|bmp|mp4|mov|mkv|webm)$/i.test(item.uri)).forEach(item => {
      const option = document.createElement("option");
      option.value = item.uri;
      backgrounds.append(option);
    });
    if (data.truncated) $("editorStatus").textContent = "Mostrando os primeiros 500 assets.";
    const plan = JSON.parse($("editorPlanText").value);
    plan.sources = plan.sources || {};
    plan.sources.assets = data.relative;
    $("editorPlanText").value = JSON.stringify(plan, null, 2);
    $("editorPlanText").dispatchEvent(new Event("input"));
  } catch (error) { editorError(error.message); }
});

$("editorLoad").addEventListener("click", async () => {
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
    await editorShowProject(data);
    $("editorStatus").textContent = "";
    editorSetProgress(0);
    $("editorVideo").classList.add("hidden");
    $("editorVideo").removeAttribute("src");
    $("editorOutput").textContent = "";
    editorList("editorWarnings", []);
  } catch (error) { editorError(error.message); }
});

$("editorPlanText").addEventListener("input", () => {
  editorDirty = true;
  $("editorDraftState").textContent = "Alterações não salvas. Valide e salve antes do render.";
  editorBusy(editorRendering);
  window.visualEditor?.syncFromJson();
});

let builtinBackgroundsLoaded = false;
async function loadBuiltinBackgrounds() {
  if (builtinBackgroundsLoaded) return;
  const response = await fetch("/api/editor/backgrounds");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível listar os backgrounds padrão.");
  const select = $("motionBuiltinBackground");
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione um background";
  select.append(placeholder);
  data.backgrounds.forEach(item => {
    const option = document.createElement("option");
    option.value = item.uri;
    option.textContent = `${item.name} (${item.type === "video" ? "vídeo" : "imagem"})`;
    select.append(option);
  });
  builtinBackgroundsLoaded = true;
}
function updateMotionBackgroundFields() {
  const source = $("motionBackgroundSource").value;
  $("motionColorField").classList.toggle("hidden", source !== "color");
  $("motionBuiltinField").classList.toggle("hidden", source !== "builtin");
  $("motionProjectField").classList.toggle("hidden", source !== "project");
  const uri = source === "builtin" ? $("motionBuiltinBackground").value : $("motionProjectBackground").value.trim();
  $("motionLoopField").classList.toggle("hidden", source === "color" || !/\.(mp4|mov|mkv|webm)$/i.test(uri));
}
$("motionBackgroundSource").addEventListener("change", async () => {
  try {
    if ($("motionBackgroundSource").value === "builtin") await loadBuiltinBackgrounds();
    updateMotionBackgroundFields();
  } catch (error) { editorError(error.message); }
});
$("motionBuiltinBackground").addEventListener("change", updateMotionBackgroundFields);
$("motionProjectBackground").addEventListener("input", updateMotionBackgroundFields);

$("motionAddScene").addEventListener("click", () => {
  editorError("");
  try {
    if (!editorProject) throw new Error("Carregue um projeto antes de criar a cena.");
    const plan = JSON.parse($("editorPlanText").value);
    if (!Array.isArray(plan.timeline)) throw new Error("O JSON precisa ter uma timeline.");
    if (plan.version === "0.1" && plan.timeline.length) {
      throw new Error("Este projeto já tem cenas 0.1. Crie outro projeto para usar cenas motion 0.2 sem alterar as cenas existentes.");
    }
    if (!["0.1", "0.2"].includes(plan.version)) throw new Error("Versão do JSON não suportada.");
    const leftAsset = $("motionLeftAsset").value.trim();
    const rightAsset = $("motionRightAsset").value.trim();
    const backgroundSource = $("motionBackgroundSource").value;
    const backgroundValue = backgroundSource === "color" ? $("motionBackground").value.trim() : backgroundSource === "builtin" ? $("motionBuiltinBackground").value : $("motionProjectBackground").value.trim();
    const duration = Number($("motionDuration").value);
    const delay = Number($("motionDelay").value);
    const scale = Number($("motionScale").value) / 100;
    if (!leftAsset || !rightAsset || !backgroundValue) throw new Error("Informe o fundo e os dois assets.");
    if (backgroundSource === "color" && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(backgroundValue)) throw new Error("Informe a cor como #RGB ou #RRGGBB.");
    if (backgroundSource === "project" && !backgroundValue.startsWith("project://")) throw new Error("O fundo próprio precisa começar com project://.");
    if (backgroundSource === "builtin" && !backgroundValue.startsWith("builtin://backgrounds/")) throw new Error("Selecione um background padrão da lista.");
    if (!(duration > 0) || !(delay >= 0 && delay < duration) || !(scale > 0 && scale <= 8)) {
      throw new Error("Confira duração, atraso e tamanho (até 800%).");
    }
    const start = plan.timeline.length ? Math.max(...plan.timeline.map(scene => Number(scene.end))) : 0;
    const end = Number((start + duration).toFixed(3));
    let idNumber = plan.timeline.length + 1;
    while (plan.timeline.some(scene => scene.id === `motion-${idNumber}`)) idNumber += 1;
    const background = backgroundSource === "color" ? { color: backgroundValue } : { asset: backgroundValue, fit: "cover" };
    if (background.asset && /\.(mp4|mov|mkv|webm)$/i.test(backgroundValue)) background.loop = $("motionBackgroundLoop").checked;
    plan.version = "0.2";
    plan.timeline.push({
      id: `motion-${idNumber}`, start, end, layout: "3x3", background,
      elements: [
        { id: `motion-${idNumber}-left`, type: "image", asset: leftAsset, cells: [1, 4, 7], fit: "contain", start, end, z: 10, transform: { scale }, animation: { enter: "slide_from_left", idle: "none", exit: "cut" } },
        { id: `motion-${idNumber}-right`, type: "image", asset: rightAsset, cells: [3, 6, 9], fit: "contain", start: Number((start + delay).toFixed(3)), end, z: 20, transform: { scale }, animation: { enter: "slide_from_right", idle: "none", exit: "cut" } },
      ], transitionOut: "cut",
    });
    $("editorPlanText").value = JSON.stringify(plan, null, 2);
    $("editorPlanText").dispatchEvent(new Event("input"));
    $("editorStatus").textContent = "Cena motion adicionada ao rascunho. Valide e salve o JSON antes do preview.";
  } catch (error) { editorError(error.message); }
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

async function startEditorRender(mode) {
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
      body: JSON.stringify({ projectRoot: editorProject.projectRoot, mode, revision: editorProject.revision, hardwareAccel: $("editorGpu").checked }),
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
        if (job.status === "error") throw new Error(job.error || "Render falhou.");
        $("editorVideo").src = `/api/editor/media/${data.jobId}`;
        $("editorVideo").classList.remove("hidden");
        $("editorOutput").textContent = `Arquivo: ${job.filepath}`;
        $("editorReport").textContent = JSON.stringify(job.report, null, 2);
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

$("editorPreview").addEventListener("click", () => startEditorRender("preview"));
$("editorFinal").addEventListener("click", () => startEditorRender("final"));
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
