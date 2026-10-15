/* Gerencia apenas o OAuth oficial. Senhas e tokens nunca ficam no JavaScript. */
(() => {
  "use strict";
  const $=(id)=>document.getElementById(id);
  const providers=["youtube","instagram","tiktok"];
  const names={youtube:"YouTube",instagram:"Instagram",tiktok:"TikTok"};
  const buttons=Object.fromEntries(providers.map(p=>[p,$("socialConnect-"+p)]));
  if(!buttons.youtube)return;
  let statuses={};

  function notice(message,error=false) {
    const target=$("socialAuthMessage");
    target.textContent=message;
    target.classList.toggle("social-auth-error",!!error);
  }

  async function request(url,options) {
    const response=await fetch(url,{cache:"no-store",...options});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||"Falha na comunicação com o servidor local.");
    return result;
  }

  function updateProviderForm() {
    const provider=$("socialProvider").value;
    $("socialInstagramRedirectField").hidden=provider!=="instagram";
    $("socialRedirectHint").textContent=provider==="instagram"
      ? "A Meta exige um callback HTTPS cadastrado no aplicativo, encaminhado para este Content Lab local. Para testes locais, configure um túnel HTTPS seguro."
      : provider==="tiktok"
        ? "TikTok Desktop Login Kit: registre no painel do aplicativo o retorno "+(statuses.tiktok?.redirectUri||"http://127.0.0.1:5000/api/social/oauth/tiktok/callback")+"; solicite os escopos video.publish e video.list para métricas."
        : "Google Cloud: registre no OAuth Client a URI de retorno "+(statuses.youtube?.redirectUri||"http://127.0.0.1:5000/api/social/oauth/youtube/callback")+". Para a aba Métricas, autorize também youtube.readonly.";
    $("socialClientId").value="";
    $("socialClientSecret").value="";
    $("socialInstagramRedirect").value="";
    $("socialClientSecret").required=!statuses[provider]?.configured;
  }

  async function loadStatus() {
    const {providers:info}=await request("/api/social/status");
    statuses=info;
    for(const provider of providers) {
      const state=info[provider];
      const status=$("socialStatus-"+provider);
      const button=buttons[provider];
      status.textContent=state.connected?"Conectado":state.needsRenewal?"Sessão expirada":
        state.configured?"Pronto para login":"Configure o aplicativo";
      button.disabled=!state.configured;
      button.textContent=state.connected?"Reconectar "+names[provider]:"Conectar "+names[provider];
      button.title=state.configured?"Autorizar sua conta no site oficial":"Configure o Client ID e Secret primeiro.";
    }
    updateProviderForm();
  }

  for(const provider of providers) {
    buttons[provider].addEventListener("click",()=>{
      if(!statuses[provider]?.configured)return;
      window.location.assign("/api/social/oauth/"+provider+"/start");
    });
  }

  $("socialProvider").addEventListener("change",updateProviderForm);
  $("socialCredentialsForm").addEventListener("submit",async(event)=>{
    event.preventDefault();
    const provider=$("socialProvider").value;
    const payload={
      clientId:$("socialClientId").value.trim(),
      clientSecret:$("socialClientSecret").value.trim()
    };
    if(provider==="instagram")payload.redirectUri=$("socialInstagramRedirect").value.trim();
    try{
      notice("Salvando credenciais locais...");
      await request("/api/social/configure/"+provider,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      await loadStatus();
      notice("Configuração de "+names[provider]+" salva no .env local. Agora clique em Conectar.");
    }catch(error){notice(error.message,true);}
  });
  $("socialDisconnect").addEventListener("click",async()=>{
    const provider=$("socialProvider").value;
    if(!window.confirm("Remover do computador os tokens de "+names[provider]+"? A autorização no site da plataforma não será revogada."))return;
    try{
      await request("/api/social/disconnect/"+provider,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      await loadStatus();
      notice("Tokens locais de "+names[provider]+" removidos.");
    }catch(error){notice(error.message,true);}
  });

  loadStatus().then(()=>{
    const query=new URLSearchParams(location.search);
    const auth=query.get("authStatus"),provider=query.get("provider")||"";
    if(auth==="connected")notice("Autorização oficial de "+(names[provider]||"conta")+" concluída. Tokens salvos localmente.");
    if(auth==="failed")notice("Não foi possível concluir a autorização de "+(names[provider]||"conta")+". Verifique as permissões e a URI de retorno cadastrada.",true);
    if(auth==="cancelled")notice("Conexão cancelada pela plataforma ou pelo usuário.",true);
    if(auth){
      const clean=location.pathname+(location.hash||"#publications");
      history.replaceState(null,"",clean);
    }else notice("As contas podem ser conectadas. O envio automático continuará indisponível até a próxima etapa.");
  }).catch(error=>notice("Não foi possível carregar as conexões: "+error.message,true));
})();
