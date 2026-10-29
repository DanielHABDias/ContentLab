/* Nova configuração social: abre os Studios no navegador do usuário; nunca publica via API. */
(()=>{
  const $=id=>document.getElementById(id);
  if(!$('socialBrowserSelect')||!$('publishSetupGate'))return;
  const platforms=['tiktok','instagram','youtube'];
  let settings=null,ready=false,opened=new Set(),loading=false;
  const notice=(message,invalid=false)=>{
    const label=$('socialSetupStatus');
    label.textContent=message||'';
    label.classList.toggle('social-error',invalid);
  };
  async function request(url,options={}){
    const response=await fetch(url,{cache:'no-store',...options});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Não foi possível concluir a configuração.');
    return data;
  }
  const post=(url,body={})=>request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const normalizeUrl=url=>{try{return new URL(url.trim()).href;}catch{return url.trim();}};
  const draft=()=>({
    browser:$('socialBrowserSelect').value,
    urls:Object.fromEntries(platforms.map(p=>[p,normalizeUrl($('socialUrl-'+p).value)]))
  });
  const changed=()=>{
    if(!settings)return true;
    const value=draft();
    return settings.browser!==value.browser||platforms.some(p=>settings.urls[p]!==value.urls[p]);
  };
  function render(){
    const pending=changed();
    for(const p of platforms){
      const confirmed=!pending&&settings?.confirmed[p]===true;
      $('socialState-'+p).textContent=confirmed?'Login conferido':'Não conferido';
      $('socialState-'+p).classList.toggle('is-confirmed',confirmed);
      $('socialOpen-'+p).disabled=!settings?.browser||pending;
      $('socialConfirm-'+p).disabled=pending||!opened.has(p)||confirmed;
    }
    const done=!pending&&ready;
    $('socialSetupSummary').textContent=done?'Navegador salvo e três logins conferidos. A nova aba já está liberada.':
      pending?'Salve as alterações antes de conferir os logins.':
      'Abra cada plataforma e confirme manualmente que está na conta certa. Falta conferir: '+platforms.filter(p=>!settings?.confirmed[p]).length+' plataforma(s).';
    $('socialGoPublications').disabled=!done;
    $('publishSetupGate').hidden=done;
    $('publishReady').hidden=!done;
    if(pending)notice('Há mudanças não salvas. Salve para revalidar os endereços.');
  }
  function goSettings(){$('tab-settings').click();}
  $('publishGoSettings').onclick=goSettings;
  $('publishManageAccounts').onclick=goSettings;
  $('socialGoPublications').onclick=()=>{if(ready&&!changed())$('tab-publications').click();};
  function setBrowserChoices(browsers){
    const selector=$('socialBrowserSelect');
    selector.replaceChildren();
    for(const entry of browsers){
      const option=new Option(entry.label+(entry.available?'':' · não encontrado'),entry.id);
      option.disabled=!entry.available;
      selector.add(option);
    }
    $('socialBrowserDetection').textContent=browsers[0]?.label||'Não foi possível detectar. Use o navegador padrão do sistema.';
  }
  async function load(){
    if(loading)return;loading=true;
    try{
      const data=await request('/api/social-browser/setup');
      setBrowserChoices(data.browsers);
      settings=data.settings;ready=data.ready===true;opened.clear();
      $('socialBrowserSelect').value=settings.browser||'system';
      for(const p of platforms)$('socialUrl-'+p).value=settings.urls[p];
      notice(settings.browser?'Configuração carregada do computador.':'Primeiro acesso: escolha o navegador e salve as URLs.');
      render();
      if(window.location.hash==='#publications'&&!ready)goSettings();
    }catch(error){notice(error.message,true);}
    finally{loading=false;}
  }
  for(const id of ['socialBrowserSelect',...platforms.map(p=>'socialUrl-'+p)]){
    $(id).addEventListener('input',()=>{opened.clear();render();});
    $(id).addEventListener('change',()=>{opened.clear();render();});
  }
  $('socialSaveSettings').onclick=async()=>{
    const button=$('socialSaveSettings');button.disabled=true;
    try{
      const data=await post('/api/social-browser/settings',draft());
      settings=data.settings;ready=data.ready;opened.clear();
      notice('Navegador e URLs salvos neste computador. Abra os sites e confira seus logins.');
      render();
    }catch(error){notice(error.message,true);}
    finally{button.disabled=false;}
  };
  for(const p of platforms){
    $('socialOpen-'+p).onclick=async()=>{
      try{
        if(changed())throw Error('Salve primeiro o navegador e os links.');
        const data=await post('/api/social-browser/open/'+p);
        if(!data.opened)throw Error('Não foi possível abrir a página.');
        opened.add(p);notice('Abrimos '+data.label+'. Confira no navegador se você está logado na conta correta e confirme abaixo.');
        render();
      }catch(error){notice(error.message,true);}
    };
    $('socialConfirm-'+p).onclick=async()=>{
      try{
        const data=await post('/api/social-browser/confirm/'+p);
        settings=data.settings;ready=data.ready;opened.delete(p);
        notice('Login de '+p+' confirmado por você. '+(ready?'Três plataformas prontas.':'Continue com as outras plataformas.'));
        render();
      }catch(error){notice(error.message,true);}
    };
    $('publishOpen-'+p).onclick=async()=>{
      try{await post('/api/social-browser/open/'+p);$('publishStatus').textContent='Site aberto. Nenhum vídeo foi publicado.';}
      catch(error){$('publishStatus').textContent=error.message;}
    };
  }
  window.addEventListener('workspacechange',event=>{
    if(event.detail.name==='publications'){
      if(!settings){load();return;}
      render();if(!ready||changed())goSettings();
    }else if(event.detail.name==='settings')load();
  });
  load();
})();
