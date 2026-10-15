import crypto from 'node:crypto';
import {searchMedia,importMedia,selectedMedia} from './media-library.mjs';

export function mountMediaLibraryRoutes(app,api,{searcher=searchMedia,importer=importMedia}={}){
  const jobs=new Map();
  let active=0;
  const originOk=req=>{
    const expected='http://127.0.0.1:'+Number(process.env.PORT||5000);
    const origin=req.get?.('origin');
    const site=req.get?.('sec-fetch-site');
    return (!origin||origin===expected)&&(!site||site==='same-origin'||site==='none');
  };
  app.get('/api/library/search',api(async(req,res)=>{
    res.set('Cache-Control','no-store');
    const query=String(req.query?.q||'');
    const source=String(req.query?.source||'all'),kind=String(req.query?.kind||'all');
    try{res.json(await searcher(query,{source,kind}));}
    catch(e){res.status(422).json({error:String(e.message).slice(0,180)});}
  }));
  app.post('/api/library/download',api(async(req,res)=>{
    if(!originOk(req))return res.status(403).json({error:'Origem não autorizada.'});
    if(req.body?.acknowledgeRights!==true)return res.status(422).json({
      error:'Confirme que você possui os direitos de reutilização e verificou a licença.'});
    const key=String(req.body?.key||'');
    try{selectedMedia(key);}catch(e){return res.status(422).json({error:e.message});}
    if(active>=2)return res.status(429).json({error:'Há dois downloads em andamento. Aguarde a conclusão.'});
    for(const [id,job] of jobs)if(Date.now()-job.started>3*60*60*1000)jobs.delete(id);
    const id=crypto.randomUUID();
    const job={id,status:'running',percent:0,message:'Preparando download…',
      result:null,error:null,started:Date.now()};
    jobs.set(id,job);active++;
    res.status(202).set('Cache-Control','no-store').json({id});
    importer(key,{update:(percent,message)=>{
      job.percent=Math.max(0,Math.min(100,Math.round(Number(percent)||0)));
      job.message=String(message||'Transferindo arquivo…').slice(0,140);
    }}).then(result=>{job.status='done';job.percent=100;job.result=result;
      job.message='Mídia importada com sucesso.';})
      .catch(error=>{job.status='error';job.error=String(error.message||error).slice(0,220);
        job.message='Não foi possível importar esta mídia.';})
      .finally(()=>{active--;});
  }));
  app.get('/api/library/jobs/:id',api(async(req,res)=>{
    if(!/^[a-f0-9-]{36}$/.test(req.params.id))return res.status(404).end();
    const job=jobs.get(req.params.id);
    if(!job)return res.status(404).json({error:'Download não encontrado.'});
    res.set('Cache-Control','no-store').json(job);
  }));
}
