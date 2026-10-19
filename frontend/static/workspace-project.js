/* One explicit project per browser tab; every request captures its own root. */
(()=>{
  const $=id=>document.getElementById(id),key='contentlab.activeProject';let current=null,busy=false,resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  async function select(folder,{reload=false}={}){
    if(busy)throw Error('Aguarde o carregamento do projeto.');
    if(!folder?.trim())throw Error('Selecione a pasta do projeto.');
    const event=new CustomEvent('projectwillchange',{cancelable:true,detail:{projectRoot:folder,reload}});window.dispatchEvent(event);if(event.defaultPrevented)return false;
    if(window.contentlabEditor?.canLeave&&!window.contentlabEditor.canLeave())return false;
    busy=true;$('globalProjectChoose').disabled=true;$('globalProjectReload').disabled=true;$('globalProjectStatus').textContent='Reconhecendo a pasta…';
    try{
      try{await window.thumbnailProject?.flush();}catch(error){if(!reload||!window.confirm(error.message+' Descartar o rascunho local e recarregar o arquivo da pasta?'))throw error;}
      const response=await fetch('/api/workspace/project',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectRoot:folder,reload:true})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível abrir o projeto.');
      current=data;$('globalProjectRoot').value=data.projectRoot;
      try{localStorage.setItem(key,data.projectRoot);}catch{}
      for(const id of ['transcriptionProjectRoot','editorProjectRoot']){const field=$(id);if(field){field.value=data.projectRoot;field.dispatchEvent(new Event('input'));}}
      $('transcriptionFile').value='';
      let thumbnailWarning='';try{await window.thumbnailProject?.load(data.projectRoot);}catch(error){thumbnailWarning=' · Thumbnails: '+error.message;}
      await window.contentlabEditor?.apply(data);
      window.dispatchEvent(new CustomEvent('projectchanged',{detail:{...data,reload}}));
      $('globalProjectStatus').textContent=data.name+' · '+data.assets.length+' arquivo(s) · '+data.takeCount+' tomada(s)'+(data.hasEditPlan?' · plano de edição encontrado':' · sem plano de edição (necessário apenas no Editor)')+thumbnailWarning;
      return true;
    }catch(error){$('globalProjectStatus').textContent=error.message;throw error;}
    finally{busy=false;$('globalProjectChoose').disabled=false;$('globalProjectReload').disabled=!current;}
  }
  const run=fn=>async()=>{try{await fn();}catch(error){$('globalProjectStatus').textContent=error.message;}};
  $('globalProjectChoose').onclick=run(async()=>{const response=await fetch('/api/choose-folder',{method:'POST'}),data=await response.json();if(!response.ok)throw Error(data.error||'Seletor indisponível. Digite o caminho.');if(data.folder)await select(data.folder);});
  $('globalProjectReload').onclick=run(()=>select(current?.projectRoot||$('globalProjectRoot').value,{reload:true}));
  $('globalProjectRoot').onchange=run(()=>select($('globalProjectRoot').value));
  $('globalProjectRoot').onkeydown=event=>{if(event.key==='Enter'){$('globalProjectRoot').blur();}};
  window.ContentLabProject={ready,select,get root(){return current?.projectRoot||null;},get snapshot(){return current;}};
  window.addEventListener('load',async()=>{
    try{const last=localStorage.getItem(key);if(last)await select(last);}catch(error){$('globalProjectStatus').textContent='Não foi possível restaurar a pasta: '+error.message;}
    finally{resolveReady(current);}
  },{once:true});
})();
