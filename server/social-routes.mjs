import {providerStatus,configureProvider,disconnectProvider,beginAuthorization,completeAuthorization,verifySocialConnection} from './social-auth.mjs';

// Apenas o servidor local possui os secrets e tokens. O navegador recebe somente status.
const sameOrigin=(req)=>{
  const origin=req.get('origin');
  const expected='http://127.0.0.1:'+Number(process.env.PORT||5000);
  const site=req.get('sec-fetch-site');
  return (!origin||origin===expected) && (!site||site==='same-origin'||site==='none');
};
const safeProvider=(name)=>['youtube','instagram','tiktok'].includes(name);
export function mountSocialRoutes(app,api){
  app.get('/api/social/status',api(async(req,res)=>{
    res.set('Cache-Control','no-store');
    res.json({providers:providerStatus()});
  }));
  app.post('/api/social/configure/:provider',api(async(req,res)=>{
    if(!sameOrigin(req)||!safeProvider(req.params.provider))
      return res.status(403).json({error:'Requisição de configuração não autorizada.'});
    try{
      const status=configureProvider(req.params.provider,req.body);
      res.set('Cache-Control','no-store').json({status});
    }catch(error){res.status(422).json({error:error.message});}
  }));
  app.post('/api/social/verify/:provider',api(async(req,res)=>{
    if(!sameOrigin(req)||!safeProvider(req.params.provider))
      return res.status(403).json({error:'Verificação de conta não autorizada.'});
    try {
      const status=await verifySocialConnection(req.params.provider);
      res.set('Cache-Control','no-store').json({status});
    } catch(error) {
      res.status(422).set('Cache-Control','no-store')
        .json({error:String(error.message||'Reconecte a conta em Configurações.').slice(0,170),
          status:providerStatus()[req.params.provider]});
    }
  }));
  app.post('/api/social/disconnect/:provider',api(async(req,res)=>{
    if(!sameOrigin(req)||!safeProvider(req.params.provider))
      return res.status(403).json({error:'Requisição não autorizada.'});
    res.set('Cache-Control','no-store').json({status:disconnectProvider(req.params.provider)});
  }));
  app.get('/api/social/oauth/:provider/start',api(async(req,res)=>{
    if(!safeProvider(req.params.provider))return res.status(404).end();
    try{
      const {url}=beginAuthorization(req.params.provider);
      res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').redirect(url);
    }catch(error){
      res.status(422).type('text/plain').send('Não foi possível iniciar o login: '+error.message);
    }
  }));
  app.get('/api/social/oauth/:provider/callback',api(async(req,res)=>{
    if(!safeProvider(req.params.provider))return res.status(404).end();
    res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer');
    if(req.query.error)return res.redirect('/?authStatus=cancelled#settings');
    try{
      await completeAuthorization(req.params.provider,String(req.query.state||''),String(req.query.code||''));
      res.redirect('/?authStatus=connected&provider='+encodeURIComponent(req.params.provider)+'#settings');
    }catch(error){
      // Não colocar tokens ou códigos OAuth em URL, HTML ou logs.
      res.redirect('/?authStatus=failed&provider='+encodeURIComponent(req.params.provider)+'#settings');
    }
  }));
}
