import crypto from 'node:crypto';
import fs from 'node:fs';
import {publishFile,tiktokCreatorInfo} from './social-publish.mjs';
import {providerStatus} from './social-auth.mjs';

const jobs=new Map();
const safe=(req)=>{
  const origin=req.get('origin'),expected='http://127.0.0.1:'+Number(process.env.PORT||5000);
  const site=req.get('sec-fetch-site');
  return (!origin||origin===expected)&&(!site||site==='same-origin'||site==='none');
};
const status=(job)=>({
  id:job.id,platform:job.platform,status:job.status,message:job.message,
  result:job.result,error:job.error,createdAt:job.createdAt
});
export function mountSocialPublishRoutes(app,api,upload){
  app.get('/api/social/tiktok/creator-info',api(async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(!providerStatus().tiktok.connected)return res.status(409).json({error:'Conecte o TikTok primeiro.'});
    try{res.json(await tiktokCreatorInfo());}
    catch(error){res.status(422).json({error:error.message});}
  }));
  app.post('/api/social/publish',upload.single('file'),api(async(req,res)=>{
    const file=req.file?.path;
    if(!safe(req)){
      if(file)fs.rmSync(file,{force:true});
      return res.status(403).json({error:'Origem de publicação não autorizada.'});
    }
    if(!req.file)return res.status(422).json({error:'Selecione um MP4.'});
    const filename=req.file.originalname||'';
    if(!/\.mp4$/i.test(filename)){
      fs.rmSync(file,{force:true});return res.status(422).json({error:'Somente arquivos MP4.'});
    }
    if(!['youtube','instagram','tiktok'].includes(req.body.platform)){
      fs.rmSync(file,{force:true});return res.status(422).json({error:'Destino inválido.'});
    }
    const connected=providerStatus()[req.body.platform]?.connected;
    if(!connected){
      fs.rmSync(file,{force:true});return res.status(409).json({error:'Conecte a conta antes do envio.'});
    }
    if([...jobs.values()].some(item=>item.status==='running')){
      fs.rmSync(file,{force:true});return res.status(409).json({error:'Já existe um envio ativo. Aguarde terminar.'});
    }
    for(const [id,item] of jobs)if(Date.now()-item.createdAt>24*60*60*1000)jobs.delete(id);
    const id=crypto.randomUUID();
    const job={id,platform:req.body.platform,createdAt:Date.now(),
      status:'running',message:'Enviando arquivo para '+req.body.platform+'...',
      result:null,error:null};
    jobs.set(id,job);
    res.status(202).set('Cache-Control','no-store').json({jobId:id});
    // Mantém a operação no servidor mesmo depois de responder ao navegador.
    Promise.resolve().then(()=>publishFile(file,req.body)).then(result=>{
      job.status='done';job.message=result.state==='scheduled'?'Agendado no YouTube':
        result.state==='published'?'Publicado no Instagram':'Aceito pelo TikTok (processando)';
      job.result=result;
    }).catch(error=>{
      job.status='error';job.error=String(error.message||error).slice(0,600);
      job.message='O envio falhou. Verifique a conta antes de tentar novamente.';
    }).finally(()=>fs.rmSync(file,{force:true}));
  }));
  app.get('/api/social/jobs/:id',api(async(req,res)=>{
    res.set('Cache-Control','no-store');
    const job=jobs.get(req.params.id);
    if(!job)return res.status(404).json({error:'Envio não encontrado nesta sessão.'});
    res.json(status(job));
  }));
}
