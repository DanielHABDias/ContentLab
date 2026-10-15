import {providerStatus} from './social-auth.mjs';
import {readMetrics} from './social-metrics.mjs';

const providers=['youtube','instagram','tiktok'];
const stateFor=s=>s.connected||s.needsRenewal;
export function mountSocialMetricsRoutes(app,api,{statusGetter=providerStatus,reader=readMetrics}={}){
  app.get('/api/social/metrics',api(async(req,res)=>{
    res.set('Cache-Control','no-store');
    const requested=typeof req.query.platform==='string'?req.query.platform:'general';
    if(requested!=='general'&&!providers.includes(requested))
      return res.status(400).json({error:'Plataforma desconhecida.'});
    const current=statusGetter(),visible=requested==='general'?providers:[requested];
    const connected=Object.fromEntries(providers.map(name=>[name,{
      connected:!!current[name]&&stateFor(current[name]),configured:!!current[name]?.configured
    }]));
    const report={view:requested,connected,platforms:{},updatedAt:new Date().toISOString()};
    const tasks=visible.filter(name=>connected[name].connected);
    await Promise.all(tasks.map(async name=>{
      try {
        report.platforms[name]={status:'ok',data:await reader(name)};
      }catch(error) {
        report.platforms[name]={status:'error',
          message:String(error?.message||'Não foi possível consultar a plataforma.').slice(0,260)};
      }
    }));
    res.json(report);
  }));
}
