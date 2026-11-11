import crypto from 'node:crypto';

// A single non-persistent render queue, kept separate from the editor's individual jobs.
// Jobs are intentionally sequential to avoid overloading the local renderer/GPU.
export function createRenderQueue({loadProject,renderProject,isSingleRenderBusy=()=>false,isTranscribing=()=>false}){
  const jobs=new Map();
  let active=null;
  let latestId=null;
  const allowedModes=new Set(['reuse','rebuild']);
  const invalid=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
  const snapshot=job=>{
    if(!job)return null;
    const {controller,...data}=job;
    return {...data,items:job.items.map(item=>({...item}))};
  };
  const isQueued=root=>!!(active && active.status==='running' &&
    active.items.some(item=>item.projectRoot===root &&
      ['waiting','running'].includes(item.status)));
  const get=id=>snapshot(jobs.get(id));
  const latest=()=>get(active?.id||latestId);

  function enqueue({projectRoots,cacheMode='reuse',hardwareAccel=false,continueOnError=true}={}){
    if(active?.status==='running')throw invalid('Já existe uma fila de renderização em execução.',409);
    if(!Array.isArray(projectRoots)||projectRoots.length<1||projectRoots.length>40)
      throw invalid('Informe de 1 a 40 pastas de projetos.');
    if(!allowedModes.has(cacheMode)||typeof hardwareAccel!=='boolean'||typeof continueOnError!=='boolean')
      throw invalid('Opções de renderização inválidas.');
    const roots=projectRoots.map(r=>{
      if(typeof r!=='string'||!r.trim())throw invalid('Todas as linhas devem conter pastas válidas.');
      return r.trim();
    });
    const items=[],seen=new Set();
    for(const entry of roots){
      let project;
      try{project=loadProject(entry);}
      catch(e){throw invalid('Pasta inválida: '+entry+' — '+e.message,422);}
      const root=project.projectRoot;
      if(seen.has(root))throw invalid('Pasta repetida na fila: '+root,422);
      seen.add(root);
      if(!project.validation?.valid)throw invalid('Assets ou plano inválidos em '+root,422);
      if(!['ready','external'].includes(project.transcription?.status))
        throw invalid('Prepare a narração/transcrição antes da fila: '+root,422);
      if(isTranscribing(root))throw invalid('Transcrição em andamento: '+root,409);
      if(isSingleRenderBusy(root))throw invalid('Render individual já em andamento: '+root,409);
      items.push({projectRoot:root,name:project.name||root,status:'waiting',percent:0,stage:'waiting',
        message:'Aguardando vez',filepath:null,error:null});
    }
    const job={id:crypto.randomUUID(),status:'running',cacheMode,hardwareAccel,continueOnError,
      createdAt:Date.now(),startedAt:Date.now(),finishedAt:null,currentIndex:-1,
      cancelRequested:false,controller:null,items};
    active=job;latestId=job.id;jobs.set(job.id,job);
    // Leave the HTTP request free while each item runs in the background of the server process.
    void run(job);
    return snapshot(job);
  }

  async function run(job){
    for(let i=0;i<job.items.length;i++){
      const item=job.items[i];
      if(job.cancelRequested)break;
      job.currentIndex=i;
      const controller=new AbortController();
      job.controller=controller;
      item.status='running';item.stage='prepare';item.message='Preparando projeto';
      try{
        // Revalidate at execution time, because files can change on disk.
        const project=loadProject(item.projectRoot);
        if(!project.validation?.valid)throw Error('O plano ou os assets perderam a validade.');
        if(!['ready','external'].includes(project.transcription?.status))
          throw Error('A narração/transcrição não está pronta.');
        if(isSingleRenderBusy(item.projectRoot))throw Error('Projeto ocupado por outro render.');
        const report=await renderProject(item.projectRoot,{
          cacheMode:job.cacheMode,hardwareAccel:job.hardwareAccel,signal:controller.signal,
          progress:(stage,current,total,sceneId)=>{
            item.stage=stage;
            item.percent=stage==='scene'||stage==='scene_start'
              ?Math.min(85,Math.round((stage==='scene'?current:Math.max(0,current-1))/Math.max(1,total)*85))
              :({compose:90,narration:93,audio:96,verify:100}[stage]||item.percent);
            item.message=sceneId?String(sceneId):String(stage);
          }
        });
        if(controller.signal.aborted)throw Error('Cancelado pelo usuário.');
        item.status='done';item.stage='done';item.percent=100;
        item.filepath=report.output;item.message='Render concluído';
      }catch(error){
        item.status=controller.signal.aborted||job.cancelRequested?'cancelled':'error';
        item.stage=item.status;item.error=error.message;item.message=error.message;
        if(item.status==='error'&&!job.continueOnError)job.cancelRequested=true;
      }finally{job.controller=null;}
    }
    if(job.cancelRequested){
      for(const item of job.items)if(item.status==='waiting'){
        item.status='cancelled';item.stage='cancelled';item.message='Não iniciado';
      }
    }
    job.status=job.cancelRequested?'cancelled':
      job.items.some(x=>x.status==='error')?'finished_with_errors':'done';
    job.finishedAt=Date.now();
    if(active===job)active=null;
  }
  function cancel(id){
    const job=jobs.get(id);
    if(!job)throw invalid('Fila não encontrada.',404);
    if(job.status!=='running')throw invalid('Fila já finalizada.',409);
    job.cancelRequested=true;
    job.controller?.abort();
    return snapshot(job);
  }
  return {enqueue,get,latest,cancel,isQueued};
}
