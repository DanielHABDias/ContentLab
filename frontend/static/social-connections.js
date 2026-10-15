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
  let guideProvider=null;
  const onboarding={
    youtube:{
      title:'Conectar YouTube com Google',
      portal:'https://console.cloud.google.com/apis/credentials',
      docs:'https://developers.google.com/identity/protocols/oauth2/native-app',
      steps:[
        'Entre no Google Cloud, selecione ou crie um projeto e habilite YouTube Data API v3.',
        'Configure a tela de consentimento OAuth e, se estiver em modo de teste, adicione sua conta aos usuários de teste.',
        'Crie um cliente OAuth do tipo App para computador e baixe o arquivo JSON. Você não precisa copiar tokens.',
        'Importe o JSON aqui: o Content Lab guardará a configuração local e abrirá a tela oficial para escolher a conta Google.'
      ]},
    instagram:{
      title:'Conectar uma conta profissional do Instagram',
      portal:'https://developers.facebook.com/apps/',
      docs:'https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login',
      steps:[
        'No Meta for Developers, crie ou selecione um aplicativo e configure Instagram API with Instagram Login.',
        'Use uma conta Instagram profissional (Criador ou Empresa) e habilite instagram_business_basic, instagram_business_content_publish e instagram_business_manage_insights para métricas.',
        'Registre uma URL HTTPS de retorno de um domínio ou túnel sob seu controle, encaminhando somente o callback OAuth ao Content Lab local. Não use redirecionadores de terceiros para códigos de acesso.',
        'Em Configuração avançada, informe o App ID, App Secret e essa URL HTTPS. Depois clique em Conectar Instagram e autorize no site oficial.'
      ]},
    tiktok:{
      title:'Conectar TikTok',
      portal:'https://developers.tiktok.com/',
      docs:'https://developers.tiktok.com/docs/en/login-kit-desktop',
      steps:[
        'Entre no TikTok for Developers, abra Manage apps e crie ou selecione seu aplicativo.',
        'Adicione o Login Kit para Desktop e registre o retorno localhost indicado ao lado.',
        'Para vídeos e métricas, configure os produtos e solicite video.publish, video.list, user.info.profile e user.info.stats; a liberação depende da aprovação do TikTok.',
        'Em Configuração avançada, informe Client Key e Client Secret do aplicativo. Depois clique em Conectar TikTok para autorizar pelo site oficial.'
      ]}
  };
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
      ? 'Use a ponte OAuth local na porta 5151 com um túnel HTTPS de confiança e registre a mesma URL na Meta. Nunca exponha a porta 5000.'
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
      const verify=$('socialVerify-'+provider);
      const identity=$('socialIdentity-'+provider);
      const permissions=$('socialPermissions-'+provider);
      const missing=item.missingScopes||[];
      const identityName=item.accountName||item.accountUsername||'';
      identity.hidden=!ready||!identityName;
      identity.textContent=identityName+(item.accountUsername&&item.accountUsername!==identityName?' · @'+item.accountUsername.replace(/^@/,''):'');
      permissions.hidden=!ready||!missing.length;
      permissions.textContent=missing.length?'Permissões pendentes: '+missing.map(x=>x.split('/').pop()).join(', ')+'. Reconecte para tentar liberá-las.':'';
      verify.hidden=!ready;
      card.classList.toggle('is-connected',ready);
      label.classList.toggle('is-connected',ready&&!item.needsRenewal);
      label.classList.toggle('is-warning',!!item.needsRenewal||!!item.needsReauth||missing.length>0);
      label.textContent=item.needsReauth?'Reconectar conta':item.needsRenewal?'Sessão a renovar':
        ready?missing.length?'Permissões parciais':'Conectado':
        item.configured?'Pronto para conectar':'Configurar primeiro';
      if(item.needsReauth&&item.authError){
        permissions.hidden=false;
        permissions.textContent='Sessão expirada ou revogada: '+item.authError;
      }
      button.textContent=ready?'Reconectar '+names[provider]:originalLabels[provider];
      button.title=item.configured?'Abrir a autorização oficial de '+names[provider]:
        'Iniciar o assistente de primeira configuração para '+names[provider];
      disconnect.hidden=!ready&&!item.needsReauth;
    }
    applyGates();
    updateProviderForm();
  }
  const openConfiguration=provider=>{
    navigateToSettings();
    guideProvider=provider;
    const config=onboarding[provider];
    const guide=$('settingsSetupGuide');
    guide.hidden=false;
    $('settingsSetupTitle').textContent=config.title;
    $('settingsSetupIntro').textContent=
      'Primeira configuração: o portal oficial cadastra o aplicativo uma vez. Depois, o acesso à sua conta é feito com um clique.';
    const steps=$('settingsSetupSteps');
    steps.replaceChildren();
    for(const step of config.steps){
      const li=document.createElement('li');
      li.textContent=step;
      steps.append(li);
    }
    $('settingsSetupPortal').href=config.portal;
    $('settingsSetupDocs').href=config.docs;
    const redirect=status[provider]?.redirectUri||'';
    const usable=provider==='instagram'?/^https:\/\//.test(redirect):
      /^http:\/\/127\.0\.0\.1:\d+\/api\/social\/oauth\//.test(redirect);
    $('settingsSetupRedirect').textContent=usable?redirect:
      'HTTPS público necessário — configure um domínio ou túnel seguro';
    $('settingsSetupCopyRedirect').disabled=!usable;
    $('settingsSetupRedirectHint').textContent=provider==='instagram'?
      'Use uma URL HTTPS do túnel apontando para a ponte local na porta 5151; registre-a na Meta e no Content Lab. Não exponha a porta 5000.':
      'Copie esta URL de retorno e cadastre-a no produto OAuth / Login Kit do aplicativo.';
    $('settingsGoogleImport').hidden=provider!=='youtube';
    $('settingsInstagramBridge').hidden=provider!=='instagram';
    $('socialProvider').value=provider;
    updateProviderForm();
    $('settingsSetupMessage').textContent='';
    guide.scrollIntoView({behavior:'smooth',block:'start'});
    notice('Siga o assistente de '+names[provider]+'. Nenhum token ou senha precisa ser digitado.');
  };
  $('settingsSetupClose').addEventListener('click',()=>{
    $('settingsSetupGuide').hidden=true;
    guideProvider=null;
  });
  $('settingsSetupCopyRedirect').addEventListener('click',async()=>{
    const value=$('settingsSetupRedirect').textContent;
    try{
      await navigator.clipboard.writeText(value);
      $('settingsSetupMessage').textContent='URL copiada. Cole no cadastro OAuth do aplicativo.';
    }catch{
      $('settingsSetupMessage').textContent='Não foi possível copiar automaticamente. Selecione a URL e copie manualmente.';
      const selection=window.getSelection();
      const range=document.createRange();
      range.selectNodeContents($('settingsSetupRedirect'));
      selection.removeAllRanges();selection.addRange(range);
    }
  });
  $('settingsSetupManual').addEventListener('click',()=>{
    const form=$('settingsOAuthAdvanced');
    form.open=true;
    $('socialProvider').value=guideProvider||'youtube';
    updateProviderForm();
    form.scrollIntoView({behavior:'smooth',block:'start'});
    $('socialClientId').focus();
  });
  $('settingsGoogleJSON').addEventListener('change',async(event)=>{
    const file=event.target.files?.[0];
    if(!file)return;
    event.target.value='';
    try{
      if(file.size<10||file.size>65536)throw Error('O arquivo JSON do cliente OAuth deve ter no máximo 64 KB.');
      const data=JSON.parse(await file.text());
      const installed=data?.installed;
      if(!installed||typeof installed.client_id!=='string'||
        !installed.client_id.endsWith('.apps.googleusercontent.com')||
        typeof installed.client_secret!=='string'||!installed.client_secret)
        throw Error('Use o JSON de credenciais do tipo App para computador, não um token ou arquivo de conta de serviço.');
      $('settingsSetupMessage').textContent='Registrando o aplicativo Google localmente...';
      await request('/api/social/configure/youtube',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({clientId:installed.client_id,clientSecret:installed.client_secret})
      });
      await loadStatus();
      if(!status.youtube?.configured)throw Error('Configuração Google não foi concluída.');
      $('settingsSetupMessage').textContent='Configuração salva. Abrindo a autorização oficial do Google...';
      window.location.assign('/api/social/oauth/youtube/start');
    }catch(error){
      $('settingsSetupMessage').textContent=error?.message||'Falha ao importar credenciais.';
      notice('Importação não concluída. '+$('settingsSetupMessage').textContent,true);
    }
  });
  for(const provider of providers){
    $('socialConnect-'+provider).addEventListener('click',()=>{
      if(!status[provider]?.configured){openConfiguration(provider);return;}
      window.location.assign('/api/social/oauth/'+provider+'/start');
    });
    $('socialVerify-'+provider).addEventListener('click',async()=>{
      const button=$('socialVerify-'+provider);
      button.disabled=true;
      try{
        notice('Verificando a conta '+names[provider]+' com o provedor oficial...');
        await request('/api/social/verify/'+provider,{
          method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
        });
        await loadStatus();
        notice(names[provider]+' verificado com sucesso. Perfil e permissões atualizados.');
      }catch(error){
        await loadStatus().catch(()=>{});
        notice(names[provider]+': '+error.message+' Use Reconectar se a sessão não estiver mais válida.',true);
      }finally{button.disabled=false;}
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
        $('settingsSetupGuide').hidden=true;
        notice('Aplicativo '+names[provider]+' configurado. Abrindo a autorização oficial...');
        window.location.assign('/api/social/oauth/'+provider+'/start');
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
    if(outcome==='failed'){
      if(onboarding[provider])openConfiguration(provider);
      notice('O login não foi concluído. Confira o guia oficial de '+(names[provider]||'conexão')+
        ', a URL de retorno e as permissões liberadas para o aplicativo. Não copie tokens.',true);
    }
    if(outcome==='cancelled')notice('Autorização cancelada. Nenhuma nova credencial foi salva.',true);
    if(outcome)history.replaceState(null,'',location.pathname+'#settings');
    else notice('Escolha a rede social para autorizar. As configurações técnicas ficam em Configuração avançada.');
  }).catch(error=>{
    $('settingsConnectedCount').textContent='Conexões indisponíveis';
    notice('Falha ao ler as conexões: '+error.message,true);
  });
})();
