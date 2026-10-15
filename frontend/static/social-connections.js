/* Redes sociais: entradas OAuth oficiais e tokens exclusivamente no servidor local. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const providers=['youtube','instagram','tiktok'];
  const names={youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok'};
  const originalLabels={
    youtube:'Conectar com Google',instagram:'Conectar Instagram',tiktok:'Conectar TikTok'
  };
  if(!$('panel-settings'))return;
  let status={};
  const connected=value=>!!(value?.connected||value?.needsRenewal);
  const notice=(message,error=false)=>{
    const target=$('socialAuthMessage');
    target.textContent=message;
    target.classList.toggle('social-auth-error',!!error);
  };
  const navigateToSettings=()=>{
    $('tab-settings').click();
    $('settingsAccountsHeading').scrollIntoView({behavior:'smooth',block:'start'});
  };
  function applyGates(){
    const enabled=providers.some(name=>connected(status[name]));
    $('publishConnectionGate').hidden=enabled;
    $('publishConnectedContent').hidden=!enabled;
    window.dispatchEvent(new CustomEvent('contentlab:social-status',{detail:status}));
  }
  const request=async(url,options={})=>{
    const response=await fetch(url,{cache:'no-store',...options});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(body.error||'Não foi possível acessar o servidor local.');
    return body;
  };
  function updateProviderForm(){
    const provider=$('socialProvider').value;
    $('socialInstagramRedirectField').hidden=provider!=='instagram';
    const configured=!!status[provider]?.configured;
    $('socialClientId').value='';
    $('socialClientSecret').value='';
    $('socialInstagramRedirect').value='';
    $('socialClientId').placeholder=configured?'Já configurado — preencha apenas para trocar':'ID do aplicativo OAuth';
    $('socialClientSecret').placeholder=configured?'Secret já configurado — preencha apenas para trocar':'Secret do aplicativo (não é sua senha)';
    $('socialInstagramRedirect').placeholder=configured?'Retorno HTTPS já configurado':'https://seu-dominio/api/social/oauth/instagram/callback';
    $('socialRedirectHint').textContent=provider==='instagram'
      ? 'A Meta exige uma conta profissional e uma URI HTTPS válida, cadastrada no aplicativo e encaminhada ao Content Lab local.'
      : provider==='tiktok'
        ? 'TikTok Login Kit: registre o callback '+(status.tiktok?.redirectUri||'http://127.0.0.1:5000/api/social/oauth/tiktok/callback')+
          ' e solicite as permissões video.publish e video.list.'
        : 'Google Cloud: habilite a YouTube Data API e registre a URI '+
          (status.youtube?.redirectUri||'http://127.0.0.1:5000/api/social/oauth/youtube/callback')+
          '. O Content Lab solicitará seleção da conta Google.';
  }
  async function loadStatus(){
    const body=await request('/api/social/status');
    status=body.providers||{};
    const count=providers.filter(p=>connected(status[p])).length;
    $('settingsConnectedCount').textContent=count+' de 3 contas conectadas';
    for(const provider of providers){
      const item=status[provider]||{};
      const ready=connected(item);
      const card=$('settingsAccount-'+provider);
      const label=$('socialStatus-'+provider);
      const button=$('socialConnect-'+provider);
      const disconnect=$('socialDisconnect-'+provider);
      card.classList.toggle('is-connected',ready);
      label.classList.toggle('is-connected',ready&&!item.needsRenewal);
      label.classList.toggle('is-warning',!!item.needsRenewal);
      label.textContent=item.needsRenewal?'Renovar autorização':ready?'Conectado':
        item.configured?'Pronto para conectar':'Configurar primeiro';
      button.textContent=ready?'Reconectar '+names[provider]:
        item.configured?originalLabels[provider]:'Preparar conexão';
      button.title=item.configured?'Abrir a autorização oficial de '+names[provider]:
        'Configuração de aplicativo OAuth necessária apenas uma vez';
      disconnect.hidden=!ready;
    }
    applyGates();
    updateProviderForm();
  }
  const openConfiguration=provider=>{
    navigateToSettings();
    const advanced=$('settingsOAuthAdvanced');
    advanced.open=true;
    $('socialProvider').value=provider;
    updateProviderForm();
    $('socialClientId').focus();
    notice('A conexão de '+names[provider]+' precisa de uma configuração inicial do aplicativo OAuth. Preencha os dados abaixo uma única vez.');
  };
  for(const provider of providers){
    $('socialConnect-'+provider).addEventListener('click',()=>{
      if(!status[provider]?.configured){openConfiguration(provider);return;}
      window.location.assign('/api/social/oauth/'+provider+'/start');
    });
    $('socialDisconnect-'+provider).addEventListener('click',async()=>{
      if(!window.confirm('Desconectar '+names[provider]+' neste computador? Os tokens locais serão removidos.'))return;
      try{
        await request('/api/social/disconnect/'+provider,{
          method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
        });
        await loadStatus();
        notice(names[provider]+' desconectado. Você pode autorizar novamente a qualquer momento.');
      }catch(error){notice(error.message,true);}
    });
  }
  $('socialProvider').addEventListener('change',updateProviderForm);
  $('socialCredentialsForm').addEventListener('submit',async(event)=>{
    event.preventDefault();
    const provider=$('socialProvider').value;
    const payload={};
    const id=$('socialClientId').value.trim();
    const secret=$('socialClientSecret').value.trim();
    const redirect=$('socialInstagramRedirect').value.trim();
    if(id)payload.clientId=id;
    if(secret)payload.clientSecret=secret;
    if(provider==='instagram'&&redirect)payload.redirectUri=redirect;
    if(!status[provider]?.configured && (!id||!secret||(provider==='instagram'&&!redirect))){
      notice('Informe o ID e o Secret do aplicativo'+(provider==='instagram'?', além do retorno HTTPS.':'.'),true);
      return;
    }
    if(!Object.keys(payload).length){
      notice('Nenhuma alteração informada. Use o botão Conectar acima para autorizar.',true);return;
    }
    try{
      notice('Salvando a configuração local...');
      await request('/api/social/configure/'+provider,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
      });
      await loadStatus();
      if(status[provider]?.configured){
        $('settingsOAuthAdvanced').open=false;
        notice('Aplicativo '+names[provider]+' configurado! Clique em Conectar para abrir o login oficial.');
      }else notice('Configuração parcial salva. Confira os campos ainda necessários.',true);
    }catch(error){notice(error.message,true);}
  });
  $('publishGoSettings').addEventListener('click',navigateToSettings);
  $('publishManageAccounts').addEventListener('click',navigateToSettings);
  $('tab-settings').addEventListener('click',()=>loadStatus().catch(e=>notice(e.message,true)));
  $('tab-publications').addEventListener('click',()=>loadStatus().catch(e=>notice(e.message,true)));
  loadStatus().then(()=>{
    const query=new URLSearchParams(location.search);
    const outcome=query.get('authStatus'),provider=query.get('provider')||'';
    if(outcome==='connected')notice('Conta '+(names[provider]||'')+' autorizada! Publicações e Métricas já podem utilizar a conexão.');
    if(outcome==='failed')notice('Falha na autorização. Verifique as permissões e o callback cadastrado para '+(names[provider]||'a conta')+'.',true);
    if(outcome==='cancelled')notice('Autorização cancelada. Nenhuma nova credencial foi salva.',true);
    if(outcome)history.replaceState(null,'',location.pathname+'#settings');
    else notice('Escolha a rede social para autorizar. As configurações técnicas ficam em Configuração avançada.');
  }).catch(error=>{
    $('settingsConnectedCount').textContent='Conexões indisponíveis';
    notice('Falha ao ler as conexões: '+error.message,true);
  });
})();
