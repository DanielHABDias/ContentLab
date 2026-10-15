/* Content Lab Publications — official API submission; each upload requires user consent. */
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
  const formatSelect=byId("publishFormat");
  const tiktokInput=byId("publishPlatform-tiktok");
  const sendButton=byId("publishSubmit");
  let busy=false;
  let privacyLevels=[];
  let videos = [];
  let activeId = null;
  let nextId = 1;

  const current = () => videos.find((item) => item.id === activeId);
  const selected = () => videos.filter((item) => item.selected);
  const platformEnabled = (name) => byId("publishPlatform-" + name).checked;
  const targetsFor=(item)=>networks.filter(name=>platformEnabled(name)&&(name!=="tiktok"||item.format==="9:16"));
  function syncFormat(){
    const item=current();
    const blocked=!!item&&item.format==="16:9";
    tiktokInput.disabled=blocked||busy;
    const choice=byId("publishTiktokChoice");
    choice.classList.toggle("is-unavailable",blocked);
    choice.title=blocked?"TikTok não recebe este vídeo horizontal 16:9":"TikTok disponível para 9:16";
    byId("publishTiktokUnavailable").textContent=blocked
      ?"TikTok indisponível para este vídeo 16:9. YouTube e Instagram continuam disponíveis."
      :"TikTok permitido para 9:16. Vídeos horizontais na fila serão pulados nessa plataforma.";
  }
  function updateSubmit(){
    sendButton.disabled=busy||selected().length===0||!networks.some(platformEnabled);
  }
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
    updateSubmit();
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
        syncFormat();
      });
      const button = document.createElement("button");
      button.className = "publish-video-pick";
      button.type = "button";
      button.setAttribute("aria-pressed", String(item.id === activeId));
      const name = document.createElement("strong");
      name.textContent = item.file.name;
      const size = document.createElement("small");
      size.textContent = (item.file.size / (1024 * 1024)).toFixed(1) + " MB · "+(item.width?item.width+"×"+item.height:"Formato a verificar")+" · Editar informações";
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
    formatSelect.value=item ? item.format : "9:16";
    byId("publishFormatHint").textContent=item&&item.width
      ?"MP4 detectado: "+item.width+"×"+item.height+". O servidor também conferirá esse formato."
      :"O formato será conferido no arquivo pelo servidor antes de enviar.";
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
    syncFormat();
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
      byId("publishPreview-" + name).hidden = !platformEnabled(name)||(name==="tiktok"&&item?.format==="16:9");
    }
  }

  function renderSchedule() {
    const items = selected();
    const schedule = byId("publishScheduleList");
    const youtube = platformEnabled("youtube");
    const enabled = networks.filter(platformEnabled);
    const total=items.reduce((n,item)=>n+targetsFor(item).length,0);
    schedule.replaceChildren();
    byId("publishQueueSummary").textContent = items.length + " vídeo(s) · " +
      total + " destino(s)";
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
      date.textContent = (youtube?dateAtIndex(index)+" · "+startTime.value:"Sem YouTube")+" · "+item.format+" · "+targetsFor(item).join(", ");
      row.append(name, date);
      schedule.append(row);
    });
    updateSubmit();
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
        description: "", coverTime: 0, duration: 0, coverUrl: null, selected: true,
        format:"9:16",width:0,height:0
      }));
    videos.forEach(item=>{
      const probe=document.createElement("video");
      probe.preload="metadata";
      probe.onloadedmetadata=()=>{
        item.width=probe.videoWidth;item.height=probe.videoHeight;
        item.format=item.width>item.height?"16:9":"9:16";
        if(item.id===activeId){formatSelect.value=item.format;syncFormat();
          byId("publishFormatHint").textContent="MP4: "+item.width+"×"+item.height;
          renderPreviews();}
        renderList();renderSchedule();probe.removeAttribute("src");probe.load();
      };
      probe.onerror=()=>{probe.removeAttribute("src");probe.load();};
      probe.src=item.url;
    });
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
  formatSelect.addEventListener("change",()=>{
    const item=current();
    if(item)item.format=formatSelect.value;
    syncFormat();renderList();renderPreviews();renderSchedule();
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
      syncFormat();renderPreviews();renderSchedule();
    });
  }
  startDate.addEventListener("change", renderSchedule);
  startTime.addEventListener("change", renderSchedule);

  byId("publishTikTokLoadPrivacy").addEventListener("click",async()=>{
    const select=byId("publishTikTokPrivacy");
    try{
      const r=await fetch("/api/social/tiktok/creator-info",{cache:"no-store"});
      const data=await r.json();
      if(!r.ok)throw Error(data.error||"Não foi possível consultar o TikTok.");
      privacyLevels=data.privacyOptions;
      select.replaceChildren(new Option("Selecione quem pode assistir",""));
      for(const level of privacyLevels){
        const name={
          PUBLIC_TO_EVERYONE:"Público",MUTUAL_FOLLOW_FRIENDS:"Amigos",
          FOLLOWER_OF_CREATOR:"Seguidores",SELF_ONLY:"Somente eu"
        }[level]||level;
        select.add(new Option(name,level));
      }
      byId("publishRunMessage").textContent="TikTok: opções de privacidade da conta carregadas. Escolha uma antes de enviar.";
    }catch(error){byId("publishRunMessage").textContent=error.message;}
  });
  const jobStatus=async(id)=>{
    for(let attempt=0;attempt<900;attempt++){
      await new Promise(resolve=>setTimeout(resolve,1300));
      const res=await fetch("/api/social/jobs/"+encodeURIComponent(id),{cache:"no-store"});
      const body=await res.json();
      if(!res.ok)throw Error(body.error||"Falha ao consultar o envio.");
      if(body.status==="error")throw Error(body.error||body.message);
      if(body.status==="done")return body.result;
    }
    throw Error("O trabalho ainda não concluiu. Confira a plataforma antes de reenviar.");
  };
  const resultRow=(file,platform)=>{
    const el=document.createElement("div");el.className="publish-result-row";
    const label=document.createElement("strong");
    label.textContent=file+" · "+platform;
    const status=document.createElement("span");status.textContent="Preparando...";
    el.append(label,status);byId("publishSendResults").append(el);
    return status;
  };
  sendButton.addEventListener("click",async()=>{
    if(busy)return;
    const items=selected(),chosen=items.flatMap(item=>targetsFor(item).map(platform=>({item,platform})));
    if(!chosen.length)return;
    if(!byId("publishRights").checked){
      byId("publishRunMessage").textContent="Confirme os direitos dos vídeos e a autorização de envio.";
      return;
    }
    if(chosen.some(row=>row.platform==="youtube")&&!byId("publishMadeForKids").value){
      byId("publishRunMessage").textContent="Informe se o vídeo é destinado a crianças antes de usar o YouTube.";
      return;
    }
    if(chosen.some(row=>row.platform==="tiktok")&&!privacyLevels.includes(byId("publishTikTokPrivacy").value)){
      byId("publishRunMessage").textContent="Consulte a conta TikTok e selecione a privacidade permitida.";
      return;
    }
    const plan=chosen.map(({item,platform})=>item.file.name+" → "+platform).join("\n");
    if(!window.confirm("Enviar "+chosen.length+" publicação(ões) usando as contas conectadas?\n\n"+plan))return;
    busy=true;updateSubmit();
    byId("publishSendResults").replaceChildren();
    let success=0,failed=0;
    // Congela destinos/metadados que foram exibidos na confirmação.
    const ordered=items.map(item=>({
      ...item,platforms:targetsFor(item),file:item.file
    }));
    for(let i=0;i<ordered.length;i++){
      const item=ordered[i];
      const platforms=item.platforms;
      const parts=startDate.value.split("-").map(Number);
      const hours=startTime.value.split(":").map(Number);
      const when=new Date(parts[0],parts[1]-1,parts[2]+i,hours[0],hours[1],0);
      for(const platform of platforms){
        const status=resultRow(item.file.name,platform);
        try{
          const data=new FormData();
          data.set("file",item.file,item.file.name);
          data.set("platform",platform);
          data.set("format",item.format);
          data.set("title",item.title);
          data.set("description",item.description);
          data.set("coverTime",String(item.coverTime));
          data.set("madeForKids",byId("publishMadeForKids").value);
          data.set("scheduledAt",when.toISOString());
          data.set("privacyLevel",byId("publishTikTokPrivacy").value);
          data.set("confirmRights",byId("publishRights").checked?"true":"false");
          status.textContent="Enviando para o servidor...";
          const response=await fetch("/api/social/publish",{method:"POST",body:data});
          const received=await response.json();
          if(!response.ok)throw Error(received.error||"Falha ao iniciar upload.");
          status.textContent="Enviando à plataforma...";
          const result=await jobStatus(received.jobId);
          if(result?.url){
            const link=document.createElement("a");link.href=result.url;link.target="_blank";
            link.rel="noopener noreferrer";link.textContent="Ver no YouTube";
            status.replaceChildren(document.createTextNode("Agendado · "),link);
          }else if(result?.state==="processing"){
            status.textContent="Enviado; TikTok está processando...";
            // Estado final pode demorar por moderação. Não reenviar automaticamente.
            const jobId=received.jobId;
            (async()=>{
              for(let attempt=0;attempt<90;attempt++){
                await new Promise(resolve=>setTimeout(resolve,10000));
                const reply=await fetch("/api/social/jobs/"+encodeURIComponent(jobId),{cache:"no-store"});
                if(!reply.ok)break;
                const outcome=await reply.json();
                if(outcome.status==="error"){
                  status.textContent="TikTok: "+(outcome.error||"publicação recusada");
                  status.classList.add("publish-result-error");break;
                }
                if(outcome.result?.state==="published"){
                  status.textContent="Publicado no TikTok";break;
                }
              }
            })().catch(()=>{status.textContent="TikTok: verifique a publicação no aplicativo.";});
          }else status.textContent=result?.state==="published"?"Publicado":"Enviado";
          success++;
        }catch(error){failed++;status.textContent="Falha: "+error.message;status.classList.add("publish-result-error");}
      }
    }
    busy=false;updateSubmit();
    byId("publishRunMessage").textContent="Lote concluído: "+success+" envio(s) aceito(s), "+failed+
      " falha(s). Confira o processamento final nas plataformas antes de reenviar qualquer vídeo.";
  });

  window.addEventListener("beforeunload", clearVideoUrls, {once: true});
  renderList();
  renderEditor();
  renderSchedule();
})();
