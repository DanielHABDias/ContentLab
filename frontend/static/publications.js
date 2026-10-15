/* Publicações — UI local de preparação. Nenhuma chamada de API ou envio é feita aqui. */
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const fileInput = byId("publishFiles");
  if (!fileInput) return;

  const list = byId("publishVideoList");
  const videoPlayer = byId("publishPreviewVideo");
  const titleInput = byId("publishTitle");
  const descriptionInput = byId("publishDescription");
  const coverTime = byId("publishCoverTime");
  const coverTimeLabel = byId("publishCoverTimeLabel");
  const coverFileInput = byId("publishCoverFile");
  const coverImage = byId("publishCoverImage");
  const removeCover = byId("publishRemoveCover");
  const startDate = byId("publishStartDate");
  const startTime = byId("publishStartTime");
  const networks = ["youtube", "instagram", "tiktok"];
  let videos = [];
  let activeId = null;
  let nextId = 1;

  const current = () => videos.find((item) => item.id === activeId);
  const selected = () => videos.filter((item) => item.selected);
  const platformEnabled = (name) => byId("publishPlatform-" + name).checked;
  const replaceShorts = (value) => value.replace(/#shorts\b/gi, "#Viral");
  const socialText = (item) => replaceShorts([item.title.trim(), item.description.trim()].filter(Boolean).join("\n\n"));
  const secondsLabel = (seconds) => {
    const amount = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
    return String(Math.floor(amount / 60000)).padStart(2, "0") + ":" +
      String(Math.floor((amount % 60000) / 1000)).padStart(2, "0") + "." +
      String(amount % 1000).padStart(3, "0");
  };
  const localDate = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
  const dateAtIndex = (index) => {
    const parts = startDate.value.split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !part)) return "Definir data";
    const day = new Date(parts[0], parts[1] - 1, parts[2] + index, 12);
    return day.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit", year: "numeric"});
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  startDate.value = localDate(tomorrow);

  function clearVideoUrls() {
    for (const item of videos) {
      URL.revokeObjectURL(item.url);
      if (item.coverUrl) URL.revokeObjectURL(item.coverUrl);
    }
  }

  function renderList() {
    list.replaceChildren();
    byId("publishVideoCount").textContent = selected().length + " selecionado(s)";
    if (!videos.length) {
      const empty = document.createElement("div");
      empty.className = "publish-empty";
      empty.textContent = "Nenhum MP4 selecionado. Escolha arquivos finalizados do computador para testar a interface. Os vídeos não são enviados.";
      list.append(empty);
      return;
    }
    videos.forEach((item) => {
      const row = document.createElement("div");
      row.className = "publish-video-row" + (item.id === activeId ? " is-current" : "");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.selected;
      checkbox.setAttribute("aria-label", "Incluir " + item.file.name);
      checkbox.addEventListener("change", () => {
        item.selected = checkbox.checked;
        renderList();
        renderSchedule();
      });
      const button = document.createElement("button");
      button.className = "publish-video-pick";
      button.type = "button";
      button.setAttribute("aria-pressed", String(item.id === activeId));
      const name = document.createElement("strong");
      name.textContent = item.file.name;
      const size = document.createElement("small");
      size.textContent = (item.file.size / (1024 * 1024)).toFixed(1) + " MB · Editar informações";
      button.append(name, size);
      button.addEventListener("click", () => {
        activeId = item.id;
        renderList();
        renderEditor();
      });
      row.append(checkbox, button);
      list.append(row);
    });
  }

  function renderEditor() {
    const item = current();
    byId("publishEditorFields").disabled = !item;
    byId("publishCurrentVideo").textContent = item ? item.file.name : "Escolha um vídeo";
    titleInput.value = item ? item.title : "";
    descriptionInput.value = item ? item.description : "";
    coverFileInput.value = "";
    removeCover.hidden = !(item && item.coverUrl);
    coverImage.hidden = !(item && item.coverUrl);
    if (item && item.coverUrl) coverImage.src = item.coverUrl;
    else coverImage.removeAttribute("src");
    videoPlayer.pause();
    videoPlayer.removeAttribute("src");
    videoPlayer.load();
    coverTime.value = item ? item.coverTime : 0;
    coverTime.max = item && item.duration ? item.duration : 30;
    coverTimeLabel.textContent = secondsLabel(item ? item.coverTime : 0);
    if (item) {
      videoPlayer.src = item.url;
      videoPlayer.load();
    }
    renderPreviews();
  }

  function renderPreviews() {
    const item = current();
    byId("publishYoutubeTitle").textContent = item && item.title.trim() || "Título do Short";
    byId("publishYoutubeDescription").textContent = item && item.description.trim() || "Descrição do vídeo";
    const social = item ? socialText(item) : "Título do Short\n\nDescrição do vídeo";
    byId("publishInstagramText").textContent = social;
    byId("publishTiktokText").textContent = social;
    for (const name of networks) {
      byId("publishPreview-" + name).hidden = !platformEnabled(name);
    }
  }

  function renderSchedule() {
    const items = selected();
    const schedule = byId("publishScheduleList");
    const youtube = platformEnabled("youtube");
    const enabled = networks.filter(platformEnabled);
    schedule.replaceChildren();
    byId("publishQueueSummary").textContent = items.length + " vídeo(s) · " +
      (items.length * enabled.length) + " destino(s)";
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "publish-empty";
      empty.textContent = "Selecione vídeos para visualizar o planejamento.";
      schedule.append(empty);
    }
    items.forEach((item, index) => {
      const row = document.createElement("li");
      row.className = "publish-schedule-row";
      const name = document.createElement("span");
      name.textContent = item.file.name;
      const date = document.createElement("span");
      date.textContent = youtube ? (dateAtIndex(index) + " · " + startTime.value) : "Sem YouTube";
      row.append(name, date);
      schedule.append(row);
    });
    byId("publishImmediateNotice").textContent =
      enabled.filter((name) => name !== "youtube").length
        ? "Instagram/TikTok: envio imediato quando a integração estiver disponível. As datas acima se aplicam somente ao YouTube."
        : "As datas acima se aplicam somente ao YouTube.";
  }

  fileInput.addEventListener("change", () => {
    videoPlayer.pause();
    videoPlayer.removeAttribute("src");
    videoPlayer.load();
    clearVideoUrls();
    videos = [...fileInput.files].filter((file) => file.type === "video/mp4" || /\.mp4$/i.test(file.name))
      .map((file) => ({
        id: nextId++, file, url: URL.createObjectURL(file), title: "",
        description: "", coverTime: 0, duration: 0, coverUrl: null, selected: true
      }));
    activeId = videos[0] ? videos[0].id : null;
    renderList();
    renderEditor();
    renderSchedule();
  });

  titleInput.addEventListener("input", () => {
    const item = current();
    if (item) item.title = titleInput.value;
    renderPreviews();
  });
  descriptionInput.addEventListener("input", () => {
    const item = current();
    if (item) item.description = descriptionInput.value;
    renderPreviews();
  });
  coverTime.addEventListener("input", () => {
    const item = current();
    if (!item) return;
    item.coverTime = Number(coverTime.value) || 0;
    coverTimeLabel.textContent = secondsLabel(item.coverTime);
    if (videoPlayer.readyState >= 1) videoPlayer.currentTime = item.coverTime;
  });
  videoPlayer.addEventListener("loadedmetadata", () => {
    const item = current();
    if (!item || videoPlayer.src !== item.url) return;
    item.duration = Number.isFinite(videoPlayer.duration) ? videoPlayer.duration : 30;
    coverTime.max = Math.max(0, item.duration);
    coverTime.value = Math.min(item.coverTime, item.duration);
    videoPlayer.currentTime = Number(coverTime.value);
  });
  coverFileInput.addEventListener("change", () => {
    const item = current();
    if (!item) return;
    if (item.coverUrl) URL.revokeObjectURL(item.coverUrl);
    item.coverUrl = coverFileInput.files[0] ? URL.createObjectURL(coverFileInput.files[0]) : null;
    coverImage.hidden = !item.coverUrl;
    removeCover.hidden = !item.coverUrl;
    if (item.coverUrl) coverImage.src = item.coverUrl;
    else coverImage.removeAttribute("src");
  });
  removeCover.addEventListener("click", () => {
    const item = current();
    if (!item) return;
    if (item.coverUrl) URL.revokeObjectURL(item.coverUrl);
    item.coverUrl = null;
    coverFileInput.value = "";
    coverImage.hidden = true;
    removeCover.hidden = true;
    coverImage.removeAttribute("src");
  });
  byId("publishSelectAll").addEventListener("click", () => {
    videos.forEach((item) => { item.selected = true; });
    renderList();
    renderSchedule();
  });
  byId("publishSelectNone").addEventListener("click", () => {
    videos.forEach((item) => { item.selected = false; });
    renderList();
    renderSchedule();
  });
  for (const name of networks) {
    byId("publishPlatform-" + name).addEventListener("change", () => {
      renderPreviews();
      renderSchedule();
    });
  }
  startDate.addEventListener("change", renderSchedule);
  startTime.addEventListener("change", renderSchedule);
  window.addEventListener("beforeunload", clearVideoUrls, {once: true});
  renderList();
  renderEditor();
  renderSchedule();
})();
